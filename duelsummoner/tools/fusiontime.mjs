import { Game } from '../src/sim/game.js'; import { newBot, botRecord } from './bot.mjs';
// First Fusion time and level-ups at 5:30 and 7:00 for an invulnerable bot. node tools/fusiontime.mjs [seeds=20] [difficulty=medium]
const N = +(process.argv[2] || 20), diff = process.argv[3] || 'medium', rows = [];
for (let seed = 1; seed <= N; seed++) {
  const g = new Game(seed, { mode: 'run', difficulty: diff, duelist: 'kael' }); g.god = true; const bot = newBot({ focus: true, world: true }); let fus = -1, l330 = 0, l420 = 0;
  for (let i = 0; i < 60 * 600; i++) { g.tick(botRecord(g, bot)); if (fus < 0 && g.fusions > 0) fus = g.sc; if (g.sc >= 330 && !l330) l330 = g.level; if (g.sc >= 420 && !l420) l420 = g.level; if (g.stage > 0) break; }
  rows.push([seed, fus < 0 ? -1 : Math.round(fus), l330, l420]);
}
const f = rows.map(r => r[1]).filter(x => x >= 0).sort((a, b) => a - b); console.log('seeds', N, diff, ' fusion times (s):', rows.map(r => r[1]).join(' '), ' median', f.length ? f[Math.floor(f.length / 2)] : 'none', ' in 330-420:', f.filter(x => x >= 330 && x <= 420).length, ' level at 5:30 avg', (rows.reduce((a, r) => a + r[2], 0) / N).toFixed(1), ' at 7:00 avg', (rows.reduce((a, r) => a + r[3], 0) / N).toFixed(1));
