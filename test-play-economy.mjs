// Play progression slice 1: reward set rule, economy config, pure rules, server route, and the
// wall between Play and the real collection. Spec: play-progression.md.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {cleanSetName, standardBoosterSets, rewardSet} from './play-econ-sets.js';
import {starterGrant, sealTrackBonus, deckShortfall, masteryLevel, packContentsRow} from './play-econ-rules.js';
import {progressRoute} from './play-econ-route.js';

// --- Reward set: newest released Standard set with a booster file, never list order.
assert.equal(cleanSetName('Magic: The Gathering | The Hobbit'), 'the hobbit');
assert.equal(cleanSetName('Magic: The Gathering® Foundations'), 'foundations');
assert.equal(cleanSetName('Magic: The Gathering—FINAL FANTASY'), 'final fantasy');
assert.equal(cleanSetName('Magic: the Gathering | Avatar: The Last Airbender'), 'avatar: the last airbender');
assert.equal(cleanSetName('Outlaws of Thunder Junction (including The Big Score)'), 'outlaws of thunder junction');
assert.equal(cleanSetName('Magic: The Gathering | Marvel’s Spider-Man'), "marvel's spider-man");
const sets = [
  {code: 'hob', name: 'The Hobbit', released_at: '2026-08-14', set_type: 'expansion'},
  {code: 'fra', name: 'Reality Fracture', released_at: '2026-10-02', set_type: 'expansion'},
  {code: 'stk', name: 'Star Trek', released_at: '2026-12-04', set_type: 'expansion'},
  {code: 'fdn', name: 'Foundations', released_at: '2024-11-15', set_type: 'core'},
  {code: 'pfra', name: 'Reality Fracture Promos', released_at: '2026-10-02', set_type: 'promo'}];
const standardSets = ['Magic: The Gathering | The Hobbit', 'Reality Fracture', 'Star Trek', 'Magic: The Gathering® Foundations', 'Through the Omenpaths - Digital Only', 'Unknown Future Set'];
const boosterIndex = {sets: {hob: {}, fra: {}, fdn: {}, stk: {}}};
let r = standardBoosterSets({standardSets, boosterIndex, scryfallSets: sets, today: '2026-11-01'});
assert.deepEqual(r.sets.map(s => s.code), ['fra', 'hob', 'fdn'], 'newest released first; unreleased Star Trek waits');
assert.deepEqual(r.unmatched, ['Unknown Future Set'], 'digital-only entries are not data problems');
assert.equal(rewardSet({standardSets, boosterIndex, scryfallSets: sets, today: '2026-12-05'}).code, 'stk', 'Star Trek takes over by itself once released');
assert.equal(rewardSet({standardSets, boosterIndex: {sets: {hob: {}, fra: {}}}, scryfallSets: sets, today: '2026-12-05'}).code, 'fra', 'no booster file yet: keep the previous set');
// The real Standard list matches a set code for every paper entry.
const facts = JSON.parse(readFileSync('forge-rules/current/official-format-facts.json', 'utf8'));
for (const name of facts.standardSets) if (!/digital only/i.test(name)) assert.ok(cleanSetName(name).length > 2, name);

// --- One config file; the SQL seed is an exact copy of it.
const config = JSON.parse(readFileSync('data/play-economy.json', 'utf8'));
const sql = readFileSync('supabase/migrations/20261101180000_play_progression.sql', 'utf8');
const seeded = JSON.parse(sql.match(/\$config\$(.*?)\$config\$/s)[1]);
assert.deepEqual(seeded, config, 'migration seed matches data/play-economy.json');
assert.equal(config.winsPay, false, 'wins pay nothing on their own (Randall, 1 Nov)');
assert.ok(!/grant\s+execute\s+on\s+function\s+(?:public\.)?play_?\w*\([^)]*\)\s+to\s+(?:authenticated|anon)/i.test(sql), 'players can never call a grant function');
assert.ok(/revoke all on all tables in schema play from anon, authenticated/.test(sql));
assert.ok(!/public\.workspaces/.test(sql.replace(/--.*$/gm, '')), 'Play SQL never touches the real collection');

// --- Pure rules.
const grant = starterGrant(config, 'fra', [{name: 'Llanowar Elves', oracle_id: '11111111-1111-1111-1111-111111111111', rarity: 'common'}], [{name: 'Forest', qty: 24}, {name: 'Llanowar Elves', qty: 4}]);
assert.equal(grant.packs.length, 15); assert.equal(grant.packs[0].set, 'fra'); assert.equal(grant.cards.length, 4); assert.equal(grant.coins, 1000);
assert.ok(grant.starter);
assert.deepEqual(sealTrackBonus(config, 3), {u: 1});
assert.deepEqual(sealTrackBonus(config, 5), {r: 1});
assert.deepEqual(sealTrackBonus(config, 60), {u: 1, r: 1, m: 1});
assert.deepEqual(sealTrackBonus(config, 1), {});
assert.deepEqual(masteryLevel(config, 2500), {level: 3, into: 500, need: 1000});
const short = deckShortfall([{name: 'Forest', qty: 20}, {name: 'Sheoldred', qty: 4}, {name: 'Bolt', qty: 4}], new Map([['Sheoldred', 1], ['Bolt', 4]]), new Map([['Sheoldred', 'mythic'], ['Bolt', 'common']]));
assert.deepEqual(short.missing, [{name: 'Sheoldred', need: 3, rarity: 'mythic', seal: 'm'}]);
assert.equal(short.seals.m, 3); assert.equal(short.complete, false);
const row = packContentsRow({id: 'x', oracle_id: 'o', name: 'N', rarity: 'rare', set: 'fra', prices: {usd: '9.99'}, image_uris: {normal: 'n.jpg'}});
assert.ok(!('prices' in row) && !JSON.stringify(row).includes('9.99'), 'pack records never carry a price');

// --- Server route: sign-in required, the server rolls, and the ledger ref makes it idempotent.
{
  const calls = [];
  let stateCards = [];
  let wallet = {coins: 600, packs_opened: 4, seal_r: 0, starter_at: '2026-11-01'};
  const packs = [{id: 7, set: 'tst'}];
  const booster = {boosters: [{w: 1, c: {common: 2, rare: 1}}], sheets: {common: {cards: [['c1', 1], ['c2', 1], ['c3', 1]]}, rare: {cards: [['r1', 1]]}}};
  let foilCards = false;
  const card = id => ({id, ...(foilCards ? {finishes: ['nonfoil', 'foil']} : {}), oracle_id: id.padEnd(8, '0') + '-0000-0000-0000-000000000000', name: id, rarity: id.startsWith('r') ? 'rare' : 'common', colors: [], prices: {usd: '1.00'}});
  const pc = (name, count, rarity, extra = {}) => ({name, count, rarity, setCode: 'TMP', number: String(count), identifiers: {scryfallId: name.length.toString(16).padStart(8, '0') + '-1111-2222-3333-444444444444', scryfallOracleId: name.length.toString(16).padStart(8, '0') + '-0000-0000-0000-000000000000'}, ...extra});
  const precon = {name: 'Test Precon', mainBoard: [pc('Bolt', 4, 'common'), pc('Dragonlord', 2, 'rare'), pc('Mountain', 20, 'common', {supertypes: ['Basic']})], sideBoard: [pc('Bolt', 1, 'common')]};
  const fetcher = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/')) {
      const name = u.split('/rpc/')[1], args = JSON.parse(init.body); calls.push([name, args]);
      if (name === 'play_state') return new Response(JSON.stringify({config, wallet, packs, cards: stateCards}));
      if (name === 'play_save_deck') return new Response(JSON.stringify({id: 'd1', name: args.p_name}));
      if (name === 'play_apply') { if (args.p_delta.coins) wallet = {...wallet, coins: wallet.coins + args.p_delta.coins}; return new Response(JSON.stringify({duplicate_coins: 0, converted: []})); }
    }
    if (u.endsWith('/data/mtg-boosters/tst.json')) return new Response(JSON.stringify(booster));
    if (u.endsWith('/data/mtg-boosters/index.json')) return new Response(JSON.stringify({sets: {fra: {}, tst: {}}}));
    if (u.includes('/cards/collection')) return new Response(JSON.stringify({data: JSON.parse(init.body).identifiers.map(i => card(i.id || i.name))}));
    if (u.includes('mtgjson.com/api/v5/decks/TST_Precon.json')) return new Response(JSON.stringify({data: precon}));
    if (u.includes('/forge-rules/')) return new Response(JSON.stringify({standardSets: []}));
    if (u.includes('/sets')) return new Response(JSON.stringify({data: []}));
    return new Response('nf', {status: 404});
  };
  const env = {SUPABASE_SERVICE_KEY: 'sb_secret_test', SUPABASE_URL: 'https://example.supabase.co'};
  const verifyBearer = async a => a === 'Bearer ok' ? {id: 'u1'} : null;
  const req = (path, body, auth = 'Bearer ok') => new Request('https://cardstashy.com/api/progress/' + path, {method: body ? 'POST' : 'GET', headers: {Authorization: auth}, body: body ? JSON.stringify(body) : undefined});
  assert.equal((await progressRoute(req('state', null, 'Bearer bad'), env, {verifyBearer, fetcher})).status, 401, 'signed-out players get nothing');
  const opened = await (await progressRoute(req('open', {id: 7}), env, {verifyBearer, fetcher})).json();
  assert.equal(opened.pack.contents.length, 3);
  assert.equal(opened.pack.contents.at(-1).rarity, 'rare', 'the hit comes last');
  assert.deepEqual(opened.sealBonus, {r: 1}, '5th pack opened gives a rare seal');
  const applyCall = calls.find(c => c[0] === 'play_apply');
  assert.equal(applyCall[1].p_ref, 'open:7', 'one pack can only be opened once');
  assert.equal(applyCall[1].p_user, 'u1', 'grants go to the signed-in player only');
  assert.ok(!JSON.stringify(applyCall).includes('usd'), 'no price reaches the Play ledger');
  assert.equal((await progressRoute(req('open', {id: 99}), env, {verifyBearer, fetcher})).status, 404);
  assert.equal((await progressRoute(req('buy', {set: 'tst'}), env, {verifyBearer, fetcher})).status, 200, '600 coins buys a 500-coin pack');
  assert.equal((await progressRoute(req('buy', {set: 'tst'}), env, {verifyBearer, fetcher})).status, 409, '100 coins left is short');
  assert.equal((await progressRoute(req('buy', {set: 'zzz'}), env, {verifyBearer, fetcher})).status, 404, 'only sets with a booster file');
  // The Forge: 3 lower seals strike 1 of the next rarity, only with enough seals, never past mythic.
  wallet = {...wallet, seal_c: 7, seal_r: 2};
  calls.length = 0;
  // Stamping from the card view: 1 seal of the card's rarity, or 1 + 2 for the holo of a printing that has a foil.
  {
    const id = 'a1000000-1111-2222-3333-444444444444';
    const keepC = wallet.seal_c; wallet = {...wallet, seal_c: 3}; calls.length = 0;
    assert.equal((await progressRoute(req('craft', {id, holo: true}), env, {verifyBearer, fetcher})).status, 409, 'no foil printing, no holo stamp');
    const made = await (await progressRoute(req('craft', {id}), env, {verifyBearer, fetcher})).json();
    assert.equal(made.card.holo, false);
    assert.deepEqual(calls.find(c => c[0] === 'play_apply')[1].p_delta.seals, {c: -1});
    wallet = {...wallet, seal_c: 3}; foilCards = true; calls.length = 0;
    const holo = await (await progressRoute(req('craft', {id, holo: true}), env, {verifyBearer, fetcher})).json();
    const d = calls.find(c => c[0] === 'play_apply')[1].p_delta;
    assert.equal(holo.card.holo, true); assert.deepEqual(d.seals, {c: -3}); assert.equal(d.cards[0].foil, true);
    foilCards = false; wallet = {...wallet, seal_c: keepC};
  }
  // Holo at the Forge: 2 seals of the card's rarity turn one owned copy holo; never more holos than copies.
  {
    const o = 'c1000000-0000-0000-0000-000000000000';
    stateCards = [{o, n: 'c1', r: 'common', c: 2, h: 1}];
    wallet = {...wallet, seal_c: 2};
    const [ok] = [await progressRoute(req('holo', {oracle: o}), env, {verifyBearer, fetcher})];
    assert.equal(ok.status, 200);
    const hApply = calls.find(c => c[0] === 'play_apply' && /^holo:/.test(c[1].p_ref));
    assert.deepEqual(hApply[1].p_delta, {seals: {c: -2}, holo: [o]});
    stateCards = [{o, n: 'c1', r: 'common', c: 2, h: 2}];
    assert.equal((await progressRoute(req('holo', {oracle: o}), env, {verifyBearer, fetcher})).status, 409, 'every copy already holo');
    stateCards = [{o, n: 'c1', r: 'common', c: 2, h: 0}]; wallet = {...wallet, seal_c: 1};
    assert.equal((await progressRoute(req('holo', {oracle: o}), env, {verifyBearer, fetcher})).status, 409, '1 seal is short');
    stateCards = []; wallet = {...wallet, seal_c: 7};
  }
  // Precons: pay 25 coins a missing card (250 at least), get those copies in the exact printing,
  // and the list is saved with its printings; basic lands are never charged.
  wallet = {...wallet, coins: 300};
  const bought = await (await progressRoute(req('precon', {file: 'TST_Precon', format: 'Modern'}), env, {verifyBearer, fetcher})).json();
  assert.equal(bought.price, 250, '6 missing cards cost the 250 minimum');
  assert.equal(bought.granted, 6, 'Bolt capped at 4 copies across main and side, Dragonlord x2; no Mountains');
  const pApply = calls.find(c => c[0] === 'play_apply' && /^precon:/.test(c[1].p_ref));
  assert.equal(pApply[1].p_delta.coins, -250);
  assert.ok(pApply[1].p_delta.cards.every(c => c.set === 'tmp' && /cards\.scryfall\.io\/normal/.test(c.image)), 'exact printing for every copy');
  const pSave = calls.find(c => c[0] === 'play_save_deck');
  assert.deepEqual(pSave[1].p_cards.find(c => c.name === 'Mountain'), {name: 'Mountain', qty: 20, set: 'tmp', number: '20'}, 'basic lands keep their printing too');
  assert.equal(pSave[1].p_format, 'Modern');
  assert.equal((await progressRoute(req('precon', {file: 'TST_Precon'}), env, {verifyBearer, fetcher})).status, 409, '50 coins left is short');
  assert.equal((await progressRoute(req('precon', {file: '../x'}), env, {verifyBearer, fetcher})).status, 400);
  calls.length = 0;
  const forged = await (await progressRoute(req('forge', {to: 'u', times: 2}), env, {verifyBearer, fetcher})).json();
  assert.deepEqual(forged.forged, {to: 'u', from: 'c', times: 2, cost: 6});
  const forgeCall = calls.find(c => c[0] === 'play_apply');
  assert.deepEqual(forgeCall[1].p_delta, {seals: {c: -6, u: 2}});
  assert.match(forgeCall[1].p_ref, /^forge:/);
  assert.equal((await progressRoute(req('forge', {to: 'm'}), env, {verifyBearer, fetcher})).status, 409, '2 rare seals cannot strike a mythic');
  assert.equal((await progressRoute(req('forge', {to: 'c'}), env, {verifyBearer, fetcher})).status, 400, 'nothing forges into common');
  assert.equal((await progressRoute(req('forge', {to: 'u', times: 11}), env, {verifyBearer, fetcher})).status, 400, 'ten at most');
}

// --- The wall: Play economy code never imports collection storage, sync or price code,
// and the main app's collection code never imports Play economy code.
const FORBIDDEN = /from\s+['"]\.\/(?:storage|cloud|store|pricefeed|mtg-tcgprice|price-[\w-]+|pricing-[\w-]+|pricehist|sharedprices|buy|condition-[\w-]+|tcgplayer-[\w-]+|value-[\w-]+|sync-merge|recovery-store)\.js['"]/;
const playEcon = readdirSync('.').filter(f => /^play-econ-[\w-]+\.js$/.test(f));
assert.ok(playEcon.length >= 3);
for (const f of playEcon) assert.ok(!FORBIDDEN.test(readFileSync(f, 'utf8')), f + ' crosses the Play wall');
for (const f of ['storage.js', 'cloud.js', 'store.js', 'binders.js', 'sync-merge.js', 'pricefeed.js'])
  assert.ok(!/play-econ-/.test(readFileSync(f, 'utf8')), f + ' must not import Play economy code');
// --- Screens: the top bar shows only for a signed-in wallet, and no Play screen ever shows a price.
{
  const {purseMarkup, stuffRowMarkup, econScreenMarkup} = await import('./play-econ-ui.js');
  assert.equal(purseMarkup(null), '', 'signed out: no top bar');
  assert.equal(stuffRowMarkup({state: null}), '');
  const state = {config, wallet: {coins: 1200, seal_c: 1, seal_u: 2, seal_r: 3, seal_m: 4, xp: 1500, starter_at: 'x'}, packs: [{id: 1, set: 'fra'}],
    cards: [{o: 'a', n: 'Sheoldred, the Apocalypse', r: 'mythic', c: 2, prices: {usd: '77.77'}}], decks: [], rewardSet: {code: 'fra', name: 'Reality Fracture', released: '2026-10-02'}, shop: [{code: 'fra', name: 'Reality Fracture', released: '2026-10-02'}]};
  const snap = {state, error: '', busy: '', loading: false};
  const bar = purseMarkup(snap);
  assert.ok(bar.includes('1,200') && bar.includes('data-econ-view="packs"') && /Mastery level 2/.test(bar));
  for (const v of ['shop', 'packs', 'collection', 'decks']) {
    const html = econScreenMarkup(v, snap, {});
    assert.ok(html.includes('pe-purse'), v + ' keeps the top bar');
    assert.ok(!/\$\s?\d|usd|77\.77|tcgplayer/i.test(html), v + ' shows no price');
  }
  assert.ok(econScreenMarkup('shop', snap, {}).includes('data-act="playEconBuy"'));
  assert.ok(/Sign in/.test(econScreenMarkup('packs', {state: null, loading: false}, {})));
}
// --- A failed wallet load is never invisible: the home shows why, with the server's code and a retry.
{
  const {econNoticeMarkup} = await import('./play-econ-ui.js');
  const {createPlayEcon} = await import('./play-econ-client.js');
  assert.equal(econNoticeMarkup({state: null, error: 'x', errorCode: 'not_configured'}, {signedIn: false}), '');
  const failed = econNoticeMarkup({state: null, error: 'Play rewards are not switched on yet.', errorCode: 'not_configured'}, {signedIn: true});
  assert.ok(failed.includes('not_configured') && failed.includes('data-act="playEconRetry"') && failed.includes('role="alert"'));
  assert.ok(econNoticeMarkup({state: null, error: 'x', errorCode: 'sign_in'}, {signedIn: true}).includes('Sign out and back in'));
  assert.ok(econNoticeMarkup({state: null, loading: true}, {signedIn: true}).includes('role="status"'));
  assert.equal(econNoticeMarkup({state: {wallet: {coins: 1}}, error: 'x'}, {signedIn: true}), '');
  const store = new Map(), storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)};
  const calls = [];
  // No reward set from /state: the client still asks for the starter, so no_reward_set surfaces.
  const econ = createPlayEcon({getAccessToken: async () => 'tok', storage, fetchImpl: async (url) => {
    calls.push(url);
    if (url.endsWith('/state')) return new Response(JSON.stringify({wallet: null, packs: [], rewardSet: null, shop: []}), {status: 200});
    return new Response(JSON.stringify({error: 'no_reward_set'}), {status: 503});
  }});
  await econ.refresh();
  assert.deepEqual(calls, ['/api/progress/state', '/api/progress/starter']);
  assert.equal(econ.snapshot().errorCode, 'no_reward_set');
  const noToken = createPlayEcon({getAccessToken: async () => '', storage, fetchImpl: async () => { throw Error('no fetch'); }});
  await noToken.refresh();
  assert.equal(noToken.snapshot().errorCode, 'sign_in');
}
// --- Collection filters, set progress and the deck builder.
{
  const {stepDeckCard, copiesLeft, deckRules} = await import('./play-econ-rules.js');
  const {filterPlayCards, playSetRows, deckBuilderMarkup, collectionMarkup} = await import('./play-econ-ui.js');
  const {cardGroup, cardFact} = await import('./play-econ-cards.js');
  const owned = new Map([['Shock', 2], ['Llanowar Elves', 4]]);
  let deck = stepDeckCard([], 'Shock', 1, owned, 'Standard');
  deck = stepDeckCard(deck, 'Shock', 1, owned, 'Standard');
  deck = stepDeckCard(deck, 'Shock', 1, owned, 'Standard');
  assert.deepEqual(deck, [{name: 'Shock', qty: 2}], 'never more copies than owned');
  assert.equal(copiesLeft('Llanowar Elves', [], owned, 'Commander'), 1, 'Commander is singleton');
  assert.equal(copiesLeft('Mountain', [{name: 'Mountain', qty: 30}], owned, 'Standard'), Infinity, 'basics are free');
  assert.equal(copiesLeft('Black Lotus', [], owned, 'Vintage'), 0, 'unowned cards cannot go in');
  assert.deepEqual(stepDeckCard([{name: 'Shock', qty: 1}], 'Shock', -1, owned), []);
  assert.equal(deckRules('Commander').size, 100);
  const fact = cardFact({oracle_id: 'o1', type_line: 'Legendary Creature — Elf', cmc: 1, color_identity: ['G'], image_uris: {normal: 'n', art_crop: 'a'}});
  assert.equal(cardGroup(fact), 'Creatures');
  assert.equal(cardGroup({t: 'Land — Forest'}), 'Lands');
  const facts = {card: o => ({o1: fact, o2: {o: 'o2', t: 'Instant', m: 1, k: 'R', i: '', a: ''}})[o] || null, set: c => c === 'fra' ? {name: 'Reality Fracture', icon: '', released: '2026-10-01', total: 270} : null};
  const cards = [{o: 'o1', n: 'Llanowar Elves', r: 'common', c: 4, s: ['fra']}, {o: 'o2', n: 'Shock', r: 'common', c: 2, s: ['fra', 'dom']}];
  assert.deepEqual(filterPlayCards(cards, facts, {color: 'R'}).map(c => c.n), ['Shock']);
  assert.deepEqual(filterPlayCards(cards, facts, {type: 'Creatures'}).map(c => c.n), ['Llanowar Elves']);
  assert.deepEqual(filterPlayCards(cards, facts, {set: 'dom'}).map(c => c.n), ['Shock']);
  const sets = playSetRows({cards, rewardSet: {code: 'fra', name: 'Reality Fracture'}}, facts);
  assert.deepEqual(sets.map(x => [x.code, x.owned, x.total]), [['fra', 2, 270], ['dom', 1, null]]);
  const snap = {state: {config, wallet: {coins: 1, starter_at: 'x'}, packs: [], cards, decks: []}};
  const builder = deckBuilderMarkup(snap, {facts, edit: {name: 'Elves', format: 'Standard', cards: [{name: 'Llanowar Elves', qty: 4}, {name: 'Forest', qty: 20}]}});
  assert.ok(builder.includes('24/60') && builder.includes('data-act="playEconSaveEdit"'));
  assert.ok(/aria-label="Add Llanowar Elves, 0 left"[^>]*disabled|disabled[^>]*aria-label="Add Llanowar Elves, 0 left"/.test(builder), 'a card at its limit cannot be added');
  const coll = collectionMarkup(snap, {tab: 'sets', facts});
  assert.ok(coll.includes('set-progress-track') && coll.includes('Reality Fracture'));
  for (const html of [builder, coll, collectionMarkup(snap, {facts})]) assert.ok(!/\$\s?\d|usd|price/i.test(html), 'no prices in Play');
}
console.log('play economy ok');

// --- Trunk sorting and binder tabs.
{
  const ui = await import('./play-econ-ui.js');
  const cards = [{o: 'a', n: 'Bolt', r: 'common', c: 4, s: ['old']}, {o: 'b', n: 'Angel', r: 'mythic', c: 1, s: ['new']}, {o: 'c', n: 'Cat', r: 'rare', c: 2, s: ['old']}];
  const sets = [{code: 'new', released: '2026-10-01'}, {code: 'old', released: '1993-08-05'}];
  assert.deepEqual(ui.sortPlayCards(cards).map(c => c.n), ['Angel', 'Bolt', 'Cat']);
  assert.deepEqual(ui.sortPlayCards(cards, null, 'rarity').map(c => c.n), ['Angel', 'Cat', 'Bolt']);
  assert.deepEqual(ui.sortPlayCards(cards, null, 'set', sets).map(c => c.n), ['Angel', 'Bolt', 'Cat']);
  assert.deepEqual(ui.sortPlayCards(cards, null, 'count').map(c => c.n), ['Bolt', 'Cat', 'Angel']);
}

