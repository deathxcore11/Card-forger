import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { transformNativeStorageApp, transformNativeStorageViews } from '../scripts/transform-native-storage-settings.mjs';
const sourcePath = process.env.CARDSTASHY_SOURCE || new URL('../shared-source', import.meta.url).pathname;
const app = await readFile(`${sourcePath}/app.js`, 'utf8');
const views = await readFile(`${sourcePath}/views.js`, 'utf8');
const transformed = transformNativeStorageApp(app);
const boundary = transformed.slice(transformed.indexOf('// CardStashy native artwork settings boundary'), transformed.indexOf('\n/* =========================================================\n   Boot', transformed.indexOf('// CardStashy native artwork settings boundary')));
function setup({ native = true, confirm = true, stats, clear } = {}) {
  const elements = Object.fromEntries(['storageDetail', 'storageBreakdown', 'storageActionStatus'].map(id => [id, { isConnected: true, textContent: '', innerHTML: '' }]));
  const calls = [], messages = [];
  const context = vm.createContext({ A: {}, CARDSTASHY_NATIVE: native, accountGeneration: 0, cloudInfo: () => ({ user: { id: 'one' } }),
    document: { getElementById: id => elements[id] }, $: selector => elements[selector.slice(1)],
    ask: async question => { calls.push(['ask', question]); return confirm; }, toast: value => messages.push(value), esc: value => value,
    localStorageFootprint: () => 12, batchStorageSummary: () => ({ count: 2, chars: 100 }), persistenceStatus: async () => ({ usage: 100, persistent: true }),
    cachedImages: async options => { calls.push(['browserImages', options]); return { available: true, count: 5 }; },
    CARDSTASHY_ARTWORK_STORAGE: {
      stats: stats || (async () => ({ evictableBytes: 30, pinnedBytes: 40, pendingBytes: 5, availableBytes: 1000 })),
      clearEvictable: async () => { calls.push(['evict']); return clear ? clear() : { removedBytes: 30 }; },
      clearPinned: async options => { calls.push(['pinned', options]); return clear ? clear() : { removedBytes: 40 }; },
    },
  });
  vm.runInContext(boundary, context);
  return { context, elements, calls, messages, button: { isConnected: true, disabled: false } };
}
test('both transforms reject missing, duplicated, and repeated anchors; full modules parse', () => {
  for (const [transform, source] of [[transformNativeStorageApp, app], [transformNativeStorageViews, views]]) {
    assert.throws(() => transform(''), /anchor/); assert.throws(() => transform(source + source), /anchor/); assert.throws(() => transform(transform(source)), /already/);
    const check = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: transform(source), encoding: 'utf8' }); assert.equal(check.status, 0, check.stderr);
  }
});
test('native shows measured artwork pools separately and never calls browser storage estimate', async () => {
  const r = setup(); await r.context.storageDetail();
  assert.match(r.elements.storageDetail.textContent, /app-private phone storage/);
  assert.match(r.elements.storageBreakdown.innerHTML, /30 bytes/); assert.match(r.elements.storageBreakdown.innerHTML, /40 bytes/); assert.match(r.elements.storageBreakdown.innerHTML, /5 bytes/);
  assert.match(r.elements.storageBreakdown.innerHTML, /not removable here/); assert.match(r.elements.storageBreakdown.innerHTML, /2 pending/); assert.equal(r.calls.length, 0);
});
test('native eviction and pinned deletion use existing confirmation dialog and distinct APIs', async () => {
  const r = setup(); await r.context.A.clearCachedImages(r.button); assert.equal(r.calls[0][0], 'ask'); assert.equal(r.calls[1][0], 'evict');
  assert.match(r.elements.storageActionStatus.textContent, /30 bytes/);
  await r.context.A.clearPinnedArtwork(r.button); assert.equal(r.calls[2][0], 'ask'); assert.equal(r.calls[3][0], 'pinned'); assert.equal(r.calls[3][1].confirm, true);
  assert.equal(r.calls.filter(c => c[0] === 'browserImages').length, 0); assert.equal(r.button.disabled, false);
});
test('cancelled confirmation and leaving Settings never delete artwork', async () => {
  const r = setup({ confirm: false }); await r.context.A.clearCachedImages(r.button); assert.equal(r.calls.length, 1); assert.equal(r.button.disabled, false);
  r.context.ask = async () => { r.button.isConnected = false; return true; };
  await r.context.A.clearPinnedArtwork(r.button); assert.equal(r.calls.length, 1);
});
test('repeated and cross-button clicks serialize while confirmation is pending', async () => {
  const r = setup(); let resolve; r.context.ask = () => new Promise(done => { resolve = done; });
  const first = r.context.A.clearCachedImages(r.button); await r.context.A.clearPinnedArtwork({ isConnected: true, disabled: false });
  resolve(true); await first; assert.deepEqual(r.calls.map(c => c[0]), ['evict']);
});
test('failed/invalid removal does not claim success and does not fall back to browser deletion', async () => {
  for (const clear of [() => { throw Error('disk unavailable'); }, () => ({ removedBytes: -1 })]) {
    const r = setup({ clear }); await r.context.A.clearCachedImages(r.button);
    assert.match(r.elements.storageActionStatus.textContent, /may be partial/); assert.equal(r.button.disabled, false); assert.equal(r.calls.filter(c => c[0] === 'browserImages').length, 0);
  }
});
test('closed and stale detail requests cannot overwrite current Settings', async () => {
  const resolvers = []; const r = setup({ stats: () => new Promise(done => resolvers.push(done)) });
  const first = r.context.storageDetail(), second = r.context.storageDetail();
  resolvers[1]({ evictableBytes: 99, pinnedBytes: 0, pendingBytes: 0, availableBytes: 100 }); await second;
  resolvers[0]({ evictableBytes: 10, pinnedBytes: 0, pendingBytes: 0, availableBytes: 100 }); await first;
  assert.match(r.elements.storageBreakdown.innerHTML, /99 bytes/); assert.doesNotMatch(r.elements.storageBreakdown.innerHTML, /10 bytes/);
});
test('unavailable bridge fails safely without browser-cache fallback', async () => {
  const r = setup(); r.context.CARDSTASHY_ARTWORK_STORAGE = undefined;
  await r.context.storageDetail(); assert.match(r.elements.storageDetail.textContent, /unavailable/);
  await r.context.A.clearCachedImages(r.button); assert.equal(r.calls.length, 0);
});
test('browser storage details and browser cleanup retain original behavior', async () => {
  const r = setup({ native: false }); await r.context.A.clearCachedImages(r.button);
  assert.equal(r.calls[0][0], 'browserImages'); assert.equal(r.calls[0][1].clear, true); assert.match(r.elements.storageActionStatus.textContent, /Cleared 5 cached images/);
  assert.match(r.elements.storageDetail.textContent, /used by this site/); assert.equal(r.calls.some(c => c[0] === 'ask'), false);
});
test('native compact controls explain uninstall and immutable built-in art; browser markup unchanged', () => {
  const result = transformNativeStorageViews(views);
  const fragments = result.match(/\$\{globalThis\.CARDSTASHY_NATIVE\?[^\n]+?\}/g); assert.equal(fragments.length, 2);
  const render = native => fragments.map(fragment => vm.runInNewContext('`' + fragment + '`', { CARDSTASHY_NATIVE: native })).join('');
  assert.match(render(true), /Remove pinned offline art/); assert.match(render(true), /not in your Gallery/); assert.match(render(true), /No bulk artwork downloads/);
  assert.doesNotMatch(render(true), /data-act="persist"/); assert.match(render(false), /Keep offline data/); assert.match(render(false), /Pictures download again/); assert.doesNotMatch(render(false), /pinned offline art/);
});
