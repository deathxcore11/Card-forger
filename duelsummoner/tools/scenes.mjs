// The named golden scenes. Each is a seed, a deterministic setup, optional scripted moments (at: tick -> function) and a length.
// The bot plays them once to record a tape; after that only the tape is replayed. Changing anything here means regenerating.
import { spawnWarden, spawnIdols, startBoss } from '../src/sim/specials.js';
import { openChest } from '../src/sim/field.js';
import { nearestProp, useProp } from '../src/sim/world.js';
import { DUELISTS } from '../src/data/cards.js';

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
];
