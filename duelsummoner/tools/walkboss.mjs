// Quick Duel and the gate boss fight on designed maps, with the bot: walk spawn to gate, wake the gate, fight in god mode for 90 s. Reports the arena fit (the ring and the floor under it), stuck spots and the boss state.   node tools/walkboss.mjs [seeds...]
import { Game } from '../src/sim/game.js';
import { loadStageMap } from '../src/sim/stages.js';
import { heightAt } from '../src/sim/terrain.js';

const seeds = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [1, 2];
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
for (const mode of ['run', 'quick']) for (const seed of seeds) for (const stage of mode === 'quick' ? [0] : [0, 1, 2]) {
  const g = new Game(seed, { mode, duelist: 'kael', offers: false }); g.god = true; g.spawnAcc = -1e9; if (mode === 'run') { g.stage = stage; loadStageMap(g, stage); }
  for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null);
  const m = g.map, p = g.p, gate = m.gate, path = (m._road ? m._road.main : []).slice(); path.push([gate.x, gate.z]); let wi = 1, stuck = 0, last = [p.x, p.z], reached = false;
  for (let tick = 0; tick < 60 * 150 && !reached; tick++) {
    while (wi < path.length - 1 && Math.hypot(path[wi][0] - p.x, path[wi][1] - p.z) < 2.2) wi++;
    const dx = path[wi][0] - p.x, dz = path[wi][1] - p.z, d = Math.hypot(dx, dz) || 1, ahead = heightAt(p.x + dx / d * 1.6, p.z + dz / d * 1.6) - p.y;
    g.step(1 / 60, { f: 1, r: 0, yaw: Math.atan2(-dx, -dz), jump: ahead > 0.3 && ahead < 3, dash: ahead > 2.2, slide: false, use: false });
    if (tick % 120 === 119) { if (Math.hypot(p.x - last[0], p.z - last[1]) < 0.5) stuck++; last = [p.x, p.z]; }
    if (Math.hypot(gate.x - p.x, gate.z - p.z) < 6) reached = true;
  }
  const ac = m.arena.center, hc = heightAt(ac.x, ac.z); let bad = 0, tot = 0; for (let r = 0; r <= 24; r += 2) for (let a = 0; a < 16; a++) { const x = ac.x + r * Math.cos(a * 0.3927), z = ac.z + r * Math.sin(a * 0.3927), h = heightAt(x, z); tot++; if (h >= 50 || Math.abs(h - hc) > 1.0) bad++; }
  g.sc = Math.max(g.sc, (g.stageSpec && g.stageSpec.gateWake || 360) + 2); p.x = gate.x; p.z = gate.z + 1; p.y = heightAt(p.x, p.z); let fight = false;
  for (let tick = 0; tick < 60 * 6 && !fight; tick++) { g.step(1 / 60, Object.assign({}, idle, { use: true })); fight = g.gate && (g.gate.state === 'fight' || (g.boss && g.boss.state === 'active')); }
  let alive = 0; for (let tick = 0; tick < 60 * 90; tick++) { g.step(1 / 60, Object.assign({}, idle, { f: 1, yaw: (tick / 60) * 0.5 })); }
  const bossAlive = g.sp.filter(s => s.alive && /boss/.test(s.role || '')).length;
  console.log(`${mode} seed ${seed} stage ${stage + 1} ${m.key || m.v2}: ${reached ? 'gate reached' : 'NOT reached'}, stuck ${stuck}; gate state ${g.gate && g.gate.state}, boss ${g.boss && g.boss.state}, fight started ${fight}; arena floor within 1 m of the centre on ${tot - bad}/${tot} sample points (ring radius ${m.arena.r || 'n/a'}); p at ${p.x.toFixed(0)},${p.z.toFixed(0)} dist to gate ${Math.hypot(p.x - gate.x, p.z - gate.z).toFixed(1)} m; boss specials alive ${bossAlive}`);
}

