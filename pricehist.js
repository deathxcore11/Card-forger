// Price history and price alerts, kept on this device for all three games.
// History: one point per card when its price moves (2% or more) or once a week, so a year of
// prices for a big collection still fits comfortably. Alerts: "below $X" (buy) or "above $X"
// (sell), checked whenever a price is seen.
import { esc } from "./ui.js";

const HIST_KEY = "cardstashy-price-hist-v1",
  ALERT_KEY = "cardstashy-price-alerts-v1",
  MAX_CARDS = 4000,
  MAX_POINTS = 120,
  WEEK = 7 * 864e5;

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
let hist = null;
const H = () => (hist ||= load(HIST_KEY, {}));
let saveTimer = 0;
const saveSoon = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(HIST_KEY, H()), 400);
};
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// Record a price seen now. Returns any alerts it set off.
export function recordPrice(g, id, usd, name = "", now = Date.now()) {
  if (!id || usd == null || !Number.isFinite(Number(usd)) || Number(usd) <= 0) return [];
  const k = `${g}:${id}`,
    all = H(),
    pts = (all[k] ||= []),
    last = pts[pts.length - 1],
    v = Math.round(Number(usd) * 100) / 100;
  if (!last || Math.abs(v - last[1]) / last[1] >= 0.02 || now - Date.parse(last[0]) >= WEEK) {
    if (last && last[0] === day(now)) last[1] = v;
    else pts.push([day(now), v]);
    if (pts.length > MAX_POINTS) pts.splice(0, pts.length - MAX_POINTS);
    // Too many cards tracked: drop the ones not seen for the longest.
    const keys = Object.keys(all);
    if (keys.length > MAX_CARDS) {
      keys.sort((a, b) => (all[a].at(-1)?.[0] || "").localeCompare(all[b].at(-1)?.[0] || ""));
      for (const x of keys.slice(0, keys.length - MAX_CARDS)) delete all[x];
    }
    saveSoon();
  }
  return checkAlerts(g, id, v, name, now);
}
export const priceSeries = (g, id) => H()[`${g}:${id}`] || [];

// Change over the recorded history: { from, to, pct, since } or null.
export function priceChange(series) {
  if (!series || series.length < 2) return null;
  const [d0, a] = series[0],
    b = series[series.length - 1][1];
  return { from: a, to: b, pct: ((b - a) / a) * 100, since: d0 };
}

// A small line chart (SVG) of a series, with the start and end labelled.
export function sparkline(series, w = 240, h = 56) {
  if (!series || series.length < 2) return "";
  const ys = series.map((p) => p[1]),
    lo = Math.min(...ys),
    hi = Math.max(...ys),
    t0 = Date.parse(series[0][0]),
    t1 = Date.parse(series[series.length - 1][0]) || t0 + 1,
    x = (d) => ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (w - 8) + 4,
    y = (v) => h - 6 - ((v - lo) / Math.max(0.01, hi - lo)) * (h - 14),
    path = series.map(([d, v], i) => `${i ? "L" : "M"}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(" "),
    up = ys[ys.length - 1] >= ys[0];
  return `<svg class="spark ${up ? "up" : "down"}" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Price from $${ys[0].toFixed(2)} to $${ys[ys.length - 1].toFixed(2)}"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(series[series.length - 1][0]).toFixed(1)}" cy="${y(ys[ys.length - 1]).toFixed(1)}" r="3" fill="currentColor"/></svg>`;
}

// The price-history block for a card page.
export function priceHistoryHtml(g, id, name = "") {
  const s = priceSeries(g, id),
    ch = priceChange(s);
  const alert = alertFor(g, id);
  const alertBtn = `<button class="btn ghost small" data-act="priceAlert" data-game="${esc(g)}" data-id="${esc(id)}" data-name="${esc(name)}">${alert ? `Alert: ${alert.below != null ? `below $${alert.below}` : ""}${alert.below != null && alert.above != null ? " or " : ""}${alert.above != null ? `above $${alert.above}` : ""}` : "Set a price alert"}</button>`;
  if (!ch) return `<div class="price-hist"><p class="muted small">Price history starts today. Check back to see how it moves.</p>${alertBtn}</div>`;
  const when = new Date(ch.since + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `<div class="price-hist"><div class="row between"><span class="small muted">Since ${esc(when)}</span><b class="${ch.pct >= 0 ? "ok-text" : "bad-text"}">${ch.pct >= 0 ? "+" : "−"}${Math.abs(ch.pct).toFixed(1)}%</b></div>${sparkline(s)}${alertBtn}</div>`;
}

/* ---------- alerts ---------- */
export const alerts = () => load(ALERT_KEY, []);
export const alertFor = (g, id) => alerts().find((a) => a.game === g && a.id === id) || null;
export function setAlert(g, id, name, { below = null, above = null } = {}) {
  const list = alerts().filter((a) => !(a.game === g && a.id === id));
  if (below != null || above != null) list.push({ game: g, id, name, below, above, created: Date.now(), firedAt: 0 });
  save(ALERT_KEY, list);
}
let onFire = () => {};
export const onAlert = (fn) => (onFire = fn);
export function checkAlerts(g, id, usd, name = "", now = Date.now()) {
  const list = alerts(),
    fired = [];
  for (const a of list) {
    if (a.game !== g || a.id !== id) continue;
    const hit = (a.below != null && usd <= a.below) || (a.above != null && usd >= a.above);
    // Once a day at most per card.
    if (hit && now - (a.firedAt || 0) > 864e5) {
      a.firedAt = now;
      a.last = usd;
      fired.push({ ...a, usd, name: a.name || name });
    }
  }
  if (fired.length) {
    save(ALERT_KEY, list);
    for (const f of fired) onFire(f);
  }
  return fired;
}
export const alertText = (f) => `${f.name}: now $${f.usd.toFixed(2)} (${f.below != null && f.usd <= f.below ? `below your $${f.below}` : `above your $${f.above}`}).`;

// The alert editor sheet.
export function alertSheet(g, id, name, price) {
  const a = alertFor(g, id);
  return `<div class="sheet-head"><h2>Price alert</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>
  <p class="muted small">${esc(name)}${price != null ? ` is $${Number(price).toFixed(2)} now` : ""}. You'll get a message when the price crosses your number, the next time prices update.</p>
  <label class="field">Tell me when it drops below<input id="alertBelow" type="number" inputmode="decimal" min="0" step="0.01" value="${a?.below ?? ""}" placeholder="${price != null ? (price * 0.85).toFixed(2) : "e.g. 5.00"}"></label>
  <label class="field">or rises above<input id="alertAbove" type="number" inputmode="decimal" min="0" step="0.01" value="${a?.above ?? ""}" placeholder="${price != null ? (price * 1.25).toFixed(2) : "e.g. 20.00"}"></label>
  <div class="actions wrap"><button class="btn" data-act="priceAlertSave" data-game="${esc(g)}" data-id="${esc(id)}" data-name="${esc(name)}">Save alert</button>${a ? `<button class="btn ghost" data-act="priceAlertClear" data-game="${esc(g)}" data-id="${esc(id)}">Remove alert</button>` : ""}</div>`;
}
export function alertsPanel(g) {
  const list = alerts().filter((a) => a.game === g);
  if (!list.length) return `<section class="panel"><h3>Price alerts</h3><p class="muted small">Open any card and tap “Set a price alert” to hear when it gets cheaper or more valuable.</p></section>`;
  return `<section class="panel"><h3>Price alerts</h3><div class="list compact">${list
    .map((a) => {
      const s = priceSeries(g, a.id), now = s.at(-1)?.[1];
      return `<button class="mini-row" data-act="priceAlert" data-game="${esc(g)}" data-id="${esc(a.id)}" data-name="${esc(a.name)}"><span class="ellip">${esc(a.name)}</span><small class="muted">${a.below != null ? `below $${a.below}` : ""}${a.below != null && a.above != null ? " · " : ""}${a.above != null ? `above $${a.above}` : ""}${now != null ? ` · now $${now.toFixed(2)}` : ""}</small></button>`;
    })
    .join("")}</div></section>`;
}
// For tests.
export const _reset = () => {
  hist = null;
};
