// Exact delivered bytes only. A loaded definition is not a tested-card claim.
export const RUNTIME_IDENTITY={wasmSha256:'a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee',glueSha256:'7317b542201dea626776001e91f8d2fcbe92ae8108c9003da6c7ed41f59149cc',sourceTree:'60fc8715ad91f5c91b81f8a8335e238c623ec957',wasmBytes:338226914};
export const RULES_IDENTITY={path:'card-rules.bin',encoding:'gzip',sha256:'0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9',bytes:3536582,decodedSha256:'6e1cfd15ae73b426ee6fb4e26c7a5d83af96e905c0f5fd3d301a3d195e40118e',decodedBytes:20102075,entries:6137};
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
export function validateRulesManifest(m){
 if(!m||Object.entries(RULES_IDENTITY).some(([k,v])=>m[k]!==v))throw Error('RULES_IDENTITY_MISMATCH');return m;
}
export function validateRuntimeManifest(m){
 if(m?.schema!==1||m.sourceTree!==RUNTIME_IDENTITY.sourceTree||m.wasmSha256!==RUNTIME_IDENTITY.wasmSha256||m.wasmBytes!==RUNTIME_IDENTITY.wasmBytes||m.glue?.sha256!==RUNTIME_IDENTITY.glueSha256||m.glue.path!=='engine_wasm.js'||m.encoding!=='gzip')throw Error('RUNTIME_IDENTITY_MISMATCH');
 if(!Array.isArray(m.chunks)||!m.chunks.length||m.chunks.length>8||!Number.isSafeInteger(m.compressedBytes)||m.compressedBytes<1||m.compressedBytes>64*1024*1024||!/^[0-9a-f]{64}$/.test(m.compressedSha256||''))throw Error('BAD_RUNTIME_MANIFEST');
 let bytes=0;for(const [i,c]of m.chunks.entries()){if(c.path!==`wasm.part-${String(i).padStart(2,'0')}.bin`||!Number.isSafeInteger(c.bytes)||c.bytes<1||c.bytes>16*1024*1024||!/^[0-9a-f]{64}$/.test(c.sha256||''))throw Error('BAD_RUNTIME_CHUNK');bytes+=c.bytes;}
 if(bytes!==m.compressedBytes)throw Error('BAD_RUNTIME_LENGTH');return m;
}
async function expandGzip(compressed,length,signal){
 const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),bytes=new Uint8Array(length);let offset=0;
 try{while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;if(offset+value.byteLength>length)throw Error('RUNTIME_EXPANSION_LIMIT');bytes.set(value,offset);offset+=value.byteLength;}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 if(offset!==length)throw Error('RUNTIME_EXPANSION_LENGTH');return bytes;
}
export async function loadEngineAssets({baseURL,fetcher=fetch,signal,onProgress=()=>{},loadCards=false,cacheStorage=globalThis.caches}){
 const base=new URL(baseURL,globalThis.location?.href);if(base.origin!==globalThis.location.origin||!base.pathname.endsWith('/'))throw Error('RUNTIME_ORIGIN_MISMATCH');
 // This immutable cache is shared across accounts; it contains engine/rules
 // assets only. Match saves and profile/deck data never enter it.
 let cache=null;try{cache=await cacheStorage?.open('cardstashy-play-runtime-'+RUNTIME_IDENTITY.wasmSha256);}catch{}
 const urlFor=path=>{const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('RUNTIME_ORIGIN_MISMATCH');return url;};
 const read=async(path,hash,length)=>{
  signal?.throwIfAborted();const url=urlFor(path);
  let cached=null;try{cached=await cache?.match(url);}catch{}
  if(cached){const b=await cached.arrayBuffer();if((length===undefined||b.byteLength===length)&&await sha(b)===hash)return b;await cache?.delete(url).catch(()=>{});}
  const response=await fetcher(url,{signal});if(!response.ok)throw Error('RUNTIME_ASSET_UNAVAILABLE');
  const bytes=await response.arrayBuffer();if(length!==undefined&&bytes.byteLength!==length||await sha(bytes)!==hash)throw Error('RUNTIME_ASSET_MISMATCH');
  signal?.throwIfAborted();try{await cache?.put(url,new Response(bytes));}catch{}return bytes;
 };
 // Only a manifest whose entire package has passed is retained for offline boot.
 const manifestURL=urlFor('manifest.json');let text;
 try{const r=await fetcher(manifestURL,{signal});if(!r.ok)throw Error('RUNTIME_ASSET_UNAVAILABLE');text=await r.text();}
 catch(error){signal?.throwIfAborted();const cached=await cache?.match(manifestURL);if(!cached)throw error;text=await cached.text();}
 if(text.length>16384)throw Error('BAD_RUNTIME_MANIFEST');const manifest=validateRuntimeManifest(JSON.parse(text));
 if(loadCards)validateRulesManifest(manifest.cardDatabase);
 const glue=await read(manifest.glue.path,RUNTIME_IDENTITY.glueSha256);
 const compressed=new Uint8Array(manifest.compressedBytes);let offset=0;
 for(const c of manifest.chunks){const b=await read(c.path,c.sha256,c.bytes);compressed.set(new Uint8Array(b),offset);offset+=b.byteLength;onProgress({stage:'download',completed:offset,total:manifest.compressedBytes});}
 if(await sha(compressed)!==manifest.compressedSha256)throw Error('RUNTIME_ARCHIVE_MISMATCH');
 const wasm=await expandGzip(compressed,RUNTIME_IDENTITY.wasmBytes,signal);
 if(await sha(wasm)!==RUNTIME_IDENTITY.wasmSha256)throw Error('RUNTIME_WASM_MISMATCH');
 let cardsJson=null,cardNames=null;
 if(loadCards){
  const m=manifest.cardDatabase,b=await read(m.path,m.sha256,m.bytes),decoded=await expandGzip(b,m.decodedBytes,signal);
  if(await sha(decoded)!==m.decodedSha256)throw Error('RULES_DATABASE_MISMATCH');
  cardsJson=new TextDecoder('utf-8',{fatal:true}).decode(decoded);cardNames=Object.keys(JSON.parse(cardsJson));
  if(cardNames.length!==m.entries)throw Error('RULES_DATABASE_MISMATCH');onProgress({stage:'rules',completed:1,total:1});
 }
 signal?.throwIfAborted();const url=URL.createObjectURL(new Blob([glue],{type:'text/javascript'}));let engine;
 try{engine=await import(url);}finally{URL.revokeObjectURL(url);}
 await engine.default({module_or_path:wasm});
 if(loadCards&&engine.load_card_database(cardsJson)!==RULES_IDENTITY.entries)throw Error('RULES_DATABASE_MISMATCH');
 try{await cache?.put(manifestURL,new Response(text,{headers:{'Content-Type':'application/json'}}));}catch{}
 onProgress({stage:'ready',completed:1,total:1});return {engine,manifest,cardNames};
}
