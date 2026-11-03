// Writes the web's card-view data as one JSON asset, from the web's own modules, so the native card
// pop-up reads the same rule words (rule-dex.js) and draws the same foil recipes and frame boxes
// (mtg-foil-recipes.js, mtg-foil-analysis.js) as the site.
// Usage: node scripts/export-card-data.mjs <repo root> <out file> [<foil golden out>]
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out, golden] = process.argv.slice(2);
const mod = f => import(pathToFileURL(join(root, f)).href);
const dex = await mod('rule-dex.js');
const foil = await mod('mtg-foil-recipes.js');
const frames = await mod('mtg-foil-analysis.js');
const terms = dex.ruleTerms('mtg'), rules = {};
for (const key of Object.keys(terms)) {
  const h = dex.keywordHelp('mtg', key);
  if (!h) continue;
  rules[key] = {label: h.label, definition: h.definition, tip: h.tip || '', title: h.lesson?.title || '', example: h.lesson?.example || '', detail: h.lesson?.detail || ''};
}
const data = {rules, recipes: foil.MTG_FOIL_RECIPES, frames: frames.MTG_FRAMES, unmodelled: foil.MTG_UNMODELLED};
writeFileSync(out, JSON.stringify(data));
console.log(`card data: ${Object.keys(rules).length} rule words, ${Object.keys(data.recipes).length} foil recipes`);
// Golden foil choices: every promo tag the web knows plus the set, frame and finish cases, as the web picks them.
if (golden) {
  const tags = ['oilslick', 'stepandcompleat', 'gilded', 'neonink', 'textured', 'surgefoil', 'galaxyfoil', 'halofoil', 'confettifoil', 'doublerainbow',
    'fracturefoil', 'rainbowfoil', 'ripplefoil', 'manafoil', 'dragonscalefoil', 'invisibleink', 'silverfoil', 'firstplacefoil', 'raisedfoil', 'embossed',
    'ampersand', 'silverscreen', 'vaultboy', 'silverscroll', 'gleaminggold', 'cosmicfoil', 'serialized', 'boosterfun', 'mysteryfoil'];
  const cards = [
    ...tags.map(t => ({set: 'neo', frame: '2015', rarity: 'rare', promo_types: [t, 'boosterfun']})),
    {set: 'dbl', frame: '2015', rarity: 'common'}, {set: 'v13', set_type: 'from_the_vault', frame: '2015'}, {set: 'mps', set_type: 'masterpiece', frame: '2015'},
    {set: 'pd2', frame: '2003'}, {set: 'ulg', frame: '1997', rarity: 'rare'}, {set: 'lea', frame: '1993', rarity: 'rare'}, {set: 'hob', frame: '2015', rarity: 'mythic'},
    {set: 'hob', frame: '2015', rarity: 'mythic', border_color: 'borderless'}, {set: 'hob', frame: '2015', rarity: 'uncommon'}, {set: 'mh2', frame: '2003', rarity: 'rare'},
    {set: 'hob', frame: '2015', rarity: 'rare', full_art: true}];
  const rows = [];
  for (const c of cards) for (const finish of ['nonfoil', 'foil', 'etched']) {
    const p = foil.mtgFoilProfile(c, finish);
    rows.push({card: c, finish, treatment: p.treatment, status: p.status, name: p.name, unrecognized: p.unrecognized, stamp: !!foil.mtgHoloStamp(c), frame: foil.mtgFrameKey(c)});
  }
  writeFileSync(golden, JSON.stringify(rows));
  console.log(`foil golden: ${rows.length} rows`);
}
