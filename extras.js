import {cachedCommanderCombos} from './commander-combos.js';
import {cardBracketEvidence,assessCommanderBracket,BRACKET_NAMES} from './commander-evidence.js';
// Deck extras: Commander bracket estimate, mana base helper, proxy sheet and
// life tracker state. Pure functions over the card catalog; no network calls.
import { cardKey, rulesText, typeText, isLand, isBasic, aggregateCards, validateDeck } from "./core.js";
import { engineProfile, engineRoles, manaColorName } from "./insights.js";
import { commanderTheme } from "./planner.js";
import { formatOf } from "./formats.js";

/* ---------- Commander bracket estimate ---------- */

const FAST_MANA = new Set(
  [
    "Sol Ring", "Mana Crypt", "Mana Vault", "Chrome Mox", "Mox Diamond", "Mox Opal", "Mox Amber",
    "Grim Monolith", "Lotus Petal", "Jeweled Lotus", "Lion's Eye Diamond", "Ancient Tomb",
    "Dark Ritual", "Simian Spirit Guide", "Elvish Spirit Guide", "Mana Drain", "Rite of Flame",
  ].map(cardKey),
);

const text = (c) => rulesText(c).replace(/\s+/g, " ");

export const isGameChanger = (c) =>
  cardBracketEvidence(c).gameChanger === true;

// "Search your library for a card / creature card / instant card…", but not for lands.
export function isTutor(c) {
  if (!c || isLand(c)) return false;
  for (const m of text(c).matchAll(/search(?:es)? (?:your|their) library for ([^.]*?)card/gi))
    if (!/\bland\b|\bbasic\b|\bforest\b|\bisland\b|\bplains\b|\bswamp\b|\bmountain\b/i.test(m[1])) return true;
  return false;
}

export const isExtraTurn = c => cardBracketEvidence(c).extraTurn === true;
export const isMassLandDenial = c => cardBracketEvidence(c).massLandDenial === true;

export const isFastMana = (c) => !!c && FAST_MANA.has(cardKey(c.name));

export const BRACKETS = Object.fromEntries(Object.entries(BRACKET_NAMES).map(([id,name])=>[id,{name,text:'An optional table-experience guideline; discuss intent and unusual strategies.'}]));
export function bracketEstimate(deck,catalog){
 const estimate=assessCommanderBracket(deck,catalog,{combos:cachedCommanderCombos(deck)});
 for(const row of aggregateCards(deck.cards||[])){
  const c=catalog[cardKey(row.name)];if(isTutor(c))estimate.found.tutors.push(c.name);if(isFastMana(c))estimate.found.fastMana.push(c.name);
 }
 return estimate;
}

// Legacy synthetic pod pacing. Never independent evidence for this same bracket,
// actual game-ending turn, table fit or a measured matchup win rate.
export function podSpeed(deck, catalog) {
  const b = bracketEstimate(deck, catalog), fm = b.found.fastMana.length, tu = b.found.tutors.length;
  const base = { 2: 10, 3: 8.5, 4: 6.5 }[b.bracket] ?? 10;
  return { turn: Math.max(3.5, base - Math.min(2.5, fm * 0.3) - Math.min(1.5, tu * 0.15)), bracket: b.bracket, synthetic: true, independentEvidence: false, fastMana: fm, tutors: tu };
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

export function manaBase(deck, catalog, pips, payment = null) {
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
    hasDemand = Object.values(pips).some(n => n > 0),
    canSuggest = hasDemand && payment?.complete !== false,
    suggested = canSuggest ? splitBasics(pips, basicCount) : { ...basics },
    changes = Object.keys(BASIC_OF)
      .map((k) => ({ color: k, land: BASIC_OF[k], now: basics[k], want: suggested[k] || 0 }))
      .filter((x) => x.now || x.want);
  return {
    lands,
    basics,
    basicCount,
    snowOrOther,
    suggested,
    canSuggest,
    payment,
    changes,
    off: canSuggest && changes.some((x) => Math.abs(x.now - x.want) >= 2),
    tapped,
    tooManyTapped: tapped.length > Math.max(4, Math.round(lands * 0.2)),
  };
}

export const basicName = (color) => BASIC_OF[color];

// Keep the review sheet and detailed helper grounded in the same observed data.
export function manaBaseExplanation(m) {
  const split = key => m.changes.filter(x => x[key]).map(x => `${x[key]} ${x.land}${x[key] === 1 || x.land.endsWith("s") ? "" : "s"}`).join(", ") || "none",
    needed = m.changes.filter(x => x.want > x.now).map(x => x.color),
    contributors = (m.payment?.cards || []).filter(c => needed.some(k => c.required[k] || c.allocated[k])),
    examples = contributors.slice(0, 4).map(c => `${c.qty}× ${c.name} (${c.cost})`).join("; "),
    colors = needed.map(manaColorName).join(" / ");
  return {
    cards: contributors.map(c => c.name),
    detail: `Current basics: ${split("now")}. Suggested guideline: ${split("want")}.${examples ? ` Estimated ${colors || "colored"} payment comes from ${examples}${contributors.length > 4 ? ` and ${contributors.length - 4} other cards` : ""}.` : ""} This estimates casting-cost symbols, not a requirement or a full mana-source check.`,
  };
}

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

/* ---------- Deck review ---------- */

// One list of things worth a look, each with its evidence and a next step.
// level "bad" = a confirmed rules problem; "warn" = worth reviewing.
// heuristic = based on common deckbuilding guidelines, not on the rules.
export function deckReview(deck, catalog, collection = [], decks = []) {
  const v = validateDeck(deck, catalog, collection, decks),
    out = [],
    f = formatOf(deck),
    commander = !!f.commander,
    names = (kind) => v.issues.filter((i) => i.kind === kind).map((i) => i.text.split(": ")[0]),
    group = (kind, level, one, many, why) => {
      const list = names(kind);
      if (list.length)
        out.push({ level, title: list.length === 1 ? one : many.replace("#", list.length), detail: why, cards: list, action: { act: "deckTab", id: "cards", label: "Review cards" } });
    };
  if (v.issues.some((i) => i.kind === "commander"))
    out.push({ level: "bad", title: f.commander === "planeswalker" ? "No Oathbreaker set" : "No eligible commander set", detail: "Without one CardStashy can’t check colors, synergy or upgrades.", action: { act: "deckTab", id: "upgrade", label: "Choose commander" } });
  const countIssue = v.issues.find((i) => i.kind === "count");
  if (countIssue) {
    const short = v.count < v.target,
      n = Math.abs(v.target - v.count);
    out.push({
      level: "warn",
      title: f.exact ? `${v.count}/${v.target} cards` : `${v.count} cards — ${f.name} needs ${v.target}+`,
      detail: short
        ? `${n} empty slot${n > 1 ? "s" : ""} in the list. (Separate from cards you still need to buy — those are in Buy.)`
        : `${n} card${n > 1 ? "s" : ""} over the ${v.target}-card limit.`,
      action: short ? (deck.format === "Commander" ? { act: "deckTab", id: "upgrade", label: `Fill ${n} slot${n > 1 ? "s" : ""}` } : { act: "formatSearch", label: `Find ${f.name} cards` }) : { act: "deckTab", id: "cards", label: "Choose cuts" },
    });
  }
  group("color", "bad", "1 card is outside your commander’s colors", "# cards are outside your commander’s colors", "Every card must fit the commander’s color identity.");
  group("legality", "bad", `1 card isn’t legal in ${f.name}`, `# cards aren’t legal in ${f.name}`, `Banned or not legal in ${f.name} according to Scryfall’s latest card data.`);
  group("singleton", "bad", "1 card has too many copies", "# cards have too many copies", `${f.name} allows one copy of each card except basic lands and cards that say otherwise.`);
  group("copies", "bad", "1 card has too many copies", "# cards have too many copies", f.legality === "vintage" ? "Vintage allows four copies, and one of each restricted card." : `${f.name} allows ${f.copies} copies except basic lands.`);
  const unknown = names("unverified");
  if (unknown.length)
    out.push({ level: "warn", title: `${unknown.length} card${unknown.length > 1 ? "s have" : " has"} no card data`, detail: "They can’t be checked or counted until they’re looked up. Check spelling if a refresh doesn’t fix it.", cards: unknown, action: { act: "refreshDeck", label: "Load card data" } });

  // Guideline checks only make sense once the list is close to complete.
  if (v.count >= v.target * 0.9) {
    const p = engineProfile(deck, catalog);
    for (const part of p.parts) {
      if (part.key === "Lands") {
        const diff = part.count - part.target;
        if (Math.abs(diff) >= 4)
          out.push({ level: "warn", heuristic: true, title: `${part.count} lands`, detail: `Most ${f.size}-card decks run about ${part.target}. ${diff < 0 ? "Fewer lands means more missed land drops." : "Extra lands means fewer spells to draw."}`, action: { act: "deckTab", id: "engine", label: "See test games" } });
      } else if (["Ramp", "Draw", "Removal"].includes(part.key) && part.ratio < 0.75)
        out.push({ level: "warn", heuristic: true, title: `Light on ${part.key.toLowerCase()}`, detail: `${part.count} found; a common guideline is about ${part.target}. ${part.hint}`, action: { act: "findRole", role: part.key, label: `Find ${part.key.toLowerCase()} cards` } });
    }
    const m = manaBase(deck, catalog, p.pips, p.mana);
    if (m.tooManyTapped)
      out.push({ level: "warn", heuristic: true, title: `${m.tapped.length} lands always enter tapped`, detail: "Each can cost you a play in the early turns.", cards: [...new Set(m.tapped)], action: { act: "deckTab", id: "engine", label: "See mana base" } });
    else if (m.basicCount >= 6 && m.off)
      out.push({ level: "warn", heuristic: true, title: "Review your basic-land split", ...manaBaseExplanation(m), action: { act: "deckTab", id: "engine", label: "See mana details" } });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1));
}

/* ---------- Upgrade swap explanation ---------- */

const ROLE_WORD = { Ramp: "ramp", Draw: "card draw", Removal: "removal", Wipe: "a board wipe", Protection: "protection" };
const ROLE_WHY = { Ramp: "getting ahead on mana", Draw: "refilling your hand", Removal: "answering threats", Wipe: "resetting a losing board", Protection: "keeping your key pieces alive" };
const list = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs.at(-1));

// Plain-language trade-off for one swap, built only from the two cards and the deck's counts.
export function explainSwap(cutCard, addCard, commander, counts = {}, targets = {}) {
  const cutRoles = engineRoles(cutCard),
    addRoles = engineRoles(addCard),
    gains = addRoles.filter((r) => !cutRoles.includes(r)),
    loses = cutRoles.filter((r) => !addRoles.includes(r)),
    keeps = addRoles.filter((r) => cutRoles.includes(r)),
    tribe = commander ? commanderTheme(commander).tribe : null,
    isTribe = (c) => !!tribe && new RegExp("\\b" + tribe + "s?\\b", "i").test(typeText(c)),
    mvCut = Number(cutCard?.cmc) || 0,
    mvAdd = Number(addCard?.cmc) || 0,
    lines = [];
  // A gain only counts as a real benefit while the deck is under the usual guideline for it.
  const short = (r) => targets[r] === undefined || counts[r] === undefined || counts[r] < targets[r],
    needed = gains.filter(short),
    extra = gains.filter((r) => !short(r)),
    themeGain = tribe && isTribe(addCard) && !isTribe(cutCard),
    themeLoss = tribe && isTribe(cutCard) && !isTribe(addCard),
    an = (w) => (/^[AEIOU]/i.test(w) ? "an " : "a ") + w,
    count = (r, d) => (counts[r] !== undefined ? ` (${ROLE_WORD[r]} ${counts[r]} → ${counts[r] + d}${d > 0 && targets[r] ? (short(r) ? `, guideline ~${targets[r]}` : `; already at the ~${targets[r]} guideline`) : ""})` : "");
  if (needed.length) lines.push({ kind: "gain", text: `Adds ${list(needed.map((r) => ROLE_WORD[r]))}${needed.map((r) => count(r, 1)).join("")}.` });
  if (extra.length) lines.push({ kind: "same", text: `Also adds ${list(extra.map((r) => ROLE_WORD[r]))}${extra.map((r) => count(r, 1)).join("")}.` });
  if (loses.length) lines.push({ kind: "lose", text: `Loses ${list(loses.map((r) => ROLE_WORD[r]))}${loses.map((r) => count(r, -1)).join("")}.` });
  if (keeps.length) lines.push({ kind: "same", text: `Both provide ${list(keeps.map((r) => ROLE_WORD[r]))}.` });
  if (mvAdd !== mvCut) lines.push({ kind: mvAdd < mvCut ? "gain" : "lose", text: mvAdd < mvCut ? `Cheaper to cast: mana value ${mvCut} → ${mvAdd}.` : `Costs more to cast: mana value ${mvCut} → ${mvAdd}.` });
  if (themeGain) lines.push({ kind: "gain", text: `Is ${an(tribe)}, which your commander cares about.` });
  if (themeLoss) lines.push({ kind: "lose", text: `The cut is ${an(tribe)} and your commander cares about those; the new card isn’t.` });
  let choose;
  if (needed.length && loses.length) choose = `Choose this if ${ROLE_WHY[needed[0]]} matters more to you than ${ROLE_WHY[loses[0]]}.`;
  else if (needed.length && themeLoss) choose = `Choose this if ${ROLE_WHY[needed[0]]} matters more to you than one more ${tribe} on the battlefield.`;
  else if (needed.length) choose = `Fills a gap without giving up anything the deck counts on.`;
  else if (loses.length) choose = `Only worth it for the theme or curve — you give up ${ROLE_WORD[loses[0]]}.`;
  else if (extra.length) choose = `A small benefit: the deck already has enough ${ROLE_WORD[extra[0]]} by the usual guideline${themeLoss ? `, and you lose ${an(tribe)}` : ""}.`;
  else choose = mvAdd < mvCut ? "Same jobs, cheaper to cast — helps you play more each turn." : "A theme choice: no change to ramp, draw, removal or protection.";
  return { gains, loses, lines, choose };
}
