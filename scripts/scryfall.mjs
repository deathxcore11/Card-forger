// Polite, cached Scryfall access for the build scripts (110 ms between calls, retries with backoff).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Scryfall oracle tags for each role the app scores (Deck Power, engine roles, pairing).
export const ROLE_TAGS = {
  removal: ["spot-removal"],
  counter: ["counterspell"],
  wipe: ["sweeper"],
  draw: ["draw"],
  ramp: ["ramp", "mana-rock", "mana-dork"],
  discard: ["hand-disruption"],
};

export function scryfall(cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let last = 0;
  async function get(url) {
    const file = path.join(cacheDir, crypto.createHash("sha1").update(url).digest("hex") + ".json");
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    for (let a = 0; ; a++) {
      const wait = last + 110 - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        const r = await fetch(url, { headers: { "User-Agent": "CardStashy/3.56 (card data build)", Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
        if (r.status === 404) { const body = { data: [], has_more: false }; fs.writeFileSync(file, JSON.stringify(body)); return body; }
        if (r.status === 429 || r.status >= 500) throw Error("HTTP " + r.status);
        const body = await r.json();
        fs.writeFileSync(file, JSON.stringify(body));
        return body;
      } catch (e) {
        if (a >= 5) throw e;
        await sleep(1000 * 2 ** a);
      }
    }
  }
  async function all(q, extra = {}) {
    let url = "https://api.scryfall.com/cards/search?" + new URLSearchParams({ q, ...extra }), out = [];
    while (url) { const d = await get(url); out.push(...(d.data || [])); url = d.has_more ? d.next_page : null; }
    return out;
  }
  return { get, all };
}
