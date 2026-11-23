import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from '../tools/bot.mjs';
const N = Number(process.argv[2] || 20), xps = Array.from({ length: 8 }, () => []);
for (let seed = 1; seed <= N; seed++) {
  const g = new Game(seed, { mode: 'run', difficulty: 'medium', duelist: 'kael' }), bot = newBot({ focus: true }); let m = 0;
  for (let i = 0; i < 60 * 421 && !g.over && g.stage === 0; i++) { g.tick(botRecord(g, bot)); while (m < 7 && g.sc >= (m + 1) * 60) { xps[m + 1].push(g.xp); m++; } }
  while (m < 7) { xps[m + 1].push(g.xp); m++; }                        // a bot that died keeps its total
}
console.log(JSON.stringify(xps.map(a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0)));
