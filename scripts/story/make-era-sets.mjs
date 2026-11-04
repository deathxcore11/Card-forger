// Writes scripts/story/era-sets.json: for each Story act, the sets whose cards were legal in the era's tournament
// format, so a deck may use older cards the way real players did (not only the act's own sets).
// Acts 1-4 (Type 1 days): every set from earlier acts. Act 5 on: the Standard card pool (Forge archived Standard)
// on the day the act's newest set came out. Usage: node scripts/story/make-era-sets.mjs <forge root, e.g. /tmp/fe/root>
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {STORY_ACTS} from '../../story-acts.js';
const root = process.argv[2] || '/tmp/fe/root', dir = `${root}/forge/forge-gui/res/formats/Archived/Standard`;
const files = readdirSync(dir).filter(f => f.endsWith('.txt')).sort().map(f => {
  const t = readFileSync(`${dir}/${f}`, 'utf8');
  return {date: f.slice(0, -4), name: t.match(/^Name:(.*)$/m)?.[1]?.trim(), sets: (t.match(/^Sets:(.*)$/m)?.[1] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)};
});
const out = {}, seen = [];
for (const a of STORY_ACTS) {
  let extra = [], note;
  if (a.act <= 4) { extra = [...seen]; note = 'all earlier sets (Type 1)'; }
  else {
    const last = a.sets[a.sets.length - 1];
    const f = files.find(x => x.sets.includes(last)) || files.filter(x => x.sets.some(s => a.sets.includes(s))).pop();
    if (f) { extra = f.sets; note = `Standard ${f.date} ${f.name}`; } else note = 'no archived Standard file';
  }
  out[a.act] = {sets: [...new Set(extra)].filter(s => !a.sets.includes(s)), note};
  seen.push(...a.sets);
}
writeFileSync(new URL('./era-sets.json', import.meta.url), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, v.note, '|', v.sets.join(','));
