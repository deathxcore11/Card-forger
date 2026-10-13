// Compare two Pokémon or Yu-Gi-Oh! cards side by side, like Magic's Compare: the numbers that
// matter in play, the price, and a plain summary of what you gain or give up.
import { esc } from "./ui.js";
import { artworkHTML } from "./artwork.js";

const num = (v) => {
  const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
const stat = (c,key) => c?.stats?.find(([name]) => name === key)?.[1];
const defense = c => c.def ?? stat(c,"DEF") ?? null;
const isLink = c => /link/i.test(c.typeLine || c.frame || "");
const conditionalDamage = c => (c.attacks || []).some(a => /[+×x]/i.test(String(a.damage)));
const stage = (x) => String(x || "").replace(/^Stage(\d)/, "Stage $1");
const usd = (v) => (v == null ? "No price" : `$${Number(v).toFixed(2)}`);
// Strongest attack: the biggest printed damage ("120", "30×", "60+").
export const topDamage = (c) => Math.max(0, ...(c.attacks || []).map((a) => num(a.damage) ?? 0));
const energyCost = (c) => Math.min(...(c.attacks || []).map((a) => (a.cost || []).length), 99);

// The facts shown per side: [label, value].
export function compareFacts(g, c) {
  if (!c) return [];
  if (g === "ptcg") {
    if (c.category !== "Pokemon") return [["Kind", c.typeLine || c.category], ["Price", usd(c.prices?.usd)]];
    return [
      ["HP", c.hp ?? "—"],
      ["Type", (c.types || []).join(" / ") || "—"],
      ["Stage", stage(c.stage) || "—"],
      ["Highest printed damage", topDamage(c) ? `${topDamage(c)}${conditionalDamage(c) ? " · effect-dependent" : ""}` : "—"],
      ["Cheapest attack", energyCost(c) < 99 ? `${energyCost(c)} Energy` : "—"],
      ["Retreat", c.retreat ?? "—"],
      ["Weakness", (c.weak || []).map((w) => w.type).join(", ") || "—"],
      ["Price", usd(c.prices?.usd)],
    ];
  }
  const monster = c.category === "Monster" || c.atk != null || defense(c) != null;
  return [
    ...(monster ? [["ATK", c.atk ?? stat(c,"ATK") ?? "?"], ...(!isLink(c) ? [["DEF", defense(c) ?? "—"]] : []), [isLink(c) ? "Link rating" : /xyz/i.test(c.typeLine || c.frame || "") ? "Rank" : "Level", c.link ?? stat(c,"Link") ?? c.level ?? "—"], ["Attribute", c.attribute || "—"], ["Type", c.race || "—"]] : [["Kind", c.typeLine || c.race || "—"]]),
    ["Price", usd(c.prices?.usd)],
  ];
}

// One-line differences, written as "B vs A".
export function compareLines(g, a, b) {
  if (!a || !b) return [];
  const out = [],
    diff = (x, y, word, more = "more", less = "less") => {
      if (x == null || y == null || x === y) return;
      out.push(`${b.name} has ${Math.abs(y - x)} ${y > x ? more : less} ${word}.`);
    };
  if (g === "ptcg" && a.category === "Pokemon" && b.category === "Pokemon") {
    diff(num(a.hp), num(b.hp), "HP");
    if (conditionalDamage(a) || conditionalDamage(b)) out.push("Attack damage depends on effects; printed values alone do not establish which hits harder.");
    else diff(topDamage(a), topDamage(b), "printed attack damage");
    const ea = energyCost(a), eb = energyCost(b);
    if (ea < 99 && eb < 99 && ea !== eb) out.push(`${b.name}’s cheapest attack needs ${eb} Energy (vs ${ea}).`);
    diff(num(a.retreat), num(b.retreat), "retreat cost", "higher", "lower");
    const sa = stage(a.stage), sb = stage(b.stage);
    if (sa && sb && sa !== sb) out.push(`${b.name} is ${sb || "a different stage"}${/Basic/.test(sb) && !/Basic/.test(sa) ? ", so it comes into play faster" : ""}.`);
  }
  if (g === "ygo" && (a.atk != null || b.atk != null)) {
    diff(num(a.atk), num(b.atk), "ATK");
    diff(num(defense(a)), num(defense(b)), "DEF");
    const la = num(a.level), lb = num(b.level);
    if (la != null && lb != null && la !== lb) out.push(`${b.name} has ${isLink(b) ? "Link rating" : /xyz/i.test(b.typeLine || b.frame || "") ? "Rank" : "Level"} ${lb}; ${a.name} has ${isLink(a) ? "Link rating" : /xyz/i.test(a.typeLine || a.frame || "") ? "Rank" : "Level"} ${la}. Check each card’s summoning restrictions.`);
    if (a.attribute && b.attribute && a.attribute !== b.attribute) out.push(`Different Attribute: ${b.attribute} vs ${a.attribute}.`);
  }
  const pa = a.prices?.usd, pb = b.prices?.usd;
  if (pa != null && pb != null && Math.abs(pa - pb) >= 0.01) out.push(`${b.name} costs $${Math.abs(pb - pa).toFixed(2)} ${pb > pa ? "more" : "less"}.`);
  return out;
}

export function tcgCompareSheet(g, [a, b]) {
  const side = (c, i) =>
    c
      ? `<div class="cmp-side"><button class="cmp-art" data-act="tCard" data-id="${esc(c.id)}" aria-label="Open ${esc(c.name)}">${artworkHTML(c, "card-img")}</button><b>${esc(c.name)}</b><span class="muted small">${esc(c.typeLine || "")}</span><span class="muted small">${esc(c.set?.name || "")}${c.set?.number ? " #"+esc(c.set.number) : ""}</span><dl class="cmp-facts">${compareFacts(g, c).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join("")}</dl>${c.text ? `<details class="cmp-effects"><summary>Effects &amp; restrictions</summary><p>${esc(c.text)}</p></details>` : ""}<button class="link small" data-act="tCompareClear" data-i="${i}">Change</button></div>`
      : `<div class="cmp-side pick"><input id="tcmp${i}" placeholder="Card name" data-enter="tCompareLookup" data-i="${i}" aria-label="Card ${i + 1} name"><button class="btn ghost" data-act="tCompareLookup" data-i="${i}">Look up</button></div>`;
  const lines = compareLines(g, a, b);
  return `<div class="sheet-head"><h2>Compare cards</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><div class="cmp">${side(a, 0)}<div class="cmp-vs">vs</div>${side(b, 1)}</div>${a && b ? `<div class="panel tight"><p>${lines.length ? lines.map(esc).join(" ") : "Printed stats and prices are similar. Effects and summoning requirements can still differ."}</p></div>` : `<p class="foot">Pick two cards to see how they stack up.</p>`}`;
}
