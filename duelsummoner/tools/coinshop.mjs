// Coin economy with a shopper: the bot (invulnerable, to reach the gate) goes to the nearest unopened paid Card Chest as soon as it holds the price and no boss is alive
// (it teleports there: this measures the economy, not the walk), opens it and plays on. Reports the coins held when the gate wakes against the next chest price,
// and when the first paid chest became affordable and was opened.  node tools/coinshop.mjs [seeds=20] [difficulty=medium]
import { Game } from '../src/sim/game.js'; import { newBot, botRecord } from './bot.mjs'; import { chestPrice, openCardChest } from '../src/sim/world.js';
const N = +(process.argv[2] || 20), diff = process.argv[3] || 'medium', rows = [];
for (let seed = 1; seed <= N; seed++) {
  const g = new Game(seed, { mode: 'run', difficulty: diff, duelist: 'kael' }); g.god = true; const bot = newBot({ focus: true, world: true });
  let aff = -1, bought1 = -1, n = 0, at = null;
  for (let i = 0; i < 60 * 800 && !g.over && !at; i++) {
    g.tick(botRecord(g, bot));
    if (aff < 0 && g.coins >= chestPrice(g)) aff = g.sc;
    if (!g.offer && !g.sp.some(s => s.alive && !s.dead && s.role !== 'elite') && g.coins >= chestPrice(g) && g.gate.state === 'closed') {
      let best = null, bd = 1e9; for (const c of g.world.cchests) if (!c.open && !c.free) { const d = Math.hypot(c.x - g.p.x, c.z - g.p.z); if (d < bd) { bd = d; best = c; } }
      if (best) { g.p.x = best.x - 1.2; g.p.z = best.z; g.p.y = best.y; openCardChest(g, best); if (g.offer) { n++; if (bought1 < 0) bought1 = g.sc; } }
    }
    if (g.gate.state === 'fight') at = { coins: g.coins, price: chestPrice(g) };
  }
  if (at) rows.push({ seed, aff: Math.round(aff), bought1: Math.round(bought1), n, coins: at.coins, price: at.price, ratio: +(at.coins / at.price).toFixed(2) });
}
const med = a => { const s = a.filter(x => x >= 0).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log(diff, 'seeds with a gate', rows.length, ' median coins/price', med(rows.map(r => r.ratio)), ' max', Math.max(...rows.map(r => r.ratio)), ' first affordable (s) median', med(rows.map(r => r.aff)), ' first bought median', med(rows.map(r => r.bought1)), ' chests bought median', med(rows.map(r => r.n)));
console.log(rows.map(r => r.seed + ':' + r.coins + '/' + r.price + ' aff' + r.aff + ' n' + r.n).join('  '));
