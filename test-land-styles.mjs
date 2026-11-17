// Land styles (land-styles.js, Randall 16 Nov 2026): ownership, sort, crafting seals and the pack's land slot,
// on the real baked files (data/land-styles.json, data/mtg-boosters/dmu.json + its baked cards).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {landStyleList, ownedLandStyles, sortLandStyles, landSlotPlan, pickSpecialLand, landCraftSeal, deckLandStyle, LAND_TYPES, addLandRow, stepLandRow, restyleLandRow, mainLandFirst, joinLandRows} from './land-styles.js';
import {drawMtgBooster, bakedBoosterCard} from './mtg-boosters.js';
import {progressRoute} from './play-econ-route.js';

const data = JSON.parse(readFileSync('data/land-styles.json', 'utf8')), list = landStyleList(data);
assert.equal(new Set(list.map(s => s.type)).size, 5);
assert.ok(list.length > 3000, 'every paper printing of the five basics');
for (const t of LAND_TYPES) assert.equal(list.find(s => s.id === data.starter[t])?.set, 'fdn', t + ' starter is Foundations');
assert.ok(list.filter(s => s.set === 'sld').every(s => s.kind === 's'), 'Secret Lair lands are Special');

// Crafting: regular = common seal, full art = uncommon seal, special never.
assert.equal(landCraftSeal('r'), 'c'); assert.equal(landCraftSeal('f'), 'u'); assert.equal(landCraftSeal('s'), null);

// Ownership: starter, a pulled/crafted style, and the old Trunk (a set it holds Forest from).
const dmuForests = list.filter(s => s.set === 'dmu' && s.type === 'Forest' && s.booster);
const blb = list.find(s => s.set === 'blb' && s.type === 'Forest' && s.kind === 'f');
const owned = ownedLandStyles(list, {starter: data.starter, cards: [{n: 'Forest', s: ['DMU'], p: ''}], styles: [{id: blb.id}]});
assert.ok(owned.has(data.starter.Forest) && owned.has(blb.id));
assert.ok(dmuForests.length && dmuForests.every(s => owned.has(s.id)), 'old pulls of a set count for its booster Forests');
assert.ok(!owned.has(list.find(s => s.set === 'sld' && s.type === 'Forest').id));

// Sort: in use first, then owned (recent first), then locked.
const forests = list.filter(s => s.type === 'Forest');
const sorted = sortLandStyles(forests, owned, 'recent', data.starter.Forest);
assert.equal(sorted[0].id, data.starter.Forest);
assert.equal(sorted[1].id, blb.id, 'the style got last comes right after the one in use');
const firstLocked = sorted.findIndex(s => !owned.has(s.id));
assert.ok(sorted.slice(firstLocked).every(s => !owned.has(s.id)));
const old = sortLandStyles(forests, new Map(), 'oldest');
assert.ok(old[0].released <= old.at(-1).released);

// Deck rows: own id if owned, else the account default, else the starter.
assert.equal(deckLandStyle('Forest', blb.id, owned, {}, data.starter), blb.id);
assert.equal(deckLandStyle('Forest', 'locked-id', owned, {Forest: blb.id}, data.starter), blb.id);
assert.equal(deckLandStyle('Forest', '', owned, {}, data.starter), data.starter.Forest);

// The pack's land slot on the real Dominaria United booster: never a basic you own; all owned -> a common.
const booster = JSON.parse(readFileSync('data/mtg-boosters/dmu.json', 'utf8'));
const cards = new Map(Object.entries(JSON.parse(readFileSync('data/mtg-booster-cards/dmu.json', 'utf8')).cards).map(([id, row]) => { const c = bakedBoosterCard(id, row); return [id, c]; }));
const basicIds = booster.sheets.basic.cards.map(([id]) => id);
let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const someOwned = new Map(basicIds.slice(0, 15).map(id => [id, {}]));
for (let i = 0; i < 200; i++) {
  const pack = drawMtgBooster(booster, cards, random, {landSlot: landSlotPlan(booster, someOwned)});
  const lands = pack.filter(c => c.packLand);
  assert.equal(lands.length, 1);
  assert.ok(!someOwned.has(lands[0].id), 'an owned land style never comes back');
}
const allOwned = new Map(basicIds.map(id => [id, {}]));
for (let i = 0; i < 50; i++) {
  const pack = drawMtgBooster(booster, cards, random, {landSlot: landSlotPlan(booster, allOwned)});
  const slot = pack.find(c => c.packLand);
  assert.equal(slot.rarity, 'common'); assert.ok(!LAND_TYPES.includes(slot.name), 'all lands owned: the slot gives a common');
  const plain = pack.filter(c => !c.packFoil);
  assert.equal(new Set(plain.map(c => c.id)).size, plain.length, 'the common is not one already in the pack');
  assert.equal(pack.length, 15);
}
// Without the option nothing changes.
assert.ok(drawMtgBooster(booster, cards, random).some(c => LAND_TYPES.includes(c.name)));

// Special lands: only ones not owned.
const sp = pickSpecialLand(list, new Map(list.filter(s => s.kind === 's').slice(1).map(s => [s.id, {}])), () => 0);
assert.equal(sp.id, list.filter(s => s.kind === 's')[0].id);
assert.equal(pickSpecialLand(list, new Map(list.map(s => [s.id, {}]))), null);

// Route: craft for the right seal once, never a Special one, set a style for all decks, decks keep printings.
{
  let wallet = {coins: 0, seal_c: 1, seal_u: 0, seal_r: 0, seal_m: 0, starter_at: '2026-11-01'}, styles = [];
  let decks = [{id: '11111111-1111-1111-1111-111111111111', name: 'Mine', format: 'Standard', cards: [{name: 'Forest', qty: 17}, {name: 'Llanowar Elves', qty: 4}]}];
  const calls = [], applied = new Set();
  const fetcher = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/')) {
      const name = u.split('/rpc/')[1], args = JSON.parse(init.body); calls.push([name, args]);
      const ok = b => new Response(JSON.stringify(b));
      if (name === 'play_state') return ok({config: {}, wallet, packs: [], cards: [], decks});
      if (name === 'play_styles') return ok({styles, bundles: []});
      if (name === 'play_apply') { if (applied.has(args.p_ref)) return ok({duplicate: true}); applied.add(args.p_ref); for (const [k, v] of Object.entries(args.p_delta.seals || {})) wallet['seal_' + k] += v; return ok({}); }
      if (name === 'play_add_styles') { if (applied.has(args.p_ref)) return ok({duplicate: true}); applied.add(args.p_ref); styles.unshift(...args.p_styles.map(s => ({...s, on: false}))); return ok({duplicate: false}); }
      if (name === 'play_pick_style') { styles = styles.map(s => s.o === args.p_oracle ? {...s, on: s.id === args.p_print} : s); return ok({styles}); }
      if (name === 'play_save_deck') { const d = {id: args.p_id || 'n', name: args.p_name, format: args.p_format, cards: args.p_cards}; decks = [...decks.filter(x => x.id !== d.id), d]; return ok(d); }
      return ok({});
    }
    if (u.endsWith('/data/land-styles.json')) return new Response(readFileSync('data/land-styles.json', 'utf8'));
    return new Response('nf', {status: 404});
  };
  const env = {SUPABASE_SERVICE_KEY: 'sb_secret_test', SUPABASE_URL: 'https://example.supabase.co'};
  const call = async (path, body) => { const r = await progressRoute(new Request('https://cardstashy.com/api/progress/' + path, {method: 'POST', headers: {Authorization: 'Bearer ok'}, body: JSON.stringify(body)}), env, {verifyBearer: async () => ({id: 'u1'}), fetcher}); return {status: r.status, body: await r.json()}; };
  const reg = list.find(s => s.type === 'Forest' && s.kind === 'r' && s.set === 'neo'), full = list.find(s => s.type === 'Forest' && s.kind === 'f' && s.set === 'znr'), special = list.find(s => s.type === 'Forest' && s.kind === 's');
  assert.equal((await call('landcraft', {id: special.id})).body.error, 'no_craft_special');
  assert.equal((await call('landcraft', {id: full.id})).body.error, 'no_seal', 'full art needs an uncommon seal');
  const got = await call('landcraft', {id: reg.id});
  assert.equal(got.status, 200); assert.equal(wallet.seal_c, 0, 'one common seal spent');
  assert.ok(styles.some(s => s.id === reg.id && s.o === data.oracles.Forest));
  wallet.seal_c = 1;
  assert.equal((await call('landcraft', {id: reg.id})).body.error, 'have_style', 'once per style'); assert.equal(wallet.seal_c, 1);
  assert.equal((await call('landstyle', {id: full.id, all: true})).status, 403, 'a locked style cannot be used');
  const used = await call('landstyle', {id: reg.id, all: true});
  assert.equal(used.status, 200);
  assert.ok(styles.find(s => s.id === reg.id).on, 'the account default');
  assert.equal(decks[0].cards.find(r => r.name === 'Forest').id, reg.id, 'every deck\'s Forests switch');
  assert.equal(decks[0].cards.find(r => r.name === 'Llanowar Elves').id, undefined);
  await call('deck', {id: decks[0].id, name: 'Mine', format: 'Standard', cards: [{name: 'Forest', qty: 16, id: reg.id}, {name: 'Llanowar Elves', qty: 4, id: 'nope'}]});
  assert.equal(calls.filter(c => c[0] === 'play_save_deck').at(-1)[1].p_cards[0].id, reg.id, 'saving a deck keeps the land style');
  assert.equal(calls.filter(c => c[0] === 'play_save_deck').at(-1)[1].p_cards[1].id, undefined, 'bad ids are dropped');
}
// Mixed styles in one deck (Randall 17 Nov): each style its own row; the bar's style first; restyling one row leaves the others.
{
  let rows = [{name: 'Forest', qty: 16, id: 'a'}, {name: 'Plains', qty: 8}];
  rows = addLandRow(rows, 'Forest', 'b');
  assert.deepEqual(rows.map(r => [r.name, r.id || '', r.qty]), [['Forest', 'a', 16], ['Plains', '', 8], ['Forest', 'b', 1]], 'a dragged style is its own row');
  rows = stepLandRow(rows, 'Forest', 'b', 1); assert.equal(rows.find(r => r.id === 'b').qty, 2, '+ steps that row only');
  assert.equal(rows.find(r => r.id === 'a').qty, 16);
  rows = stepLandRow(stepLandRow(rows, 'Forest', 'b', -1), 'Forest', 'b', -1); assert.ok(!rows.some(r => r.id === 'b'), 'the row goes at 0');
  rows = addLandRow(rows, 'Forest', 'c', 3);
  assert.equal(mainLandFirst(rows, 'Forest', 'c')[0].id, 'c', 'the main style leads its land');
  assert.deepEqual(mainLandFirst(rows, 'Forest', 'c').map(r => r.qty), [3, 16, 8], 'nothing else changes');
  const re = restyleLandRow(rows, 'Forest', 'a', 'd');
  assert.deepEqual(re.map(r => [r.id || '', r.qty]), [['d', 16], ['', 8], ['c', 3]], 'only the held row changes');
  assert.deepEqual(restyleLandRow(rows, 'Forest', 'a', 'c').map(r => [r.id || '', r.qty]), [['', 8], ['c', 19]], 'into a style already in the deck: they join');
  const precon = restyleLandRow([{name: 'Plains', qty: 7, set: 'fdn', number: '273'}], 'Plains', '', 'e');
  assert.deepEqual(precon, [{name: 'Plains', qty: 7, id: 'e'}], 'a precon row takes the picked style');
  assert.deepEqual(joinLandRows([{name: 'Forest', qty: 2, id: 'a'}, {name: 'Elf', qty: 1, id: 'x'}, {name: 'Elf', qty: 1, id: 'x'}, {name: 'Forest', qty: 3, id: 'a'}]).map(r => [r.name, r.qty]),
    [['Forest', 5], ['Elf', 1], ['Elf', 1]], 'same land and style join; other cards are left alone');
}
console.log('land styles ok');
