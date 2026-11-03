// Golden answers from the web's own Play deck rules, for DecksTest (node scripts/export-deck-golden.mjs <repo> <out>).
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const R = await import(pathToFileURL(join(root, 'play-econ-rules.js')).href);
const owned = new Map([['Lightning Bolt', 4], ['Counterspell', 1], ['Delver of Secrets', 2], ['Brainstorm', 0]]);
const rarity = new Map([['Lightning Bolt', 'common'], ['Counterspell', 'uncommon'], ['Snapcaster Mage', 'rare'], ['Ragavan, Nimble Pilferer', 'mythic'], ['Delver of Secrets', 'special']]);
const decks = [
  [{name: 'Lightning Bolt', qty: 4}, {name: 'Counterspell', qty: 4}, {name: 'Snapcaster Mage', qty: 3}, {name: 'Island', qty: 20}, {name: 'Ragavan, Nimble Pilferer', qty: 6}, {name: 'Delver of Secrets', qty: 4, board: 'side'}],
  [{name: 'Island', qty: 60}], [], [{name: 'Brainstorm', qty: 0}, {name: 'Unknown Card', qty: 2}],
];
const legal = new Map([['Lightning Bolt', {standard: 'not_legal', pioneer: 'not_legal', modern: 'legal', legacy: 'legal', vintage: 'legal', pauper: 'legal', commander: 'legal'}],
  ['Island', {standard: 'legal', pioneer: 'legal', modern: 'legal', legacy: 'legal', vintage: 'legal', pauper: 'legal', commander: 'legal'}],
  ['Black Lotus', {vintage: 'restricted', commander: 'banned', legacy: 'banned'}],
  ['Sol Ring', {vintage: 'restricted', commander: 'legal', legacy: 'banned'}]]);
const lists = [
  [{name: 'Lightning Bolt', qty: 4}, {name: 'Island', qty: 56}], [{name: 'Island', qty: 59}], [{name: 'Island', qty: 99}, {name: 'Sol Ring', qty: 1}],
  [{name: 'Black Lotus', qty: 1}, {name: 'Island', qty: 59}], [{name: 'Black Lotus', qty: 2}, {name: 'Island', qty: 58}], [{name: 'Lightning Bolt', qty: 5}, {name: 'Island', qty: 55}],
  [{name: 'Island', qty: 60}, {name: 'Mystery', qty: 1, board: 'side'}]];
const g = {
  shortfall: decks.map(d => ({deck: d, out: R.deckShortfall(d, owned, rarity)})),
  owned: Object.fromEntries(owned), rarity: Object.fromEntries(rarity), legal: Object.fromEntries(legal),
  legalFormats: lists.map(l => ({rows: l, out: R.legalFormats(l, legal)})),
  precon: [0, 1, 5, 10, 40, 59, 60, 61, 200].map(n => [n, R.preconPrice(n, {}), R.preconPrice(n, {precon: {min: 100, max: 900, perCard: 10}})]),
  rules: R.PLAY_FORMATS.concat(['Casual', '']).map(f => [f, R.deckRules(f)]),
  basics: ['Plains', 'snow-covered island', 'Wastes', 'Snow-Covered Wastes', ' Forest ', 'Island // x'].map(n => [n, R.isBasicLand(n)]),
};
writeFileSync(out, JSON.stringify(g));
console.log('deck golden written');
