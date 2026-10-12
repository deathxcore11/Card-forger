// How much Magic tournament data TopDeck.gg actually returns, per format.
//
//   TOPDECK_KEY=your-key node scripts/topdeck-coverage.mjs [days]        # straight from TopDeck
//   node scripts/topdeck-coverage.mjs --site https://your-site [days]    # through the live Worker
//
// Columns: events (16+ players), players, top-cut slots, slots with a usable list, structured
// lists (deckObj), link-only lists, slots with no list, archetypes, newest event.
import { TOPDECK_API, WARM_FORMATS, normalizeTopdeck, topdeckBody } from "../topdeck.js";

const args = process.argv.slice(2),
  site = args.includes("--site") ? args[args.indexOf("--site") + 1] : "",
  days = Number(args.find((a) => /^\d+$/.test(a))) || 30;

let rows;
if (site) {
  const r = await fetch(new URL(`/api/meta/mtg/coverage?days=${days}`, site));
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(`Worker answered ${r.status}:`, body.message || body.error || "");
    process.exit(1);
  }
  rows = body.formats;
} else {
  const key = process.env.TOPDECK_KEY;
  if (!key) {
    console.error("Set TOPDECK_KEY (free key from https://topdeck.gg/docs/tournaments-v2) or pass --site <url>.");
    process.exit(1);
  }
  rows = [];
  for (const format of WARM_FORMATS) {
    const r = await fetch(TOPDECK_API, { method: "POST", headers: { Authorization: key, "Content-Type": "application/json" }, body: JSON.stringify(topdeckBody(format, days)) });
    if (!r.ok) {
      rows.push({ format, error: `HTTP ${r.status} ${(await r.text()).slice(0, 80)}` });
      continue;
    }
    const d = normalizeTopdeck(await r.json(), { format, days });
    rows.push({ format, ...d.coverage, lists: d.decks.length, archetypes: d.archetypes.length, newest: d.events[0]?.date || "" });
    await new Promise((res) => setTimeout(res, 1500)); // stay well under the rate limit
  }
}

const cols = ["format", "events", "players", "topSlots", "withList", "structured", "linkOnly", "missing", "archetypes", "newest"];
console.log(`TopDeck.gg coverage · last ${days} days · events with 16+ players · ${site ? "via " + site : "direct"}\n`);
console.log(cols.join("\t"));
for (const r of rows) console.log(r.error ? `${r.format}\tERROR ${r.error}` : cols.map((c) => r[c] ?? "").join("\t"));
const total = rows.filter((r) => !r.error).reduce((a, r) => ({ slots: a.slots + r.topSlots, lists: a.lists + r.withList }), { slots: 0, lists: 0 });
console.log(`\nTop-cut slots with a usable decklist: ${total.lists}/${total.slots}${total.slots ? ` (${Math.round((total.lists / total.slots) * 100)}%)` : ""}`);
console.log("Attribution required by TopDeck: a visible “Data provided by TopDeck.gg” link wherever the data is shown.");
