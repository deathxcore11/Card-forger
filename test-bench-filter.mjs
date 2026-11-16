// The deck builder's filters (bench-filter.js), ported from the native BenchFilter.kt: the same rules for the pool, the chips,
// the live count, Scryfall's words, the curve and the list by mana value.
import assert from 'node:assert/strict';
import {BENCH, emptyBench, benchCount, benchKeeps, benchSorted, benchChips, benchToggle, benchColorKeeps, benchQuery, benchColorQuery, benchCurve, benchByMana, allColors, roleTags, bucket, manaLabel} from './bench-filter.js';

const tile = o => ({name: 'X', cmc: 0, land: false, colors: [], typeLine: '', rarity: 'common', own: 0, inDeck: 0, set: '', sets: [], released: '', ...o});
const f = o => ({...emptyBench(), ...o});
const keep = (t, o = {}, find = '', colors = [], roles = null) => benchKeeps(t, f(o), find, colors, roles);

// Word lists, in the order they show.
assert.deepEqual(BENCH.COLORS, ['W', 'U', 'B', 'R', 'G', 'C', 'M']);
assert.deepEqual(BENCH.MANA, [0, 1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(BENCH.DOES.map(x => x[1]), ['Ramp', 'Draw', 'Removal', 'Sweeper', 'Protection', 'Finisher']);
assert.deepEqual(BENCH.SORTS.map(x => x[0]), ['mv', 'name', 'rarity', 'new', 'copies']);
assert.equal(manaLabel(7), '7+'); assert.equal(manaLabel(9), '7+'); assert.equal(manaLabel(3), '3');
assert.equal(bucket(2.5), 2); assert.equal(bucket(12), 7); assert.equal(bucket(-1), 0); assert.equal(bucket(undefined), 0);
assert.deepEqual(emptyBench('name').sort, 'name'); assert.equal(emptyBench('bogus').sort, 'mv');

// Colours: C keeps colourless non-land cards and drops lands; M needs two colours or more.
const golem = tile({name: 'Golem', colors: []}), wastes = tile({name: 'Waste', colors: [], land: true}), gold = tile({name: 'Gold', colors: ['W', 'U']}), red = tile({name: 'Red', colors: ['R']});
assert.ok(benchColorKeeps(golem, ['C']) && !benchColorKeeps(wastes, ['C']), 'C is colourless and not a land');
assert.ok(benchColorKeeps(gold, ['M']) && !benchColorKeeps(red, ['M']), 'M needs 2+ colours');
assert.ok(benchColorKeeps(gold, ['U']) && !benchColorKeeps(gold, ['R']));
assert.ok(keep(red, {}, '', ['R', 'C']) && keep(golem, {}, '', ['R', 'C']) && !keep(gold, {}, '', ['R', 'C']), 'colours are an or');

// Find is a name search, any case.
assert.ok(keep(tile({name: 'Llanowar Elves'}), {}, 'elv') && !keep(tile({name: 'Shock'}), {}, 'elv'));

// Mana value drops lands; 7 means 7 and up.
assert.ok(keep(tile({cmc: 9}), {mana: [7]}) && !keep(tile({cmc: 6}), {mana: [7]}));
assert.ok(!keep(tile({cmc: 0, land: true}), {mana: [0]}), 'a land is not on the mana value filter');
assert.ok(keep(tile({cmc: 2}), {mana: [1, 2]}));

// Type matches either face: Instant // Land shows under Land too.
const mdfc = tile({typeLine: 'Instant // Land', cmc: 2});
assert.ok(keep(mdfc, {types: ['Land']}) && keep(mdfc, {types: ['Instant']}) && !keep(mdfc, {types: ['Creature']}));
assert.ok(!keep(tile({typeLine: 'Enchantment Creature — Spirit'}), {types: ['Artifact']}));

// Does reads the roles by name, then by the front face's name; a card with no roles yet is left out.
const roles = new Map([['Bala Ged Recovery', ['ramp']], ['Shock', ['removal']]]);
assert.ok(keep(tile({name: 'Bala Ged Recovery // Bala Ged Sanctuary'}), {does: ['ramp']}, '', [], roles), 'front face name');
assert.ok(keep(tile({name: 'Shock'}), {does: ['removal', 'draw']}, '', [], roles));
assert.ok(!keep(tile({name: 'Shock'}), {does: ['draw']}, '', [], roles));
assert.ok(!keep(tile({name: 'Unknown'}), {does: ['ramp']}, '', [], roles), 'no tags yet: left out');

// Rarity, copies (4 is 4 and up), Not in this deck, set or any of the sets.
assert.ok(keep(tile({rarity: 'Rare'}), {rarity: ['rare']}) && !keep(tile({rarity: 'common'}), {rarity: ['rare']}));
assert.ok(keep(tile({own: 6}), {copies: [4]}) && !keep(tile({own: 3}), {copies: [4]}) && keep(tile({own: 3}), {copies: [1, 3]}) && !keep(tile({own: 0}), {copies: [1]}));
assert.ok(!keep(tile({inDeck: 2}), {notInDeck: true}) && keep(tile({inDeck: 0}), {notInDeck: true}));
assert.ok(keep(tile({set: 'DSK'}), {set: 'dsk'}) && keep(tile({set: 'fdn', sets: ['fdn', 'dsk']}), {set: 'dsk'}) && !keep(tile({set: 'fdn'}), {set: 'dsk'}));

// The badge counts panel picks (colours and Sort are not counted).
assert.equal(benchCount(emptyBench()), 0);
assert.equal(benchCount(f({mana: [1, 2], types: ['Land'], does: ['ramp'], rarity: ['rare'], copies: [4], notInDeck: true, set: 'dsk', sort: 'name'})), 8);

// Chips: one per pick, in the panel's order, each naming what its × takes off.
const all = f({mana: [7, 1], types: ['Land', 'Creature'], does: ['wipe'], rarity: ['mythic', 'common'], copies: [4, 2], notInDeck: true, set: 'dsk'});
assert.deepEqual(benchChips(all, c => c === 'dsk' ? 'Duskmourn' : c).map(c => c.label),
  ['Mana 1', 'Mana 7+', 'Creature', 'Land', 'Sweeper', 'Common', 'Mythic', 'Own 2', 'Own 4+', 'Not in this deck', 'Duskmourn']);
assert.deepEqual(benchChips(f({set: 'xyz'})).map(c => c.label), ['XYZ']);
for (const c of benchChips(all)) assert.equal(benchCount(benchToggle(all, c.field, c.value)), benchCount(all) - 1, 'each × takes one pick off: ' + c.label);
assert.deepEqual(benchToggle(f(), 'mana', '3').mana, [3]);
assert.deepEqual(benchToggle(f({mana: [3]}), 'mana', '3').mana, []);
assert.equal(benchToggle(f(), 'notInDeck', '1').notInDeck, true);
assert.deepEqual(benchToggle(f(), 'bogus', 'x'), f(), 'an unknown field changes nothing');

// Scryfall's words, exactly as the native app sends them.
assert.deepEqual(benchQuery(f({mana: [7, 1]})), ['(mv=1 or mv>=7)']);
assert.deepEqual(benchQuery(f({types: ['Creature', 'Land']})), ['(t:creature or t:land)']);
assert.deepEqual(benchQuery(f({rarity: ['rare']})), ['(r:rare)']);
assert.deepEqual(benchQuery(f({set: 'DSK'})), ['s:dsk']);
assert.deepEqual(benchQuery(f({does: ['ramp'], copies: [1], notInDeck: true})), [], 'Does and copies stay local');
assert.equal(benchColorQuery(['W', 'U']), '(c:w or c:u)');
assert.equal(benchColorQuery(['C', 'M']), '(c:c or c:m)');
assert.equal(benchColorQuery([]), '');

// Sort.
const ts = [tile({name: 'b', cmc: 3, rarity: 'common', released: '2020-01-01', own: 1}), tile({name: 'a', cmc: 1, rarity: 'mythic', released: '2024-01-01', own: 4}), tile({name: 'c', cmc: 0, land: true, rarity: 'rare', released: '2022-01-01', own: 2})];
assert.deepEqual(benchSorted(ts, 'name').map(t => t.name), ['a', 'b', 'c']);
assert.deepEqual(benchSorted(ts, 'rarity').map(t => t.name), ['a', 'c', 'b']);
assert.deepEqual(benchSorted(ts, 'new').map(t => t.name), ['a', 'c', 'b']);
assert.deepEqual(benchSorted(ts, 'copies').map(t => t.name), ['a', 'c', 'b']);
assert.deepEqual(benchSorted(ts, 'mv').map(t => t.name), ['a', 'b', 'c'], 'mana value, lands last');

// Colours read every face; else the cost's symbols (a double-faced card has no top-level colours); else identity.
assert.deepEqual(allColors({colors: ['G']}), ['G']);
assert.deepEqual(allColors({colors: []}), []);
assert.deepEqual(allColors({card_faces: [{colors: ['W']}, {colors: ['B']}]}), ['W', 'B']);
assert.deepEqual(allColors({card_faces: [{mana_cost: '{1}{U}', type_line: 'Instant'}, {mana_cost: '', type_line: 'Land'}]}), ['U']);
assert.deepEqual(allColors({mana_cost: '{W/U}{2}'}), ['W', 'U'], 'hybrid counts both');
assert.deepEqual(allColors({color_identity: ['R', 'G']}), ['R', 'G']);
assert.deepEqual(allColors(null), []);
// Double-faced cards (real Scryfall fields): Scryfall gives them no top-level colours, only each face's. slimCard keeps those,
// so a Pathway is colourless (not its identity) and a back face coloured by its indicator counts, as native allColorsOf.
{
  const {slimCard} = await import('./play-econ-cards.js');
  const henge = {name: 'Hengegate Pathway // Mistgate Pathway', layout: 'modal_dfc', color_identity: ['U', 'W'], card_faces: [{name: 'Hengegate Pathway', type_line: 'Land', mana_cost: '', colors: []}, {name: 'Mistgate Pathway', type_line: 'Land', mana_cost: '', colors: []}]};
  const ajani = {name: 'Ajani, Nacatl Pariah // Ajani, Nacatl Avenger', layout: 'transform', color_identity: ['R', 'W'], card_faces: [{name: 'Ajani, Nacatl Pariah', type_line: 'Legendary Creature — Cat Warrior', mana_cost: '{1}{W}', colors: ['W']}, {name: 'Ajani, Nacatl Avenger', type_line: 'Legendary Planeswalker — Ajani', mana_cost: '', colors: ['R', 'W'], color_indicator: ['R', 'W']}]};
  assert.deepEqual(slimCard(ajani).card_faces.map(f => f.colors), [['W'], ['R', 'W']], 'slimCard keeps each face\'s colours');
  assert.deepEqual(allColors(slimCard(henge)), [], 'a Pathway is colourless');
  assert.deepEqual(allColors(slimCard(ajani)).sort(), ['R', 'W']);
  const keep = (card, colors) => benchColorKeeps({colors: allColors(slimCard(card)), land: true}, colors);
  assert.ok(!keep(henge, ['W']) && !keep(henge, ['M']), 'a Pathway is not White or Multicolour');
  assert.ok(benchColorKeeps({colors: allColors(slimCard(ajani))}, ['M']), 'Ajani is Multicolour');
  // Saved before faces kept their colours: a face with no cost is colourless if it is a land, else identity fills in.
  const old = c => ({...c, card_faces: c.card_faces.map(({colors, color_indicator, ...f}) => f)});
  assert.deepEqual(allColors(old(henge)), []);
  assert.deepEqual(allColors(old(ajani)), ['R', 'W']);
}

// The curve: spells only (no lands, no rows without a mana value yet), 7 and up together.
assert.deepEqual(benchCurve([{qty: 4, cmc: 1}, {qty: 2, cmc: 9}, {qty: 3, cmc: 7}, {qty: 20, cmc: 0, land: true}, {qty: 1, cmc: null}, {qty: 2, cmc: 2.5}]), [0, 4, 2, 0, 0, 0, 0, 5]);

// The list by mana value: each value by name, then Other, then Lands.
const byMana = benchByMana([
  {name: 'Creatures', rows: [{name: 'Zebra', qty: 1, cmc: 2}, {name: 'Elves', qty: 4, cmc: 1}]},
  {name: 'Instants', rows: [{name: 'Bolt', qty: 4, cmc: 1}, {name: 'Loading', qty: 1, cmc: null}]},
  {name: 'Lands', rows: [{name: 'Forest', qty: 20, cmc: null}]}]);
assert.deepEqual(byMana.map(g => g.name), ['Mana value 1', 'Mana value 2', 'Other', 'Lands']);
assert.deepEqual(byMana[0].rows.map(r => r.name), ['Bolt', 'Elves']);

// Does: the builder's own role tags on real cards.
const elves = {name: 'Llanowar Elves', type_line: 'Creature — Elf Druid', mana_cost: '{G}', cmc: 1, oracle_text: '{T}: Add {G}.'};
const wrath = {name: 'Wrath of God', type_line: 'Sorcery', mana_cost: '{2}{W}{W}', cmc: 4, oracle_text: "Destroy all creatures. They can't be regenerated."};
assert.ok(roleTags(elves).includes('ramp'), 'Llanowar Elves is ramp');
assert.ok(roleTags(wrath).includes('wipe'), 'Wrath of God is a sweeper');
assert.ok(roleTags(elves).every(t => BENCH.DOES.some(([k]) => k === t)), 'only the tags the panel offers');
assert.deepEqual(roleTags(null), []);

console.log('bench filter ok');
