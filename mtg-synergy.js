// Magic Play guide: "Works with" partners and "Watch out" lines for a card. The partner lists come
// from mtg-synergy.json (built by scripts/mtg-synergy.mjs from Scryfall text searches, no AI);
// the watch-outs are read from the card's own rules text. Nothing here is a score or a rating.
import { mtgTags } from "./pairing.js";

let data = null, loading = null;
export function setMtgSynergy(d) { data = d; }
export function loadMtgSynergy() {
  if (data || loading || typeof fetch !== "function" || typeof location === "undefined") return loading;
  loading = fetch(new URL("./mtg-synergy.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { data = d; globalThis.dispatchEvent?.(new Event("cf:mtg-synergy")); } })
    .catch(() => {});
  return loading;
}

const nameKey = (n) => String(n || "").split(" // ")[0].toLowerCase();
const text = (c) => (c?.card_faces?.length ? c.card_faces.map((f) => f.oracle_text || "").join("\n") : c?.oracle_text || "").toLowerCase();
const art = (id) => `https://cards.scryfall.io/small/front/${id[0]}/${id[1]}/${id}.jpg`;
// Which tag the opened card provides → which payoff list reacts to it.
const LINK_BY_TAG = [["creature_burn", "creature_burn"], ["cast_spell", "cast_spell"], ["expend", "expend"]];
const WHY = {
  creature_burn: (n) => `${n} copies the damage to each opponent`,
  cast_spell: () => "pays you for casting it",
  expend: () => "your 4th mana spent on spells triggers it",
};

/** [{ name, image, reason }] — payoffs that trigger off this card, within its colours. Owned first. */
export function worksWith(card, { owned = () => false, max = 6 } = {}) {
  if (!data?.links || !card) return [];
  const tags = mtgTags(card).provides, mine = new Set(card.color_identity || []), me = nameKey(card.name), groups = [], seen = new Set();
  for (const [tag, link] of LINK_BY_TAG) {
    if (!tags.has(tag)) continue;
    const out = [];
    groups.push(out);
    for (const p of data.links[link]?.cards || []) {
      const ci = p.ci.split("").filter(Boolean);
      if (nameKey(p.n) === me || seen.has(p.n) || (mine.size && ci.length && !ci.some((c) => mine.has(c)))) continue;
      seen.add(p.n);
      out.push({ name: p.n, image: art(p.id), reason: data.links[link].why, owned: owned(p.n) > 0, rank: p.r });
    }
    out.sort((a, b) => b.owned - a.owned || a.rank - b.rank);
  }
  // Each link gets room: take turns across the groups so one long list can't crowd out the others.
  const picked = [];
  for (let i = 0; picked.length < max && groups.some((g) => g[i]); i++) for (const g of groups) if (g[i] && picked.length < max) picked.push(g[i]);
  return picked.sort((a, b) => b.owned - a.owned);
}

/** Plain lines read from the card's own rules text. */
export function watchOuts(card) {
  const t = text(card), out = [];
  if (/if that creature would die this turn, exile it instead/.test(t)) out.push("Anything it hits that would die this turn is exiled instead, for any reason. It also keeps death triggers, recursion and graveyard cards from happening, but it exiles your own creature too if you aim it there.");
  if (/target opponent draws? a card\. if you do, copy/.test(t)) out.push("Each copy costs you a card: your opponent draws one every time.");
  if (/whenever you expend \d/.test(t)) out.push("Only mana you spend on spells counts. Mana spent on abilities doesn't.");
  return out;
}
