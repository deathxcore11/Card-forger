// Rich presence (Randall, 4 Nov 2026): accepted friends see what you are doing, e.g. "Story · Act 12 ·
// The Kami Are Coming · turn 5". The app sends a beat when what it shows changes (at most every 15s) and
// every 60s while it is open; nothing while it is in the background. Friends only, and Settings can switch
// it off. Server: supabase/migrations/20261104013000_community_presence.sql (public.community_presence).
// The native app ports this file line for line (design: https://claude.ai/artifact/SqdunzSVPvwVbjyad1iPUV).

export const PRESENCE_TIMING = {minGapMs: 15000, beatMs: 60000, friendsMs: 30000, onlineMs: 120000};
const MATCH = {story: 'Story', quick: 'Quick Play', practice: 'Practice', friend: 'Multiplayer'};
const VIEW = {home: ['lobby', 'In the Play lobby'], lobby: ['lobby', 'In the Play lobby'], deeds: ['deeds', 'Looking at achievements'],
  shop: ['merchant', 'At the Merchant'], packs: ['packs', 'Opening packs'], decks: ['decks', 'Building a deck'], deck: ['decks', 'Building a deck'],
  finder: ['decks', 'Building a deck'], finderDeck: ['decks', 'Building a deck'], collection: ['trunk', 'Looking through the Trunk'],
  story: ['story', 'Choosing a Story battle'], storyBattle: ['story', 'Choosing a Story battle']};
// The Settings switch, remembered on this device; the server keeps the real one (share), so a
// switched-off player never shows even from another device that still beats.
const SHARE_KEY = 'cardstashy-presence';
export function presenceShared() { try { return globalThis.localStorage?.getItem(SHARE_KEY) !== 'off'; } catch { return true; } }
export function rememberPresence(on) { try { globalThis.localStorage?.setItem(SHARE_KEY, on ? 'on' : 'off'); return true; } catch { return false; } }
const clip = (s, n = 80) => { s = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// What to tell friends, from the app's own state:
// {view, playView, match: {kind, format, turn, act, battle}} -> {mode, label, turn}.
export function presenceActivity({view = '', playView = '', match = null} = {}) {
  if (match?.kind && MATCH[match.kind]) {
    const turn = Number.isInteger(match.turn) && match.turn > 0 ? match.turn : null;
    const parts = match.kind === 'story' ? [MATCH.story, match.act ? `Act ${match.act}` : '', match.battle] : [MATCH[match.kind], match.format];
    return {mode: match.kind, label: clip([...parts.filter(Boolean), turn ? `turn ${turn}` : ''].filter(Boolean).join(' · ')), turn};
  }
  if (view === 'play') { const v = VIEW[playView] || VIEW.home; return {mode: v[0], label: v[1], turn: null}; }
  return {mode: 'app', label: 'In CardStashy', turn: null};
}

// How a friend's row reads: their live line, or when they were last seen.
export function presenceLine(p, now = Date.now()) {
  if (!p) return {online: false, inMatch: false, text: ''};
  if (p.online && p.label) return {online: true, inMatch: ['story', 'quick', 'practice', 'friend'].includes(p.mode), text: p.label};
  const at = Date.parse(p.at || ''), mins = Number.isFinite(at) ? Math.max(0, Math.round((now - at) / 60000)) : null;
  if (mins === null) return {online: false, inMatch: false, text: ''};
  const ago = mins < 60 ? `${Math.max(1, mins)} min` : mins < 1440 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
  return {online: false, inMatch: false, text: `Last seen ${ago} ago`};
}

// The sender. read() gives presenceActivity's input; send(action, payload) is presenceRequest (cloud.js).
export function createPresence({read, send, enabled = () => true, now = () => Date.now(), doc = globalThis.document} = {}) {
  let last = '', lastAt = -Infinity, timer = 0, watch = 0;
  const visible = () => !doc || doc.visibilityState !== 'hidden';
  function tick(force = false) {
    if (!enabled() || !visible()) return;
    const a = presenceActivity(read()), key = JSON.stringify(a), t = now();
    if (key === last && !force && t - lastAt < PRESENCE_TIMING.beatMs) return;
    if (key !== last && !force && t - lastAt < PRESENCE_TIMING.minGapMs) return;
    last = key; lastAt = t;
    void send('beat', a);
  }
  return {
    start() {
      if (watch) return;
      // Check every 5s for a change (a new turn, another screen); the gaps above keep beats rare.
      watch = setInterval(() => tick(), 5000);
      doc?.addEventListener?.('visibilitychange', () => { if (visible()) tick(true); });
      tick(true);
    },
    stop() { clearInterval(watch); clearTimeout(timer); watch = 0; },
    poke: () => tick(),
    async setShare(on) { last = ''; await send(on ? 'show' : 'hide', {}); if (on) tick(true); },
  };
}
