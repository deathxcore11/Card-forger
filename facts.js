// "Did you know?" — short facts built only from the card data each source provides
// (release dates, printings, artists, banlists, popularity). Nothing is made up.
import { esc } from "./ui.js";

const year = (d) => (d ? String(d).slice(0, 4) : "");
const longDate = (d) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "";
};
const yearsAgo = (d) => {
  const y = Number(year(d));
  const n = y ? new Date().getUTCFullYear() - y : 0;
  return n >= 2 ? ` — ${n} years ago` : "";
};

const MTG_FORMAT_NAMES = { standard: "Standard", pioneer: "Pioneer", modern: "Modern", legacy: "Legacy", vintage: "Vintage", pauper: "Pauper", commander: "Commander", brawl: "Brawl", historic: "Historic", explorer: "Explorer", timeless: "Timeless", alchemy: "Alchemy", oathbreaker: "Oathbreaker", penny: "Penny Dreadful", duel: "Duel Commander", premodern: "Premodern", oldschool: "Old School", predh: "PreDH", paupercommander: "Pauper Commander", standardbrawl: "Standard Brawl", gladiator: "Gladiator", future: "Future Standard" };

export function mtgFacts(c, prints = null) {
  const f = [];
  if (!c) return f;
  if (prints?.length > 1) {
    if (c.released_at) f.push(`This version comes from ${c.set_name}, released ${longDate(c.released_at)}.`);
    const known = [...prints, c].filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.released_at || ""));
    const first = known.sort((a, b) => a.released_at.localeCompare(b.released_at))[0];
    if (first) f.push(`Earliest printing in the loaded results: ${first.set_name} (${year(first.released_at)}). ${new Set(prints.map(p => p.id || `${p.set}:${p.collector_number}`)).size} printings loaded; this may not include the full release history.`);
  } else if (c.reprint === false && c.released_at) f.push(`This is its first printing: ${c.set_name}, released ${longDate(c.released_at)}${yearsAgo(c.released_at)}.`);
  else if (c.released_at) f.push(`This version comes from ${c.set_name}, released ${longDate(c.released_at)}.`);
  if (c.artist) f.push(`Illustrated by ${c.artist}.`);
  if (c.reserved) f.push("It’s on the Reserved List: Wizards of the Coast has promised never to reprint it, which is why its price stays high.");
  if (c.game_changer) f.push("It’s on the Commander Game Changers list — including it pushes a deck into a higher power bracket.");
  if (c.edhrec_rank) f.push(c.edhrec_rank <= 500 ? `One of the most played Commander cards: #${Number(c.edhrec_rank).toLocaleString()} on EDHREC.` : `Ranks #${Number(c.edhrec_rank).toLocaleString()} in popularity on EDHREC.`);
  const banned = Object.entries(c.legalities || {}).filter(([, v]) => v === "banned").map(([k]) => MTG_FORMAT_NAMES[k] || k);
  if (banned.length) f.push(`Banned in ${banned.length === 1 ? banned[0] : banned.slice(0, -1).join(", ") + " and " + banned.at(-1)}.`);
  const restricted = Object.entries(c.legalities || {}).filter(([, v]) => v === "restricted").map(([k]) => MTG_FORMAT_NAMES[k] || k);
  if (restricted.length) f.push(`Restricted to a single copy in ${restricted.join(" and ")}.`);
  if (c.frame === "1993") f.push("This printing uses the original 1993 card frame.");
  if (c.keywords?.length) f.push(`Keywords: ${c.keywords.slice(0, 4).join(", ")}.`);
  return f;
}

const MD = { UR: "Ultra Rare", SR: "Super Rare", R: "Rare", N: "Normal" };
export function ygoFacts(c) {
  const f = [],
    m = c?.misc || {};
  if (!c) return f;
  if (m.ocgDate && m.tcgDate && m.ocgDate !== m.tcgDate) {
    const days = Math.round((Date.parse(m.tcgDate) - Date.parse(m.ocgDate)) / 864e5);
    f.push(days > 0 ? `Released in Japan (OCG) on ${longDate(m.ocgDate)}, and reached the TCG ${days >= 60 ? Math.round(days / 30) + " months" : days + " days"} later.` : `Released in the TCG on ${longDate(m.tcgDate)}, ${-days} days before Japan (OCG).`);
  } else if (m.tcgDate || m.ocgDate) f.push(`First released on ${longDate(m.tcgDate || m.ocgDate)}${yearsAgo(m.tcgDate || m.ocgDate)}.`);
  if (c.sets?.length > 1) {
    const names = new Set(c.sets.map((s) => s.name));
    f.push(`Printed ${c.sets.length} times across ${names.size} set${names.size === 1 ? "" : "s"}.`);
  }
  const priciest = (c.sets || []).filter((s) => s.price).sort((a, b) => b.price - a.price)[0];
  if (priciest && priciest.price >= 5) f.push(`Its priciest printing is the ${priciest.rarity} in ${priciest.name} (${priciest.code}), listed around $${priciest.price.toFixed(2)}.`);
  const bans = [["tcg", "TCG"], ["ocg", "OCG"], ["goat", "GOAT"]].filter(([k]) => c.ban?.[k]).map(([k, n]) => `${c.ban[k]} in ${n}`);
  if (bans.length) f.push(`Currently ${bans.join(", ")}.`);
  if (m.mdRarity) f.push(`In Master Duel it’s a${/^U/.test(m.mdRarity) ? "n" : ""} ${MD[m.mdRarity] || m.mdRarity} card.`);
  if (m.formats?.includes("GOAT")) f.push("Legal in GOAT format, which replays the game as it was in 2005.");
  if (m.views >= 1000) f.push(`Looked up ${Number(m.views).toLocaleString()} times on YGOPRODeck.`);
  if (c.archetype) f.push(`Part of the “${c.archetype}” archetype — cards that support each other by name.`);
  return f;
}

export function ptcgFacts(c) {
  const f = [];
  if (!c) return f;
  if (c.dexId?.length) f.push(`National Pokédex #${c.dexId.map((d) => String(d).padStart(4, "0")).join(" / ")}.`);
  if (c.set?.name) f.push(`Card ${c.set.number}${c.set.total ? " of " + c.set.total : ""} in ${c.set.name}.`);
  if (c.illustrator) f.push(`Illustrated by ${c.illustrator}.`);
  if (c.evolveFrom) f.push(`Evolves from ${c.evolveFrom}.`);
  if (c.regulationMark) f.push(`Regulation mark ${c.regulationMark} — this letter decides when it rotates out of Standard.${c.legal?.standard ? " It’s Standard-legal right now." : c.legal?.expanded ? " It has rotated to Expanded." : ""}`);
  else if (c.category === "Pokemon" && !c.legal?.expanded) f.push("Older than the Expanded format, so it’s only playable in Unlimited.");
  if (c.printVariants?.includes("firstEdition")) f.push("This card also exists as a 1st Edition print.");
  if (c.printVariants?.includes("reverse")) f.push("It also comes in a reverse holo version.");
  if (c.ruleBox) f.push("It has a Rule Box, so your opponent takes more than one Prize card when it’s Knocked Out.");
  if (c.aceSpec) f.push("ACE SPEC: a deck can include only one ACE SPEC card in total.");
  return f;
}

export const factsFor = (c, prints) => (c?.game === "ygo" ? ygoFacts(c) : c?.game === "ptcg" ? ptcgFacts(c) : mtgFacts(c, prints));

// One fact at a time; "Another" cycles through the rest in place.
export function factBox(facts, seed = "") {
  if (!facts.length) return "";
  let h = 0;
  for (const ch of seed + new Date().toISOString().slice(0, 10)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const start = h % facts.length;
  return `<aside class="fact" aria-live="polite"><span class="fact-label">Did you know?</span>${facts.map((x, i) => `<p data-fact ${i === start ? "" : "hidden"}>${esc(x)}</p>`).join("")}${facts.length > 1 ? `<button class="link small" data-act="nextFact">Another fact ›</button>` : ""}</aside>`;
}
export function nextFact(t) {
  const items = [...(t.closest(".fact")?.querySelectorAll("[data-fact]") || [])],
    i = items.findIndex((x) => !x.hidden);
  if (items.length < 2) return;
  items[i].hidden = true;
  items[(i + 1) % items.length].hidden = false;
}
