// The wave table: spawn rate, enemy mix, Ram Golem timer, elites, the Last Audience ring, and the boss clock.
import { RUN } from '../data/waves.js';
import { cos, pow, sin } from './dmath.js';
import { spawnEnemy, spawnRate, enemyCount, KIND_ID } from './enemies.js';
import { spawnWarden, spawnIdols, startBoss } from './specials.js';
import { heightAt } from './terrain.js';

export function mixFor(t) {
  let row = RUN.mix[0];
  for (const r of RUN.mix) if (t >= r.from) row = r;
  return row.chance;
}
function aliveOf(g, kind) { const id = KIND_ID[kind], e = g.en; let n = 0; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.kind[i] === id) n++; return n; }
export function pickKind(g, t) {
  const c = mixFor(t); let r = g.rsp();
  for (const k of ['scarab', 'seer', 'bloat', 'runner']) { const p = c[k]; if (!p) continue; if (r < p) return RUN.caps[k] && aliveOf(g, k) >= RUN.caps[k] ? 'husk' : k; r -= p; }
  return 'husk';
}

export function overtimeStep(t) { const O = RUN.overtime; return t < O.from ? -1 : Math.floor((t - O.from) / O.stepSeconds); }

export function updateSpawner(g, dt) {
  const t = g.t, f = g.flags, O = RUN.overtime, k = overtimeStep(t);
  g.otStep = k;
  g.dmgMul = (1 + RUN.enemyDamagePerMinute * Math.max(0, t - RUN.enemyDamageFrom) / 60) * (k >= 0 ? pow(O.dmgGrowth, k + 1) : 1);
  if (k >= 0) {                                                        // Overtime: hunters, stronger every step, no cap on the scaling
    if (!f.overtime) { f.overtime = true; g.event('banner', 'OVERTIME. Hunters grow stronger every 30 seconds.'); }
    g.otAcc = (g.otAcc || 0) + (O.baseRate + O.rateStep * k) * dt;
    while (g.otAcc >= 1) { g.otAcc -= 1; if (enemyCount(g.en) < RUN.maxAlive) spawnEnemy(g, 'hunter'); }
  }
  if (g.boss.state === 'dead') return;
  if (!f.warden && t >= RUN.elites.warden) { f.warden = true; spawnWarden(g); }
  if (!f.idols && t >= RUN.elites.idols) { f.idols = true; spawnIdols(g); }
  if (g.boss.state === 'idle' && t >= RUN.bossAt) startBoss(g, false);

  if (t >= RUN.ring.from) {                                           // the Last Audience: a ring of Husks closes in
    g.ringT -= dt;
    if (g.ringT <= 0) {
      g.ringT = RUN.ring.every;
      g.event('banner', 'The Last Audience closes in.');
      const n = RUN.ring.count, p = g.p;
      for (let k = 0; k < n; k++) {
        if (enemyCount(g.en) >= RUN.maxAlive) break;
        const a = k / n * Math.PI * 2;
        spawnEnemy(g, 'husk', { x: p.x + cos(a) * RUN.ring.radius, z: p.z + sin(a) * RUN.ring.radius });
      }
    }
  }
  if (t >= RUN.golem.from) {
    g.golemT -= dt;
    if (g.golemT <= 0) { g.golemT = RUN.golem.every; if (enemyCount(g.en) < RUN.maxAlive && aliveOf(g, 'golem') < RUN.caps.golem) spawnEnemy(g, 'golem'); }
  }
  g.spawnAcc += (g.boss.state === 'active' ? RUN.bossRate : spawnRate(t)) * dt;
  if (g.spawnAcc >= 1) {
    let live = enemyCount(g.en);
    while (g.spawnAcc >= 1) {
      g.spawnAcc -= 1;
      if (live < RUN.maxAlive && spawnEnemy(g, pickKind(g, t))) live++;
    }
  }
}
export { heightAt };

