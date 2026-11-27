// The big roster's data (built from the locked plan files): sizes, old ids, the point budget, the run draw, Chimeras
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASICS, FUSION_LIST, GODS, SECRETS, FAMILIES, ROSTER, rosterOf, statsOf, dialsOf, DIALS, BUDGET, runPool, chimeraOf, fusionOf, legacyOk, RARITY } from '../src/data/roster.js';
import { MONSTERS, FUSIONS } from '../src/data/cards.js';

test('roster: 320 basics in 40 families of eight, 160 Fusions, the named Gods and Secrets; every old monster id still resolves', () => {
  assert.equal(BASICS.length, 320); assert.equal(FAMILIES.length, 40); assert.equal(FUSION_LIST.length, 160);
  for (const f of FAMILIES) assert.equal(BASICS.filter(b => b.family === f.id).length, 8, f.id);
  assert.ok(GODS.length >= 54 && SECRETS.length >= 13, 'gods ' + GODS.length + ', secrets ' + SECRETS.length);
  assert.ok(legacyOk()); for (const id of [...Object.keys(MONSTERS), ...Object.keys(FUSIONS)]) assert.ok(rosterOf(id), 'old id ' + id);
  assert.equal(MONSTERS['rune-apprentice'].name, 'Rune Newt'); assert.equal(FUSIONS['astral-magus'].name, 'Astral Strix');
});
test('roster: every form spends exactly its points, rarity never changes power, a partner pair makes its Fusion and any other pair a Chimera', () => {
  for (const e of Object.values(ROSTER)) for (const f of e.forms) { const d = dialsOf(f.points, e.job, e.rarity, !!e.familyTrait), sum = DIALS.reduce((a, k) => a + d[k], 0) + (e.familyTrait ? BUDGET.trait * f.points / 100 : 0); assert.ok(Math.abs(sum - f.points) < 0.5, e.id); }
  const byR = {}; for (const b of BASICS) (byR[b.rarity] = byR[b.rarity] || new Set()).add(statsOf(b.id, 2).points); for (const r of Object.keys(RARITY)) assert.deepEqual([...byR[r]], [250]);
  const a = BASICS.find(b => b.partner), F = fusionOf(a.id, a.partner); assert.ok(F && F.kind === 'fusion');
  const other = BASICS.find(b => b.id !== a.id && b.id !== a.partner), C = chimeraOf(a.id, other.id); assert.ok(C && C.attackMul === 0.7 && C.canClimb === false); assert.equal(chimeraOf(a.id, a.partner), null);
  assert.deepEqual(chimeraOf(a.id, other.id).id, chimeraOf(other.id, a.id).id, 'the same pair either way');
});
test('roster: a run draws 28 basics, the duelist\'s home family plus ten pairs, seeded', () => {
  const p = runPool(21, 'kael'); assert.equal(p.length, 28); assert.equal(new Set(p).size, 28); assert.deepEqual(p, runPool(21, 'kael')); assert.notDeepEqual(p, runPool(22, 'kael'));
  const home = rosterOf(MONSTERS['ember-wyvern'] ? 'ember-wyvern' : p[0]).family; assert.equal(p.filter(id => rosterOf(id).family === home).length >= 8, true);
});
