// Balance harness: the player bot plays Stage 1 (or the whole run) on many seeds at a difficulty, in parallel worker threads.
// GOD=1 makes the bot invulnerable, to measure pacing (level-ups, picks, Fusion) independent of survival.
// node tools/balance.mjs [seeds=20] [difficulty=medium] [stages=1|3] [bot=world|plain]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
if (isMainThread) {
  const N = +(process.argv[2] || 20), diff = process.argv[3] || 'medium', stages = +(process.argv[4] || 1), world = (process.argv[5] || 'world') === 'world', jobs = Array.from({ length: N }, (_, i) => i + 1), res = [];
  const W = Math.min(cpus().length - 1, 12); let live = 0, next = 0;
  await new Promise(done => { const launch = () => { while (live < W && next < jobs.length) { const seed = jobs[next++]; live++; const w = new Worker(new URL(import.meta.url), { workerData: { seed, diff, stages, world } }); w.on('message', m => { res.push(m); }); w.on('exit', () => { live--; if (next >= jobs.length && live === 0) done(); else launch(); }); w.on('error', e => { console.error(e); }); } }; launch(); });
  res.sort((a, b) => a.seed - b.seed);
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), med = a => { const s = a.filter(x => x >= 0).sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };
  const per = Array.from({ length: 7 }, (_, m) => res.map(r => r.lvl[m])), pk = Array.from({ length: 7 }, (_, m) => res.map(r => r.pk[m]));
  console.log(diff, 'seeds', N, 'stages', stages, world ? '(bot uses chests, shrines, stones)' : '(plain bot)');
  console.log('clear stage 1:', res.filter(r => r.clear1).length + '/' + N, ' full run (3 stages):', res.filter(r => r.won).length + '/' + N, ' died before 7:00:', res.filter(r => r.diedBy < 420).length);
  console.log('deaths (s on the stage clock):', res.filter(r => r.diedBy < 9999).map(r => Math.round(r.diedBy)).sort((a, b) => a - b).join(' '));
  const kb = {}; for (const r of res) if (r.killedBy) kb[r.killedBy] = (kb[r.killedBy] || 0) + 1; console.log('killed by:', JSON.stringify(kb), ' gate states at end:', JSON.stringify(res.reduce((o, r) => { o[r.state] = (o[r.state] || 0) + 1; return o; }, {})));
  const cm = t => { const a = res.map(r => r.coinAt[t]).filter(x => x >= 0).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; }; console.log('coins earned (median): by 1:30', cm(90), ' by 1:45', cm(105), ' by 3:30', cm(210), '(target: about 30 by 1:30-1:45 and about 100 by 3:30)');
  const xi = Array.from({ length: 7 }, (_, m) => { const a = res.map(r => r.xpAt[m]).filter(x => x >= 0); return a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0; }); console.log('cumulative XP at minute ends (survivors):', JSON.stringify(xi));
  console.log('minute:           1    2    3    4    5    6    7'); console.log('level-ups avg:   ', per.map(avg).join('  ')); console.log('all picks avg:   ', pk.map(avg).join('  '));
  console.log('first level-up s: median', med(res.map(r => r.firstLevel)), 'range', Math.min(...res.map(r => r.firstLevel).filter(x => x >= 0)), Math.max(...res.map(r => r.firstLevel)));
  const fus = res.map(r => r.fusion); console.log('first Fusion: median', med(fus), 's;', fus.filter(x => x >= 330 && x <= 420).length + '/' + N, 'between 5:30 and 7:00;', fus.filter(x => x < 0).length, 'never; before 5:30:', fus.filter(x => x >= 0 && x < 330).length);
  console.log('picks in 7 min: avg', avg(res.map(r => r.pk.reduce((a, b) => a + b, 0))), 'min', Math.min(...res.map(r => r.pk.reduce((a, b) => a + b, 0))), 'max', Math.max(...res.map(r => r.pk.reduce((a, b) => a + b, 0))));
} else {
  const { Game } = await import('../src/sim/game.js'), { newBot, botRecord } = await import('./bot.mjs'), { seed, diff, stages, world } = workerData;
  const g = new Game(seed, { mode: 'run', difficulty: diff, duelist: 'kael' }); if (process.env.NOPROPS) { g.colliders = null; g.flow.col = null; g.flow.rebuild(); } if (process.env.GOD) g.god = true; const bot = newBot({ focus: true, world }); let lv = g.level, fusT = -1, prev = null, firstLevel = -1, diedBy = 9999, clear1 = false;
  const lvl = Array(7).fill(0), pk = Array(7).fill(0), xpAt = Array(7).fill(-1), coinAt = { 90: -1, 105: -1, 210: -1 }, limit = 60 * (stages === 1 ? 700 : 2400);
  for (let i = 0; i < limit && !g.over; i++) {
    g.tick(botRecord(g, bot)); if (g.stage === 0) { const m = Math.min(6, Math.floor(g.sc / 60)); for (const t of [90, 105, 210]) if (coinAt[t] < 0 && g.sc >= t) coinAt[t] = (g.coinsGained || 0); for (let k = 0; k <= m; k++) if (xpAt[k] < 0 && g.sc >= (k + 1) * 60 - 0.02) xpAt[k] = g.xp; if (g.level !== lv) { for (let k = lv; k < g.level; k++) { lvl[m]++; if (firstLevel < 0) firstLevel = g.sc; } } if (g.offer !== prev) { if (g.offer) pk[m]++; prev = g.offer; } if (fusT < 0 && g.fusions) fusT = g.sc; }
    lv = g.level; if (g.stagesCleared >= 1) clear1 = true; if (stages === 1 && g.stagesCleared >= 1) break;
  }
  if (g.over && !g.won) diedBy = g.stage === 0 ? g.sc : 9999;
  parentPort.postMessage({ seed, coinAt, xpAt, lvl, pk, firstLevel, fusion: fusT, clear1, won: !!g.won, diedBy, killedBy: g.over && !g.won ? String(g.killedBy) : null, level: g.level, state: g.gate.state });
}




