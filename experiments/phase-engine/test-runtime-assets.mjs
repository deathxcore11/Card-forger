import {test} from 'node:test';import assert from 'node:assert/strict';import {validateRuntimeManifest,RUNTIME_IDENTITY,RULES_IDENTITY,loadEngineAssets} from './runtime-assets.mjs';
const m=()=>({schema:1,...RUNTIME_IDENTITY,encoding:'gzip',compressedBytes:1,compressedSha256:'a'.repeat(64),glue:{path:'engine_wasm.js',sha256:RUNTIME_IDENTITY.glueSha256},chunks:[{path:'wasm.part-00.bin',bytes:1,sha256:'b'.repeat(64)}]});
test('manifest must bind exact verified source, glue and uncompressed runtime',()=>{assert.equal(validateRuntimeManifest(m()).wasmSha256,RUNTIME_IDENTITY.wasmSha256);for(const key of ['sourceTree','wasmSha256','wasmBytes'])assert.throws(()=>validateRuntimeManifest({...m(),[key]:'other'}));});
test('chunk paths, counts and sizes cannot redirect or expand the package',()=>{for(const mutate of [x=>x.chunks[0].path='https://example.com/a',x=>x.chunks[0].path='../secret',x=>x.chunks[0].bytes=17*1024*1024,x=>x.compressedBytes=2,x=>x.chunks=[]]){const x=m();mutate(x);assert.throws(()=>validateRuntimeManifest(x));}});

test('rules database metadata must bind the exact pinned compressed and decoded bytes',async()=>{const {RULES_IDENTITY,validateRulesManifest}=await import('./runtime-assets.mjs');assert.equal(validateRulesManifest({...RULES_IDENTITY}).entries,6137);for(const key of Object.keys(RULES_IDENTITY))assert.throws(()=>validateRulesManifest({...RULES_IDENTITY,[key]:'other'}),/RULES_IDENTITY_MISMATCH/);});

// Exercise the actual loader through manifest admission, stopping at the first
// binary request. No substitute WASM, skipped hash or 338 MB allocation is needed.
function manifestProbe(t,{cached=null,download=JSON.stringify(m()),readCached,readDownload,matchError}={}){
 const location=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://cardstashy.test',href:'https://cardstashy.test/play/'}});
 t.after(()=>{if(location)Object.defineProperty(globalThis,'location',location);else delete globalThis.location;});
 const trace={matches:[],deleted:[],fetched:[],put:[]},manifestURL='https://cardstashy.test/runtime/manifest.json';
 const cache={async match(url){trace.matches.push(String(url));if(matchError)throw matchError;if(String(url)===manifestURL&&cached!==null)return {text:readCached||(async()=>cached)};return undefined;},async delete(url){trace.deleted.push(String(url));},async put(url){trace.put.push(String(url));}};
 const fetcher=async(url,{signal}={})=>{trace.fetched.push(String(url));signal?.throwIfAborted();if(String(url)===manifestURL)return {ok:true,text:readDownload||(async()=>download)};throw Error('GLUE_PROBE');};
 return {trace,manifestURL,load:options=>loadEngineAssets({baseURL:'https://cardstashy.test/runtime/',fetcher,cacheStorage:{open:async()=>cache},...options})};
}
test('a valid pinned cached manifest starts without a manifest network request',async t=>{
 const manifest={...m(),cardDatabase:{...RULES_IDENTITY}},p=manifestProbe(t,{cached:JSON.stringify(manifest)});
 await assert.rejects(p.load({loadCards:true}),/GLUE_PROBE/);
 assert.deepEqual(p.trace.fetched,['https://cardstashy.test/runtime/engine_wasm.js']);assert.deepEqual(p.trace.deleted,[]);
});
test('invalid cached manifests are evicted before downloading a replacement',async t=>{
 const cases=[['malformed JSON','{'],['oversized JSON',' '.repeat(16385)],['wrong runtime',JSON.stringify({...m(),wasmSha256:'0'.repeat(64)})],['wrong rules',JSON.stringify({...m(),cardDatabase:{...RULES_IDENTITY,entries:1}})]];
 for(const [name,cached]of cases)await t.test(name,async t=>{const p=manifestProbe(t,{cached,download:JSON.stringify({...m(),cardDatabase:{...RULES_IDENTITY}})});await assert.rejects(p.load({loadCards:true}),/GLUE_PROBE/);assert.deepEqual(p.trace.deleted,[p.manifestURL]);assert.deepEqual(p.trace.fetched,[p.manifestURL,'https://cardstashy.test/runtime/engine_wasm.js']);assert.deepEqual(p.trace.put,[]);});
});
test('missing or unreadable cache falls back to a validated download',async t=>{
 for(const matchError of [undefined,Error('CACHE_UNAVAILABLE')])await t.test(matchError?'cache read fails':'cache miss',async t=>{const p=manifestProbe(t,{matchError});await assert.rejects(p.load(),/GLUE_PROBE/);assert.deepEqual(p.trace.fetched,[p.manifestURL,'https://cardstashy.test/runtime/engine_wasm.js']);assert.deepEqual(p.trace.put,[]);});
});
test('a downloaded invalid manifest fails closed without retrying a cached alternative',async t=>{
 const p=manifestProbe(t,{download:JSON.stringify({...m(),sourceTree:'wrong'})});
 await assert.rejects(p.load(),/RUNTIME_IDENTITY_MISMATCH/);assert.deepEqual(p.trace.fetched,[p.manifestURL]);assert.deepEqual(p.trace.matches,[p.manifestURL]);assert.deepEqual(p.trace.put,[]);
});
test('aborting before manifest admission performs no cache read or network request',async t=>{
 const c=new AbortController(),reason=Error('STOP_BEFORE_MANIFEST');c.abort(reason);const p=manifestProbe(t,{cached:JSON.stringify(m())});
 await assert.rejects(p.load({signal:c.signal}),e=>e===reason);assert.deepEqual(p.trace.matches,[]);assert.deepEqual(p.trace.fetched,[]);
});
test('aborting while reading a cached manifest neither evicts it nor falls back to network',async t=>{
 const c=new AbortController(),reason=Error('STOP_CACHED_MANIFEST'),p=manifestProbe(t,{cached:'present',readCached:async()=>{c.abort(reason);return JSON.stringify(m());}});
 await assert.rejects(p.load({signal:c.signal}),e=>e===reason);assert.deepEqual(p.trace.deleted,[]);assert.deepEqual(p.trace.fetched,[]);
});
test('aborting while reading a downloaded manifest prevents binary loading and cache admission',async t=>{
 const c=new AbortController(),reason=Error('STOP_DOWNLOADED_MANIFEST'),p=manifestProbe(t,{readDownload:async()=>{c.abort(reason);return JSON.stringify(m());}});
 await assert.rejects(p.load({signal:c.signal}),e=>e===reason);assert.deepEqual(p.trace.fetched,[p.manifestURL]);assert.deepEqual(p.trace.put,[]);
});
