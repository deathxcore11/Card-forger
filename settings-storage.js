// Cache cleanup touches only re-downloadable images in this app's shell cache.
// Never clear databases, account records, pending captures or browser site data.
export const imageCacheRequest = request => /\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(new URL(request.url).pathname);
export async function cachedImages({storage=globalThis.caches,clear=false}={}) {
  if(!storage)return {available:false,count:0};
  let count=0;
  for(const name of await storage.keys()) {
    if(!name.startsWith('cardforge-shell-'))continue;
    const cache=await storage.open(name);
    for(const request of await cache.keys())if(imageCacheRequest(request)) {
      if(!clear||await cache.delete(request))count++;
    }
  }
  return {available:true,count};
}
// This is a distinct storage pool from IndexedDB. Report text footprint rather
// than claiming an exact browser quota or number of photo bytes.
export function localStorageFootprint(storage=globalThis.localStorage) {
  let chars=0;
  for(let i=0;i<storage.length;i++) {const key=storage.key(i);chars+=key.length+(storage.getItem(key)||'').length;}
  return chars;
}
