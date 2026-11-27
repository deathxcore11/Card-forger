// Fusion bot: one Fusion alone on the field against a standing horde of walking husks (tougher than wave one), 30 s of sim at 60 Hz.
// Damage per second counted from every hit (layers, reactions, zones, venom and show-stoppers included), the old fixed rule (2) against the layered rule (3).
//   node tools/fusionbot.mjs [hpMul] [level]
import { Game } from '../src/sim/game.js';
import { spawnEnemy } from '../src/sim/enemies.js';
const hpMul = +(process.argv[2] || 20), level = +(process.argv[3] || 1), I = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
function run(id, rule, seed) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'easy', fusionRule: rule }); g.god = true; g.spawnAcc = -1e9;
  const m0 = g.field.monsters.find(Boolean), m = Object.assign({}, m0, { id, level, cd: 0, init: false }); g.field.monsters = [m];
  let dealt = 0; const log = g.logDealt.bind(g); g.logDealt = d => { dealt += d; log(d); };
  for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0;
  let kills0 = g.kills; for (let tk = 0; tk < 1800; tk++) { g.cardT = 1e9; let n = 0; for (let i = 0; i < g.en.max; i++) n += g.en.alive[i];
    for (let k = 0; k < 6 && n < 120; k++, n++) { const a = g.rc() * 6.283, r = 12 + g.rc() * 14; if (spawnEnemy(g, 'husk', { x: g.p.x + Math.sin(a) * r, z: g.p.z + Math.cos(a) * r })) g.en.hp[g.lastSlot] *= hpMul; }
    g.step(1 / 60, I); if (g.offer) g.offer = null; }
  const S = g.fx3 || {}; return { dps: dealt / 30, kills: g.kills - kills0, reactions: S.reactions | 0, stoppers: S.stoppers | 0 };
}
for (const id of ['twinflare-tyrant', 'astral-magus']) { const o = [21, 77].map(s => run(id, 2, s)), n = [21, 77].map(s => run(id, 3, s)), av = (a, k) => +(a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1);
  console.log(id, 'old dps', av(o, 'dps'), 'kills', av(o, 'kills'), '| new dps', av(n, 'dps'), 'kills', av(n, 'kills'), 'reactions', av(n, 'reactions'), 'stoppers', av(n, 'stoppers')); }
