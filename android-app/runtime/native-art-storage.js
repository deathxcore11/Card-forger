// Native disk storage only: no downloader, provider policy, or scan/collection mutation.
export const ART_CHUNK_BYTES = 64 * 1024;
export const MAX_ART_BYTES = 24 * 1024 * 1024;
const encode64 = bytes => { let result = ''; for (const byte of bytes) result += String.fromCharCode(byte); return btoa(result); };
const decode64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const integer = value => Number.isSafeInteger(value) && value >= 0;
function identity(namespace, sha256) {
  if (!['evictable', 'pinned'].includes(namespace) || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError('Invalid artwork identity.');
  return { namespace, sha256 };
}
export function createNativeArtworkStore(plugin) {
  async function put({ namespace = 'evictable', sha256, blob }) {
    const key = identity(namespace, sha256);
    if (!(blob instanceof Blob) || blob.size < 1 || blob.size > MAX_ART_BYTES) throw new TypeError('Artwork must be between 1 byte and 24 MiB.');
    let handle;
    try {
      ({ handle } = await plugin.begin({ ...key, bytes: blob.size }));
      if (typeof handle !== 'string' || !handle) throw Error('Artwork staging was not confirmed.');
      for (let offset = 0; offset < blob.size; offset += ART_CHUNK_BYTES) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + ART_CHUNK_BYTES).arrayBuffer());
        const receipt = await plugin.append({ handle, offset, data: encode64(bytes) });
        if (receipt.bytes !== offset + bytes.length) throw Error('Artwork staging was incomplete.');
      }
      const result = await plugin.commit({ handle });
      if (result.status !== 'stored' || result.bytes !== blob.size) throw Error('Artwork storage was not confirmed.');
      return { ...key, bytes: result.bytes, status: 'stored' };
    } finally { if (handle) await plugin.abort({ handle }).catch(() => {}); }
  }
  async function stat({ namespace = 'evictable', sha256 }) {
    const result = await plugin.stat(identity(namespace, sha256));
    if (typeof result?.exists !== 'boolean' || !integer(result.bytes) || result.bytes > MAX_ART_BYTES || (result.exists && result.bytes === 0)) throw Error('Invalid artwork metadata.');
    return result;
  }
  async function readBlob({ namespace = 'evictable', sha256, mime = 'application/octet-stream' }) {
    const key = identity(namespace, sha256);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/octet-stream'].includes(mime)) throw new TypeError('Invalid artwork MIME.');
    const metadata = await stat(key); if (!metadata.exists) return null;
    const chunks = []; let offset = 0;
    while (offset < metadata.bytes) {
      const chunk = await plugin.read({ ...key, offset }); const data = decode64(chunk.data);
      if (chunk.offset !== offset || chunk.bytes !== data.length || chunk.totalBytes !== metadata.bytes || !data.length || data.length > ART_CHUNK_BYTES || offset + data.length > metadata.bytes) throw Error('Artwork read was incomplete.');
      chunks.push(data); offset += data.length;
    }
    return new Blob(chunks, { type: mime });
  }
  async function stats() {
    const result = await plugin.stats();
    if (!['evictableBytes', 'pinnedBytes', 'pendingBytes', 'availableBytes'].every(key => integer(result?.[key]))) throw Error('Invalid artwork disk usage.');
    return result;
  }
  async function remove({ namespace = 'evictable', sha256 }) { return plugin.remove(identity(namespace, sha256)); }
  async function clearEvictable() { return plugin.clear({ namespace: 'evictable' }); }
  async function clearPinned({ confirm = false } = {}) {
    if (confirm !== true) throw Error('Confirm removal of pinned offline artwork first.');
    return plugin.clear({ namespace: 'pinned', confirmPinned: true });
  }
  return Object.freeze({ put, stat, readBlob, stats, remove, clearEvictable, clearPinned });
}
