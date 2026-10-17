import {rankScanCandidates,nameDistance,collectorKey} from './scan-signals.js';
// Compact identification metadata. Full descriptions/prices stay in the normal card adapters.
import {readRecord,writeRecord} from './storage.js';
import {nameCandidates,scanNameKey,mtgCollectors,ptcgNumbers,ygoSetCodes} from './scan.js';
const states=new Map(),loads=new Map();let manifestPromise;
const key=g=>'cardstashy-scan-catalog-v1-'+g;
const num=v=>/^\d+$/.test(String(v))?String(Number(v)):String(v||'').toLowerCase();
export function compileCatalog(pack){
 if(pack?.schema!==1||!['mtg','ptcg','ygo'].includes(pack.game)||!Array.isArray(pack.rows)||!pack.rows.length)throw Error('Invalid recognition catalogue.');
 const names=new Map(),codes=new Map(),ids=new Map(),g=pack.game;
 const push=(map,k,i)=>{if(!k)return;const a=map.get(k);if(a)a.push(i);else map.set(k,[i]);};
 pack.rows.forEach((r,i)=>{if(!Array.isArray(r)||typeof r[0]!=='string'||typeof r[1]!=='string')throw Error('Invalid recognition record.');push(names,scanNameKey(r[1]),i);push(ids,r[0],i);push(codes,g==='mtg'?r[2]+':'+collectorKey(r[3]):g==='ptcg'&&r[4]?num(r[3])+'/'+num(r[4]):g==='ygo'?r[2]:'',i);});
 return {...pack,names,codes,ids};
}
export function catalogCandidate(pack,i,exact=false){
 const r=pack.rows[i],g=pack.game;let card,print='',sub;
 if(g==='mtg'){
  const image=`https://cards.scryfall.io/normal/front/${r[0][0]}/${r[0][1]}/${r[0]}.jpg`;
  card={id:r[0],name:r[1],set:r[2],collector_number:r[3],set_name:r[4],finishes:r[5],oracle_id:r[6],lang:r[7]||'en',image_uris:{normal:image}};sub=`${r[4]} · ${r[2].toUpperCase()} #${r[3]}`;
 }else if(g==='ptcg'){
  card={id:r[0],name:r[1],game:g,set:{id:r[2],number:r[3],total:r[4],name:r[5]},image:r[6]?`https://assets.tcgdex.net/en/${r[6]}/low.webp`:'',imageLarge:r[6]?`https://assets.tcgdex.net/en/${r[6]}/high.webp`:''};sub=`${r[5]} · #${r[3]}${r[4]?'/'+r[4]:''}`;
 }else{
  print=r[2]?r[2]+'|'+r[3]:'';card={id:r[0],name:r[1],game:g,typeLine:r[5],image:`https://images.ygoprodeck.com/images/cards_small/${r[0]}.jpg`,imageLarge:`https://images.ygoprodeck.com/images/cards/${r[0]}.jpg`,sets:r[2]?[{code:r[2],rarity:r[3],name:r[4]}]:[]};sub=print?`${r[4]} · ${r[2]} · ${r[3]}`:r[5];
 }
 Object.assign(card,pack.signals?.rows?.[pack.signals.keyKind==='name'?r[1]:r[0]]||{});
 return {id:card.id,name:card.name,card,image:card.image||card.image_uris?.normal,sub,print,exact,why:exact?'Printed identifier found on this device':'Name found on this device · check printing',localReference:true};
}
export function lookupCatalog(pack,read){
 const g=pack.game,names=nameCandidates(g,read.name||read.full||'').map(scanNameKey),text=`${read.code||''}\n${read.full||''}`;
 let bestName=names.find(n=>pack.names.has(n)),fuzzy=false,indexes=[],identifierConflict=false;
 if(!bestName&&names[0]?.length>=5){const hits=[...pack.names.keys()].filter(n=>Math.abs(n.length-names[0].length)<=2).map(n=>[n,nameDistance(n,names[0],2)]).filter(([,d])=>d<=2).sort((a,b)=>a[1]-b[1]);if(hits[0]&&(!hits[1]||hits[0][1]<hits[1][1])){bestName=hits[0][0];fuzzy=true;}}
 if(g==='mtg'){const cs=mtgCollectors(read.code,read.full);identifierConflict=cs.length>1;for(const c of cs)indexes.push(...(pack.codes.get(c.set+':'+collectorKey(c.number))||[]));if(bestName&&!fuzzy)indexes=indexes.filter(i=>bestName===scanNameKey(pack.rows[i][1]));}
 if(g==='ptcg'){for(const c of ptcgNumbers(text))indexes.push(...(pack.codes.get(num(c.num)+'/'+num(c.total))||[]));indexes=indexes.filter(i=>bestName===scanNameKey(pack.rows[i][1]));}
 if(g==='ygo'){for(const c of ygoSetCodes(text))indexes.push(...(pack.codes.get(c)||[]));}
 const exact=!fuzzy&&!identifierConflict&&indexes.length>0&&new Set(indexes.map(i=>pack.rows[i][0]+(g==='ygo'?'|'+pack.rows[i][3]:''))).size===1;
 if(!indexes.length&&bestName)indexes.push(...pack.names.get(bestName));
 const cands=rankScanCandidates(g,[...new Set(indexes)].map(i=>catalogCandidate(pack,i,exact)),read).slice(0,3);
 return {cands,tried:names,local:true,fuzzy};
}

export const catalogState=g=>states.get(g)||{status:'idle'};
export async function initCatalog(g){
 if(loads.has(g))return loads.get(g);
 const p=(async()=>{try{const saved=await readRecord(key(g));if(saved){const pack=compileCatalog(saved);states.set(g,{status:'ready',pack,count:pack.rows.length,updated:pack.updated});return pack;}}catch{}
 if(!states.has(g))states.set(g,{status:'available'});return null;})();loads.set(g,p);return p;
}
export async function catalogManifest(){return manifestPromise ||= fetch('scanidx/catalog-manifest.json').then(r=>{if(!r.ok)throw Error('Recognition downloads unavailable.');return r.json();}).catch(e=>{manifestPromise=null;throw e;});}
export async function downloadCatalog(g,progress=()=>{}){
 const old=states.get(g);if(old?.status==='downloading')return;
 try{
  const manifest=await catalogManifest(),entry=manifest.games[g];if(!entry)throw Error('No catalogue for this game.');
  states.set(g,{status:'downloading',loaded:0,bytes:entry.bytes});progress();
  const response=await fetch(entry.file);if(!response.ok)throw Error('Recognition download failed.');
  const reader=response.body.getReader(),chunks=[];let size=0,last=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;if(performance.now()-last>120){states.set(g,{status:'downloading',loaded:size,bytes:entry.bytes});progress();last=performance.now();}}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  let text;
  if(bytes[0]===31&&bytes[1]===139){if(typeof DecompressionStream==='undefined')throw Error('This browser cannot unpack recognition downloads.');text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}else text=new TextDecoder().decode(bytes);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==entry.sha256)throw Error('Download was incomplete. Please retry.');
  const raw=JSON.parse(text);
  if(entry.signals){
   const extra=await fetch(entry.signals.file);if(!extra.ok)throw Error('Recognition details download failed.');
   const bytes=new Uint8Array(await extra.arrayBuffer());const value=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
   if(hash!==entry.signals.sha256)throw Error('Recognition details were incomplete. Please retry.');
   const signals=JSON.parse(value);if(signals.game!==g||signals.schema!==1)throw Error('Wrong recognition details.');raw.signals=signals;
  }
  const pack=compileCatalog(raw);if(raw.game!==g||raw.rows.length!==entry.count)throw Error('Recognition catalogue did not match this game.');
  await writeRecord(key(g),raw);states.set(g,{status:'ready',pack,count:raw.rows.length,updated:raw.updated});loads.set(g,Promise.resolve(pack));progress();return pack;
 }catch(e){states.set(g,old?.status==='ready'?{...old,error:e.message}:{status:'error',error:e.message});progress();throw e;}
}
export async function removeCatalog(g){await writeRecord(key(g),null);states.set(g,{status:'available'});loads.delete(g);}
export async function localScanMatch(g,read){const pack=await initCatalog(g);return pack?lookupCatalog(pack,read):{cands:[],tried:[],local:true};}
export function localIndexCandidate(g,id){const pack=states.get(g)?.pack,i=pack?.ids.get(String(id))?.[0];return i==null?null:catalogCandidate(pack,i,false);}
