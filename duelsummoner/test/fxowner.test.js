// Owner tags (spectacle spec 2.5): every effect record carries owner 0 (player), 1 (enemy) or 2 (world). The ink rule, the governor, the keyhole and the drop ladder touch only owner 0.
// A build test fails if any effect spawn has no owner: every addFx call in src/sim names one, and addFx itself defaults a record to 2 (world) so nothing is ever without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addFx, makeFx } from '../src/sim/combat.js';

test('every addFx spawn in src/sim names an owner of 0, 1 or 2', () => {
  const dir = new URL('../src/sim/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'); let n = 0;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.js'))) readFileSync(join(dir, f), 'utf8').split('\n').forEach((line, i) => { if (/addFx\(g,\s*\{/.test(line)) { n++; assert.match(line, /owner:\s*[012]\b|owner:\s*[a-zA-Z]/, f + ':' + (i + 1) + ' has no owner'); } });
  assert.ok(n >= 10, 'found ' + n + ' spawns');
});
test('addFx always leaves a record with an owner (default 2, world)', () => {
  const g = { fx: makeFx(4) }; const o = addFx(g, { type: 'ring', x: 0, y: 0, z: 0 }); assert.equal(o.owner, 2);
  const p = addFx(g, { type: 'ring', owner: 0, x: 0, y: 0, z: 0 }); assert.equal(p.owner, 0);
  for (const r of g.fx) assert.ok([0, 1, 2].includes(r.owner));
});
