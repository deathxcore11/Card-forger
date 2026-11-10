// The matchup shows commander art from a quick look before the whole-deck preparation, and a card whose art
// missed the preparation is picked up later from the catalogue.
import assert from 'node:assert/strict';
import {createForgeArtworkPreparation} from './play-forge-artwork.js';
const catalog = new Map(), card = n => ({id: 'id-' + n, name: n, image_uris: {art_crop: 'https://x/' + n}});
const asked = [];
const art = createForgeArtworkPreparation({isCurrent: () => true, fetchPrinting: async () => null,
  lookup: (n, id) => id ? null : catalog.get(n.toLowerCase()) || null,
  resolveNames: async names => { asked.push([...names]); for (const n of names) if (n !== 'Slow Card') catalog.set(n.toLowerCase(), card(n)); }});
const deck = (cmd, cards) => ({commander: cmd, cards: cards.map(name => ({name, qty: 1}))});
const setup = {selected: deck('Gisa and Geralf', ['Swamp', 'Slow Card', 'Sol Ring']), opponent: deck('', ['Volatile Wanderglyph'])};
assert.equal(art.previewLookup('Gisa and Geralf', null), null, 'nothing before the quick look');
await art.preview(setup);
assert.ok(art.previewLookup('Gisa and Geralf', null)?.image_uris.art_crop, 'commander art shows before preparation');
assert.ok(!asked[0].includes('Swamp'), 'basic lands are not part of the quick look');
assert.ok(art.previewLookup('Volatile Wanderglyph', null), 'a CPU deck with no commander shows its first card');
assert.throws(() => art.lookup('Sol Ring', null), /NOT_PREPARED/, 'the table lookup still waits for the full preparation');
await art.prepare(setup);
assert.equal(art.lookup('Slow Card', null), null, 'a card the provider missed has no art yet');
catalog.set('slow card', card('Slow Card'));
assert.ok(art.lookup('Slow Card', null)?.image_uris.art_crop, 'it appears once the catalogue has it');
console.log('play forge early artwork ok');
