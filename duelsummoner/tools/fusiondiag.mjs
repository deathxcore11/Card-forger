// Why the first Fusion is late. For each seed (Medium, invulnerable bot, Stage 1): when each monster reached level 10, when a pair was ready, when the guaranteed Sealed Chest appeared and
// when it was opened, and which step was the wait. The Fusion time is the STAGE clock (g.sc) at the moment g.fusions first became 1; after the clock runs out (420 s) the clock is frozen,
// so a Fusion that happens later is reported as "late" with the run time, never as 420.  node tools/fusiondiag.mjs [seeds=12] [difficulty=medium]
import { Game } from '../src/sim/game.js'; import { newBot, botRecord } from './bot.mjs'; import { fusionsReady } from '../src/sim/field.js';
const N = +(process.argv[2] || 12), diff = process.argv[3] || 'medium', DUELIST = (process.argv.find(a => a.startsWith('--duelist=')) || '').slice(10) || 'kael', rows = [];
export function fusionTime(g, T) { return T.fusion < 0 ? 'never' : T.fusion < 420 ? 'in time' : 'late'; }
for (let seed = 1; seed <= N; seed++) {
  const g = new Game(seed, { mode: 'run', difficulty: diff, duelist: DUELIST }); g.god = true; const bot = newBot({ focus: true, world: true });
  const T = { seed, l10: {}, pair: -1, chestAt: -1, chestOpened: -1, fusion: -1, fusionRun: -1, ups: 0, monsterUps: 0, offers: 0, picksAt: [] };
  let prevLv = {}, prevOpen = 0;
  for (let i = 0; i < 60 * 560; i++) {
    g.tick(botRecord(g, bot)); if (g.stage > 0) break; const t = g.sc;
    for (const m of g.field.monsters) if (m) { if (prevLv[m.id] !== undefined && m.level > prevLv[m.id]) T.monsterUps++; prevLv[m.id] = m.level; if (m.level >= 10 && T.l10[m.id] === undefined) T.l10[m.id] = Math.round(t); }
    if (T.pair < 0 && fusionsReady(g).length) T.pair = Math.round(t);
    const c = g.chests.find(x => x.guaranteed); if (c && T.chestAt < 0) T.chestAt = Math.round(t);
    if (T.chestAt >= 0 && T.chestOpened < 0 && g.chests.some(x => x.guaranteed && x.open)) T.chestOpened = Math.round(t);
    if (T.fusion < 0 && g.fusions > 0) { T.fusion = Math.round(t); T.fusionRun = Math.round(g.t); }
    if (T.fusion >= 0 && g.sc > T.fusion + 5) break;
  }
  T.endSc = Math.round(g.sc); T.level = g.level; T.fusions = g.fusions; T.monsters = g.field.monsters.filter(Boolean).map(m => m.id + ':' + m.level).join(' ');
  T.wait = T.pair < 0 ? 'pair never ready (levels)' : T.chestAt < 0 ? 'chest never appeared' : T.chestOpened < 0 ? 'chest appeared, not opened' : 'fused';
  T.verdict = fusionTime(g, T); rows.push(T);
}
for (const r of rows) console.log('seed', r.seed, 'L10 at', JSON.stringify(r.l10), 'pair ready', r.pair, 'chest', r.chestAt, 'opened', r.chestOpened, 'fusion', r.fusion, '(' + r.verdict + ')', 'monster upgrades', r.monsterUps, 'level', r.level, 'ends', r.endSc, '|', r.wait, '|', r.monsters);
const inT = rows.filter(r => r.verdict === 'in time'), win = rows.filter(r => r.fusion >= 330 && r.fusion < 420), never = rows.filter(r => r.fusion < 0);
console.log('summary: fused before the clock ended', inT.length + '/' + rows.length, '; between 5:30 and 7:00', win.length + '/' + rows.length, '; before 5:30', rows.filter(r => r.fusion >= 0 && r.fusion < 330).length, '; never', never.length);
const waits = {}; for (const r of rows) waits[r.wait] = (waits[r.wait] || 0) + 1; console.log('where the wait is:', JSON.stringify(waits));
const gap = rows.filter(r => r.pair >= 0 && r.chestOpened >= 0).map(r => r.chestOpened - r.pair); console.log('pair ready to chest opened (s):', gap.join(' '));
