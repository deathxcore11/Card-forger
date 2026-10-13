// Connects Deck Power (deckpower.js) to the app: picks the right lens for each game and
// format, matches the list against cached tournament results, and renders the panel/badges.
import { S } from "./store.js";
import { esc, ring, bar, pct } from "./ui.js";
import { cardKey } from "./core.js";
import { engineProfile } from "./insights.js";
import { formatOf, isCommanderLike } from "./formats.js";
import { metaState, MTG_META_FORMATS } from "./meta.js";
import { mtgConstructedPower, ygoPower, ptcgPower, metaMatch, blend, powerGrade, placeText, archetypeUpgrades } from "./deckpower.js";

const cache = new Map();
const memo = (sig, fn) => {
  if (cache.has(sig)) return cache.get(sig);
  if (cache.size > 120) cache.clear();
  const v = fn();
  cache.set(sig, v);
  return v;
};

const BASICS = /^(?:snow-covered )?(?:plains|island|swamp|mountain|forest|wastes)$/i;

/* ---------- Magic ---------- */

export const mtgMetaKey = (d) => {
  const name = formatOf(d).name;
  return MTG_META_FORMATS.some(([k]) => k === name) && !isCommanderLike(d) ? "mtg:" + name : null;
};

function mtgMetaDecks(data) {
  return (data?.decks || []).map((d) => {
    const rows = new Map(), labels = new Map();
    for (const r of d.main || []) {
      if (BASICS.test(r.name)) continue;
      const k = cardKey(r.name);
      rows.set(k, (rows.get(k) || 0) + r.qty);
      labels.set(k, r.name);
    }
    return { key: d.key, name: d.name, archetype: d.archetype || d.name, rank: d.rank || 99, place: d.place, event: d.event, date: d.date, url: d.url, rows, labels };
  });
}

export function mtgPower(d) {
  const mk = mtgMetaKey(d),
    M = mk ? metaState(mk) : null,
    sig = d.id + "|" + d.format + "|" + JSON.stringify(d.cards) + "|" + (M?.at || 0) + "|" + Object.keys(S.catalog).length;
  return memo(sig, () => {
    let base;
    if (isCommanderLike(d)) {
      const p = engineProfile(d, S.catalog);
      base = { score: p.score, parts: p.parts.map((x) => ({ ...x, fix: ["Ramp", "Draw", "Removal", "Wipe", "Protection", "Synergy"].includes(x.key) ? x.key : "" })), plan: p.archetype, lens: "Commander lens: lands, ramp, draw, answers, synergy with your commander and curve.", unknown: p.unknown };
    } else base = mtgConstructedPower(d, S.catalog, cardKey, formatOf(d).size);
    let match = null;
    if (M?.data?.decks?.length) {
      const mine = new Map();
      for (const r of d.cards) if (!BASICS.test(r.name)) mine.set(cardKey(r.name), (mine.get(cardKey(r.name)) || 0) + r.qty);
      match = metaMatch(mine, mtgMetaDecks(M.data), M.data.archetypes || []);
      if (match) match.extra = match.extra.map((x) => ({ ...x, name: d.cards.find((c) => cardKey(c.name) === x.key)?.name || x.key }));
    }
    const b = blend(base.score, match);
    return { ...base, heuristic: base.score, score: b.score, from: b.from, match, metaKey: mk, metaLoaded: !!M?.data, metaBusy: !!M?.busy, game: "mtg" };
  });
}

/* ---------- Yu-Gi-Oh! & Pokémon ---------- */

export function tcgPower(g, d, f, cardOf) {
  const M = metaState(g),
    sig = g + "|" + d.id + "|" + d.format + "|" + JSON.stringify(d.zones) + "|" + (M?.at || 0);
  return memo(sig, () => {
    const rows = [];
    for (const zone of ["main", "extra"]) for (const r of d.zones?.[zone] || []) rows.push({ zone, qty: r.qty, c: cardOf(r.cardId), id: r.cardId, name: r.name });
    const base = g === "ygo" ? ygoPower(rows, f) : ptcgPower(rows.filter((r) => r.zone === "main"), f);
    let match = null, mineMap = null, metaDecks = [];
    const data = M?.data;
    if (data?.decks?.length) {
      const mine = new Map(), nameOf = new Map();
      mineMap = mine;
      if (g === "ygo") {
        for (const r of rows) mine.set(String(r.id), (mine.get(String(r.id)) || 0) + r.qty);
        const decks = data.decks.map((x) => {
          const m = new Map();
          for (const id of [...(x.main || []), ...(x.extra || [])]) m.set(String(id), (m.get(String(id)) || 0) + 1);
          return { key: x.key, name: x.name, archetype: x.name, rank: x.rank || 99, place: x.place, event: x.event, date: x.date, url: x.url, rows: m, labels: new Map([...m.keys()].map((id) => [id, cardOf(id)?.name || "Card " + id])) };
        });
        metaDecks = decks;
        match = metaMatch(mine, decks, data.archetypes || []);
      } else {
        const nk = (n) => String(n || "").toLowerCase();
        for (const r of rows) {
          if (r.c?.basicEnergy) continue;
          const k = nk(r.c?.name || r.name);
          mine.set(k, (mine.get(k) || 0) + r.qty);
          nameOf.set(k, r.c?.name || r.name);
        }
        const decks = data.decks.map((x) => {
          const m = new Map(), labels = new Map();
          for (const r of x.list || []) {
            if (r.kind === "Energy" && /^basic | energy$/i.test(r.name) && !/special/i.test(r.name)) continue;
            m.set(nk(r.name), (m.get(nk(r.name)) || 0) + r.qty);
            labels.set(nk(r.name), r.name);
          }
          return { key: x.key, name: x.name, archetype: x.archetype, rank: x.rank || 99, place: x.place, event: x.event, date: x.date, url: x.url, rows: m, labels };
        });
        metaDecks = decks;
        match = metaMatch(mine, decks, (data.archetypes || []).map((a) => ({ ...a, name: a.id })));
        if (match) match.archetype = data.archetypes?.find((a) => a.id === match.archetype)?.name || match.deck.name;
      }
      if (match) match.extra = match.extra.map((x) => ({ ...x, name: g === "ygo" ? cardOf(x.key)?.name || x.key : nameOf.get(x.key) || x.key }));
    }
    const b = blend(base.score, match);
    // Upgrades from lists of the same archetype (only when the match is real).
    let upgrades = null;
    if (match && match.sim >= 0.25 && mineMap) {
      const arch = match.deck.archetype || match.deck.name;
      upgrades = archetypeUpgrades(mineMap, metaDecks.filter((x) => (x.archetype || x.name) === arch));
      upgrades.cuts = upgrades.cuts.map((x) => ({ ...x, name: match.extra.find((e) => e.key === x.key)?.name || (g === "ygo" ? cardOf(x.key)?.name : x.key) || x.key }));
    }
    return { ...base, heuristic: base.score, score: b.score, from: b.from, match, upgrades, metaKey: g, metaLoaded: !!data, metaBusy: !!M?.busy, game: g };
  });
}

/* ---------- Rendering ---------- */

export const powerChip = (p) => `<span class="power-chip p-${p.score >= 80 ? "hi" : p.score >= 60 ? "mid" : "lo"}" title="Deck Power ${p.score}/100 · ${esc(powerGrade(p.score))}"><em>${p.score}</em> power</span>`;

export function powerPanel(p, { loadAct = "", findAct = "", cardAct = () => "" } = {}) {
  const m = p.match,
    strong = m && m.sim >= 0.35;
  const metaBox = m
    ? `<div class="meta-match ${strong ? "hit" : ""}">
        <div class="row between"><b>${strong ? "Matches" : "Closest tournament deck"}: ${esc(m.archetype)}</b><span class="chip ${m.sim >= 0.7 ? "ok" : ""}">${Math.round(m.sim * 100)}% same cards</span></div>
        <p class="small muted">${m.lists} placing list${m.lists === 1 ? "" : "s"} · ${pct(m.share)} of the field · best finish <b>${placeText(m.bestRank)}</b>${m.deck.event ? ` · e.g. ${esc(m.deck.event)}${m.deck.place ? " (" + esc(m.deck.place) + ")" : ""}` : ""}${m.deck.url ? ` · <a href="${esc(m.deck.url)}" target="_blank" rel="noopener">list ↗</a>` : ""}</p>
        ${strong && m.missing.length ? `<p class="small"><b>Their list plays, yours doesn’t:</b> ${m.missing.slice(0, 8).map((x) => `<button class="link small" ${cardAct(x)}>${x.qty}× ${esc(x.name)}</button>`).join(", ")}</p>` : ""}
        ${strong && m.extra.length ? `<p class="small"><b>Yours only:</b> ${m.extra.slice(0, 8).map((x) => `${x.qty}× ${esc(x.name)}`).join(", ")}</p>` : ""}
        ${m.weight > 0 ? `<p class="foot">Because your list is ${Math.round(m.sim * 100)}% the same as proven placing decks, the rating leans on that tournament evidence (build check alone: ${p.heuristic}).</p>` : `<p class="foot">Not close enough to any placing list to use tournament results; this rating is the build check only.</p>`}
      </div>`
    : p.metaKey
      ? `<div class="meta-match"><p class="small">${p.metaBusy ? "Loading tournament results…" : "Compare this list with recent tournament winners to see which archetype it is, how it placed, and what it’s missing."}</p>${loadAct && !p.metaBusy ? `<button class="btn small" ${loadAct}>Compare with tournament decks</button>` : ""}</div>`
      : "";
  return `<section class="panel score-panel power">${ring(p.score)}<div><p class="eyebrow">Deck Power</p><h2>${esc(powerGrade(p.score))}</h2><p class="small"><b>${esc(p.plan)}</b></p><p class="muted small">${esc(p.lens)} A build-health and tournament-evidence rating, not a win rate.</p></div></section>
  ${metaBox ? `<section class="panel">${metaBox}</section>` : ""}
  <section class="panel"><h3>What the rating looks at</h3>${p.parts
    .map((x) => {
      const low = x.ratio < 0.75;
      return `<div class="ingredient"><div class="row between"><span><b>${esc(x.label)}</b> <span class="muted small">${esc(x.hint)}</span></span><span class="${low ? "warn-text" : ""}">${esc(String(x.count))}<span class="muted">/${esc(String(x.target))}</span></span></div>${bar(x.ratio, low ? "warn" : "good")}${low && x.fix && findAct ? `<button class="link small" ${findAct(x)}>Find ${esc(x.fix.toLowerCase())} cards →</button>` : ""}</div>`;
    })
    .join("")}</section>`;
}
