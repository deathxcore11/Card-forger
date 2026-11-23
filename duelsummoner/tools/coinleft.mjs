// Coin leftover check: at the moment each gate wakes, how many coins the bot holds against the next Card Chest price. node tools/coinleft.mjs [seeds=20] [difficulty=medium]
import { Game } from '../src/sim/game.js'; import { newBot, botRecord } from './bot.mjs'; import { chestPrice } from '../src/sim/world.js';
const N = +(process.argv[2] || 20), diff = process.argv[3] || 'medium', ratios = [], rows = [];
for (let seed = 1; seed <= N; seed++) {
  const g = new Game(seed, { mode: 'run', difficulty: diff, duelist: 'kael' }); g.god = true; const bot = newBot({ focus: true, world: true }); let got = false;
  for (let i = 0; i < 60 * 800 && !g.over && !got; i++) { g.tick(botRecord(g, bot)); if (g.gate.state === 'fight') { got = true; const price = chestPrice(g); rows.push([seed, g.coins, price]); ratios.push(g.coins / price); } }
}
ratios.sort((a, b) => a - b); console.log('seeds', N, 'reached the gate', ratios.length, ' median coins/price', ratios.length ? ratios[Math.floor(ratios.length / 2)].toFixed(2) : 'n/a', ' max', ratios.length ? ratios[ratios.length - 1].toFixed(2) : 'n/a'); console.log(rows.map(r => r.join(':')).join('  '));
