const DUELIST = (process.argv.find(a => a.startsWith('--duelist=')) || '').slice(10) || process.env.DUELIST || 'kael';       // node tools/bosstime.mjs --duelist=mira
// Boss kill times: the bot (invulnerable, so a death never hides a boss) plays Stage 1 on N seeds; reports, per boss role, how long each took from appearing to dying.
// node tools/bosstime.mjs [seeds=10] [difficulty=medium]
import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from './bot.mjs';
const N = +(process.argv[2] || 10), diff = process.argv[3] || 'medium';
const out = { bossA: [], bossB: [], gate: [] };
for (let seed = 1; seed <= N; seed++) {
  const g = new Game(seed, { mode: 'run', difficulty: diff, duelist: DUELIST }); g.god = true; const bot = newBot({ focus: true, world: true }); const born = new Map(), done = new Set();
  for (let i = 0; i < 60 * 900 && !g.over; i++) {
    g.tick(botRecord(g, bot));
    for (const sp of g.sp) { const r = sp.role; if (!(r in out)) continue; if (!born.has(sp)) born.set(sp, g.t); if ((sp.dead || !sp.alive) && !done.has(sp)) { done.add(sp); out[r].push(+(g.t - born.get(sp)).toFixed(1)); } }
    if (g.stagesCleared >= 1) break;
  }
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
for (const r in out) console.log(r.padEnd(6), 'n', String(out[r].length).padStart(2), ' median', med(out[r]), ' times', out[r].join(' '));
