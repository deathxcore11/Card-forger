// Collection records use one durable storage boundary, independent of card caches.
let dbPromise,
  writeQueue = Promise.resolve(),
  backend = "unopened";
async function database() {
  if (!("indexedDB" in globalThis)) {
    backend = "localStorage fallback";
    return null;
  }
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open("cardforge-workspace", 1);
      const timer = setTimeout(() => {
        dbPromise = null;
        reject(
          Error(
            "Local database is blocked. Close other Cardforge tabs and retry.",
          ),
        );
      }, 5000);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains("records"))
          r.result.createObjectStore("records");
      };
      r.onsuccess = () => {
        clearTimeout(timer);
        backend = "IndexedDB";
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => {
        clearTimeout(timer);
        dbPromise = null;
        reject(r.error || Error("Local database could not open."));
      };
    });
  return dbPromise;
}
export async function readRecord(key) {
  const db = await database();
  if (db) {
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction("records", "readonly"),
        r = tx.objectStore("records").get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
    if (value !== null) return value;
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
export function writeRecords(records) {
  const snapshots = records.map(([key, value]) => [
    key,
    structuredClone(value),
  ]);
  const task = async () => {
    const db = await database();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        for (const [key, value] of snapshots)
          tx.objectStore("records").put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || Error("Local save failed."));
        tx.onabort = () => reject(tx.error || Error("Local save aborted."));
      });
      return;
    }
    const before = snapshots.map(([k]) => [k, localStorage.getItem(k)]);
    try {
      for (const [k, v] of snapshots)
        localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      for (const [k, v] of before) {
        try {
          if (v === null) localStorage.removeItem(k);
          else localStorage.setItem(k, v);
        } catch {}
      }
      throw e;
    }
  };
  const result = writeQueue.then(task, task);
  writeQueue = result.catch(() => {});
  return result;
}
export const writeRecord = (key, value) => writeRecords([[key, value]]);
export const storageBackend = () => backend;
export async function persistenceStatus() {
  let persistent = null,
    estimate = {};
  try {
    if (navigator.storage?.persisted)
      persistent = await navigator.storage.persisted();
    if (navigator.storage?.estimate)
      estimate = await navigator.storage.estimate();
  } catch {}
  return { persistent, ...estimate, backend };
}
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
