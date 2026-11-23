import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs'; import { join } from 'node:path';
import { keyWords } from '../src/ui/prompts.js';
// The sim never names a key in text it produces (menus-spec step 6): prompts carry {use} and the view says which button.
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const BAD = /'(?:Hold )?E: |\bpress E\b|\bhold E\b|WASD|Tab to |\bEsc\b|'Enter\b| click\b|\(E\)|\bE to /;
test('no key names in strings in src/sim', () => {
  const hits = []; for (const f of walk('src/sim')) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { const code = l.replace(/\/\/.*$/, ''); if (BAD.test(code)) hits.push(f + ':' + (i + 1) + ' ' + code.trim().slice(0, 80)); });
  assert.deepEqual(hits, []);
});
test('the view words the button for the input in use', () => {
  assert.equal(keyWords('{use}: open the Sealed Chest', 'keys'), 'E: open the Sealed Chest'); assert.equal(keyWords('{use}: open the Sealed Chest', 'touch'), 'Tap: open the Sealed Chest');
  assert.equal(keyWords('Hold {use} at the gate', 'pad'), 'Hold X at the gate');
});
