// Deck Forge rules table: every rule's must-match and must-not-match cards
// (real Scryfall oracle text), the four questions for Hei Bai, overlap
// scoring and the deck doctor's honest counts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DECK_TAGS, forgeTags, commanderHooks, forgeFit, forgeScore, deckDoctor, forgeNoise, forgeDiscoveryQueries } from './deck-forge.js';

const cards = JSON.parse(fs.readFileSync(new URL('./test-fixtures/deck-forge-cards.json', import.meta.url)));
const card = name => cards[name];
const fails = [];
for (const rule of DECK_TAGS.rules) {
 for (const name of rule.mustMatch) { const c = card(name); if (!c) { fails.push(`${rule.id}: fixture missing ${name}`); continue; } if (!forgeTags(c).some(t => t.tag === rule.tag)) fails.push(`${rule.id} (${rule.tag}) should match ${name}`); }
 for (const name of rule.mustNotMatch) { const c = card(name); if (!c) { fails.push(`${rule.id}: fixture missing ${name}`); continue; } const t = forgeTags(c).find(t => t.tag === rule.tag); if (t && t.rule === rule.id) fails.push(`${rule.id} (${rule.tag}) must NOT match ${name}`); }
}
assert.deepEqual(fails, [], fails.join('\n'));

// Burst never counts as ramp; the reducer needs its card type.
const tagNames = n => forgeTags(card(n)).map(t => t.tag);
for (const n of ['Lotus Petal', 'Cabal Ritual', 'Dark Ritual']) { assert.ok(tagNames(n).includes('burst'), n); assert.ok(!tagNames(n).includes('ramp'), n); }
for (const n of ['Sol Ring', 'Arcane Signet', 'Birds of Paradise', 'Ornithopter of Paradise', 'Rampant Growth', 'Knight of the White Orchid']) assert.ok(tagNames(n).includes('ramp'), n);
assert.equal(forgeTags(card('Sol Ring')).find(t => t.tag === 'ramp').tier, 'A');
assert.ok(!tagNames('Opt').includes('draw') && !tagNames('Brainstorm').includes('draw'), 'cantrips are not card advantage');

// THE FOUR QUESTIONS for Hei Bai produce the video's groups.
const hei = card('Hei Bai, Spirit of Balance'), hooks = commanderHooks(hei), ids = hooks.map(h => h.id);
for (const id of ['reenter', 'attack-helpers', 'attackers', 'protection', 'ways-to-leave', 'fodder', 'sac-outlets', 'death-payoffs', 'enter-value', 'counters', 'recipients']) assert.ok(ids.includes(id), 'Hei Bai hook ' + id + ' in ' + ids);
assert.equal(hooks.find(h => h.id === 'fodder').min, 10);
// Artifact fodder counts because Hei Bai accepts "creature or artifact".
for (const n of ['Ichor Wellspring', 'Mind Stone', "Wayfarer's Bauble", 'Ancient Den', 'Pitiless Plunderer']) assert.ok(hooks.find(h => h.id === 'fodder').match(card(n)), n + ' is fodder');

// Overlap: multi-hook cards rise to the top, off-plan cards sink.
const fit = n => forgeFit(card(n), hooks, { leader: hei });
for (const n of ['Ichor Wellspring', 'Restoration Angel', 'Angel of Indemnity', 'Airbender Ascension']) assert.ok(fit(n).n >= 2, `${n} hits ${fit(n).n}: ${fit(n).hooks} ${fit(n).conditions}`);
assert.ok(fit('Angel of Indemnity').conditions.some(w => w.includes('Hei Bai')), 'Angel of Indemnity can return Hei Bai (MV 4)');
assert.ok(fit("Vraska, Betrayal's Sting").bar === 'fail', 'Vraska fails the 6-mana bar');
assert.ok(fit('Starfield Mystic').penalty > 0, 'Starfield Mystic penalised');
const s = n => forgeScore(card(n), hooks, { leader: hei, power: 'casual' }).score;
assert.ok(s('Skullclamp') > s('Divination'), 'theme-fit draw beats generic draw');
assert.ok(s('Ichor Wellspring') > s("Vraska, Betrayal's Sting"));
assert.ok(s('Lotus Petal') < s('Arcane Signet'), 'burst sinks at Casual');

// DECK DOCTOR: honest counts (the 1 Nov Hei Bai acceptance shape).
const list = ['Sol Ring', 'Arcane Signet', 'Mind Stone', 'Orzhov Signet', 'Talisman of Hierarchy', 'Thought Vessel', 'Fellwar Stone', 'Solemn Simulacrum', 'Knight of the White Orchid', 'Smothering Tithe', 'Pitiless Plunderer', 'Cabal Ritual', 'Lotus Petal', 'Starfield Mystic', 'Dark Ritual', 'Skullclamp', 'Blood Artist', 'Ashnod\'s Altar', 'Wrath of God', 'Swords to Plowshares'].map(name => ({ name, qty: 1 }));
const doc = deckDoctor([{ name: hei.name, qty: 1 }, ...list], card, { format: { size: 100, commander: true }, commander: hei.name });
const g = k => doc.gauges.find(x => x.key === k);
assert.equal(g('ramp').count, 11, 'ramp counts permanent ramp only: ' + g('ramp').cards);
assert.deepEqual(doc.burst.sort(), ['Cabal Ritual', 'Dark Ritual', 'Lotus Petal']);
assert.deepEqual(doc.notCounting, ['Starfield Mystic']);
assert.equal(g('hook:reenter').count, 0, 'flicker gauge honest');
assert.equal(g('hook:attack-helpers').count, 0, 'attack helper gauge honest');
assert.equal(g('draw').target, 12);

// Seeds: same seed, same variation; Tight has none.
assert.equal(forgeNoise('AB12CD', 'Sol Ring'), forgeNoise('AB12CD', 'Sol Ring'));
assert.equal(forgeNoise('AB12CD', 'Sol Ring', 'tight'), 0);
assert.ok(forgeDiscoveryQueries(hei).length > 2);
console.log(`deck forge: ${DECK_TAGS.rules.length} rules, ${Object.keys(cards).length} fixture cards, Hei Bai hooks ${ids.join(', ')}`);

// BUILDER (Slice B, rules only) on the fixture pool: Hei Bai, Casual, any card.
const { buildDeck } = await import('./builder.js');
const basic = (name, c) => ({ name, type_line: 'Basic Land — ' + name, oracle_text: `({T}: Add {${c}}.)`, cmc: 0, color_identity: [c], legalities: { commander: 'legal' }, produced_mana: [c] });
const catalog = Object.fromEntries([...Object.values(cards), basic('Plains', 'W'), basic('Swamp', 'B')].map(c => [c.name.toLowerCase(), c]));
const built = buildDeck({ format: 'Commander', commander: hei, seeds: [hei], catalog, power: 'casual', variation: 'tight' });
const picked = new Set(built.cards.map(r => r.name));
assert.equal(built.total, 100);
assert.equal(built.lands, 38, '38 lands in Commander');
for (const n of ['Ichor Wellspring', 'Restoration Angel', 'Skullclamp', 'Pitiless Plunderer', 'Blood Artist', 'Airbender Ascension', 'Angel of Indemnity', 'Brotherhood Regalia']) assert.ok(picked.has(n), n + ' picked');
for (const n of ['Lotus Petal', 'Cabal Ritual', 'Dark Ritual', 'Starfield Mystic', 'Demonic Tutor', 'Mana Crypt']) assert.ok(!picked.has(n), n + ' kept out at Casual');
const bdoc = deckDoctor(built.cards, n => catalog[n.toLowerCase()], { format: { size: 100, commander: true }, commander: hei.name });
const bg = k => bdoc.gauges.find(x => x.key === k);
assert.ok(bg('ramp').count >= 10, 'ramp ' + bg('ramp').count);
assert.ok(bg('draw').count >= 12, 'card advantage ' + bg('draw').count);
assert.ok(bg('wipe').count >= 2 && bg('wipe').count <= 4, 'wipes ' + bg('wipe').count);
assert.ok(bg('wincon').count >= 3, 'win conditions ' + bg('wincon').count);
assert.equal(bg('lands').count, 38);
for (const id of ['fodder', 'sac-outlets', 'death-payoffs', 'reenter']) assert.ok(bg('hook:' + id).full, id + ' ' + bg('hook:' + id).count + '/' + bg('hook:' + id).target);
assert.deepEqual(built.forge.hooks.includes('fodder'), true);
console.log(`deck forge builder: Hei Bai ${built.total} cards, ${bdoc.gauges.map(g => g.label + ' ' + g.count + '/' + g.target).join(', ')}`);
