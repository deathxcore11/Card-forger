import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from '../tools/bot.mjs';
for (const dif of ['easy', 'medium']) {
  const rows = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const g = new Game(seed, { mode: 'run', difficulty: dif, duelist: 'kael' }), bot = newBot({ focus: true }), at = {}; let lv = g.level, fus = 0, fusT = 0;
    for (let i = 0; i < 60 * 600 && !g.over; i++) { g.tick(botRecord(g, bot)); if (g.level !== lv) { lv = g.level; at['L' + lv] = Math.round(g.t); } if (!fus && g.fusions) { fus = 1; fusT = Math.round(g.t); } }
    rows.push([at.L2, at.L3, at.L4, at.L5, at.L6, at.L10, fusT || '-', Math.round(g.t), g.level]);
  }
  console.log(dif, 'L2 L3 L4 L5 L6 L10 firstFusion end level', JSON.stringify(rows));
}
