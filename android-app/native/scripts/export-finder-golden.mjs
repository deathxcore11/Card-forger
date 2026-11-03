// Golden answers from the web's finder (play-deck-finder.js, play-econ-rules.js) for FinderTest.
// node scripts/export-finder-golden.mjs <web root at the finder commit> <out>
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const F = await import(pathToFileURL(join(root, 'play-deck-finder.js')).href);
const R = await import(pathToFileURL(join(root, 'play-econ-rules.js')).href);
const card = (name, type, rarity, ci, extra = {}) => ({name, type_line: type, rarity, color_identity: ci, image_uris: {normal: `https://img/${encodeURIComponent(name)}.jpg`, art_crop: `https://art/${encodeURIComponent(name)}.jpg`}, legalities: {vintage: 'legal', legacy: 'legal', modern: 'legal', commander: 'legal', standardbrawl: 'legal'}, ...extra});
const cards = [
  card('Lightning Bolt', 'Instant', 'common', ['R']), card('Ragavan, Nimble Pilferer', 'Legendary Creature — Monkey Pirate', 'mythic', ['R']),
  card('Delver of Secrets // Insectile Aberration', 'Creature — Human Wizard // Creature — Human Insect', 'common', ['U']), card('Counterspell', 'Instant', 'uncommon', ['U']),
  card('Snapcaster Mage', 'Creature — Human Wizard', 'rare', ['U']), card('Sol Ring', 'Artifact', 'uncommon', [], {legalities: {vintage: 'restricted', commander: 'legal', legacy: 'banned'}}),
  card('Black Lotus', 'Artifact', 'rare', [], {legalities: {vintage: 'restricted'}}), card('Jace, the Mind Sculptor', 'Legendary Planeswalker — Jace', 'mythic', ['U']),
  card('Volcanic Island', 'Land — Island Mountain', 'rare', ['U', 'R']), card('Kinnan, Bonder Prodigy', 'Legendary Creature — Human Druid', 'mythic', ['G', 'U']),
  card('Opt', 'Instant', 'common', ['U']), card('Fable of the Mirror-Breaker // Reflection of Kiki-Jiki', 'Enchantment — Saga // Enchantment Creature — Goblin Shaman', 'rare', ['R']),
];
const byName = new Map(cards.flatMap(c => [[c.name, c], [c.name.split(' // ')[0], c]]));
const cardOf = n => byName.get(n) || null;
const owned = new Map([['Lightning Bolt', 4], ['Ragavan, Nimble Pilferer', 1], ['Delver of Secrets', 8], ['Counterspell', 2], ['Opt', 3], ['Sol Ring', 1], ['Volcanic Island', 2]]);
const L = (key, name, format, rows, extra = {}) => ({key, name, format, cards: rows.map(([qty, n, board]) => ({name: n, qty, ...(board ? {board} : {})})), ...extra});
const lists = [
  L('m1', 'Izzet Murktide', 'Modern', [[4, 'Lightning Bolt'], [4, 'Ragavan, Nimble Pilferer'], [4, 'Delver of Secrets'], [4, 'Counterspell'], [3, 'Snapcaster Mage'], [4, 'Opt'], [20, 'Island'], [17, 'Mountain'], [2, 'Jace, the Mind Sculptor', 'side']], {archetype: 'Izzet Tempo', source: 'Top 8', detail: 'Regional'}),
  L('m2', 'UR Tempo', 'Modern', [[4, 'Lightning Bolt'], [4, 'Ragavan, Nimble Pilferer'], [4, 'Delver of Secrets'], [3, 'Counterspell'], [4, 'Opt'], [2, 'Fable of the Mirror-Breaker'], [39, 'Island']], {archetype: 'Izzet Tempo'}),
  L('m3', 'Mono Blue', 'Modern', [[4, 'Opt'], [4, 'Counterspell'], [4, 'Snapcaster Mage'], [4, 'Jace, the Mind Sculptor'], [44, 'Island']], {archetype: 'Mono Blue'}),
  L('v1', 'Vintage Power', 'Vintage', [[1, 'Black Lotus'], [1, 'Sol Ring'], [4, 'Volcanic Island'], [4, 'Lightning Bolt'], [50, 'Island']]),
  L('c1', 'Kinnan', 'Commander', [[1, 'Kinnan, Bonder Prodigy'], [1, 'Sol Ring'], [1, 'Opt'], [97, 'Forest']], {commander: 'Kinnan, Bonder Prodigy'}),
  L('t1', 'Forged from your Trunk', 'Modern', [[4, 'Lightning Bolt'], [4, 'Opt'], [20, 'Mountain']], {trunk: true, size: 60, detail: '32 slots to fill'}),
  L('m4', 'Burn', 'Modern', [[4, 'Lightning Bolt'], [56, 'Mountain']], {archetype: 'Burn'}),
];
const rarity = new Map([['Lightning Bolt', 'common'], ['Ragavan, Nimble Pilferer', 'mythic'], ['Delver of Secrets', 'common'], ['Counterspell', 'common'], ['Snapcaster Mage', 'rare'], ['Opt', 'common']]);
const rarityOf = n => rarity.get(n) || '';
const sealSets = [null, {c: 0, u: 0, r: 0, m: 0}, {c: 20, u: 5, r: 4, m: 3}];
const clusters = F.clusterArchetypes(lists);
const g = {
  cards, owned: Object.fromEntries(owned), rarity: Object.fromEntries(rarity), lists,
  rules: R.PLAY_FORMATS.concat(['Casual', '']).map(f => [f, R.deckRules(f)]),
  caps: [['Sol Ring', 'Vintage'], ['Sol Ring', 'Commander'], ['Lightning Bolt', 'Modern'], ['Island', 'Modern'], ['Black Lotus', 'Vintage'], ['Opt', 'Standard Brawl']].map(([n, f]) => [n, f, R.copyCap(n, f, cardOf(n)?.legalities) === Infinity ? 999999 : R.copyCap(n, f, cardOf(n)?.legalities)]),
  clusters: lists.map(l => [l.key, clusters.of(l.key)]),
  rows: lists.flatMap(l => sealSets.map(seals => ({key: l.key, seals, out: F.finderRow(l, {owned, cardOf, seals, rarityOf})}))),
  shares: lists.flatMap(l => [{key: l.key, plain: true, out: F.ownedShare(l, owned)}, ...sealSets.slice(1).map(seals => ({key: l.key, seals, out: F.ownedShare(l, owned, {rarityOf, seals})}))]),
  ranks: [],
};
for (const sort of ['owned', 'popular', 'ready']) for (const filter of ['all', 'trunk', 'craftable']) for (const query of ['', 'bolt', 'mono']) for (const cl of [false, true]) {
  const r = F.rankFinderLists(lists, {owned, sort, query, filter, rarityOf, seals: sealSets[2], clusters: cl ? clusters : null});
  g.ranks.push({sort, filter, query, clusters: cl, keys: r.map(x => x.list.key), arch: F.finderArchetypes(r, cl ? clusters : null).map(a => ({id: a.id, name: a.name, size: a.size, lead: a.lead.list.key, variants: a.variants.map(v => v.list.key)}))});
}
for (const row of g.rows) { delete row.out.list; row.out.shortfall = {missing: row.out.shortfall.missing, seals: row.out.shortfall.seals, complete: row.out.shortfall.complete}; }
writeFileSync(out, JSON.stringify(g));
console.log('finder golden written', g.rows.length, g.ranks.length);
