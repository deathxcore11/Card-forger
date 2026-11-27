// Bots for the big desert, to tune the door and the first runs. Two players:
//   newbie  a first-timer: starter pools, goes toward what it can see (the nearest pocket, a mesa to climb), notices the door only when it can see it (a clear line within 200 m, or the red wind within 90 m, or the fog has shown it), simple dodging
//   skilled a practised player: knows the door's place the moment it rises, farms pockets and sleepers meanwhile
//   rail | meteor | seal  riders with a build (Rail Dragon grinds, Meteor big air and slams, Seal Runner seal lines and marks); reckless tricks through everything; walker never rides (the control group)
// usage: node tools/bigbot.mjs <runs> [--player newbie|skilled|rail|meteor|seal|reckless|walker] [--seed0 N] [--stage1] [--full] [--unlocked] [--difficulty easy|medium|hard] [--maxmin N] [--json]
//   --stage1  stop a run when the door is woken or the clock hits 12:00 (door-find rate); default plays the whole stage; --full all stages
//   --unlocked the first 10 runs' unlocks (about 40 items and 8 boons) instead of a fresh save
import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from './bot.mjs';
import { simMeta, defaultMeta } from '../src/core/meta.js';
import { heightAt } from '../src/sim/terrain.js';
import { exploredAt } from '../src/sim/fog.js';
import { DIFFICULTY } from '../src/data/stages.js';
import { DOOR } from '../src/sim/door.js';
import { railsNear, sealsNear } from '../src/sim/rails.js';
import { arenaSealSpots } from '../src/sim/world.js';
const BUILDS = { rail: ['ember-wyvern', 'kindling-rite', 'twinflare-tyrant', 'pack-drill', 'rails', 'poise', 'ruin-chalk'], meteor: ['cinder-hatchling', 'elemental-litany', 'widening-rite', 'heart-of-the-cards', 'pop', 'quake', 'dune-kite'],
  seal: ['rune-apprentice', 'sigil-familiar', 'astral-magus', 'deep-marks', 'pit-of-seals', 'flowkeep'], reckless: ['ember-wyvern', 'cinder-hatchling', 'swift-draw', 'whirl'] };
const RIDERS = ['rail', 'meteor', 'seal', 'reckless'];
// (near the door, and in the gate fight, the bot steps off and fights on foot: its fighting moves are the walker's)
// the riding layer: kick the card out, steer where the walking bot wanted to go, and trick by build; its own counter, never the sim's streams
function rider(g, bot, c) {
  const p = g.p, r = p.ride, build = PLAYER; bot.k = (bot.k || 0) + 1;
  if (g.gate.state === 'fight' && (build === 'seal' || build === 'rail') && g.arenaSeal && !(g.arenaSeal.cd > 0)) { const S = arenaSealSpots(g); let b = null, bd = 1e9; S.forEach((s, k) => { if (g.arenaSeal.lit[k]) return; const d = Math.hypot(s[0] - p.x, s[2] - p.z); if (d < bd) { bd = d; b = s; } }); if (b) { const dx = b[0] - p.x, dz = b[2] - p.z, dl = Math.hypot(dx, dz) || 1; c.yaw = 0; c.f = -dz / dl; c.r = dx / dl; c.slide = false; c.jump = false; return; } }       // in the gate fight, a seal or rail build goes round the arena's seal stones
  if (g.gate.state === 'fight' || (bot.doorKnown && g.gate.state === 'closed' && Math.hypot(g.map.gate.x - p.x, g.map.gate.z - p.z) < 45)) { if (r && r.on) { c.yaw = 0; c.r = -Math.sin(r.heading); c.f = Math.cos(r.heading); c.jump = false; c.dash = false; c.slide = false; } else c.slide = false; return; }       // near the door: brake off the card and walk in to wake it
  if (!r || !r.on) { c.slide = (bot.k % 50) === 40 && !c.dash; return; }       // after a moment of running, SLIDE kicks the card out
  c.slide = false; c.dash = false; c.use = false;
  if (!bot.doorKnown && g.door && g.door.state === 'risen' && seesDoor(g)) bot.doorKnown = true;       // a rider keeps its eyes open every tick
  if (!bot.doorKnown && g.door && g.door.state === 'risen' && g.gate.state === 'closed' && p.grounded && !r.grind) {       // the banner and rumble said a door rose 150 to 300 m away: search in widening loops round where it fired
    if (!bot.search) { const W = []; let a0 = Math.atan2(p.vz, p.vx); for (const R of [150, 225, 300]) for (let k = 0; k < 8; k++) { const a = a0 + k * Math.PI / 4; W.push([p.x + Math.cos(a) * R, p.z + Math.sin(a) * R]); } bot.search = { W, i: 0 }; }
    const S = bot.search; while (S.i < S.W.length && Math.hypot(S.W[S.i][0] - p.x, S.W[S.i][1] - p.z) < 30) S.i++; if (S.i < S.W.length) { const dx = S.W[S.i][0] - p.x, dz = S.W[S.i][1] - p.z, dl = Math.hypot(dx, dz) || 1; c.yaw = 0; c.f = -dz / dl; c.r = dx / dl; }
  }
  if (bot.doorKnown && g.gate.state === 'closed' && p.grounded && !r.grind) { const dx = g.map.gate.x - p.x, dz = g.map.gate.z - p.z, dl = Math.hypot(dx, dz) || 1; c.yaw = 0; c.f = -dz / dl; c.r = dx / dl; c.jump = false; return; }       // the door is known: no more tricks, ride straight to it       // the door is known: no more tricks, ride straight to it
  if (r.grind) { c.yaw = 0; c.f = 0; c.r = Math.max(-1, Math.min(1, r.bal * 3)); c.jump = r.grind.time > (build === 'rail' ? 2.5 : 0.8); return; }       // ride the rail, keep the balance, hop off
  if (p.grounded || r.grind) c.yaw = 0;
  if (p.grounded) {
    bot.air = 0;
    const late = g.sc > 480;       // after 8:00 the build bots go for the door like anyone (their own targets only before)
    c.f = Math.max(c.f, -0.6);       // the bot never flicks the stick back (that is a manual)
    if (build === 'rail' && !bot.railT && !late) { const L = railsNear(g, p.x, p.z, 14); if (L.length) { const s = L[0], mx = (s[0] + s[3]) / 2, mz = (s[2] + s[5]) / 2, dx = mx - p.x, dz = mz - p.z, dl = Math.hypot(dx, dz) || 1; c.f = -dz / dl; c.r = dx / dl; if (dl < 5) { bot.railT = 12; } } }
    const risen = g.door && g.door.state === 'risen' && g.gate.state === 'closed';       // the rise banner fired: seals only to finish a set whose next stone is within 60 m
    if (build === 'seal' && !late) { const S = sealsNear(g, p.x, p.z, 60).filter(q => !(g.rideLit && g.rideLit.sealsDone[q[3]]) && (!risen || (r.sealRun && r.sealRun[q[3]] && r.sealRun[q[3]].k.length > 0))); if (S.length) { let b = S[0], bd = 1e9; for (const q of S) { const d = Math.hypot(q[0] - p.x, q[2] - p.z); if (d < bd && d > 1) { bd = d; b = q; } } const dx = b[0] - p.x, dz = b[2] - p.z, dl = Math.hypot(dx, dz) || 1; c.f = -dz / dl; c.r = dx / dl; } }
    if (bot.railT > 0) { bot.railT--; c.jump = bot.railT > 4; return; }       // a short crouch and pop up onto the rail (it snaps on as the card comes down)
    const every = build === 'meteor' ? 70 : build === 'reckless' ? 45 : 90, crouch = build === 'meteor' ? 30 : build === 'reckless' ? 12 : 24; const ph = bot.k % every; c.jump = ph < crouch;
    return;
  }
  bot.air = (bot.air || 0) + 1; c.yaw = r.heading + Math.PI; c.r = 0; c.f = 1; c.jump = false;       // in the air: the camera behind the card, the stick forward (no stray spin)
  if (build === 'rail' || build === 'seal') { c.dash = bot.air === 6 && p.vy > 5; }       // flip only off a real pop (enough air to finish it)
  else if (build === 'meteor') { c.dash = bot.air === 5; c.slide = bot.air > 16 && bot.air < 26 && p.vy > -6; }
  else { c.dash = bot.air === 4 || bot.air === 22; c.slide = bot.air > 8 && bot.air < 40; }       // reckless: two flips and a long grab, often into the ground
}

const argv = process.argv.slice(2), flag = f => argv.includes(f), val = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const RUNS = Number(argv.find(a => /^\d+$/.test(a)) || 20), PLAYER = val('--player', 'newbie'), SEED0 = Number(val('--seed0', 1000)), DIF = val('--difficulty', 'easy'), MAXMIN = Number(val('--maxmin', 14));
const STAGE1 = flag('--stage1'), FULL = flag('--full'), UNLOCKED = flag('--unlocked'), JSON_OUT = flag('--json');

function metaFor() {
  const m = defaultMeta();
  if (UNLOCKED) { m.stagesOpen = FULL ? 3 : 1; for (const id of ['hunters-mark', 'traders-seal', 'sharpened-edge', 'stacked-deck', 'summoners-chalk', 'field-banner', 'leather-vest', 'waterskin', 'herb-pouch', 'spyglass', 'iron-filings', 'treasure-sack', 'rabbit-foot', 'vampire-fang', 'echo-bell', 'last-stand', 'second-breath', 'level-spark']) if (!m.unlockedItems.includes(id)) m.unlockedItems.push(id); for (const b of ['fortune', 'precision', 'plunder', 'haste']) m.unlockedBoons.push(b); for (const k of [6, 8]) m.unlockedPickups.push(k); m.duelists.push('mira'); }
  else if (FULL) m.stagesOpen = 3;
  if (RIDERS.includes(PLAYER) || PLAYER === 'walker') { for (const id of Object.keys(CARDS_ALL)) if (!m.unlockedCards.includes(id)) m.unlockedCards.push(id); for (const id of Object.keys(ITEMS_ALL)) if (!m.unlockedItems.includes(id)) m.unlockedItems.push(id); for (const b of Object.keys(BOONS_ALL)) if (!m.unlockedBoons.includes(b)) m.unlockedBoons.push(b); }       // the build bots all play with everything open, so builds compare fairly
  if (PLAYER === 'skilled') { m.stagesOpen = 3; for (const id of Object.keys(ITEMS_ALL)) if (!m.unlockedItems.includes(id)) m.unlockedItems.push(id); for (const b of Object.keys(BOONS_ALL)) if (!m.unlockedBoons.includes(b)) m.unlockedBoons.push(b); for (let k = 2; k <= 11; k++) if (!m.unlockedPickups.includes(k)) m.unlockedPickups.push(k); }
  return simMeta(m);
}
import { ITEMS as ITEMS_ALL, BLESSINGS as BOONS_ALL } from '../src/data/items.js';
import { MONSTERS as M_ALL, FUSIONS as F_ALL, SPELLS as S_ALL, TRAPS as T_ALL } from '../src/data/cards.js';
const CARDS_ALL = { ...M_ALL, ...S_ALL, ...T_ALL };

// a tiny generator of its own, so the bot never touches the sim's streams
const lcg = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
function seesDoor(g) {                                  // the first-timer's eyes: a clear line to the door from the duelist's eyes within 200 m, or the fog has shown it, or the red wind (90 m)
  const d = g.door, p = g.p; if (!d || d.state !== 'risen') return false;
  const dx = d.x - p.x, dz = d.z - p.z, L = Math.sqrt(dx * dx + dz * dz); if (L < (p.ride && p.ride.on ? 160 : 90)) return true; if (exploredAt(g.fog, d.x, d.z)) return true; if (L > 200) return false;
  const ey = p.y + 1.7, ty = heightAt(d.x, d.z) + 7, n = Math.max(4, Math.floor(L / 6));
  for (let k = 1; k < n; k++) { const t = k / n, h = heightAt(p.x + dx * t, p.z + dz * t); if (h >= 50 || h > ey + (ty - ey) * t + 0.3) return false; }
  return true;
}
function goalFn(g, bot) {
  const p = g.p, d = g.door; if (!d) return null; const W = g.world;
  if (d.state === 'risen' && g.gate.state === 'closed') {
    const known = PLAYER === 'skilled' || bot.doorKnown || (bot.doorKnown = seesDoor(g)); if (known) { const dist = Math.hypot(g.map.gate.x - p.x, g.map.gate.z - p.z); return { t: { x: g.map.gate.x, z: g.map.gate.z }, hold: dist < 3.5 }; }
  }
  // the nearest pocket not yet used: a free thing to open or break, within 220 m (a first-timer goes toward what it sees)
  if (PLAYER === 'skilled' && p.hp > p.maxHp * 0.8 && g.level >= 12 && g.sc < 440 && d.state === 'hidden') { let sl = null, sd = 1e12; for (const q of g.sp) if (q.alive && !q.dead && q.asleep) { const dd = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (dd < sd) { sd = dd; sl = q; } } if (sl) return { t: { x: sl.x, z: sl.z }, hold: false }; }       // a practised player fells the sleepers early: each makes the door rise 30 s sooner
  const R2 = (PLAYER === 'skilled' ? 320 : 180) ** 2; let best = null, bd = R2; const consider = o => { const dd = (o.x - p.x) ** 2 + (o.z - p.z) ** 2; if (dd < bd && !(bot.skip && bot.skip.has(o))) { bd = dd; best = o; } };
  for (const c of W.cchests) if (!c.open && (c.free || g.coins >= 30)) consider(c);
  for (const s of W.stones) if (!s.used) consider(s); for (const s of W.shrines) if (!s.done) consider(s); if (PLAYER === 'pusher') for (const s of W.wagers) if (!s.used) consider(s);       // the pusher takes every Wager Shrine it sees; the newbie never does
  for (const v of W.vases) if (v.alive) { const dd = (v.x - p.x) ** 2 + (v.z - p.z) ** 2; if (dd < (best ? 225 : bd * 0.5) && (!best || dd < bd * 0.1)) { best = v; bd = dd * 2; } }       // a vase is worth a detour only when nothing bigger is near
  if (best) { if (!bot.skip) bot.skip = new Set(); bot.visit = (bot.visit || 0) + 1; const near = Math.hypot(best.x - p.x, best.z - p.z) < 3.5; if (near) { bot.stay = (bot.stay || 0) + 1; if (bot.stay > 70) { bot.skip.add(best); bot.stay = 0; } } else bot.stay = 0; return { t: { x: best.x, z: best.z }, hold: near && !!best.charge !== undefined }; }
  // nothing in sight: walk on, turning now and then, leaning toward ground not yet seen
  if (!bot.rng) { bot.rng = lcg(SEED0 + g.seed); bot.hd = bot.rng() * 6.283; bot.hdT = 0; }
  if (g.tickN - bot.hdT > 60 * 14 || (bot.lastX !== undefined && Math.hypot(p.x - bot.lastX, p.z - bot.lastZ) < 0.5 && g.tickN - bot.hdT > 120)) { bot.hdT = g.tickN; let bestA = bot.hd, bestS = -1; for (let k = 0; k < 6; k++) { const a = bot.rng() * 6.283; let s = 0; for (const r of [60, 120, 180]) if (!exploredAt(g.fog, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r)) s++; s += bot.rng() * 0.5; if (s > bestS) { bestS = s; bestA = a; } } bot.hd = bestA; }
  bot.lastX = p.x; bot.lastZ = p.z;
  return { t: { x: p.x + Math.cos(bot.hd) * 150, z: p.z + Math.sin(bot.hd) * 150 }, hold: false };
}

// tuning knobs for sweeps: --spawn --hp --dmg --boss multiply the chosen difficulty's numbers for this process only
for (const k of ['spawn', 'hp', 'dmg', 'boss', 'ramp']) if (argv.includes('--' + k)) DIFFICULTY[DIF][k] *= Number(val('--' + k, 1));
if (argv.includes('--hid')) DOOR.hiddenChance = Number(val('--hid', 0.6)); if (argv.includes('--near')) DOOR.near = Number(val('--near', 150)); if (argv.includes('--far')) DOOR.far = Number(val('--far', 300));
const TABLE = flag('--table'), tab = Array.from({ length: 13 }, () => ({ n: 0, lv: 0, items: 0, chests: 0, boons: 0, enemies: 0, maxEn: 0, lvUps: 0, shrines: 0, kills: 0 }));
const EL = flag('--elite'), ELT = {}, aceT = new Map(); const addEl = (k, v) => (ELT[k] || (ELT[k] = [])).push(v);
const TL = flag('--timeline'), TLrows = [], TLprev = {};
const rows = [];
for (let r = 0; r < RUNS; r++) {
  const seed = SEED0 + r, w0 = Date.now(), g = new Game(seed, { mode: 'run', duelist: 'kael', difficulty: DIF, terrain: 'open', meta: metaFor() }), bot = newBot({ focus: false, world: true }); bot.goalFn = goalFn; if (RIDERS.includes(PLAYER)) { bot.rider = rider; g._prefer = BUILDS[PLAYER]; } if (PLAYER === 'walker') g.opts.noRide = true; bot.why = {}; g.killBy = {}; { const ev = g.event.bind(g); g.event = (ty, d) => { if (ty === 'bailed') { bot.why[d] = (bot.why[d] || 0) + 1; if (process.env.DBG && d === 'angle' && (bot.dbgN = (bot.dbgN || 0) + 1) < 6) console.error('angle', JSON.stringify(bot.cmd), bot.air, g.p.ride.heading.toFixed(2)); } return ev(ty, d); }; } bot.noGateSense = PLAYER !== 'skilled'; g.skilledBuild = PLAYER === 'skilled';
  let ticks = 0, wokeAt = null, wokeDist = null, clearedAt = null, deadAt = null, doorAt = null; const stageMax = FULL ? g.stages.length : 1;
  while (!g.over && ticks < MAXMIN * 3600 * 4) {
    g.tick(botRecord(g, bot)); ticks++; if (process.env.DBGD && g.door && g.door.state === 'risen') { const dd = Math.hypot(g.map.gate.x - g.p.x, g.map.gate.z - g.p.z); if (bot.minD === undefined || dd < bot.minD) bot.minD = dd; if (bot.riseD === undefined) bot.riseD = Math.round(dd); } if (g.stage === 0) for (const [k, s] of [['lv4', 240], ['lv8', 480], ['lv12', 719]]) if (bot[k] === undefined && g.sc >= s) bot[k] = g.level; if (g.p.ride && g.p.ride.on) bot.rideT = (bot.rideT || 0) + 1; if (g.p.ride && g.p.ride.bailT > 0 && !bot.inBail) { bot.bails = (bot.bails || 0) + 1; bot.inBail = true; } else if (g.p.ride && g.p.ride.bailT <= 0) bot.inBail = false;
    if (EL && g.stage === 0) { for (const q of g.sp) { if (q.asleep) continue; if (q._w === undefined) q._w = g.sc; if ((!q.alive || q.dead) && !q._d) { q._d = 1; addEl(q.role || 'gate', g.sc - q._w); } } if (ticks % 6 === 0) { const e = g.en; for (let i = 0; i < e.max; i++) { if (e.ace[i] && e.alive[i]) { const k = r * 1000 + i; if (!aceT.has(k)) aceT.set(k, g.sc); } else if (aceT.size) { const k = r * 1000 + i; if (aceT.has(k)) { addEl('ace', g.sc - aceT.get(k)); aceT.delete(k); } } } } }
    if (TL && g.stage === 0 && ticks % 600 === 0 && g.sc < 540) { const W = g.world, st = { t: Math.round(g.sc), surge: g.surgeP && g.surgeP.on ? 1 : 0, lv: g.levelUps, chests: g.chestsOpenedTotal, shrines: W.shrines.filter(x => x.done).length, stones: W.stones.filter(x => x.used).length, items: g.items.length }; const pr = TLprev[r] || (TLprev[r] = { lv: 0, chests: 0, shrines: 0, stones: 0, items: 0 }); TLrows.push([r, st.t, st.surge, st.lv - pr.lv, st.chests - pr.chests, st.shrines + st.stones - pr.shrines - pr.stones, st.items - pr.items]); TLprev[r] = st; }
    if (TABLE && g.stage === 0 && ticks % 60 === 0) { const m = Math.floor(g.sc / 60); if (m < 13) { const t = tab[m]; if (!t.cur || t.cur !== r + 1) { t.cur = r + 1; t.n++; t.lv += g.level; t.items += g.items.length; t.chests += g.chestsOpenedTotal; t.boons += g.blessings.length; t.kills += g.kills; t.lvUps += g.levelUps; t.stakes = (t.stakes || 0) + (g.stakes || 0); } let en = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) en++; t.enemies += en; t.maxEn = Math.max(t.maxEn, en); t.samples = (t.samples || 0) + 1; } }
    if (doorAt === null && g.door && g.door.state === 'risen') doorAt = Math.round(g.sc);
    if (wokeAt === null && g.gate.state === 'fight') { wokeAt = Math.round(g.sc); wokeDist = g.door ? g.door.dist : 0; if (STAGE1) break; }
    if (g.stagesCleared >= stageMax && g.stage + (g.gate.state === 'done' ? 1 : 0) >= stageMax) { clearedAt = Math.round(g.scTotal + g.sc); }
    if (g.won || g.ended || g.gate.state === 'done' && g.stage + 1 >= stageMax) { clearedAt = clearedAt || Math.round(g.scTotal + g.sc); break; }
    if (STAGE1 && g.sc >= 720) break;
    if (g.scTotal + g.sc > MAXMIN * 60) break;
  }
  if (g.over) deadAt = Math.round(g.scTotal + g.sc);
  if (process.env.DBGD) console.error(JSON.stringify({ seed, door: g.door && g.door.state, known: !!bot.doorKnown, minD: Math.round(bot.minD), riseD: bot.riseD, dist: g.door && g.door.state === 'risen' ? Math.round(Math.hypot(g.map.gate.x - g.p.x, g.map.gate.z - g.p.z)) : null, riding: !!(g.p.ride && g.p.ride.on), sc: Math.round(g.sc), gate: g.gate.state, over: g.over }));
  rows.push({ deathAt: g.over ? Math.round(g.sc) : null, deathGate: g.over ? g.gate.state : null, deathRiding: g.over ? !!(g.p.ride && g.p.ride.on) : null, deathBy: g.over ? (g.lastHurtBy || g.killedBy || null) : null, lv4: bot.lv4, lv8: bot.lv8, lv12: bot.lv12, chorus: g.chorusN || 0, killBy: Object.fromEntries(Object.entries(g.killBy || {}).map(([k, v]) => [g.srcNames[k] || ('src' + k), v])), stakes: Math.round(g.stakes || 0), spawned: g.spawned, why: bot.why, ansN: Object.values(g.ansCount || {}).reduce((a, b) => a + b, 0), flowBest: g.rflow ? g.rflow.best : 0, slams: g.rflow ? g.rflow.slams : 0, bails: bot.bails || 0, rideMin: +((bot.rideT || 0) / 3600).toFixed(2), sc: Math.round(g.sc), seed, doorAt, found: wokeAt !== null && wokeAt <= 720, wokeAt, wokeDist, cleared: clearedAt !== null && !g.over, deadAt, level: g.level, items: g.items.length, kills: g.kills, wall: +((Date.now() - w0) / 1000).toFixed(1) });
  if (!JSON_OUT) process.stderr.write('.');
}
const n = rows.length, pct = k => (100 * rows.filter(r => r[k]).length / n).toFixed(0) + '%';
const avg = k => +(rows.reduce((s, r) => s + (r[k] || 0), 0) / n).toFixed(1), kpm = +(rows.reduce((s, r) => s + r.kills, 0) / Math.max(1, rows.reduce((s, r) => s + r.sc, 0) / 60)).toFixed(1);
const why = {}; for (const r of rows) for (const k in r.why || {}) why[k] = (why[k] || 0) + r.why[k];
const KB = {}; for (const r of rows) for (const k in r.killBy || {}) KB[k] = (KB[k] || 0) + Math.round(r.killBy[k] / n); const top = Object.fromEntries(Object.entries(KB).sort((a, b) => b[1] - a[1]).slice(0, 6));
const avgD = k => { const v = rows.filter(r => r[k] !== undefined); return v.length ? +(v.reduce((s, r) => s + r[k], 0) / v.length).toFixed(1) : null; };
const deaths = rows.filter(r => r.deathAt !== null).map(r => r.deathAt + 's ' + r.deathGate + (r.deathRiding ? ' riding' : ' foot') + (r.deathBy ? ' ' + r.deathBy : ''));
const sum = { deaths, lv4: avgD('lv4'), lv8: avgD('lv8'), lv12: avgD('lv12'), chorus: avg('chorus'), top, stakes: avg('stakes'), spawned: avg('spawned'), why, kills: avg('kills'), killsPerMin: kpm, answers: avg('ansN'), slams: avg('slams'), bails: avg('bails'), rideMin: avg('rideMin'), player: PLAYER, difficulty: DIF, runs: n, doorFound: pct('found'), cleared: pct('cleared'), died: (100 * rows.filter(r => r.deadAt !== null).length / n).toFixed(0) + '%', medianWoke: (rows.filter(r => r.wokeAt !== null).map(r => r.wokeAt).sort((a, b) => a - b)[Math.floor(rows.filter(r => r.wokeAt !== null).length / 2)] || null), meanLevel: +(rows.reduce((a, r) => a + r.level, 0) / n).toFixed(1), meanItems: +(rows.reduce((a, r) => a + r.items, 0) / n).toFixed(1), meanWall: +(rows.reduce((a, r) => a + r.wall, 0) / n).toFixed(1) };
console.log('\n' + JSON.stringify(sum)); if (JSON_OUT || flag('--rows')) console.log(JSON.stringify(rows));
if (TABLE) { console.log('min | level | items | chests | boons | level-ups | mean enemies | max enemies | kills | stakes %'); tab.forEach((t, m) => { if (t.n) console.log(String(m).padStart(3), '|', (t.lv / t.n).toFixed(1).padStart(5), '|', (t.items / t.n).toFixed(1).padStart(5), '|', (t.chests / t.n).toFixed(1).padStart(6), '|', (t.boons / t.n).toFixed(1).padStart(5), '|', (t.lvUps / t.n).toFixed(1).padStart(8), '|', (t.enemies / t.samples).toFixed(0).padStart(5), '|', String(t.maxEn).padStart(4), '|', (t.kills / t.n).toFixed(0).padStart(5), '|', ((t.stakes || 0) / t.n).toFixed(0).padStart(5)); }); }
if (TL) { console.log('seed | t | surge | level-ups | chests | shrines+stones | items  (per 10 s)'); for (const q of TLrows) console.log(q.join(' | ')); const on = TLrows.filter(q => q[2]), off = TLrows.filter(q => !q[2]); console.log('level-ups per surge window of 10 s', (on.reduce((a, q) => a + q[3], 0) / Math.max(1, on.length)).toFixed(2), 'off', (off.reduce((a, q) => a + q[3], 0) / Math.max(1, off.length)).toFixed(2)); }
if (EL) { for (const [k, v] of Object.entries(ELT)) { v.sort((a, b) => a - b); console.log('kill time', k.padEnd(6), 'n', v.length, 'median s', v[Math.floor(v.length / 2)].toFixed(1), 'p10', v[Math.floor(v.length * 0.1)].toFixed(1), 'p90', v[Math.floor(v.length * 0.9)].toFixed(1)); } }
