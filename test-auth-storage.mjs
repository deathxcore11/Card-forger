import assert from "node:assert/strict";
import { createAuthStorage } from "./auth-storage.js";
const data = new Map(); let full = true; const LIMIT = 100;
const used = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
const store = {
  get length() { return data.size; }, key: (i) => [...data.keys()][i],
  getItem: (k) => (data.has(k) ? data.get(k) : null), removeItem: (k) => data.delete(k),
  setItem(k, v) { const old = data.get(k) || ""; if (used() - old.length + v.length + (data.has(k) ? 0 : k.length) > LIMIT) throw new DOMException("quota", "QuotaExceededError"); data.set(k, v); },
};
data.set("cardforge-names-mtg-v1", "x".repeat(50)); data.set("cf-mtg-tcg-v1", "y".repeat(30)); data.set("cardstashy-play-record-v1", "keep".repeat(3));
const a = createAuthStorage(store);
await a.setItem("sb-x-auth-token", "t".repeat(40));
assert.equal(await a.getItem("sb-x-auth-token"), "t".repeat(40));
assert.equal(data.get("sb-x-auth-token"), "t".repeat(40), "token stored in localStorage after evicting cache");
assert.equal(data.get("cardstashy-play-record-v1"), "keep".repeat(3), "user data untouched");
assert.ok(!data.has("cardforge-names-mtg-v1"), "largest cache evicted first");
// nothing evictable and still full: falls back, still readable
const data2 = new Map(); data2.set("cardstashy-play-record-v1", "k".repeat(95));
const s2 = { ...store, get length(){return data2.size;}, key:(i)=>[...data2.keys()][i], getItem:(k)=>data2.has(k)?data2.get(k):null, removeItem:(k)=>data2.delete(k), setItem(){ throw new DOMException("quota","QuotaExceededError"); } };
const b = createAuthStorage(s2);
await b.setItem("sb-y-auth-token", "z");
assert.equal(await b.getItem("sb-y-auth-token"), "z");
assert.equal(data2.get("cardstashy-play-record-v1").length, 95);
console.log("auth-storage ok");
