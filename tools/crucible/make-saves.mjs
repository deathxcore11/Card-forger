// Writes saved games for the Lost Memories test page, one for each kind of screen a run can reach, so the
// click bot (play-bot.cjs with SAVE=file) can start deep in a run: floor three, guardians, the Second Gate,
// each reward screen, a Trap prompt, the move before a win. Runs are played by the scripted expert.
//   node tools/crucible/make-saves.mjs <out-dir> [labs: key,key,...] [seeds]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { buildDb } from '../../crucible/engine/cards.mjs';
import { newRun, runApply } from '../../crucible/engine/run.mjs';
import { policyAction } from '../../crucible/engine/policy.mjs';
import { newProfile, lockedRelics, FEATS } from '../../crucible/engine/meta.mjs';
import { FORGER_IDS } from '../../crucible/engine/forgers.mjs';
import { labConfig } from '../../crucible/web/labs.mjs';

const [out, labArg, seedArg] = process.argv.slice(2);
if (!out) { console.error('usage: make-saves.mjs <out-dir> [labs] [seeds]'); process.exit(2); }
const read = f => JSON.parse(readFileSync(new URL('../../crucible/data/' + f, import.meta.url), 'utf8'));
const labs = Object.fromEntries((labArg || 'five,lean,heat,kits').split(',').filter(Boolean).map(k => [k, true]));
const cfg = { ...read('crucible-config.json'), ...labConfig(labs) };
const db = buildDb(read('crucible-pool.json'), read('crucible-spell-tags.json'), cfg);

// A profile that has seen most of the game: every Forger, Heat open to the top, feats one step from done.
const profile = { ...newProfile(), memories: 120, earned: 400, runs: 30, clears: 9, duelWins: 200, bossWins: 20, bestFloor: 2, heatCleared: 9, forgers: FORGER_IDS.slice(), feats: Object.fromEntries(FEATS.map(f => [f.id, f.goal - 1])), fresh: [] };
mkdirSync(out, { recursive: true });
const done = new Set(); let n = 0;
const keep = (key, run) => { if (done.has(key)) return; done.add(key); writeFileSync(out + '/' + key + '.json', JSON.stringify({ run, labs, profile })); n++; };
const seeds = +(seedArg || 40);
for (let seed = 1; seed <= seeds; seed++) {
  const forger = FORGER_IDS[seed % FORGER_IDS.length], heat = seed % 3 === 0 ? 10 : seed % 3 === 1 ? 0 : 5;
  const run = newRun(db, { seed, heat, forger, locked: lockedRelics(profile), featured: seed % 4 === 0 ? ['snare'] : [], track: true });
  let guard = 0;
  while (run.phase !== 'over' && guard++ < 200000) {
    const d = run.duel, h = 'h' + heat;
    let key = run.phase + (run.offer && run.offer.kind && run.phase === 'reward' ? '-' + run.offer.kind : '') + '-f' + (run.floor + 1);
    if (run.phase === 'duel') key = 'duel-' + (run.rival.tier || 'x') + '-f' + (run.floor + 1) + (d.pending ? '-trap-prompt' : '') + '-' + h;
    if (run.phase === 'chamber' && run.doors.some(x => x.type === 'boss')) key = 'chamber-boss-door-f' + (run.floor + 1) + '-' + h;
    if (run.secondGate) key += '-second-gate';
    if (run.phase === 'duel' && d.pending) keep(key, JSON.parse(JSON.stringify(run)));
    else if (run.phase !== 'duel' || (d.active === 0 && d.turn >= 3)) keep(key, JSON.parse(JSON.stringify(run)));
    const before = JSON.stringify(run);
    runApply(run, policyAction(db, run, { level: 2, family: ['neutral', 'storm', 'tomb', 'shadow', 'furnace'][seed % 5] }), db);
    if (run.phase === 'over') keep((run.result.won ? 'last-move-win-' : 'last-move-loss-f' + (run.floor + 1) + '-') + 'h' + heat + (JSON.parse(before).secondGate ? '-second-gate' : ''), JSON.parse(before));
  }
}
console.log('wrote', n, 'saved games to', out, [...done].sort().join(' '));
