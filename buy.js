// One buying flow for every game: copy the cards you still need, say so in a small in-app sheet
// with what to do next, then open TCGplayer's Mass Entry (paste → Add to cart).
import { ask } from "./dialog.js";
import { pickGroup } from "./pokemon-art.js";

const LINE = { mtg: "Magic", ptcg: "Pokemon", ygo: "YuGiOh" };
export const massEntryUrl = (game) => `https://www.tcgplayer.com/massentry?productline=${LINE[game] || "Magic"}`;

export async function copyPlain(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const a = Object.assign(document.createElement("textarea"), { value: text });
      a.style.cssText = "position:fixed;opacity:0";
      document.body.append(a);
      a.select();
      const ok = document.execCommand("copy");
      a.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// lines: ["4 Roggenrola", …]. Returns false when there was nothing to buy.
export async function buyOnTcgplayer(game, lines, { what = "cards you need" } = {}) {
  const n = lines.reduce((a, l) => a + (parseInt(l, 10) || 1), 0);
  if (!lines.length) return false;
  const copied = await copyPlain(lines.join("\n"));
  const go = await ask(
    copied
      ? `${n} ${what} (${lines.length} line${lines.length === 1 ? "" : "s"}) are on your clipboard. On TCGplayer, paste them into Mass Entry and tap Add to cart.`
      : `Your browser blocked the clipboard. On TCGplayer, open Mass Entry and type the list, or copy it from the deck page.`,
    { title: copied ? "Shopping list copied" : "Couldn't copy", tone: copied ? "ok" : "", ok: "Open TCGplayer", cancel: "Done", danger: false },
  );
  if (go) window.open(massEntryUrl(game), "_blank", "noopener");
  return true;
}

// Mass Entry lines with TCGplayer's own set code: "4 Milotic ex [SSP]", "3 Ash Blossom & Joyous
// Spring [MP22]", "4 Lightning Bolt [FCA]". No collector number, so any art of the card in that set can
// fill the line and TCGplayer can pick the cheapest. rows: [{ qty, name, set (set name), code, num }].
// Pokémon needs the set; for Magic and Yu-Gi-Oh! the code is added only on an exact set match.
const SETS = {};
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export async function massLines(game, rows) {
  SETS[game] ||= fetch("api/tcgplayer/sets?game=" + game).then((r) => (r.ok ? r.json() : { sets: [] })).then((d) => d.sets || []).catch(() => ((SETS[game] = null), []));
  const sets = await SETS[game],
    byName = new Map(sets.map((x) => [norm(x.name), x])),
    byCode = new Map(sets.map((x) => [String(x.code).toUpperCase(), x]));
  return rows.map((r) => {
    const code = String(r.code || "").toUpperCase(),
      g = !r.set && !code ? null : (game === "ptcg" ? r.set && pickGroup(sets, r.set) : byName.get(norm(r.set))) || byCode.get(code) || null;
    // With a collector number (Magic), the line names one exact printing: "1 Deadpool, Trading Card [SLD] 1753".
    return `${r.qty} ${r.name}${g ? ` [${g.code}]${r.num ? " " + r.num : ""}` : ""}`;
  });
}
export const pokemonMassLines = (rows) => massLines("ptcg", rows);
