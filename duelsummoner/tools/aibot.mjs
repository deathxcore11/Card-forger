// AI check (design/ai-v1.md section 7): a rider bot on the card for a few minutes on two seeds, steering in long arcs with the stick held forward, ollies now and then.
// Reports the hits it took per minute and where they came from (ahead, side, behind its travel), the most melee wind-ups at once (the token cap), sim ms per tick, and deaths.
//   node tools/aibot.mjs [minutes=4] [seeds...]
import { Game } from '../src/sim/game.js';
const mins = +(process.argv[2] || 4), seeds = process.argv.slice(3).map(Number).filter(Boolean); if (!seeds.length) seeds.push(21, 77);
const rows = [];
for (const seed of seeds) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false, terrain: 'open', difficulty: 'medium', card: true, flow: 'v2' }); g.god = true; let hurt = 0, ms = 0, worst = 0; const h0 = g.hurtPlayer.bind(g); g.hurtPlayer = (n, b, s, f) => { hurt++; return h0(n, b, s, f); };
  const N = mins * 3600; for (let t = 0; t < N; t++) { const yaw = 0.6 * Math.sin(t / 400) + t / 3000, slow = (t % 900) > 600, cmd = { f: slow ? -1 : 1, r: 0.35 * Math.sin(t / 170), yaw, jump: !slow && (t % 240) < 30, dash: false };       // every 15 s it brakes and loiters for 5 s, so the horde can reach it
    const a = performance.now(); g.step(1 / 60, cmd); const d = performance.now() - a; ms += d; if (d > worst) worst = d; if (g.offer) g.offer = null; }
  const A = g.aiStats || { ahead: 0, side: 0, behind: 0, maxWind: 0 }, T = A.ahead + A.side + A.behind || 1;
  rows.push({ seed, hitsPerMin: +(hurt / mins).toFixed(1), ahead: +(A.ahead / T).toFixed(2), side: +(A.side / T).toFixed(2), behind: +(A.behind / T).toFixed(2), maxWindUps: A.maxWind, simMsPerTick: +(ms / N).toFixed(3), worstTickMs: +worst.toFixed(1), kills: g.kills });
}
console.log(JSON.stringify(rows));
