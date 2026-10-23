import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createNativeArtworkStore, ART_CHUNK_BYTES, MAX_ART_BYTES } from '../runtime/native-art-storage.js';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fake() {
  const files = new Map(), transfers = new Map(), calls = [];
  let sequence = 0;
  const key = a => `${a.namespace}/${a.sha256}`;
  const plugin = {
    async begin(a) { const handle = String(++sequence); transfers.set(handle, { ...a, data: Buffer.alloc(0) }); return { handle }; },
    async append(a) { const t = transfers.get(a.handle); assert.equal(a.offset, t.data.length); t.data = Buffer.concat([t.data, Buffer.from(a.data, 'base64')]); return { bytes: t.data.length }; },
    async commit({ handle }) { const t = transfers.get(handle); assert.equal(hash(t.data), t.sha256); files.set(key(t), t.data); return { status: 'stored', bytes: t.data.length }; },
    async abort({ handle }) { calls.push(['abort', handle]); transfers.delete(handle); },
    async stat(a) { const data = files.get(key(a)); return { exists: !!data, bytes: data?.length ?? 0 }; },
    async read(a) { const data = files.get(key(a)); const chunk = data.subarray(a.offset, a.offset + ART_CHUNK_BYTES); return { offset: a.offset, bytes: chunk.length, totalBytes: data.length, data: chunk.toString('base64') }; },
    async clear(a) { calls.push(['clear', a]); for (const k of files.keys()) if (k.startsWith(`${a.namespace}/`)) files.delete(k); return { removedBytes: 0 }; },
    async remove(a) { files.delete(key(a)); return { removedBytes: 0 }; },
    async stats() { return { evictableBytes: 0, pinnedBytes: 0, pendingBytes: 0, availableBytes: 123 }; },
  };
  return { plugin, store: createNativeArtworkStore(plugin), files, transfers, calls };
}
test('artwork crosses native bridge in bounded chunks and round trips', async () => {
  const { store, transfers } = fake(); const data = Buffer.alloc(ART_CHUNK_BYTES * 2 + 17, 3), sha256 = hash(data);
  assert.equal((await store.put({ sha256, blob: new Blob([data]) })).status, 'stored');
  assert.deepEqual(Buffer.from(await (await store.readBlob({ sha256, mime: 'image/webp' })).arrayBuffer()), data);
  assert.equal(transfers.size, 0);
});
test('eviction preserves pinned artwork; pinned clearing requires explicit confirmation', async () => {
  const { store, files, calls } = fake(); const data = Buffer.from('art'), sha256 = hash(data);
  for (const namespace of ['pinned', 'evictable']) await store.put({ namespace, sha256, blob: new Blob([data]) });
  await store.clearEvictable(); assert.equal(files.size, 1); assert.ok(files.has(`pinned/${sha256}`));
  await assert.rejects(store.clearPinned(), /Confirm/); assert.equal(calls.filter(c => c[0] === 'clear').length, 1);
  await store.clearPinned({ confirm: true }); assert.equal(files.size, 0);
});
test('invalid paths, namespaces and sizes fail before native mutation', async () => {
  const { store, transfers } = fake(); const sha256 = hash('a');
  for (const bad of [{ namespace: 'scan-captures', sha256 }, { sha256: '../records' }, { sha256: '/absolute' }]) await assert.rejects(store.put({ ...bad, blob: new Blob(['a']) }), /identity/);
  for (const blob of [new Blob([]), new Blob([new Uint8Array(MAX_ART_BYTES + 1)])]) await assert.rejects(store.put({ sha256, blob }), /24 MiB/);
  assert.equal(transfers.size, 0);
});
test('failed writes abort temporary bytes and never report success', async () => {
  for (const phase of ['append', 'commit']) {
    const { store, plugin, transfers, calls } = fake(); plugin[phase] = async () => { throw Error('disk full'); };
    await assert.rejects(store.put({ sha256: hash('x'), blob: new Blob(['x']) }), /disk full/);
    assert.equal(transfers.size, 0); assert.equal(calls.at(-1)[0], 'abort');
  }
});
test('malformed receipts fail closed and abort', async () => {
  const { store, plugin, transfers } = fake(); plugin.append = async () => ({ bytes: 999 });
  await assert.rejects(store.put({ sha256: hash('x'), blob: new Blob(['x']) }), /incomplete/); assert.equal(transfers.size, 0);
});
test('missing art yields null, truncated read fails rather than partial blob', async () => {
  const { store, plugin } = fake(); const sha256 = hash('x'); assert.equal(await store.readBlob({ sha256 }), null);
  await store.put({ sha256, blob: new Blob(['x']) }); plugin.read = async () => ({ offset: 0, bytes: 0, totalBytes: 1, data: '' });
  await assert.rejects(store.readBlob({ sha256 }), /incomplete/);
});
test('disk stats reject malformed native values', async () => {
  const { store, plugin } = fake(); assert.equal((await store.stats()).availableBytes, 123);
  plugin.stats = async () => ({ evictableBytes: -1 }); await assert.rejects(store.stats(), /disk usage/);
});
