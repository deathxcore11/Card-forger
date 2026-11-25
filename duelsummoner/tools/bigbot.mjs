// Bots for the big desert, to tune the door and the first runs. Two players:
//   newbie  a first-timer: starter pools, goes toward what it can see (the nearest pocket, a mesa to climb), notices the door only when it can see it (a clear line within 200 m, or the red wind within 90 m, or the fog has shown it), simple dodging
//   skilled a practised player: knows the door's place the moment it rises, farms pockets and sleepers meanwhile
// usage: node tools/bigbot.mjs <runs> [--player newbie|skilled] [--seed0 N] [--stage1] [--full] [--unlocked] [--difficulty easy|medium|hard] [--maxmin N] [--json]
//   --stage1  stop a run when the door is woken or the clock hits 12:00 (door-find rate); default plays the whole stage; --full all stages
//   --unlocked the first 10 runs' unlocks (about 40 items and 8 boons) instead of a fresh save
import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from './bot.mjs';
import { simMeta, defaultMeta } from '../src/core/meta.js';
import { heightAt } from '../src/sim/terrain.js';
import { exploredAt } from '../src/sim/fog.js';
import { DIFFICULTY } from '../src/data/stages.js';
import { DOOR } from '../src/sim/door.js';

const argv = process.argv.slice(2), flag = f => argv.includes(f), val = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const RUNS = Number(argv.find(a => /^\d+$/.test(a)) || 20), PLAYER = val('--player', 'newbie'), SEED0 = Number(val('--seed0', 1000)), DIF = val('--difficulty', 'easy'), MAXMIN = Number(val('--maxmin', 14));
const STAGE1 = flag('--stage1'), FULL = flag('--full'), UNLOCKED = flag('--unlocked'), JSON_OUT = flag('--json');

function metaFor() {
  const m = defaultMeta();
  if (UNLOCKED) { m.stagesOpen = FULL ? 3 : 1; for (const id of ['hunters-mark', 'traders-seal', 'sharpened-edge', 'stacked-deck', 'summoners-chalk', 'field-banner', 'leather-vest', 'waterskin', 'herb-pouch', 'spyglass', 'iron-filings', 'treasure-sack', 'rabbit-foot', 'vampire-fang', 'echo-bell', 'last-stand', 'second-breath', 'level-spark']) if (!m.unlockedItems.includes(id)) m.unlockedItems.push(id); for (const b of ['fortune', 'precision', 'plunder', 'haste']) m.unlockedBoons.push(b); for (const k of [6, 8]) m.unlockedPickups.push(k); m.duelists.push('mira'); }
  else if (FULL) m.stagesOpen = 3;
  if (PLAYER === 'skilled') { m.stagesOpen = 3; for (const id of Object.keys(ITEMS_ALL)) if (!m.unlockedItems.includes(id)) m.unlockedItems.push(id); for (const b of Object.keys(BOONS_ALL)) if (!m.unlockedBoons.includes(b)) m.unlockedBoons.push(b); for (let k = 2; k <= 11; k++) if (!m.unlockedPickups.includes(k)) m.unlockedPickups.push(k); }
  return simMeta(m);
}
import { ITEMS as ITEMS_ALL, BLESSINGS as BOONS_ALL } from '../src/data/items.js';

// a tiny generator of its own, so the bot never touches the sim's streams
const lcg = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
function seesDoor(g) {                                  // the first-timer's eyes: a clear line to the door from the duelist's eyes within 200 m, or the fog has shown it, or the red wind (90 m)
  const d = g.door, p = g.p; if (!d || d.state !== 'risen') return false;
  const dx = d.x - p.x, dz = d.z - p.z, L = Math.sqrt(dx * dx + dz * dz); if (L < 90) return true; if (exploredAt(g.fog, d.x, d.z)) return true; if (L > 200) return false;
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
const TL = flag('--timeline'), TLrows = [], TLprev = {};
const rows = [];
for (let r = 0; r < RUNS; r++) {
  const seed = SEED0 + r, w0 = Date.now(), g = new Game(seed, { mode: 'run', duelist: 'kael', difficulty: DIF, terrain: 'open', meta: metaFor() }), bot = newBot({ focus: false, world: true }); bot.goalFn = goalFn; bot.noGateSense = PLAYER !== 'skilled'; g.skilledBuild = PLAYER === 'skilled';
  let ticks = 0, wokeAt = null, wokeDist = null, clearedAt = null, deadAt = null, doorAt = null; const stageMax = FULL ? g.stages.length : 1;
  while (!g.over && ticks < MAXMIN * 3600 * 4) {
    g.tick(botRecord(g, bot)); ticks++;
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
  rows.push({ seed, doorAt, found: wokeAt !== null && wokeAt <= 720, wokeAt, wokeDist, cleared: clearedAt !== null && !g.over, deadAt, level: g.level, items: g.items.length, kills: g.kills, wall: +((Date.now() - w0) / 1000).toFixed(1) });
  if (!JSON_OUT) process.stderr.write('.');
}
const n = rows.length, pct = k => (100 * rows.filter(r => r[k]).length / n).toFixed(0) + '%';
const sum = { player: PLAYER, difficulty: DIF, runs: n, doorFound: pct('found'), cleared: pct('cleared'), died: (100 * rows.filter(r => r.deadAt !== null).length / n).toFixed(0) + '%', medianWoke: (rows.filter(r => r.wokeAt !== null).map(r => r.wokeAt).sort((a, b) => a - b)[Math.floor(rows.filter(r => r.wokeAt !== null).length / 2)] || null), meanLevel: +(rows.reduce((a, r) => a + r.level, 0) / n).toFixed(1), meanItems: +(rows.reduce((a, r) => a + r.items, 0) / n).toFixed(1), meanWall: +(rows.reduce((a, r) => a + r.wall, 0) / n).toFixed(1) };
console.log('\n' + JSON.stringify(sum)); if (JSON_OUT || flag('--rows')) console.log(JSON.stringify(rows));
if (TABLE) { console.log('min | level | items | chests | boons | level-ups | mean enemies | max enemies | kills | stakes %'); tab.forEach((t, m) => { if (t.n) console.log(String(m).padStart(3), '|', (t.lv / t.n).toFixed(1).padStart(5), '|', (t.items / t.n).toFixed(1).padStart(5), '|', (t.chests / t.n).toFixed(1).padStart(6), '|', (t.boons / t.n).toFixed(1).padStart(5), '|', (t.lvUps / t.n).toFixed(1).padStart(8), '|', (t.enemies / t.samples).toFixed(0).padStart(5), '|', String(t.maxEn).padStart(4), '|', (t.kills / t.n).toFixed(0).padStart(5), '|', ((t.stakes || 0) / t.n).toFixed(0).padStart(5)); }); }
if (TL) { console.log('seed | t | surge | level-ups | chests | shrines+stones | items  (per 10 s)'); for (const q of TLrows) console.log(q.join(' | ')); const on = TLrows.filter(q => q[2]), off = TLrows.filter(q => !q[2]); console.log('level-ups per surge window of 10 s', (on.reduce((a, q) => a + q[3], 0) / Math.max(1, on.length)).toFixed(2), 'off', (off.reduce((a, q) => a + q[3], 0) / Math.max(1, off.length)).toFixed(2)); }
