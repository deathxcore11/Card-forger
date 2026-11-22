// Hot-path audit: 20 minutes of Overtime played by the bot (it cannot die), measuring the cost of each tick and heap growth.
// Usage: node --expose-gc tools/audit.mjs [minutes]
import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from './bot.mjs';

const minutes = Number(process.argv[2] || 20), ticks = minutes * 3600;
const g = new Game(5, { duelist: 'kael' }); g.god = true; g.t = 480; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead';
const bot = newBot({}), times = new Float64Array(ticks), gc = globalThis.gc || (() => {}), heap = [];
const mem = () => { gc(); return process.memoryUsage().heapUsed / 1048576; };
heap.push(mem());
for (let i = 0; i < ticks; i++) {
  const rec = botRecord(g, bot), t0 = performance.now();
  g.tick(rec); g.drainEvents(() => {});
  times[i] = performance.now() - t0;
  if ((i + 1) % 7200 === 0) heap.push(mem());                 // every 2 minutes of game time
}
const s = Array.from(times).sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
let live = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) live++;
console.log(JSON.stringify({ minutes, ticks, kills: g.kills, liveEnemies: live, tickMs: { p50: +q(0.5).toFixed(3), p99: +q(0.99).toFixed(3), p999: +q(0.999).toFixed(3), max: +s[s.length - 1].toFixed(3) }, heapMB: heap.map(h => +h.toFixed(1)), over: g.over }));
