import {interactiveRules} from './rule-learning.js';
// Rules reference for each game: format deck rules, a core-rules quick reference,
// live banned/restricted lists, and links to the official documents.
import { esc } from "./ui.js";
import { GAMES } from "./games.js";
import { FORMATS as MTG_FORMATS, sizeLabel } from "./formats.js";
import { YGO_FORMATS } from "./ygo.js";
import { PTCG_FORMATS } from "./ptcg.js";

const OFFICIAL = {
  mtg: [
    ["Comprehensive Rules (Wizards of the Coast)", "https://magic.wizards.com/en/rules"],
    ["Banned & restricted announcements", "https://magic.wizards.com/en/banned-restricted-list"],
    ["Commander format & brackets", "https://magic.wizards.com/en/formats/commander"],
  ],
  ygo: [
    ["Official rulebook (Konami)", "https://www.yugioh-card.com/en/rulebook/"],
    ["Forbidden & Limited list (TCG)", "https://www.yugioh-card.com/en/limited/"],
    ["Official card database & rulings", "https://www.db.yugioh-card.com/yugiohdb/"],
  ],
  ptcg: [
    ["Rules & rulebooks (The Pokémon Company)", "https://play.pokemon.com/en-us/resources/rules/"],
    ["Banned card list & Standard rotation", "https://www.pokemon.com/us/play-pokemon/about/pokemon-tcg-banned-card-list"],
  ],
};

// Short, plain-language summaries. The official documents above are the authority.
// Live lists the reference can fetch for a format.
export const BANLISTS = {
  mtg: MTG_FORMATS.filter((f) => f.legality).map((f) => ({ id: f.legality, name: f.name })),
  ygo: [
    { id: "tcg", name: "TCG (Advanced)" },
    { id: "ocg", name: "OCG" },
    { id: "goat", name: "GOAT" },
  ],
  ptcg: [],
};

function formatTable(g) {
  if (g === "mtg")
    return MTG_FORMATS.map((f) => `<tr><td><b>${esc(f.name)}</b>${f.note ? `<br><small class="muted">${esc(f.note)}</small>` : ""}</td><td>${esc(sizeLabel(f))}${f.commander ? `, led by ${f.commander === "planeswalker" ? "a planeswalker" : f.commander === "creature" ? "a creature" : "a legendary creature"}` : f.copies === Infinity ? ", any number" : f.copies === 4 ? ", up to 4 of each" : ""}</td><td class="num">${f.life}</td></tr>`).join("");
  if (g === "ygo") return YGO_FORMATS.map((f) => `<tr><td><b>${esc(f.name)}</b>${f.note ? `<br><small class="muted">${esc(f.note)}</small>` : ""}</td><td>Main ${f.main[0]}–${f.main[1]}, Extra ≤${f.extra}, Side ≤${f.side}${f.traditional ? "; Forbidden cards become Limited" : ""}</td><td class="num">${f.main[0] === 20 ? 4000 : 8000}</td></tr>`).join("");
  return PTCG_FORMATS.map((f) => `<tr><td><b>${esc(f.name)}</b>${f.note ? `<br><small class="muted">${esc(f.note)}</small>` : ""}</td><td>60 cards, ${f.copies === 1 ? "1" : "up to 4"} of each name${f.legal ? `, ${esc(f.legal === "standard" ? "Standard" : "Expanded")}-legal sets only` : ", every set"}</td><td class="num">—</td></tr>`).join("");
}

export function learnSheet(g) {
  return `<div class="sheet-head"><h2>Learn ${esc(GAMES[g].short)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div>${interactiveRules(g)}<button class="btn ghost block" data-act="go" data-to="#rules">Formats & official rules</button>`;
}
export function rulesPage(g, R) {
  const G = GAMES[g],
    lists = BANLISTS[g],
    pick = R.list && lists.find((x) => x.id === R.list) ? R.list : lists[0]?.id;
  return `<div class="page-head"><h1>${esc(G.short)} rules</h1><div class="head-actions"><button class="btn ghost small" data-act="learnGame">How to play · keywords</button><button class="btn ghost small" data-act="tabletop">Tabletop · play together</button></div></div>
  ${interactiveRules(g)}
  <details class="panel rules-supplement"><summary><b>Formats & deck limits</b><small>Deck size, copies and starting life</small></summary>
  <section class="panel"><h3>Formats</h3><table class="metrics rules-table"><thead><tr><th>Format</th><th>Deck</th><th class="num">${g === "ptcg" ? "" : "Life"}</th></tr></thead><tbody>${formatTable(g)}</tbody></table>
  ${g === "ptcg" ? `<p class="foot">Standard rotates each year by regulation mark; CardStashy reads each card’s current Standard/Expanded legality from TCGdex.</p>` : g === "ygo" ? `<p class="foot">Speed Duel and Duel Links start at 4000 LP.</p>` : ""}</section></details>
  ${
    lists.length
      ? `<section class="panel"><h3>${g === "ygo" ? "Forbidden & Limited lists" : "Banned & restricted lists"}</h3>
    <div class="src-row">${lists.map((l) => `<button class="chip pick ${l.id === pick ? "on" : ""}" data-act="rulesList" data-id="${esc(l.id)}">${esc(l.name)}</button>`).join("")}</div>
    ${R.busy ? `<p class="muted small">Loading the current list…</p>` : R.error ? `<p class="warn-text small">${esc(R.error)}</p>` : R.data?.[pick] ? banlistView(g, R.data[pick]) : `<button class="btn ghost small" data-act="rulesList" data-id="${esc(pick)}">Load the current list</button>`}
    <p class="foot">Live from ${g === "ygo" ? "YGOPRODeck" : "Scryfall"}; updates as soon as they do.</p></section>`
      : `<section class="panel"><h3>Banned cards</h3><p class="small">The Pokémon banned list (mostly Expanded) isn’t published as data. Cards that aren’t legal in a format are already flagged in your decks; the official list is linked below.</p></section>`
  }
  <section class="panel"><h3>Official documents</h3><div class="list compact">${OFFICIAL[g].map(([l, u]) => `<a class="mini-row store" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${esc(l)}</span></a>`).join("")}</div></section>`;
}

function banlistView(g, rows) {
  if (!rows.length) return `<p class="muted small">Nothing banned in this format right now.</p>`;
  const groups = {};
  for (const r of rows) (groups[r.status] = groups[r.status] || []).push(r);
  const order = g === "ygo" ? ["Forbidden", "Limited", "Semi-Limited"] : ["Banned", "Restricted"];
  return order
    .filter((k) => groups[k])
    .map((k) => `<p class="list-head">${esc(k)} <span class="muted">${groups[k].length}</span></p><div class="ban-grid">${groups[k].sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<button class="ban-item" data-act="${g === "mtg" ? "card" : "tCard"}" ${g === "mtg" ? `data-name="${esc(r.name)}"` : `data-id="${esc(r.id)}"`}>${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span>${esc(r.name)}</span></button>`).join("")}</div>`)
    .join("");
}
