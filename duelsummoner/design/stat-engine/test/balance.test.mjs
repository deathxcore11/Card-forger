// Skeptic balance review (22 Nov): regressions for the findings fixed in the engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { K } from '../src/tuning.js';
import { Ledger, STAT, LUT, copyEff, edgePerHit, clampPts } from '../src/stats.js';
import { deriveWeapons, applyLoadout } from '../src/loadout.js';
import { MONSTERS, DUELISTS } from '../src/content.js';

const T0 = { dmg: 0, rate: 0, area: 0, coef: 0, proj: 0 };
const lo = (mons, pts = []) => ({ mons: mons.map(id => ({ id, lvl: 10, tier: MONSTERS[id].tier, tune: { ...T0 } })), st: [], bless: {}, items: {}, hidden: 0, pts });

test('Edge adds the same DPS per target to a 0.1 s beam and a slow God Fusion (no x18 for fast hitters)', () => {
  const gain = id => {
    const with_ = new Ledger(), without = new Ledger();
    const a = deriveWeapons(applyLoadout(with_, lo([id], [[STAT.EDGE, K.edgeCap]])), lo([id]))[0];
    const b = deriveWeapons(applyLoadout(without, lo([id])), lo([id]))[0];
    return (a.base - b.base) * a.rate;          // Edge DPS per target
  };
  const beam = gain('lantern-acolyte'), god = gain('stormcrown-drake');
  assert.ok(Math.abs(beam / god - 1) < 0.01, `Edge DPS per target differs: beam ${beam.toFixed(2)} vs God Fusion ${god.toFixed(2)}`);
  assert.equal(edgePerHit(30, K.edgeRefCd), 30);
});

test('on-event item copies have a ceiling: copyEff(1) = 1, 2 copies = 2, never past copyCap', () => {
  assert.equal(copyEff(0), 0); assert.equal(copyEff(1), 1); assert.equal(copyEff(2), 2);
  for (let n = 1; n < 1e6; n *= 3) { assert.ok(copyEff(n) < K.copyCap); assert.ok(copyEff(n + 1) >= copyEff(n)); }
  assert.ok(copyEff(1e9) / copyEff(1e6) < 1.001, 'copies keep adding damage');
});

test('Oren starts on a monster whose proc chance is below the cap, so Bound Pages is not dead on his own starter', () => {
  const D = MONSTERS[DUELISTS.oren.start], p0 = K.statusP0[['fire', 'ice', 'lightning', 'poison', 'wind', 'earth', 'light', 'dark'].indexOf(D.elems[0])];
  const p = f => Math.min(K.procCap, p0 * K.proc[D.kind] / 200 * LUT.ferv[clampPts(f)]);
  assert.ok(p(K.orenCap) > p(K.orenPer * 5) + 0.05, 'Fervor from 15 to 60 points must still raise the starter proc chance');
});
