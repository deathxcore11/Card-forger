// Secret Lair in Play (play-secret-lair.js, /api/progress/secretlair and /style, rare style drops).
import assert from 'node:assert/strict';
import {weeklySecretLairOffers, secretLairOfferPrice, SECRET_LAIR_OFFERS, groupSecretLairDrops, weeklySecretLair, secretLairPrice, secretLairLabel, secretLairCardDelta, pickSecretLairStyle, secretLairImage, slimSecretLairCard} from './play-secret-lair.js';
import {progressRoute, secretLairOffer, secretLairStoreOffer} from './play-econ-route.js';
import {secretLairShelf, secretLairStore, setPlayStyles, playCardTile} from './play-econ-ui.js';

const id = n => n.toString(16).padStart(8, '0') + '-aaaa-bbbb-cccc-dddddddddddd';
const ora = n => n.toString(16).padStart(8, '0') + '-0000-0000-0000-000000000000';
const sc = (n, num, artist, released = '2024-04-01', extra = {}) => ({id: id(n), oracle_id: ora(n), name: 'Card ' + n, rarity: 'rare', collector_number: String(num), artist, released_at: released, finishes: ['nonfoil', 'foil'], layout: 'normal', ...extra});

// --- The store: ten single cards a week, distinct, no basics, never the bundle's, four on sale.
{
  const big = Array.from({length: 30}, (_, d) => ({id: 'sld-' + d, released: '2024-01-0' + (1 + d % 9), artists: ['A'],
    cards: Array.from({length: 4}, (_, k) => ({id: id(d * 10 + k), o: ora(d * 10 + (k % 3)), n: k === 3 ? 'Island' : 'Card ' + (d * 10 + k), r: ['common', 'uncommon', 'rare', 'mythic'][k], num: String(k), f: ['nonfoil'], a: 'A'}))}));
  const offers = weeklySecretLairOffers(big, '2026-W45', '2026-11-03', 'sld-0');
  assert.equal(offers.length, SECRET_LAIR_OFFERS, 'ten a week');
  assert.equal(new Set(offers.map(c => c.o)).size, 6, 'six different cards');
  assert.ok(offers.every(c => c.n !== 'Island'), 'no basic lands');
  assert.ok(offers.every(c => !c.id.startsWith('00000000') && !['00000001', '00000002'].includes(c.id.slice(0, 8))), 'never the bundle\'s cards');
  assert.deepEqual(offers.filter(c => c.off).map(c => c.off).sort((a, b) => a - b), [25, 40, 50, 60], 'four on sale');
  assert.deepEqual(weeklySecretLairOffers(big, '2026-W45', '2026-11-03', 'sld-0'), offers, 'the same for everyone all week');
  assert.notDeepEqual(weeklySecretLairOffers(big, '2026-W46', '2026-11-10', 'sld-0').map(c => c.id), offers.map(c => c.id), 'new cards next week');
  assert.equal(weeklySecretLairOffers(big, '2026-W45', '2020-01-01').length, 0, 'unreleased drops are never sold');
  assert.deepEqual(secretLairOfferPrice({r: 'mythic'}), {was: 500, coins: 500, seal: 'm'});
  assert.deepEqual(secretLairOfferPrice({r: 'common', off: 25}), {was: 200, coins: 150, seal: 'c'}, 'sale, rounded to 10');
  assert.equal(secretLairOfferPrice({r: 'rare', off: 60}).coins, 120);
  assert.equal(secretLairOfferPrice({r: 'rare'}, {secretLair: {offerCoins: {rare: 400}}}).coins, 400, 'config retunes it');
  const so = secretLairStoreOffer(big, new Date('2026-11-04T12:00:00Z'));
  assert.equal(so.week, '2026-W45'); assert.equal(so.ends, '2026-11-09T00:00:00.000Z'); assert.equal(so.offers.length, 6);
  assert.ok(!JSON.stringify(so).includes('usd'), 'no prices, ever');
}

// --- Grouping: one artist's run is a drop; lone cards of a multi-artist run stay together; lettered series group.
{
  const cards = [sc(1, 10, 'A'), sc(2, 11, 'A'), sc(3, 12, 'A'), sc(4, 13, 'B'), sc(5, 14, 'C'), sc(6, 15, 'D'),
    sc(7, 40, 'E', '2024-05-01'), sc(8, 'XY-1', 'F'), sc(9, 'XY-2', 'G'), sc(10, 'XY-3', 'F'),
    sc(11, 16, 'A', '2024-04-01', {promo_types: ['serialized']}), sc(12, 17, 'A', '2024-04-01', {layout: 'token'})];
  const drops = groupSecretLairDrops(cards);
  const names = drops.map(d => d.cards.map(c => c.n.replace('Card ', '')).join(','));
  assert.deepEqual(names.sort(), ['1,2,3', '4,5,6', '7', '8,9,10'].sort(), 'drops: artist run, multi-artist singles, lone card, lettered series');
  assert.ok(!JSON.stringify(drops).includes('Card 11') && !JSON.stringify(drops).includes('Card 12'), 'serialized and token printings never come');
  assert.equal(slimSecretLairCard({...sc(1, 1, 'A'), oracle_id: undefined}), null, 'no oracle, no card');

  // --- The week's bundle: 3-8 cards, already out, the same for everyone all week.
  const w = weeklySecretLair(drops, '2026-W45', '2026-11-03');
  assert.ok(w && w.cards.length >= 3, 'a bundle is 3 to 8 cards');
  assert.deepEqual(weeklySecretLair(drops, '2026-W45', '2026-11-03'), w, 'one bundle per week');
  assert.equal(weeklySecretLair(drops, '2026-W45', '2020-01-01'), null, 'unreleased drops are never sold');
  assert.equal(secretLairPrice({cards: [{r: 'rare'}, {r: 'mythic'}, {r: 'common'}]}), 1000, 'priced card by card: 300 + 500 + 200');
  assert.equal(secretLairPrice({cards: [{r: 'common'}, {r: 'uncommon'}]}), 400, 'two cheap cards, no floor');
  assert.equal(secretLairPrice({cards: Array(12).fill({r: 'rare'})}), 3600, 'no ceiling');
  assert.deepEqual(secretLairLabel({released: '2024-04-01', artists: ['A', 'B']}), {title: 'Secret Lair · Apr 2024', by: 'Art by A and B'}, 'an honest label: month and artists');
  assert.equal(secretLairImage(id(1)), `https://cards.scryfall.io/normal/front/0/0/${id(1)}.jpg`);
  assert.equal(secretLairImage('../x'), '', 'only real ids make image links');
  assert.equal(secretLairCardDelta({...drops[0].cards[0], f: ['foil']}).foil, true, 'foil-only printings come holo');

  // --- Rare style drops: a card you own first; owning none, the card comes with it; never a repeat.
  const seq = () => 0;
  const own = pickSecretLairStyle(drops, new Set([ora(5)]), new Set(), seq);
  assert.equal(own.card.o, ora(5)); assert.equal(own.owned, true, 'the art of a card you own');
  const none = pickSecretLairStyle(drops, new Set(), new Set(), seq);
  assert.equal(none.owned, false, 'owning none of them, the card comes too');
  assert.equal(pickSecretLairStyle(drops, new Set([ora(5)]), new Set([id(5)]), seq).owned, false, 'an unlocked style is never dropped again');
  assert.equal(pickSecretLairStyle(drops, new Set(), new Set(drops.flatMap(d => d.cards.map(c => c.id))), seq), null, 'all unlocked: nothing');

  // --- Offer: ends next Monday (UTC), priced, real ids only.
  const offer = secretLairOffer(drops, {}, new Date('2026-11-04T12:00:00Z'));
  assert.equal(offer.week, '2026-W45'); assert.equal(offer.ends, '2026-11-09T00:00:00.000Z', 'leaves at the start of Monday');
  assert.equal(secretLairOffer(drops, {}, new Date('2026-11-09T00:00:01Z')).ends, '2026-11-16T00:00:00.000Z', 'a Monday bundle lasts the whole week');

  // --- Route: buy once a week, styles unlocked, short coins refused; pick a style; signed-out refused.
  let wallet = {coins: 2000, starter_at: '2026-11-01'}, styles = [], bundles = [], cardsOwned = [{o: ora(5), n: 'Card 5', c: 1}];
  const calls = [];
  const fetcher = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/')) {
      const name = u.split('/rpc/')[1], args = JSON.parse(init.body); calls.push([name, args]);
      if (name === 'play_state') return new Response(JSON.stringify({config: {}, wallet, packs: [], cards: cardsOwned}));
      if (name === 'play_styles') return new Response(JSON.stringify({styles, bundles}));
      if (name === 'play_apply') { if (calls.filter(c => c[0] === 'play_apply' && c[1].p_ref === args.p_ref).length > 1) return new Response(JSON.stringify({duplicate: true})); wallet = {...wallet, coins: wallet.coins + (args.p_delta.coins || 0)}; if (/^sl:\d{4}-W\d\d$/.test(args.p_ref)) bundles.push(args.p_ref); return new Response(JSON.stringify({})); }
      if (name === 'play_add_styles') { styles.push(...args.p_styles.map(s => ({...s, on: false}))); return new Response(JSON.stringify({duplicate: false, added: args.p_styles.length})); }
      if (name === 'play_pick_style') { if (args.p_print && !styles.some(s => s.id === args.p_print)) return new Response(JSON.stringify({message: 'style_locked'}), {status: 400}); styles = styles.map(s => ({...s, on: s.o === args.p_oracle && s.id === args.p_print})); return new Response(JSON.stringify({styles, bundles})); }
      if (name === 'play_counters' || name === 'play_bump') return new Response(JSON.stringify({}));
      if (name === 'play_claims') return new Response(JSON.stringify([]));
    }
    if (u.endsWith('/data/secret-lair/drops.json')) return new Response(JSON.stringify({drops}));
    if (u.endsWith('/data/mtg-boosters/index.json')) return new Response(JSON.stringify({sets: {}}));
    if (u.includes('/forge-rules/')) return new Response(JSON.stringify({standardSets: []}));
    if (u.includes('/sets')) return new Response(JSON.stringify({data: []}));
    return new Response('nf', {status: 404});
  };
  const env = {SUPABASE_SERVICE_KEY: 'sb_secret_test', SUPABASE_URL: 'https://example.supabase.co'};
  const verifyBearer = async a => a === 'Bearer ok' ? {id: 'u1'} : null;
  const req = (path, body, auth = 'Bearer ok') => new Request('https://cardstashy.com/api/progress/' + path, {method: body ? 'POST' : 'GET', headers: {Authorization: auth}, body: body ? JSON.stringify(body) : undefined});
  const call = async (path, body, auth) => { const r = await progressRoute(req(path, body, auth), env, {verifyBearer, fetcher}); return {status: r.status, body: await r.json()}; };

  assert.equal((await call('secretlair', {}, 'Bearer bad')).status, 401, 'signed out: nothing');
  const st = await call('state');
  assert.ok(st.body.secretLair?.cards?.length >= 3 && st.body.secretLair.bought === false, 'the Merchant shows this week\'s bundle');
  assert.ok(!JSON.stringify(st.body.secretLair).includes('usd'), 'no prices, ever');
  assert.equal((await call('secretlair', {week: '1999-W01'})).status, 409, 'last week\'s bundle is gone');
  const bought = await call('secretlair', {week: st.body.secretLair.week});
  assert.equal(bought.status, 200);
  assert.equal(wallet.coins, 2000 - st.body.secretLair.price, 'coins paid once');
  const grant = calls.find(c => c[0] === 'play_apply' && c[1].p_ref === st.body.secretLair.ref)[1].p_delta;
  assert.equal(grant.cards.length, st.body.secretLair.cards.length, 'every card comes into the Trunk');
  assert.ok(grant.cards.every(c => c.set === 'sld'), 'as its real Secret Lair printing');
  assert.equal(styles.length, st.body.secretLair.cards.length, 'and its Secret Lair art is unlocked');
  assert.equal((await call('secretlair', {week: st.body.secretLair.week})).status, 409, 'once a week');
  bundles = []; wallet.coins = 10;
  assert.equal((await call('secretlair', {})).status, 409, 'short coins: refused');
  const sid = styles[0];
  assert.equal((await call('style', {oracle: sid.o, print: sid.id})).body.styles.find(s => s.id === sid.id).on, true, 'a style goes on');
  assert.equal((await call('style', {oracle: sid.o, print: null})).body.styles.some(s => s.on), false, 'and comes off');
  assert.equal((await call('style', {oracle: sid.o, print: id(99)})).status, 403, 'locked styles cannot be used');
  assert.equal((await call('style', {oracle: 'x', print: null})).status, 400, 'bad ids refused');

  // --- Store route: coins or one seal, once per card, this week only.
  {
    wallet = {coins: 1000, seal_r: 1, seal_m: 0, seal_c: 0, seal_u: 0, starter_at: '2026-11-01'}; styles = []; calls.length = 0;
    const st2 = await call('state');
    const so = st2.body.secretLairStore;
    assert.ok(so?.offers?.length >= 1, 'the store comes with the state');
    const card = so.offers[0], price = secretLairOfferPrice(card);
    assert.equal((await call('sloffer', {id: card.id, week: '1999-W01'})).status, 409, 'last week\'s store is gone');
    assert.equal((await call('sloffer', {id: id(999)})).status, 404, 'only cards on offer');
    const got = await call('sloffer', {id: card.id, pay: 'coins', week: so.week});
    assert.equal(got.status, 200);
    assert.equal(wallet.coins, 1000 - price.coins, 'paid in coins, less the sale');
    const g = calls.find(c => c[0] === 'play_apply' && c[1].p_ref === `slo:${so.week}:${card.id}`)[1].p_delta;
    assert.equal(g.cards[0].set, 'sld', 'the real Secret Lair printing comes into the Trunk');
    assert.ok(styles.some(x => x.id === card.id), 'with its Secret Lair art unlocked');
    assert.equal((await call('sloffer', {id: card.id, pay: 'coins'})).body.error, 'bought', 'once per card');
    const other = so.offers.find(c => c.id !== card.id && c.r !== 'rare');
    if (other) assert.equal((await call('sloffer', {id: other.id, pay: 'seal'})).status, 409, 'no seal of its rarity: refused');
    wallet.coins = 0;
    const third = so.offers.find(c => c.id !== card.id);
    if (third) assert.equal((await call('sloffer', {id: third.id, pay: 'coins'})).body.error, 'short_coins', 'short coins: refused');
    const html = secretLairStore({state: {wallet: {coins: 0, seal_r: 1}, secretLairStore: so}});
    assert.ok(html.includes('playEconSlOffer') && html.includes(card.n), 'the store row shows each card');
  }

  // --- UI: the Merchant shelf and the Trunk art.
  const shelf = secretLairShelf({state: {wallet: {coins: 0}, cards: cardsOwned, secretLair: {...st.body.secretLair, bought: false}}});
  assert.ok(shelf.includes("This week's Secret Lair") && shelf.includes('disabled'), 'a shelf, and the button waits for coins');
  assert.ok(secretLairShelf({state: {wallet: {coins: 9e9}, cards: [], secretLair: {...st.body.secretLair, bought: true}}}).includes('In your Trunk'), 'bought: no second button');
  assert.equal(secretLairShelf({state: {}}), '', 'no bundle, no shelf');
  setPlayStyles([{o: ora(5), i: 'sl-art.jpg', on: true}]);
  assert.ok(playCardTile({o: ora(5), n: 'Card 5', r: 'rare', c: 1, s: ['sld']}, null).includes('sl-art.jpg'), 'the Trunk shows the Secret Lair art in use');
  setPlayStyles([]);
}
console.log('play secret lair: ok');
