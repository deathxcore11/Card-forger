// Client side of shared price history: daily prices recorded by the CardStashy Worker for every
// tracked card, merged into each card's chart. Also tells the Worker which cards to record.
const MEM = new Map(),
  LS = "cardstashy-shared-prices-v1",
  SENT = "cardstashy-watch-sent-v1",
  TTL = 12 * 3600e3,
  RESEND = 20 * 864e5;
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? d;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const keyOf = (q) => [q.game, q.cardId, q.finish, q.source].join("|");
const supported = (q) => q && (q.game === "mtg" || q.game === "ygo") && q.cardId;

// Points the server has for this quote (empty until loaded).
export function sharedPoints(q) {
  if (!supported(q)) return [];
  const k = keyOf(q);
  if (MEM.has(k)) return MEM.get(k).points;
  const stored = read(LS, {})[k];
  if (stored) MEM.set(k, stored);
  return stored?.points || [];
}

let onUpdate = () => {};
export const onSharedPrices = (fn) => (onUpdate = fn);
const loading = new Set();
// Fetch (at most every 12 hours per card); calls onUpdate when new points arrive.
export function loadSharedPoints(q) {
  if (!supported(q) || typeof fetch !== "function") return;
  const k = keyOf(q),
    have = MEM.get(k) || read(LS, {})[k];
  if (loading.has(k) || (have && Date.now() - have.at < TTL)) return;
  loading.add(k);
  const finish = q.game === "mtg" ? q.finish : "reference";
  fetch(`api/prices/history?game=${q.game}&id=${encodeURIComponent(q.cardId)}&finish=${encodeURIComponent(finish)}&source=${encodeURIComponent(q.source)}`, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      const points = (body?.points || []).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number(p.value) >= 0);
      const entry = { at: Date.now(), points };
      MEM.set(k, entry);
      const all = read(LS, {});
      all[k] = entry;
      const keys = Object.keys(all);
      if (keys.length > 400) for (const x of keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - 400)) delete all[x];
      write(LS, all);
      if (points.length) onUpdate(q);
    })
    .catch(() => {})
    .finally(() => loading.delete(k));
}

// Merge on-device observations with the server's daily points (server wins on the same day).
export function mergePoints(local = [], shared = []) {
  const byDay = new Map();
  for (const p of local) byDay.set(p.date, { date: p.date, value: p.value, origin: "device" });
  for (const p of shared) byDay.set(p.date, { date: p.date, value: p.value, origin: "daily" });
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Ask the Worker to record these cards daily (each card at most every 20 days).
let queue = { mtg: new Set(), ygo: new Set() },
  timer = 0;
export function watchCards(game, ids) {
  if (!queue[game]) return;
  const sent = read(SENT, {}),
    now = Date.now();
  for (const id of ids || []) if (id && /^[A-Za-z0-9_.:-]{1,80}$/.test(String(id)) && now - (sent[game + ":" + id] || 0) > RESEND) queue[game].add(String(id));
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}
function flush() {
  if (typeof fetch !== "function" || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  for (const game of ["mtg", "ygo"]) {
    const ids = [...queue[game]];
    queue[game] = new Set();
    for (let i = 0; i < ids.length; i += 300) {
      const chunk = ids.slice(i, i + 300);
      fetch("api/prices/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, ids: chunk }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (!b?.ok) return;
          const sent = read(SENT, {}),
            now = Date.now();
          for (const id of chunk) sent[game + ":" + id] = now;
          const keys = Object.keys(sent);
          if (keys.length > 20000) for (const k of keys.slice(0, keys.length - 20000)) delete sent[k];
          write(SENT, sent);
        })
        .catch(() => {});
    }
  }
}
