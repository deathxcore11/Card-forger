// Plays whole three-stage runs with the bot and reports where it dies, stage times, first Fusion and wall time.
// Usage: node tools/runsim.mjs [runs] [--focus] [--god] [--mode run|quick] [--maxmin N] [--duelist kael|mira]
import { Game } from '../src/sim/game.js';
import { newBot, botRecord } from './bot.mjs';
import { RUNSPEC } from '../src/data/stages.js';

const argv = process.argv.slice(2), flag = f => argv.includes(f), val = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const runs = Number(argv.find(a => /^\d+$/.test(a)) || 4), MODE = val('--mode', 'run'), FOCUS = flag('--focus'), GOD = flag('--god'), MAXMIN = Number(val('--maxmin', 40)), DU = val('--duelist', 'kael');
const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

if (flag('--nocurve')) { RUNSPEC.hpCurve.a = 0; RUNSPEC.hpCurve.b = 0; }
const rows = [];
for (let r = 0; r < runs; r++) {
  const w0 = Date.now(), g = new Game(100 + r, { mode: MODE, duelist: DU }); g.god = GOD; const bot = newBot({ focus: FOCUS });
  const rec = { stage: [], firstFusion: null, enter: [0] }; let last = g.stage, ticks = 0;
  const runT = () => g.scTotal + g.sc;
  while (!g.over && runT() < MAXMIN * 60 && ticks < MAXMIN * 3600 * 1.2) {
    g.tick(botRecord(g, bot)); ticks++;
    if (g.fusions > 0 && rec.firstFusion === null) rec.firstFusion = clock(runT()) + ' in stage ' + (g.stage + 1);
    if (g.stage !== last) { rec.enter.push(runT()); last = g.stage; }
  }
  const res = g.results({});
  rows.push({ run: r, result: res.result, stagesCleared: res.stagesCleared, stageReached: g.stage + 1, diedAt: g.over && res.result === 'loss' ? clock(g.sc) + ' in stage ' + (g.stage + 1) + ' (run ' + clock(runT()) + ')' : null, killedBy: g.killedBy, level: g.level, kills: g.kills, fusions: g.fusions, firstFusion: rec.firstFusion,
    gate: res.stageFacts.map(f => 'S' + f.stage + ' ' + clock(f.seconds) + (f.early ? ' early' : '') + (f.toll ? ' toll' : '')).join(', '), simMinutes: +(runT() / 60).toFixed(1), wallSec: +((Date.now() - w0) / 1000).toFixed(1) });
}
console.log(JSON.stringify({ mode: MODE, focus: FOCUS, god: GOD, rows }, null, 1));

