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
            "Local database is blocked. Close other CardStashy tabs and retry.",
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
export function writeRecords(records, {guardRecord = null} = {}) {
  let advanced;
  let expected;
  const conflict=()=>Object.assign(Error("Another tab changed this workspace or account. Reload before saving; your latest saved copy is protected."),{code:"WORKSPACE_CONFLICT"});
  const snapshots = records.map(([key, value]) => [
    key,
    structuredClone(value),
  ]);
  const task = async () => {
    expected=guardRecord?.value;
    advanced=guardRecord?.advance ? {...expected,revision:(Number(expected?.revision)||0)+1}:null;
    const db = await database();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        const store=tx.objectStore('records');
        const put=()=>{for(const [key,value] of snapshots)store.put(value,key);if(advanced)store.put(advanced,guardRecord.key);};
        let guardError;
        if(guardRecord){
          const check=store.get(guardRecord.key);
          check.onsuccess=()=>{
            const actual=check.result??JSON.parse(localStorage.getItem(guardRecord.key)||'null');
            if(JSON.stringify(actual)!==JSON.stringify(expected??null)){
              guardError=conflict();tx.abort();
            }else put();
          };
        }else put();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || Error("Local save failed."));
        tx.onabort = () => reject(guardError || tx.error || Error("Local save aborted."));
      });
      return;
    }
    const fallback=()=>{
    if(guardRecord && JSON.stringify(JSON.parse(localStorage.getItem(guardRecord.key)||'null'))!==JSON.stringify(expected??null))throw conflict();
    const values=advanced?[...snapshots,[guardRecord.key,advanced]]:snapshots;
    const before = values.map(([k]) => [k, localStorage.getItem(k)]);
    try {
      for (const [k, v] of values)
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
    if(globalThis.navigator?.locks?.request)return navigator.locks.request("cardstashy-local-workspace",fallback);
    if(guardRecord?.advance)throw Error("This browser cannot safely coordinate local saves. Enable browser storage or use a browser with IndexedDB support.");
    return fallback();
  };
  const run=async()=>{await task();if(advanced){guardRecord.onCommit?.(advanced);try{localStorage.setItem("cardstashy-workspace-changed",JSON.stringify({...advanced,at:Date.now()}));}catch{}}};
  const result = writeQueue.then(run, run);
  writeQueue = result.catch(() => {});
  return result;
}
export const writeRecord = (key, value, options) => writeRecords([[key, value]], options);
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
