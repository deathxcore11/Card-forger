// Game changes transfer semantic sections, never resource identities or provider filters.
export const GAME_ROUTES = ['mtg', 'ygo', 'ptcg'];
export const LEGACY_ROUTES = {catalog:'search',builder:'deck',discover:'decks/ideas',library:'decks/inspiration',wishlist:'collection/wishlist',compare:'search',playtest:'deck/active/playtest',guides:'deck/active/engine',sources:'settings'};
const views = new Set(['community','home','search','collection','decks','deck','tdeck','sets','set','shared','scan','rules','settings','wiki']);
export function routeSegments(hash = '#home') {
  const raw = String(hash).replace(/^.*?#/, '') || 'home';
  let parts;
  try { parts = raw.split('/').map(decodeURIComponent); }
  catch { return [/^sets?(?:\/|$)/.test(raw) ? 'sets' : 'home']; }
  if (LEGACY_ROUTES[parts[0]]) parts = [...LEGACY_ROUTES[parts[0]].split('/'), ...parts.slice(1)];
  if (!views.has(parts[0])) return ['home'];
  if (parts.some(p => /[\u0000-\u001f\u007f]/.test(p))) return [parts[0] === 'set' ? 'sets' : 'home'];
  if (parts[0] === 'set' && (!parts[1] || parts[1].length > 4096)) return ['sets'];
  return parts;
}
export const normalizeRoute = hash => '#' + routeSegments(hash).map(encodeURIComponent).join('/');
export function gameSwitchRoute(source, target) {
  if (!GAME_ROUTES.includes(target)) return null;
  const [view, tab] = routeSegments(source.hash || '#' + source.view);
  const origin = source.origin;
  let section = origin?.section || view, semanticTab = origin?.tab || '';
  if (section === 'set') section = 'sets';
  if (section === 'deck' || section === 'tdeck') { section = 'decks'; semanticTab = 'mine'; }
  if (section === 'shared') { section = 'decks'; semanticTab = 'inspiration'; }
  let wanted = false;
  if (section === 'collection') {
    semanticTab ||= tab || source.collectionTab || 'cards';
    if (!['cards','binders','value','wishlist'].includes(semanticTab)) semanticTab = 'cards';
    wanted = semanticTab === 'wishlist' || (semanticTab === 'cards' && source.collectionShow === 'wanted');
    if (wanted) semanticTab = target === 'mtg' ? 'wishlist' : 'cards';
  } else if (section === 'decks') {
    semanticTab ||= tab || source.decksTab || 'mine';
    if (!['mine','ideas','inspiration'].includes(semanticTab)) semanticTab = 'mine';
  } else semanticTab = '';
  if (!views.has(section)) section = 'home';
  return {game:target,hash:'#' + section + (semanticTab ? '/' + semanticTab : ''),section,semanticTab,wanted};
}
export function historyEntry(value, hash) {
  const e = value?.cardstashy;
  return e?.version === 1 && GAME_ROUTES.includes(e.game) && e.route === normalizeRoute(hash) && typeof e.entryId === 'string' && e.entryId.length < 100 && Number.isSafeInteger(e.index) && e.index >= 0 ? e : null;
}
// One writer, latest intent wins. An obsolete write may finish, but cannot install a
// route or push history. A later traversal reconciles storage before it is painted.
export function createNavigationQueue({readGame, persistGame, install, pending = () => {}, failed = () => {}}) {
  let revision = 0, queued = null, running = false, paused = false, resumeWait = null, resumePause = null, retiredThrough = 0;
  const waiters = new Map();
  async function drain() {
    if (running || paused) return;
    running = true; pending(true);
    try {
      while (queued && !paused) {
        const job = queued; queued = null;
        try {
          const current = () => job.revision === revision && job.revision > retiredThrough;
          if (readGame() !== job.intent.game) await persistGame(job.intent.game, current);
          if (paused) await resumeWait;
          if (!current()) { waiters.get(job.revision)?.(false); waiters.delete(job.revision); continue; }
          install(job.intent); waiters.get(job.revision)?.(true);
        } catch (error) {
          if (paused) await resumeWait;
          if (job.revision === revision && job.revision > retiredThrough) await failed(error, job.intent);
          waiters.get(job.revision)?.(false);
        }
        waiters.delete(job.revision);
      }
    } finally { running = false; pending(paused); if (queued && !paused) void drain(); }
  }
  return {
    get revision() { return revision; },
    get busy() { return running || paused; },
    get hasWork() { return running || !!queued; },
    pause() {
      if (paused) throw Error('Workspace transition already in progress.');
      paused = true; resumeWait = new Promise(resolve => resumePause = resolve); pending(true);
      return {revision};
    },
    hasNewer(ticket) { return revision > ticket.revision && !!queued; },
    resume(ticket, discardOlder = false) {
      if (discardOlder) {
        retiredThrough = Math.max(retiredThrough, ticket.revision);
        if (queued && queued.revision <= retiredThrough) {waiters.get(queued.revision)?.(false);waiters.delete(queued.revision);queued=null;}
      }
      paused = false; const resolve = resumePause; resumePause=null; resolve?.();
      if (!running) {if (queued) void drain(); else pending(false);}
    },
    request(intent) {
      const id = ++revision;
      if (queued) { waiters.get(queued.revision)?.(false); waiters.delete(queued.revision); }
      const result = new Promise(resolve => waiters.set(id,resolve));
      queued = {intent,revision:id}; void drain(); return result;
    },
  };
}
