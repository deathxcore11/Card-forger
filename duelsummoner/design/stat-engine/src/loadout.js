// Level-up planner (with Tuning rolls and rarity factors), loadout -> Ledger, loadout -> weapons,
// and the per-minute combat runner used by sim/builds.mjs and the tests. Cold code except runMinute's loop.

import { K } from './tuning.js';
import { Ledger, STAT, SRC, PF, EV, FX, HF, C, CAP, CAP_N, LUT, clampPts, elemMask, hitFlags, lvlMul, rateMul, formOf,
  copyEff, edgePerHit, otStepAt, enemyHpMul, enemyHitAt, requiredDpm, enemyHpAt, spawnsPerMin } from './stats.js';
import { MONSTERS, SPELLS, ITEMS, BLESSINGS, DUELISTS } from './content.js';

// ---------------------------------------------------------------- level budget
export function levelsAvailable(t) {
  return Math.floor(K.levelsPreOt * Math.min(t, K.otStartMin) / K.otStartMin + 1e-9) +
    Math.floor(Math.max(0, t - K.otStartMin) * (K.otDrawPerMin + K.otXpLevelsPerMin) + 1e-9);
}
const perOtMin = () => K.otDrawPerMin + K.otXpLevelsPerMin;
const minuteOfLevel = idx => (idx < K.levelsPreOt ? (idx + 1) / K.levelsPreOt * K.otStartMin : K.otStartMin + (idx + 1 - K.levelsPreOt) / perOtMin());
// chests and shrines (about 1 in 5 before Overtime) and Overtime Draw picks have a Bright floor
const floorOf = idx => (idx < K.levelsPreOt ? (idx % 5 === 4 ? 1 : 0) : ((idx - K.levelsPreOt) % perOtMin() === 0 ? 1 : 0));

function mkRng(seed) { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 8) / 16777216; }; }

// Fortune tilt: w_i <- w_i * (1 + tiltK * phi * i), renormalised; floor removes rarities below it
export function rarityWeights(fortPts, floor = 0) {
  const phi = LUT.fort[clampPts(fortPts)];
  const w = K.rarityWeight.map((v, i) => (i < floor ? 0 : v * (1 + K.tiltK * phi * i)));
  const tot = w.reduce((a, b) => a + b, 0);
  return w.map(v => v / tot);
}
export function rollRarity(u, fortPts, floor = 0) {
  const w = rarityWeights(fortPts, floor); let acc = 0;
  for (let i = 0; i < w.length; i++) { acc += w[i]; if (u < acc) return i; }
  return w.length - 1;
}
function pickPool(u) {
  const tot = K.tunePoolWeight.reduce((a, b) => a + b, 0); let acc = 0;
  for (let i = 0; i < K.tunePool.length; i++) { acc += K.tunePoolWeight[i] / tot; if (u < acc) return K.tunePool[i]; }
  return K.tunePool[K.tunePool.length - 1];
}

const itemsAt = (build, t) => {
  const out = {};
  for (const [id, at] of build.items || []) if (at <= t) out[id] = (out[id] || 0) + 1;
  return out;
};
export function interp(frames, t) {
  if (!frames) return 0;
  const ks = Object.keys(frames).map(Number).sort((a, b) => a - b);
  if (t <= ks[0]) return frames[ks[0]] * t / ks[0];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i]) { const a = ks[i - 1], b = ks[i]; return frames[a] + (frames[b] - frames[a]) * (t - a) / (b - a); }
  return frames[ks[ks.length - 1]];
}

// ---------------------------------------------------------------- planner
// goals: 'mon:id:L' | 'st:id:L' | 'bless:id' | 'fuse:id'. Spends level-ups in order until the budget for minute t runs out.
export function plan(build, t) {
  if (build.synthetic) return build.synthetic(t);
  const avail = levelsAvailable(t), rng = mkRng(build.seed || 1);
  const mons = new Map(), st = new Map(), bless = {};
  const fortAt = m => (itemsAt(build, m)['lucky-coin'] || 0) * ITEMS['lucky-coin'].mods[0][1];
  let spent = 0, done = true, rolls = [0, 0, 0, 0, 0];
  const spend = () => (spent < avail ? (spent++, true) : false);
  const roll = () => { const idx = spent - 1, r = rollRarity(rng(), fortAt(minuteOfLevel(idx)), floorOf(idx)); rolls[r]++; return r; };
  const newMon = (id, lvl, tune) => ({ id, lvl, tier: MONSTERS[id].tier, tune: tune || { dmg: 0, rate: 0, area: 0, coef: 0, proj: 0 } });
  const start = DUELISTS[build.duelist].start;
  mons.set(start, newMon(start, 1));
  outer: for (const g of build.goals) {
    const [type, id, toS] = g.split(':'), to = Number(toS);
    switch (type) {
      case 'mon': {
        if (!MONSTERS[id]) throw new Error(`unknown monster ${id}`);
        if (to > K.monsterMax) throw new Error(`monster level ${to} > ${K.monsterMax}`);
        if (!mons.has(id)) {
          if (mons.size >= K.zonesMon) throw new Error(`${build.id}: no free Monster Zone for ${id}`);
          if (!spend()) { done = false; break outer; }
          mons.set(id, newMon(id, 1));
        }
        const m = mons.get(id);
        while (m.lvl < to) {
          if (!spend()) { done = false; break outer; }
          m.lvl++;
          const r = roll(), f = K.rarityFactor[r], stat = pickPool(rng());
          if (stat === 'proj') m.tune.proj += r >= 3 ? 2 : 1; else m.tune[stat] += K.tuneInc[stat] * f;
        }
        break;
      }
      case 'st': {
        if (!SPELLS[id]) throw new Error(`unknown spell/trap ${id}`);
        if (to > K.stMax) throw new Error(`Spell/Trap level ${to} > ${K.stMax}`);
        if (!st.has(id)) {
          if (st.size >= K.zonesST) throw new Error(`${build.id}: no free Spell/Trap Zone for ${id}`);
          if (!spend()) { done = false; break outer; }
          st.set(id, { id, lvl: 1, factor: 1 });
        }
        const s = st.get(id);
        while (s.lvl < to) { if (!spend()) { done = false; break outer; } s.lvl++; s.factor += K.rarityFactor[roll()]; }
        break;
      }
      case 'bless': if (!spend()) { done = false; break outer; } bless[id] = (bless[id] || 0) + 1; break;
      case 'fuse': {
        if (SPELLS[id]) throw new Error(`${build.id}: ${id} is a Spell/Trap, and Spells/Traps never fuse`);
        if (!MONSTERS[id] || !MONSTERS[id].from) throw new Error(`${build.id}: ${id} is not a Fusion`);
        const D = MONSTERS[id], [a, b] = D.from, ma = mons.get(a), mb = mons.get(b);
        if (!ma || !mb || ma.lvl < K.monsterMax || mb.lvl < K.monsterMax) throw new Error(`${build.id}: ${id} needs ${a} and ${b} at level 10`);
        if (!spend()) { done = false; break outer; }
        const tune = {}; for (const k of K.tunePool) tune[k] = Math.floor(K.fusionInherit * (ma.tune[k] + mb.tune[k]));
        mons.delete(a); mons.delete(b);
        mons.set(id, newMon(id, K.tierArrive[D.tier], tune));
        break;
      }
      default: throw new Error(`bad goal ${g}`);
    }
  }
  const items = itemsAt(build, t);
  const leftover = avail - spent;
  const hidden = done && items['unmarked-card'] ? Math.min(leftover, 255) : 0;   // wasted picks bank into the Unmarked Card
  return { id: build.id, duelist: build.duelist, mons: [...mons.values()], st: [...st.values()], bless, items, spent, avail, leftover, hidden, rolls };
}

// ---------------------------------------------------------------- loadout -> ledger
export function applyLoadout(L, lo) {
  const p = L.pts; p.fill(0);
  const add = (mods, n = 1) => { for (const [s, v] of mods) p[s] += Math.round(v * n); };
  for (const [id, n] of Object.entries(lo.items)) add(ITEMS[id].mods, n);
  for (const [id, n] of Object.entries(lo.bless)) add(BLESSINGS[id].mods, n);
  let stLevels = 0;
  for (const s of lo.st) { add(SPELLS[s.id].per, s.factor); stLevels += s.lvl; }
  for (const m of lo.mons) p[STAT.MIGHT] += K.tierAura[m.tier];
  L.stLevels = stLevels;
  L.hidden = lo.hidden;
  const gust = lo.st.find(s => s.id === 'gust-ward'); L.gustLv = gust ? gust.lvl : 0;
  const toll = lo.st.find(s => s.id === 'toll-of-ash'); L.tollLv = toll ? toll.lvl : 0;
  // on-event item copies stack through copyEff (x4 asymptote): linear copies left the item BASE unbounded
  L.locketN = copyEff(lo.items['thornbound-locket'] || 0); L.recoilN = copyEff(lo.items['recoil-seal'] || 0);
  L.bellN = copyEff(lo.items['graveyard-bell'] || 0); L.tallyN = lo.items['notched-tally'] || 0;
  for (let e = 0; e < 5; e++) L.evN[e] = 0;
  for (const id of Object.keys(lo.items)) for (const [ev, fx] of ITEMS[id].fx || []) L.addEffect(ev, fx);
  if (L.gustLv) L.addEffect(EV.HURT, FX.GUST_WARD);
  const mag = lo.mons.find(m => MONSTERS[m.id].explode);
  if (mag) {
    const D = MONSTERS[mag.id];
    L.explodeBase = D.explode.base * lvlMul(mag.lvl) * K.form[formOf(mag.lvl)] * K.tier[D.tier] * (1 + mag.tune.dmg / 1e4);
    L.explodeTargets = D.explode.targets; L.explodeElem = elemMask(D.elems);
    L.addEffect(EV.KILL, FX.MARK_EXPLODE);
  }
  for (const m of lo.mons) if (MONSTERS[m.id].trait === 'chainMax10') L.chainMax = 10;
  for (const [s, v] of lo.pts || []) p[s] = v;              // synthetic ceiling builds only
  L.recompute();
  L.hp = L.maxLp; L.wards = L.wardMax;
  return L;
}

const PROJ_KINDS = new Set(['strike', 'pierce', 'multi', 'mark']);
const AREA_KINDS = new Set(['pulse', 'cone']);
export function deriveWeapons(L, lo) {
  const W = [];
  lo.mons.forEach((m, idx) => {
    const D = MONSTERS[m.id], f = formOf(m.lvl);
    const base = D.atk * lvlMul(m.lvl) * K.form[D.tier >= 2 ? 2 : f] * K.tier[D.tier] * (1 + m.tune.dmg / 1e4) * (D.baseMul || 1) + edgePerHit(L.edge, D.cd);
    const rate = rateMul(m.lvl) * L.tempoMul * (1 + m.tune.rate / 1e4) / D.cd;
    let targets = D.hits;
    if (PROJ_KINDS.has(D.kind)) targets += m.tune.proj + L.volley;
    if (AREA_KINDS.has(D.kind)) targets *= L.reachMul * (1 + m.tune.area / 1e4);
    targets = Math.min(targets, K.simMaxTargets);
    const coef = Math.min(K.coefMax, K.proc[D.kind] + m.tune.coef);
    const coefFirst = D.kind === 'pierce' ? Math.min(K.coefMax, K.proc.strike + m.tune.coef) : coef;
    W.push({ name: D.name, src: SRC.MON, base, rate, targets, coef, coefFirst, flags: hitFlags(SRC.MON, elemMask(D.elems)),
      selfCost: D.selfCost || 0, marks: !!D.marks, offset: idx * 2, acc: 0, carry: 0, dmg: 0 });
  });
  const cardElem = Object.keys(lo.items).map(id => ITEMS[id].cardElem).filter(Boolean);
  W.push({ name: 'Card throw', src: SRC.CARD, base: K.cardBase + edgePerHit(L.edge, K.cardCd), rate: L.drawMul / K.cardCd, targets: 1, coef: K.proc.card, coefFirst: K.proc.card,
    flags: hitFlags(SRC.CARD, elemMask(cardElem)), selfCost: 0, marks: false, offset: 0, acc: 0, carry: 0, dmg: 0 });
  for (const s of lo.st) {
    const D = SPELLS[s.id];
    if (D.trap === 'pit') W.push({ name: D.name, src: SRC.TRAP, base: D.atk * (1 + K.trapDmgPerLevel * (s.lvl - 1)), rate: 1 / (D.cdSec * L.rewind),
      targets: D.hits, coef: K.proc.pit, coefFirst: K.proc.pit, flags: hitFlags(SRC.TRAP, elemMask(D.elems), HF.AREA), selfCost: 0, marks: false, offset: 1, acc: 0, carry: 0, dmg: 0 });
  }
  return W;
}

// ---------------------------------------------------------------- per-minute runner
export const killsAt = t => K.simKillsPerMinPre * Math.min(t, K.otStartMin) + K.simKillsPerMinOt * Math.max(0, t - K.otStartMin);

export function runMinute(build, t, opts = {}) {
  const warmSec = opts.warmSec ?? 30, measureSec = opts.measureSec ?? 60;
  const lo = plan(build, t);
  const L = new Ledger({ duelist: DUELISTS[build.duelist].id, seed: ((build.seed || 1) * 7919 + Math.round(t * 60)) >>> 0, respawnOnDeath: true,
    enemyHp: enemyHpAt(t), capAudit: opts.audit === false ? 0 : 8192, specLiteral: !!opts.specLiteral });
  L.otStep = otStepAt(t);
  L.coins = interp(build.coins, t);
  L.setMiraKills(killsAt(t));
  applyLoadout(L, lo);
  const W = deriveWeapons(L, lo);
  const hz = K.hz, warm = warmSec * hz, total = warm + measureSec * hz;
  const hitAt = enemyHitAt(t), contactThresh = Math.floor(K.simContactPerSec / hz * 16777216);
  const c0 = new Float64Array(L.c.length), rx0 = new Float64Array(L.rxCount.length), by0 = new Float64Array(L.dmgBy.length);
  let hpSum = 0, hpMin = Infinity, b7Sum = 0, badHp = 0;
  for (let tick = 0; tick < total; tick++) {
    if (tick === warm) { c0.set(L.c); rx0.set(L.rxCount); by0.set(L.dmgBy); }
    const front = (L.tick >> 3) % L.N;
    for (let w = 0; w < W.length; w++) {
      const wp = W[w];
      wp.acc += wp.rate / hz;
      const dm0 = L.c[C.DMG];
      while (wp.acc >= 1) {
        wp.acc -= 1;
        wp.carry += wp.targets; const n = Math.floor(wp.carry); wp.carry -= n;
        for (let k = 0; k < n; k++) {
          const i = (front + wp.offset + k) % L.N;
          if (wp.marks) L.markT[i] = K.markTicks;
          L.resolveHit(i, wp.base, wp.flags, k === 0 ? wp.coefFirst : wp.coef, 0);
        }
        if (wp.selfCost) L.hurtPlayer(wp.selfCost, PF.SELF, SRC.SELF);
      }
      if (tick >= warm) wp.dmg += L.c[C.DMG] - dm0;
    }
    if (L.rngWorld() < contactThresh && L.grace <= 0) L.hurtPlayer(hitAt, 0, SRC.ENEMY);
    L.tickWorld();
    if (!(L.hp >= 0 && L.hp <= L.maxLp) || !Number.isFinite(L.hp)) badHp++;
    if (tick >= warm) { hpSum += L.hp; if (L.hp < hpMin) hpMin = L.hp; b7Sum += L.b7; }
  }
  const sec = measureSec, n = sec * hz, d = k => L.c[C[k]] - c0[C[k]];
  const dpm = d('DMG') / (sec / 60), effDpm = d('EFF') / (sec / 60);
  const avgHp = hpSum / n, post = Math.max(1, Math.round(hitAt * (1 - L.guardMit)));
  const maxP = Math.min(K.procCap, Math.max(...K.statusP0) * K.coefMax * 0.005 * L.fervMul);
  const caps = {};
  for (let cp = 0; cp < CAP_N; cp++) caps[Object.keys(CAP)[cp]] = { peak: L.caps.auditN ? L.caps.maxSliding(cp) : -1, limit: L.caps.limit[cp], denied: L.caps.denied[cp] };
  const reacts = {}; L.rxCount.forEach((v, i) => { if (v - rx0[i] > 0) reacts[i] = v - rx0[i]; });
  return {
    build: build.id, t, lo, dpm, effDpm, required: requiredDpm(t), hpMul: enemyHpMul(t), enemyHp: enemyHpAt(t), spawns: spawnsPerMin(t), enemyHit: hitAt,
    procsPerSec: (d('PROCS') + d('ITEM_PROCS') + d('TRAP_FIRES')) / sec,
    critRate: d('CRITS') / Math.max(1, d('HITS')), reactsPerMin: d('REACTS') / (sec / 60), killsPerMin: d('KILLS') / (sec / 60),
    hitsPerSec: d('HITS') / sec, avgHp, hpMin, maxLp: L.maxLp, avgB7: b7Sum / n,
    ehp: L.maxLp / ((1 - L.guardMit) * (1 - L.evade)),
    hitsToDie: Math.ceil(Math.max(1, avgHp) / post) / (1 - L.evade) + L.wardMax,
    deathsPerMin: d('DEATHS') / (sec / 60), selfDeaths: L.c[C.SELF_DEATHS], floorSaves: d('FLOOR_SAVES'), selfHurts: d('SELF_HURTS'),
    evade: L.evade, guardMit: L.guardMit, critChance: L.critChance, maxProcChance: maxP, caps, reacts, badHp,
    weapons: W.map(w => ({ name: w.name, dpm: w.dmg / (sec / 60), base: w.base, rate: w.rate, targets: w.targets, coef: w.coef })),
    dmgBy: Array.from(L.dmgBy, (v, i) => (v - by0[i]) / (sec / 60)),
    counters: Object.fromEntries(Object.keys(C).map(k => [k, d(k)])),
    brackets: { b1: L.b1, b7: L.b7, b8: L.b8, b9: L.b9, critMul: L.critMul, tempo: L.tempoMul, reso: L.resoMul, ferv: L.fervMul }
  };
}
