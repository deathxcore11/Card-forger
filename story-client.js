// Story mode, the app side: loads an act's battles (data/story/act-<n>.json), reads the player's
// Story progress and asks the server to pay a win. The server (play-econ-route.js, /api/progress/story)
// decides every reward; this only shows what it answers. Progress is also kept on this device per
// account, so the road draws at once and still works before the server copy arrives.
import {privateKey} from './account-scope.js';
import {STORY_ACTS} from './story-acts.js';
const CACHE = 'cardstashy-story-progress-v1';
const acts = new Map(), pools = new Map();

export const STAR_KEYS = ['loaner', 'own', 'villain'];
// 3 stars for a loaner win, 1 for your own Play deck, +1 for the villain side (Randall, 1 Nov 17:54Z).
export const STAR_VALUE = {loaner: 3, own: 1, villain: 1};
export const battleStars = rec => STAR_KEYS.reduce((t, k) => t + (rec?.[k] ? STAR_VALUE[k] : 0), 0);
export const MAX_STARS = 5;

export function loadAct(n, fetchImpl = globalThis.fetch?.bind(globalThis)) {
  n = Number(n);
  if (!acts.has(n)) acts.set(n, fetchImpl(`/data/story/act-${n}.json`, {cache: 'no-cache'}).then(r => { if (!r.ok) throw Error('act_unavailable'); return r.json(); })
    .catch(e => { acts.delete(n); throw e; }));
  return acts.get(n);
}
// The card names an own deck may use for this act (its sets, Forge-supported, Vintage-legal).
export function loadActPool(n, fetchImpl = globalThis.fetch?.bind(globalThis)) {
  n = Number(n);
  if (!pools.has(n)) pools.set(n, fetchImpl(`/data/story/pool-${n}.json`).then(r => r.ok ? r.json() : null).then(list => new Set((list || []).map(x => x.toLowerCase())))
    .catch(() => { pools.delete(n); return null; }));
  return pools.get(n);
}

// Progress: {battles: {a1b1: {loaner: true, own: false, villain: false}}, acts: {1: true}}.
export function emptyProgress() { return {battles: {}, acts: {}}; }
export function progressFromRefs(refs = []) {
  const p = emptyProgress();
  for (const ref of refs) {
    let m = String(ref).match(/^story:(a\d+b\d+):(loaner|own|villain|clear)$/);
    if (m) { const b = p.battles[m[1]] ||= {}; b[m[2]] = true; continue; }
    m = String(ref).match(/^story:act(\d+):era$/);
    if (m) p.acts[m[1]] = true;
  }
  return p;
}
export const battleCleared = (p, id) => !!p?.battles?.[id]?.clear || STAR_KEYS.some(k => p?.battles?.[id]?.[k]);
export const actCleared = (p, n) => !!p?.acts?.[n] || battleCleared(p, `a${n}b8`);
export const actStars = (p, n) => Array.from({length: 8}, (_, i) => battleStars(p?.battles?.[`a${n}b${i + 1}`])).reduce((a, b) => a + b, 0);
// The battle you're on: the first one in order that isn't cleared. Battles open one at a time.
export const currentBattle = (p, n) => { for (let i = 1; i <= 8; i++) if (!battleCleared(p, `a${n}b${i}`)) return i; return 9; };
// The act you're on. Act n opens when act n-1's boss falls.
export const currentAct = p => { for (const a of STORY_ACTS) if (!actCleared(p, a.act)) return a.act; return STORY_ACTS.length + 1; };

// An own Play deck is allowed in a Story battle when every non-basic card is in the act's pool,
// it has at least 60 cards and no more than 4 of a name. Returns {ok, reason}.
export function ownDeckFits(deck, pool) {
  if (!pool) return {ok: false, reason: 'Checking the card pool…'};
  const rows = (deck?.cards || []).filter(r => r.board !== 'side'), counts = new Map();
  let total = 0, outside = [];
  for (const r of rows) {
    const q = Number(r.qty) || 0; total += q;
    if (/^(snow-covered )?(plains|island|swamp|mountain|forest)$/i.test(r.name)) continue;
    counts.set(r.name, (counts.get(r.name) || 0) + q);
    if (!pool.has(String(r.name).toLowerCase())) outside.push(r.name);
  }
  if (total < 60) return {ok: false, reason: `${total} cards. Story decks need 60.`};
  if ([...counts.values()].some(q => q > 4)) return {ok: false, reason: 'More than 4 copies of a card.'};
  if (outside.length) return {ok: false, reason: `${outside.length} card${outside.length === 1 ? ' is' : 's are'} from outside this act, like ${outside[0]}.`};
  return {ok: true, reason: ''};
}

export function createStoryProgress({getAccessToken, accountId = () => null, fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, onChange = () => {}} = {}) {
  let progress = emptyProgress(), owner = undefined, loading = null, error = '';
  const key = () => privateKey(CACHE);
  const readLocal = () => { try { return JSON.parse(storage?.getItem(key()) || 'null') || emptyProgress(); } catch { return emptyProgress(); } };
  const save = () => { try { storage?.setItem(key(), JSON.stringify(progress)); } catch {} };
  const merge = (a, b) => {
    const out = {battles: {...a.battles}, acts: {...a.acts, ...b.acts}};
    for (const [id, rec] of Object.entries(b.battles)) out.battles[id] = {...(out.battles[id] || {}), ...rec};
    return out;
  };
  async function call(body) {
    const token = await getAccessToken?.();
    if (!token) throw Object.assign(Error('Sign in to play Story mode.'), {code: 'sign_in'});
    const r = await fetchImpl('/api/progress/story', {method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store',
      headers: {Accept: 'application/json', Authorization: 'Bearer ' + token, ...(body ? {'Content-Type': 'application/json'} : {})}});
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(Error(out.error === 'sign_in' ? 'Sign in to play Story mode.' : 'Story rewards are unavailable right now.'), {code: out.error || 'failed'});
    return out;
  }
  const api = {
    snapshot: () => ({progress, error, loading: !!loading}),
    // Re-reads this account's progress: the device copy at once, then the server's.
    wake() {
      const id = accountId();
      if (id === owner) return;
      owner = id; progress = id ? readLocal() : emptyProgress(); onChange();
      if (id) api.refresh();
    },
    refresh() {
      loading ||= call().then(out => { if (Array.isArray(out.refs)) { progress = merge(readLocal(), progressFromRefs(out.refs)); save(); } error = ''; })
        .catch(e => { error = e.code === 'sign_in' ? '' : e.message; }).finally(() => { loading = null; onChange(); });
      return loading;
    },
    // A won Story battle. The server pays once per clear and star; replays pay inside the daily cap.
    async claim({battle, seat, deck}) {
      const local = {...(progress.battles[battle] || {}), clear: true, [seat === 'villain' ? 'villain' : deck === 'own' ? 'own' : 'loaner']: true};
      if (seat === 'villain') local.clear = true;
      progress = merge(progress, {battles: {[battle]: local}, acts: /b8$/.test(battle) ? {[battle.match(/^a(\d+)/)[1]]: true} : {}}); save(); onChange();
      try { const out = await call({battle, seat, deck}); if (Array.isArray(out.refs)) { progress = merge(progress, progressFromRefs(out.refs)); save(); onChange(); } return out; }
      catch (e) { error = e.message; onChange(); return {error: e.message, paid: []}; }
    },
  };
  return api;
}
