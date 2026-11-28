// The rules of the new-design chest items (src/data/items3.js). Each item is single-only, so a rule is on or off: g.v2 holds the ids owned (null when none), g.v2s the run's counters.
// The sim calls in at a few points: v2Rate (a summon's attack rate), v2Attacked (a summon attacked), v2Hit / v2Crit / v2After (a hit on an enemy), v2Kill, v2Event (hurt, dash, chest, vase,
// heart, coin, bought, tier, trick) and v2Tick. Numbers are the design's first guesses (design/items-v2.js) and are not balanced.
import { ITEMS } from '../data/items.js';
import { ELEMENTS, elemBits } from '../data/elements.js';
import { MARKS } from '../data/cards.js';
import { damageEnemy, addFx, chainFrom } from './combat.js';
import { splash } from './weapons.js';
import { def, damageOf, gainLevel } from './field.js';

const state = g => g.v2s || (g.v2s = { flintN: 0, flint: 0, sock: 0, crit: 0, coins: 0, crumbT: 0, stillT: 0, bought: 0, aces: 0, slamCd: 0, pauseT: 0, pausing: false, railD: 0, egg: 0, skip: 0, eggSeen: false, whistle: null, whT: 0, raw: 0, busy: false, wax: null });
// the ids owned, rebuilt whenever the items change (recompute calls this first)
export function v2Build(g) {
  let o = null; for (const id of (g.items || [])) if (ITEMS[id] && ITEMS[id].v2) (o || (o = {}))[id] = 1;
  g.v2 = o; if (!o) return; const s = state(g);
  if (o['hollow-egg'] && !s.eggSeen) { s.eggSeen = true; s.egg = 1; s.skip = 1; }
}
const mons = g => g.field.monsters;
const nearMon = (g, x, z, not) => { let best = null, bd = 1e18; for (const m of mons(g)) { if (!m || m === not) continue; const dx = m.x - x, dz = m.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = m; } } return best; };
const allNow = g => { for (const m of mons(g)) if (m) m.cd = 0; };
const markOne = (g, i) => { g.en.mark[i] = MARKS.duration + (g.mods.markDur || 0); };
function nearEnemy(g, x, z, r, not, pred) { const e = g.en; let best = -1, bd = r * r; for (let j = 0; j < e.max; j++) { if (!e.alive[j] || j === not || (pred && !pred(j))) continue; const dx = e.x[j] - x, dz = e.z[j] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; } } return best; }
const shares = (a, b) => { const A = def(a).elements || [], B = def(b).elements || []; return A.some(x => B.includes(x)); };

// how much faster (or slower) this summon attacks: an added rate, as the tempo stat is
export function v2Rate(g, m) {
  const V = g.v2; if (!V) return 0; const s = g.v2s, p = g.p; let r = 0;
  const dx = m.x - p.x, dz = m.z - p.z, d2 = dx * dx + dz * dz;
  if (V['grind-wax'] && p.ride && p.ride.grind) r += 0.2;
  if (V['rally-flag'] && s.stillT >= 2 && d2 < 25) r += 0.1;
  if (V['heart-crumb'] && s.crumbT > 0) r += 0.15;
  if (V['opening-bell'] && g.sc !== undefined && g.sc < 20) r += 0.25;
  if (V['glass-leash']) { if (d2 < 36) r += 0.25; else if (d2 > 196) r -= 0.1; }
  if (V['riders-covenant']) { const st = g.rflow ? Math.min(5, g.rflow.step) : 1; r += -0.15 + (st - 1) / 4 * 0.75; }
  return Math.max(-0.5, r);
}
// a summon has just attacked
export function v2Attacked(g, m) {
  const V = g.v2; if (!V) return; const s = g.v2s, p = g.p;
  if (V['flint-chip'] && ++s.flintN >= 8) { s.flintN = 0; s.flint = 1; }
  if (V['blood-ink'] && p.hp > p.maxHp * 0.2) p.hp = Math.max(1, p.hp - 1);
  if (V['chorus-horn'] && !s.busy) {
    const i = g.nearest(m.x, m.z, 30); if (i < 0) return; const e = g.en, prev = g.curSrc; s.busy = true;
    const a = nearMon(g, m.x, m.z, m), others = []; if (a) { others.push(a); let b = null, bd = 1e18; for (const q of mons(g)) { if (!q || q === m || q === a) continue; const dx = q.x - m.x, dz = q.z - m.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; b = q; } } if (b) others.push(b); }
    for (const q of others) { if (!e.alive[i]) break; g.curSrc = g.srcIndex(q.id); addFx(g, { type: 'bolt', owner: 0, el: null, x: q.x, y: q.y, z: q.z, x2: e.x[i], y2: e.y[i] + 0.9, z2: e.z[i], dur: 0.2, seed: i + 1, w: 0.08 }); damageEnemy(g, i, damageOf(q) * 0.4, { noChain: true, elem: elemBits(def(q.id).elements) }); }
    g.curSrc = prev; s.busy = false;
  }
}
// a hit on enemy i: the damage multiplier from the items (cls 0 = a summon's hit)
export function v2Hit(g, i, el, cls, raw) {
  const V = g.v2; if (!V) return 1; const s = g.v2s, e = g.en, p = g.p; let k = 1; s.raw = raw;
  if (V['glass-deck']) k *= 2;
  if (V['heart-of-the-horde']) { const n = Math.floor(g.kills / 100); k *= (1 + 0.01 * n) / (1 + 0.005 * n); }
  if (V['deep-purse']) k *= 1 + 0.01 * Math.floor(g.coins / 25);
  if (V['tithe-bowl']) k *= 1 + 0.02 * s.bought;
  if (V['trick-trophy'] && p.ride && p.ride.combo) k *= 1 + 0.01 * (p.ride.combo.n || 0);
  if (V['kindling-pouch'] && e.burn[i] > 0 && !(el & ELEMENTS.fire.bit)) k *= 1.15;
  if (cls === 0) {
    if (V['tamers-whistle'] && s.whistle && s.whistle.has(g.srcNames[g.curSrc])) k *= 1.12;
    if (V['blood-ink'] && p.hp > p.maxHp * 0.2) k *= 1.3;
  }
  return k;
}
// does this hit crit for certain?
export function v2Crit(g, i, cls) {
  const V = g.v2; if (!V || cls !== 0) return false; const s = g.v2s, e = g.en;
  if (V['marksmans-wax']) { const w = s.wax || (s.wax = new Uint8Array(e.max)); if (e.mark[i] > 0) { if (!w[i]) { w[i] = 1; return true; } } else w[i] = 0; }
  if (V['lucky-tooth'] && s.crit > 0) { s.crit--; return true; }
  return false;
}
// after the hit has landed
export function v2After(g, i, d, el, cls, x, z, dead, fresh) {
  const V = g.v2; if (!V) return; const s = g.v2s, e = g.en;
  if (V['frost-pebble'] && fresh && !dead) e.slow[i] = 1;
  if (cls !== 0) return;
  if (s.flint && V['flint-chip'] && !dead) { s.flint = 0; e.burn[i] = Math.max(e.burn[i], 2); e.burnDps[i] = Math.max(e.burnDps[i], ELEMENTS.fire.burn.dps + (g.mods.burnDps || 0)); addFx(g, { type: 'ring', owner: 0, el: 'fire', x, y: e.y[i] + 0.5, z, r: 0.9, dur: 0.2, color: 0xff8a30 }); }
  if (s.sock && V['static-sock']) { s.sock = 0; chainFrom(g, i, x, z, d * ELEMENTS.lightning.chain.falloff, 1); }
}
// Kindling Crown: burn piles up on an Ace and lasts half as long on the rest (called where a fire hit sets the burn)
export function v2Burn(g, i, dur, dps) {
  const e = g.en; if (!g.v2 || !g.v2['kindling-crown']) { e.burn[i] = dur; e.burnDps[i] = dps; return; }
  if (e.ace[i]) { e.burnDps[i] = (e.burn[i] > 0 ? e.burnDps[i] : 0) + dps; e.burn[i] = dur; } else { e.burn[i] = dur * 0.5; e.burnDps[i] = dps; }
}
// enemy i has just died (its mark and place are still readable)
export function v2Kill(g, i, cls) {
  const V = g.v2; if (!V) return; const s = g.v2s, e = g.en, x = e.x[i], z = e.z[i], marked = e.mark[i] > 0;
  if (marked) {
    if (V['bounty-tag']) { g.coins += 2; g.coinsGained = (g.coinsGained || 0) + 2; }
    if (V['marking-chalk']) { const j = nearEnemy(g, x, z, 6, i, q => e.mark[q] <= 0); if (j >= 0) markOne(g, j); }
    if (V['echo-bell'] && !s.busy && s.raw > 0) { const j = nearEnemy(g, x, z, 14, i, q => e.mark[q] > 0); if (j >= 0) { s.busy = true; const raw = s.raw; addFx(g, { type: 'bolt', owner: 0, el: null, x, y: e.y[i] + 0.9, z, x2: e.x[j], y2: e.y[j] + 0.9, z2: e.z[j], dur: 0.25, seed: j + 1, w: 0.1 }); damageEnemy(g, j, raw, { noCrit: true, noChain: true }); s.busy = false; } }
  }
  if (e.ace[i]) {
    if (V['trainers-treat'] && cls === 0) { const id = g.srcNames[g.curSrc], m = mons(g).find(q => q && q.id === id); if (m) gainLevel(g, m, 0.5); }
    if (V['elite-bounty'] && ++s.aces % 3 === 0) { g.world.cchests.push({ x, y: e.y[i], z, open: false, rarity: null, free: true, trophy: true }); g.trophies = (g.trophies || 0) + 1; g.event('banner', 'Elite Bounty: a Trophy Chest drops.'); g.emit('trophy', x, e.y[i], z); }
  }
}
// things that happen to the duelist; 'heart' answers true when the heart became a Ward
export function v2Event(g, on, a) {
  const V = g.v2; if (!V) return false; const s = g.v2s, p = g.p, e = g.en;
  switch (on) {
    case 'hurt':
      if (V['thorn-bracer']) { const m = nearMon(g, p.x, p.z); if (m) m.cd = 0; }
      if (V['shell-fragment']) { for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z, d2 = dx * dx + dz * dz; if (d2 < 9 && d2 > 1e-6) { const d = Math.sqrt(d2); e.x[i] += dx / d * 2; e.z[i] += dz / d * 2; } } addFx(g, { type: 'ring', owner: 2, x: p.x, y: p.y + 0.3, z: p.z, r: 3, dur: 0.3, color: 0xe0b765 }); }
      break;
    case 'dash': if (V['static-sock']) s.sock = 1; break;
    case 'chest': if (V['chest-bell']) allNow(g); break;
    case 'vase': if (V['vase-dust'] && a) { const i = nearEnemy(g, a.x, a.z, 30, -1); if (i >= 0) markOne(g, i); } break;
    case 'heart': if (V['heart-crumb']) s.crumbT = 4; if (V['heart-locket'] && p.hp >= p.maxHp - 0.01) { g.wardHits = Math.min(6, (g.wardHits | 0) + 1); return true; } break;
    case 'coin': if (V['lucky-tooth']) { s.coins += a; while (s.coins >= 50) { s.coins -= 50; s.crit++; } } break;
    case 'bought': if (V['tithe-bowl']) s.bought++; break;
    case 'tier': {       // a = { m, from, to }: a summon's level changed
      const tier = L => (L >= 10 ? 3 : L >= 5 ? 2 : 1); if (tier(a.to) <= tier(a.from)) break;
      if (V['tier-ribbon']) p.hp = Math.min(p.maxHp, p.hp + 10);
      if (V['growth-ring'] && !s.growing) { s.growing = true; for (const q of mons(g)) if (q && q !== a.m && shares(q.id, a.m.id)) gainLevel(g, q, 0.5); s.growing = false; }
      break;
    }
    case 'trick':
      if (a === 'land' && V['landing-pad']) { const m = nearMon(g, p.x, p.z); if (m) m.cd = 0; }
      if (a === 'air' && V['slam-bell'] && s.slamCd <= 0) { allNow(g); s.slamCd = 12; s.pauseT = 0.3; s.pausing = true; g.event('banner', 'Slam Bell: every creature fires.'); }
      break;
  }
  return false;
}
export const v2Egg = g => { const s = g.v2s; if (g.v2 && g.v2['hollow-egg'] && s.egg) { s.egg = 0; return 5; } return 1; };       // Hollow Egg: the next summon arrives at level 5
export const v2SkipLevel = g => { const s = g.v2s; if (g.v2 && g.v2['hollow-egg'] && s.skip) { s.skip = 0; return true; } return false; };       // ... and the next level-up is skipped
export const v2Clock = g => (g.v2 && g.v2['sealed-hourglass'] ? 0.8 : 1);
export const v2Price = g => (g.v2 && g.v2['tithe-bowl'] ? 0.8 : 1);
export const v2MaxHp = (g, hp) => (g.v2 && g.v2['glass-deck'] ? Math.max(1, Math.ceil(hp * 0.5)) : hp);
export const v2Hops = g => (g.v2 && g.v2['conductor-rod'] ? 3 : 0);

export function v2Tick(g, dt) {
  const V = g.v2; if (!V) return; const s = g.v2s, p = g.p;
  if (s.crumbT > 0) s.crumbT -= dt; if (s.slamCd > 0) s.slamCd -= dt;
  if (s.pausing) { s.pauseT -= dt; if (s.pauseT <= 0) { s.pausing = false; for (const m of mons(g)) if (m) m.cd += 1; } }       // Slam Bell: the creatures pause for a second after the volley
  const sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  if (V['rally-flag']) { const was = s.stillT; s.stillT = sp < 0.3 ? s.stillT + dt : 0; if (was < 2 && s.stillT >= 2) addFx(g, { type: 'ring', owner: 2, x: p.x, y: p.y + 0.2, z: p.z, r: 5, dur: 0.5, color: 0xe0b765 }); }
  if (V['tamers-whistle']) { s.whT -= dt; if (s.whT <= 0) { s.whT = 0.5; const M = mons(g), set = new Set(); for (let i = 0; i < M.length; i++) { if (!M[i]) continue; if ((M[i - 1] && shares(M[i].id, M[i - 1].id)) || (M[i + 1] && shares(M[i].id, M[i + 1].id))) set.add(M[i].id); } s.whistle = set; } }
  if (V['rail-echo']) {
    if (p.ride && p.ride.grind) { s.railD += Math.max(sp, p.ride.grind.speed || 0) * dt; if (s.railD >= 2) { s.railD -= 2; const prev = g.curSrc; for (const m of mons(g)) if (m) { g.curSrc = g.srcIndex(m.id); splash(g, p.x, p.y, p.z, 2.5, damageOf(m), elemBits(def(m.id).elements)); } g.curSrc = prev; } }
    else s.railD = 0;
  }
}
