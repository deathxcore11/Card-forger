// Golden values from the web's own Play rules, for PlayMathTest (node scripts/play-golden.mjs <repo> <out>).
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const ach = await import(pathToFileURL(join(root, 'play-achievements.js')).href);
const rules = await import(pathToFileURL(join(root, 'play-econ-rules.js')).href);
const story = await import(pathToFileURL(join(root, 'story-client.js')).href).catch(() => null);
const state = {wallet: {coins: 1234, xp: 2750, packs_opened: 12, seal_c: 1, seal_u: 2, seal_r: 3, seal_m: 0, starter_at: 'x'}, packs: [{id: 1, set: 'lea'}],
  cards: [{c: 4, r: 'mythic'}, {c: 2, r: 'rare'}, {c: 5, r: 'common'}],
  counters: {matches: 14, wins: 9, 'fmt:Modern': 2, 'fmt:Legacy': 1, 'd:2026-11-03:matches': 2, 'd:2026-11-03:wins': 1, 'w:2026-W45:wins': 7, 'w:2026-W45:matches': 4, logins: 8},
  claimed: ['ach:victor:0', 'daily:2026-11-03:first'], config: {}};
const days = ['2026-11-03', '2026-01-01', '2026-12-31', '2027-01-03', '2024-02-29'];
const rows = ach.achievementRows({counters: state.counters, claimed: state.claimed, state});
const g = {
  state,
  weeks: Object.fromEntries(days.map(d => [d, ach.playWeek(d)])),
  daily: Object.fromEntries(days.map(d => [d, ach.dailyQuests(d, '').map(q => q.id)])),
  quests: ach.questRows({counters: state.counters, claimed: state.claimed, day: '2026-11-03', user: ''}),
  totals: ach.deedTotals(rows),
  near: ach.almostThere(rows, 2).map(r => r.id),
  values: Object.fromEntries(rows.map(r => [r.id, r.value])),
  mastery: rules.masteryLevel({}, 2750),
  playDay: [ach.playDay(-300, Date.UTC(2026, 10, 3, 2, 0)), ach.playDay(900, Date.UTC(2026, 10, 3, 20, 0))],
};
if (story) { const refs = ['story:a1b1:loaner', 'story:a1b2:clear', 'story:a1b3:own']; const p = story.progressFromRefs(refs); g.story = {refs, act: story.currentAct(p), won: Array.from({length: 8}, (_, i) => story.battleCleared(p, `a1b${i + 1}`)).filter(Boolean).length}; }
writeFileSync(out, JSON.stringify(g));
