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

// Pokémon on TCGplayer's Mass Entry need the set: "4 Milotic ex [SSP]". No collector number, so
// any art from that set can fill the line (the cheapest listing usually wins). rows: [{ qty, name, set }].
let ptcgSets = null;
export async function pokemonMassLines(rows) {
  ptcgSets ||= fetch("api/tcgplayer/sets?game=ptcg").then((r) => (r.ok ? r.json() : { sets: [] })).then((d) => d.sets || []).catch(() => ((ptcgSets = null), []));
  const sets = await ptcgSets;
  return rows.map((r) => {
    const g = r.set ? pickGroup(sets, r.set) : null;
    return `${r.qty} ${r.name}${g ? ` [${g.code}]` : ""}`;
  });
}
