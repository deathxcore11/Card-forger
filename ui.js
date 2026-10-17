import { tierOf } from "./tier.js";
// Small HTML helpers shared by every screen.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// A quoted attribute is not sufficient for links: reject executable URL schemes too.
export const safeHref = (value) => {
  const raw = String(value ?? "").trim();
  if (/^[#/?]/.test(raw) && !/^[/\\]{2}/.test(raw)) return raw;
  try { const url = new URL(raw); return ["https:", "http:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; }
};

// One formatter per number of decimals (toLocaleString builds a new one on every call, which adds
// up when a 300-card set renders).
const USD = new Map();
export const usd = (n, digits = 2) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  let f = USD.get(digits);
  if (!f) USD.set(digits, (f = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })));
  return "$" + f.format(Number(n));
};

export const pct = (n, digits = 0) =>
  n === null || n === undefined ? "—" : (n * 100).toFixed(digits) + "%";

export const signed = (n, fmt = (x) => String(x)) =>
  n > 0 ? "+" + fmt(n) : n < 0 ? "−" + fmt(Math.abs(n)) : "±0";

// Every card picture remembers its card's price, so any thumbnail drawn from it wears the same
// price-tier ring (tier.js) wherever it appears in the app.
const priceByUrl = new Map();
const remember = (url, c) => {
  const p = c?.prices?.usd ?? c?.prices?.usd_foil ?? c?.prices?.usd_etched;
  if (url && p != null && priceByUrl.size < 20000) priceByUrl.set(url, Number(p));
  return url;
};
export const rememberPrice = (url, price) => (url && price != null && priceByUrl.set(url, Number(price)), url);
export const tierRing = (url, cls = "") => {
  if (!url || /\b(?:cs-art|hero-art|hh-art|zoom|cover|nc-)/.test(cls)) return "";
  const p = priceByUrl.get(url);
  if (p == null) return "";
  const t = tierOf("", "", p);
  return ` data-tier="${t.key}" style="--tier:${t.color}"`;
};
export const art = (c) =>
  remember(
    c?.image_uris?.art_crop ||
      c?.card_faces?.[0]?.image_uris?.art_crop ||
      c?.image_uris?.normal ||
      c?.card_faces?.[0]?.image_uris?.normal ||
      "",
    c,
  );

export const cardImage = (c, size = "normal") =>
  remember(c?.image_uris?.[size] || c?.card_faces?.[0]?.image_uris?.[size] || "", c);

export function img(url, alt, cls = "") {
  return url
    ? `<img class="${cls}" src="${esc(url)}"${tierRing(url, cls)} alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.insertAdjacentHTML('afterend','<span class=&quot;${cls} img-missing&quot; role=&quot;img&quot; aria-label=&quot;Artwork unavailable&quot;>◇<small>Art unavailable</small></span>')">`
    : `<span class="${cls} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`;
}

// Official mana and card symbols, served by Scryfall (same artwork as the cards).
// {2/W} → 2W.svg, {W/U/P} → WUP.svg, {T} → T.svg. If an icon can't load, its {text} shows instead.
const SYMBOL_FILE = { "½": "HALF", "∞": "INFINITY" };
export const symbolUrl = (t) =>
  "https://svgs.scryfall.io/card-symbols/" + encodeURIComponent(SYMBOL_FILE[t] || String(t).replace(/\//g, "").toUpperCase()) + ".svg";
export const symbolName = t => ({W:"White mana",U:"Blue mana",B:"Black mana",R:"Red mana",G:"Green mana",C:"Colorless mana",T:"Tap",Q:"Untap",X:"Variable mana",S:"Snow mana",E:"Energy counter",P:"Phyrexian mana"}[t] || (/^\d+$/.test(t) ? `${t} generic mana` : t.includes("/") ? t.split("/").map(symbolName).join(" or ") : `Symbol ${t}`));
export const sym = (t, cls = "") =>
  `<img class="ms ${cls}" src="${symbolUrl(t)}" alt="${esc(symbolName(t))}" title="${esc(symbolName(t))}" loading="lazy" decoding="async" onerror="this.replaceWith(this.alt)">`;

export function manaCost(c) {
  const cost = c?.mana_cost || c?.card_faces?.[0]?.mana_cost || "";
  const parts = cost.match(/\{[^}]+\}/g) || [];
  if (!parts.length) return "";
  return `<span class="mana" role="img" aria-label="Mana cost ${esc(cost)}">${parts.map((p) => sym(p.slice(1, -1))).join("")}</span>`;
}

// Rules text with {T}, {W}, {2} … drawn as symbols. Escapes everything else.
export const symbolText = (text) =>
  esc(text).replace(/\{([^}\s]{1,8})\}/g, (_, t) => sym(t, "inline"));

export function colorDots(c) {
  const id = c?.color_identity?.length ? c.color_identity : ["C"];
  return `<span class="dots" role="img" aria-label="Color identity ${esc(id.join(""))}">${id.map((v) => sym(v)).join("")}</span>`;
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

export function valueChange(points) {
  const valid = points.filter(p => Number.isFinite(p.total));
  if (valid.length < 2) return null;
  const first = valid[0], last = valid.at(-1), delta = Math.round((last.total-first.total)*100)/100;
  return {delta, percent:first.total > 0 ? delta/first.total*100 : null, date:first.date,
    direction:delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'};
}

export function lineChart(points, { height = 120 } = {}) {
  if (!points.length) return `<p class="muted small">Add a priced card to start your collection graph.</p>`;
  if (points.length === 1) return `<div class="value-change flat"><strong>↔ Starting value</strong><span class="muted small">No earlier snapshot to compare</span></div><svg class="line value-start" viewBox="0 0 320 ${height}" role="img" aria-label="Collection value over time"><path d="M 6 ${height/2} H 314" class="line-stroke" stroke-dasharray="4 5"/><circle cx="160" cy="${height/2}" r="4" fill="currentColor"/></svg><div class="value-chart-dates muted small"><span>${esc(points[0].date)}</span><b>${usd(points[0].total)}</b></div><p class="muted small">First recorded snapshot. Daily changes will show ↑ gains or ↓ losses; no earlier values have been invented.</p>`;
  const change = valueChange(points);
  const changeHtml = change ? `<div class="value-change ${change.direction}" role="status"><strong>${change.delta>0?"↑ +":change.delta<0?"↓ −":""}${usd(Math.abs(change.delta))}${change.percent===null?"":` (${change.percent>0?"+":change.percent<0?"−":""}${Math.abs(change.percent).toFixed(1)}%)`}</strong><span class="muted small">${change.direction==="flat"?"Unchanged":"Total change"} since ${esc(change.date)}</span></div><p class="muted small">Includes changes to copies, recorded values and available prices.</p>` : "";
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
  return `${changeHtml}<svg class="line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Collection value over time"><path d="${d} L ${xy.at(-1)[0]} ${h} L ${xy[0][0]} ${h} Z" class="line-area"/><path d="${d}" class="line-stroke"/></svg><div class="value-chart-dates muted small"><span>${esc(points[0].date)} · ${usd(points[0].total, 0)}</span><span>${esc(points.at(-1).date)} · ${usd(points.at(-1).total, 0)}</span></div>`;
}

export const empty = (title, text, actions = "") =>
  `<section class="empty"><div class="empty-mark" aria-hidden="true">◇</div><h3>${title}</h3><p>${text}</p>${actions ? `<div class="actions center">${actions}</div>` : ""}</section>`;

// A visible set code survives offline or when the expansion symbol cannot load.
// Set symbols: Scryfall's official icon for each set (from /sets), falling back to the code's own file.
let SET_ICONS = {};
export const registerSetIcons = (map) => (SET_ICONS = map || {});
export const setIconUrl = (code) => {
  const k = String(code || "").toLowerCase();
  return SET_ICONS[k] || `https://svgs.scryfall.io/sets/${encodeURIComponent(k)}.svg`;
};

export function setBadge(c, {physical=false, unspecified=false} = {}) {
  const code=String(c?.set || '').trim().toUpperCase();
  if(unspecified || !/^[A-Z0-9]{2,8}$/.test(code))return '<span class="set-badge unknown" title="Physical set not specified">SET ?</span>';
  const title=(physical?'Physical printing: ':'Reference printing: ')+(c.set_name||code)+(c.collector_number?' #'+c.collector_number:'');
  return `<span class="set-badge r-${esc(c.rarity||'common')}" data-act="set" data-code="${esc(code.toLowerCase())}" role="link" title="${esc(title)} — tap to see the whole set" aria-label="${esc(title)}"><span class="set-icon" style="--icon:url('${esc(setIconUrl(code))}')" aria-hidden="true"></span><span>${esc(code)}</span></span>`;
}

export function customBudget(value) {
 const text=String(value??'').trim(), amount=Number(text);
 if(!text || !Number.isFinite(amount) || amount<0 || amount>100000)throw Error('Enter a dollar budget from $0 to $100,000.');
 return Math.round(amount*100)/100;
}

// Placeholder cards while results load: the layout appears at once and fills in.
export const skeletonGrid = (n = 6) => `<div class="card-grid skeleton-grid" aria-busy="true" aria-label="Loading cards">${Array.from({ length: n }, () => `<div class="skel-card"><span class="skel-img"></span><span class="skel-line"></span><span class="skel-line short"></span></div>`).join("")}</div>`;

// Async prices/results must not close the disclosure the player is using.
const disclosureKeys = root => {
 const counts=new Map();
 return [...(root?.querySelectorAll?.('details')||[])].map(node=>{
  const label=node.id || node.querySelector('summary')?.textContent?.trim() || '';
  const n=counts.get(label)||0;counts.set(label,n+1);
  return [label+'#'+n,node];
 });
};
export const captureDisclosures=root=>new Map(disclosureKeys(root).map(([key,node])=>[key,node.open]));
export function restoreDisclosures(root,state){
 if(!state)return;
 for(const [key,node] of disclosureKeys(root))if(state.has(key))node.open=state.get(key);
}
