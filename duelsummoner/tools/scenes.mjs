// The named golden scenes. Each is a seed, a deterministic setup, optional scripted moments (at: tick -> function) and a length.
// The bot plays them once to record a tape; after that only the tape is replayed. Changing anything here means regenerating.
import { spawnWarden, spawnIdols, startBoss } from '../src/sim/specials.js';
import { openChest } from '../src/sim/field.js';
import { nearestProp, useProp } from '../src/sim/world.js';
import { DUELISTS } from '../src/data/cards.js';
import { jumpToStage } from '../src/sim/stages.js';
import { RUNSPEC } from '../src/data/stages.js';
const atGate = g => { g.p.x = RUNSPEC.gate.x; g.p.z = RUNSPEC.gate.z + 2; g.p.y = 0; g.p.vx = g.p.vz = 0; g.p.grounded = true; };

const quiet = g => { g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9; g.field.monsters.fill(null); return g; };
const at = (g, o) => { g.p.x = o.x; g.p.z = o.z; g.p.y = o.y; g.p.vx = g.p.vz = 0; g.p.grounded = true; };

export const SCENES = [
  { name: 'early-run', seed: 11, duelist: 'kael', ticks: 5400 },
  {
    name: 'first-fusion', seed: 6, duelist: 'kael', ticks: 1500, focus: true,
    setup(g) {
      const D = DUELISTS[g.field.duelist]; g.field.monsters[0] = { id: D.start, level: 10, cd: 0 }; g.field.monsters[1] = { id: D.second, level: 10, cd: 0 };
      g.god = true; g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9;
    },
    at: { 30: g => { const c = { x: g.p.x, y: g.p.y, z: g.p.z, open: false }; g.chests.push(c); openChest(g, c); } }
  },
  {
    name: 'warden-fight', seed: 2, duelist: 'kael', ticks: 3600,
    setup(g) { g.god = true; g.t = 240; g.flags.idols = true; spawnWarden(g); }
  },
  {
    name: 'twin-idols', seed: 3, duelist: 'kael', ticks: 2400,
    setup(g) { g.god = true; g.t = 360; g.flags.warden = true; spawnIdols(g); }
  },
  {
    name: 'final-boss-phases', seed: 4, duelist: 'kael', ticks: 2400,
    setup(g) { g.god = true; g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9; g.flags.warden = g.flags.idols = true; g.t = 480; startBoss(g, true); },
    at: {
      600: g => { const p = g.sp.find(s => s.kind === 'pharaoh'); if (p) p.hp = p.maxHp * 0.6; },
      1200: g => { const p = g.sp.find(s => s.kind === 'pharaoh'); if (p) p.hp = p.maxHp * 0.3; },
      1800: g => { const p = g.sp.find(s => s.kind === 'pharaoh'); if (p) g.damageSpecial(p, 1e9, 0, 0, { noCrit: true, area: true }); }
    }
  },
  {
    name: 'altar-use', seed: 12, duelist: 'kael', ticks: 900,
    setup(g) { quiet(g); g.god = true; g.flags.warden = g.flags.idols = true; },
    at: { 5: g => { const a = g.world.altar; at(g, a); }, 10: g => { const h = nearestProp(g); if (h) useProp(g, h); } }
  },
  {
    name: 'overtime-5min', seed: 9, duelist: 'kael', ticks: 18000,
    setup(g) { g.god = true; g.t = 480; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.cardT = 1e9; }
  },
  {
    name: 'death', seed: 21, duelist: 'kael', ticks: 3600,
    setup(g) { g.t = 470; g.flags.warden = g.flags.idols = true; g.p.hp = 40; g.p.maxHp = 40; g.mods.armour = 0; }
  }
  ,{
    // three-stage run: the gate is awake, the bot holds E, the gate boss is felled, the bot walks into the Descent Circle and Stage 2 begins
    name: 'stage-transition', seed: 31, duelist: 'kael', ticks: 2000, opts: { mode: 'run' },
    setup(g) { g.god = true; g.evState.fill(2); g.sc = 359.5; g.field.monsters[0].level = 6; },
    at: { 5: g => atGate(g), 400: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) g.damageSpecial(b, 1e9, 0, 0, { noCrit: true, area: true }); } }
  },
  {
    // Stage 3 gate boss (The Hollow King stand-in): phase breaks at 66% and 33%, then the kill and the Final Altar
    name: 'gate-fight', seed: 32, duelist: 'kael', ticks: 2400, opts: { mode: 'run' },
    setup(g) { g.god = true; jumpToStage(g, 2); g.evState.fill(2); g.sc = 430; },
    at: {
      5: g => atGate(g),
      700: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) b.hp = b.maxHp * 0.6; },
      1100: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) b.hp = b.maxHp * 0.3; },
      1700: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) g.damageSpecial(b, 1e9, 0, 0, { noCrit: true, area: true }); }
    }
  },
  {
    // the same transition on Easy and a Stage 3 gate fight on Hard: the scene name carries the difficulty
    name: 'stage-transition-easy', seed: 33, duelist: 'kael', ticks: 2000, opts: { mode: 'run', difficulty: 'easy' },
    setup(g) { g.god = true; g.evState.fill(2); g.sc = 359.5; g.field.monsters[0].level = 6; },
    at: { 5: g => atGate(g), 400: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) g.damageSpecial(b, 1e9, 0, 0, { noCrit: true, area: true }); } }
  },
  {
    name: 'gate-fight-hard', seed: 34, duelist: 'kael', ticks: 2400, opts: { mode: 'run', difficulty: 'hard' },
    setup(g) { g.god = true; jumpToStage(g, 2); g.evState.fill(2); g.sc = 430; },
    at: {
      5: g => atGate(g),
      700: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) b.hp = b.maxHp * 0.6; },
      1100: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) b.hp = b.maxHp * 0.3; },
      1700: g => { const b = g.sp.find(s => s.role === 'gate'); if (b) g.damageSpecial(b, 1e9, 0, 0, { noCrit: true, area: true }); }
    }
  }
];
