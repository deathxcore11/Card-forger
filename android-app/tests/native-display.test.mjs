import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformNativePlaneswalk } from '../scripts/transform-native-planeswalk.mjs';

test('a match puts the phone in play mode, turns it sideways, and leaving it gives the phone back', async () => {
  const observers = [];
  globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} };
  const { installNativeDisplay } = await import('../runtime/native-display.js');
  const classes = new Set(), root = { classList: { contains: c => classes.has(c) } }, modes = [], turns = [];
  installNativeDisplay({ plugin: { setMode: async ({ mode }) => { modes.push(mode); }, setOrientation: async ({ orientation }) => { turns.push(orientation); } }, root });
  classes.add('practice-table-open'); observers[0].fn();
  observers[0].fn();
  classes.delete('practice-table-open'); observers[0].fn();
  assert.deepEqual(modes, ['app', 'play', 'app']);
  assert.deepEqual(turns, ['default', 'landscape', 'default']);
});

test('Planeswalk in the app drops web fonts and loads its native script once', async () => {
  const page = '<html><head><link rel="preconnect" href="https://fonts.gstatic.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?x"><style>a{}</style></head><body></body></html>';
  const out = transformNativePlaneswalk(page);
  assert.doesNotMatch(out, /fonts\.g/);
  assert.equal(out.split('native-planeswalk.js').length, 2);
  assert.throws(() => transformNativePlaneswalk('<html><body></body></html>'), /Planeswalk page shape/);
  assert.match(await readFile(new URL('../runtime/native-planeswalk.js', import.meta.url), 'utf8'), /__CAPACITOR_CORE__/);
});

test('a folded foldable is asked to open when a game starts; unfolding or "Play folded" clears it', async () => {
  const { installFoldPrompt } = await import('../runtime/native-fold-prompt.js');
  const made = [], el = tag => { const e = { tag, hidden: false, attrs: {}, children: [], listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, append(c) { this.children.push(c); }, addEventListener(t, f) { this.listeners[t] = f; }, querySelector() { return button; } }; made.push(e); return e; };
  const button = el('button');
  const doc = { createElement: el, head: el('head'), body: el('body') };
  let listener, playing = false;
  const plugin = { getScreen: async () => ({ foldable: true, folded: true }), addListener: async (name, fn) => { listener = fn; } };
  const fold = installFoldPrompt({ plugin, playing: () => playing, doc });
  await new Promise(r => setTimeout(r));
  assert.equal(doc.body.children.length, 0, 'nothing shows outside a game');
  playing = true; fold.check();
  const card = doc.body.children[0];
  assert.equal(card.hidden, false);
  listener({ foldable: true, folded: false });
  assert.equal(card.hidden, true, 'unfolding clears it');
  listener({ foldable: true, folded: true });
  assert.equal(card.hidden, false);
  button.listeners.click();
  assert.equal(card.hidden, true, 'Play folded keeps going');
  playing = false; fold.check(); playing = true; fold.check();
  assert.equal(card.hidden, false, 'the next game asks again');
  assert.equal(installFoldPrompt({ plugin: {} }).check(), undefined, 'older app builds without the bridge stay quiet');
});
