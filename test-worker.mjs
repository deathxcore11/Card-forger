// The Worker's /api/meta/mtg route with TopDeck stubbed: missing key, fresh fetch, cache,
// outage fallback to the last good result, bad formats, and the coverage report.
import assert from "node:assert/strict";

const store = new Map();
globalThis.caches = { default: { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => void store.set(r.url, res.clone()) } };
let calls = 0,
  down = false,
  lastBody = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith("https://topdeck.gg/")) {
    calls++;
    lastBody = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, "test-key", "the key goes in the Authorization header");
    if (down) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify([{ TID: "t1", tournamentName: "Pioneer Weekly", startDate: 1760000000, topCut: 8, standings: [{ name: "A", standing: 1, archetype: "Rakdos Midrange", decklist: "~~Mainboard~~\n4 Thoughtseize\n~~Sideboard~~\n2 Duress" }] }]), { status: 200 });
  }
  return realFetch(url, init);
};
const worker = (await import("./worker.js")).default;
const ctx = { waitUntil: (p) => p };
const get = (path, env) => worker.fetch(new Request("https://site.test" + path), env, ctx);

let r = await get("/api/meta/mtg?format=Pioneer", {});
assert.equal(r.status, 503, "no key → clearly not configured");
assert.equal((await r.json()).error, "not_configured");

const env = { TOPDECK_KEY: "test-key", ASSETS: { fetch: () => new Response("asset") } };
r = await get("/api/meta/mtg?format=Pioneer&days=30", env);
assert.equal(r.status, 200);
let d = await r.json();
assert.equal(d.decks[0].name, "Rakdos Midrange");
assert.equal(d.coverage.withList, 1);
assert.deepEqual([lastBody.game, lastBody.format, lastBody.last, lastBody.participantMin], ["Magic: The Gathering", "Pioneer", 30, 16]);
await new Promise((res) => setTimeout(res, 10));

await get("/api/meta/mtg?format=Pioneer&days=30", env);
assert.equal(calls, 1, "second request is served from cache");

// Fresh copy expires; TopDeck is down → last good result, marked stale.
for (const k of [...store.keys()]) if (k.includes("/fresh/")) store.delete(k);
down = true;
d = await (await get("/api/meta/mtg?format=Pioneer&days=30", env)).json();
assert.equal(d.stale, true);
assert.equal(d.decks.length, 1, "keeps showing the last good data during an outage");

r = await get("/api/meta/mtg?format=Bogus", env);
assert.equal(r.status, 400);
down = false;
const cov = await (await get("/api/meta/mtg/coverage?days=30", env)).json();
assert.ok(cov.formats.length >= 6 && cov.formats.every((f) => "events" in f || "error" in f));
assert.equal((await get("/index.html", env).then((x) => x.text())), "asset", "other paths still serve the site");
console.log("PASS: Worker TopDeck route — not-configured 503, key header, 12h cache, stale fallback during outages, format check, coverage report.");
