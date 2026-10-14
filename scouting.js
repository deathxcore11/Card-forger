// Scouting report: the Deck Power analysis written up the way a player would talk about a deck.
// What it's trying to do, how a game goes, the synergies that carry it, how it closes, how it
// stacks up against the decks winning right now, and a plain verdict. Built only from evidence
// the app already computes (goldfish, hand odds, rules-text links, tournament match, disruption
// risks); nothing here is invented, and it says when evidence is missing.
import { esc } from "./ui.js";
import { review } from "./deckaudit.js";

const pc = (x) => Math.round((x || 0) * 100) + "%";
const list = (xs, n = 3) => {
  const a = xs.filter(Boolean).slice(0, n);
  return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a.at(-1);
};
const cardsOf = (p, key, n = 3) => (p.parts?.find((x) => x.key === key)?.cards || []).slice(0, n).map((c) => c.name);

// Competitive score: the field's verdict when tournament data exists, else unknown.
export function competitiveScore(p) {
  const c = p?.ctx || {};
  if (c.from === "meta" || c.from === "mixed") return c.score;
  if (c.from === "rogue") return c.fieldEstimate ?? null;
  return null;
}
// The headline label: eligibility first, then how it compares with the field.
export const verdictTier = (p, score) => (p?.caps?.some((c) => c.key === "Legal") ? { label: "Not tournament-legal yet", tone: "bad" } : competitiveTier(score));
export function competitiveTier(score) {
  if (score == null) return { label: "Not compared with the field yet", tone: "" };
  return score >= 88 ? { label: "Tier 1 contender", tone: "ok" } : score >= 75 ? { label: "Competitive: holds up at regionals", tone: "ok" } : score >= 62 ? { label: "Locals-ready, outclassed at big events", tone: "warn" } : score >= 50 ? { label: "Rogue: can steal games, rarely wins events", tone: "warn" } : { label: "Casual / kitchen-table", tone: "bad" };
}

const MTG_PLAN = {
  Aggro: "attack from the first turns and finish before the opponent stabilises",
  Midrange: "trade efficiently early, then take over with threats that are better than the opponent's",
  Control: "answer everything that matters, then win late with a handful of finishers",
  Ramp: "accelerate its mana and land big threats turns ahead of schedule",
};

function planText(p) {
  const g = p.game;
  if (g === "mtg") {
    if (p.from === "commander" || /^Commander lens/.test(p.lens || "")) return `A Commander deck (${esc(p.plan)}). It's judged on mana, card flow, answers and how much of it serves the commander's plan, since a four-player game is long and political.`;
    const base = String(p.plan || "Midrange").split(" · ")[0],
      theme = String(p.plan || "").split(" · ")[1];
    const st = p.stats || {};
    return `A ${esc(p.plan || base)} deck: it wants to ${MTG_PLAN[base] || MTG_PLAN.Midrange}${theme ? `, using a ${theme.toLowerCase()} theme to get more out of each card` : ""}. ${st.lands ? `It runs ${st.lands} lands for spells averaging ${Number(st.avg || 0).toFixed(2)} mana, with ${st.interaction ?? 0} ways to interact and ${st.flow ?? 0} card-flow pieces.` : ""}`;
  }
  if (g === "ygo") {
    const st = cardsOf(p, "Starters"), ex = cardsOf(p, "Extenders"), it = cardsOf(p, "Interaction"), br = cardsOf(p, "Removal", 2);
    return `${esc(p.plan || "A Yu-Gi-Oh! deck")}: it opens with ${st.length ? list(st) : "no clear starter"}${ex.length ? `, keeps going through a hand trap with ${list(ex)}` : ""}${it.length ? `, and holds ${list(it)} for the opponent's turn` : ""}.${br.length ? ` Going second it breaks boards with ${list(br, 2)}.` : " It has little to break an established board going second."}`;
  }
  const dr = cardsOf(p, "Draw"), se = cardsOf(p, "Search"), gu = cardsOf(p, "Gust", 2);
  return `${esc(p.plan || "A Pokémon deck")}: it sets up its attacker${se.length ? ` with ${list(se)}` : ""}, refills its hand with ${dr.length ? list(dr) : "very little draw"}${gu.length ? `, and picks its Prize targets with ${list(gu, 2)}` : ", but has no gust to choose which Pokémon to Knock Out"}.`;
}

function gameText(p) {
  const g = p.goldfish;
  if (!g) return "";
  const bad = (p.sims || []).find((s) => s.lower && s.p > s.target);
  const log = g.samples?.[0]?.log?.slice(0, 3) || [],
    t = p.game === "ygo" ? log.map((l) => l.text).join(" ") : log.map((l) => `turn ${l.t}: ${l.text}`).join("; ");
  return `${esc(g.headline)}${t ? (p.game === "ygo" ? ` With a good hand: ${esc(t)}` : ` A typical opening: ${esc(t)}.`) : ""}${bad ? ` The weak spot is consistency: ${esc(bad.label.toLowerCase())} happens ${pc(bad.p)} of the time (aim for under ${pc(bad.target)}).` : ""}`;
}

function synergyText(p) {
  const links = p.engine?.links || [];
  if (!links.length) return "No card in the list clearly depends on another one, so its cards mostly work on their own. Decks that win usually have pieces that multiply each other.";
  return links
    .slice(0, 3)
    .map((x) => `<b>${esc(x.payoff)}</b> wants ${esc(String(x.need).replace(/^type:(\w+)/i, (m, t) => t[0].toUpperCase() + t.slice(1) + " Energy").replace(/^(?!.*Energy$)(.*)$/, (m) => m.toLowerCase()))}: ${esc(x.providers.slice(0, 3).map((q) => `${q.qty}× ${q.name}`).join(", "))}${x.openingBoth != null ? ` (you open both ${pc(x.openingBoth)} of the time)` : ""}.`)
    .join(" ");
}

function fieldText(p) {
  const c = p.ctx || {}, m = p.match;
  if (c.from === "commander") return "Casual Commander isn't measured against a tournament field here; the Bracket estimate is the better guide for who it's fair to play against.";
  if (!c.lists && c.from === "build") return c.reason === "format" ? `There are no recent tournament results for ${esc(p.formatName || "this format")} in the data, so it can't be compared with what's winning.` : "Not compared with recent tournament decks yet. Open this tab with an internet connection to load them.";
  const field = (c.field || []).slice(0, 3).map((a) => `${a.name}${a.share ? ` (${pc(a.share)})` : ""}`);
  const threats = (p.strategicRisk?.axes || []).flatMap((a) => a.threats.map((t) => `${t.rival} plays ${t.card}, which hits its ${a.label.toLowerCase()}`)).slice(0, 2);
  if (m && m.sim >= 0.35) return `It's a version of <b>${esc(m.archetype)}</b> (${pc(m.sim)} the same cards), which makes up ${pc(m.share)} of the field with a best recent finish of ${esc(String(m.bestRank <= 1 ? "1st" : m.bestRank <= 8 ? "Top 8" : "Top 32 or lower"))}. ${m.missing?.length ? `The winning lists also play ${esc(list(m.missing.slice(0, 3).map((x) => `${x.qty}× ${x.name}`)))}.` : ""} ${threats.length ? esc(threats.join("; ")) + "." : ""}`;
  return `No deck that's placing looks like this one; only ${pc(c.played)} of its cards show up in tournament lists at all. ${field.length ? `The decks to beat right now are ${esc(list(field))}. ` : ""}${threats.length ? esc(threats.join("; ")) + ". " : ""}Expect them to be faster or more consistent unless this list has an angle they don't prepare for.`;
}

function verdictText(p, comp) {
  const R = review(p.parts || []),
    fixes = R.weak.slice(0, 2).map((x) => x.label.toLowerCase()),
    tier = verdictTier(p, comp);
  const eng = p.heuristic ?? p.score;
  const gap =
    comp == null ? ""
    : eng - comp >= 15 && eng >= 70 ? ` Built well on its own terms (engine ${eng}), but against the field it rates ${comp}: the cards are fine, the strategy is what holds it back.`
    : eng - comp >= 15 ? ` Its own build is shaky (engine ${eng}) and against the field it drops to ${comp}.`
    : comp >= 75 ? ` Built well (engine ${eng}) and it holds up against the field (${comp}).` : "";
  const cap = p.caps?.[0];
  return `<b>${esc(tier.label)}.</b>${cap ? ` Held back by one thing above all: <b>${esc(cap.label.toLowerCase())}</b>. ${esc(cap.why || "")}` : ""}${gap} ${fixes.length ? `First things to fix: ${esc(list(fixes, 2))}.` : "The build checks find nothing major to fix."}`;
}

export function scoutingReport(p) {
  if (!p) return "";
  const comp = competitiveScore(p);
  const rows = [
    ["The plan", planText(p)],
    ["How a game goes", gameText(p)],
    ["What makes it work", synergyText(p)],
    ["How it wins", p.goldfish ? `${esc(p.goldfish.winCon)} ${esc(p.goldfish.endgame)}` : ""],
    ["Against the field", fieldText(p)],
    ["Verdict", verdictText(p, comp)],
  ].filter(([, t]) => t);
  return `<section class="panel scout"><p class="eyebrow">Scouting report</p>${rows.map(([h, t]) => `<div class="scout-row"><h3>${h}</h3><p>${t}</p></div>`).join("")}<p class="foot">Written from this list's own numbers: shuffled hands, a played-out goldfish, rules-text links and recent tournament results. It reads cards, not opponents, so test the matchups it points to.</p></section>`;
}
