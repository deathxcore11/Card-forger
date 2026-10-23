export const MAX_DOCUMENT_BYTES = 60_000_000;
export const DOCUMENT_CHUNK_BYTES = 64 * 1024;
const encode64 = bytes => { let value = ''; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value); };
const decode64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

export function createNativeDocuments(plugin) {
  let saving = false, picking = false;
  async function saveDocument({ name, text, mime = 'text/plain' }) {
    if (saving) throw Error('A document save is already in progress.');
    saving = true; let handle;
    try {
      const blob = new Blob([text], { type: mime });
      if (blob.size > MAX_DOCUMENT_BYTES) throw Error('This document is larger than the supported 60 MB limit. Your data is unchanged.');
      ({ handle } = await plugin.beginSave());
      if (typeof handle !== 'string' || !handle) throw Error('Document staging did not return a valid handle.');
      for (let offset = 0; offset < blob.size; offset += DOCUMENT_CHUNK_BYTES) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + DOCUMENT_CHUNK_BYTES).arrayBuffer());
        const receipt = await plugin.appendSaveChunk({ handle, offset, data: encode64(bytes) });
        if (receipt.bytes !== offset + bytes.length) throw Error('Document staging did not complete correctly.');
      }
      const result = await plugin.saveDocument({ handle, name, mime, bytes: blob.size });
      if (result?.status === 'cancelled') return { status: 'cancelled', saved: false };
      if (result?.status !== 'saved' || result.closed !== true || result.bytes !== blob.size) throw Error('The file provider did not confirm the saved document.');
      return { status: 'saved', saved: true, bytes: result.bytes };
    } finally {
      if (handle) { try { await plugin.discardSave({ handle }); } catch {} }
      saving = false;
    }
  }
  async function pickDocument({ kind = 'document' } = {}) {
    if (picking) throw Error('A file picker is already open.');
    picking = true; let selected;
    try {
      selected = await plugin.openDocument({ kind: kind === 'image' ? 'image' : 'document' });
      if (selected?.status === 'cancelled') return { status: 'cancelled' };
      if (selected?.status !== 'selected' || typeof selected.handle !== 'string' || !Number.isSafeInteger(selected.bytes) || selected.bytes < 0 || selected.bytes > MAX_DOCUMENT_BYTES) throw Error('The selected file could not be opened safely.');
      const chunks = []; let offset = 0;
      while (offset < selected.bytes) {
        const chunk = await plugin.readDocumentChunk({ handle: selected.handle, offset });
        const bytes = decode64(chunk.data);
        if (chunk.offset !== offset || chunk.bytes !== bytes.length || chunk.totalBytes !== selected.bytes || !bytes.length || bytes.length > DOCUMENT_CHUNK_BYTES || offset + bytes.length > selected.bytes) throw Error('The selected file was incomplete.');
        chunks.push(bytes); offset += bytes.length;
      }
      return { status: 'selected', file: new File(chunks, selected.name || 'CardStashy_Import', { type: selected.mime || 'application/octet-stream' }) };
    } finally {
      if (selected?.handle) { try { await plugin.releaseDocument({ handle: selected.handle }); } catch {} }
      picking = false;
    }
  }
  return Object.freeze({ saveDocument, pickDocument });
}

export function installFileInputAdapter(documents, { document: doc = globalThis.document, onError = () => {} } = {}) {
  let active = true, pending = false;
  const listener = async event => {
    const input = event.target;
    // Live capture stays in Capacitor's existing camera/HTML capture path.
    if (!input?.matches?.('input[type="file"]') || input.hasAttribute('capture') || input.multiple || input.disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (pending) return;
    pending = true;
    try {
      const accepted = (input.accept || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      const imagesOnly = accepted.length > 0 && accepted.every(value => /^image\//.test(value) || /^\.(?:png|jpe?g|webp|avif|gif|heic|heif|bmp)$/.test(value));
      const result = await documents.pickDocument({ kind: imagesOnly ? 'image' : 'document' });
      if (!active || !input.isConnected || input.disabled) return;
      const view = doc.defaultView || globalThis;
      if (result.status === 'cancelled') { input.dispatchEvent(new view.Event('cancel', { bubbles: true })); return; }
      const transfer = new view.DataTransfer(); transfer.items.add(result.file); input.files = transfer.files;
      input.dispatchEvent(new view.Event('input', { bubbles: true }));
      input.dispatchEvent(new view.Event('change', { bubbles: true }));
    } catch (error) { if (active) onError(error); }
    finally { pending = false; }
  };
  doc.addEventListener('click', listener, true);
  return () => { active = false; doc.removeEventListener('click', listener, true); };
}
