import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeDocuments, DOCUMENT_CHUNK_BYTES, MAX_DOCUMENT_BYTES } from '../runtime/native-documents.js';
function fake({ cancel = false, failAppend = false, result = null } = {}) {
  let staged = [], released = [], saveCalls = 0;
  const plugin = {
    beginSave: async () => ({ handle: 'opaque' }),
    appendSaveChunk: async ({ offset, data }) => { if (failAppend) throw Error('disk full'); const value = Buffer.from(data, 'base64'); assert.equal(offset, staged.length); staged.push(...value); return { bytes: staged.length }; },
    saveDocument: async options => { saveCalls++; assert.equal(options.bytes, staged.length); return result || (cancel ? { status: 'cancelled' } : { status: 'saved', closed: true, bytes: staged.length }); },
    discardSave: async ({ handle }) => { released.push(handle); },
  };
  return { plugin, get bytes() { return Buffer.from(staged); }, get released() { return released; }, get saveCalls() { return saveCalls; } };
}
test('UTF-8 survives chunk boundaries and provider close confirms save', async () => {
  const backend = fake(), documents = createNativeDocuments(backend.plugin), text = 'a'.repeat(DOCUMENT_CHUNK_BYTES - 1) + '🃏Pokémon'.repeat(9000);
  const result = await documents.saveDocument({ name: 'cards.json', text, mime: 'application/json' });
  assert.equal(result.saved, true); assert.equal(backend.bytes.toString(), text); assert.deepEqual(backend.released, ['opaque']);
});
test('cancel is not success and staged copy is discarded', async () => {
  const backend = fake({ cancel: true }); assert.deepEqual(await createNativeDocuments(backend.plugin).saveDocument({ text: 'abc' }), { status: 'cancelled', saved: false }); assert.deepEqual(backend.released, ['opaque']);
});
test('write failure never opens a save picker and preserves caller input', async () => {
  const backend = fake({ failAppend: true }), text = 'original'; await assert.rejects(createNativeDocuments(backend.plugin).saveDocument({ text }), /disk full/); assert.equal(backend.saveCalls, 0); assert.equal(text, 'original');
});
test('a provider response without closed stream is not success', async () => {
  const backend = fake({ result: { status: 'saved', bytes: 3 } }); await assert.rejects(createNativeDocuments(backend.plugin).saveDocument({ text: 'abc' }), /did not confirm/);
});
test('empty document saves without a chunk', async () => { const backend = fake(); assert.equal((await createNativeDocuments(backend.plugin).saveDocument({ text: '' })).bytes, 0); });
test('oversized export is rejected before native staging', async () => {
  let called = false; const docs = createNativeDocuments({ beginSave: () => { called = true; } }); await assert.rejects(docs.saveDocument({ text: new Uint8Array(MAX_DOCUMENT_BYTES + 1) }), /larger/); assert.equal(called, false);
});
test('picker cancellation returns no file', async () => assert.deepEqual(await createNativeDocuments({ openDocument: async () => ({ status: 'cancelled' }) }).pickDocument(), { status: 'cancelled' }));
test('selected document round-trips through bounded chunks and releases temporary copy', async () => {
  const bytes = Buffer.from('Pokémon 🃏'.repeat(10000)); let released = false;
  const docs = createNativeDocuments({ openDocument: async () => ({ status: 'selected', handle: 'one', name: 'backup.json', mime: 'application/json', bytes: bytes.length }), readDocumentChunk: async ({ offset }) => { const part = bytes.subarray(offset, offset + DOCUMENT_CHUNK_BYTES); return { offset, bytes: part.length, totalBytes: bytes.length, data: part.toString('base64') }; }, releaseDocument: async () => { released = true; } });
  const result = await docs.pickDocument(); assert.equal(await result.file.text(), bytes.toString()); assert.equal(result.file.name, 'backup.json'); assert.equal(released, true);
});
test('truncated import never becomes a File', async () => {
  let released = false;
  const docs = createNativeDocuments({ openDocument: async () => ({ status: 'selected', handle: 'one', bytes: 4 }), readDocumentChunk: async () => ({ offset: 0, bytes: 0, totalBytes: 4, data: '' }), releaseDocument: async () => { released = true; } });
  await assert.rejects(docs.pickDocument(), /incomplete/); assert.equal(released, true);
});

test('cleanup failure never masks a successful save or locks later saves', async () => {
  const backend = fake(); backend.plugin.discardSave = () => { throw Error('cleanup'); };
  const docs = createNativeDocuments(backend.plugin);
  assert.equal((await docs.saveDocument({ text: '' })).saved, true);
  assert.equal((await docs.saveDocument({ text: '' })).saved, true);
});
test('cleanup failure preserves the original import error and unlocks picker', async () => {
  const docs = createNativeDocuments({ openDocument: async () => ({ status: 'selected', handle: 'bad', bytes: -1 }), releaseDocument: () => { throw Error('cleanup'); } });
  await assert.rejects(docs.pickDocument(), /safely/);
  await assert.rejects(docs.pickDocument(), /safely/);
});
test('overlapping saves are rejected without interrupting the active save', async () => {
  const backend = fake(); let resume;
  backend.plugin.beginSave = () => new Promise(resolve => { resume = () => resolve({ handle: 'opaque' }); });
  const docs = createNativeDocuments(backend.plugin), first = docs.saveDocument({ text: '' });
  await assert.rejects(docs.saveDocument({ text: '' }), /already in progress/);
  resume(); assert.equal((await first).saved, true);
});
test('malformed native staging handle does not reach the save picker', async () => {
  let called = false;
  const docs = createNativeDocuments({ beginSave: async () => ({}), saveDocument: async () => { called = true; } });
  await assert.rejects(docs.saveDocument({ text: '' }), /valid handle/); assert.equal(called, false);
});
test('oversized import is rejected and released before reading', async () => {
  let released = false, read = false;
  const docs = createNativeDocuments({ openDocument: async () => ({ status: 'selected', handle: 'one', bytes: MAX_DOCUMENT_BYTES + 1 }), readDocumentChunk: () => { read = true; }, releaseDocument: async () => { released = true; } });
  await assert.rejects(docs.pickDocument(), /safely/); assert.equal(read, false); assert.equal(released, true);
});

import { installFileInputAdapter } from '../runtime/native-documents.js';
function adapterHarness(pickDocument, overrides = {}) {
  let listener; const dispatched = [], errors = [];
  class Transfer { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } }
  const doc = { defaultView: { Event, DataTransfer: Transfer }, addEventListener: (_, fn) => { listener = fn; }, removeEventListener: (_, fn) => { assert.equal(fn, listener); } };
  const input = { matches: () => true, hasAttribute: () => false, accept: '', isConnected: true, disabled: false, multiple: false, files: ['original'], dispatchEvent: event => dispatched.push(event.type), ...overrides };
  const dispose = installFileInputAdapter({ pickDocument }, { document: doc, onError: error => errors.push(error) });
  const click = () => { const event = { target: input, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} }; return { event, done: listener(event) }; };
  return { input, dispatched, errors, click, dispose };
}
test('adapter dispatches input then change and routes mixed accepts to general documents', async () => {
  const file = new File(['abc'], 'cards.json'); let kind;
  const h = adapterHarness(async options => { kind = options.kind; return { status: 'selected', file }; }, { accept: 'image/*,.json' });
  await h.click().done; assert.equal(kind, 'document'); assert.deepEqual(h.dispatched, ['input', 'change']); assert.deepEqual(h.input.files, [file]);
});
test('adapter routes image extension-only accepts to photos', async () => {
  let kind; const h = adapterHarness(async options => { kind = options.kind; return { status: 'cancelled' }; }, { accept: '.JPG, .png' });
  await h.click().done; assert.equal(kind, 'image');
});
test('adapter cancel keeps existing files and emits cancel only', async () => {
  const h = adapterHarness(async () => ({ status: 'cancelled' })); await h.click().done;
  assert.deepEqual(h.input.files, ['original']); assert.deepEqual(h.dispatched, ['cancel']);
});
test('adapter leaves camera, multiple-selection, and disabled inputs to Capacitor', async () => {
  for (const overrides of [{ hasAttribute: () => true }, { multiple: true }, { disabled: true }]) {
    let called = false; const h = adapterHarness(async () => { called = true; }, overrides), click = h.click();
    await click.done; assert.equal(called, false); assert.equal(click.event.prevented, false);
  }
});
test('adapter suppresses double-click picker races and detached input delivery', async () => {
  let finish, calls = 0; const h = adapterHarness(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = h.click(); await h.click().done; assert.equal(calls, 1); h.input.isConnected = false;
  finish({ status: 'selected', file: new File(['x'], 'x') }); await first.done;
  assert.deepEqual(h.dispatched, []); assert.deepEqual(h.errors, []);
});
test('adapter disposal prevents a late picker result from mutating the input', async () => {
  let finish; const h = adapterHarness(() => new Promise(resolve => { finish = resolve; }));
  const first = h.click(); h.dispose(); finish({ status: 'selected', file: new File(['x'], 'x') }); await first.done;
  assert.deepEqual(h.input.files, ['original']); assert.deepEqual(h.dispatched, []);
});
