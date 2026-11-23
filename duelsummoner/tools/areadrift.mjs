// Area attacks must not move the pace: the same bot, 12 seeds, Kael and Mira, at Reach 0 and +150%, with the old numbers (no wake, no end burst, no Seal Ring, the old splash and blast steps) against the new.
// Reports kills a minute over the first HORIZON seconds and the drift in percent.   node tools/areadrift.mjs [horizonSeconds] [sharePercent]
import { Game } from '../src/sim/game.js'; import { recompute } from '../src/sim/field.js'; import { newBot, botRecord } from './bot.mjs';
import { MONSTERS, FUSIONS } from '../src/data/cards.js';
import * as W from '../src/sim/weapons.js';
const SEEDS = +process.env.SEEDS || 12, HOR = +process.argv[2] || 600, SHARE = process.argv[3] ? +process.argv[3] / 100 : null;
if (SHARE !== null) W.setAreaShare(SHARE);
const NEW = JSON.stringify({ w: MONSTERS['ember-wyvern'].fx, h: MONSTERS['cinder-hatchling'].fx, s: MONSTERS['sigil-familiar'].fx, m: FUSIONS['astral-magus'].fx });
const old = () => { MONSTERS['ember-wyvern'].fx = { 3: { pierce: 1 }, 6: { length: 6 }, 10: { pierce: 2 } }; MONSTERS['cinder-hatchling'].fx = { 3: { splash: 0.7 }, 6: { count: 1 }, 10: { splash: 1 } }; MONSTERS['sigil-familiar'].fx = { 3: { dmg: 1 }, 6: { speed: 6 }, 10: { dmg: 2 } }; FUSIONS['astral-magus'].fx = { 3: { marks: 2 }, 6: { explodeDmg: 4 }, 10: { marks: 2, explodeRadius: 1 } }; };
const now = () => { const o = JSON.parse(NEW); MONSTERS['ember-wyvern'].fx = o.w; MONSTERS['cinder-hatchling'].fx = o.h; MONSTERS['sigil-familiar'].fx = o.s; FUSIONS['astral-magus'].fx = o.m; };
const run = (duelist, reach) => { let kills = 0, dead = 0, secs = 0; for (let seed = 1; seed <= SEEDS; seed++) { const g = new Game(seed, { mode: 'run', difficulty: 'medium', duelist }), bot = newBot({ focus: true, world: true }); if (reach) { g.metaMods = { reach }; recompute(g); } for (let i = 0; i < 60 * HOR && !g.over; i++) g.tick(botRecord(g, bot)); kills += g.kills; secs += g.sc; if (g.over) dead++; } return { perMin: +(kills / (secs / 60)).toFixed(1), dead, mins: +(secs / SEEDS / 60).toFixed(1) }; };
let worst = -1e9;
for (const duelist of ['kael', 'mira']) for (const reach of [0, 1.5]) { old(); const a = run(duelist, reach); now(); const b = run(duelist, reach), drift = +((b.perMin / a.perMin - 1) * 100).toFixed(1); worst = Math.max(worst, drift); console.log(`${duelist} reach +${reach * 100}%: old ${a.perMin}/min (dead ${a.dead}, ${a.mins} min) new ${b.perMin}/min (dead ${b.dead}, ${b.mins} min) drift ${drift}%`); }
console.log('worst drift', worst + '%', SHARE !== null ? 'share ' + SHARE : '');
