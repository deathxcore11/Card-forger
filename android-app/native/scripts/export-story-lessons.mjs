// Writes the web's Story lessons as one JSON asset, from the web's own modules:
//   lessons  story-ui.js LESSONS, one plain sentence per mechanic a battle introduces (the duel page's "teaches")
//   battles, say, words, stacks  story-lessons.js, the Rift's in-match whispers: which ideas each Act 1 lesson battle
//            teaches, their lines, the new-mechanic words for later acts, and the lesson battles' stacked draws
// Usage: node scripts/export-story-lessons.mjs <repo root> <out file>
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const mod = f => import(pathToFileURL(join(root, f)).href);
const ui = await mod('story-ui.js');
const les = await mod('story-lessons.js');
// WORDS is private to story-lessons.js: read it from the file as written, so the app's list is the site's own.
const src = readFileSync(join(root, 'story-lessons.js'), 'utf8');
const m = src.match(/\nconst WORDS = (\[[\s\S]*?\n\]);/);
if (!m) throw new Error('story-lessons.js: WORDS not found');
const WORDS = Function(`"use strict"; return ${m[1]};`)();
const data = {
  lessons: ui.LESSONS,
  battles: les.LESSON_BATTLES,
  say: les.SAY,
  words: WORDS.map(([name, re, text]) => ({name, re: re ? re.source : null, ignoreCase: !!re?.flags.includes('i'), text})),
  stacks: les.LESSON_STACKS,
};
writeFileSync(out, JSON.stringify(data));
console.log(`story lessons: ${Object.keys(data.lessons).length} lesson lines, ${Object.keys(data.battles).length} lesson battles, ${data.words.length} words`);
