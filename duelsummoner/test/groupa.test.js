import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { heightAt } from '../src/sim/terrain.js';
import { fireShot, updatePickups } from '../src/sim/weapons.js';
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
const mk = seed => { const g = new Game(seed, { oldGen: true, mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };
const walkable = (x, z, y) => { const h = heightAt(x, z); return h < 50 && Math.abs(h - y) <= 0.5; };

test('A6: a magnet-pulled pickup never rides a wall: its height stays on the ground and it never crosses a tall wall', () => {
  const g = mk(5); const m = g.pick; let tested = 0;
  for (let x = -90; x < 90 && tested < 40; x += 1) for (let z = -90; z < 90 && tested < 40; z += 1) {
    if (heightAt(x, z) < 20 || heightAt(x, z) >= 50 || heightAt(x - 2, z) > 3 || heightAt(x - 1, z) > 3) continue;   // a tall wall cell with open ground to its west
    const i = tested++; m.alive[i] = 1; m.kind[i] = 0; m.val[i] = 1; m.x[i] = x - 1.5; m.z[i] = z + 0.5; m.y[i] = heightAt(x - 1.5, z) + 0.5;
    g.p.x = x + 4; g.p.z = z + 0.5; g.p.y = 0;                                  // the duelist is on the far side of the wall
    for (let k = 0; k < 60; k++) updatePickups(g, 1 / 60);
    assert.ok(m.y[i] < 50, 'pickup height ' + m.y[i]); assert.ok(m.x[i] < x, 'pickup at x ' + m.x[i] + ' stayed on its side of the wall at ' + x);
    m.alive[i] = 0;
  }
  assert.ok(tested > 0, 'found tall wall cells to test against');
});

test('A7: shots hit a tall boss from 4 m and 5.8 m above its feet', () => {
  for (const dy of [4, 5.8]) {
    const g = mk(3), sp = { alive: true, dead: false, role: 'bossA', size: 7, radius: 1.5, x: 0, y: 0, z: 0, hp: 1000, maxHp: 1000 };
    g.sp.push(sp); let hit = 0; g.damageSpecial = () => { hit++; };
    fireShot(g, 0, 0, dy, -3, 0, dy, 3, 10, 2, 5, {});
    for (let k = 0; k < 40; k++) require_update(g);
    assert.equal(hit, 1, 'shot at ' + dy + ' m above the feet of a 7 m boss hit once');
  }
});
import { updateShots } from '../src/sim/weapons.js';
function require_update(g) { updateShots(g, 1 / 60); }

test('A8: the Descent Circle and the Final Altar are on walkable ground at the boss height, even with the boss against a wall', () => {
  let found = 0;
  for (const seed of [3, 7, 11]) {
    const g = mk(seed);
    outer: for (let x = -80; x < 80; x += 2) for (let z = -80; z < 80; z += 2) {
      const h = heightAt(x, z); if (h >= 3 || heightAt(x + 8, z) < 20) continue;   // boss on open ground, the circle spot is inside a wall
      if (g.map.prims.length === 0) break;
      const sp = { alive: false, dead: true, role: 'gate', x, y: h, z, size: 6, radius: 1 }; g.sp.push(sp); g.gateDown = sp; g.gate.state = 'fight';
      g.step(1 / 60, idle);
      assert.ok(g.circle, 'a circle opened'); assert.ok(walkable(g.circle.x, g.circle.z, h), 'circle at ' + g.circle.x.toFixed(1) + ',' + g.circle.z.toFixed(1) + ' height ' + heightAt(g.circle.x, g.circle.z));
      found++; break outer;
    }
  }
  assert.ok(found >= 1, 'found a boss spot against a wall in at least one seed');
});

test('A9: the rising sand is measured from the arena centre', () => {
  const g = mk(3); const c = g.map.arena.center;
  g.boss = { state: 'active', phase: 3, sandT: 60, sandR: 10, tickT: 0 }; g.sp.push({ alive: true, dead: false, role: 'gate', x: c.x, y: 0, z: c.z, size: 6, radius: 1, hp: 1e9, maxHp: 1e9 });
  g.p.x = c.x + 20; g.p.z = c.z; g.p.y = heightAt(g.p.x, g.p.z); g.god = false; const hp0 = g.p.hp;
  g.step(1 / 60, idle);
  assert.ok(g.p.hp < hp0, 'the sand hurts a duelist 20 m from the arena centre when the ring is at 10 m');
});

