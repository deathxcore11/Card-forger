import {engineMap,engineMapPanel} from './engine-map.js';
import {strategicRisk,riskPanel} from "./strategy-risk.js";
// Connects Deck Power (deckpower.js) to the app: picks the right lens for each game and
// format, matches the list against cached tournament results, and renders the panel/badges.
import { S } from "./store.js";
import { ygoSource } from './ygo.js';
import { ptcgSource } from './ptcg.js';
import { legalityIn,canLead } from './formats.js';

export function powerReadiness(game,deck,format,cardOf) {
 const rows=game==='mtg'?deck.cards || []:Object.entries(deck.zones || {}).flatMap(([zone,rs])=>rs.map(r=>({...r,zone})));
 const all=game==='mtg'?[...rows,...(deck.side||[])]:rows,unknown=all.filter(r=>!cardOf(game==='mtg'?r.name:r.cardId)).reduce((n,r)=>n+r.qty,0),total=all.reduce((n,r)=>n+r.qty,0),issues=[];
 if(game==='mtg'){
  const total=rows.reduce((n,r)=>n+r.qty,0),byName=new Map();
  const configuration=commanderConfiguration(deck,cardOf,format),{cards:leaderCards,identity}=configuration;if(format.commander)issues.push(...configuration.issues);
  if(total<format.size || (format.exact && total!==format.size))issues.push(`${total}/${format.size} cards`);
  for(const r of rows){const c=cardOf(r.name);if(!c)continue;const k=cardKey(r.name);byName.set(k,(byName.get(k)||0)+r.qty);
   if(format.id==='paupercommander'&&cardKey(r.name)===cardKey(deck.commander)){if(!canLead(c,format))issues.push('Commander eligibility needs verification');}
   else if(format.legality && !['legal','restricted'].includes(legalityIn(c,format)))issues.push(`${r.name} is not legal in ${format.name}`);
   if(format.commander && deck.commander && !inCommandZone(deck,r.name)){if(configuration.identityKnown && (c.color_identity || []).some(x=>!identity.includes(x)))issues.push(`${r.name} is outside the commander’s color identity`);}
  }
  for(const [k,n] of byName){const c=cardOf(k);if(c&&n>effectiveCopyLimit(c,format))issues.push(`${n} copies of ${c.name}`);}
  if(format.commander&&!deck.commander)issues.push('Choose a commander');
  // The sideboard follows the same rules check as the deck page: 15 cards, legal, and copies
  // counted with the main deck.
  const sideN=(deck.side||[]).reduce((n,r)=>n+r.qty,0);
  if(sideN>15)issues.push(`Sideboard has ${sideN} cards (limit 15)`);
  const sideBy=new Map();for(const r of deck.side||[]){const k=cardKey(r.name);sideBy.set(k,{name:r.name,qty:(sideBy.get(k)?.qty||0)+r.qty});}
  for(const [k,r] of sideBy){const c=cardOf(r.name);if(!c)continue;const n=(byName.get(k)||0)+r.qty,limit=effectiveCopyLimit(c,format);
   if(format.id==='paupercommander'&&cardKey(r.name)===cardKey(deck.commander)){if(!canLead(c,format))issues.push('Commander eligibility needs verification');}
   else if(format.legality && !['legal','restricted'].includes(legalityIn(c,format)))issues.push(`${r.name} (sideboard) is not legal in ${format.name}`);
   if(!/^Basic(?: Snow)? Land/.test(c.type_line||'')&&!/any number of cards named/i.test(c.oracle_text||'')&&n>limit&&(byName.get(k)||0)<=limit)issues.push(`${n} copies of ${c.name} across main deck and sideboard`);}
 }else issues.push(...(game==='ygo'?ygoSource:ptcgSource).validate(deck,cardOf,format).filter(x=>x.level==='bad'||x.level==='pending').map(x=>x.text));
 const mainTotal=game==='mtg'?rows.reduce((n,r)=>n+r.qty,0):(deck.zones?.main||[]).reduce((n,r)=>n+r.qty,0),minimum=game==='mtg'?format.size:game==='ygo'?(Array.isArray(format?.main)?format.main[0]:40):60,incomplete=mainTotal<minimum,missingCards=Math.max(0,minimum-mainTotal),provisional=unknown>0||issues.length>0||incomplete;
 return {unknown,total,mainTotal,minimum,incomplete,missingCards,eligible:!provisional,issues:[...new Set(issues)],provisional};
}
const readinessLabel=p=>p.readiness?.provisional?'Provisional · resolve deck checks':p.from==='meta'?powerGrade(p.score,p.from):p.score>=85?'Strong engine estimate':p.score>=68?'Solid engine estimate':p.score>=50?'Developing engine':'Engine needs work';

import { esc, ring, bar, pct } from "./ui.js";
import { review } from "./deckaudit.js";
import { scoutingReport, competitiveScore, competitiveTier, verdictTier } from "./scouting.js";
import { mtgGoldfish } from "./goldfish.js";
import { cardKey, effectiveCopyLimit, inCommandZone, rulesText, commanderConfiguration } from "./core.js";
import { mtgTagsReady } from "./mtg-tags.js";
import { engineProfile, engineRoles } from "./insights.js";
import { commanderCriteria } from "./commander-criteria.js";
import { commanderStrategicEstimate, mtgStrategicEstimate } from "./commander-strategy.js";
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
// Eligibility comes first: a deck that isn't tournament-legal (wrong size, too many copies, banned
// or illegal cards) can't be called competitive, however close it is to a winning list.
const LEGAL_CAP = 55;
// Unresolved cards (details not loaded or not found) can't be judged: any of them blocks a
// confident verdict, and the larger the unknown share, the lower the ceiling.
function dataCap(readiness) {
  const u = readiness?.unknown || 0, share = u / Math.max(1, readiness?.total || 0);
  if (!u) return null;
  return { key: "Data", max: share >= 0.25 ? 45 : share >= 0.1 ? 60 : 74, label: "Card details not loaded", why: `${u} card${u === 1 ? "" : "s"} in this list ${u === 1 ? "has" : "have"} no card details yet (still loading, or the name isn't recognised). The score only counts what it can read, so it can't be trusted until ${u === 1 ? "it resolves" : "they resolve"}.` };
}
function legalGate(base, readiness) {
  const data = dataCap(readiness);
  if (data) base = { ...base, caps: [data, ...(base.caps || [])].sort((a, b) => a.max - b.max) };
  if (!readiness?.issues?.length) return base;
  const cap = { key: "Legal", max: LEGAL_CAP, label: "Not tournament-legal yet", why: `${readiness.issues.slice(0, 3).join("; ")}${readiness.issues.length > 3 ? `; and ${readiness.issues.length - 3} more` : ""}. Fix this before the deck can be judged against the field.` };
  return { ...base, caps: [cap, ...(base.caps || [])].sort((a, b) => a.max - b.max) };
}
// Tournament frequency is comparison evidence, not proof of a broken dependency.
// Keep differences visible without manufacturing a functional hard cap from names.
const coreCap = (base, ctx) => {
  const gone = ctx?.coreMissing || [], few = ctx?.coreShort || [];
  if (!gone.length && !few.length) return base;
  const parts = [...gone.map((x) => `${x.qty}× ${x.name} (this deck has none)`), ...few.map((x) => `${x.qty}× ${x.name} (this deck has ${x.have})`)];
  return { ...base, referenceDifference: `Common reference-list differences: ${parts.join(", ")}. These reduce how confidently the reference results transfer to this list. Frequency alone does not establish a missing function; check replacements and the engine analysis.` };
};
function capCtx(ctx, caps) {
  const max = caps?.[0]?.max;
  if (max == null || !ctx) return;
  if (ctx.score != null) ctx.score = Math.min(ctx.score, max);
  if (ctx.fieldEstimate != null) ctx.fieldEstimate = Math.min(ctx.fieldEstimate, max);
}

// Gameplay-only cache keys: artwork, quotes and presentation changes must not
// rerun shuffles/strategy on ordinary browsing. Rule/legality/sideboard changes do.
const powerCardEvidence=c=>c?Object.fromEntries(['name','oracle_text','type_line','mana_cost','cmc','power','toughness','loyalty','defense','colors','color_identity','produced_mana','keywords','legalities','pdhCommander','layout','rarity','game_changer'].map(k=>[k,c[k]]).concat([['card_faces',c.card_faces?.map(powerCardEvidence)]])):null;
const powerRows=rows=>(rows||[]).map(r=>[cardKey(r.name),r.qty]).sort((a,b)=>a[0].localeCompare(b[0]));
export function mtgPower(d) {
  const mk = mtgMetaKey(d),
    M = mk ? metaState(mk) : null,
    sig = d.id + "|" + d.format + "|" + JSON.stringify([d.commander,d.commanders,d.goal,d.requestedStyle,powerRows(d.cards),powerRows(d.side)]) + "|" + (M?.at || 0) + "|" + mtgTagsReady() + "|" + JSON.stringify([...d.cards,...(d.side||[])].map(r=>[cardKey(r.name),powerCardEvidence(S.catalog[cardKey(r.name)])]).sort((a,b)=>a[0].localeCompare(b[0])));
  return memo(sig, () => {
    let base;
    if (isCommanderLike(d)) {
      const p = engineProfile(d, S.catalog);
      const hands = mtgConstructedPower(d, S.catalog, cardKey, formatOf(d).size),
        why = {
          Lands: `${p.counts.Lands} lands. This curve/resource heuristic suggests about ${p.parts.find((x) => x.key === "Lands")?.target ?? 36}; actual mulligans and color demands remain separate.`,
          Ramp: `${p.counts.Ramp} acceleration-tagged copies, about ${p.criteria?.resources.effectiveRamp ?? p.counts.Ramp} effective heuristic units after recognized costs/conditions. Filtering is separate; no universal maximum ramp count.`,
          Draw: `${p.counts.Draw} raw draw-tagged copies, about ${p.criteria?.resources.draw.effective ?? p.counts.Draw} effective heuristic units. Cantrips, paid activation and prerequisites are not treated as unconditional full engines.`,
          Removal: `${p.counts.Removal} targeted answers. The table's best threat needs an answer from you too.`,
          Wipe: `${p.counts.Wipe} board wipes. Two or three reset a board you've fallen behind on.`,
          Protection: `${p.counts.Protection} protection pieces for your commander and key permanents.`,
          Curve: `Average cost ${p.avg?.toFixed(2) ?? "—"}. Above 3.0, the early turns are slow.`,
        };
      // Commander keeps its own engine check, plus the deal-breakers every Magic deck is held to
      // (can't cast its spells, no way to win, filler creatures) and critical mass for tribal,
      // spells and artifact commanders. Off-plan cards aren't judged: wipes and life gain are
      // normal in a four-player game.
      const strategic = commanderStrategicEstimate(d,S.catalog,p.criteria,{roles:engineRoles});
      const caps = (hands.caps || []).filter((c) => !["Plan","Critical"].includes(c.key)),
        crit = null, // Constructed tribal minimums do not establish a Commander plan.
        cmdScore = strategic.score,
        capped = cmdScore == null ? null : Math.min(cmdScore, caps[0]?.max ?? 100);
      base = {
        score: capped,
        criteria: p.criteria,
        strategic,
        structuralScore: p.score,
        scoreKind: p.scoreKind,
        caps: caps.filter((c) => c.max < cmdScore),
        parts: [...(crit ? [{ ...crit, weight: Math.round(p.parts.reduce((a, x) => a + (x.weight || 0), 0) * 0.136) }] : []), ...p.parts].map((x) => x.key === "Critical" ? x : ({ ...x, fix: ["Ramp", "Draw", "Removal", "Wipe", "Protection", "Synergy"].includes(x.key) ? x.key : "", why: why[x.key] || (x.key === "Synergy" ? `${x.count} cards support your commander's plan; about ${x.target} makes it come together.` : ""), cards: (p.byRole?.[x.key] || []).map((name) => ({ name, qty: 1 })) })),
        plan: /kinnan, bonder prodigy/i.test(d.commander || "") ? "Nonland mana engine · activated-ability combo" : p.archetype,
        lens: "Commander lens: structural resources and roles, separate recognized plan support, and explicit limits. Strategic estimate is provisional and uncalibrated, not a measured multiplayer ranking or win rate.",
        unknown: p.unknown,
        sims: hands.sims,
        simulationLibrary: hands.simulationLibrary,
        roles: hands.roles,
        goldfish: mtgGoldfish((d.cards || []).map((r) => ({ qty: r.qty, c: S.catalog[cardKey(r.name)] })).filter((r) => r.c && !inCommandZone(d,r.c.name)), { size: formatOf(d).size, commander: S.catalog[cardKey(d.commander)] || null }),
        profile: [["Lands", p.counts.Lands], ["Effective ramp", p.criteria?.resources.effectiveRamp ?? p.counts.Ramp], ["Effective draw", p.criteria?.resources.draw.effective ?? p.counts.Draw], ["Plan-linked copies", p.criteria?.plan.supportedCopies ?? "—"], ["Avg cost", p.avg?.toFixed(2) ?? "—"]],
      };
    } else {
      const structural=mtgConstructedPower(d,S.catalog,cardKey,formatOf(d).size),resources=commanderCriteria(d,S.catalog,{roles:engineRoles}),strategic=mtgStrategicEstimate(d,S.catalog,resources,{roles:engineRoles,cardEvidence:structural.constructedCriteria?.cards||[]});
      base={...structural,structuralScore:structural.score,strategic,resourceEvidence:resources.resources,score:strategic.score,scoreKind:'strategic-heuristic'};
    }
    let match = null, ctx;
    const mine = new Map();
    for (const r of d.cards) if (!BASICS.test(r.name)) mine.set(cardKey(r.name), (mine.get(cardKey(r.name)) || 0) + r.qty);
    if (M?.data?.decks?.length) {
      const decks = mtgMetaDecks(M.data);
      match = metaMatch(mine, decks, M.data.archetypes || []);
      if (match) match.extra = match.extra.map((x) => ({ ...x, name: d.cards.find((c) => cardKey(c.name) === x.key)?.name || x.key }));
      ctx = metaContext({ build: match?.sim>=.35 ? (base.structuralScore ?? base.score) : base.score, mine, decks, match, loaded: true, archetypes: (M.data.archetypes || []).map((a) => ({ name: a.name, share: a.share })) });
      if(isCommanderLike(d) && (!match || match.sim<.35)) ctx={...ctx,score:base.score,from:'commander'};
      ctx.unplayed = (ctx.unplayed || []).map((x) => ({ ...x, name: d.cards.find((c) => cardKey(c.name) === x.key)?.name || x.key }));
    } else if (isCommanderLike(d)) ctx = { score: base.score, from: "commander" };
    else ctx = metaContext({ build: base.score, mine, loaded: !!M?.data, formatOk: !!mk });
    const readiness = powerReadiness("mtg",d,formatOf(d),name=>S.catalog[cardKey(name)]);
    base = legalGate(base, readiness);
    // Legal, but every card past the minimum makes your best cards show up less often.
    const fmt = formatOf(d), over = d.cards.reduce((n, r) => n + r.qty, 0) - fmt.size;
    if (!fmt.exact && !fmt.commander && over > 3) base = { ...base, caps: [...(base.caps || []), { key: "Size", max: Math.max(50, 90 - over * 2.5), label: `${over} cards over the minimum`, why: `Tournament decks play exactly ${fmt.size}: each extra card makes your best cards ${Math.round((1 - fmt.size / (fmt.size + over)) * 100)}% less likely to show up. Cut back to ${fmt.size}.` }].sort((a, b) => a.max - b.max) };
    capCtx(ctx, base.caps);
    base = coreCap(base, ctx);
    if(readiness.provisional){ctx.score=null;ctx.fieldEstimate=null;}
    return { ...base, goal:d.goal || null, assessmentAxes:base.criteria?{legality:{status:readiness.provisional?"unresolved":"passes-loaded-checks",issues:readiness.issues},structure:base.criteria.structure,plan:base.criteria.plan,coverage:base.criteria.coverage,competitive:{score:competitiveScore({ctx,readiness,game:"mtg",strategic:base.strategic}),basis:ctx.from}}:base.strategic?{legality:{status:readiness.provisional?"unresolved":"passes-loaded-checks",issues:readiness.issues},structure:{score:base.structuralScore,label:"Structure"},plan:{status:base.strategic.status,routes:base.strategic.routes},coverage:base.strategic.coverage,competitive:{score:competitiveScore({ctx,readiness,game:"mtg",strategic:base.strategic}),basis:ctx.from}}:null, engine:engineMap("mtg",d.cards.map(r=>({...r,c:S.catalog[cardKey(r.name)]})),{commanders:[d.commander,...(d.commanders||[])].filter(Boolean)}), readiness, strategicRisk:strategicRisk("mtg",d.cards.map(r=>({...r,c:S.catalog[cardKey(r.name)]})),M?.data?.decks || [],r=>S.catalog[cardKey(r.name)]), heuristic: base.structuralScore ?? base.score, score: readiness.provisional ? null : ctx.score, from: ctx.from, ctx, match, metaKey: mk, metaLoaded: !!M?.data, metaBusy: !!M?.busy, game: "mtg", formatName: formatOf(d).name };
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
            // Only Basic Energy is left out of the comparison (as on your side); Special Energy counts.
            if (r.kind === "Energy" && /^(?:basic )?(?:\{\w\}|grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$/i.test(r.name)) continue;
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
    const readiness = powerReadiness(g, d, f, cardOf);
    let gated = legalGate(base, readiness);
    capCtx(ctx, gated.caps);
    gated = coreCap(gated, ctx);
    if(readiness.provisional){ctx.score=null;ctx.fieldEstimate=null;}
    // Upgrades from lists of the same archetype (only when the match is real).
    let upgrades = null;
    if (match && match.sim >= 0.25 && mineMap) {
      const arch = match.deck.archetype || match.deck.name;
      upgrades = archetypeUpgrades(mineMap, metaDecks.filter((x) => (x.archetype || x.name) === arch));
      upgrades.cuts = upgrades.cuts.map((x) => ({ ...x, name: match.extra.find((e) => e.key === x.key)?.name || (g === "ygo" ? cardOf(x.key)?.name : x.key) || x.key }));
    }
    return { ...gated, engine:engineMap(g,rows), readiness, strategicRisk:strategicRisk(g,rows,(data?.decks || []).map(d=>g==='ygo'?{...d,main:[...(d.main || []),...(d.extra || [])].map(id=>({cardId:String(id),name:cardOf(String(id))?.name,qty:1}))}:d),r=>g==='ygo'?cardOf(r.cardId):rows.find(x=>x.c?.name===r.name)?.c), heuristic: base.score, score: readiness.provisional ? null : ctx.score, from: ctx.from, ctx, match, upgrades, metaKey: formatOk ? g : null, metaLoaded: !!data, metaBusy: !!M?.busy, game: g, formatName: f?.name || d.format };
  });
}

/* ---------- Rendering ---------- */

export function powerEligibility(p) {
 if(p?.readiness?.provisional || p?.readiness?.eligible===false)return {eligible:false,reason:p?.readiness?.incomplete?`Incomplete deck: ${p.readiness.missingCards} cards missing`:"Resolve legality and card-data checks first"};
 if(p?.strategic && p.strategic.score==null && competitiveScore(p)==null)return {eligible:false,reason:"Strategic route is not mapped by this model"};
 return {eligible:p?.score!=null,reason:p?.score==null?"Power estimate unavailable":""};
}
export const powerChip = (p) => {
 const eligibility=powerEligibility(p),c=competitiveScore(p),v=shownPower(p);
 if(!eligibility.eligible)return `<span class="power-chip p-mid" title="${esc(eligibility.reason)}"><em>—</em> ${p?.readiness?.incomplete?"incomplete":"unavailable"}</span>`;
 return `<span class="power-chip p-${v>=80?"hi":v>=60?"mid":"lo"}" title="${esc(c!=null?`Competitive reference ${c}/100`:`Power estimate ${v}/100 · ${p.strategic?.confidence||"heuristic"} evidence; not win odds`)}"><em>${v}</em> ${c!=null?"comp.":p.strategic?"estimate":"power"}</span>`;
};

export function powerPanel(p, { loadAct = "", findAct = "", cardAct = () => "" } = {}) {
  const m = p.match,
    strong = m && m.sim >= 0.35;
  const metaBox = m
    ? `<div class="meta-match ${strong ? "hit" : ""}">
        <div class="row between"><b>${strong ? "Matches" : "Closest tournament deck"}: ${esc(m.archetype)}</b><span class="chip ${m.sim >= 0.7 ? "ok" : ""}">${Math.round(m.sim * 100)}% same cards</span></div>
        <p class="small muted">${m.lists} placing list${m.lists === 1 ? "" : "s"} · ${pct(m.share)} of the field · best finish <b>${placeText(m.bestRank)}</b>${m.deck.event ? ` · e.g. ${esc(m.deck.event)}${m.deck.place ? " (" + esc(m.deck.place) + ")" : ""}` : ""}${m.deck.url ? ` · <a href="${esc(m.deck.url)}" target="_blank" rel="noopener">list ↗</a>` : ""}</p>
        ${strong && m.missing.length ? `<p class="small"><b>Their list plays, yours doesn’t:</b> ${m.missing.slice(0, 8).map((x) => `<button class="link small" ${cardAct(x)}>${x.qty}× ${esc(x.name)}</button>`).join(", ")}</p>` : ""}
        ${strong && m.extra.length ? `<p class="small"><b>Yours only:</b> ${m.extra.slice(0, 8).map((x) => `${x.qty}× ${esc(x.name)}`).join(", ")}</p>` : ""}
        ${p.referenceDifference ? `<p class="small warn-text">${esc(p.referenceDifference)}</p>` : ""}
        ${m.weight > 0 ? `<p class="foot">Because your list is ${Math.round(m.sim * 100)}% the same as proven placing decks, the rating leans on that tournament evidence (build check alone: ${p.heuristic}). This is a reference-based estimate, not a measured win rate for this exact list.</p>` : `<p class="foot">Not close enough to any placing list to use tournament results; this rating is the build check only.</p>`}
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
    ? `<section class="panel pw-sims"><div class="row between"><h3>3,000 shuffles of this list</h3><span class="muted small">same list, same numbers</span></div><p class="muted small">Opening-hand probabilities use ${p.simulationLibrary ?? p.engine?.library ?? "your listed"} library cards, excluding identified command-zone cards. Role and playability checks infer card behavior; unsupported rules and opponent responses can change the result.</p>${p.sims
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
      ? `<section class="panel pw-gold"><div class="row between"><h3>${g.runs.toLocaleString()} simplified solitaire trials</h3><span class="muted small">goldfish · no opponent</span></div>
      <p class="pw-gold-head">${esc(g.headline)}</p>
      ${g.turnDist ? `<div class="pw-turns" role="img" aria-label="${esc(g.turnDist.label)}">${g.turnDist.d.map((x, i) => `<div class="pw-turn"><i class="pw-bar" style="height:${Math.round(Math.max(3, (x / Math.max(...g.turnDist.d)) * 86))}px"></i><small>${i === g.turnDist.maxT ? "later" : "T" + (i + 1)}</small><em>${x >= 0.01 ? pc(x) : ""}</em></div>`).join("")}</div><p class="muted small center">${esc(g.turnDist.label)}</p>` : ""}
      ${g.outcomes ? `<div class="pw-outcomes">${g.outcomes.map((o) => `<div class="pw-out ${o.kind}"><div class="row between"><span>${esc(o.label)}</span><b>${pc(o.p)}</b></div><div class="pw-track"><span class="pw-fill" style="width:${o.p * 100}%"></span></div></div>`).join("")}</div>` : ""}
      <div class="pw-gmetrics">${g.metrics.map((m) => { const v = m.pct ? pc(m.value) : m.value.toFixed(1), ok = m.bad ? m.value <= m.good : m.value >= m.good; return `<span class="${ok ? "ok" : "bad"}"><b>${v}</b>${esc(m.label)}${m.note ? `<small> ${esc(m.note)}</small>` : ""}</span>`; }).join("")}</div>
      <div class="pw-plan"><p><b>Modeled output</b>${esc(g.winCon)}</p><p><b>Late game</b>${esc(g.endgame)}</p></div>
      ${g.samples.map((x, i) => `<details class="pw-sample" ${i === 0 ? "open" : ""}><summary>${esc(x.title)}</summary>${x.hand ? `<p class="pw-hand">${x.hand.map((n) => `<span>${esc(n)}</span>`).join("")}</p>` : ""}<ol>${x.log.map((l) => `<li><b>${g.game === "ygo" ? "" : "T" + l.t}</b>${esc(l.text)}${l.total != null && l.total ? `<small> · ${l.total} total</small>` : ""}</li>`).join("")}</ol></details>`).join("")}
      <p class="foot">${g.limitations?.length ? esc(g.limitations.join(" ")) + " " : ""}Solitaire approximation: generic plays and combat, without an opponent. It does not resolve every card ability, stack interaction or infinite combo, so it is not a cEDH win-turn forecast.</p></section>`
      : "";
  const profile = p.profile?.length ? `<div class="pw-profile">${p.profile.map(([k, v]) => `<span><b>${esc(String(v))}</b>${esc(k)}</span>`).join("")}</div>` : "";
  // Two numbers, never one in a vacuum: Engine (how well the list is built for its own plan) and
  // Competitive (how it stacks up against what's winning). The ring leads with Competitive when
  // tournament data exists.
  const comp = competitiveScore(p),
    eng = p.heuristic ?? p.score,
    tier = verdictTier(p, comp),
    lead = comp ?? p.score,
    criteria = p.criteria,
    eligibility = powerEligibility(p),
    strategic = p.strategic,
    planNotice = criteria ? `<div class="pw-plan-context"><div class="pw-chips"><span class="chip ${criteria.plan.status === "supported" ? "" : "warn"}">${esc(criteria.plan.label)}</span><span class="chip">${criteria.coverage.known}/${criteria.coverage.total} card copies known · mechanics ${esc(criteria.coverage.status)}</span></div><p class="small muted">${criteria.plan.supportedCopies} of ${criteria.plan.eligibleCopies} nonland library copies have recognized plan links. This is evidence coverage, not a required quota or validated winning route.</p>${[...criteria.plan.warnings,...criteria.resources.warnings].map(w=>`<p class="small">${esc(w)}</p>`).join("")}</div>` : "";
  return `<section class="panel score-panel power">${!eligibility.eligible ? `<span class="power-chip p-mid"><em>—</em> unavailable</span>` : ring(lead)}<div><p class="eyebrow">${comp != null ? "Deck Power · competitive" : p.from === "commander" ? "Deck Power · strategic estimate" : "Deck Power · engine estimate"}</p><h2>${!eligibility.eligible ? (p.readiness?.incomplete ? "Finish the deck before rating Power" : "Power estimate unavailable") : strategic && comp == null ? `${esc(p.formatName || "Magic")} Power estimate` : p.from === "commander" ? "Commander build check" : comp != null ? esc(tier.label) : esc(readinessLabel(p))}</h2><p class="small"><b>${esc(p.plan)}</b></p>${!eligibility.eligible ? `<p class="small warn-text">${esc(eligibility.reason)}. Component diagnostics below are not an overall Power rating.</p>` : strategic ? `<p class="small"><b>${esc(strategic.confidence)} coverage</b> · provisional practical estimate, not win odds.</p>` : ""}<p class="muted small">${esc(p.lens)}</p>${eligibility.eligible && p.caps?.length ? `<p class="pw-headline small">Fix first: <b>${esc(p.caps[0].label)}</b> (holds the score to ${p.caps[0].max})</p>` : !strategic && top ? `<p class="pw-headline small">Biggest gain: <b>${esc(top.label)}</b> (+${pts(top.lost)} pts available)</p>` : ""}</div>
  <div class="pw-dual"><span class="${comp == null ? "dim" : tier.tone}"><b>${comp ?? "—"}</b>Competitive<small>${comp == null ? "needs tournament data" : "vs. what's winning now"}</small></span><span><b>${eng}</b>${criteria || strategic ? "Structure" : "Engine"}<small>${criteria ? "supported role/resource checks only" : "supported build checks, not full plan quality"}</small></span></div>${planNotice}${profile}</section>
  ${strategic ? `<section class="panel pw-weak"><div class="row between"><h3>What drives the Power estimate</h3><span class="muted small">${esc(strategic.version)}</span></div>${strategic.dimensions.map(d=>`<details class="ingredient"><summary>${esc(d.label)} · ${Math.round(d.ratio*100)}/100 model contribution</summary><p class="small">${esc(d.why)}</p></details>`).join("")}${strategic.routes.map(r=>`<details class="ingredient"><summary>${esc(r.label)} · conditional</summary><p class="small">Access ${Math.round(r.access*100)}% · deployment ${Math.round(r.deployment*100)}/100 · output ${Math.round(r.conversion*100)}/100. These are component checks, not winning odds.</p><p class="small">${esc(r.evidence.join(" "))}</p><p class="small muted">${esc(r.requirements.join(" "))}</p></details>`).join("")}<p class="foot">${esc(strategic.limitations.join(" "))}</p></section>` : ""}
  ${p.constructedCriteria ? `<details class="panel"><summary>Recognized card effects and conditions</summary><p class="foot">${esc(p.constructedCriteria.coverage.limitations.join(" "))}</p>${p.constructedCriteria.cards.filter(c=>c.requirements.length||c.unsupported.length||c.flow.effects.some(e=>e.activationMana)).map(c=>`<details class="ingredient"><summary>${esc(c.name)} · ${esc(c.threat.status)}</summary>${c.flow.effects.map(e=>`<p class="small">${esc(e.mode)} flow: ${e.effectMana ?? "unknown"} total mana. ${esc(e.requirements.join(" "))}</p>`).join("")}${c.requirements.map(r=>`<p class="small">${esc(r.kind)} · ${esc(r.status)}: ${esc(r.note || r.evidence)}</p>`).join("")}${c.unsupported.map(r=>`<p class="small warn-text">${esc(r.reason)}</p>`).join("")}</details>`).join("")}</details>` : ""}
  ${p.caps?.length ? `<section class="panel pw-caps"><h3>What holds this deck back</h3><p class="muted small">${!eligibility.eligible ? 'Overall Power is unavailable. These are diagnostic issues, not a partial Power rating.' : 'These supported concerns limit the estimate until resolved.'}</p>${p.caps.map((c) => `<div class="pw-cap"><div class="row between"><b>${esc(c.label)}</b><span class="chip warn">${!eligibility.eligible && ["Legal","Data"].includes(c.key) ? "unavailable" : `max ${c.max}`}</span></div><p>${esc(c.why || "")}</p></div>`).join("")}</section>` : ""}
  ${scoutingReport(p)}
  ${engineMapPanel(p.engine)}
  ${p.readiness?.provisional?`<section class="panel issues-panel"><h3>Resolve before treating this as competitive</h3>${p.readiness.unknown?`<p>${p.readiness.unknown} card copies still need their details loaded.</p>`:""}<ul>${p.readiness.issues.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><p class="foot">Overall Power is unavailable for incomplete, illegal or unresolved lists. The component diagnostics do not override these checks.</p></section>`:""}
  ${p.from === "meta" ? '<details class="panel"><summary>Optional generic build checks</summary>' : ""}<section class="panel pw-weak"><div class="row between"><h3>${p.from === "meta" ? "Build-model cautions" : "Build-health checks"}</h3><span class="muted small">${R.weak.length ? `${R.weak.length} found, biggest first` : "none"}</span></div>${p.from === "meta" ? '<p class="foot">These generic role targets are advisory. They do not override the placing list’s tournament evidence or prove that its engine is weak.</p>' : ""}${weak}</section>
  ${p.from === "meta" ? "</details>" : ""}
  ${R.strong.length ? `<section class="panel pw-strong"><h3>Strengths</h3><div class="pw-chips">${R.strong.map((x) => `<span class="pw-chip"><b>${esc(x.label)}</b> ${esc(String(x.count))}</span>`).join("")}</div></section>` : ""}
  ${isCommanderLike({format:p.formatName}) ? '<details class="panel"><summary>Generic simulations · partial ability model</summary><p class="foot">Land-only hand targets and combat approximations do not model a cEDH combo engine. Use them as diagnostics, not mulligan instructions or predicted wins.</p>' : ""}${sims}
  ${gold}${isCommanderLike({format:p.formatName}) ? "</details>" : ""}
  ${riskPanel(p.strategicRisk)}
  ${fieldBox || metaBox ? `<section class="panel"><h3>Against the meta</h3>${fieldBox}${metaBox}</section>` : ""}
  <section class="panel"><div class="row between"><h3>Score breakdown</h3><span class="muted small">build ${p.heuristic}/100</span></div><p class="muted small">Structural role and resource heuristics, before field evidence. These weights are model choices, not measured contributions to winning. Plan support and unknown mechanics remain separate. ${!eligibility.eligible ? "Overall Power is unavailable until the required checks resolve." : strategic ? "The separate strategic estimate above evaluates supported execution routes, not this checklist total." : p.heuristic !== p.score ? `Deck Power is <b>${p.score}</b> after weighing reference evidence (above).` : ""}</p>${R.scored
    .map((x) => {
      const low = x.ratio < 0.75;
      return `<details class="ingredient"><summary><div class="row between"><span><b>${esc(x.label)}</b> <span class="muted small">${esc(String(x.count))} / ${esc(String(x.target))}</span></span><span class="${low ? "warn-text" : ""}"><b>${pts(x.earned)}</b><span class="muted">/${pts(x.max)}</span></span></div>${bar(x.ratio, low ? "warn" : "good")}</summary><p class="small muted">${esc(x.hint)}</p>${cardList(x) || `<p class="small muted">No cards counted here.</p>`}</details>`;
    })
    .join("")}${criteria ? `<details class="ingredient"><summary>Plan evidence and resource requirements</summary><p class="small">${esc(criteria.scoreMeaning)}.</p>${criteria.plan.routes.map(r=>`<p class="small"><b>${esc(r.label)}</b> · ${esc(r.status)}<br>${esc(r.requirements.join(" "))}</p>`).join("")}<p class="small"><b>Setup</b>: ${esc(criteria.plan.setup?.join(". ") || "Commander deployment and card-specific costs still need sequencing review.")}</p><p class="small"><b>Disruption recovery</b>: ${criteria.plan.resilience?.cards?.length || 0} protection/recursion candidates; recovery is conditional, not simulated.</p><p class="small"><b>Closing route</b>: unverified against opponents. Combat bodies and resource loops alone are not proof of a win.</p><p class="small muted">${esc(criteria.coverage.limitations.join(" "))}</p>${criteria.resources.evidence.filter(r=>r.requirements.length).map(r=>`<p class="small">${esc(r.name)}: ${esc(r.requirements.join("; "))}</p>`).join("")}${criteria.resources.draw.evidence.filter(r=>r.requirements?.length).map(r=>`<p class="small">${esc(r.name)}: ${esc(r.requirements.join("; "))}</p>`).join("")}</details>` : ""}</section>`;
}

// The one Deck Power number shown everywhere (tiles, deck headers, builder): Competitive when the
// field is known, otherwise the engine estimate. The Power tab shows both.
export const shownPower = (p) => powerEligibility(p).eligible ? (competitiveScore(p) ?? p?.score ?? null) : null;

// Builder versions show the same number the saved deck will: Competitive when the field is known,
// else Engine. The Engine score stays alongside so the two never look like a mismatch.
export const asShown = (t) => {
  if (!t?.assessment) return t;
  const kind = competitiveScore(t.assessment) != null ? "comp" : "power",
    next = t.nextUpgrade?.assessment ? { ...t.nextUpgrade, power: shownPower(t.nextUpgrade.assessment) } : t.nextUpgrade;
  return { ...t, power: shownPower(t.assessment), engine: t.assessment.heuristic ?? t.assessment.score, powerKind: kind, nextUpgrade: next };
};
