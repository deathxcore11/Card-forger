// Sign-in storage that survives a full localStorage. Only regenerable caches are ever evicted; user data is never touched.
const EVICTABLE = [
  "cardforge-names-", "cardforge-sets-", "cardforge-ygo-sets", "cardforge-ptcg-sets", "cardforge-pokemon-sets", "cardforge-mtg-sets",
  "cf-mtg-tcg-v1", "cardstashy-public-market-history", "cardstashy-mtg-cheapest", "cardstashy-meta-trend",
  "cs.preconFaces", "cardstashy-offline-deck-art", "cardstashy-play-card-facts", "cardforge-pulse-", "cardforge-meta-v1",
  "cardstashy-price-hist-v1",
];
const memory = new Map();
let idbPromise;
function idb() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return (idbPromise ||= new Promise((resolve) => {
    try {
      const r = indexedDB.open("cardstashy-auth", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  }));
}
async function idbOp(mode, fn) {
  const db = await idb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("kv", mode), req = fn(tx.objectStore("kv"));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = tx.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}
function evict(store, protectedKey) {
  const rows = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k !== protectedKey && EVICTABLE.some((p) => k.startsWith(p))) rows.push([k, (store.getItem(k) || "").length]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  return rows.map((r) => r[0]);
}
export function createAuthStorage(store = globalThis.localStorage) {
  return {
    async getItem(key) {
      try { const v = store.getItem(key); if (v != null) return v; } catch {}
      if (memory.has(key)) return memory.get(key);
      const v = await idbOp("readonly", (s) => s.get(key));
      return v ?? null;
    },
    async setItem(key, value) {
      memory.set(key, value);
      const attempt = () => { store.setItem(key, value); };
      try { attempt(); await idbOp("readwrite", (s) => s.delete(key)); return; } catch {}
      try {
        for (const k of evict(store, key)) {
          try { store.removeItem(k); attempt(); await idbOp("readwrite", (s) => s.delete(key)); return; } catch {}
        }
      } catch {}
      // localStorage still refuses: keep the session in IndexedDB so sign-in works.
      try { store.removeItem(key); } catch {}
      await idbOp("readwrite", (s) => s.put(value, key));
    },
    async removeItem(key) {
      memory.delete(key);
      try { store.removeItem(key); } catch {}
      await idbOp("readwrite", (s) => s.delete(key));
    },
  };
}
export const authStorage = createAuthStorage();
