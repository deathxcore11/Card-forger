import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from '../tools/bot.mjs';
const seeds = Array.from({ length: Number(process.argv[2] || 20) }, (_, i) => i + 1), rows = [];
const per = Array.from({ length: 7 }, () => []), picksPer = Array.from({ length: 7 }, () => []), first = [], fus = [], totals = [];
for (const seed of seeds) {
  const g = new Game(seed, { mode: 'run', difficulty: 'medium', duelist: 'kael' }), bot = newBot({ focus: true }); let lv = g.level, firstL = -1, fusT = -1, prevOffer = null; const lvl = Array(7).fill(0), pk = Array(7).fill(0);
  for (let i = 0; i < 60 * 420 && !g.over && g.stage === 0; i++) { g.tick(botRecord(g, bot)); const m = Math.min(6, Math.floor(g.sc / 60)); if (g.level !== lv) { for (let k = lv; k < g.level; k++) { lvl[m]++; if (firstL < 0) firstL = g.sc; } lv = g.level; } if (g.offer !== prevOffer) { if (g.offer) pk[m]++; prevOffer = g.offer; } if (fusT < 0 && g.fusions) fusT = g.sc; }
  lvl.forEach((v, m) => per[m].push(v)); pk.forEach((v, m) => picksPer[m].push(v)); first.push(firstL); fus.push(fusT); totals.push(pk.reduce((a, b) => a + b, 0));
}
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log('minute:            1    2    3    4    5    6    7'); console.log('level-ups (avg):  ', per.map(avg).join('  ')); console.log('all picks (avg):  ', picksPer.map(avg).join('  '));
console.log('first level-up s: median', med(first.filter(x => x >= 0)), 'range', Math.min(...first.filter(x => x >= 0)), Math.max(...first)); console.log('first Fusion s: median', med(fus.filter(x => x >= 0)), 'never', fus.filter(x => x < 0).length, '/', fus.length); console.log('total picks 7 min: avg', avg(totals), 'min', Math.min(...totals), 'max', Math.max(...totals));
