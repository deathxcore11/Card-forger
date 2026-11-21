// A measurement, not a game change: how often does the test player beat a guardian never having more than
// one monster on its side? Watches each duel after every action. Depth set on, the player commits to one build.
//   node tools/crucible/lone-check.mjs [runs]            the usual player (does it ever happen by accident?)
//   LONE=0 node tools/crucible/lone-check.mjs [runs]     keeps one monster at the floor-one guardian (0, 1, 2 or all)
import { loadDb } from '../../crucible/engine/cards.mjs';
import { newRun, runApply } from '../../crucible/engine/run.mjs';
import { policyAction, familyOf } from '../../crucible/engine/policy.mjs';
import { chooseAction } from '../../crucible/engine/ai.mjs';
import { viewFor } from '../../crucible/engine/duel.mjs';
const LONE = process.env.LONE || ''; const att = {}, got = {};
import { labConfig, LAB_DEFAULTS } from '../../crucible/web/labs.mjs';
const db = loadDb(); Object.assign(db.config, labConfig({ ...LAB_DEFAULTS, equips: true, builds: true, trap: true }));
const N = +process.argv[2] || 600; const T = { boss: [0, 0, 0, 0], other: [0, 0, 0, 0] }; const byFloor = {};
for (let seed = 1; seed <= N; seed++) {
  const run = newRun(db, { seed, heat: 0, track: true }); let cur = null, guard = 0;
  while (run.phase !== 'over' && ++guard < 200000) {
    let a = policyAction(db, run, { family: 'engine_run', level: 2 });
    const isBoss = run.phase === 'duel' && ((run.door && run.door.type === 'boss') || (run.rival && run.rival.tier === 'boss'));
    if (isBoss && (LONE === 'all' || LONE === String(run.floor))) { const v = viewFor(run.duel, db, 0); const c = chooseAction(db, v, 2, { ...familyOf(run, 'engine_run').duel, lone: true }); a = { t: 'duel', action: c || { t: 'end' } }; }
    const wasDuel = run.phase === 'duel', d0 = run.duel, tier = d0 && run.rival ? run.rival.tier : (run.door && run.door.type);
    if (wasDuel && !cur) cur = { max: 0, boss: (run.door && run.door.type === 'boss') || (run.rival && run.rival.tier === 'boss'), floor: run.floor };
    runApply(run, a, db);
    if (wasDuel && cur) {
      const d = run.duel || d0; if (d && d.mon) cur.max = Math.max(cur.max, d.mon[0].filter(Boolean).length);
      if (run.phase !== 'duel') { const won = d0.winner === 0 || (d0.over && d0.winner === 0); const k = cur.boss ? 'boss' : 'other'; T[k][0]++; if (cur.boss) { att[cur.floor] = (att[cur.floor] || 0) + 1; if (won) got[cur.floor] = (got[cur.floor] || 0) + 1; } if (won) { T[k][1]++; if (cur.max <= 1) { T[k][2]++; if (cur.boss) byFloor[cur.floor] = (byFloor[cur.floor] || 0) + 1; } if (cur.max <= 2) T[k][3]++; } cur = null; }
    }
  }
}
console.log('runs', N, 'guardian duels [played, won, won with at most one monster ever, at most two]', T.boss, 'other duels', T.other, 'lone guardian wins by floor', byFloor, 'guardian duels by floor', att, 'won', got, 'LONE', LONE);
