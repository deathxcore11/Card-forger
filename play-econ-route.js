// Play progression server routes (/api/progress/*). The server, never the app, hands out rewards:
// it checks the player's sign-in, rolls packs with a crypto-strength random roll, checks seal
// rarities against Scryfall, and writes through public.play_apply (service key only). The app
// just shows what this returns. Play's wall: nothing here touches the real collection or prices.
// Spec: play-progression.md sections 3 to 9.
import {SUPABASE} from './config.js';
import {loadMtgBooster, mtgBoosterCards, drawMtgBooster} from './mtg-boosters.js';
import {rewardSet, setFormats} from './play-econ-sets.js';
import {starterGrant, sealTrackBonus, packContentsRow, cardDelta, RARITY_SEAL, FORGE_STEPS, forgeRatio, preconPrice, mtgjsonCardDelta, mtgjsonDeckRows, deckShortfall, ownedByName} from './play-econ-rules.js';
import {PRACTICE_STARTER_ROWS} from './play-starter-deck.js';
import {ACHIEVEMENTS, achievementRows, achievementReward, achievementRef, questRows, questReward, loginStamp, rewardDelta, matchCounters, playDay} from './play-achievements.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
const fail = (error, status = 400) => json({error}, status);

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
  try {
    if (path === 'state' && request.method === 'GET') {
      const [s, sets, c, claimed] = await Promise.all([state(), shopSets(env, request, fetcher), counters.read(), counters.claims()]);
      return json({...s, rewardSet: sets.reward, shop: sets.shop, counters: c || {}, claimed: claimed || []});
    }
    if (path === 'story' && request.method === 'GET') return json({refs: await storyRefs()});
    if (request.method !== 'POST') return fail('method', 405);
    const body = await readBody(request);
    if (path === 'starter') {
      const [s, reward] = await Promise.all([state(), currentRewardSet(env, request, fetcher)]);
      if (s.wallet?.starter_at) return json({...s, rewardSet: reward});
      if (!reward) return fail('no_reward_set', 503);
      const cards = await scryfallCollection(PRACTICE_STARTER_ROWS.filter(r => !/^(?:plains|island|swamp|mountain|forest)$/i.test(r.name)).map(r => ({name: r.name})), fetcher);
      const delta = starterGrant(s.config, reward.code, cards, PRACTICE_STARTER_ROWS);
      await apply('starter', 'starter', delta);
      return json({...await state(), rewardSet: reward});
    }
    if (path === 'open') {
      const s = await state(), pack = (s.packs || []).find(p => String(p.id) === String(body.id));
      if (!pack) return fail('pack_not_found', 404);
      const data = await loadMtgBooster(pack.set, p => (env.ASSETS ? env.ASSETS.fetch(new Request(new URL(p, request.url))) : fetcher(new URL(p, request.url))));
      if (!data) return fail('no_booster', 503);
      // Scryfall refuses requests without a User-Agent and Accept header, and a Worker sends neither.
      const known = await mtgBoosterCards(data, [], scryfallFetch(fetcher));
      const picks = drawMtgBooster(data, known, cryptoRandom);
      const contents = picks.map(packContentsRow).filter(c => c.oracle_id);
      // Never spend a pack on an empty draw: the pack stays banked and the player can try again.
      if (contents.length < Math.min(5, picks.length || 5)) return fail('cards_unavailable', 503);
      const bonus = sealTrackBonus(s.config, (s.wallet?.packs_opened || 0) + 1);
      const result = await apply('open:' + pack.id, 'open', {open: {id: pack.id, contents}, cards: contents.filter(c => c.oracle_id).map(cardDelta), seals: bonus});
      return json({pack: {...pack, contents}, sealBonus: bonus, duplicateCoins: result.duplicate_coins || 0, converted: result.converted || [], state: await state()});
    }
    if (path === 'craft') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('bad_card');
      const [card] = await scryfallCollection([{id}], fetcher);
      const seal = RARITY_SEAL[card?.rarity];
      if (!card?.oracle_id || !seal) return fail('bad_card');
      const s = await state(), owned = (s.cards || []).find(c => c.o === card.oracle_id)?.c || 0;
      if (owned >= (s.config?.maxCopies || 4)) return fail('have_max', 409);
      if ((s.wallet?.['seal_' + seal] || 0) < 1) return fail('no_seal', 409);
      await apply('craft:' + crypto.randomUUID(), 'craft', {seals: {[seal]: -1}, cards: [cardDelta(card)]});
      return json({card: {id: card.id, oracle_id: card.oracle_id, name: card.name, rarity: card.rarity}, state: await state()});
    }
    if (path === 'forge') {
      // Seals step up one rarity: ratio x the lower seal for 1 of the next, up to 10 at once.
      const to = String(body.to || ''), from = FORGE_STEPS[to], times = Math.floor(Number(body.times) || 1);
      if (!from || times < 1 || times > 10) return fail('bad_forge');
      const s = await state(), cost = forgeRatio(s.config, to) * times;
      if ((s.wallet?.['seal_' + from] || 0) < cost) return fail('no_seal', 409);
      await apply('forge:' + crypto.randomUUID(), 'forge', {seals: {[from]: -cost, [to]: times}});
      return json({forged: {to, from, times, cost}, state: await state()});
    }
    if (path === 'precon') {
      // A published 60-card precon from MTGJSON: pay 25 coins per card you don't own (250 to 1,500,
      // free when you own it all); the missing copies arrive in their exact printings and the list
      // is saved as a Play deck with those printings.
      const file = String(body.file || '').replace(/\.json$/, '');
      if (!/^[A-Za-z0-9_.-]{3,120}$/.test(file)) return fail('bad_precon');
      const r = await fetcher('https://mtgjson.com/api/v5/decks/' + file + '.json', {headers: {Accept: 'application/json', 'User-Agent': 'CardStashy/1.0 (play precons)'}}).catch(() => null);
      const d = r?.ok ? (await r.json().catch(() => null))?.data : null;
      if (!d?.mainBoard?.length || (d.commander || []).length) return fail('bad_precon');
      const rows = mtgjsonDeckRows(d), byName = new Map([...(d.mainBoard || []), ...(d.sideBoard || [])].map(c => [c.name, c]));
      const s = await state(), short = deckShortfall(rows, ownedByName(s.cards || []), new Map(rows.map(x => [x.name, x.rarity])), s.config?.maxCopies || 4);
      const missing = short.missing.reduce((t, m) => t + m.need, 0), price = preconPrice(missing, s.config);
      if ((s.wallet?.coins || 0) < price) return fail('short_coins', 409);
      const cards = short.missing.flatMap(m => Array.from({length: m.need}, () => mtgjsonCardDelta(byName.get(m.name)))).filter(c => c.oracle_id);
      await apply('precon:' + crypto.randomUUID(), 'precon', {coins: -price, cards});
      const deck = await rpc(env, 'play_save_deck', {p_user: uid, p_id: null, p_name: String(d.name || 'Precon').slice(0, 80), p_format: String(body.format || '').slice(0, 40),
        p_cards: rows.map(({name, qty, board, set, number}) => ({name, qty, ...(board ? {board} : {}), set, number})), p_delete: false}, fetcher);
      return json({deck, price, granted: cards.length, state: await state()});
    }
    if (path === 'login') {
      // The first visit of the day stamps the log-in calendar (counted days, never a streak). The day
      // follows the device's offset, limited to UTC-12..UTC+14.
      const day = playDay(body.tz), s = await state();
      if (!s.wallet?.starter_at) return json({login: null});
      const bump = await counters.bump('login:' + day, 'login', {logins: 1});
      if (!bump) return json({login: null});
      const st = loginStamp(bump.counters?.logins);
      if (bump.duplicate) return json({login: {day, ...st, fresh: false}, counters: bump.counters});
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
      if ((now[`d:${day}:matches`] || 0) >= 40) return json({counted: false, counters: now});
      const c = matchCounters(body, day, {friendsToday: now[`d:${day}:friend_matches`] || 0});
      if (!c) return fail('bad_match');
      if (!Object.keys(c).length) return json({counted: false, counters: now});
      const out = await counters.bump('match:' + id, 'match', c);
      return json({counted: !out?.duplicate, counters: out?.counters || now});
    }
    if (path === 'claim') {
      // Pays one finished achievement step, daily or weekly quest. The server re-checks the progress.
      const [s, c, claimed, reward] = await Promise.all([state(), counters.read(), counters.claims(), currentRewardSet(env, request, fetcher)]);
      if (!c || !claimed) return fail('not_ready', 503);
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
      return json({ref, delta, state: await state(), claimed: [...claimed, ref]});
    }
    if (path === 'buy') {
      const set = String(body.set || '').toLowerCase();
      if (!/^[a-z0-9]{2,8}$/.test(set)) return fail('bad_set');
      const index = await asset(env, request, '/data/mtg-boosters/index.json', fetcher);
      if (!index?.sets?.[set]) return fail('no_booster', 404);
      const s = await state(), price = s.config?.packPrice || 500;
      if ((s.wallet?.coins || 0) < price) return fail('short_coins', 409);
      await apply('buy:' + crypto.randomUUID(), 'buy', {coins: -price, packs: [{set, source: 'shop'}]});
      return json({state: await state()});
    }
    if (path === 'story') {
      // A won Story battle (story-mode-acts.md B2, play-progression.md section 3). Every ref is paid
      // once: the first clear (an era pack and XP), each star (own deck: a bonus pack and coins;
      // villain side: coins), the act's boss (the era-clear seal). A replay of a battle already won
      // pays one era pack, up to replayPacksPerDay a day.
      const id = String(body.battle || ''), m = id.match(/^a(\d{1,2})b([1-8])$/);
      if (!m) return fail('bad_battle');
      const act = await asset(env, request, `/data/story/act-${Number(m[1])}.json`, fetcher);
      const battle = act?.battles?.find(b => b.id === id);
      if (!battle) return fail('bad_battle', 404);
      const cfg = (await state()).config?.story || {}, set = battle.rewardSet, pack = n => Array.from({length: n}, () => ({set, source: 'story'}));
      const star = body.seat === 'villain' ? 'villain' : body.deck === 'own' ? 'own' : 'loaner';
      const paid = [], pay = async (ref, delta) => { const out = await apply(ref, 'story', delta); if (!out?.duplicate) paid.push(ref); return !out?.duplicate; };
      const first = await pay(`story:${id}:clear`, {packs: pack(cfg.firstWinPacks ?? 1), xp: cfg.firstWinXp ?? 150});
      const starNew = await pay(`story:${id}:${star}`, star === 'own' ? {packs: pack(cfg.starPacks ?? 1), coins: cfg.starCoins ?? 100} : star === 'villain' ? {coins: cfg.starCoins ?? 100} : {});
      if (battle.slot === 8) await pay(`story:act${Number(m[1])}:era`, {seals: cfg.eraClearSeals || {m: 1}});
      if (!first && !starNew) {
        const day = new Date().toISOString().slice(0, 10);
        for (let i = 1; i <= (cfg.replayPacksPerDay ?? 3); i++) if (await pay(`story:replay:${day}:${i}`, {packs: pack(1)})) break;
      }
      return json({paid, rewardSet: set, refs: await storyRefs(), state: await state()});
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
