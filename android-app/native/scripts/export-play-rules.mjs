// Writes the web's Play rule data as one JSON asset, so the native app reads the same achievements,
// quests, log-in calendar, Story acts, CPU levels and playmats as the web, from the web's own modules.
// Usage: node scripts/export-play-rules.mjs <repo root> <out file>
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const mod = f => import(pathToFileURL(join(root, f)).href);
const ach = await mod('play-achievements.js');
const acts = await mod('story-acts.js');
const home = await mod('play-home.js');
const cpu = await mod('play-forge-cpu-policy.js');
const mats = await mod('play-playmats.js');
const rules = await mod('play-econ-rules.js');
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const data = {
  achievements: ach.ACHIEVEMENTS.map(a => pick(a, ['id', 'tab', 'title', 'lore', 'art', 'source', 'steps', 'feat', 'hidden', 'riddle', 'unit'])),
  deedTabs: ach.DEED_TABS,
  dailyEasy: ach.DAILY_EASY, dailyHard: ach.DAILY_HARD, firstMatch: ach.FIRST_MATCH, weekly: ach.WEEKLY,
  loginWeek: ach.LOGIN_WEEK,
  storyActs: home.STORY_ACTS,
  setNames: acts.SET_NAMES,
  cpuPolicies: cpu.FORGE_CPU_POLICIES, cpuLabels: cpu.FORGE_CPU_LABELS,
  playmats: mats.PLAYMATS,
  playFormats: rules.PLAY_FORMATS,
};
writeFileSync(out, JSON.stringify(data));
console.log(`play rules: ${data.achievements.length} achievements, ${data.storyActs.length} acts, ${data.playmats.length} mats`);
