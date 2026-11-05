// Play progression server routes (/api/progress/*). The server, never the app, hands out rewards:
// it checks the player's sign-in, rolls packs with a crypto-strength random roll, checks seal
// rarities against Scryfall, and writes through public.play_apply (service key only). The app
// just shows what this returns. Play's wall: nothing here touches the real collection or prices.
// Spec: play-progression.md sections 3 to 9.
import {SUPABASE} from './config.js';
import {weeklyPreconsByFormat, commanderStorePool, commanderDeckLegal, COMMANDER_STORE_ROTATING} from './play-precon-formats.js';
import {loadMtgBooster, mtgBoosterCards, drawMtgBooster, mtgGodPackPicks} from './mtg-boosters.js';
import {rewardSet, setFormats} from './play-econ-sets.js';
import {isBasicLand, starterGrant, sealTrackBonus, packContentsRow, cardDelta, RARITY_SEAL, FORGE_STEPS, forgeRatio, holoCost, preconQuote, mtgjsonCardDelta, mtgjsonDeckRows, deckShortfall, ownedByName, isCollectorPack, collectorOdds, collectorPicks, collectorSource, godPackOdds} from './play-econ-rules.js';
import {RETIRED_STARTER_NAMES} from './play-starter-deck.js';
import {weeklySecretLairOffers, secretLairOfferPrice, weeklySecretLair, secretLairPrice, secretLairLabel, secretLairRef, secretLairCardDelta, secretLairStyle, pickSecretLairStyle} from './play-secret-lair.js';
import {STORY_DEEDS, STORY_ACT_DEEDS, storyDeedsEarned, keyFeatsMissing} from './story-deeds.js';
import {rerollUsed, weeklyRerollUsed, ACHIEVEMENTS, achievementRows, achievementReward, achievementRef, questRows, questReward, loginStamp, rewardDelta, matchCounters, playDay, playWeek, achievementsPayload} from './play-achievements.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
const fail = (error, status = 400) => json({error}, status);
// Existing players get the free precons on their next visit (Randall's call, 3 Nov).
export const STARTER_TOP_UP = true;
export const STARTER_REF = 'starter:precons-2026-11';
// The free Commander precons' cards stay out of the Trunk: they play only from the deck pickers (Randall 4 Nov).
export const STARTER_COMMANDER_CARDS = false;
let preconsCache = null;
export async function freePrecons(env, request, fetcher) {
  if (!preconsCache) preconsCache = asset(env, request, '/data/play-starters/precons.json', fetcher).then(d => (Array.isArray(d?.decks) ? d.decks : null)).then(d => { if (!d) preconsCache = null; return d || []; });
  return preconsCache;
}

function rpc(env, name, args, fetcher) {
  const key = env.SUPABASE_SERVICE_KEY, headers = {apikey: key, 'Content-Type': 'application/json', Accept: 'application/json'};
  if (/^eyJ/.test(key || '')) headers.Authorization = 'Bearer ' + key;
  return fetcher((env.SUPABASE_URL || SUPABASE.url) + '/rest/v1/rpc/' + name, {method: 'POST', headers, body: JSON.stringify(args)})
    .then(async r => { const body = await r.json().catch(() => null); if (!r.ok) throw Object.assign(Error(body?.message || 'rpc_failed'), {code: body?.message || 'rpc_failed'}); return body; });
}

// Adds the headers Scryfall requires to every request made to it.
export const scryfallFetch = fetcher => (url, init = {}) => /^https:\/\/api\.scryfall\.com\//.test(String(url))
  ? fetcher(url, {...init, headers: {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0', ...(init.headers || {})}}) : fetcher(url, init);

// Crypto-strength [0,1), so a pack can't be predicted or replayed.
export function cryptoRandom() { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; }

// Static files (booster sheets, the Standard list) come from the site's own assets.
function asset(env, request, path, fetcher) {
  const url = new URL(path, request.url).toString();
  return (env.ASSETS ? env.ASSETS.fetch(new Request(url)) : fetcher(url)).then(r => r.ok ? r.json() : null).catch(() => null);
}

// Secret Lair drops (scripts/bake-secret-lair.mjs), read once per isolate.
let slCache = null;
async function secretLairDrops(env, request, fetcher) {
  if (!slCache) slCache = asset(env, request, '/data/secret-lair/drops.json', fetcher).then(d => (Array.isArray(d?.drops) ? d.drops : null)).then(d => { if (!d) slCache = null; return d || []; });
  return slCache;
}

// MTGJSON's deck list, read once an hour per isolate, for the weekly precon store.
let preconListCache = null;
const commanderLegal = new Map(); // deck file -> legal in Commander (read once per isolate)
async function commanderStore(fetcher, index, week) {
  const {featured, order, code, released} = commanderStorePool(index, week), rotating = [];
  for (const f of order) {
    if (rotating.length >= COMMANDER_STORE_ROTATING) break;
    if (!commanderLegal.has(f)) {
      const r = await fetcher('https://mtgjson.com/api/v5/decks/' + f + '.json', {headers: {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (play precons)'}}).catch(() => null);
      const d = r?.ok ? (await r.json().catch(() => null))?.data : null;
      commanderLegal.set(f, !!d && commanderDeckLegal(d));
    }
    if (commanderLegal.get(f)) rotating.push(f);
  }
  return {featured, rotating, code, released};
}
async function preconStoreFiles(fetcher, now = new Date()) {
  const week = playWeek(now.toISOString().slice(0, 10));
  if (!preconListCache || Date.now() - preconListCache.at > 3600e3) {
    const r = await fetcher('https://mtgjson.com/api/v5/DeckList.json', {headers: {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (play precons)'}}).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (Array.isArray(j?.data)) preconListCache = {at: Date.now(), data: j.data, commander: new Map()};
  }
  if (!preconListCache) return null;
  const formats = weeklyPreconsByFormat(preconListCache.data, week);
  const cmd = preconListCache.commander.get(week) || await commanderStore(fetcher, preconListCache.data, week).catch(() => ({featured: [], rotating: []}));
  preconListCache.commander.set(week, cmd);
  formats.Commander = [...cmd.featured, ...cmd.rotating];
  // A release listed before its set is out (Star Trek Commander) is flagged so the shop can light it up.
  const today = now.toISOString().slice(0, 10), prerelease = cmd.featured.length && cmd.released > today
    ? {set: String(cmd.code || '').toLowerCase(), name: (await scryfallSets(fetcher).catch(() => [])).find(x => x.code === String(cmd.code || '').toLowerCase())?.name || '', releases: cmd.released, files: cmd.featured} : null;
  return {week, files: Object.values(formats).flat(), formats, featured: cmd.featured, prerelease};
}

// This Play week's bundle (UTC weeks, Monday to Sunday), as the Merchant shows it.
export function secretLairOffer(drops, config = {}, now = new Date()) {
  const today = now.toISOString().slice(0, 10), week = playWeek(today), drop = weeklySecretLair(drops, week, today);
  if (!drop) return null;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7 || 7)));
  return {week, ref: secretLairRef(week), id: drop.id, ...secretLairLabel(drop), price: secretLairPrice(drop, config), ends: end.toISOString(),
    cards: drop.cards.map(c => ({id: c.id, o: c.o, n: c.n, r: c.r, f: c.f}))};
}

// This Play week's Secret Lair store: six single cards beside the bundle, four on sale (Arena's style store).
export function secretLairStoreOffer(drops, now = new Date()) {
  const today = now.toISOString().slice(0, 10), week = playWeek(today), bundle = weeklySecretLair(drops, week, today);
  const offers = weeklySecretLairOffers(drops, week, today, bundle?.id || '');
  if (!offers.length) return null;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7 || 7)));
  return {week, ends: end.toISOString(), offers: offers.map(c => ({id: c.id, o: c.o, n: c.n, r: c.r, f: c.f, off: c.off}))};
}

let setsCache = null;
async function scryfallSets(fetcher) {
  if (setsCache && Date.now() - setsCache.at < 6 * 3600e3) return setsCache.data;
  const body = await fetcher('https://api.scryfall.com/sets', {headers: {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0'}}).then(r => r.ok ? r.json() : null).catch(() => null);
  if (Array.isArray(body?.data)) setsCache = {at: Date.now(), data: body.data};
  return setsCache?.data || [];
}

export async function currentRewardSet(env, request, fetcher = fetch) {
  return (await shopSets(env, request, fetcher)).reward;
}

// The reward set, plus every set the merchant sells (each has a booster file), newest first.
export async function shopSets(env, request, fetcher = fetch) {
  const [facts, boosterIndex, sets] = await Promise.all([
    asset(env, request, '/forge-rules/current/official-format-facts.json', fetcher),
    asset(env, request, '/data/mtg-boosters/index.json', fetcher),
    scryfallSets(fetcher)]);
  const baked = boosterIndex?.sets || {}, today = new Date().toISOString().slice(0, 10);
  const formats = setFormats({standardSets: facts?.standardSets || [], modernSets: facts?.modernSets || [], boosterIndex: boosterIndex || {}, scryfallSets: sets});
  const shop = sets.filter(s => baked[s.code] && s.released_at && s.released_at <= today)
    .map(s => ({code: s.code, name: s.name, released: s.released_at, count: s.card_count || null, format: formats.get(s.code) || 'eternal'})).sort((a, b) => b.released.localeCompare(a.released));
  return {reward: rewardSet({standardSets: facts?.standardSets || [], boosterIndex: boosterIndex || {}, scryfallSets: sets}), shop};
}

async function scryfallCollection(identifiers, fetcher) {
  const out = [];
  for (let i = 0; i < identifiers.length; i += 75) {
    const r = await fetcher('https://api.scryfall.com/cards/collection', {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'CardStashy/1.0'}, body: JSON.stringify({identifiers: identifiers.slice(i, i + 75)})}).catch(() => null);
    const body = r?.ok ? await r.json().catch(() => null) : null;
    out.push(...(body?.data || []));
  }
  return out;
}

async function readBody(request) {
  const text = await request.text().catch(() => '');
  if (text.length > 70000) throw Error('too_large');
  try { return text ? JSON.parse(text) : {}; } catch { throw Error('bad_json'); }
}

export async function progressRoute(request, env, {verifyBearer, fetcher = fetch} = {}) {
  const url = new URL(request.url), path = url.pathname.replace(/^\/api\/progress\/?/, '');
  if (!env.SUPABASE_SERVICE_KEY) return fail('not_configured', 503);
  const user = verifyBearer ? await verifyBearer(request.headers.get('Authorization') || '') : null;
  if (!user?.id) return fail('sign_in', 401);
  const uid = user.id, apply = (ref, kind, delta) => rpc(env, 'play_apply', {p_user: uid, p_ref: ref, p_kind: kind, p_delta: delta}, fetcher);
  const state = () => rpc(env, 'play_state', {p_user: uid}, fetcher);
  // Secret Lair styles and bought bundles (supabase/migrations/20261103170000_play_secret_lair.sql).
  // Until that SQL runs this answers null and the Merchant hides the bundle.
  const looks = () => rpc(env, 'play_styles', {p_user: uid}, fetcher).catch(() => null);
  // A rare Secret Lair style, once per ref: the art of a card the player owns, or the card with it.
  const grantStyle = async (ref, s0) => {
    try {
      const [drops, l, s] = await Promise.all([secretLairDrops(env, request, fetcher), looks(), s0 || state()]);
      if (!l || !drops.length) return null;
      const pick = pickSecretLairStyle(drops, new Set((s.cards || []).map(c => c.o)), new Set((l.styles || []).map(x => x.id)), cryptoRandom);
      if (!pick) return null;
      const out = await rpc(env, 'play_add_styles', {p_user: uid, p_ref: ref, p_styles: [secretLairStyle(pick.card)]}, fetcher);
      if (out?.duplicate) return null;
      if (!pick.owned) await apply(ref + ':card', 'style', {cards: [secretLairCardDelta(pick.card)]});
      return {...secretLairStyle(pick.card), card: !pick.owned};
    } catch { return null; }
  };
  // Story progress is the player's own story:* ledger refs (supabase/migrations/20261101190000_play_story.sql).
  // Before that function exists this answers null and the app keeps its device copy.
  const storyRefs = () => rpc(env, 'play_story_refs', {p_user: uid}, fetcher).catch(() => null);
  // Achievement counters and claims (supabase/migrations/20261101210000_play_achievements.sql). Until
  // that SQL runs these answer null, and the app shows quests and achievements at zero.
  const counters = {
    bump: (ref, kind, c) => rpc(env, 'play_bump', {p_user: uid, p_ref: ref, p_kind: kind, p_counters: c}, fetcher).catch(() => null),
    read: () => rpc(env, 'play_counters', {p_user: uid}, fetcher).catch(() => null),
    claims: () => rpc(env, 'play_claims', {p_user: uid}, fetcher).catch(() => null),
  };
  // Merchant, pack and Trunk deeds count what the server itself did, once per action (cnt:* refs).
  // Day and week copies feed the quests that count packs and stamps.
  const tally = (ref, c, tz) => {
    const day = playDay(tz), week = playWeek(day), out = {};
    for (const [k, v] of Object.entries(c)) { if (!v) continue; out[k] = v; if (!/:/.test(k)) { out[`d:${day}:${k}`] = v; out[`w:${week}:${k}`] = v; } }
    return Object.keys(out).length ? counters.bump('cnt:' + ref, 'tally', out) : Promise.resolve(null);
  };
  // The ten free precons (data/play-starters/precons.json, Randall 4 Nov 00:32Z): five 60-card and five
  // Commander decks, once (ref STARTER_REF). The 60-card decks are saved as Play decks with their real
  // printings and their cards go into the Trunk. The Commander decks live only in the Play deck pickers
  // (app.js, Randall 4 Nov 00:40Z): never in Decks or the Trunk; their cards join the Trunk only if
  // STARTER_COMMANDER_CARDS. The old homemade starter decks are taken back. Existing players get all
  // this on their next visit (STARTER_TOP_UP).
  const grantStarterDecks = async () => {
    const decks = await freePrecons(env, request, fetcher);
    if (decks.length < 10) return false;
    const rows = decks.flatMap(d => d.rows), key = r => r.set ? r.set + ':' + r.number : 'n:' + r.name.toLowerCase();
    const want = [...new Map(rows.map(r => [key(r), r])).values()];
    const cards = await scryfallCollection(want.map(r => r.set ? {set: r.set, collector_number: r.number} : {name: r.name.split(' // ')[0]}), fetcher);
    const byKey = new Map();
    for (const c of cards) { byKey.set(c.set + ':' + c.collector_number, c); byKey.set('n:' + c.name.toLowerCase(), c); byKey.set('n:' + String(c.name).split(' // ')[0].toLowerCase(), c); }
    const cardOf = r => byKey.get(key(r)) || byKey.get('n:' + r.name.toLowerCase());
    if (want.some(r => !cardOf(r))) return false;
    const trunk = decks.filter(d => d.format !== 'Commander' || STARTER_COMMANDER_CARDS).flatMap(d => d.rows).filter(r => !isBasicLand(r.name));
    const paid = await apply(STARTER_REF, 'starter', {cards: trunk.flatMap(r => Array.from({length: Math.min(4, r.qty)}, () => cardDelta(cardOf(r))))});
    await counters.bump(STARTER_REF, 'tally', {starter_precons: 1});
    if (paid?.duplicate) return false;
    const mine = (await state()).decks || [], have = new Set(mine.map(d => d.name));
    for (const d of mine) if (RETIRED_STARTER_NAMES.includes(d.name)) await rpc(env, 'play_save_deck', {p_user: uid, p_id: d.id, p_name: d.name, p_format: d.format || '', p_cards: [], p_delete: true}, fetcher).catch(() => null);
    for (const d of decks) if (d.format !== 'Commander' && !have.has(d.name)) await rpc(env, 'play_save_deck', {p_user: uid, p_id: null, p_name: d.name, p_format: d.format,
      p_cards: d.rows.map(r => { const c = cardOf(r); return {name: r.name, qty: r.qty, set: c.set, number: c.collector_number}; }), p_delete: false}, fetcher).catch(() => null);
    return true;
  };
  // State for the app: the wallet plus the counters, claims and Story refs that achievements read.
  try {
    if (path === 'state' && request.method === 'GET') {
      const [s, sets, c, claimed, story] = await Promise.all([state(), shopSets(env, request, fetcher), counters.read(), counters.claims(), storyRefs()]);
      const [l, drops] = await Promise.all([looks(), secretLairDrops(env, request, fetcher)]);
      const sl = l ? secretLairOffer(drops, s.config) : null, preconStore = await preconStoreFiles(fetcher).catch(() => null);
      const store = l ? secretLairStoreOffer(drops) : null;
      return json({...s, rewardSet: sets.reward, shop: sets.shop, counters: c || {}, claimed: claimed || [], story: Array.isArray(story) ? story : [],
        styles: l?.styles || [], secretLair: null, secretLairStore: store, preconStore});
    }
    if (path === 'achievements' && request.method === 'GET') {
      // Every achievement, quest and log-in reward, worked out for this player (play-achievements.js).
      // The native app renders this as-is; ?tz= is the device's offset in minutes for the quest day.
      const [s, c, claimed, story] = await Promise.all([state(), counters.read(), counters.claims(), storyRefs()]);
      const ctx = {counters: c || {}, claimed: claimed || [], state: {...s, story: Array.isArray(story) ? story : []}, day: playDay(url.searchParams.get('tz'))};
      return json({...achievementsPayload(ctx, s.config || {}), ready: !!(c && claimed)});
    }
    if (path === 'story' && request.method === 'GET') return json({refs: await storyRefs()});
    if (request.method !== 'POST') return fail('method', 405);
    const body = await readBody(request);
    if (path === 'starter') {
      const [s, reward] = await Promise.all([state(), currentRewardSet(env, request, fetcher)]);
      if (s.wallet?.starter_at) return json({...s, rewardSet: reward});
      if (!reward) return fail('no_reward_set', 503);
      // The welcome gift: coins and seals from config, and 5 packs each of the 4 newest Merchant sets
      // (Randall 4 Nov). An account that already holds packs or cards (the 4 Nov reset gave its own 20)
      // gets no second set of packs.
      const delta = starterGrant(s.config, reward.code, [], []), st = s.config?.starter || {};
      const fresh = !(s.packs || []).length && !(s.cards || []).length;
      const newest = fresh ? ((await shopSets(env, request, fetcher)).shop || []).slice(0, st.newestSets ?? 4) : [];
      delta.packs = newest.flatMap(x => Array.from({length: st.packsPerSet ?? 5}, () => ({set: x.code, source: 'starter'})));
      await apply('starter', 'starter', delta);
      await grantStarterDecks().catch(() => false);
      return json({...await state(), rewardSet: reward});
    }
    if (path === 'open') {
      const s = await state(), pack = (s.packs || []).find(p => String(p.id) === String(body.id));
      if (!pack) return fail('pack_not_found', 404);
      const data = await loadMtgBooster(pack.set, p => (env.ASSETS ? env.ASSETS.fetch(new Request(new URL(p, request.url))) : fetcher(new URL(p, request.url))));
      if (!data) return fail('no_booster', 503);
      // Scryfall refuses requests without a User-Agent and Accept header, and a Worker sends neither.
      const known = await mtgBoosterCards(data, [], scryfallFetch(fetcher));
      // A collector pack (boss, hard achievement) is the same booster with every card holo; any other pack
      // has a small chance to come out as one too.
      const earned = isCollectorPack(pack), surprise = !earned && cryptoRandom() < collectorOdds(s.config);
      const drawn = drawMtgBooster(data, known, cryptoRandom), kind = earned || surprise ? 'collector' : 'regular';
      // God pack, at Wizards' own odds (1 in 1,000 packs, 1 in 300 Collector packs): every card a holo rare or mythic.
      const god = cryptoRandom() < godPackOdds(s.config, kind) ? mtgGodPackPicks(data, known, drawn.length, cryptoRandom) : null;
      const picks = god || (kind === 'collector' ? collectorPicks(drawn) : drawn);
      const contents = picks.map(packContentsRow).filter(c => c.oracle_id);
      // Never spend a pack on an empty draw: the pack stays banked and the player can try again.
      if (contents.length < Math.min(5, picks.length || 5)) return fail('cards_unavailable', 503);
      const bonus = sealTrackBonus(s.config, (s.wallet?.packs_opened || 0) + 1);
      const result = await apply('open:' + pack.id, 'open', {open: {id: pack.id, contents}, cards: contents.filter(c => c.oracle_id).map(cardDelta), seals: bonus});
      await tally('open:' + pack.id, {packs_opened: 1, packs_collector: kind === 'collector' || god ? 1 : 0, packs_god: god ? 1 : 0,
        pulls_mythic: contents.filter(c => c.rarity === 'mythic').length, ...(/^[a-z0-9]{2,8}$/.test(pack.set) ? {['po:' + pack.set]: 1} : {})}, body.tz);
      const style = god ? await grantStyle('slstyle:open:' + pack.id) : null;
      return json({counters: await counters.read(), ...(style ? {style} : {}), pack: {...pack, contents, ...(earned || surprise ? {collector: true} : {}), ...(surprise ? {surprise: true} : {}), ...(god ? {god: true, collector: true} : {})}, sealBonus: bonus, duplicateCoins: result.duplicate_coins || 0, converted: result.converted || [], state: await state()});
    }
    if (path === 'craft') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('bad_card');
      const [card] = await scryfallCollection([{id}], fetcher);
      const seal = RARITY_SEAL[card?.rarity];
      if (!card?.oracle_id || !seal) return fail('bad_card');
      // Secret Lair printings are never crafted: the weekly store (coins), solo, and achievements only.
      if (card.set === 'sld') return fail('no_craft_sld', 409);
      const s = await state(), owned = (s.cards || []).find(c => c.o === card.oracle_id)?.c || 0;
      if (owned >= (s.config?.maxCopies || 4)) return fail('have_max', 409);
      // A holo stamp costs the stamp plus the holo upgrade (1 + 2 seals of the card's rarity).
      const holo = body.holo === true, cost = 1 + (holo ? holoCost(s.config) : 0);
      if (holo && !(card.finishes || []).includes('foil')) return fail('no_foil', 409);
      if ((s.wallet?.['seal_' + seal] || 0) < cost) return fail('no_seal', 409);
      const craftRef = 'craft:' + crypto.randomUUID();
      await apply(craftRef, 'craft', {seals: {[seal]: -cost}, cards: [{...cardDelta(card), ...(holo ? {foil: true} : {})}]});
      await tally(craftRef, {crafts: 1, holos_made: holo ? 1 : 0}, body.tz);
      return json({counters: await counters.read(), card: {id: card.id, oracle_id: card.oracle_id, name: card.name, rarity: card.rarity, holo}, state: await state()});
    }
    if (path === 'forge') {
      // Seals step up one rarity: ratio x the lower seal for 1 of the next, up to 10 at once.
      const to = String(body.to || ''), from = FORGE_STEPS[to], times = Math.floor(Number(body.times) || 1);
      if (!from || times < 1 || times > 10) return fail('bad_forge');
      const s = await state(), cost = forgeRatio(s.config, to) * times;
      if ((s.wallet?.['seal_' + from] || 0) < cost) return fail('no_seal', 409);
      const forgeRef = 'forge:' + crypto.randomUUID();
      await apply(forgeRef, 'forge', {seals: {[from]: -cost, [to]: times}});
      await tally(forgeRef, {forges: times}, body.tz);
      return json({counters: await counters.read(), forged: {to, from, times, cost}, state: await state()});
    }
    if (path === 'holo') {
      // The Forge turns one copy you own holo for 2 seals of its rarity. Never more holos than copies.
      const o = String(body.oracle || '');
      if (!/^[0-9a-f-]{36}$/i.test(o)) return fail('bad_card');
      const s = await state(), card = (s.cards || []).find(c => c.o === o), seal = RARITY_SEAL[card?.r], cost = holoCost(s.config);
      if (!card || !seal) return fail('bad_card', 404);
      if ((card.h | 0) >= (card.c | 0)) return fail('all_holo', 409);
      if ((s.wallet?.['seal_' + seal] || 0) < cost) return fail('no_seal', 409);
      const holoRef = 'holo:' + crypto.randomUUID();
      await apply(holoRef, 'holo', {seals: {[seal]: -cost}, holo: [o]});
      await tally(holoRef, {holos_made: 1}, body.tz);
      return json({counters: await counters.read(), holo: {oracle: o, name: card.n, seal, cost}, state: await state()});
    }
    if (path === 'precon') {
      // A published 60-card precon from MTGJSON: pay 25 coins per card you don't own (250 to 1,500,
      // free when you own it all); the missing copies arrive in their exact printings and the list
      // is saved as a Play deck with those printings.
      const file = String(body.file || '').replace(/\.json$/, '');
      if (!/^[A-Za-z0-9_.-]{3,120}$/.test(file)) return fail('bad_precon');
      const r = await fetcher('https://mtgjson.com/api/v5/decks/' + file + '.json', {headers: {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (play precons)'}}).catch(() => null);
      const d = r?.ok ? (await r.json().catch(() => null))?.data : null;
      if (!d?.mainBoard?.length) return fail('bad_precon');
      // Commander decks (the commander zone plus 99) are singleton: one copy of each card, the commander
      // saved with board 'commander'.
      const cmdr = (d.commander || []).length > 0;
      const rows = mtgjsonDeckRows(d), byName = new Map([...(d.commander || []), ...(d.mainBoard || []), ...(d.sideBoard || [])].map(c => [c.name, c]));
      if (cmdr) rows.unshift(...(d.commander || []).map(c => ({name: String(c.name || ''), qty: 1, set: String(c.setCode || '').toLowerCase(), number: String(c.number || ''), id: c.identifiers?.scryfallId || '', rarity: mtgjsonCardDelta(c).rarity, board: 'commander'})).filter(r => r.name));
      const s = await state(), quote = preconQuote(rows, ownedByName(s.cards || []), {type: String(d.type || (cmdr ? 'Commander Deck' : '')), config: s.config, cap: cmdr ? 1 : (s.config?.maxCopies || 4)}), short = quote.short;
      const missing = quote.missing, price = quote.price;
      // Whole-deck coin purchases are only for this week's five store precons; the rest are built with seals.
      if (price > 0) { const store = await preconStoreFiles(fetcher).catch(() => null); if (!store || !store.files.includes(file)) return fail('not_in_store', 409); }
      if ((s.wallet?.coins || 0) < price) return fail('short_coins', 409);
      const cards = short.missing.flatMap(m => Array.from({length: m.need}, () => mtgjsonCardDelta(byName.get(m.name)))).filter(c => c.oracle_id);
      const preconRef = 'precon:' + crypto.randomUUID();
      await apply(preconRef, 'precon', {coins: -price, cards});
      await tally(preconRef, {precons: 1, coins_spent: price}, body.tz);
      const deck = await rpc(env, 'play_save_deck', {p_user: uid, p_id: null, p_name: String(d.name || 'Precon').slice(0, 80), p_format: cmdr ? 'Commander' : String(body.format || '').slice(0, 40),
        p_cards: rows.map(({name, qty, board, set, number}) => ({name, qty, ...(board ? {board} : {}), set, number})), p_delete: false}, fetcher);
      return json({deck, price, granted: cards.length, counters: await counters.read(), state: await state()});
    }
    if (path === 'login') {
      // The first visit of the day stamps the log-in calendar (counted days, never a streak). The day
      // follows the device's offset, limited to UTC-12..UTC+14.
      const day = playDay(body.tz), s = await state();
      if (!s.wallet?.starter_at) return json({login: null});
      const bump = await counters.bump('login:' + day, 'login', {logins: 1});
      if (!bump) return json({login: null});
      // Players from before the free precons get them once (and the old homemade starters go).
      const topUp = STARTER_TOP_UP && !bump.counters?.starter_precons && await grantStarterDecks().catch(() => false);
      const st = loginStamp(bump.counters?.logins);
      if (bump.duplicate) return json({login: {day, ...st, fresh: false}, counters: bump.counters, ...(topUp ? {state: await state()} : {})});
      const reward = await currentRewardSet(env, request, fetcher);
      await apply('loginpay:' + day, 'login', rewardDelta([st.reward, st.monthReward], reward?.code, 'login'));
      return json({login: {day, ...st, fresh: true}, counters: bump.counters, state: await state()});
    }
    if (path === 'match') {
      // A finished match from the app's match record. Device-reported, so it only moves quests and
      // achievements, within caps: 40 matches a day, 3 friend matches a day, 90 minutes a match.
      const id = String(body.id || '');
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return fail('bad_match');
      const day = playDay(body.tz), now = await counters.read();
      if (!now) return fail('not_ready', 503);
      if (body.mode !== 'practice' && (now[`d:${day}:matches`] || 0) >= 40) return json({counted: false, counters: now});
      const c = matchCounters(body, day, {friendsToday: now[`d:${day}:friend_matches`] || 0, practiceToday: now[`d:${day}:practice_matches`] || 0});
      if (!c) return fail('bad_match');
      if (!Object.keys(c).length) return json({counted: false, counters: now});
      const out = await counters.bump('match:' + id, 'match', c);
      return json({counted: !out?.duplicate, counters: out?.counters || now});
    }
    if (path === 'deeds') {
      // Story deeds the app saw in a won Story battle (story-deeds.js). A battle deed needs that battle
      // won with the Story deck from its seat; an act deed is re-checked here from Story progress. Each pays once.
      const battle = String(body.battle || ''), ids = Array.isArray(body.deeds) ? body.deeds.slice(0, 8).map(String) : [];
      if (!/^a\d{1,2}b[1-9]$/.test(battle)) return fail('bad_battle');
      const refs = await storyRefs();
      if (!Array.isArray(refs)) return fail('not_ready', 503);
      const has = new Set(refs), actOk = new Set(storyDeedsEarned(battle, {own: true}, refs)), counted = [];
      for (const id of new Set(ids)) {
        const d = STORY_DEEDS.find(x => x.id === id), a = STORY_ACT_DEEDS.find(x => x.id === id);
        const ok = d ? d.battle === battle && has.has(`story:${battle}:${d.seat === 'villain' ? 'villain' : 'loaner'}`) : a ? actOk.has(id) : false;
        if (!ok) continue;
        const out = await counters.bump('deed:' + id, 'deed', {['sd:' + id]: 1});
        if (out && !out.duplicate) counted.push(id);
      }
      return json({counted, counters: await counters.read()});
    }
    if (path === 'claim') {
      // Pays one finished achievement step, daily or weekly quest. The server re-checks the progress.
      const [s0, c, claimed, reward, story] = await Promise.all([state(), counters.read(), counters.claims(), currentRewardSet(env, request, fetcher), storyRefs()]);
      if (!c || !claimed) return fail('not_ready', 503);
      const s = {...s0, story: Array.isArray(story) ? story : []};
      const set = reward?.code || '';
      let ref = '', delta = null;
      if (body.kind === 'ach') {
        const step = Number(body.step), row = achievementRows({counters: c, state: s, claimed}).find(r => r.id === body.id);
        if (!row || !Number.isSafeInteger(step) || !row.steps[step]?.done) return fail('not_earned', 409);
        ref = achievementRef(row.id, step); delta = rewardDelta([achievementReward(ACHIEVEMENTS.find(a => a.id === row.id), step, s.config)], set, 'achievement');
      } else {
        const q = questRows({counters: c, claimed, day: playDay(body.tz)});
        if (body.kind === 'weekly-all') { if (!q.weeklyAll.done) return fail('not_earned', 409); ref = q.weeklyAll.ref; delta = rewardDelta([{seals: s.config?.weekly?.allDoneSeals || {r: 1}}], set, 'quest'); }
        else {
          const row = [...q.daily, ...q.weekly].find(x => x.id === body.id);
          if (!row?.done) return fail('not_earned', 409);
          ref = row.ref; delta = rewardDelta([questReward(row, s.config)], set, 'quest');
        }
      }
      if (claimed.includes(ref)) return fail('claimed', 409);
      const paid = await apply(ref, body.kind === 'ach' ? 'achievement' : 'quest', delta);
      if (paid?.duplicate) return fail('claimed', 409);
      // Gold and mythic achievement steps, and every Glory achievement, also bring a rare Secret Lair style.
      const crow = body.kind === 'ach' ? achievementRows({counters: c, state: s, claimed}).find(r => r.id === body.id) : null, tier = crow?.steps[Number(body.step)]?.tier || '';
      const style = crow?.glory || tier === 'gold' || tier === 'mythic' ? await grantStyle('slstyle:' + ref) : null;
      return json({ref, delta, ...(style ? {style} : {}), state: await state(), claimed: [...claimed, ref]});
    }
    if (path === 'reroll') {
      // One weekly swap a week: {scope:'weekly', id} for an unfinished, unclaimed weekly on this week's list.
      if (body.scope === 'weekly') {
        const day = playDay(body.tz), week = playWeek(day), id = String(body.id || ''), [c, claimed] = await Promise.all([counters.read(), counters.claims()]);
        if (!c || !claimed) return fail('not_ready', 503);
        if (weeklyRerollUsed(c, week)) return fail('rerolled', 409);
        const row = questRows({counters: c, claimed, day}).weekly.find(q => q.id === id);
        if (!row) return fail('bad_reroll');
        if (!row.canSwap) return fail('quest_done', 409);
        const out = await counters.bump('wreroll:' + week, 'reroll', {[`w:${week}:reroll_${id}`]: 1});
        if (!out || out.duplicate) return fail('rerolled', 409);
        return json({counters: out.counters});
      }
      // The day's one free quest swap: an easy or hard daily that isn't done is replaced by another.
      const level = body.level === 'hard' ? 'hard' : body.level === 'easy' ? 'easy' : '';
      if (!level) return fail('bad_reroll');
      const day = playDay(body.tz), [c, claimed] = await Promise.all([counters.read(), counters.claims()]);
      if (!c || !claimed) return fail('not_ready', 503);
      if (rerollUsed(c, day)) return fail('rerolled', 409);
      const row = questRows({counters: c, claimed, day}).daily.find(q => q.level === level);
      if (!row?.canSwap) return fail('quest_done', 409);
      const out = await counters.bump('reroll:' + day, 'reroll', {[`d:${day}:reroll_${level}`]: 1});
      if (!out || out.duplicate) return fail('rerolled', 409);
      return json({counters: out.counters});
    }
    if (path === 'secretlair') {
      // The weekly bundle is retired (Randall 5 Nov): Secret Lair cards sell one at a time in the store, for coins.
      return fail('no_bundle', 404);
    }
    if (path === 'secretlair-retired') {
      // This week's Secret Lair bundle: coins for real Secret Lair printings, each card into the Trunk with
      // its Secret Lair art unlocked as a style. Once per week (the sl:<week> ref).
      const [s, l, drops] = await Promise.all([state(), looks(), secretLairDrops(env, request, fetcher)]);
      if (!l) return fail('not_ready', 503);
      const offer = secretLairOffer(drops, s.config);
      if (!offer) return fail('no_bundle', 404);
      if (body.week && body.week !== offer.week) return fail('bundle_gone', 409);
      if ((l.bundles || []).includes(offer.ref)) return fail('bought', 409);
      if ((s.wallet?.coins || 0) < offer.price) return fail('short_coins', 409);
      const drop = drops.find(d => d.id === offer.id);
      const paid = await apply(offer.ref, 'secretlair', {coins: -offer.price, cards: drop.cards.map(secretLairCardDelta)});
      if (paid?.duplicate) return fail('bought', 409);
      await rpc(env, 'play_add_styles', {p_user: uid, p_ref: offer.ref + ':styles', p_styles: drop.cards.map(secretLairStyle)}, fetcher);
      await tally(offer.ref, {buys: 1, coins_spent: offer.price}, body.tz);
      const after = await looks();
      return json({counters: await counters.read(), state: await state(), styles: after?.styles || [], secretLair: {...offer, bought: true}});
    }
    if (path === 'sloffer') {
      // One card from this week's Secret Lair store, for coins (less its sale) or one seal of its rarity.
      // Once per card: owning its Secret Lair style means it's bought.
      const [s, l, drops] = await Promise.all([state(), looks(), secretLairDrops(env, request, fetcher)]);
      if (!l) return fail('not_ready', 503);
      const store = secretLairStoreOffer(drops);
      if (!store || (body.week && body.week !== store.week)) return fail('bundle_gone', 409);
      const card = store.offers.find(c => c.id === body.id), full = card && drops.flatMap(d => d.cards).find(c => c.id === card.id);
      if (!card || !full) return fail('no_offer', 404);
      if ((l.styles || []).some(x => x.id === card.id)) return fail('bought', 409);
      const price = secretLairOfferPrice(card, s.config), seal = false;
      if (body.pay === 'seal') return fail('coins_only', 409);
      if (seal ? (s.wallet?.['seal_' + price.seal] || 0) < 1 : (s.wallet?.coins || 0) < price.coins) return fail(seal ? 'no_seal' : 'short_coins', 409);
      const ref = `slo:${store.week}:${card.id}`;
      const paid = await apply(ref, 'secretlair', {...(seal ? {seals: {[price.seal]: -1}} : {coins: -price.coins}), cards: [secretLairCardDelta(full)]});
      if (paid?.duplicate) return fail('bought', 409);
      await rpc(env, 'play_add_styles', {p_user: uid, p_ref: ref + ':style', p_styles: [secretLairStyle(full)]}, fetcher);
      await tally(ref, {buys: 1, ...(seal ? {} : {coins_spent: price.coins})}, body.tz);
      const after = await looks();
      return json({counters: await counters.read(), state: await state(), styles: after?.styles || [], secretLairStore: store});
    }
    if (path === 'style') {
      // Shows an unlocked Secret Lair style on your copy of the card, or its own art again (print: null).
      const oracle = String(body.oracle || ''), print = body.print == null ? null : String(body.print);
      if (!/^[0-9a-f-]{36}$/.test(oracle) || (print !== null && !/^[0-9a-f-]{36}$/.test(print))) return fail('bad_style');
      const out = await rpc(env, 'play_pick_style', {p_user: uid, p_oracle: oracle, p_print: print}, fetcher).catch(e => ({error: e.code}));
      if (out?.error) return fail(/style_locked/.test(out.error) ? 'style_locked' : 'not_ready', /style_locked/.test(out.error) ? 403 : 503);
      return json({styles: out.styles || []});
    }
    if (path === 'buy') {
      const set = String(body.set || '').toLowerCase();
      if (!/^[a-z0-9]{2,8}$/.test(set)) return fail('bad_set');
      const index = await asset(env, request, '/data/mtg-boosters/index.json', fetcher);
      if (!index?.sets?.[set]) return fail('no_booster', 404);
      const s = await state(), price = s.config?.packPrice || 500;
      if ((s.wallet?.coins || 0) < price) return fail('short_coins', 409);
      const buyRef = 'buy:' + crypto.randomUUID();
      await apply(buyRef, 'buy', {coins: -price, packs: [{set, source: 'shop'}]});
      await tally(buyRef, {buys: 1, coins_spent: price}, body.tz);
      return json({counters: await counters.read(), state: await state()});
    }
    if (path === 'story') {
      // A won Story battle (Randall, 1 Nov 21:11-21:13Z). The Story precon pays the real rewards, once per
      // side: your side the battle's era packs (more for harder battles), the villain's side that villain's
      // signature card. Your own deck clears the battle and earns XP only, so nobody is gatekept and the
      // precon rewards stay there to come back for. A replay pays nothing.
      const id = String(body.battle || ''), m = id.match(/^a(\d{1,2})b([1-9])$/);
      if (!m) return fail('bad_battle');
      const act = await asset(env, request, `/data/story/act-${Number(m[1])}.json`, fetcher);
      const battle = act?.battles?.find(b => b.id === id);
      if (!battle) return fail('bad_battle', 404);
      // A secret boss (slot 9) only pays once every battle of its act is won with the Story decks and its key feats are earned.
      if (battle.secret) {
        const refs = await storyRefs();
        if (!Array.isArray(refs)) return fail('not_ready', 503);
        // Open once all 8 battles are won with the Story decks and the act's key feats are earned (story-deeds.js
        // KEY_FEATS). Whoever already cleared the secret boss keeps it open.
        if (!refs.includes(`story:${id}:clear`)) {
          if (!Array.from({length: 8}, (_, i) => `story:a${Number(m[1])}b${i + 1}:loaner`).every(r => refs.includes(r))) return fail('secret_locked', 403);
          const missing = keyFeatsMissing(Number(m[1]), await counters.read());
          if (missing.length) return json({error: 'secret_locked', keys: missing}, 403);
        }
      }
      const cfg = (await state()).config?.story || {}, set = battle.rewardSet, pack = n => Array.from({length: n}, () => ({set, source: 'story'}));
      const reward = battle.reward || {hero: {packs: cfg.firstWinPacks ?? 1, coins: 0}, villain: {card: null, coins: cfg.starCoins ?? 100}};
      const villain = body.seat === 'villain', own = body.deck === 'own', xp = cfg.firstWinXp ?? 150;
      let style = null;
      const paid = [], pay = async (ref, delta) => { const out = await apply(ref, 'story', delta); if (!out?.duplicate) paid.push(ref); return !out?.duplicate; };
      if (villain) {
        const refs = await storyRefs();
        if (Array.isArray(refs) && !refs.includes(`story:${id}:clear`)) return fail('villain_locked', 403);
        if (own) await pay(`story:${id}:vown`, {xp});
        else { const v = reward.villain || {}; await pay(`story:${id}:villain`, {cards: v.card ? [v.card] : [], coins: v.coins | 0, xp}); }
      } else {
        await pay(`story:${id}:clear`, {xp});
        // Every act's boss always gives a Collector pack of its era on the first hero-side win.
        // Bosses also bring a rare Secret Lair style, on that same first win.
        if (battle.slot === 8 || /boss/i.test(battle.kind || '')) { if (await pay(`story:${id}:collector`, {packs: [{set, source: collectorSource('story')}]})) style = await grantStyle(`slstyle:story:${id}`); }
        if (own) await pay(`story:${id}:own`, {});
        else {
          const h = reward.hero || {};
          await pay(`story:${id}:loaner`, {packs: pack(h.packs ?? 1), coins: h.coins | 0});
          if (battle.slot === 8) await pay(`story:act${Number(m[1])}:era`, {seals: cfg.eraClearSeals || {m: 1}});
        }
      }
      return json({paid, rewardSet: set, ...(style ? {style} : {}), refs: await storyRefs(), state: await state()});
    }
    if (path === 'deck') {
      const cards = Array.isArray(body.cards) ? body.cards.slice(0, 250).map(c => ({name: String(c?.name || '').slice(0, 160), qty: Math.max(1, Math.min(250, Number(c?.qty) || 1)), ...(c?.board === 'side' ? {board: 'side'} : {})})).filter(c => c.name) : [];
      const id = /^[0-9a-f-]{36}$/i.test(body.id || '') ? body.id : null;
      const deck = await rpc(env, 'play_save_deck', {p_user: uid, p_id: id, p_name: String(body.name || ''), p_format: String(body.format || ''), p_cards: cards, p_delete: body.delete === true && !!id}, fetcher);
      return json({deck});
    }
    return fail('unknown', 404);
  } catch (e) {
    const code = String(e?.code || e?.message || 'failed');
    return fail(/check constraint|short/i.test(code) ? 'short_balance' : code.slice(0, 80), /too_large/.test(code) ? 413 : 400);
  }
}
