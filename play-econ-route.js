// Play progression server routes (/api/progress/*). The server, never the app, hands out rewards:
// it checks the player's sign-in, rolls packs with a crypto-strength random roll, checks seal
// rarities against Scryfall, and writes through public.play_apply (service key only). The app
// just shows what this returns. Play's wall: nothing here touches the real collection or prices.
// Spec: play-progression.md sections 3 to 9.
import {SUPABASE} from './config.js';
import {loadMtgBooster, mtgBoosterCards, drawMtgBooster} from './mtg-boosters.js';
import {rewardSet} from './play-econ-sets.js';
import {starterGrant, sealTrackBonus, packContentsRow, cardDelta, RARITY_SEAL} from './play-econ-rules.js';
import {PRACTICE_STARTER_ROWS} from './play-starter-deck.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
const fail = (error, status = 400) => json({error}, status);

function rpc(env, name, args, fetcher) {
  const key = env.SUPABASE_SERVICE_KEY, headers = {apikey: key, 'Content-Type': 'application/json', Accept: 'application/json'};
  if (/^eyJ/.test(key || '')) headers.Authorization = 'Bearer ' + key;
  return fetcher((env.SUPABASE_URL || SUPABASE.url) + '/rest/v1/rpc/' + name, {method: 'POST', headers, body: JSON.stringify(args)})
    .then(async r => { const body = await r.json().catch(() => null); if (!r.ok) throw Object.assign(Error(body?.message || 'rpc_failed'), {code: body?.message || 'rpc_failed'}); return body; });
}

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
  const shop = sets.filter(s => baked[s.code] && s.released_at && s.released_at <= today)
    .map(s => ({code: s.code, name: s.name, released: s.released_at})).sort((a, b) => b.released.localeCompare(a.released));
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
  try {
    if (path === 'state' && request.method === 'GET') {
      const [s, sets] = await Promise.all([state(), shopSets(env, request, fetcher)]);
      return json({...s, rewardSet: sets.reward, shop: sets.shop});
    }
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
      const known = await mtgBoosterCards(data, [], fetcher);
      const picks = drawMtgBooster(data, known, cryptoRandom);
      const contents = picks.map(packContentsRow);
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
