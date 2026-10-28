import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformNativePlaneswalk } from '../scripts/transform-native-planeswalk.mjs';

test('a match puts the phone in play mode and leaving it gives the phone back', async () => {
  const observers = [];
  globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} };
  const { installNativeDisplay } = await import('../runtime/native-display.js');
  const classes = new Set(), root = { classList: { contains: c => classes.has(c) } }, modes = [];
  installNativeDisplay({ plugin: { setMode: async ({ mode }) => { modes.push(mode); } }, root });
  classes.add('practice-table-open'); observers[0].fn();
  observers[0].fn();
  classes.delete('practice-table-open'); observers[0].fn();
  assert.deepEqual(modes, ['app', 'play', 'app']);
});

test('Planeswalk in the app drops web fonts and loads its native script once', async () => {
  const page = '<html><head><link rel="preconnect" href="https://fonts.gstatic.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?x"><style>a{}</style></head><body></body></html>';
  const out = transformNativePlaneswalk(page);
  assert.doesNotMatch(out, /fonts\.g/);
  assert.equal(out.split('native-planeswalk.js').length, 2);
  assert.throws(() => transformNativePlaneswalk('<html><body></body></html>'), /Planeswalk page shape/);
  assert.match(await readFile(new URL('../runtime/native-planeswalk.js', import.meta.url), 'utf8'), /__CAPACITOR_CORE__/);
});
