// Golden traces. A scene is a seed, a setup and a tape of per-tick input records. Replaying the tape through Game.tick must give the
// same 64-bit state hash on every tick, the same event log and the same snapshots. A native (Kotlin) kernel is held to the same files.
//   node tools/trace.mjs --regen [scene...]   record tapes with the bot and rewrite test/golden/<scene>.json (do this deliberately)
//   node tools/trace.mjs --check [scene...]   replay every golden file and report the first tick that differs
//   node tools/trace.mjs --dump <scene>       print the per-tick hashes of a scene
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/sim/game.js';
import { SCENES } from './scenes.mjs';
import { newBot, botRecord } from './bot.mjs';

export const GOLDEN_DIR = fileURLToPath(new URL('../test/golden/', import.meta.url));
export const SNAP_EVERY = 60;

// two 32-bit FNV-1a style lanes make a 64-bit hash of the deterministic state
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
class H {
  constructor() { this.a = 0x811C9DC5 | 0; this.b = 0x9747B28C | 0; }
  u(x) { this.a = Math.imul(this.a ^ x, 16777619); this.b = Math.imul(this.b ^ (x + 0x9E3779B9 | 0), 0x85EBCA6B); this.b ^= this.b >>> 13; }
  n(v) { f64[0] = v; this.u(u32[0]); this.u(u32[1]); }
}

export function stateHash(g, h = new H()) {
  const p = g.p;
  h.u(g.tickN); h.n(g.t); h.n(p.x); h.n(p.y); h.n(p.z); h.n(p.hp); h.u(g.kills); h.u(g.coins | 0); h.n(g.xp); h.u(g.level); h.u(g.over ? 1 : 0); h.u(g.offer ? 1 : 0);
  const e = g.en; let c = 0, sx = 0, sz = 0, sh = 0;
  for (let i = 0; i < e.max; i++) if (e.alive[i]) { c++; sx += e.x[i]; sz += e.z[i]; sh += e.hp[i]; }
  h.u(c); h.n(sx); h.n(sz); h.n(sh);
  const m = g.pick; c = 0; sx = 0; sz = 0;
  for (let i = 0; i < m.max; i++) if (m.alive[i]) { c++; sx += m.x[i]; sz += m.z[i]; }
  h.u(c); h.n(sx); h.n(sz);
  for (const s of g.sp) { h.n(s.x); h.n(s.z); h.n(s.hp); h.u(s.alive ? 1 : 0); }
  for (const f of g.field.monsters) h.u(f ? f.level + 1 : 0);
  h.u(g.fusions); h.u(g.chests.length);
  const st = g.streams; h.u(st.spawn.s); h.u(st.loot.s); h.u(st.combat.s); h.u(st.cosmetic.s);
  return h;
}

const r3 = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
function snapshot(g) {
  return { n: g.tickN, t: r3(g.t), x: r3(g.p.x), z: r3(g.p.z), hp: r3(g.p.hp), kills: g.kills, level: g.level, coins: g.coins | 0, fusions: g.fusions, sp: g.sp.filter(s => s.alive).length, mons: g.field.monsters.filter(Boolean).map(f => f.id + ':' + f.level) };
}

function unpack(b64, ticks) { const b = Buffer.from(b64, 'base64'), out = new Uint32Array(ticks * 2); for (let i = 0; i < out.length; i++) out[i] = b.readUInt32LE(i * 4); return out; }
export const rle = tape => { const out = []; for (const r of tape) { const l = out[out.length - 1]; if (l && l[1] === r[0] && l[2] === r[1] && l[3] === r[2] && l[4] === r[3] && l[5] === r[4]) l[0]++; else out.push([1, r[0], r[1], r[2], r[3], r[4]]); } return out; };
export const unrle = runs => { const out = []; for (const r of runs) for (let i = 0; i < r[0]; i++) out.push({ mx: r[1], mz: r[2], yaw: r[3], buttons: r[4], menu: r[5] }); return out; };

// Plays a scene. records(g, i) gives the input record for tick i (bot when recording, the tape when replaying).
export function playScene(scene, ticks, records) {
  const g = new Game(scene.seed, { duelist: scene.duelist, offers: scene.offers !== false });
  if (scene.setup) scene.setup(g);
  const tape = g.startTape(), hashes = new Uint32Array(ticks * 2), events = [], snaps = [];
  for (let i = 0; i < ticks; i++) {
    if (scene.at && scene.at[i]) scene.at[i](g);
    g.tick(records(g, i));
    g.drainEvents((type, a, b, c, data) => { if (type !== 'hit') events.push([i, type, r3(a), r3(b), r3(c), typeof data === 'string' ? data : null]); });
    const h = stateHash(g); hashes[i * 2] = h.a >>> 0; hashes[i * 2 + 1] = h.b >>> 0;
    if (i % SNAP_EVERY === 0) snaps.push(snapshot(g));
  }
  return { g, tape, hashes, events, snaps };
}

export function record(scene) {
  const bot = newBot({ focus: scene.focus }), r = playScene(scene, scene.ticks, (g) => botRecord(g, bot));
  return { name: scene.name, seed: scene.seed, duelist: scene.duelist, ticks: scene.ticks, tape: rle(r.tape), hashes: Buffer.from(r.hashes.buffer).toString('base64'), snaps: r.snaps, events: r.events, final: finalOf(r.g) };
}
function finalOf(g) { const o = snapshot(g); o.over = g.over; o.won = g.won; return o; }

// Replays a golden file. Returns null when it matches, otherwise a description of the first difference.
export function check(scene, gold) {
  const tape = unrle(gold.tape);
  const r = playScene(scene, gold.ticks, (g, i) => tape[i]);
  const want = unpack(gold.hashes, gold.ticks);
  for (let i = 0; i < gold.ticks; i++) if (r.hashes[i * 2] !== want[i * 2] || r.hashes[i * 2 + 1] !== want[i * 2 + 1]) {
    const k = Math.floor(i / SNAP_EVERY), a = gold.snaps[k], b = r.snaps[k];
    return `tick ${i}: state hash differs (nearest snapshot ${k * SNAP_EVERY}: want ${JSON.stringify(a)} got ${JSON.stringify(b)})`;
  }
  if (JSON.stringify(r.events) !== JSON.stringify(gold.events)) {
    const n = Math.min(r.events.length, gold.events.length); let j = 0; while (j < n && JSON.stringify(r.events[j]) === JSON.stringify(gold.events[j])) j++;
    return `event log differs at entry ${j}: want ${JSON.stringify(gold.events[j])} got ${JSON.stringify(r.events[j])}`;
  }
  if (JSON.stringify(r.snaps) !== JSON.stringify(gold.snaps)) return 'snapshots differ';
  return null;
}

export const goldenPath = name => GOLDEN_DIR + name + '.json';
export const loadGolden = name => JSON.parse(readFileSync(goldenPath(name), 'utf8'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2), mode = argv.find(a => a.startsWith('--')), names = argv.filter(a => !a.startsWith('--'));
  const list = SCENES.filter(s => !names.length || names.includes(s.name));
  if (mode === '--regen') {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    for (const s of list) { const t0 = Date.now(), gold = record(s); writeFileSync(goldenPath(s.name), JSON.stringify(gold)); console.log('wrote', s.name, gold.ticks, 'ticks', gold.events.length, 'events', Date.now() - t0 + ' ms', JSON.stringify(gold.final)); }
  } else if (mode === '--dump') {
    const g = loadGolden(names[0]), w = unpack(g.hashes, g.ticks);
    for (let i = 0; i < g.ticks; i++) console.log(i, w[i * 2].toString(16).padStart(8, '0') + w[i * 2 + 1].toString(16).padStart(8, '0'));
  } else {
    let bad = 0;
    for (const s of list) { if (!existsSync(goldenPath(s.name))) { console.log('MISSING', s.name); bad++; continue; } const d = check(s, loadGolden(s.name)); console.log(d ? 'DIFF   ' + s.name + ' ' + d : 'ok     ' + s.name); if (d) bad++; }
    process.exit(bad ? 1 : 0);
  }
}

