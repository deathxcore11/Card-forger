// A bot walks each designed map from the spawn to the gate along the spine, with run, jump and dash only, in god mode; then 12 enemies are released at the spawn to see that the flow field carries them across the tiers to the duelist.
// Reports the sim seconds it took, stuck spots (under 0.5 m in 2 s), and how many enemies reached the duelist.   node tools/walkspine.mjs [seeds...]
import { Game } from '../src/sim/game.js';
import { loadStageMap } from '../src/sim/stages.js';
import { heightAt } from '../src/sim/terrain.js';
import { spawnEnemy } from '../src/sim/enemies.js';

const seeds = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [1, 2, 3];
let bad = 0;
for (const seed of seeds) for (const stage of [0, 1, 2]) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; g.stage = stage; loadStageMap(g, stage); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null);
  const m = g.map, p = g.p, path = m._road.main.slice(), gate = m.gate; path.push([gate.x, gate.z]); const stuck = []; let wi = 1, t = 0, last = [p.x, p.z, 0], done = false;
  for (let tick = 0; tick < 60 * 150 && !done; tick++) {
    while (wi < path.length - 1 && Math.hypot(path[wi][0] - p.x, path[wi][1] - p.z) < 2.2) wi++;
    const tx = path[wi][0], tz = path[wi][1], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), yaw = Math.atan2(-dx, -dz);
    const ax = p.x + dx / d * 1.6, az = p.z + dz / d * 1.6, rise = heightAt(ax, az) - p.y, jump = rise > 0.3 && rise < 3 || Math.hypot(p.x - last[0], p.z - last[1]) < 0.02 && tick - last[2] > 20;
    g.step(1 / 60, { f: 1, r: 0, yaw, jump, dash: rise > 2.2 || tick % 200 < 4 && false, slide: false, use: false }); t = tick / 60;
    if (tick - last[2] >= 120) { if (Math.hypot(p.x - last[0], p.z - last[1]) < 0.5) stuck.push([+p.x.toFixed(1), +p.z.toFixed(1), +t.toFixed(0)]); last = [p.x, p.z, tick]; }
    if (Math.hypot(gate.x - p.x, gate.z - p.z) < 6) done = true;
  }
  // enemies from the spawn region toward the duelist standing at the gate
  const sx = m.spawn.x, sz = m.spawn.z, ids = []; for (let k = 0; k < 12; k++) { spawnEnemy(g, 'husk', { x: sx + (k % 4) * 1.5, z: sz + ((k / 4) | 0) * 1.5 }); ids.push(g.lastSlot); }
  for (let tick = 0; tick < 60 * 120; tick++) g.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false });
  const d0 = Math.hypot(sx - p.x, sz - p.z), live = ids.filter(i => g.en.alive[i]), ds = live.map(i => Math.hypot(g.en.x[i] - p.x, g.en.z[i] - p.z)).sort((a, b) => a - b), near = ds.filter(d => d < 6).length, total = live.length;
  console.log(`seed ${seed} stage ${stage + 1} ${m.key}: ${done ? 'REACHED the gate' : 'DID NOT REACH'} in ${t.toFixed(0)} s, stuck spots ${stuck.length}${stuck.length ? ' ' + JSON.stringify(stuck.slice(0, 3)) : ''}; enemies: ${total}/12 alive, ${near} within 6 m of the duelist, the closest ${ds.length ? ds[0].toFixed(0) : '-'} m away (they started ${d0.toFixed(0)} m away), after 120 s`);
  if (!done) bad++;
}
process.exit(bad ? 1 : 0);

