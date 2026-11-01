// The app side of Play progression: reads the player's Play wallet, packs, collection and decks
// from /api/progress and asks the server to open, buy or stamp. It never decides a reward itself.
// The last state is cached on this device (per account) only so the top bar shows at once; the
// server copy always wins. Play's wall: no collection storage, sync or price code is imported here.
import {privateKey} from './account-scope.js';
const CACHE = 'cardstashy-play-econ-state-v1';

export function createPlayEcon({getAccessToken, fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, onChange = () => {}} = {}) {
  let state = null, loading = null, error = '', errorCode = '', busy = '';
  try { state = JSON.parse(storage?.getItem(privateKey(CACHE)) || 'null'); } catch { state = null; }
  const set = next => { state = next; try { storage?.setItem(privateKey(CACHE), JSON.stringify(next)); } catch {} onChange(); };
  async function call(path, body) {
    const token = await getAccessToken?.();
    if (!token) throw Object.assign(Error('Sign in to use your Play collection.'), {code: 'sign_in'});
    const r = await fetchImpl('/api/progress/' + path, {method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body),
      headers: {Accept: 'application/json', Authorization: 'Bearer ' + token, ...(body === undefined ? {} : {'Content-Type': 'application/json'})}, credentials: 'omit', cache: 'no-store'});
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(Error(MESSAGES[out.error] || 'Play rewards are unavailable right now. Try again in a moment.'), {code: out.error || 'http_' + r.status});
    return out;
  }
  // Server answers carry the wallet; the shop, reward set, quest counters and claims ride along.
  const keep = (next, extra = {}) => ({...next, rewardSet: state?.rewardSet, shop: state?.shop, counters: state?.counters || {}, claimed: state?.claimed || [], login: state?.login || null, ...extra});
  const tz = () => -new Date().getTimezoneOffset();
  const run = async (label, job) => { busy = label; error = ''; errorCode = ''; onChange(); try { return await job(); } catch (e) { error = e.message; errorCode = e.code || 'failed'; throw e; } finally { busy = ''; onChange(); } };
  const api = {
    snapshot: () => ({state, error, errorCode, busy, loading: !!loading}),
    refresh() {
      // A first visit always asks for the starter gift, so a missing reward set comes back as a
      // visible error (no_reward_set) instead of an empty wallet. The home shows every error;
      // sign_in is only shown there when the app thinks a session exists.
      loading ||= (error = '', errorCode = '', call('state')).then(async s => { if (!s.wallet?.starter_at) s = {...await call('starter', {}), shop: s.shop}; set({...s, login: state?.login || null}); return s; })
        .catch(e => { error = e.message; errorCode = e.code || 'failed'; onChange(); return state; }).finally(() => { loading = null; onChange(); });
      return loading;
    },
    // Opens one banked pack on the server; returns {pack, sealBonus, duplicateCoins}.
    open: id => run('open:' + id, async () => { const out = await call('open', {id}); set(keep(out.state)); return out; }),
    buy: setCode => run('buy', async () => { const out = await call('buy', {set: setCode}); set(keep(out.state)); return out; }),
    forge: (to, times = 1) => run('forge', async () => { const out = await call('forge', {to, times}); set(keep(out.state)); return out; }),
    precon: (file, format) => run('precon', async () => { const out = await call('precon', {file, format}); set(keep(out.state)); return out; }),
    // The day's log-in stamp; returns {day, stamp, reward, monthReward, fresh} or null.
    async login() { try { const out = await call('login', {tz: tz()}); if (!out.login) return null; set(out.state ? keep(out.state, {counters: out.counters, login: out.login}) : {...state, counters: out.counters || state?.counters, login: out.login}); return out.login; } catch { return null; } },
    // A finished match (never Practice) moves quests and achievements; quiet on failure.
    async reportMatch(m) { try { const out = await call('match', {...m, tz: tz()}); if (out.counters && state) set({...state, counters: out.counters}); return out; } catch { return null; } },
    claim: (kind, id, step) => run('claim:' + kind + ':' + id + ':' + (step ?? ''), async () => { const out = await call('claim', {kind, id, step, tz: tz()}); set(keep(out.state, {claimed: out.claimed})); return out; }),
    holo: oracle => run('holo', async () => { const out = await call('holo', {oracle}); set(keep(out.state)); return out; }),
    craft: cardId => run('craft', async () => { const out = await call('craft', {id: cardId}); set(keep(out.state)); return out; }),
    saveDeck: deck => run('deck', async () => { const out = await call('deck', deck); await api.refresh(); return out.deck; }),
    clear() { state = null; try { storage?.removeItem(privateKey(CACHE)); } catch {} onChange(); },
  };
  return api;
}

const MESSAGES = {
  sign_in: 'Sign in to use your Play collection.',
  not_configured: 'Play rewards are not switched on yet.',
  short_coins: 'Not enough coins for that pack yet.',
  short_balance: 'Not enough coins or seals for that.',
  no_seal: 'You need a seal of that rarity first.',
  have_max: 'You already have 4 copies of that card.',
  pack_not_found: 'That pack was already opened.',
  cards_unavailable: 'The cards for this pack could not be loaded. Your pack is safe; try again in a moment.',
  no_booster: 'Packs for that set are not available.',
  bad_card: 'That card cannot be stamped with a seal.',
  bad_forge: 'That seal cannot be forged.',
  bad_precon: 'That precon could not be opened.',
  not_earned: 'That reward is not ready yet.',
  all_holo: 'Every copy you own is already holo.',
  claimed: 'You already claimed that reward.',
  not_ready: 'Quests open once the next update finishes.',
  no_reward_set: 'The reward packs are not ready yet. Try again in a moment.',
};

// The top bar's numbers, from a state (or null while signed out).
export function purse(state) {
  if (!state?.wallet) return null;
  const w = state.wallet;
  return {coins: w.coins | 0, seals: {c: w.seal_c | 0, u: w.seal_u | 0, r: w.seal_r | 0, m: w.seal_m | 0}, packs: (state.packs || []).length, xp: w.xp | 0};
}
