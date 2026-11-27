// Edge test (world v3 section 7): ride at the mountain foot from 40 m out at 12 to 22 m/s on several headings; the bank must send the rider back in, never stop them dead.
import { Game } from '../src/sim/game.js';
import { heightAt, streamTo } from '../src/sim/terrain.js';
import { EDGE } from '../src/gen/world/world.js';
const out = [];
for (const seed of [21, 77]) for (let k = 0; k < 10; k++) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', card: true }); g.god = true; g.spawnAcc = -1e9; const p = g.p;
  const a = k * 0.6, ex = Math.cos(a), ez = Math.sin(a), R = EDGE - 40, s = Math.pow(Math.abs(ex) ** 4 + Math.abs(ez) ** 4, 0.25), x = ex / s * R, z = ez / s * R, v = 12 + k;
  streamTo(x, z, 120, 6); p.x = x; p.z = z; p.y = heightAt(x, z); p.grounded = true; p.vx = ex * v; p.vz = ez * v; const yaw = Math.atan2(-ex, -ez);
  g.step(1 / 60, { f: 1, r: 0, yaw }); p.ride.heading = Math.atan2(ex, ez); p.ride.speed = v;
  let minSp = 99, back = false, maxIn = 0; for (let t = 0; t < 600; t++) { g.step(1 / 60, { f: 1, r: 0, yaw }); const r = p.ride, out_ = (p.x * ex + p.z * ez); maxIn = Math.max(maxIn, out_ - (x * ex + z * ez)); if (r && r.on) minSp = Math.min(minSp, r.speed); if (r && Math.cos(r.heading - Math.atan2(ex, ez)) < -0.3 && t > 20) { back = true; break; } }
  out.push({ seed, k, v, back, climbed: +maxIn.toFixed(1), minSpeed: +minSp.toFixed(1) });
}
console.log(JSON.stringify({ turnedBack: out.filter(o => o.back).length + ' of ' + out.length, rows: out.map(o => (o.back ? 'B' : '-') + o.v + ':' + o.climbed).join(' ') }));
