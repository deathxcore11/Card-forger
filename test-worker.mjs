// The Worker's /api/meta/mtg route with every source stubbed: Magic Online and EDHTop16 work
// without a key; TopDeck covers the rest when TOPDECK_KEY is set. Cache, outages, bad formats.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Preview build settings are explicit and isolated, not copied credentials or
// production resource identifiers. Owner testing-mode quotas stay unchanged.
{
  const config=JSON.parse(readFileSync(new URL('./wrangler.jsonc',import.meta.url),'utf8').replace(/^\s*\/\/.*$/gm,''));
  assert.equal(config.name,'cardforge2');
  assert.deepEqual(config.vars,{TCGPLAYER_WEB_TEST:'true',AI_LIMITS_ENABLED:'false',CONDITION_OWNER_ID:'94ea20a0-f250-4815-8391-de48dd14df98',CONDITION_DAILY_LIMIT:'30',CONDITION_MONTHLY_LIMIT:'900',CONDITION_MINUTE_LIMIT:'8'});
  assert.deepEqual(Object.keys(config.previews).sort(),['durable_objects','vars']);
  const {CONDITION_OWNER_ID,...publicCaps}=config.vars;
  assert.deepEqual(config.previews.vars,publicCaps,'Preview does not gain the production owner exemption');
  assert.deepEqual(config.previews.durable_objects,config.durable_objects);
  for(const binding of config.previews.durable_objects.bindings)assert.deepEqual(Object.keys(binding).sort(),['class_name','name'],'no production script or namespace identifier is shared');
  console.log('PASS: explicit preview config preserves owner quotas and uses only isolated same-Worker Durable Objects, no credentials.');
}

const store = new Map();
globalThis.caches = { default: { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => void store.set(r.url, res.clone()) } };
let calls = { topdeck: 0, mtgo: 0, edh: 0 },
  down = false,
  lastBody = null;
const day = new Date().toISOString().slice(0, 10);
const mtgoEvent = JSON.stringify({ event_id: "1", description: "Pioneer Challenge 32", starttime: day + " 15:00:00.0", type: "TOURNAMENT", site_name: "pioneer-challenge-32-" + day + "1", player_count: { players: "60" }, standings: [{ loginid: "7", rank: "1" }], final_rank: [{ loginid: "7", rank: "1" }], winloss: [{ loginid: "7", wins: "7", losses: "1" }], decklists: [{ loginid: "7", player: "Ana", main_deck: [{ qty: "4", card_attributes: { card_name: "Thoughtseize", card_type: "SORCRY" } }, { qty: "4", card_attributes: { card_name: "Fable of the Mirror-Breaker", card_type: "ENCHMT" } }, { qty: "20", card_attributes: { card_name: "Swamp", card_type: "LAND  " } }], sideboard_deck: [] }] });
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith("https://topdeck.gg/")) {
    calls.topdeck++;
    lastBody = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, "test-key", "the key goes in the Authorization header");
    if (down) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify([{ TID: "t1", tournamentName: "Highlander Weekly", startDate: 1760000000, topCut: 8, standings: [{ name: "A", standing: 1, archetype: "Jeskai Control", decklist: "~~Mainboard~~\n1 Counterspell" }] }]));
  }
  if (url === "https://www.mtgo.com/decklists") {
    calls.mtgo++;
    if (down) return new Response("", { status: 503 });
    return new Response(`<a href="/decklist/pioneer-challenge-32-${day}1">x</a>`);
  }
  if (url.startsWith("https://www.mtgo.com/decklist/")) return new Response(`<script>window.MTGO.decklists.data = ${mtgoEvent};\n</script>`);
  if (url.startsWith("https://edhtop16.com/")) {
    calls.edh++;
    return new Response(JSON.stringify({ data: { commanders: { edges: [{ node: { name: "Kinnan, Bonder Prodigy", stats: { count: 100, topCuts: 30, metaShare: 0.03, conversionRate: 0.3 }, cards: [{ imageUrls: ["art.jpg"] }], entries: { edges: [{ node: { standing: 1, wins: 5, losses: 1, draws: 0, maindeck: [{ name: "Kinnan, Bonder Prodigy", type: "Creature" }, { name: "Sol Ring", type: "Artifact" }, { name: "Island", type: "Basic Land — Island" }], player: { name: "P" }, tournament: { name: "cEDH Open", TID: "c1", size: 64, tournamentDate: day } } }] } } }] } } }));
  }
  throw Error("unexpected " + url);
};
const worker = (await import("./worker.js")).default;
const ctx = { waitUntil: (p) => p };
const get = (path, env) => worker.fetch(new Request("https://site.test" + path), env, ctx);
const noKey = { ASSETS: { fetch: () => new Response("asset") } },
  env = { ...noKey, TOPDECK_KEY: "test-key" };

// No key needed for Magic Online formats or Commander.
let d = await (await get("/api/meta/mtg?format=Pioneer", noKey)).json();
assert.equal(d.source, "Magic Online (official decklists)");
assert.equal(d.decks[0].place, "1st");
assert.equal(d.decks[0].record, "7-1");
assert.match(d.decks[0].name, /Fable of the Mirror-Breaker|Thoughtseize/, "named by its key cards");
assert.ok(d.decks[0].main.find((r) => r.name === "Swamp").land);
d = await (await get("/api/meta/mtg?format=EDH", noKey)).json();
assert.equal(d.archetypes[0].name, "Kinnan, Bonder Prodigy");
assert.equal(d.decks[0].commander, "Kinnan, Bonder Prodigy");
assert.ok(!d.decks[0].main.some((r) => r.name === "Kinnan, Bonder Prodigy"), "the commander isn't counted twice");
await new Promise((res) => setTimeout(res, 10));
await get("/api/meta/mtg?format=Pioneer", noKey);
assert.equal(calls.mtgo, 1, "second request is served from cache");

// Formats only TopDeck covers need the key.
let r = await get("/api/meta/mtg?format=Canadian%20Highlander", noKey);
assert.equal(r.status, 503);
assert.equal((await r.json()).error, "not_configured");
r = await get("/api/meta/mtg?format=Canadian%20Highlander&days=30", env);
assert.equal(r.status, 200);
assert.equal((await r.json()).decks[0].name, "Jeskai Control");
assert.deepEqual([lastBody.game, lastBody.format, lastBody.last, lastBody.participantMin], ["Magic: The Gathering", "Canadian Highlander", 30, 16]);

// Outage: the last good result is served, marked stale.
for (const k of [...store.keys()]) if (k.includes("/fresh/")) store.delete(k);
down = true;
d = await (await get("/api/meta/mtg?format=Pioneer", noKey)).json();
assert.equal(d.stale, true);
assert.equal(d.decks.length, 1, "keeps showing the last good data during an outage");
down = false;

assert.equal((await get("/api/meta/mtg?format=Bogus", env)).status, 400);
assert.equal((await get("/api/meta/mtg/coverage", noKey)).status, 503, "the TopDeck coverage report needs the key");
assert.equal(await get("/index.html", env).then((x) => x.text()), "asset", "other paths still serve the site");
console.log("PASS: Worker Magic meta — Magic Online and EDHTop16 without a key, TopDeck fallback with it, cache, stale fallback, format check.");

// Google Lens upload goes through the Worker (Lens rejects cross-site posts).
{
  const { lensUpload } = await import("./worker.js");
  const url = new URL("https://app.example/api/lens");
  const req = (h = {}, body = new Uint8Array([1, 2, 3])) => new Request(url, { method: "POST", body, headers: { "Content-Type": "image/jpeg", ...h } });
  const fakeOk = async (u, o) => { assert.equal(u, "https://lens.google.com/v3/upload?hl=en"); assert.ok(o.body.get("encoded_image")); return new Response(null, { status: 303, headers: { Location: "https://www.google.com/search?vsrid=x&udm=26" } }); };
  assert.equal((await (await lensUpload(req({ Origin: "https://app.example" }), url, fakeOk)).json()).url, "https://www.google.com/search?vsrid=x&udm=26");
  assert.equal((await lensUpload(req({ Origin: "https://evil.example" }), url, fakeOk)).status, 403);
  assert.equal((await lensUpload(req({ "Content-Type": "text/plain" }), url, fakeOk)).status, 415);
  assert.equal((await lensUpload(req(), url, async () => new Response("no", { status: 403 }))).status, 502);
  assert.equal((await lensUpload(req(), url, async () => new Response(null, { status: 302, headers: { Location: "https://evil.example/" } }))).status, 502);
  console.log("PASS: Lens upload proxy — same-site only, images only, Google links only.");
}

// Android app link file: 404 until an app is registered, then the Digital Asset Links format.
{
  const { assetLinks } = await import("./worker.js");
  assert.equal(assetLinks([]).status, 404);
  const r = assetLinks([{ package: "dev.cardstashy.app", sha256: ["AA:BB"] }]);
  const j = await r.json();
  assert.equal(j[0].target.package_name, "dev.cardstashy.app");
  assert.deepEqual(j[0].target.sha256_cert_fingerprints, ["AA:BB"]);
  assert.deepEqual(j[0].relation, ["delegate_permission/common.handle_all_urls"]);
  console.log("PASS: Android asset links file.");
}
