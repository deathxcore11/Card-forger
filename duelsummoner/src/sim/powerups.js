// What the ten pickups do (data/powerups.js has the numbers) and how a vase or an elite rolls one. The timers live on the game: g.windT, g.drumT, g.stopT, g.wardHits.
import { POWER, POWERUPS, PICK, COMMON_KINDS, RARE_KINDS } from '../data/powerups.js';
import { killEnemy } from './combat.js';
import { atan2 } from './dmath.js';

// the kind a vase drops, or 0 for none (the XP and the coins come anyway). Only the big desert rolls these, so older runs keep their exact random streams.
export function rollPickup(g, banded) {
  const open = k => !g.unlockedPickups || g.unlockedPickups.has(k), c = COMMON_KINDS.filter(open), r = RARE_KINDS.filter(open);
  let t = g.rl();
  if (banded) { const pool = t < POWER.bandedCommonShare ? (c.length ? c : r) : (r.length ? r : c); return pool.length ? pool[Math.floor(g.rl() * pool.length)] : 0; }
  const lk = 1 + (g.mods.vaseLuck || 0) + (g.stakes || 0) / 250, none = 1 - (1 - POWER.vaseNone) * lk; if (t < none) return 0; t -= none;
  const pool = t < POWER.vaseCommon * lk ? c : r; return pool.length ? pool[Math.floor(g.rl() * pool.length)] : 0;
}
// a rare pickup from an elite or an Ace
export function rollRare(g) { const r = RARE_KINDS.filter(k => !g.unlockedPickups || g.unlockedPickups.has(k)); return r.length ? r[Math.floor(g.rl() * r.length)] : 0; }
export function collectPowerup(g, kind, val) {
  const p = g.p, def = POWERUPS[kind]; if (!def) return;
  const say = t => g.event('banner', def.name + ': ' + t);
  switch (kind) {
    case PICK.GREAT: p.hp = Math.min(p.maxHp, p.hp + POWER.healGreat * (1 + g.mods.heartMul)); say('healed.'); break;
    case PICK.PURSE: { g.coinFrac += (val > 1 ? val : POWER.purseCoins) * (1 + g.mods.coinMult); const w = Math.floor(g.coinFrac); g.coins += w; g.coinsGained = (g.coinsGained | 0) + w; g.coinFrac -= w; say('+' + w + ' coins.'); break; }
    case PICK.LODE: { const m = g.pick; for (let i = 0; i < m.max; i++) if (m.alive[i] && m.kind[i] === PICK.XP) { m.far[i] = 1; if (m.age[i] < 1.6) m.age[i] = 1.6; } say('every crystal comes to you.'); break; }
    case PICK.STOP: g.stopT = POWER.stopSeconds; say('the enemies stand still.'); break;
    case PICK.WIND: g.windT = POWER.windSeconds; say('you are swift.'); break;
    case PICK.DRUM: g.drumT = POWER.drumSeconds; say('your blows land harder.'); break;
    case PICK.WARD: g.wardHits = Math.min(6, (g.wardHits | 0) + POWER.wardHits); say(g.wardHits + ' hits blocked.'); break;
    case PICK.BURST: { const e = g.en, R2 = POWER.burstRadius * POWER.burstRadius; let n = 0; for (let i = 0; i < e.max; i++) if (e.alive[i] && (e.x[i] - p.x) ** 2 + (e.z[i] - p.z) ** 2 <= R2) { killEnemy(g, i); n++; } say(n + ' defeated.'); break; }
    case PICK.RUMOUR: rumour(g); break;
  }
  g.pickupsTaken = (g.pickupsTaken | 0) + 1;
}
// before the door has risen it rises 30 s sooner; after, the shard gives the bearing and the distance
function rumour(g) {
  const d = g.door; if (!d) { g.event('banner', 'Rumour Shard: nothing here to find.'); return; }
  if (d.state === 'hidden') { d.shards = (d.shards | 0) + 1; g.event('banner', 'Rumour Shard: the sand whispers. The door will rise sooner.'); return; }
  const dx = g.map.gate.x - g.p.x, dz = g.map.gate.z - g.p.z, L = Math.sqrt(dx * dx + dz * dz), names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  let a = atan2(dz, dx); if (a < 0) a += 6.283185307; g.event('banner', 'Rumour Shard: the door lies ' + names[Math.round(a / 0.785398) % 8] + ', about ' + Math.round(L / 10) * 10 + ' m.');
}
// per tick: the timers run down
export function powerTick(g, dt) { if (g.windT > 0) g.windT = Math.max(0, g.windT - dt); if (g.drumT > 0) g.drumT = Math.max(0, g.drumT - dt); if (g.stopT > 0) g.stopT = Math.max(0, g.stopT - dt); }
