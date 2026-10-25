// Load the already verified runtime in a dedicated rules worker. No card data.
export const RUNTIME_IDENTITY={wasmSha256:'a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee',glueSha256:'7317b542201dea626776001e91f8d2fcbe92ae8108c9003da6c7ed41f59149cc',sourceTree:'60fc8715ad91f5c91b81f8a8335e238c623ec957',wasmBytes:338226914};
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
export function validateRuntimeManifest(m){
 if(m?.schema!==1||m.sourceTree!==RUNTIME_IDENTITY.sourceTree||m.wasmSha256!==RUNTIME_IDENTITY.wasmSha256||m.wasmBytes!==RUNTIME_IDENTITY.wasmBytes||m.glue?.sha256!==RUNTIME_IDENTITY.glueSha256||m.glue.path!=='engine_wasm.js'||m.encoding!=='gzip')throw Error('RUNTIME_IDENTITY_MISMATCH');
 if(!Array.isArray(m.chunks)||!m.chunks.length||m.chunks.length>8||!Number.isSafeInteger(m.compressedBytes)||m.compressedBytes<1||m.compressedBytes>64*1024*1024||!/^[0-9a-f]{64}$/.test(m.compressedSha256||''))throw Error('BAD_RUNTIME_MANIFEST');
 let bytes=0;for(const [i,c]of m.chunks.entries()){if(c.path!==`wasm.part-${String(i).padStart(2,'0')}.bin`||!Number.isSafeInteger(c.bytes)||c.bytes<1||c.bytes>16*1024*1024||!/^[0-9a-f]{64}$/.test(c.sha256||''))throw Error('BAD_RUNTIME_CHUNK');bytes+=c.bytes;}
 if(bytes!==m.compressedBytes)throw Error('BAD_RUNTIME_LENGTH');return m;
}
export async function loadEngineAssets({baseURL,fetcher=fetch,signal,onProgress=()=>{}}){
 const base=new URL(baseURL,globalThis.location?.href);if(base.origin!==globalThis.location.origin)throw Error('RUNTIME_ORIGIN_MISMATCH');
 const read=async path=>{const url=new URL(path,base);if(url.origin!==base.origin)throw Error('RUNTIME_ORIGIN_MISMATCH');const r=await fetcher(url,{signal});if(!r.ok)throw Error('RUNTIME_ASSET_UNAVAILABLE');return r;};
 const manifestText=await (await read('manifest.json')).text();if(manifestText.length>16384)throw Error('BAD_RUNTIME_MANIFEST');const manifest=validateRuntimeManifest(JSON.parse(manifestText));
 const glue=await (await read(manifest.glue.path)).arrayBuffer();if(await sha(glue)!==RUNTIME_IDENTITY.glueSha256)throw Error('RUNTIME_GLUE_MISMATCH');
 const compressed=new Uint8Array(manifest.compressedBytes);let offset=0;
 for(const c of manifest.chunks){signal?.throwIfAborted();const b=await (await read(c.path)).arrayBuffer();if(b.byteLength!==c.bytes||await sha(b)!==c.sha256)throw Error('RUNTIME_CHUNK_MISMATCH');compressed.set(new Uint8Array(b),offset);offset+=b.byteLength;onProgress({stage:'download',completed:offset,total:manifest.compressedBytes});}
 if(await sha(compressed)!==manifest.compressedSha256)throw Error('RUNTIME_ARCHIVE_MISMATCH');
 const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),wasm=new Uint8Array(RUNTIME_IDENTITY.wasmBytes);offset=0;
 try{while(true){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;if(offset+value.byteLength>wasm.byteLength)throw Error('RUNTIME_EXPANSION_LIMIT');wasm.set(value,offset);offset+=value.byteLength;}}catch(error){await reader.cancel().catch(()=>{});throw error;}
 if(offset!==wasm.byteLength||await sha(wasm)!==RUNTIME_IDENTITY.wasmSha256)throw Error('RUNTIME_WASM_MISMATCH');
 signal?.throwIfAborted();const url=URL.createObjectURL(new Blob([glue],{type:'text/javascript'}));let engine;
 try{engine=await import(url);}finally{URL.revokeObjectURL(url);}
 await engine.default({module_or_path:wasm});onProgress({stage:'ready',completed:1,total:1});return {engine,manifest};
}
