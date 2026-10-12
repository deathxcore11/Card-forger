// Small HTML helpers shared by every screen.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export const usd = (n, digits = 2) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? "—"
    : "$" +
      Number(n).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

export const pct = (n, digits = 0) =>
  n === null || n === undefined ? "—" : (n * 100).toFixed(digits) + "%";

export const signed = (n, fmt = (x) => String(x)) =>
  n > 0 ? "+" + fmt(n) : n < 0 ? "−" + fmt(Math.abs(n)) : "±0";

export const art = (c) =>
  c?.image_uris?.art_crop ||
  c?.card_faces?.[0]?.image_uris?.art_crop ||
  c?.image_uris?.normal ||
  c?.card_faces?.[0]?.image_uris?.normal ||
  "";

export const cardImage = (c, size = "normal") =>
  c?.image_uris?.[size] || c?.card_faces?.[0]?.image_uris?.[size] || "";

export function img(url, alt, cls = "") {
  return url
    ? `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : `<span class="${cls} img-missing" aria-hidden="true">◇</span>`;
}

const PIP = { W: "W", U: "U", B: "B", R: "R", G: "G", C: "C" };
export function manaCost(c) {
  const cost = c?.mana_cost || c?.card_faces?.[0]?.mana_cost || "";
  const parts = cost.match(/\{[^}]+\}/g) || [];
  if (!parts.length) return "";
  return `<span class="mana" aria-label="Mana cost ${esc(cost)}">${parts
    .map((p) => {
      const t = p.slice(1, -1).replace("/", "");
      const cls = t.length === 1 && PIP[t] ? "pip-" + t : /^[WUBRG]{2}$|^[WUBRG]P$/.test(t) ? "pip-" + t[0] : "pip-N";
      return `<i class="pip ${cls}">${esc(t.length > 2 ? t.slice(0, 2) : t)}</i>`;
    })
    .join("")}</span>`;
}

export function colorDots(c) {
  const id = c?.color_identity?.length ? c.color_identity : ["C"];
  return `<span class="dots">${id.map((v) => `<i class="pip pip-${v}">${v}</i>`).join("")}</span>`;
}

export const segmented = (name, current, items) =>
  `<div class="seg" role="tablist">${items
    .map(
      ([id, label]) =>
        `<button role="tab" aria-selected="${id === current}" class="${id === current ? "on" : ""}" data-act="${name}" data-id="${id}">${label}</button>`,
    )
    .join("")}</div>`;

export const options = (items, current) =>
  items
    .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(current) ? "selected" : ""}>${esc(l)}</option>`)
    .join("");

export const bar = (ratio, cls = "") =>
  `<span class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, ratio * 100)).toFixed(1)}%"></span></span>`;

export function ring(score, size = 92) {
  const r = size / 2 - 7,
    c = 2 * Math.PI * r,
    off = c * (1 - Math.max(0, Math.min(100, score)) / 100),
    tone = score >= 70 ? "good" : score >= 50 ? "mid" : "low";
  return `<svg class="ring ${tone}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Engine score ${score} of 100"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle">${score}</text></svg>`;
}

// Mana curve bars; optional second series for before/after comparisons.
export function curveChart(a, b = null, labels = ["0", "1", "2", "3", "4", "5", "6", "7+"]) {
  const max = Math.max(1, ...a, ...(b || []));
  return `<div class="curve ${b ? "dual" : ""}">${labels
    .map(
      (l, i) =>
        `<div class="curve-col"><div class="curve-bars">${b ? `<span class="cb old" style="height:${((b[i] || 0) / max) * 100}%" title="Before: ${b[i] || 0}"><em>${b[i] || ""}</em></span>` : ""}<span class="cb" style="height:${((a[i] || 0) / max) * 100}%" title="${a[i] || 0} cards"><em>${a[i] || ""}</em></span></div><small>${l}</small></div>`,
    )
    .join("")}</div>`;
}

export function lineChart(points, { height = 120 } = {}) {
  if (points.length < 2)
    return `<p class="muted small">The chart starts after a second day of tracking. Value is recorded once per day when you open Cardforge.</p>`;
  const w = 320,
    h = height,
    pad = 6,
    vals = points.map((p) => p.total),
    min = Math.min(...vals),
    max = Math.max(...vals),
    span = max - min || 1,
    xy = points.map((p, i) => [
      pad + (i / (points.length - 1)) * (w - pad * 2),
      h - pad - ((p.total - min) / span) * (h - pad * 2),
    ]),
    d = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return `<svg class="line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Collection value over time"><path d="${d} L ${xy.at(-1)[0]} ${h} L ${xy[0][0]} ${h} Z" class="line-area"/><path d="${d}" class="line-stroke"/></svg><div class="row between muted small"><span>${esc(points[0].date)} · ${usd(points[0].total, 0)}</span><span>${esc(points.at(-1).date)} · ${usd(points.at(-1).total, 0)}</span></div>`;
}

export const empty = (title, text, actions = "") =>
  `<section class="empty"><div class="empty-mark" aria-hidden="true">◇</div><h3>${title}</h3><p>${text}</p>${actions ? `<div class="actions center">${actions}</div>` : ""}</section>`;
