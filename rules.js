import {interactiveRules} from './rule-learning.js';
import {ruleDexPanel} from './rule-dex.js';
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
const CORE = {
  mtg: [
    ["How you win", "Reduce your opponent to 0 life, make them draw from an empty library, or give them 10 poison counters. Commander adds a loss at 21 combat damage from one commander."],
    ["Turn order", "Untap → Upkeep → Draw → Main phase 1 → Combat (beginning, declare attackers, declare blockers, damage, end) → Main phase 2 → End step → Cleanup. The player going first skips their first draw in two-player games."],
    ["Mana & lands", "Play one land per turn during a main phase. Tap lands and other sources for mana to cast spells; unused mana empties between steps."],
    ["Casting & the stack", "Creatures, artifacts, enchantments, planeswalkers and sorceries are cast in your main phase when the stack is empty. Instants and abilities can be cast whenever you have priority; the last thing added to the stack resolves first."],
    ["Combat", "Creatures can attack the turn after they come under your control (unless they have haste). Each blocker blocks one attacker; damage is dealt at the same time."],
    ["Mulligans", "London mulligan: shuffle and draw 7 again, then put one card on the bottom for each mulligan taken. In multiplayer Commander the first mulligan is free."],
    ["Commander basics", "100 cards including your commander, one copy of each card except basic lands, every card within the commander's color identity, 40 life. Casting your commander from the command zone costs {2} more for each previous time."],
  ],
  ygo: [
    ["How you win", "Reduce your opponent's Life Points from 8000 to 0, or they need to draw with no cards left in their Deck. Some cards win the game on their own."],
    ["Turn order", "Draw Phase → Standby Phase → Main Phase 1 → Battle Phase → Main Phase 2 → End Phase. The player who goes first doesn't draw on their first turn and can't attack that turn."],
    ["Summoning", "One Normal Summon or Set per turn. Level 5–6 monsters need 1 Tribute, Level 7+ need 2. Special Summons have no limit unless a card says so."],
    ["Extra Deck monsters", "Fusion (fuse listed materials), Synchro (Tuner + non-Tuners whose Levels add up), Xyz (monsters of the same Level as materials), Link (materials equal to the Link Rating). Fusion, Synchro and Xyz can be summoned to any Main Monster Zone; Link monsters and face-up Pendulums from the Extra Deck go to the Extra Monster Zone or a zone a Link Monster points to."],
    ["Chains", "Responding to an effect builds a Chain; it resolves last-in, first-out. Spell Speed 1 can't respond, Speed 2 (Quick-Play Spells, Traps, Quick Effects) can, Speed 3 responses require an eligible Counter Trap. Activation conditions and Damage Step restrictions still apply."],
    ["Deck rules", "Main Deck 40–60, Extra Deck up to 15, Side Deck up to 15, at most 3 copies of a card. Forbidden = 0, Limited = 1, Semi-Limited = 2."],
  ],
  ptcg: [
    ["How you win", "Take all 6 of your Prize cards, Knock Out your opponent's last Pokémon in play, or your opponent can't draw at the start of their turn."],
    ["Setup", "Draw 7. If you have no Basic Pokémon, reveal, shuffle and draw again (your opponent may draw a card for each). Place an Active Pokémon, up to 5 on the Bench, then 6 Prize cards."],
    ["Your turn", "Draw a card, then in any order: put Basic Pokémon on the Bench, evolve (not a Pokémon played this turn, and not on either player's first turn), attach 1 Energy, play Item cards, 1 Supporter, 1 Stadium, retreat once, use Abilities. Attacking ends your turn."],
    ["First turn", "The player who goes first can't attack and can't play a Supporter on their first turn."],
    ["Damage & conditions", "Weakness usually doubles damage; Resistance usually reduces it by 30. Special Conditions: Asleep, Burned, Confused, Paralyzed, Poisoned."],
    ["Prizes", "Knocking Out a Pokémon takes 1 Prize; Pokémon ex and V give 2; Mega Evolution Pokémon ex and VMAX give 3."],
    ["Deck rules", "Exactly 60 cards, at most 4 with the same name (basic Energy excepted), 1 ACE SPEC and 1 Radiant Pokémon per deck, at least one Basic Pokémon."],
  ],
};

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
  return `<div class="sheet-head"><h2>Learn ${esc(GAMES[g].short)}</h2><button class="icon" data-act="closeSheet" aria-label="Close">✕</button></div><p class="muted">Start with the turn, then explore the terms at your own pace.</p><section class="learn-topics">${CORE[g].map(([title,text]) => `<details><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join("")}</section>${interactiveRules(g)}${ruleDexPanel(g)}<button class="btn ghost block" data-act="go" data-to="#rules">Formats & official rules</button>`;
}
export function rulesPage(g, R) {
  const G = GAMES[g],
    lists = BANLISTS[g],
    pick = R.list && lists.find((x) => x.id === R.list) ? R.list : lists[0]?.id;
  return `<div class="page-head"><h1>${esc(G.short)} rules</h1></div>
  <p class="muted small">A quick reference in plain language. The official documents linked below always win if anything differs.</p>
  <section class="panel"><h3>Formats</h3><table class="metrics rules-table"><thead><tr><th>Format</th><th>Deck</th><th class="num">${g === "ptcg" ? "" : "Life"}</th></tr></thead><tbody>${formatTable(g)}</tbody></table>
  ${g === "ptcg" ? `<p class="foot">Standard rotates each year by regulation mark; CardStashy reads each card’s current Standard/Expanded legality from TCGdex.</p>` : g === "ygo" ? `<p class="foot">Speed Duel and Duel Links start at 4000 LP.</p>` : ""}</section>
  <section class="panel"><h3>Core rules</h3><div class="rules-list">${CORE[g].map(([t, x]) => `<details><summary><b>${esc(t)}</b></summary><p>${esc(x)}</p></details>`).join("")}</div></section>
  ${
    lists.length
      ? `<section class="panel"><h3>${g === "ygo" ? "Forbidden & Limited lists" : "Banned & restricted lists"}</h3>
    <div class="src-row">${lists.map((l) => `<button class="chip pick ${l.id === pick ? "on" : ""}" data-act="rulesList" data-id="${esc(l.id)}">${esc(l.name)}</button>`).join("")}</div>
    ${R.busy ? `<p class="muted small">Loading the current list…</p>` : R.error ? `<p class="warn-text small">${esc(R.error)}</p>` : R.data?.[pick] ? banlistView(g, R.data[pick]) : `<button class="btn ghost small" data-act="rulesList" data-id="${esc(pick)}">Load the current list</button>`}
    <p class="foot">Live from ${g === "ygo" ? "YGOPRODeck" : "Scryfall"}; updates as soon as they do.</p></section>`
      : `<section class="panel"><h3>Banned cards</h3><p class="small">The Pokémon banned list (mostly Expanded) isn’t published as data. Cards that aren’t legal in a format are already flagged in your decks; the official list is linked below.</p></section>`
  }
  ${interactiveRules(g)}${ruleDexPanel(g)}<section class="panel"><h3>Official documents</h3><div class="list compact">${OFFICIAL[g].map(([l, u]) => `<a class="mini-row store" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${esc(l)}</span><span class="small">↗</span></a>`).join("")}</div></section>`;
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
