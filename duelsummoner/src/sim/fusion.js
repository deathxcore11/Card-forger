// The fusion rule v3 in the sim (numbers in src/data/fusion.js). A Fusion's attack is a chain of layers: layer 1 is the Line's own attack, fired by the summon;
// each later layer fires from the enemies the layer before it hit, a moment later, at a share of its own damage, and puts its own element on what it hits.
// Two elements on one enemy react, within limits: one reaction per enemy a second, a few a second for the whole build, only the strongest ground zone hurts.
// Kills fill the show-stopper meter; when it is full, a build with a Fusion fires one big move for each element it carries, back to back.
// Basic monsters keep their own attacks (src/sim/monsters.js); this file runs only for Fusions and only while g.fusionRule is 3.
import { smashProps } from './smash.js';
import { solidAt } from './colliders.js';
import { FUSION as F, kitOf, LAYER_NAME, REACT_KIND, STOPPERS, reactionOf, FORMS, FORM, LINK, DIRECTIONAL, hashKey, pickLink, LAB_KEY } from '../data/fusion.js';
import { FUSIONS, MARKS } from '../data/cards.js';
import { ELEMENTS } from '../data/elements.js';
import { KIND_LIST } from '../data/enemies.js';
import { CFG } from '../data/config.js';
import { damageEnemy, addFx } from './combat.js';
import { fireShot, fireLob, fireHoming, KIND_FIRE } from './weapons.js';
import { monsterMul } from './ledger.js';
import { heightAt, moveXZ } from './terrain.js';
import { takeBuf, freeBuf } from './scratch.js';
import { sin, cos, atan2 } from './dmath.js';

const ELS = ['fire', 'lightning', 'ice', 'poison', 'wind', 'earth', 'light', 'dark'], EI = Object.fromEntries(ELS.map((e, i) => [e, i]));
const COL = { fire: 0xf08040, ice: 0x8fd8f0, lightning: 0xffe060, poison: 0x8ad048, wind: 0xbfeee0, earth: 0xc09050, light: 0xfff0b0, dark: 0x8a5ac0 };
const bit = el => (ELEMENTS[el] ? ELEMENTS[el].bit : 0), cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

// ---- builds: the chain of layers, by the rule ----
// parents: the two parent builds (the first is the Line), or none for a basic. Layers past the rank's cap are dropped; elements carried are at most three.
export function makeBuild(id, rank, parents) {
  let chain; const key = LAB_KEY[id] || id, forms = [];
  if (parents) { chain = parents[0].chain.slice(); for (const l of parents[1].chain) if (chain.length < F.layerCap[rank]) chain.push({ ...l, link: pickLink(chain[chain.length - 1].d, key + chain.length) });       // each graft's layer gets its link from the carrier before it
    for (const f of parents[0].forms) forms.push(f);
    if (parents[0].rank >= 1 && parents[1].rank >= 1) { const f = FORMS[hashKey(key) % FORMS.length]; if (!forms.includes(f) && forms.length < 2) forms.push(f); }       // a fusion of two fusions takes a form
    for (const f of parents[1].forms) if (!forms.includes(f) && forms.length < 2) forms.push(f); }
  else { const q = kitOf(id) || { d: 'bite', dmg: 2, cd: 1, el: 'earth' }; chain = [{ d: q.d, q, el: q.el }]; }
  const els = []; for (const p of parents || [{ els: [chain[0].el] }]) for (const e of p.els) if (!els.includes(e) && els.length < 3) els.push(e);
  const A = parents ? parents[0] : null; let mult = F.rankMul[rank] * F.gameTier[rank], cd = A ? A.cd : chain[0].q.cd, size = 1;
  if (forms.includes('Giant')) { mult *= FORM.Giant.mult; size = FORM.Giant.size; if (!A.forms.includes('Giant')) cd *= FORM.Giant.cd; }       // one huge slow version
  if (forms.includes('Spiral')) { mult *= FORM.Spiral.mult; if (!A.forms.includes('Spiral')) cd *= FORM.Spiral.cd; }       // a constant turning stream
  return { id, rank, chain, els, forms, mult, cd, size, loop: rank >= 3, key: rank >= 4 ? els[0] : null, name: nameOf(chain, els, forms) };
}
// the attack's name from its chain: its forms, the reaction its first two elements make (or its element), then the later layers last to first, then the Line's own
export function nameOf(chain, els, forms) { const rx = els.length > 1 ? reactionOf(els[0], els[1]) : null; return (forms || []).concat([rx || cap(els[0])], chain.slice(1).reverse().map(l => LAYER_NAME[l.d]), [LAYER_NAME[chain[0].d]]).join(' '); }
const BUILDS = {};
export function buildOf(id) {
  if (BUILDS[id]) return BUILDS[id];
  const D = FUSIONS[id]; return BUILDS[id] = D && D.from ? makeBuild(id, D.rank || 1, D.from.map(buildOf)) : makeBuild(id, 0, null);
}

// ---- state, per game ----
export function fusionState(g) {
  if (g.fx3) return g.fx3;
  const n = g.en.max;
  return g.fx3 = { casts: [], ci: 0, q: [], zones: [], bank: F.reactPerSec, loopCd: 0, meter: 0, kills0: g.kills | 0, elites0: g.elitesKilled | 0, reactions: 0, reactBy: {}, stoppers: 0, stopperNames: [], tick: 0, zoneT: 0, fling: 0,
    on: new Uint8Array(n), act: [], el: new Uint8Array(n), elT: new Float32Array(n * 8), rc: new Float32Array(n), venom: new Uint8Array(n), venomAcc: new Float32Array(n), chill: new Uint8Array(n), kvx: new Float32Array(n), kvz: new Float32Array(n), zn: new Int32Array(n), maxLayer: 0 };
}
const track = (S, i) => { if (!S.on[i]) { S.on[i] = 1; S.act.push(i); } };
function clear(S, i) { S.on[i] = 0; S.el[i] = 0; S.rc[i] = 0; S.venom[i] = 0; S.venomAcc[i] = 0; S.chill[i] = 0; S.kvx[i] = 0; S.kvz[i] = 0; for (let k = 0; k < 8; k++) S.elT[i * 8 + k] = 0; }
// a knock: a velocity on the enemy that falls off, never a jump to a new spot
export function knock(g, i, dx, dz, speed) { const S = fusionState(g), l = Math.sqrt(dx * dx + dz * dz) || 1; if (g.en.ace[i]) speed *= 0.4; S.kvx[i] += dx / l * speed; S.kvz[i] += dz / l * speed; track(S, i); }

// every enemy within r of (x, z), skip excepted
function each(g, x, z, r, skip, fn) { const e = g.en, buf = takeBuf(), c = g.grid.query(x, z, r, buf); for (let k = 0; k < c; k++) { const j = buf[k]; if (j === skip || !e.alive[j]) continue; const dx = e.x[j] - x, dz = e.z[j] - z; if (dx * dx + dz * dz < r * r) fn(j, dx, dz); } freeBuf(); }
function nearestTo(g, x, z, r, skip) { const e = g.en; let best = -1, bd = r * r; each(g, x, z, r, skip, (j, dx, dz) => { const d = dx * dx + dz * dz - (e.mark[j] > 0 ? 9 : 0); if (d < bd) { bd = d; best = j; } }); return best; }
function eachSpecial(g, x, z, r, fn) { for (const sp of g.sp) if (sp.alive && !sp.dead) { const dx = sp.x - x, dz = sp.z - z, rr = r + (sp.radius || 1); if (dx * dx + dz * dz < rr * rr) fn(sp); } }
const lvlOf = m => m ? monsterMul(m.id, m.level || 1) / monsterMul(m.id, 1) * (1 + F.levelExtra * ((m.level || 1) - 1)) : 1;       // level growth only: the rank is the build's own multiplier

// ---- one landed hit from layer k ----
// ctx: one cast of one layer: lvl (level growth), sc (a share from a link or a form), per (how often each later layer has fired from it)
function layerDamage(g, B, k, i, ctx, sc) {
  const S = fusionState(g), L = B.chain[k]; let n = L.q.dmg * B.mult * F.layerScale[k] * ctx.lvl * (ctx.sc || 1) * (sc || 1);
  if (S.el[i] & bit('dark')) n *= B.key === 'dark' ? 1.45 : 1.2;
  if ((S.el[i] & bit('light')) && g.rc() < (B.key === 'light' ? 0.5 : 0.25)) n *= 2;
  return n;
}
function hit(g, B, k, i, ctx, sc) {
  const e = g.en; if (!e.alive[i]) return;
  const S = fusionState(g), L = B.chain[k], x0 = e.x[i], z0 = e.z[i], c = g.curChain; g.curChain = -1;
  damageEnemy(g, i, layerDamage(g, B, k, i, ctx, sc), { elem: bit(L.el), noChain: k > 0 }); g.curChain = c;
  const dead = !e.alive[i]; if (dead) { clear(S, i); if (S.fling < 6) { S.fling++; g.emit('knock', x0, z0, atan2(x0 - g.p.x, z0 - g.p.z)); } } else status(g, i, L.el, B, 0, ctx.lvl);       // a kill by a layer throws the body up and away (at most six a second, so a crowd never turns to confetti)
  if (k > S.maxLayer) S.maxLayer = k;
  link(g, B, k, i, x0, z0, ctx, dead);
}
// the links that fire from a hit enemy: hit (at most fireFrom per cast), echo (twice, from the first hit only), kill (only when the hit kills, stronger).
// The carrier's own links (end, trail, nova) are fired by cast() itself.
function link(g, B, k, i, x, z, ctx, dead) {
  const N = B.chain[k + 1]; if (!N) return;
  const lk = N.link || 'hit', per = ctx.per || (ctx.per = []), n = per[k] | 0, lim = F.fireFrom[k + 1] + (B.key === 'lightning' ? 1 : 0), face = atan2(x - g.p.x, z - g.p.z);
  if (lk === 'hit' && n < lim) { per[k] = n + 1; later(g, B, k + 1, x, z, i, ctx, F.layerDelay, 1, face, false); }
  else if (lk === 'echo' && n < 1) { per[k] = 1; later(g, B, k + 1, x, z, i, ctx, F.layerDelay, LINK.echo.scale, face, false); later(g, B, k + 1, x, z, i, ctx, F.layerDelay + LINK.echo.again, LINK.echo.scale, face, false); }
  else if (lk === 'kill' && dead && n < lim + LINK.kill.extra) { per[k] = n + 1; later(g, B, k + 1, x, z, i, ctx, LINK.kill.delay, LINK.kill.scale, face, false); }
}
function later(g, B, k, x, z, skip, ctx, dt, sc, face, fixed) { fusionState(g).q.push({ t: g.t + dt, kind: 'layer', B, k, x, z, skip, lvl: ctx.lvl, sc: (ctx.sc || 1) * sc, face, fixed }); }
// a shot fired by layer 1 landed (src/sim/combat.js calls this while g.curChain names the cast)
export function chainHit(g, h, i, x, z, dead) {
  const S = fusionState(g), H = S.casts[h]; if (!H) return;
  if (dead) clear(S, i); else status(g, i, H.B.chain[0].el, H.B, 0, H.lvl);
  link(g, H.B, 0, i, x, z, H, dead);
}

// ---- elements and reactions ----
function status(g, i, el, B, depth, lvl) {
  const S = fusionState(g), e = g.en, b = bit(el), had = S.el[i] & ~b; track(S, i);
  S.el[i] |= b; S.elT[i * 8 + EI[el]] = el === 'poison' ? F.poisonT : F.statusT;
  if (el === 'ice') { S.chill[i]++; if (S.chill[i] >= (B.key === 'ice' ? 2 : 3)) { e.root[i] = Math.max(e.root[i], 2); S.chill[i] = 0; } }
  else if (el === 'poison') S.venom[i] = Math.min(B.key === 'poison' ? F.venomCapKey : F.venomCap, S.venom[i] + 1);
  else if (el === 'earth') e.root[i] = Math.max(e.root[i], 0.5);
  else if (el === 'wind') knock(g, i, e.x[i] - g.p.x, e.z[i] - g.p.z, 5);
  if (!had || S.rc[i] > 0 || depth >= 2 || S.bank < 1) return;
  const others = ELS.filter(o => had & bit(o)), o = others[Math.floor(g.rc() * others.length) % others.length], name = reactionOf(el, o); if (!name) return;
  S.rc[i] = F.reactEvery; S.bank--; S.reactions++; S.reactBy[name] = (S.reactBy[name] | 0) + 1;
  const kind = REACT_KIND[name], x = e.x[i], y = e.y[i], z = e.z[i], col = COL[el], base = B.chain[0].q.dmg * B.mult * lvl;
  addFx(g, { type: 'ring', owner: 0, el, x, y: y + 0.2, z, r: kind === 'spread' ? 4 : 3.2, dur: 0.35, color: col }); g.emit('reaction', x, z, 0, name);
  if (kind === 'burst') { each(g, x, z, 3.2, -1, j => { damageEnemy(g, j, base * F.reactDmg, { elem: bit(el), noChain: true }); }); eachSpecial(g, x, z, 3.2, sp => g.damageSpecial(sp, base * F.reactDmg, x, z, { area: true, elem: bit(el) })); }
  else if (kind === 'zone') S.zones.push({ x, z, r: 2.6, t: 4, dps: base * 1.2, el, B, lvl });
  else if (kind === 'spread') each(g, x, z, 4, i, j => { for (const q of [el, o]) { S.el[j] |= bit(q); S.elT[j * 8 + EI[q]] = F.statusT; } if (el === 'poison' || o === 'poison') S.venom[j] = Math.min(F.venomCap, S.venom[j] + 2); track(S, j); });
  else if (kind === 'hold') each(g, x, z, 3, -1, j => { e.root[j] = Math.max(e.root[j], 1.6); });
  else if (kind === 'pull') each(g, x, z, 5, i, (j, dx, dz) => knock(g, j, -dx, -dz, 8));
  else for (let k = 0; k < 8; k++) if (S.el[i] & (1 << k)) S.elT[i * 8 + k] = 9;
  if (B.loop && S.loopCd <= 0) { S.loopCd = F.loopCd; each(g, x, z, 3, -1, j => { damageEnemy(g, j, base * F.loop, { elem: bit(el), noChain: true }); if (e.alive[j]) for (const q of B.els) status(g, j, q, B, 1, lvl); }); }
}

// ---- casting a layer ----
// k = 0 is the summon itself (m); later layers start where the layer before them hit (skip = the enemy that set it off).
// face: the heading to use when there is nothing to aim at (and always, when fixed: a nova spoke, a Volley side shot, the Spiral's turn).
// Returns false when there is nothing to hit, else { face }.
export function cast(g, B, k, x, y, z, skip, lvl, m, face, fixed, sc) {
  const e = g.en, L = B.chain[k], q = L.q, d = L.d, col = COL[L.el], el = bit(L.el), me = k === 0 && !!m, sz = (B.size || 1) * (k ? F.layerReach : 1);
  const R = (q.range || 10) * sz * (k ? 1 : g.reachK || 1), ctx = { lvl, sc: sc || 1, per: [] }, N = B.chain[k + 1], nl = N ? N.link || 'hit' : null;
  if (face === undefined || face === null) face = atan2(x - g.p.x, z - g.p.z);
  let t = -1; const aim = r => { if (fixed) return -1; t = nearestTo(g, x, z, r, skip); if (t >= 0) face = atan2(e.x[t] - x, e.z[t] - z); return t; };
  const ux = () => sin(face), uz = () => cos(face);
  // the carrier's own links for the next layer: where a moving carrier ends its flight, along its path, or a nova at once from where it stands
  const carry = (len, flight) => { if (!N) return; const fx = ux(), fz = uz();
    if (nl === 'end') later(g, B, k + 1, x + fx * len, z + fz * len, -1, ctx, F.layerDelay + flight, 1, face, true);
    else if (nl === 'trail') for (let s = 1; s <= LINK.trail.n; s++) { const dd = Math.min(len, s * LINK.trail.every); later(g, B, k + 1, x + fx * dd, z + fz * dd, -1, ctx, F.layerDelay + flight * dd / Math.max(1, len), 1, face + (s % 2 ? 1.5708 : -1.5708), true); } };
  const nova = () => { if (nl !== 'nova') return; if (DIRECTIONAL.includes(N.d)) { const n = k ? LINK.nova.layerDirs : LINK.nova.dirs; for (let s = 0; s < n; s++) later(g, B, k + 1, x, z, -1, ctx, F.layerDelay, 1, face + s * 6.2832 / n, true); }
    else for (let s = 0; s < 3; s++) { const a = face + s * 2.0944; later(g, B, k + 1, x + sin(a) * LINK.nova.ring, z + cos(a) * LINK.nova.ring, -1, ctx, F.layerDelay, 1, a, true); } };
  const line = (len, w) => { const fx = ux(), fz = uz(); each(g, x + fx * len / 2, z + fz * len / 2, len / 2 + w, skip, j => { const ax = e.x[j] - x, az = e.z[j] - z, al = ax * fx + az * fz, pe = Math.abs(ax * fz - az * fx); if (al > -0.5 && al < len && pe < w) hit(g, B, k, j, ctx); });
    addFx(g, { type: 'bolt', owner: 0, el: L.el, x, y: y + 0.6, z, x2: x + fx * len, y2: y + 0.6, z2: z + fz * len, dur: 0.15, color: col, seed: (g.t * 60) | 0 }); };
  if (k === 0 && (d === 'bolt' || d === 'seeker' || d === 'lob')) {       // the summon's own shot: a real projectile that carries the cast with it
    if (aim(d === 'lob' ? R : R) < 0 && !fixed) return false;
    const dist = t >= 0 ? Math.sqrt((e.x[t] - x) ** 2 + (e.z[t] - z) ** 2) : R, tx = t >= 0 ? e.x[t] : x + ux() * R, tz = t >= 0 ? e.z[t] : z + uz() * R, ty = t >= 0 ? e.y[t] + 0.9 : y;
    const h = S0(g, ctx), dmg = q.dmg * B.mult * lvl * ctx.sc, c0 = g.curChain; ctx.B = B; g.curChain = h;
    if (d === 'bolt') { fireShot(g, KIND_FIRE, x, y, z, tx, ty, tz, q.speed, R / q.speed, dmg, { flame: el, pierce: q.pierce || 0 }); carry(R, R / q.speed); }
    else if (d === 'seeker' && t >= 0) { const hi = fireHoming(g, x, y, z, t, q.speed, 2.5, dmg); if (hi >= 0) g.shots.flame[hi] = el; carry(dist, dist / q.speed); }
    else { fireLob(g, x, y, z, tx, tz, q.flight || 0.7, dmg, (q.splash || 3) * sz, el); carry(dist, q.flight || 0.7); }
    g.curChain = c0; nova(); if (m) g.faceOf[m.id] = face; return { face };
  }
  if (d === 'bolt' || d === 'beam' || d === 'dash') { if (aim(R) < 0 && (me || !fixed && !k)) return false; const len = d === 'dash' ? Math.min(R, 8) : R; line(len, d === 'dash' ? 1.4 : 1.1); if (d !== 'beam') carry(len, 0); nova(); return { face }; }
  if (d === 'seeker') { if (aim(R * 1.4) < 0) return false; addFx(g, { type: 'bolt', owner: 0, el: L.el, x, y: y + 0.6, z, x2: e.x[t], y2: e.y[t] + 0.9, z2: e.z[t], dur: 0.15, color: col, seed: t }); hit(g, B, k, t, ctx); carry(Math.sqrt((e.x[t] - x) ** 2 + (e.z[t] - z) ** 2), 0.1); nova(); return { face }; }
  if (d === 'lob' || d === 'drop') { let tx, tz; if (aim(k ? 9 : R) >= 0) { tx = e.x[t]; tz = e.z[t]; } else if (fixed) { tx = x + ux() * 6; tz = z + uz() * 6; } else return false; const r = (q.splash || q.radius || 3) * sz, fl = d === 'drop' ? 0.3 : 0.35;
    fusionState(g).q.push({ t: g.t + fl, kind: 'burst', B, k, x: tx, z: tz, r, lvl, sc: ctx.sc, root: d === 'drop' ? 0.6 : 0 }); if (d === 'lob') carry(Math.sqrt((tx - x) ** 2 + (tz - z) ** 2), fl); nova(); return { face }; }
  if (d === 'mark') { const pick = []; each(g, x, z, k ? 8 : R, skip, (j, dx, dz) => { if (e.mark[j] <= 0) pick.push([dx * dx + dz * dz, j]); }); if (!pick.length) return false; pick.sort((a, b) => a[0] - b[0]);
    for (const [, j] of pick.slice(0, k ? 3 : q.marks)) { e.mark[j] = MARKS.duration + (g.mods ? g.mods.markDur : 0); addFx(g, { type: 'bolt', owner: 0, el: L.el, x, y: y + 0.4, z, x2: e.x[j], y2: e.y[j] + 0.9, z2: e.z[j], dur: 0.12, color: col, seed: j }); hit(g, B, k, j, ctx); } nova(); return { face }; }
  if (d === 'cone') { if (aim(R) < 0 && me) return false; const fx = ux(), fz = uz(), ca = cos((q.arc || 60) / 2 * 0.0174533);
    each(g, x, z, R, skip, (j, dx, dz) => { const dd = Math.sqrt(dx * dx + dz * dz) || 1; if ((dx * fx + dz * fz) / dd > ca) hit(g, B, k, j, ctx); }); addFx(g, { type: 'fan', owner: 0, el: L.el, x, y, z, r: R, arc: q.arc || 60, dx: fx, dz: fz, dur: 0.25, color: col }); nova(); return { face }; }
  if (d === 'pulse' || d === 'plant') { const r = (q.radius || 5) * sz; let any = false; each(g, x, z, r, skip, () => { any = true; }); if (!any && me) return false; addFx(g, { type: 'ring', owner: 0, el: L.el, x, y, z, r, dur: 0.35, color: col }); each(g, x, z, r, skip, j => hit(g, B, k, j, ctx)); nova(); return { face }; }
  // claws: from the summon, a real melee swipe in front with a lunge and a knock (a velocity, not a jump); as a later layer, phantom claws rake all round the point
  const C = F.claw, r = (k ? C.layerRange : C.range) * (B.size || 1), arc = k ? 6.3 : C.arc;
  if (!k) { if (aim(r + 0.6) < 0 && me) return false; if (m) { m.lunge = C.lunge; m.lungeX = ux(); m.lungeZ = uz(); g.faceOf[m.id] = face; } }
  const fx = ux(), fz = uz(), ca = cos(arc / 2);
  each(g, x, z, r, skip, (j, dx, dz) => { const dd = Math.sqrt(dx * dx + dz * dz) || 1; if (arc < 6.2 && (dx * fx + dz * fz) / dd < ca) return; hit(g, B, k, j, ctx, j === t ? 1 : 0.7); if (e.alive[j] && !e.ace[j]) knock(g, j, dx, dz, k ? C.layerKnock : C.knock); });
  if (!k) eachSpecial(g, x, z, r, sp => g.damageSpecial(sp, q.dmg * B.mult * lvl * ctx.sc, x, z, { elem: el }));
  addFx(g, arc < 6.2 ? { type: 'fan', owner: 0, el: L.el, x, y, z, r, arc: arc * 57.2958, dx: fx, dz: fz, dur: 0.2, color: col } : { type: 'ring', owner: 0, el: L.el, x, y, z, r, dur: 0.25, color: col });
  if (!k) g.emit('swipe', x, z, 0);
  nova(); return { face };
}
function S0(g, H) { const S = fusionState(g), h = S.ci; S.casts[h] = H; S.ci = (S.ci + 1) % 256; return h; }

// ---- a summon that is a Fusion attacks by the rule, with its forms. Returns false when it found nothing to hit (it tries again next tick).
export function fusionAttack(g, m) {
  const B = buildOf(m.id), Fm = B.forms, lvl = lvlOf(m), d = B.chain[0].d, dir = DIRECTIONAL.includes(d), x = m.x, y = m.y - 0.6, z = m.z; let r;
  if (Fm.includes('Spiral')) { if (nearestTo(g, x, z, 30, -1) < 0) return false; const f = g.t * FORM.Spiral.turn; r = dir && d !== 'dash' ? cast(g, B, 0, x, y, z, -1, lvl, m, f, true) : cast(g, B, 0, x + sin(f) * 4, y, z + cos(f) * 4, -1, lvl, null, f, true); }       // a constant turning stream
  else r = cast(g, B, 0, x, y, z, -1, lvl, m);
  if (!r) return false; const f = r.face;
  if (Fm.includes('Volley')) for (const s of [-1, 1]) { if (dir) cast(g, B, 0, x, y, z, -1, lvl, null, f + s * FORM.Volley.spread, true, FORM.Volley.scale); else cast(g, B, 0, x + cos(f) * s * FORM.Volley.side, y, z - sin(f) * s * FORM.Volley.side, -1, lvl, null, f, false, FORM.Volley.scale); }       // three wide
  if (Fm.includes('Mirror')) { const px = x + sin(f) * FORM.Mirror.dist, pz = z + cos(f) * FORM.Mirror.dist; addFx(g, { type: 'ring', owner: 0, el: 'dark', x: px, y: heightAt(px, pz) + 0.3, z: pz, r: 1.4, dur: 0.3, color: 0xb26bff }); cast(g, B, 0, px, heightAt(px, pz) + 1.6, pz, -1, lvl, null, f + 3.1416, false, FORM.Mirror.scale); }       // a phantom twin behind the crowd copies it
  if (Fm.includes('Storm')) { const list = []; each(g, x, z, 30, -1, j => list.push(j)); for (let s = 0; s < FORM.Storm.n && list.length; s++) { const j = list[Math.floor(g.rc() * list.length) % list.length], e = g.en; cast(g, B, 0, e.x[j] + (g.rc() - 0.5) * 3, e.y[j] + 6, e.z[j] + (g.rc() - 0.5) * 3, -1, lvl, null, g.rc() * 6.2832, dir, FORM.Storm.scale); } }       // it also falls from the sky on three enemies
  if (Fm.includes('Orbit') && B.chain.length > 1) for (let s = 0; s < FORM.Orbit.n; s++) { const a = g.t * 1.8 + s * 2.0944, px = m.x + sin(a) * FORM.Orbit.r, pz = m.z + cos(a) * FORM.Orbit.r; if (nearestTo(g, px, pz, 14, -1) >= 0) cast(g, B, 1, px, m.y, pz, -1, lvl, null, a, false, FORM.Orbit.scale); }       // three satellites fire the later layers
  return true;
}
export const fusionCd = m => buildOf(m.id).cd;

// ---- the show-stopper meter and its moves ----
function stoppers(g, S) {
  const els = [], f = g.field; let P = 0, rank = 1;
  for (const m of f.monsters) { if (!m || !FUSIONS[m.id]) continue; const B = buildOf(m.id); P = Math.max(P, B.chain[0].q.dmg * B.mult * lvlOf(m) * F.stopperMul); rank = Math.max(rank, B.rank); for (const e of B.els) if (!els.includes(e)) els.push(e); }
  if (!els.length) return false;
  S.meter = 0; S.stoppers++; S.stopperNames = els.map(e => STOPPERS[e]); g.event('banner', S.stopperNames.join(' + ')); g.emit('stopper');
  S.stopUntil = g.t + 0.35 + els.length * F.stopperGap + 1;
  els.forEach((el, n) => S.q.push({ t: g.t + 0.35 + n * F.stopperGap, kind: 'stopper', el, P, rank }));
  return true;
}
function hurtAll(g, x, z, r, n, el, then) { const e = g.en; each(g, x, z, r, -1, (j, dx, dz) => { damageEnemy(g, j, n, { elem: bit(el), noChain: true }); if (e.alive[j] && then) then(j, dx, dz); }); eachSpecial(g, x, z, r, sp => g.damageSpecial(sp, n, x, z, { area: true, elem: bit(el) })); }
function stopperMove(g, S, ev) {
  const p = g.p, e = g.en, el = ev.el, P = ev.P, col = COL[el], ring = (x, z, r) => addFx(g, { type: 'ring', owner: 0, el, x, y: heightAt(x, z) + 0.3, z, r, dur: 0.5, color: col });
  const randomEnemy = () => { const list = []; each(g, p.x, p.z, 30, -1, j => list.push(j)); return list.length ? list[Math.floor(g.rc() * list.length) % list.length] : -1; };
  if (el === 'fire') for (let j = 0; j < 7 + ev.rank * 2; j++) S.q.push({ t: g.t + j * 0.13, kind: 'hitAt', el, n: P, r: 4.5, pick: 1 });       // Meteor Rain
  else if (el === 'ice') for (let w = 0; w < 3; w++) S.q.push({ t: g.t + w * 0.28, kind: 'ringAt', el, n: P, R: 5 + w * 5.5, root: 2.5 });       // Glacier
  else if (el === 'lightning') for (let j = 0; j < 10 + ev.rank * 2; j++) S.q.push({ t: g.t + j * 0.1, kind: 'hitAt', el, n: P * 1.2, r: 2.5, pick: 1, mark: 1 });       // Thunderstorm
  else if (el === 'poison') { S.zones.push({ x: p.x, z: p.z, r: 11, t: 5, dps: P * 0.5, el, B: null, lvl: 1 }); ring(p.x, p.z, 11); each(g, p.x, p.z, 11, -1, j => { S.venom[j] = Math.max(S.venom[j], 10); S.el[j] |= bit('poison'); S.elT[j * 8 + EI.poison] = F.poisonT; track(S, j); }); }       // Plague Bloom
  else if (el === 'wind') { each(g, p.x, p.z, 24, -1, (j, dx, dz) => knock(g, j, -dx + dz * 0.6, -dz - dx * 0.6, 14)); S.q.push({ t: g.t + 1.2, kind: 'ringAt', el, n: P * 1.5, R: 0, r: 8, knock: 12 }); }       // Cyclone: drawn in, then blown out
  else if (el === 'earth') { const a0 = g.rc() * 6; for (let l = 0; l < 5; l++) for (let s = 0; s < 10; s++) S.q.push({ t: g.t + s * 0.05, kind: 'hitAt', el, n: P * 1.3 / 3, r: 2.4, x: p.x + sin(a0 + l * 1.2566) * (2.5 + s * 1.9), z: p.z + cos(a0 + l * 1.2566) * (2.5 + s * 1.9), root: 2 }); }       // Faultline
  else if (el === 'light') { const a0 = g.faceYaw || 0; for (let j = 0; j < 18; j++) S.q.push({ t: g.t + j * 0.07, kind: 'beamAt', el, n: P * 0.8, a: a0 + j * 0.349 }); }       // Sunlance
  else { each(g, p.x, p.z, 30, -1, j => { S.el[j] |= bit('dark'); S.elT[j * 8 + EI.dark] = 6; track(S, j); }); S.q.push({ t: g.t + 1, kind: 'ringAt', el, n: P * 1.5, R: 0, r: 26, pull: 1 }); }       // Eclipse
  void e; void randomEnemy;
}
function runEvent(g, S, ev) {
  const p = g.p, e = g.en;
  if (ev.kind === 'layer') { cast(g, ev.B, ev.k, ev.x, heightAt(ev.x, ev.z) + 1, ev.z, ev.skip, ev.lvl, null, ev.face, ev.fixed, ev.sc); return; }
  if (ev.kind === 'burst') { const ctx = { lvl: ev.lvl, sc: ev.sc || 1, per: [] }; addFx(g, { type: 'ring', owner: 0, el: ev.B.chain[ev.k].el, x: ev.x, y: heightAt(ev.x, ev.z) + 0.3, z: ev.z, r: ev.r, dur: 0.35, color: COL[ev.B.chain[ev.k].el] }); each(g, ev.x, ev.z, ev.r, -1, j => { if (ev.root) e.root[j] = Math.max(e.root[j], ev.root); hit(g, ev.B, ev.k, j, ctx); }); return; }
  if (ev.kind === 'stopper') { stopperMove(g, S, ev); return; }
  let x = ev.x, z = ev.z;
  if (ev.pick) { const list = []; each(g, p.x, p.z, 30, -1, j => list.push(j)); if (!list.length) return; const j = list[Math.floor(g.rc() * list.length) % list.length]; x = e.x[j]; z = e.z[j]; if (ev.mark) e.mark[j] = MARKS.duration; }
  if (ev.kind === 'hitAt') { addFx(g, { type: 'ring', owner: 0, el: ev.el, x, y: heightAt(x, z) + 0.3, z, r: ev.r, dur: 0.4, color: COL[ev.el] }); hurtAll(g, x, z, ev.r, ev.n, ev.el, ev.root ? j => { e.root[j] = Math.max(e.root[j], ev.root); } : null); return; }
  if (ev.kind === 'ringAt') { const R = ev.R, r = ev.r || R + 3;
    addFx(g, { type: 'ring', owner: 0, el: ev.el, x: p.x, y: p.y + 0.3, z: p.z, r: R || r, dur: 0.45, color: COL[ev.el] });
    hurtAll(g, p.x, p.z, r, ev.n, ev.el, (j, dx, dz) => { if (R) { const d = Math.sqrt(dx * dx + dz * dz); if (Math.abs(d - R) > 3) return; } if (ev.root) e.root[j] = Math.max(e.root[j], ev.root); if (ev.knock) knock(g, j, dx, dz, ev.knock); if (ev.pull) knock(g, j, -dx, -dz, 10); }); return; }
  if (ev.kind === 'beamAt') { const ux = sin(ev.a), uz = cos(ev.a); addFx(g, { type: 'bolt', owner: 0, el: ev.el, x: p.x, y: p.y + 1, z: p.z, x2: p.x + ux * 24, y2: p.y + 1, z2: p.z + uz * 24, dur: 0.18, color: COL[ev.el], seed: (ev.a * 100) | 0 });
    each(g, p.x + ux * 12, p.z + uz * 12, 13.8, -1, j => { const ax = e.x[j] - p.x, az = e.z[j] - p.z, al = ax * ux + az * uz, pe = Math.abs(ax * uz - az * ux); if (al > 0 && al < 24 && pe < 1.8) damageEnemy(g, j, ev.n, { elem: bit(ev.el), noChain: true }); }); }
}

// ---- the tick: queued layers and moves, statuses, zones, knocks, the meter ----
const tmp = { x: 0, y: 0, z: 0 };
export function fusionTick(g, dt) {
  const S = fusionState(g), e = g.en;
  S.bank = Math.min(F.reactPerSec, S.bank + F.reactPerSec * dt); S.fling = Math.max(0, S.fling - 6 * dt); if (S.loopCd > 0) S.loopCd -= dt;
  if (S.q.length) { const due = S.q.filter(v => v.t <= g.t); if (due.length) { S.q = S.q.filter(v => v.t > g.t); for (const v of due) runEvent(g, S, v); } }
  // statuses and knocks, on the enemies that carry any
  let w = 0;
  for (let n = 0; n < S.act.length; n++) {
    const i = S.act[n];
    if (!e.alive[i]) { clear(S, i); continue; }
    if (S.rc[i] > 0) S.rc[i] -= dt;
    for (let k = 0; k < 8; k++) { const o = i * 8 + k; if (S.elT[o] > 0) { S.elT[o] -= dt; if (S.elT[o] <= 0) { S.el[i] &= ~(1 << k); if (k === EI.poison) S.venom[i] = 0; } } }
    if (S.venom[i] > 0 && (S.el[i] & bit('poison'))) { S.venomAcc[i] += S.venom[i] * F.venom * dt; if (S.venomAcc[i] >= 1) { const v = S.venomAcc[i]; S.venomAcc[i] = 0; damageEnemy(g, i, v, { noCrit: true, elem: bit('poison') }); if (!e.alive[i]) { clear(S, i); continue; } } }
    if (S.kvx[i] || S.kvz[i]) { tmp.x = e.x[i]; tmp.y = e.y[i]; tmp.z = e.z[i]; moveXZ(tmp, S.kvx[i] * dt, S.kvz[i] * dt, KIND_LIST[e.kind[i]].radius, CFG.enemy.stepUp); e.x[i] = tmp.x; e.z[i] = tmp.z;
      { const v2 = S.kvx[i] * S.kvx[i] + S.kvz[i] * S.kvz[i]; if (v2 > 36 && g.colliders) { const c = solidAt(g.colliders, e.x[i], e.z[i], KIND_LIST[e.kind[i]].radius); if (c) { const v = Math.sqrt(v2); if (c.brk) smashProps(g, e.x[i], e.z[i], KIND_LIST[e.kind[i]].radius + 0.2); else { S.kvx[i] *= -0.3; S.kvz[i] *= -0.3; g.emit('slam', e.x[i], e.z[i], v); } damageEnemy(g, i, 4 + v * 0.6, { noChain: true, noCrit: true }); if (!e.alive[i]) { clear(S, i); continue; } } } }       // weight: an enemy thrown into a prop breaks it, thrown into rock it stops dead; both hurt
      const f = Math.max(0, 1 - F.knockDecay * dt); S.kvx[i] *= f; S.kvz[i] *= f; if (S.kvx[i] * S.kvx[i] + S.kvz[i] * S.kvz[i] < 0.04) S.kvx[i] = S.kvz[i] = 0; }
    if (!S.el[i] && !S.kvx[i] && !S.kvz[i] && S.rc[i] <= 0) { S.on[i] = 0; continue; }
    S.act[w++] = i;
  }
  S.act.length = w;
  // ground zones: an enemy standing in several takes only the strongest; they hurt four times a second
  if (S.zones.length) { S.zoneT -= dt; for (const zn of S.zones) zn.t -= dt; S.zones = S.zones.filter(zn => zn.t > 0);
    if (S.zoneT <= 0) { S.zoneT = 0.25; S.tick++; S.zones.sort((a, b) => b.dps - a.dps);
      for (const zn of S.zones) each(g, zn.x, zn.z, zn.r, -1, j => { if (S.zn[j] === S.tick) return; S.zn[j] = S.tick; damageEnemy(g, j, zn.dps * 0.25, { noCrit: true, elem: bit(zn.el), noChain: true }); if (e.alive[j] && zn.B && !(S.el[j] & bit(zn.el))) status(g, j, zn.el, zn.B, 1, zn.lvl); }); } }
  // the meter: kills fill it (an elite counts more); full, it fires once a Fusion is on the field
  const dk = (g.kills | 0) - S.kills0, de = (g.elitesKilled | 0) - S.elites0; S.kills0 = g.kills | 0; S.elites0 = g.elitesKilled | 0;
  if (S.stopUntil > g.t) return;       // the meter stays empty while the moves play out
  if (dk > 0 || de > 0) S.meter = Math.min(F.meter, S.meter + Math.max(0, dk) + Math.max(0, de) * (F.meterElite - 1));
  if (S.meter >= F.meter) stoppers(g, S);
}
// the summon's lunge, for the view: how far forward it is thrown right now (0 to 1)
export const lungeOf = m => m.lunge > 0 ? sin(3.14159265 * (1 - m.lunge / F.claw.lunge)) : 0;
export const applyStatus = (g, i, el, B, lvl) => status(g, i, el, B, 0, lvl || 1);       // for the tests
