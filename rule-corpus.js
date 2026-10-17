// Browser-side, integrity-checked corpus loading. Pure lookup lives in rule-reference.js.
import {readRecord,writeRecord} from './storage.js';
import {RULE_VERSIONS,RULE_SOURCES,validateDecodedRulePack} from './rule-reference.js';
const packs=new Map();let manifestPromise;
async function sha256(raw){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),n=>n.toString(16).padStart(2,'0')).join('');}
async function loadManifest(){
 if(!manifestPromise)manifestPromise=(async()=>{
  try{const r=await fetch('rulebooks/manifest.json');if(!r.ok)throw Error();const data=await r.json();await writeRecord('cardstashy-rule-manifest-v1',data).catch(()=>{});return data;}
  catch{return readRecord('cardstashy-rule-manifest-v1').catch(()=>null);}
 })();
 const data=await manifestPromise;if(!data)manifestPromise=null;return data;
}
export async function loadRulePack(g){
 if(!RULE_VERSIONS[g])throw Error('Choose a supported game for this reference.');
 if(packs.has(g))return packs.get(g);
 const promise=(async()=>{
  const manifest=await loadManifest(),entry=manifest?.[g];
  if(!entry){manifestPromise=null;throw Error('Open the rulebook once while online to save its reference.');}
  if(entry.sha256!==RULE_VERSIONS[g]){manifestPromise=null;throw Error('The source edition changed. Reload the app to use the matching reference.');}
  const key='cardstashy-rules-'+g+'-'+entry.sha256;
  try{const saved=await readRecord(key);if(validateDecodedRulePack(saved,g,{count:entry.count,version:entry.sha256})&&await sha256(JSON.stringify(saved))===entry.sha256)return {...saved,version:entry.sha256,sources:RULE_SOURCES[g]};}catch{}
  const response=await fetch(entry.file);if(!response.ok)throw Error('Rulebook download unavailable. Try again, or open an official source.');
  const bytes=new Uint8Array(await response.arrayBuffer());let raw;
  if(bytes[0]===31&&bytes[1]===139){if(typeof DecompressionStream==='undefined')throw Error('This browser cannot unpack the reference. Use the official source links.');raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else raw=new TextDecoder().decode(bytes);
  const digest=await sha256(raw);
  if(digest!==entry.sha256)throw Error('The rulebook download was incomplete. Please retry.');
  const pack=JSON.parse(raw);if(!validateDecodedRulePack(pack,g,{count:entry.count,version:entry.sha256}))throw Error('Wrong rulebook download. Please retry.');
  await writeRecord(key,pack).catch(()=>{});return {...pack,version:entry.sha256,sources:RULE_SOURCES[g]};
 })();packs.set(g,promise);promise.catch(()=>{if(packs.get(g)===promise)packs.delete(g);});return promise;
}
