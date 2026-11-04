// Writes the web's Story deeds (story-deeds.js: every battle deed's data test, plus the act deeds) as one JSON asset,
// so the native app judges a won battle by the same rule data the web and the server read.
// Usage: node scripts/export-story-deeds.mjs <repo root> <out file>
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const d = await import(pathToFileURL(join(root, 'story-deeds.js')).href);
const slim = x => ({id: x.id, act: x.act, battle: x.battle, title: x.title, seat: x.seat, when: x.when, hidden: !!x.hidden, gold: !!x.gold});
const acts = d.STORY_ACT_DEEDS.map(x => ({id: x.id, act: x.act, kind: x.kind, title: x.title}));
writeFileSync(out, JSON.stringify({deeds: d.STORY_DEEDS.map(slim), acts}));
console.log(`story deeds: ${d.STORY_DEEDS.length} battle deeds, ${acts.length} act deeds`);
