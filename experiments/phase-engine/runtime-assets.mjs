// Exact delivered bytes only. A loaded definition is not a tested-card claim.
import {compiledCardSupport} from './compiled-card-support.mjs';
export const RUNTIME_IDENTITY={wasmSha256:'a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee',glueSha256:'7317b542201dea626776001e91f8d2fcbe92ae8108c9003da6c7ed41f59149cc',sourceTree:'60fc8715ad91f5c91b81f8a8335e238c623ec957',wasmBytes:338226914};
export const RULES_IDENTITY={path:'card-rules.bin',encoding:'gzip',sha256:'0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9',bytes:3536582,decodedSha256:'6e1cfd15ae73b426ee6fb4e26c7a5d83af96e905c0f5fd3d301a3d195e40118e',decodedBytes:20102075,entries:6137};
export const EXPANDED_RULES_MANIFEST='manifest-rules-5cea84ef58d7.json';
export const EXPANDED_RULES_IDENTITY={"encoding":"gzip","sha256":"5cea84ef58d7a9aad43516c695e6ab297143e762ca26e4cc9c35eb17422d23b3","bytes":15896195,"decodedSha256":"4711be54f4fb53b2909e98bb839e78abe88f4a99f305dc45dd68611d4e9ac4ec","decodedBytes":100075045,"entries":36037,"chunks":[{"path":"card-rules-5cea84ef58d7.part-00.bin","bytes":1048572,"sha256":"702d3c992c78d0adb030bd541f170fd42a7d542ab06b159378f7bdf64822fc08"},{"path":"card-rules-5cea84ef58d7.part-01.bin","bytes":1048572,"sha256":"1b6ce00262287d29b40d375b36e88034c3361ad02871ea71537113ef1a4d6c4b"},{"path":"card-rules-5cea84ef58d7.part-02.bin","bytes":1048572,"sha256":"e787c88761ead14727d84e039a19d8a88c737f924d6e9db113a3b99de63288f1"},{"path":"card-rules-5cea84ef58d7.part-03.bin","bytes":1048572,"sha256":"cc7d2bf0f3e7239fdee92ee11c9bf82f7b149f6fdbd9454aced57957f8624c18"},{"path":"card-rules-5cea84ef58d7.part-04.bin","bytes":1048572,"sha256":"ca167a010d2aa4cd08a0a87b5c6d4c41b8756d4dbf198cfc07e8096e5bfdf4a6"},{"path":"card-rules-5cea84ef58d7.part-05.bin","bytes":1048572,"sha256":"29c93df5394f7f7e17e97a5cd2c805e7723d8dd4489fd5bc55bd048b4a28b473"},{"path":"card-rules-5cea84ef58d7.part-06.bin","bytes":1048572,"sha256":"5216835d4aecd1f8c3afd0a144e0d8a73649d5ae12f11000c6877a2023cf0a25"},{"path":"card-rules-5cea84ef58d7.part-07.bin","bytes":1048572,"sha256":"0e5396618ef1eda16e0d9ec756f35e42599baa0c9f3118f5a2287c5e862b478a"},{"path":"card-rules-5cea84ef58d7.part-08.bin","bytes":1048572,"sha256":"9aedddf9fa591a0b86777346bbb3207d9266fe0fafb83f41462e09ce95ada488"},{"path":"card-rules-5cea84ef58d7.part-09.bin","bytes":1048572,"sha256":"089b65ddafd5699135f9905b05eb7d08432f0f01174ea11769a6222099920a9b"},{"path":"card-rules-5cea84ef58d7.part-10.bin","bytes":1048572,"sha256":"d37effa296d1d880ed343037e2e5e3927396fa118599ff2adb22691e2df5342b"},{"path":"card-rules-5cea84ef58d7.part-11.bin","bytes":1048572,"sha256":"b302620845cc96c3a23e56315e37f1450ccc407cdd40ef92009acc7ef4dd4082"},{"path":"card-rules-5cea84ef58d7.part-12.bin","bytes":1048572,"sha256":"3fd4c5bc8d01a46df15fa41514c12c572186af37495f8382b3407f12b88da949"},{"path":"card-rules-5cea84ef58d7.part-13.bin","bytes":1048572,"sha256":"2842cd68b11f52cd9274f6258121bfb73c90c21ca0ef3297dae956925c3ed118"},{"path":"card-rules-5cea84ef58d7.part-14.bin","bytes":1048572,"sha256":"89415266c9d837be5af44d66cc499e68e6a9190099dfbe3a0576b8a4ac6f9928"},{"path":"card-rules-5cea84ef58d7.part-15.bin","bytes":167615,"sha256":"8de20a083b3811cddd1f79022b530ab1dc2be60d7d6b607da44f6a87842aa0bf"}]};
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
export function validateRulesManifest(m,expected=RULES_IDENTITY){
 if(!m||Object.entries(expected).some(([k,v])=>k==='chunks'?(!Array.isArray(m.chunks)||m.chunks.length!==v.length||v.some((c,i)=>Object.entries(c).some(([key,value])=>m.chunks[i]?.[key]!==value))):m[k]!==v)||(!expected.chunks&&m.chunks!==undefined))throw Error('RULES_IDENTITY_MISMATCH');return m;
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
// The raw JSON goes directly to WASM: round-tripping through JS numbers would
// corrupt card definitions containing integers outside Number's safe range.
export async function readRulesDatabase(manifest,{read,rulesIdentity=RULES_IDENTITY,signal,onProgress=()=>{}}){
 const m=validateRulesManifest(manifest,rulesIdentity);let compressed;
 if(m.chunks){
  compressed=new Uint8Array(m.bytes);let offset=0;
  for(let start=0;start<m.chunks.length;start+=4){
   signal?.throwIfAborted();
   const batch=await Promise.all(m.chunks.slice(start,start+4).map(c=>read(c.path,c.sha256,c.bytes)));
   for(const [i,b]of batch.entries()){
    if(b.byteLength!==m.chunks[start+i].bytes)throw Error('RULES_DATABASE_MISMATCH');
    compressed.set(new Uint8Array(b),offset);offset+=b.byteLength;
   }
   onProgress({stage:'rules-download',completed:offset,total:m.bytes});
  }
  if(offset!==m.bytes)throw Error('RULES_DATABASE_MISMATCH');
 }else compressed=await read(m.path,m.sha256,m.bytes);
 if(compressed.byteLength!==m.bytes||await sha(compressed)!==m.sha256)throw Error('RULES_DATABASE_MISMATCH');
 const decoded=await expandGzip(compressed,m.decodedBytes,signal);
 if(await sha(decoded)!==m.decodedSha256)throw Error('RULES_DATABASE_MISMATCH');
 const cardsJson=new TextDecoder('utf-8',{fatal:true}).decode(decoded),catalog=JSON.parse(cardsJson),cardNames=Object.keys(catalog),cardSupport=compiledCardSupport(catalog,m.decodedSha256);
 if(cardNames.length!==m.entries)throw Error('RULES_DATABASE_MISMATCH');
 onProgress({stage:'rules',completed:1,total:1});return {cardsJson,cardNames,cardSupport};
}
export async function loadEngineAssets({baseURL,fetcher=fetch,signal,onProgress=()=>{},loadCards=false,cacheStorage=globalThis.caches,rulesIdentity=RULES_IDENTITY,manifestPath='manifest.json'}){
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
 // This immutable package is already pinned to exact source/runtime identities.
 // A previously verified manifest can start offline without a network probe;
 // validate it again and evict an invalid entry before attempting a download.
 // Only a manifest whose entire package has passed is retained below.
 const manifestURL=urlFor(manifestPath);let text,manifest,cachedManifest=null;
 const parseManifest=value=>{if(value.length>16384)throw Error('BAD_RUNTIME_MANIFEST');const m=validateRuntimeManifest(JSON.parse(value));if(loadCards)validateRulesManifest(m.cardDatabase,rulesIdentity);return m;};
 signal?.throwIfAborted();
 try{cachedManifest=await cache?.match(manifestURL);}catch{signal?.throwIfAborted();}
 if(cachedManifest){
  try{text=await cachedManifest.text();signal?.throwIfAborted();manifest=parseManifest(text);}
  catch{signal?.throwIfAborted();try{await cache?.delete(manifestURL);}catch{}}
 }
 if(!manifest){
  signal?.throwIfAborted();const r=await fetcher(manifestURL,{signal});if(!r.ok)throw Error('RUNTIME_ASSET_UNAVAILABLE');
  text=await r.text();signal?.throwIfAborted();manifest=parseManifest(text);
 }
 const glue=await read(manifest.glue.path,RUNTIME_IDENTITY.glueSha256);
 const compressed=new Uint8Array(manifest.compressedBytes);let offset=0;
 for(const c of manifest.chunks){const b=await read(c.path,c.sha256,c.bytes);compressed.set(new Uint8Array(b),offset);offset+=b.byteLength;onProgress({stage:'download',completed:offset,total:manifest.compressedBytes});}
 if(await sha(compressed)!==manifest.compressedSha256)throw Error('RUNTIME_ARCHIVE_MISMATCH');
 const wasm=await expandGzip(compressed,RUNTIME_IDENTITY.wasmBytes,signal);
 if(await sha(wasm)!==RUNTIME_IDENTITY.wasmSha256)throw Error('RUNTIME_WASM_MISMATCH');
 let cardsJson=null,cardNames=null,cardSupport=null;
 if(loadCards){
  ({cardsJson,cardNames,cardSupport}=await readRulesDatabase(manifest.cardDatabase,{read,rulesIdentity,signal,onProgress}));
 }
 signal?.throwIfAborted();const url=URL.createObjectURL(new Blob([glue],{type:'text/javascript'}));let engine;
 try{engine=await import(url);}finally{URL.revokeObjectURL(url);}
 await engine.default({module_or_path:wasm});
 if(loadCards&&engine.load_card_database(cardsJson)!==rulesIdentity.entries)throw Error('RULES_DATABASE_MISMATCH');
 try{await cache?.put(manifestURL,new Response(text,{headers:{'Content-Type':'application/json'}}));}catch{}
 onProgress({stage:'ready',completed:1,total:1});return {engine,manifest,cardNames,cardSupport};
}
