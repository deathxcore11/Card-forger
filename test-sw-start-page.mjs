// The worker's saved start page must open a page. The server answers "/index.html" with a redirect to "/", and a
// saved redirected answer fails every navigation it is served to (net::ERR_FAILED on the first open after a release;
// seen 12 Nov in the app's web view when Ask opened the site, and reproduced in a browser against the live site).
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const origin = "https://cardstashy.test";
const stores = new Map();
const store = (name) => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); };
const keyOf = (k) => new URL(typeof k === "string" ? k : k.url, origin + "/").pathname;
const cache = (name) => ({
  match: async (k) => store(name).get(keyOf(k)),
  put: async (k, r) => { store(name).set(keyOf(k), r); },
  addAll: async (reqs) => { for (const q of reqs) store(name).set(keyOf(q), await fetchFake(q)); },
  keys: async () => [...store(name).keys()],
});
const caches = { open: async (n) => cache(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n), match: async () => undefined };
// The server: "/index.html" redirects to "/", everything else answers itself.
const answer = (path, redirected) => ({ ok: true, status: 200, statusText: "OK", type: "basic", redirected, url: origin + path, body: "page", headers: new Headers({ date: new Date().toUTCString() }), clone() { return this; } });
async function fetchFake(req) { const p = keyOf(req); return p === "/index.html" ? answer("/", true) : answer(p, false); }
const events = new Map();
const self = { location: { href: origin + "/sw.js", origin }, addEventListener: (t, f) => events.set(t, f), skipWaiting() {}, clients: { claim: async () => {} } };
class Req { constructor(url, init = {}) { this.url = new URL(url, origin + "/").href; Object.assign(this, { method: "GET", mode: "cors" }, init); } }
vm.runInNewContext(fs.readFileSync(new URL("./sw.js", import.meta.url), "utf8"), { self, caches, fetch: fetchFake, Request: Req, Response, URL, Headers, Date, Promise, Set, Map, console, setTimeout });

let waited; await (events.get("install")({ waitUntil: (p) => { waited = p; } }), waited);
const shell = [...stores.keys()].find((k) => k.startsWith("cardforge-shell-"));
const saved = store(shell).get("/index.html");
assert.ok(saved, "the start page is saved");
assert.equal(saved.redirected, false, "the saved start page is not a redirected answer");

// A copy saved by an older worker is redirected: the page still opens from a plain answer.
store(shell).set("/index.html", answer("/", true));
let served; const tasks = [];
events.get("fetch")({ request: new Req(origin + "/", { mode: "navigate" }), respondWith: (p) => { served = p; }, waitUntil: (p) => tasks.push(p) });
const page = await served;
assert.equal(page.redirected, false, "an old redirected copy is served as a plain answer");
assert.equal(page.status, 200);
await Promise.all(tasks);
console.log("PASS: the saved start page always opens a page.");
