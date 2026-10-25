import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {EXPANDED_RULES_IDENTITY,EXPANDED_RULES_MANIFEST,RULES_IDENTITY,readRulesDatabase,validateRulesManifest,validateRuntimeManifest} from './runtime-assets.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const directory=new URL('./runtime/a86578b23adcd26c/',import.meta.url);
function fixture(){
 const raw='{"test card":{"name":"Test Card","unsigned_limit":18446744073709551615}}',compressed=gzipSync(raw),parts=[];
 for(let offset=0;offset<compressed.length;offset+=13)parts.push(compressed.subarray(offset,offset+13));
 const identity={encoding:'gzip',sha256:hash(compressed),bytes:compressed.length,decodedSha256:hash(raw),decodedBytes:Buffer.byteLength(raw),entries:1,chunks:parts.map((b,i)=>({path:`part-${i}`,bytes:b.length,sha256:hash(b)}))};
 return {raw,parts,identity};
}

test('expanded manifest pins all chunks and preserves the old immutable package',async()=>{
 const original=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
 const expanded=JSON.parse(await readFile(new URL(EXPANDED_RULES_MANIFEST,directory),'utf8'));
 validateRulesManifest(original.cardDatabase);
 validateRuntimeManifest(expanded);
 validateRulesManifest(expanded.cardDatabase,EXPANDED_RULES_IDENTITY);
 assert.deepEqual(expanded.chunks,original.chunks);
 assert.equal(EXPANDED_RULES_IDENTITY.chunks.length,16);
 for(const mutate of [m=>m.chunks.pop(),m=>m.chunks.reverse(),m=>m.chunks[0].sha256='0'.repeat(64),m=>m.chunks[0].path='../foreign.bin']){
  const changed=structuredClone(expanded.cardDatabase);mutate(changed);
  assert.throws(()=>validateRulesManifest(changed,EXPANDED_RULES_IDENTITY),/RULES_IDENTITY_MISMATCH/);
 }
 assert.throws(()=>validateRulesManifest({...RULES_IDENTITY,chunks:[]}),/RULES_IDENTITY_MISMATCH/);
});

test('chunk loading retains raw u64 integers and has at most four concurrent reads',async()=>{
 const {raw,parts,identity}=fixture();let active=0,peak=0;
 const result=await readRulesDatabase(identity,{rulesIdentity:identity,read:async(path,sha256,bytes)=>{
  const part=parts[Number(path.slice(5))];assert.equal(hash(part),sha256);assert.equal(part.length,bytes);
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;return part;
 }});
 assert.equal(result.cardsJson,raw);assert.equal(peak,4);
 assert.deepEqual(result.cardNames,['test card']);
 assert.deepEqual(result.cardSupport.availableCardNames,['Test Card']);
});

test('corrupt or truncated chunks and aborted downloads fail before compilation',async()=>{
 const {parts,identity}=fixture();
 for(const corrupt of [part=>part.subarray(0,part.length-1),part=>Uint8Array.from(part,x=>x^1)]){
  await assert.rejects(readRulesDatabase(identity,{rulesIdentity:identity,read:async path=>corrupt(parts[Number(path.slice(5))])}),/RULES_DATABASE_MISMATCH/);
 }
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(readRulesDatabase(identity,{rulesIdentity:identity,signal:controller.signal,read:async()=>{calls++;}}),{name:'AbortError'});
 assert.equal(calls,0);
});

test('the exact expanded package loads all records with matching per-part and decoded hashes',async()=>{
 const result=await readRulesDatabase(EXPANDED_RULES_IDENTITY,{rulesIdentity:EXPANDED_RULES_IDENTITY,read:async(path,sha256,bytes)=>{
  const part=await readFile(new URL(path,directory));assert.equal(part.length,bytes);assert.equal(hash(part),sha256);return part;
 }});
 assert.equal(result.cardNames.length,36037);
 assert(result.cardSupport.availableCardNames.includes('Lost in the Woods'));
 assert(result.cardSupport.availableCardNames.includes('The Arkenstone // Seek the Heart'));
 assert(result.cardSupport.unimplementedCardNames.includes('Seasoned Cryomancer'));
 assert.equal(result.cardSupport.coverageVersion,'compiled-data:'+EXPANDED_RULES_IDENTITY.decodedSha256);
});
