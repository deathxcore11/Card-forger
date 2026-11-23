// G14 encounter placement: slots, risk score R, quotas (rarest first), economy rules and swaps.
import { F, los } from './map.js';
import { INF, dijkstra } from './nav.js';
import { BASE, ANY } from './links.js';
import { discOffsets } from './imath.js';
import { exposureAt } from './events.js';
import { PLACE_ORDER } from './spec.js';

export const CLASS_OF = { witness_stone: 'FREE_ITEM', echo_forge: 'FREE_ITEM', deck_anvil: 'FREE_LEVEL', magnet_tablet: 'FREE_LEVEL',
  shrine_tribute: 'DANGER', duel_statue: 'DANGER', bone_oath: 'DANGER', card_chest: 'PAID', relic_broker: 'PAID',
  altar_tribute: 'UTILITY', scales_court: 'UTILITY', broken_covenant: 'UTILITY', second_seal: 'UTILITY',
  golden_statue: 'COLLECT', sealed_fragment: 'COLLECT', wrapped_mimic: 'MIMIC', vase: 'VASE', gate: 'GATE' };
const FREE = { FREE_ITEM: 1, FREE_LEVEL: 1 };
// Landmark tells for V12: top height above the slot (cm) and the range they read from (m). Column tells are
// light columns. Golden statues and the stage-1 Echo Forge are secrets by design and are exempt.
export const TELL = {
  witness_stone: { top: 2500, range: 120 }, shrine_tribute: { top: 2500, range: 120 }, sealed_fragment: { top: 2500, range: 120 },
  relic_broker: { top: 800, range: 60 }, duel_statue: { top: 900, range: 60 },
};
export const TELL_DEFAULT = { top: 600, range: 60 };
export const MAJOR = { shrine_tribute: 1, relic_broker: 1, duel_statue: 1 };
export const tellOf = (type) => TELL[type] || TELL_DEFAULT;
export const visExempt = (type, stage) => type === 'golden_statue' || type === 'gate' || type === 'vase' || type === 'lure_obelisk' || (type === 'echo_forge' && stage === 1);
// approach points: ramp heads and feet, hop-stair tops and region centres, where a branch is entered
export function approachPoints(m) {
  const N = m.N; const out = [];
  const add = (x, z) => { if (x < 0 || z < 0 || x >= N || z >= N) return; const i = z * N + x; if (m.flags[i] & 1) out.push(i); };
  for (const r of m.ramps) for (const sg of [-1, 1]) add(Math.floor((r.P[0] + sg * r.dir[0] * 1100) / 100), Math.floor((r.P[1] + sg * r.dir[1] * 1100) / 100));
  for (const h of m.hopstairs) add(Math.floor((h.P[0] + h.dir[0] * 300) / 100), Math.floor((h.P[1] + h.dir[1] * 300) / 100));
  const C = m.C; for (const r of m.macro.regions) add((r.centre % C) * 8 + 4, ((r.centre / C) | 0) * 8 + 4);
  return out;
}
export function spineSamples(m) { const out = []; const p = m.spine?.path || []; for (let k = 0; k < p.length; k += 10) out.push(p[k]); return out; }
// number of spine samples (eye 1.7 m) within range that see the top of a landmark at (x,z,y)+top
export function visCount(m, samples, x, z, y, top, range) {
  const N = m.N; let n = 0; const r2 = range * range;
  for (const c of samples) { const sx = c % N, sz = (c / N) | 0; if ((sx - x) ** 2 + (sz - z) ** 2 > r2) continue; if (los(m, sx, sz, m.h0[c] + 170, x, z, y + top)) n++; }
  return n;
}
const HIGH_TAGS = { reward_port: 1, high_perch: 1, pocket_end: 1 };

export function buildSlots(ctx, m, A, isl, rings, elites) {
  const N = m.N; const out = [];
  const add = (s) => {
    const node = (s.z * N + s.x) * 2 + s.layer; if (A.dSpawn[node] >= INF) { s.unreachable = true; }
    const r = m.macro.regions[m.reg[s.z * N + s.x]];
    s.node = node; s.pathDist = A.dSpawn[node]; s.offSpine = A.dSpine[node];
    s.island = isl.cellIsland[s.z * N + s.x] >= 0;
    s.gate = s.island ? 100 : A.walkReach[node] ? 0 : 50;
    s.exposure = exposureAt(m, A, s.z * N + s.x);
    s.enemy = !!A.enemy[node];
    s.region = r ? r.id : -1; s.district = r ? r.district : -1; s.role = r ? r.role : 'none'; s.tier = r ? r.tier : 0;
    s.y = s.layer ? m.h1[s.z * N + s.x] : m.h0[s.z * N + s.x];
    s.elite = elites.some((e) => (e.x - s.x) ** 2 + (e.z - s.z) ** 2 <= 400);
    s.id = out.length; out.push(s);
  };
  for (const s of m.slots) add({ tag: s.tag, x: s.x, z: s.z, layer: s.layer, chunk: s.chunk });
  const ringNear = (x, z) => rings.some((c) => (c % N - x) ** 2 + (((c / N) | 0) - z) ** 2 < 17 * 17);
  for (let z = 3; z < N; z += 6) for (let x = 3; x < N; x += 6) {
    const i = z * N + x; const f = m.flags[i];
    if (!(f & F.WALK) || (f & (F.LANE | F.ARENA | F.ENTRY | F.SPAWNB | F.GULLY | F.PONLY | F.RAMP | F.SOLID | F.SLIDE))) continue;
    if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue;
    const h = m.h0[i]; if (Math.abs(m.h0[i + 1] - h) > 30 || Math.abs(m.h0[i - 1] - h) > 30 || Math.abs(m.h0[i + N] - h) > 30 || Math.abs(m.h0[i - N] - h) > 30) continue;
    if ((x * 100 + 50 - m.spawn.x) ** 2 + (z * 100 + 50 - m.spawn.z) ** 2 < 2000 * 2000) continue;
    if (ringNear(x, z) || (m.reserve && m.reserve[i])) continue;
    add({ tag: 'field', x, z, layer: 0, chunk: -1 });
  }
  return out;
}

const clearDisc = (m, A, s, r) => {
  const N = m.N; const c = s.z * N + s.x; const h = s.y;
  for (const [dx, dz] of discOffsets(r)) { const x = s.x + dx, z = s.z + dz; if (x < 0 || z < 0 || x >= N || z >= N) return false; const i = z * N + x; if (!(m.flags[i] & F.WALK) || !A.enemy[i * 2] || Math.abs(m.h0[i] - h) > 100 || (m.flags[i] & (F.PONLY | F.SOLID))) return false; }
  return c >= 0;
};

export function riskR(s, type, rules) { // x100
  const g = rules[type]?.guard || 0;
  return Math.trunc(s.offSpine / 4) + s.gate + Math.trunc(s.exposure / 10) + g + (s.elite ? 200 : 0);
}

export function placeEncounters(ctx, m, A, slots) {
  const spec = ctx.spec; const rules = spec.encRules; const rng = ctx.streams.encounters; const N = m.N;
  const open = spec.openingM * 10;
  const reachSlots = slots.filter((s) => !s.unreachable);
  const dists = reachSlots.map((s) => s.pathDist).sort((a, b) => a - b);
  const dMed = dists.length ? dists[dists.length >> 1] : 1500;
  const placed = []; const used = new Set();
  const counts = spec.encounters;
  const wanted = {};
  const wantOf = (t) => { const v = counts[t]; const n = v && typeof v === 'object' ? (rng.chance(v.chance) ? v.n : 0) : v | 0; if (t !== 'vases') wanted[t] = n; return n; };
  const witnessHalf = dMed >= 1300 ? 'far' : 'near';
  // spread caps: at most 3 encounters per region and 35% of the stage total per district
  const planned = Object.keys(counts).filter((k) => k !== 'vases').reduce((a, k) => a + (typeof counts[k] === 'object' ? counts[k].n : counts[k] | 0), 0);
  const capRegion = spec.rooms ? 7 : 3, capDistrict = spec.rooms ? planned : Math.max(3, Math.trunc((planned * 35) / 100));       // rooms are big: up to 7 in a room
  // V12 visibility from the spine, cached per slot: 0 = landmark visible as is, 1 = needs a +3 m plinth, -1 = not visible
  const samples = spineSamples(m); const appr = approachPoints(m); const visCache = new Map();
  const seen = (type, s, top) => { const T = tellOf(type); if (MAJOR[type]) return visCount(m, samples, s.x, s.z, s.y, top, T.range) >= 3; return visCount(m, samples, s.x, s.z, s.y, top, T.range) >= 1 || (s.role !== 'spine' && visCount(m, appr, s.x, s.z, s.y, top, T.range) >= 1); };
  const plinthFor = (type, s) => {
    const T = tellOf(type); const key = s.id * 8 + (T.top === 2500 ? 4 : T.top === 900 ? 2 : T.top === 800 ? 3 : 0) + (MAJOR[type] ? 1 : 0);
    if (visCache.has(key)) return visCache.get(key);
    const v = seen(type, s, T.top) ? 0 : seen(type, s, T.top + 300) ? 1 : -1;
    visCache.set(key, v); return v;
  };
  const ctxPlace = { dMed, witnessHalf };
  const eligible = (type, s, extra = {}) => {
    const r = rules[type] || {};
    if (s.unreachable || used.has(s.id)) return false;
    if (!r.tags.includes(s.tag) && s.tag !== 'vase') return false;
    if (s.tag === 'vase') return false;
    const R = riskR(s, type, rules);
    if (r.minR && R < r.minR) return false;
    if (r.minSpawn && s.pathDist < r.minSpawn * 10) return false;
    if (r.pathRange && (s.pathDist < r.pathRange[0] * 10 || s.pathDist > r.pathRange[1] * 10)) return false;
    if (r.offSpine && (s.offSpine < r.offSpine[0] * 10 || s.offSpine > r.offSpine[1] * 10)) return false;
    if (r.enemyReach && !s.enemy) return false;
    if (r.minExposure && s.exposure < r.minExposure) return false;
    if (r.branch && s.role === 'spine') return false;
    if (FREE[CLASS_OF[type]] && s.pathDist <= open) {
      if (type === 'witness_stone' || type === 'deck_anvil') return false;
      if (placed.some((p) => FREE[p.cls] && p.pathDist <= open)) return false;
    }
    if (type === 'witness_stone' && !extra.relaxHalf && (witnessHalf === 'far' ? s.pathDist < dMed : s.pathDist >= dMed)) return false;
    if (type === 'deck_anvil' && !extra.relaxHalf && (witnessHalf === 'far' ? s.pathDist >= dMed : s.pathDist < dMed)) return false;
    if (type === 'card_chest' && s.pathDist < 600 && placed.filter((p) => p.type === 'card_chest' && p.pathDist < 600).length >= 2) return false;
    const sp = (r.spacing || (type === 'card_chest' ? 25 : 40));
    for (const p of placed) {
      const d2 = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
      if (d2 < 12 * 12) return false;
      if (p.type === type && d2 < sp * sp) return false;
    }
    if (!extra.relaxCaps) {
      let inReg = 0, inDist = 0; for (const p of placed) { if (p.cls === 'GATE') continue; if (p.region === s.region) inReg++; if (p.district === s.district) inDist++; }
      if (inReg >= capRegion || inDist >= capDistrict) return false;
    }
    if (!extra.relaxVis && !visExempt(type, ctx.stage) && plinthFor(type, s) < 0) return false;
    if (r.clearR && !clearDisc(m, A, s, r.clearR)) return false;
    if (extra.filter && !extra.filter(s)) return false;
    return true;
  };
  const scoreList = (type, list) => {
    let mP = 1, mR = 1, mD = 1;
    for (const s of list) { mP = Math.max(mP, s.pathDist); mR = Math.max(mR, riskR(s, type, rules)); mD = Math.max(mD, Math.trunc((s.offSpine * (500 + s.exposure)) / 1000)); }
    return list.map((s) => {
      let spread = 1000, spreadAny = 1000;
      for (const p of placed) { if (p.cls === 'GATE') continue; const d2 = Math.min(1000, Math.trunc(((p.x - s.x) ** 2 + (p.z - s.z) ** 2) / 10)); if (p.type === type) spread = Math.min(spread, d2); spreadAny = Math.min(spreadAny, Math.min(1000, d2 * 4)); }
      const det = Math.trunc((s.offSpine * (500 + s.exposure)) / 1000);
      let sc = Math.trunc((250 * s.pathDist) / mP) + Math.trunc((300 * riskR(s, type, rules)) / mR) + Math.trunc((200 * det) / mD) + Math.trunc((100 * spread) / 1000) + Math.trunc((150 * spreadAny) / 1000);
      sc += prefBonus(type, s, ctxPlace, placed);
      return { s, sc: sc + rng.int(25) };
    }).sort((a, b) => b.sc - a.sc || a.s.id - b.s.id);
  };
  const put = (type, s) => {
    used.add(s.id);
    const e = { type, cls: CLASS_OF[type], x: s.x, z: s.z, layer: s.layer, y: s.y, R: riskR(s, type, rules), pathDist: s.pathDist, offSpine: s.offSpine,
      exposure: s.exposure, slot: s.id, tag: s.tag, region: s.region, district: s.district, tier: s.tier, island: s.island };
    const T = tellOf(type); e.plinth = visExempt(type, ctx.stage) ? false : plinthFor(type, s) === 1; e.lmTop = T.top + (e.plinth ? 300 : 0); e.lmRange = T.range;
    placed.push(e); return e;
  };
  const placeType = (type, n, extra = {}) => {
    for (let k = 0; k < n; k++) {
      let list = reachSlots.filter((s) => eligible(type, s, extra));
      if (!list.length && (type === 'witness_stone' || type === 'deck_anvil')) list = reachSlots.filter((s) => eligible(type, s, { ...extra, relaxHalf: true }));
      if (!list.length && !extra.filter) list = reachSlots.filter((s) => eligible(type, s, { ...extra, relaxCaps: true }));
      if (!list.length) { ctxPlace.missing = ctxPlace.missing || []; ctxPlace.missing.push(type); continue; }
      put(type, scoreList(type, list)[0].s);
    }
  };
  // gate (fixed set-piece slot)
  // contested crossings: ramp feet / tops and bridge heads, where danger encounters prefer to sit
  ctxPlace.chokes = [];
  for (const r of m.ramps) for (const sg of [-1, 1]) ctxPlace.chokes.push([Math.floor((r.P[0] + sg * r.dir[0] * 1100) / 100), Math.floor((r.P[1] + sg * r.dir[1] * 1100) / 100)]);
  for (const c of m.chunks) if (c.type === 'card_bridge' && !c.removed) ctxPlace.chokes.push([c.anchor[0], c.anchor[1]]);
  placed.push({ type: 'gate', cls: 'GATE', x: Math.floor(m.arena.x / 100), z: Math.floor(m.arena.z / 100), layer: 0, y: m.h0[Math.floor(m.arena.z / 100) * N + Math.floor(m.arena.x / 100)], R: 0, pathDist: A.dSpawn[(Math.floor(m.arena.z / 100) * N + Math.floor(m.arena.x / 100)) * 2], offSpine: 0, exposure: 0, slot: -1, tag: 'gate', region: 0 });
  for (const type of PLACE_ORDER) {
    if (type === 'card_chest') break;
    const n = wantOf(type); if (!n) continue;
    if (type === 'second_seal') {
      const ax = Math.floor(m.arena.x / 100), az = Math.floor(m.arena.z / 100);
      placeType(type, n, { filter: (s) => (s.x - ax) ** 2 + (s.z - az) ** 2 < 45 * 45 });
      continue;
    }
    if (type === 'witness_stone') { placeType(type, 1, { filter: (s) => HIGH_TAGS[s.tag] }); if (!placed.some((p) => p.type === type)) placeType(type, 1); placeType(type, n - 1); continue; }
    if (type === 'shrine_tribute') { placeType(type, 1, { filter: (s) => s.offSpine <= 150 }); if (placed.filter((p) => p.type === type).length < 1) placeType(type, 1); placeType(type, n - 1); continue; }
    if (type === 'magnet_tablet' && n >= 2) { placeType(type, 1, { filter: (s) => s.pathDist < dMed }); placeType(type, 1, { filter: (s) => s.pathDist >= dMed }); continue; }
    if (type === 'sealed_fragment') {
      const pk = reachSlots.filter((s) => eligible(type, s) && s.role === 'pocket').sort((a, b) => b.pathDist - a.pathDist || a.id - b.id);
      const any = reachSlots.filter((s) => eligible(type, s)).sort((a, b) => b.pathDist - a.pathDist || a.id - b.id);
      const s = pk[0] || any[0]; if (s) put(type, s); continue;
    }
    if (type === 'altar_tribute') { placeType(type, 1, { filter: (s) => s.role === 'pocket' }); if (!placed.some((p) => p.type === type)) placeType(type, 1); continue; }
    placeType(type, n);
  }
  // card chests: branch value (V14), lure coverage (V11), then the high-route share
  const nChest = wantOf('card_chest'); let chests = 0;
  const hasReward = (rid) => placed.some((p) => p.region === rid && p.cls !== 'VASE' && p.cls !== 'GATE' && p.R >= 100);
  for (const R of m.macro.regions) {
    if (chests >= nChest) break;
    if (R.role === 'spine' || hasReward(R.id)) continue;
    const list = reachSlots.filter((s) => s.region === R.id && eligible('card_chest', s) && riskR(s, 'card_chest', rules) >= 100);
    if (list.length) { put('card_chest', scoreList('card_chest', list)[0].s); chests++; }
  }
  const lure = lureSamples(m, ctx.spec.lureEvery);
  for (const p of lure) {
    if (chests >= nChest) break;
    if (lureOK(m, p, placed, ctx.spec.lureDist)) continue;
    const list = reachSlots.filter((s) => s.offSpine >= 60 && (s.x - p.x) ** 2 + (s.z - p.z) ** 2 <= (ctx.spec.lureDist - 3) ** 2 && eligible('card_chest', s) && lureOK(m, p, [{ x: s.x, z: s.z, y: s.y, type: 'card_chest', offSpine: s.offSpine }], ctx.spec.lureDist));
    if (list.length) { put('card_chest', scoreList('card_chest', list)[0].s); chests++; }
  }
  while (chests < nChest) {
    const high = placed.filter((p) => p.type === 'card_chest' && (HIGH_TAGS[p.tag] || m.macro.regions[p.region]?.role === 'pocket')).length;
    const needHigh = high * 10 < 3 * nChest;
    let list = reachSlots.filter((s) => eligible('card_chest', s) && (!needHigh || HIGH_TAGS[s.tag] || s.role === 'pocket'));
    if (!list.length) list = reachSlots.filter((s) => eligible('card_chest', s));
    if (!list.length) break;
    put('card_chest', scoreList('card_chest', list)[0].s); chests++;
  }
  // wrapped mimics (stage 2): fake chests on chest-type slots, priced "???"
  const nMimic = wantOf('wrapped_mimic'); if (nMimic) placeType('wrapped_mimic', nMimic);
  // district coverage: every district holds at least one danger and one free-or-paid reward
  const nD = m.macro.districts.length; const moved = [];
  for (let d = 0; d < nD; d++) {
    for (const need of ['DANGER', 'REWARD']) {
      const isNeed = (p) => (need === 'DANGER' ? p.cls === 'DANGER' : (FREE[p.cls] || p.cls === 'PAID'));
      if (placed.some((p) => p.district === d && isNeed(p))) continue;
      const byD = new Array(nD).fill(0); for (const p of placed) if (isNeed(p) && p.district >= 0) byD[p.district]++;
      const donors = placed.filter((p) => isNeed(p) && p.district !== d && byD[p.district] >= 2 && (need === 'DANGER' ? p.type !== 'duel_statue' || true : p.type === 'card_chest'))
        .sort((a, b) => byD[b.district] - byD[a.district] || a.slot - b.slot);
      for (const p of donors) {
        const idx = placed.indexOf(p); placed.splice(idx, 1); used.delete(p.slot);
        const list = reachSlots.filter((s) => s.district === d && eligible(p.type, s, { relaxHalf: true, relaxCaps: true }));
        if (list.length) { const e = put(p.type, scoreList(p.type, list)[0].s); moved.push([p.type, p.district, d]); break; }
        placed.splice(idx, 0, p); used.add(p.slot);
      }
    }
  }
  ctxPlace.moved = moved;
  // chest prices rise per chest (in path order), shown on the pedestal
  placed.filter((p) => p.type === 'card_chest').sort((a, b) => a.pathDist - b.pathDist || a.slot - b.slot).forEach((p, k) => { p.price = 10 + 5 * k; });
  // vases: jump-line breadcrumbs first, then vase slots, then field
  const vases = placeVases(ctx, m, A, slots, placed, wantOf('vases'));
  const econ = economy(ctx, m, A, placed, reachSlots, eligible, put, used, ctxPlace);
  // lure obelisks: a 6 m carved marker on an off-route cell for any 40 m stretch that still sees nothing
  const lures = [];
  for (const p of lureSamples(m, ctx.spec.lureEvery)) {
    if (lureOK(m, p, placed.concat(lures), ctx.spec.lureDist)) continue;
    let best = null, bd = -1;
    for (let dz = -30; dz <= 30; dz += 2) for (let dx = -30; dx <= 30; dx += 2) {
      const d2 = dx * dx + dz * dz; if (d2 < 100 || d2 > 900) continue;
      const x = p.x + dx, z = p.z + dz; if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue;
      const i = z * N + x; if (!(m.flags[i] & F.WALK) || (m.flags[i] & (F.RAMP | F.ARENA | F.LANE | F.ENTRY)) || A.dSpine[i * 2] < 60 || A.dSpine[i * 2] >= INF) continue;
      const cand = { type: 'lure_obelisk', x, z, y: m.h0[i], offSpine: A.dSpine[i * 2] };
      if (!lureOK(m, p, [cand], ctx.spec.lureDist)) continue;
      const sc = Math.min(A.dSpine[i * 2], 200) * 4 - Math.abs(d2 - 400);
      if (sc > bd) { bd = sc; best = cand; }
    }
    if (best) lures.push(best);
  }
  // lure links: which off-route landmark each 40 m spine sample sees (V11 backing objects)
  const lureLinks = lureSamples(m, ctx.spec.lureEvery).map((p) => { const e = lureWho(m, p, placed.concat(lures), ctx.spec.lureDist); return { at: [p.x, p.z], sees: e ? { type: e.type, x: e.x, z: e.z } : null }; });
  const missing = []; for (const t of Object.keys(wanted)) { const k = placed.filter((p) => p.type === t).length; for (let j = k; j < wanted[t]; j++) missing.push(t); }
  return { list: placed, vases, econ, lures, lureLinks, missing, moved, dMed };
}

function prefBonus(type, s, cp, placed) {
  let b = 0;
  if (type === 'scales_court' && s.tag === 'high_perch') b += 300;
  if (type === 'broken_covenant' && (s.tag === 'pocket_end' || s.tag === 'reward_port')) b += 300;
  if (type === 'magnet_tablet' && s.tag === 'reward_port') b += 200;
  if (type === 'golden_statue' && (HIGH_TAGS[s.tag] || s.gate > 0)) b += 300;
  if (type === 'echo_forge' && s.role === 'pocket') b += 300;
  if (type === 'card_chest' && (HIGH_TAGS[s.tag] || s.tag === 'pedestal')) b += 120;
  if (type === 'deck_anvil') { const w = placed.filter((p) => p.type === 'witness_stone'); if (w.length && w.every((p) => p.tier !== s.tier)) b += 200; }
  if (type === 'shrine_tribute' && s.tag === 'ring_open_r10') b += 150;
  if ((type === 'shrine_tribute' || type === 'bone_oath' || type === 'duel_statue') && s.exposure >= 600 && cp.chokes && cp.chokes.some(([x, z]) => (x - s.x) ** 2 + (z - s.z) ** 2 <= 400)) b += 250;
  return b;
}

export function lureSamples(m, every) {
  const path = m.spine?.path || []; const N = m.N; const out = []; let acc = 0, next = every * 10;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k]; acc += (a % N !== b % N && ((a / N) | 0) !== ((b / N) | 0)) ? 14 : 10;
    if (acc >= next) { const back = path[Math.max(0, k - 7)]; out.push({ x: b % N, z: (b / N) | 0, bx: back % N, bz: (back / N) | 0, k }); next += every * 10; }
  }
  return out;
}
export function lureOK(m, p, placed, maxD) { return !!lureWho(m, p, placed, maxD); }
export function lureWho(m, p, placed, maxD) {
  const N = m.N; const he = m.h0[p.z * N + p.x];
  // camera point: 7 m back along the route, 3 m up
  const camx = p.x + (p.bx - p.x), camz = p.z + (p.bz - p.z); const hc = m.h0[camz * N + camx] + 300;
  for (const e of placed) {
    if (e.type === 'gate' || e.type === 'vase' || e.offSpine < 60) continue;
    const d2 = (e.x - p.x) ** 2 + (e.z - p.z) ** 2; if (d2 > maxD * maxD) continue;
    const top = e.y + 600;
    if (los(m, p.x, p.z, he + 170, e.x, e.z, top) && los(m, camx, camz, hc, e.x, e.z, top)) return e;
  }
  return null;
}

function placeVases(ctx, m, A, slots, placed, n) {
  const rng = ctx.streams.encounters; const N = m.N; const out = [];
  const cand = [];
  for (const j of m.jumps) cand.push([0, j.a[0], j.a[1]]);
  for (const c of m.chunks) if (c.chain) { cand.push([0, c.chainEntry % N, (c.chainEntry / N) | 0]); }
  for (const s of slots) if (s.tag === 'vase') cand.push([1, s.x, s.z]);
  const field = slots.filter((s) => s.tag === 'field' && !s.unreachable).map((s) => [2, s.x, s.z]);
  rng.shuffle(field); for (const f of field) cand.push(f);
  for (const [pri, x, z] of cand) {
    if (out.length >= n) break;
    const i = z * N + x; if (A.dSpawn[i * 2] >= INF) continue;
    if (out.some((v) => (v.x - x) ** 2 + (v.z - z) ** 2 < 36) || placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 16)) continue;
    out.push({ type: 'vase', cls: 'VASE', x, z, layer: 0, y: m.h0[i], cluster: rng.range(2, 5), brass: rng.chance(12), breadcrumb: pri === 0 });
  }
  return out;
}

/* ---------- economy ---------- */
export function economyViolations(ctx, m, A, placed) {
  const spec = ctx.spec; const N = m.N; const open = spec.openingM * 10; const lim = spec.econGraphM * 10;
  const v = [];
  const free = placed.filter((p) => FREE[p.cls]);
  const ds = dijkstra(A.pg, [A.spawnNode], ANY, Math.max(lim, open));
  const dAny = (p) => ds[(p.z * N + p.x) * 2 + p.layer];
  const inOpen = free.filter((p) => dAny(p) <= open); // opening measured with any movement
  if (inOpen.length > 1) v.push({ rule: 1, who: inOpen.slice(1), why: 'more than one free reward in the opening' });
  for (const p of inOpen) if (p.type === 'witness_stone' || p.type === 'deck_anvil') v.push({ rule: 1, who: [p], why: p.type + ' in the opening' });
  // rule 2: no route of econGraphM or less from spawn, using ANY movement (run, jump, dash, G2, air jump),
  // collects a FREE_ITEM and a FREE_LEVEL reward. Danger encounters are opt-in, so they never count as gates.
  for (const a of free) {
    const na = (a.z * N + a.x) * 2 + a.layer; const d0 = ds[na]; if (d0 > lim) continue;
    const others = free.filter((b) => b !== a && b.cls !== a.cls && d0 + idist(a, b) <= lim);
    if (!others.length) continue;
    const da = dijkstra(A.pg, [na], ANY, lim - d0);
    for (const b of others) { const nb = (b.z * N + b.x) * 2 + b.layer; if (d0 + da[nb] <= lim) v.push({ rule: 2, who: [ds[nb] >= d0 ? b : a], why: `${a.type} + ${b.type} within ${Math.trunc((d0 + da[nb]) / 10)} m (any movement)` }); }
  }
  // rule 3: witness stones and deck anvils in opposite halves
  const w = placed.filter((p) => p.type === 'witness_stone'), an = placed.filter((p) => p.type === 'deck_anvil');
  if (w.length && an.length) {
    const all = placed.filter((p) => p.cls !== 'GATE').map((p) => p.pathDist).sort((x, y) => x - y); const med = all[all.length >> 1];
    const wHalf = w.map((p) => p.pathDist >= med), aHalf = an.map((p) => p.pathDist >= med);
    if (wHalf.some((x) => aHalf.includes(x))) v.push({ rule: 3, who: an, why: 'witness stones and anvils share a half', soft: true });
  }
  for (const p of placed) if (p.type === 'echo_forge' && p.pathDist < 2000) v.push({ rule: 4, who: [p], why: 'echo forge closer than 200 m' });
  const near = placed.filter((p) => p.type === 'card_chest' && p.pathDist < 600);
  if (near.length > 2) v.push({ rule: 5, who: near.slice(2), why: 'more than 2 card chests within 60 m' });
  return v;
}
const idist = (a, b) => { const d2 = ((a.x - b.x) ** 2 + (a.z - b.z) ** 2) * 100; let x = d2, y = (x + 1) >> 1; if (d2 < 2) return d2 * 10; while (y < x) { x = y; y = Math.trunc((x + Math.trunc(d2 / x)) / 2); } return x; };

function economy(ctx, m, A, placed, reachSlots, eligible, put, used, cp) {
  let swaps = 0; let viol = economyViolations(ctx, m, A, placed).filter((x) => !x.soft);
  while (viol.length && swaps < 16) {
    const p = viol[0].who[0];
    const idx = placed.indexOf(p); used.delete(p.slot); placed.splice(idx, 1);
    let list = reachSlots.filter((s) => s.pathDist >= p.pathDist + 400 && eligible(p.type, s, { relaxHalf: true }));
    if (!list.length) list = reachSlots.filter((s) => s.pathDist > p.pathDist && eligible(p.type, s, { relaxHalf: true }));
    if (!list.length) list = reachSlots.filter((s) => s.pathDist > p.pathDist && eligible(p.type, s, { relaxHalf: true, relaxCaps: true }));
    if (!list.length) { placed.splice(idx, 0, p); used.add(p.slot); break; }
    // prefer slots far from every reward of the other free class (that is what lengthens the pair route), then near
    const others = placed.filter((q) => FREE[q.cls] && q.cls !== p.cls);
    const far = (s) => { let d = 1e9; for (const q of others) d = Math.min(d, (q.x - s.x) ** 2 + (q.z - s.z) ** 2); return d; };
    list.forEach((s) => { s._far = Math.min(far(s), 120 * 120); });
    list.sort((a, b) => b._far - a._far || a.pathDist - b.pathDist || a.id - b.id);
    const e = put(p.type, list[0]); if (p.price) e.price = p.price;
    swaps++;
    viol = economyViolations(ctx, m, A, placed).filter((x) => !x.soft);
  }
  return { swaps, violations: viol };
}

