// Deck extras: Commander bracket estimate, mana base helper, proxy sheet and
// life tracker state. Pure functions over the card catalog; no network calls.
import { cardKey, rulesText, typeText, isLand, isBasic, aggregateCards } from "./core.js";

/* ---------- Commander bracket estimate ---------- */

// Fallback for cards cached before Scryfall added the `game_changer` flag.
// When a card carries the flag, the flag wins.
const GAME_CHANGERS = new Set(
  [
    "Ad Nauseam", "Ancient Tomb", "Aura Shards", "Bolas's Citadel", "Braids, Cabal Minion",
    "Chrome Mox", "Coalition Victory", "Consecrated Sphinx", "Crop Rotation", "Cyclonic Rift",
    "Demonic Tutor", "Drannith Magistrate", "Enlightened Tutor", "Expropriate", "Field of the Dead",
    "Fierce Guardianship", "Food Chain", "Force of Will", "Gaea's Cradle", "Gamble",
    "Gifts Ungiven", "Glacial Chasm", "Grand Arbiter Augustin IV", "Grim Monolith", "Humility",
    "Imperial Seal", "Intuition", "Jeska's Will", "Jin-Gitaxias, Core Augur", "Lion's Eye Diamond",
    "Mana Vault", "Mishra's Workshop", "Mox Diamond", "Mystical Tutor", "Narset, Parter of Veils",
    "Natural Order", "Necropotence", "Notion Thief", "Opposition Agent", "Orcish Bowmasters",
    "Panoptic Mirror", "Rhystic Study", "Seedborn Muse", "Serra's Sanctum", "Smothering Tithe",
    "Survival of the Fittest", "Sway of the Stars", "Teferi's Protection", "Tergrid, God of Fright",
    "Thassa's Oracle", "The One Ring", "The Tabernacle at Pendrell Vale", "Underworld Breach",
    "Vampiric Tutor", "Vorinclex, Voice of Hunger", "Worldly Tutor",
  ].map(cardKey),
);

const FAST_MANA = new Set(
  [
    "Sol Ring", "Mana Crypt", "Mana Vault", "Chrome Mox", "Mox Diamond", "Mox Opal", "Mox Amber",
    "Grim Monolith", "Lotus Petal", "Jeweled Lotus", "Lion's Eye Diamond", "Ancient Tomb",
    "Dark Ritual", "Simian Spirit Guide", "Elvish Spirit Guide", "Mana Drain", "Rite of Flame",
  ].map(cardKey),
);

const text = (c) => rulesText(c).replace(/\s+/g, " ");

export const isGameChanger = (c) =>
  !!c && (typeof c.game_changer === "boolean" ? c.game_changer : GAME_CHANGERS.has(cardKey(c.name)));

// "Search your library for a card / creature card / instant card…", but not for lands.
export function isTutor(c) {
  if (!c || isLand(c)) return false;
  for (const m of text(c).matchAll(/search(?:es)? (?:your|their) library for ([^.]*?)card/gi))
    if (!/\bland\b|\bbasic\b|\bforest\b|\bisland\b|\bplains\b|\bswamp\b|\bmountain\b/i.test(m[1])) return true;
  return false;
}

export const isExtraTurn = (c) => !!c && /takes? an extra turn/i.test(text(c));

export function isMassLandDenial(c) {
  if (!c) return false;
  const t = text(c);
  return (
    /(?:destroy|exile) all [^.]*\blands\b/i.test(t) ||
    /sacrifices? (?:all|each) [^.]*\blands?\b/i.test(t) ||
    /\blands? (?:don't|do not) untap/i.test(t) ||
    /\b(?:lands|permanents) [^.]*don't untap during/i.test(t)
  );
}

export const isFastMana = (c) => !!c && FAST_MANA.has(cardKey(c.name));

export const BRACKETS = {
  1: { name: "Exhibition", text: "Theme first, winning second. Decided by intent, so Cardforge never assigns it on its own." },
  2: { name: "Core", text: "About a modern precon: no Game Changers, no mass land denial, no chained extra turns, few tutors." },
  3: { name: "Upgraded", text: "Stronger than a precon: up to three Game Changers, no mass land denial, extra turns not chained." },
  4: { name: "Optimized", text: "Anything legal: more than three Game Changers, mass land denial or lots of extra turns." },
  5: { name: "cEDH", text: "Built for the tournament metagame. A list alone can’t show this; talk with your pod." },
};

// Lowest bracket the list fits by the published card rules. Two-card combos and
// intent can't be read from card text, so this is a floor, not a verdict.
export function bracketEstimate(deck, catalog) {
  const found = { gameChangers: [], tutors: [], extraTurns: [], landDenial: [], fastMana: [] };
  let unknown = 0;
  for (const row of aggregateCards(deck.cards)) {
    const c = catalog[cardKey(row.name)];
    if (!c) {
      unknown += row.qty;
      continue;
    }
    if (isGameChanger(c)) found.gameChangers.push(c.name);
    if (isTutor(c)) found.tutors.push(c.name);
    if (isExtraTurn(c)) found.extraTurns.push(c.name);
    if (isMassLandDenial(c)) found.landDenial.push(c.name);
    if (isFastMana(c)) found.fastMana.push(c.name);
  }
  const gc = found.gameChangers.length,
    reasons = [];
  let bracket = 2;
  if (gc > 3) reasons.push(`${gc} Game Changers (more than 3)`);
  if (found.landDenial.length) reasons.push("mass land denial");
  if (found.extraTurns.length >= 3) reasons.push(`${found.extraTurns.length} extra-turn cards`);
  if (reasons.length) bracket = 4;
  else {
    if (gc) reasons.push(`${gc} Game Changer${gc > 1 ? "s" : ""}`);
    if (found.tutors.length >= 4) reasons.push(`${found.tutors.length} tutors`);
    if (found.extraTurns.length >= 2) reasons.push(`${found.extraTurns.length} extra-turn cards`);
    if (reasons.length) bracket = 3;
  }
  // What would move the deck one bracket down.
  const lower = [];
  if (bracket === 4) {
    if (gc > 3) lower.push(`cut ${gc - 3} Game Changer${gc - 3 > 1 ? "s" : ""}`);
    if (found.landDenial.length) lower.push("cut mass land denial");
    if (found.extraTurns.length >= 3) lower.push(`keep extra turns to ${Math.min(2, found.extraTurns.length - 1)}`);
  } else if (bracket === 3) {
    if (gc) lower.push(`cut ${gc} Game Changer${gc > 1 ? "s" : ""}`);
    if (found.tutors.length >= 4) lower.push(`trim tutors to 3`);
    if (found.extraTurns.length >= 2) lower.push("keep one extra-turn card");
  }
  return { bracket, ...BRACKETS[bracket], reasons, lower, found, unknown };
}

/* ---------- Mana base helper ---------- */

const BASIC_OF = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };

export function entersTapped(c) {
  if (!c || !isLand(c) || isBasic(c)) return false;
  const t = text(c);
  if (!/enters(?: the battlefield)? tapped/i.test(t)) return false;
  // Check lands, shocks, fast lands and similar have a way to come in untapped.
  return !/tapped unless|if you don't, (?:it|this land) enters/i.test(t);
}

// Split `n` basics across colors in proportion to colored pips (largest remainder).
export function splitBasics(pips, n) {
  const colors = Object.keys(pips).filter((k) => pips[k] > 0),
    total = colors.reduce((a, k) => a + pips[k], 0);
  if (!colors.length || !total || n <= 0) return {};
  const raw = colors.map((k) => [k, (pips[k] / total) * n]),
    out = Object.fromEntries(raw.map(([k, v]) => [k, Math.floor(v)]));
  let left = n - Object.values(out).reduce((a, b) => a + b, 0);
  for (const [k] of raw.sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  // Every color you play gets at least one basic when there's room.
  for (const k of colors)
    if (!out[k] && n >= colors.length) {
      const donor = Object.keys(out).sort((a, b) => out[b] - out[a])[0];
      out[donor]--;
      out[k] = 1;
    }
  return out;
}

export function manaBase(deck, catalog, pips) {
  const basics = { W: 0, U: 0, B: 0, R: 0, G: 0 },
    tapped = [];
  let lands = 0,
    snowOrOther = 0;
  for (const row of aggregateCards(deck.cards)) {
    const c = catalog[cardKey(row.name)];
    if (!c || !isLand(c)) continue;
    lands += row.qty;
    if (isBasic(c)) {
      const k = Object.keys(BASIC_OF).find((x) => new RegExp("\\b" + BASIC_OF[x] + "\\b").test(c.name));
      if (k) basics[k] += row.qty;
      else snowOrOther += row.qty;
    } else if (entersTapped(c)) for (let i = 0; i < row.qty; i++) tapped.push(c.name);
  }
  const basicCount = Object.values(basics).reduce((a, b) => a + b, 0),
    suggested = splitBasics(pips, basicCount),
    changes = Object.keys(BASIC_OF)
      .map((k) => ({ color: k, land: BASIC_OF[k], now: basics[k], want: suggested[k] || 0 }))
      .filter((x) => x.now || x.want);
  return {
    lands,
    basics,
    basicCount,
    snowOrOther,
    suggested,
    changes,
    off: changes.some((x) => Math.abs(x.now - x.want) >= 2),
    tapped,
    tooManyTapped: tapped.length > Math.max(4, Math.round(lands * 0.2)),
  };
}

export const basicName = (color) => BASIC_OF[color];

/* ---------- Proxy print sheet ---------- */

const cardImg = (c) => c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || "";
const escAttr = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// Expand rows into one entry per copy; missing card data shows a text frame.
export function proxyList(rows, catalog, { skipBasics = true } = {}) {
  const out = [];
  for (const r of rows) {
    const c = catalog[cardKey(r.name)];
    if (skipBasics && c && isBasic(c)) continue;
    for (let i = 0; i < r.qty; i++) out.push({ name: c?.name || r.name, img: cardImg(c), type: typeText(c), text: rulesText(c), cost: c?.mana_cost || "" });
  }
  return out;
}

// A self-contained printable page: 3×3 cards per sheet at true card size (63×88 mm).
export function proxySheetHTML(title, cards) {
  const cell = (p) =>
    p.img
      ? `<div class="pc"><img src="${escAttr(p.img)}" alt="${escAttr(p.name)}" referrerpolicy="no-referrer"></div>`
      : `<div class="pc txt"><b>${escAttr(p.name)}</b><i>${escAttr(p.cost)}</i><em>${escAttr(p.type)}</em><p>${escAttr(p.text)}</p></div>`;
  const pages = [];
  for (let i = 0; i < cards.length; i += 9) pages.push(`<section class="page">${cards.slice(i, i + 9).map(cell).join("")}</section>`);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escAttr(title)}</title><style>
@page{size:auto;margin:8mm}*{box-sizing:border-box}body{margin:0;font:12px system-ui,sans-serif;background:#fff;color:#111}
.bar{position:sticky;top:0;display:flex;gap:12px;align-items:center;padding:10px 14px;background:#111;color:#fff}.bar button{font:inherit;padding:8px 14px;border-radius:8px;border:0;background:#e8b95b;font-weight:700;cursor:pointer}
.page{display:grid;grid-template-columns:repeat(3,63mm);grid-auto-rows:88mm;gap:0;justify-content:center;padding:6mm 0;page-break-after:always;break-after:page}
.pc{width:63mm;height:88mm;outline:0.2mm dashed #999;overflow:hidden;position:relative}.pc img{width:100%;height:100%;object-fit:cover;display:block}
.pc.txt{padding:4mm;display:flex;flex-direction:column;gap:2mm;border:0.6mm solid #111;border-radius:3mm}.pc.txt i{font-style:normal;color:#555}.pc.txt em{font-style:normal;font-weight:600;border-bottom:0.3mm solid #999;padding-bottom:1mm}.pc.txt p{white-space:pre-wrap;margin:0;font-size:9pt}
@media print{.bar{display:none}.page{padding:0}}
</style></head><body><div class="bar"><b>${escAttr(title)}</b><span>${cards.length} cards · ${pages.length} page${pages.length === 1 ? "" : "s"} · playtest proxies, not for sale</span><button onclick="print()">Print</button></div>${pages.join("")}</body></html>`;
}

/* ---------- Life tracker ---------- */

export function newGame(players = 4, life = 40) {
  return {
    turn: 1,
    startedAt: Date.now(),
    players: Array.from({ length: players }, (_, i) => ({ name: i ? "Opponent " + i : "You", life, poison: 0, cmd: 0 })),
  };
}

// A player is out at 0 life, 10 poison or 21 commander damage from one commander.
export const isOut = (p) => p.life <= 0 || p.poison >= 10 || p.cmd >= 21;
