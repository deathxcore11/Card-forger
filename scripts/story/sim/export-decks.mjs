// Writes the "qty|name|SET" deck files DeedSim and StorySim read, for every battle of the given acts.
// Usage: node scripts/story/sim/export-decks.mjs <outDir> <act...>   (files: <outDir>/<battle>-hero.txt, -villain.txt)
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const [out, ...acts] = process.argv.slice(2);
mkdirSync(out, {recursive: true});
// Desktop Forge knows Kamigawa flip cards by their front face only.
const simName = x => /^(chk|bok|sok)$/.test(x.set) ? x.name.split(' // ')[0] : x.name;
for (const a of acts) {
  const data = JSON.parse(readFileSync(new URL(`../../../data/story/act-${a}.json`, import.meta.url), 'utf8'));
  for (const b of data.battles) for (const seat of ['hero', 'villain'])
    writeFileSync(`${out}/${b.id}-${seat}.txt`, b[seat].deck.cards.map(x => `${x.qty}|${simName(x)}|${x.set.toUpperCase()}`).join('\n') + '\n');
}
