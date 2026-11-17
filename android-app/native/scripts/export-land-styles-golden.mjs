// The site's land-styles.js answers on real data, for LandStylesTest.kt (the app's port must answer the same).
// node scripts/export-land-styles-golden.mjs <web root>
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const web = resolve(process.argv[2] || '../..');
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const L = await import(pathToFileURL(join(web, 'land-styles.js')).href);
const data = JSON.parse(readFileSync(join(web, 'data/land-styles.json'), 'utf8'));
const list = L.landStyleList(data);
// A small file: the Forests and Islands only, with the starter and oracles.
const keep = data.styles.filter(s => s[1] === 1 || s[1] === 4);
const sets = Object.fromEntries([...new Set(keep.map(s => s[2]))].map(k => [k, data.sets[k]]));
const small = {styles: keep, sets, starter: data.starter, oracles: data.oracles};
const forests = list.filter(s => s.type === 'Forest');
const pick = (k, i) => forests.filter(s => s.kind === k)[i].id;
const styles = [{id: pick('f', 2), n: 'Forest', src: 'landcraft:x', on: false}, {id: pick('r', 40), n: 'Forest', src: 'landopen:p', on: true}, {id: pick('s', 3), n: 'Forest', src: 'landopen:q', on: false}];
const cards = [{n: 'Forest', s: ['dmu', 'BLB'], p: ''}, {n: 'Island', s: ['neo'], p: pick('r', 7)}];
const smallList = L.landStyleList(small);
const owned = L.ownedLandStyles(smallList, {styles, cards, starter: data.starter});
const out = {data: small, styles, cards,
  owned: Object.fromEntries([...owned].map(([k, v]) => [k, v])),
  sorted: Object.fromEntries(['recent', 'newest', 'oldest'].map(s => [s, L.sortLandStyles(smallList.filter(x => x.type === 'Forest'), owned, s, pick('r', 40)).map(x => x.id)])),
  chosen: {Forest: pick('r', 40)},
  inDeck: [[pick('f', 2), L.deckLandStyle('Forest', pick('f', 2), owned, {Forest: pick('r', 40)}, data.starter)],
           ['', L.deckLandStyle('Forest', '', owned, {Forest: pick('r', 40)}, data.starter)],
           [pick('s', 9), L.deckLandStyle('Forest', pick('s', 9), owned, {}, data.starter)]],
  craft: {r: L.landCraftSeal('r'), f: L.landCraftSeal('f'), s: L.landCraftSeal('s')}};
writeFileSync(join(app, 'app/src/test/resources/land-styles-golden.json'), JSON.stringify(out));
console.log('land styles golden:', smallList.length, 'styles,', owned.size, 'owned');
