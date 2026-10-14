import {engineMap,engineMapPanel} from './engine-map.js';
import {strategicRisk,riskPanel} from "./strategy-risk.js";
// Connects Deck Power (deckpower.js) to the app: picks the right lens for each game and
// format, matches the list against cached tournament results, and renders the panel/badges.
import { S } from "./store.js";
import { ygoSource } from './ygo.js';
import { ptcgSource } from './ptcg.js';
import { legalityIn } from './formats.js';

export function powerReadiness(game,deck,format,cardOf) {
 const rows=game==='mtg'?deck.cards || []:Object.entries(deck.zones || {}).flatMap(([zone,rs])=>rs.map(r=>({...r,zone})));
 const unknown=rows.filter(r=>!cardOf(game==='mtg'?r.name:r.cardId)).reduce((n,r)=>n+r.qty,0),issues=[];
 if(game==='mtg'){
  const total=rows.reduce((n,r)=>n+r.qty,0),byName=new Map();
  if(total<format.size || (format.exact && total!==format.size))issues.push(`${total}/${format.size} cards`);
  for(const r of rows){const c=cardOf(r.name);if(!c)continue;const k=cardKey(r.name);byName.set(k,(byName.get(k)||0)+r.qty);
   if(format.legality && c.legalities && !['legal','restricted'].includes(legalityIn(c,format)))issues.push(`${r.name} is not legal in ${format.name}`);
   if(format.commander && deck.commander && cardKey(r.name)!==cardKey(deck.commander)){const identity=cardOf(deck.commander)?.color_identity;if(identity && (c.color_identity || []).some(x=>!identity.includes(x)))issues.push(`${r.name} is outside the commander’s color identity`);}
  }
  for(const [k,n] of byName){const c=cardOf(k);if(c&&!/^Basic/.test(c.type_line || '')&&!/any number of cards named/i.test(c.oracle_text || '')&&n>(legalityIn(c,format)==='restricted'?1:format.copies))issues.push(`${n} copies of ${c.name}`);}
  if(format.commander&&!deck.commander)issues.push('Choose a commander');
 }else issues.push(...(game==='ygo'?ygoSource:ptcgSource).validate(deck,cardOf,format).filter(x=>x.level==='bad').map(x=>x.text));
 return {unknown,issues:[...new Set(issues)],provisional:unknown>0||issues.length>0};
}
const readinessLabel=p=>p.readiness?.provisional?'Provisional · resolve deck checks':p.from==='meta'?powerGrade(p.score,p.from):p.score>=85?'Strong engine estimate':p.score>=68?'Solid engine estimate':p.score>=50?'Developing engine':'Engine needs work';

import { esc, ring, bar, pct } from "./ui.js";
import { review } from "./deckaudit.js";
import { scoutingReport, competitiveScore, competitiveTier } from "./scouting.js";
import { mtgGoldfish } from "./goldfish.js";
import { cardKey } from "./core.js";
import { engineProfile } from "./insights.js";
import { formatOf, isCommanderLike } from "./formats.js";
import { metaState, MTG_META_FORMATS } from "./meta.js";
import { mtgConstructedPower, ygoPower, ptcgPower, metaMatch, metaContext, powerGrade, placeText, archetypeUpgrades, BUILD_CAP } from "./deckpower.js";

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
  return name === "Commander" ? "mtg:EDH" : MTG_META_FORMATS.some(([k]) => k === name) && !isCommanderLike(d) ? "mtg:" + name : null;
};

function mtgMetaDecks(data) {
  return (data?.decks || []).map((d) => {
    const rows = new Map(), labels = new Map();
    for (const r of [...(d.main || []), ...(d.commanders || []).map(r=>typeof r === "string"?{name:r,qty:1}:r)]) {
      if (BASICS.test(r.name)) continue;
      const k = cardKey(r.name);
      rows.set(k, (rows.get(k) || 0) + r.qty);
      labels.set(k, r.name);
    }
    return { key: d.key, name: d.name, archetype: d.archetype || d.name, rank: d.rank || 99, place: d.place, event: d.event, date: d.date, url: d.url, rows, labels };
  });
}

// A deal-breaker (can't cast its spells, attacker can't attack, nothing to search) holds back the
// competitive reading too: a list that matches a winning deck on paper but can't function isn't one.
function capCtx(ctx, caps) {
  const max = caps?.[0]?.max;
  if (max == null || !ctx) return;
  if (ctx.score != null) ctx.score = Math.min(ctx.score, max);
  if (ctx.fieldEstimate != null) ctx.fieldEstimate = Math.min(ctx.fieldEstimate, max);
}

export function mtgPower(d) {
  const mk = mtgMetaKey(d),
    M = mk ? metaState(mk) : null,
    sig = d.id + "|" + d.format + "|" + JSON.stringify(d.cards) + "|" + (M?.at || 0) + "|" + JSON.stringify(d.cards.map(r=>S.catalog[cardKey(r.name)] || null));
  return memo(sig, () => {
    let base;
    if (isCommanderLike(d)) {
      const p = engineProfile(d, S.catalog);
      const hands = mtgConstructedPower(d, S.catalog, cardKey, formatOf(d).size),
        why = {
          Lands: `${p.counts.Lands} lands. Commander decks usually want ${p.parts.find((x) => x.key === "Lands")?.target ?? 36}–38 so you hit land drops every turn.`,
          Ramp: `${p.counts.Ramp} ramp pieces. About 10 gets your commander and big spells out a turn or two early.`,
          Draw: `${p.counts.Draw} draw sources. Without ~10, you run out of cards by the midgame against three opponents.`,
          Removal: `${p.counts.Removal} targeted answers. The table's best threat needs an answer from you too.`,
          Wipe: `${p.counts.Wipe} board wipes. Two or three reset a board you've fallen behind on.`,
          Protection: `${p.counts.Protection} protection pieces for your commander and key permanents.`,
          Curve: `Average cost ${p.avg?.toFixed(2) ?? "—"}. Above 3.0, the early turns are slow.`,
        };
      base = {
        score: p.score,
        parts: p.parts.map((x) => ({ ...x, fix: ["Ramp", "Draw", "Removal", "Wipe", "Protection", "Synergy"].includes(x.key) ? x.key : "", why: why[x.key] || (x.key === "Synergy" ? `${x.count} cards support your commander's plan; about ${x.target} makes it come together.` : ""), cards: (p.byRole?.[x.key] || []).map((name) => ({ name, qty: 1 })) })),
        plan: /kinnan, bonder prodigy/i.test(d.commander || "") ? "Nonland mana engine · activated-ability combo" : p.archetype,
        lens: "Commander lens: lands, ramp, draw, answers, synergy with your commander and curve.",
        unknown: p.unknown,
        sims: hands.sims,
        roles: hands.roles,
        goldfish: mtgGoldfish((d.cards || []).map((r) => ({ qty: r.qty, c: S.catalog[cardKey(r.name)] })).filter((r) => r.c && cardKey(r.c.name) !== cardKey(d.commander)), { size: formatOf(d).size, commander: S.catalog[cardKey(d.commander)] || null }),
        profile: [["Lands", p.counts.Lands], ["Ramp", p.counts.Ramp], ["Draw", p.counts.Draw], ["Removal", p.counts.Removal], ["Avg cost", p.avg?.toFixed(2) ?? "—"]],
      };
    } else base = mtgConstructedPower(d, S.catalog, cardKey, formatOf(d).size);
    let match = null, ctx;
    const mine = new Map();
    for (const r of d.cards) if (!BASICS.test(r.name)) mine.set(cardKey(r.name), (mine.get(cardKey(r.name)) || 0) + r.qty);
    if (M?.data?.decks?.length) {
      const decks = mtgMetaDecks(M.data);
      match = metaMatch(mine, decks, M.data.archetypes || []);
      if (match) match.extra = match.extra.map((x) => ({ ...x, name: d.cards.find((c) => cardKey(c.name) === x.key)?.name || x.key }));
      ctx = metaContext({ build: base.score, mine, decks, match, loaded: true, archetypes: (M.data.archetypes || []).map((a) => ({ name: a.name, share: a.share })) });
      if(isCommanderLike(d) && (!match || match.sim<.35)) ctx={...ctx,score:base.score,from:'commander'};
      ctx.unplayed = (ctx.unplayed || []).map((x) => ({ ...x, name: d.cards.find((c) => cardKey(c.name) === x.key)?.name || x.key }));
    } else if (isCommanderLike(d)) ctx = { score: base.score, from: "commander" };
    else ctx = metaContext({ build: base.score, mine, loaded: !!M?.data, formatOk: !!mk });
    capCtx(ctx, base.caps);
    return { ...base, engine:engineMap("mtg",d.cards.map(r=>({...r,c:S.catalog[cardKey(r.name)]}))), readiness:powerReadiness("mtg",d,formatOf(d),name=>S.catalog[cardKey(name)]), strategicRisk:strategicRisk("mtg",d.cards.map(r=>({...r,c:S.catalog[cardKey(r.name)]})),M?.data?.decks || [],r=>S.catalog[cardKey(r.name)]), heuristic: base.score, score: ctx.score, from: ctx.from, ctx, match, metaKey: mk, metaLoaded: !!M?.data, metaBusy: !!M?.busy, game: "mtg", formatName: formatOf(d).name };
  });
}

/* ---------- Yu-Gi-Oh! & Pokémon ---------- */

export function tcgPower(g, d, f, cardOf) {
  const M = metaState(g),
    sig = g + "|" + d.id + "|" + d.format + "|" + JSON.stringify(d.zones) + "|" + (M?.at || 0) + "|" + JSON.stringify(Object.values(d.zones || {}).flat().map(r=>cardOf(r.cardId) || null));
  return memo(sig, () => {
    const rows = [];
    for (const zone of ["main", "extra", "side"]) for (const r of d.zones?.[zone] || []) rows.push({ zone, qty: r.qty, c: cardOf(r.cardId), id: r.cardId, name: r.name });
    const base = g === "ygo" ? ygoPower(rows, f) : ptcgPower(rows.filter((r) => r.zone === "main"), f);
    let match = null, mineMap = null, metaDecks = [];
    const data = M?.data;
    if (data?.decks?.length) {
      const mine = new Map(), nameOf = new Map();
      mineMap = mine;
      if (g === "ygo") {
        for (const r of rows.filter(r=>r.zone!=="side")) mine.set(String(r.id), (mine.get(String(r.id)) || 0) + r.qty);
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
    // The field this deck is judged against: Pokémon data is Standard, Yu-Gi-Oh! data is TCG Advanced.
    const formatOk = g === "ptcg" ? (d.format || "standard") === "standard" : (d.format || "tcg") === "tcg";
    const ctx = metaContext({ build: base.score, mine: mineMap || new Map(), decks: formatOk ? metaDecks : [], match: formatOk ? match : null, loaded: !!data, formatOk, archetypes: (data?.archetypes || []).map((a) => ({ name: a.name || a.id, share: a.share })) });
    if (ctx.unplayed) ctx.unplayed = ctx.unplayed.map((x) => ({ ...x, name: g === "ygo" ? cardOf(x.key)?.name || x.key : rows.find((r) => String(r.c?.name || r.name).toLowerCase() === x.key)?.c?.name || x.key, id: g === "ygo" ? x.key : rows.find((r) => String(r.c?.name || r.name).toLowerCase() === x.key)?.id }));
    if (!formatOk) match = null;
    capCtx(ctx, base.caps);
    // Upgrades from lists of the same archetype (only when the match is real).
    let upgrades = null;
    if (match && match.sim >= 0.25 && mineMap) {
      const arch = match.deck.archetype || match.deck.name;
      upgrades = archetypeUpgrades(mineMap, metaDecks.filter((x) => (x.archetype || x.name) === arch));
      upgrades.cuts = upgrades.cuts.map((x) => ({ ...x, name: match.extra.find((e) => e.key === x.key)?.name || (g === "ygo" ? cardOf(x.key)?.name : x.key) || x.key }));
    }
    return { ...base, engine:engineMap(g,rows), readiness:powerReadiness(g,d,f,cardOf), strategicRisk:strategicRisk(g,rows,(data?.decks || []).map(d=>g==='ygo'?{...d,main:[...(d.main || []),...(d.extra || [])].map(id=>({cardId:String(id),name:cardOf(String(id))?.name,qty:1}))}:d),r=>g==='ygo'?cardOf(r.cardId):rows.find(x=>x.c?.name===r.name)?.c), heuristic: base.score, score: ctx.score, from: ctx.from, ctx, match, upgrades, metaKey: formatOk ? g : null, metaLoaded: !!data, metaBusy: !!M?.busy, game: g, formatName: f?.name || d.format };
  });
}

/* ---------- Rendering ---------- */

export const powerChip = (p) => { const c = competitiveScore(p), v = c ?? p.score; return `<span class="power-chip p-${v >= 80 ? "hi" : v >= 60 ? "mid" : "lo"}" title="${c != null ? `Competitive ${c}/100 · engine ${p.heuristic ?? p.score}` : `Deck Power ${p.score}/100 · ${esc(readinessLabel(p))}`}"><em>${v}</em> ${c != null ? "comp." : p.readiness?.provisional ? "provisional" : "power"}</span>`; };

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
      ? `<div class="meta-match"><p class="small">${p.metaBusy ? "Loading tournament results…" : "Compare this list with recent tournament winners to see which archetype it is, how it placed, and what it’s missing."}</p>${loadAct && !p.metaBusy ? `<button class="btn small" ${loadAct} data-autoload-meta="${esc(p.metaKey)}">Compare with tournament decks</button>` : ""}</div>`
      : "";
  // Where this list stands in the field it would actually face.
  const c = p.ctx || {},
    field = c.field?.length ? `<p class="small"><b>Decks to beat:</b> ${c.field.map((a) => `${esc(a.name)}${a.share ? ` <span class="muted">${pct(a.share)}</span>` : ""}`).join(" · ")}</p>` : "",
    unplayed = c.unplayed?.length ? `<p class="small"><b>Not in any placing list:</b> ${c.unplayed.slice(0, 10).map((x) => `<button class="link small" ${cardAct(x)}>${esc(x.name)}${x.qty > 1 ? ` ×${x.qty}` : ""}</button>`).join(", ")}</p>` : "";
  const fieldBox =
    c.from === "build" && c.reason === "format"
      ? `<div class="pw-field warn"><b>No tournament results for ${esc(p.formatName || "this format")}</b><p class="small">There's no placing-deck data for this format, so the rating measures the deck’s own engine. Missing tournament coverage does not deduct points. Matchup performance remains unverified.</p></div>`
      : c.from === "build"
        ? `<div class="pw-field"><b>Not compared with the field yet</b><p class="small">${p.metaBusy ? "Loading tournament results…" : `The engine estimate uses this deck’s cards. Tournament evidence is separate; its absence does not deduct points.`}</p></div>`
        : c.from === "rogue"
          ? `<div class="pw-field warn"><b>Off-meta list</b><p class="small">No deck that placed in the last ${c.lists} tournament lists shares at least a third of these cards. ${Math.round((c.played || 0) * 100)}% of your cards see tournament play at all. This is an unproven strategy in this sample, not evidence that it is weak. The engine estimate stays independent of card popularity.</p>${unplayed}${field}</div>`
          : c.from === "commander"
            ? ""
            : `<div class="pw-field ok"><b>Proven archetype</b><p class="small">${Math.round((c.played || 0) * 100)}% of your cards appear in placing lists. The rating leans on how this archetype actually performs.</p>${unplayed}${field}</div>`;
  const R = review(p.parts);
  const _ = 0,
    pts = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, ""),
    pctx = (x) => Math.round(x * 100) + "%",
    cardList = (x) => (x.cards?.length ? `<p class="pw-cards">${x.cards.map((c) => `<button class="link small" ${cardAct(c)}>${esc(c.name)}${c.qty > 1 ? ` ×${c.qty}` : ""}</button>`).join(", ")}</p>` : ""),
    top = p.from === "meta" && isCommanderLike({format:p.formatName}) ? null : R.weak[0];
  const weak = R.weak.length
    ? R.weak
        .map((x) => `<div class="pw-issue ${x.lost >= 6 ? "major" : x.lost >= 3 ? "mid" : ""}"><div class="pw-issue-top"><b>${esc(x.label)}</b><span class="pw-lost">−${pts(x.lost)} pts</span></div><p>${esc(x.why || x.hint)}</p><p class="pw-have muted small">Now <b>${esc(String(x.count))}</b> · aim for <b>${esc(String(x.target))}</b></p>${cardList(x)}${x.fix && findAct && x.fix.length < 14 ? `<button class="btn ghost small" ${findAct(x)}>Find ${esc(x.fix.toLowerCase())} cards</button>` : x.fix && x.fix.length >= 14 ? `<p class="pw-fix small">${esc(x.fix)}</p>` : ""}</div>`)
        .join("")
    : `<p class="small ok-text">No weaknesses detected by the supported checks. Review engine interactions and matchup tests next.</p>`;
  const sims = p.sims?.length
    ? `<section class="panel pw-sims"><div class="row between"><h3>3,000 shuffles of this list</h3><span class="muted small">same list, same numbers</span></div><p class="muted small">Opening-hand probabilities use your listed quantities. Role and playability checks infer card behavior; unsupported rules and opponent responses can change the result.</p>${p.sims
        .map((x) => {
          const ok = x.lower ? x.p <= x.target : x.p >= x.target,
            close = x.lower ? x.p <= x.target * 1.6 : x.p >= x.target * 0.85;
          return `<div class="pw-sim ${ok ? "ok" : close ? "near" : "bad"}"><div class="row between"><span>${esc(x.label)}${x.note ? `<small class="muted"> · ${esc(x.note)}</small>` : ""}</span><b>${pctx(x.p)}</b></div><div class="pw-track"><span class="pw-fill" style="width:${Math.min(100, x.p * 100)}%"></span><i class="pw-goal" style="left:${Math.min(100, x.target * 100)}%" title="Target ${pctx(x.target)}"></i></div><small class="muted">${x.lower ? "Aim for under" : "Aim for"} ${pctx(x.target)}</small></div>`;
        })
        .join("")}</section>`
    : "";
  const g = p.goldfish,
    pc = (x) => Math.round(x * 100) + "%",
    gold = g
      ? `<section class="panel pw-gold"><div class="row between"><h3>Played out ${g.runs.toLocaleString()} times</h3><span class="muted small">goldfish · no opponent</span></div>
      <p class="pw-gold-head">${esc(g.headline)}</p>
      ${g.turnDist ? `<div class="pw-turns" role="img" aria-label="${esc(g.turnDist.label)}">${g.turnDist.d.map((x, i) => `<div class="pw-turn"><i class="pw-bar" style="height:${Math.round(Math.max(3, (x / Math.max(...g.turnDist.d)) * 86))}px"></i><small>${i === g.turnDist.maxT ? "later" : "T" + (i + 1)}</small><em>${x >= 0.01 ? pc(x) : ""}</em></div>`).join("")}</div><p class="muted small center">${esc(g.turnDist.label)}</p>` : ""}
      ${g.outcomes ? `<div class="pw-outcomes">${g.outcomes.map((o) => `<div class="pw-out ${o.kind}"><div class="row between"><span>${esc(o.label)}</span><b>${pc(o.p)}</b></div><div class="pw-track"><span class="pw-fill" style="width:${o.p * 100}%"></span></div></div>`).join("")}</div>` : ""}
      <div class="pw-gmetrics">${g.metrics.map((m) => { const v = m.pct ? pc(m.value) : m.value.toFixed(1), ok = m.bad ? m.value <= m.good : m.value >= m.good; return `<span class="${ok ? "ok" : "bad"}"><b>${v}</b>${esc(m.label)}${m.note ? `<small> ${esc(m.note)}</small>` : ""}</span>`; }).join("")}</div>
      <div class="pw-plan"><p><b>How it wins</b>${esc(g.winCon)}</p><p><b>Late game</b>${esc(g.endgame)}</p></div>
      ${g.samples.map((x, i) => `<details class="pw-sample" ${i === 0 ? "open" : ""}><summary>${esc(x.title)}</summary>${x.hand ? `<p class="pw-hand">${x.hand.map((n) => `<span>${esc(n)}</span>`).join("")}</p>` : ""}<ol>${x.log.map((l) => `<li><b>${g.game === "ygo" ? "" : "T" + l.t}</b>${esc(l.text)}${l.total != null && l.total ? `<small> · ${l.total} total</small>` : ""}</li>`).join("")}</ol></details>`).join("")}
      <p class="foot">Solitaire approximation: generic plays and combat, without an opponent. It does not resolve every card ability, stack interaction or infinite combo, so it is not a cEDH win-turn forecast.</p></section>`
      : "";
  const profile = p.profile?.length ? `<div class="pw-profile">${p.profile.map(([k, v]) => `<span><b>${esc(String(v))}</b>${esc(k)}</span>`).join("")}</div>` : "";
  // Two numbers, never one in a vacuum: Engine (how well the list is built for its own plan) and
  // Competitive (how it stacks up against what's winning). The ring leads with Competitive when
  // tournament data exists.
  const comp = competitiveScore(p),
    eng = p.heuristic ?? p.score,
    tier = competitiveTier(comp),
    lead = comp ?? p.score;
  return `<section class="panel score-panel power">${ring(lead)}<div><p class="eyebrow">${comp != null ? "Deck Power · competitive" : p.from === "commander" ? "Deck Power · Commander build" : "Deck Power · engine estimate"}</p><h2>${p.from === "commander" ? "Commander build check" : comp != null ? esc(tier.label) : esc(readinessLabel(p))}</h2><p class="small"><b>${esc(p.plan)}</b></p><p class="muted small">${esc(p.lens)}</p>${p.caps?.length ? `<p class="pw-headline small">Fix first: <b>${esc(p.caps[0].label)}</b> (holds the score to ${p.caps[0].max})</p>` : top ? `<p class="pw-headline small">Biggest gain: <b>${esc(top.label)}</b> (+${pts(top.lost)} pts available)</p>` : ""}</div>
  <div class="pw-dual"><span class="${comp == null ? "dim" : tier.tone}"><b>${comp ?? "—"}</b>Competitive<small>${comp == null ? "needs tournament data" : "vs. what's winning now"}</small></span><span><b>${eng}</b>Engine<small>how well it's built for its plan</small></span></div>${profile}</section>
  ${p.caps?.length ? `<section class="panel pw-caps"><h3>What holds this deck back</h3><p class="muted small">Problems no amount of good cards elsewhere makes up for. Each one caps the score until it's fixed.</p>${p.caps.map((c) => `<div class="pw-cap"><div class="row between"><b>${esc(c.label)}</b><span class="chip warn">max ${c.max}</span></div><p>${esc(c.why || "")}</p></div>`).join("")}</section>` : ""}
  ${scoutingReport(p)}
  ${engineMapPanel(p.engine)}
  ${p.readiness?.provisional?`<section class="panel issues-panel"><h3>Resolve before treating this as competitive</h3>${p.readiness.unknown?`<p>${p.readiness.unknown} card copies still need their details loaded.</p>`:""}<ul>${p.readiness.issues.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><p class="foot">The displayed score is a comparison, not evidence that an incomplete or illegal list is tournament ready.</p></section>`:""}
  ${p.from === "meta" ? '<details class="panel"><summary>Optional generic build checks</summary>' : ""}<section class="panel pw-weak"><div class="row between"><h3>${p.from === "meta" ? "Build-model cautions" : "Build-health checks"}</h3><span class="muted small">${R.weak.length ? `${R.weak.length} found, biggest first` : "none"}</span></div>${p.from === "meta" ? '<p class="foot">These generic role targets are advisory. They do not override the placing list’s tournament evidence or prove that its engine is weak.</p>' : ""}${weak}</section>
  ${p.from === "meta" ? "</details>" : ""}
  ${R.strong.length ? `<section class="panel pw-strong"><h3>Strengths</h3><div class="pw-chips">${R.strong.map((x) => `<span class="pw-chip"><b>${esc(x.label)}</b> ${esc(String(x.count))}</span>`).join("")}</div></section>` : ""}
  ${isCommanderLike({format:p.formatName}) ? '<details class="panel"><summary>Generic simulations · partial ability model</summary><p class="foot">Land-only hand targets and combat approximations do not model a cEDH combo engine. Use them as diagnostics, not mulligan instructions or predicted wins.</p>' : ""}${sims}
  ${gold}${isCommanderLike({format:p.formatName}) ? "</details>" : ""}
  ${riskPanel(p.strategicRisk)}
  ${fieldBox || metaBox ? `<section class="panel"><h3>Against the meta</h3>${fieldBox}${metaBox}</section>` : ""}
  <section class="panel"><div class="row between"><h3>Score breakdown</h3><span class="muted small">build ${p.heuristic}/100</span></div><p class="muted small">How well the list is built, before the field is considered. Each ingredient is worth a share of 100 points, weighted by how much it decides games in this format. ${p.heuristic !== p.score ? `Deck Power is <b>${p.score}</b> after weighing it against the meta (above).` : ""}</p>${R.scored
    .map((x) => {
      const low = x.ratio < 0.75;
      return `<details class="ingredient"><summary><div class="row between"><span><b>${esc(x.label)}</b> <span class="muted small">${esc(String(x.count))} / ${esc(String(x.target))}</span></span><span class="${low ? "warn-text" : ""}"><b>${pts(x.earned)}</b><span class="muted">/${pts(x.max)}</span></span></div>${bar(x.ratio, low ? "warn" : "good")}</summary><p class="small muted">${esc(x.hint)}</p>${cardList(x) || `<p class="small muted">No cards counted here.</p>`}</details>`;
    })
    .join("")}</section>`;
}

// The one Deck Power number shown everywhere (tiles, deck headers, builder): Competitive when the
// field is known, otherwise the engine estimate. The Power tab shows both.
export const shownPower = (p) => competitiveScore(p) ?? p?.score;
