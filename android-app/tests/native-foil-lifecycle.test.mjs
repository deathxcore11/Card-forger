import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transformNativeFoil } from '../scripts/transform-native-foil.mjs';

const sourcePath = process.env.CARDSTASHY_SOURCE || new URL('../shared-source', import.meta.url).pathname;
const source = await readFile(`${sourcePath}/foil-gl.js`, 'utf8');
function setup({ native = true, initialState, transformed = true, noRaf = false } = {}) {
  let sequence = 0;
  const callbacks = new Map(), allCallbacks = new Map(), listeners = new Map(), cancelled = [];
  const context = {
    CARDSTASHY_NATIVE: native ? { platform: 'android' } : undefined,
    document: { documentElement: { dataset: { nativeAppState: initialState } } },
    addEventListener: (name, fn) => listeners.set(name, fn),
    requestAnimationFrame: noRaf ? undefined : fn => { const id = sequence++; callbacks.set(id, fn); allCallbacks.set(id, fn); return id; },
    cancelAnimationFrame: id => { cancelled.push(id); callbacks.delete(id); },
  };
  // The source has no imports. Remove exports to execute its real implementation in a fresh realm.
  vm.runInNewContext((transformed ? transformNativeFoil(source) : source).replace(/\bexport /g, '') + '\nglobalThis.loop=foilLoop;', context);
  return {
    loop: context.loop, callbacks, allCallbacks, cancelled, listeners,
    event(state) { listeners.get('cardstashy-native-lifecycle')?.({ detail: { state } }); },
    frame(now = 100) { const batch = [...callbacks]; callbacks.clear(); for (const [, fn] of batch) fn(now); },
  };
}
const handle = (animated = true) => { const h = { draws: 0, animated: () => animated, draw() { h.draws++; } }; return h; };

test('transform guards missing, drifted, duplicated, and already transformed source', () => {
  assert.throws(() => transformNativeFoil(''), /Unexpected/);
  assert.throws(() => transformNativeFoil(source.replace('let ticking=0,lastSweep=0', 'let ticking=1,lastSweep=0')), /Unexpected/);
  assert.throws(() => transformNativeFoil(source + source), /Unexpected/);
  assert.throws(() => transformNativeFoil(transformNativeFoil(source)), /Unexpected/);
});

test('background cancels pending RAF (including id zero); repeated foreground resumes same handles once', () => {
  const r = setup(), h = handle(); r.loop.add(h); r.loop.kick(); r.loop.kick();
  assert.equal(r.callbacks.size, 1);
  for (let i = 0; i < 10; i++) {
    r.event('background'); assert.equal(r.callbacks.size, 0); r.loop.kick(); assert.equal(r.callbacks.size, 0);
    const before = h.draws; r.frame(); assert.equal(h.draws, before);
    r.event('foreground'); r.event('foreground'); r.loop.kick(); assert.equal(r.callbacks.size, 1);
    r.frame(100 + i * 100); assert.equal(h.draws, before + 1); assert.equal(r.callbacks.size, 1);
  }
  assert.equal(r.cancelled[0], 0);
});

test('stale cancelled callbacks cannot create duplicate loops after resume', () => {
  const r = setup(), h = handle(); r.loop.add(h); r.loop.kick(); const stale = r.allCallbacks.get(0);
  r.event('background'); r.event('foreground'); stale(100);
  assert.equal(h.draws, 0); assert.equal(r.callbacks.size, 1);
  r.frame(); assert.equal(h.draws, 1); assert.equal(r.callbacks.size, 1);
});

test('deleting last handle cancels loop; adding a new handle works without resurrecting disposed ones', () => {
  const r = setup(), h = handle(); r.loop.add(h); r.loop.kick(); r.frame();
  r.loop.delete(h); assert.equal(r.callbacks.size, 0);
  r.event('background'); r.event('foreground'); assert.equal(r.callbacks.size, 0);
  const next = handle(); r.loop.add(next); r.loop.kick(); r.frame(200);
  assert.equal(next.draws, 1); assert.equal(h.draws, 1);
});

test('initial background and memory pressure retain all handles without enabling background work', () => {
  const r = setup({ initialState: 'background' }), h = handle(); r.loop.add(h); r.loop.kick();
  r.event('memory-pressure'); assert.equal(r.callbacks.size, 0);
  r.event('foreground'); r.frame(); assert.equal(h.draws, 1);
  r.event('memory-pressure'); assert.equal(r.callbacks.size, 1); r.frame(200); assert.equal(h.draws, 2);
});

test('foreground redraws non-animated foils once, and handles absent RAF safely', () => {
  const r = setup(), h = handle(false); r.loop.add(h); r.event('background'); r.event('foreground'); r.frame();
  assert.equal(h.draws, 1); assert.equal(r.callbacks.size, 0);
  const no = setup({ noRaf: true }); no.loop.add(handle()); no.loop.kick(); no.event('foreground');
  assert.equal(no.callbacks.size, 0);
});

test('desktop code path stays identical to original and ignores native lifecycle events', () => {
  const run = transformed => {
    const r = setup({ native: false, transformed }), h = handle(); r.loop.add(h); r.loop.kick();
    const pending = [r.callbacks.size]; r.frame(); pending.push(r.callbacks.size); r.event('background'); r.frame(200);
    r.loop.delete(h); r.frame(300);
    return { draws: h.draws, pending, remaining: r.callbacks.size, listeners: r.listeners.size, cancelled: r.cancelled };
  };
  assert.deepEqual(run(true), run(false));
});

test('lifecycle or disposal during a drawing callback cannot leave extra scheduled work', () => {
  for (const action of ['background', 'dispose', 'cycle']) {
    const r = setup(), h = handle();
    h.draw = () => { h.draws++; if (action === 'dispose') r.loop.delete(h); else { r.event('background'); if (action === 'cycle') r.event('foreground'); } };
    r.loop.add(h); r.loop.kick(); r.frame();
    assert.equal(h.draws, 1); assert.equal(r.callbacks.size, action === 'cycle' ? 1 : 0);
  }
});

test('existing 30/15 fps sweep throttle is preserved', () => {
  for (const count of [1, 13]) {
    const r = setup(), hs = Array.from({ length: count }, () => handle());
    hs.forEach(h => r.loop.add(h)); r.loop.kick(); r.frame(31);
    assert.equal(hs[0].draws, 0); r.frame(32);
    assert.equal(hs[0].draws, count > 12 ? 0 : 1); r.frame(64);
    assert.equal(hs[0].draws, count > 12 ? 1 : 2);
  }
});
