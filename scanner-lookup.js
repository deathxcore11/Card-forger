import {initCatalog,catalogCandidate,catalogManifest,compileCatalog} from './scan-catalog.js';
import {collectorKey} from './scan-signals.js';
import {parseYgoSetCode,scanCardNameKey} from './scan.js';
import {collectorQuery,collectorQueryEmpty,collectorMatches,catalogueReleases,narrowPrintings,printingFacts} from './scan-collector.js';
const text=v=>String(v||'').trim();
const nameKey=v=>text(v).toLocaleLowerCase().replace(/\s+/g,' ');
const lookupPacks=new Map();
// A number alone can match hundreds of sets. Read our compact public identity
// pack once instead of fetching arbitrary provider pages and missing the wanted
// denominator after a detail-request cap. This does not download OCR signals.
export async function reviewLookupCatalog(game,{number=''}={}){
 const installed=await initCatalog(game);if(installed)return installed;
 // Yu-Gi-Oh! codes and Magic set/number pairs already have direct endpoints.
 // Only Pokémon fractions need the cross-set denominator index on demand.
 if(game!=='ptcg'||!number)return null;
 if(!lookupPacks.has(game))lookupPacks.set(game,(async()=>{
  const meta=(await catalogManifest()).games?.[game];
  if(!meta||!/^scanidx\/[a-z0-9-]+\.json\.gz$/.test(meta.file))return null;
  const response=await fetch(meta.file,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Recognition catalogue unavailable');
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>8000000)throw Error('Recognition catalogue too large');
  const source=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==meta.sha256)throw Error('Recognition catalogue incomplete');
  const raw=JSON.parse(source);if(raw.game!==game||raw.rows.length!==meta.count)throw Error('Recognition catalogue mismatch');
  return compileCatalog(raw);
 })().catch(()=>{lookupPacks.delete(game);return null;}));
 return lookupPacks.get(game);
}
export function scannerNumberParts(game,value) {
 const v=text(value).replace(/^#/,'');
 if(!v)return {number:'',total:'',set:''};
 if(game==='ygo'){const code=parseYgoSetCode(v);return code?{number:code,total:'',set:''}:null;}
 const match=game==='mtg'?v.match(/^(?:([a-z0-9]{2,8})\s+(?:#\s*)?)?([a-z]*\d+[a-z★☆†]*)(?:\/(\d+))?$/i):v.match(/^([a-z]*\d+[a-z★☆†]*)(?:\/(\d+))?$/i);
 if(!match)return null;
 return game==='mtg'?{set:(match[1]||'').toLowerCase(),number:match[2],total:match[3]||''}:{set:'',number:match[1],total:match[2]||''};
}
export function scannerLookupMatches(game,c,{name='',number='',set='',strictName=false,query=null}={}) {
 const card=c.card||c;
 if(name&&(strictName?nameKey(card.name)!==nameKey(name):!nameKey(card.name).includes(nameKey(name))))return false;
 // A parsed descriptor (any order, set and/or number) replaces the legacy "SET 123" form.
 if(query)return collectorMatches(game,printingFacts(game,c),query)&&(!set||printingFacts(game,c).set===String(set).toLowerCase());
 const p=scannerNumberParts(game,number);if(!p)return false;
 const actual=game==='mtg'?card.collector_number:game==='ptcg'?card.set?.number:String(c.print||'').split('|')[0];
 if(p.number&&collectorKey(actual)!==collectorKey(p.number))return false;
 if(p.total&&String(Number(card.set?.total))!==String(Number(p.total)))return false;
 const selected=set||p.set;if(selected&&(game==='mtg'?card.set:game==='ptcg'?card.set?.id:c.setReleaseId)!==selected)return false;
 return true;
}
const lookupHelp=game=>game==='ygo'?'Enter the bottom code, like LOB-EN001, or a set and number like LOB 001.':game==='mtg'?'Enter a number and/or set code in any order, like 275, NEO, 275 NEO or NEO 275.':'Enter the bottom number, like 56/111, and/or the set, like sv03.5 or Fusion Strike.';
const LIMIT=24;
// Every part typed must match. When nothing does, try the number alone, then
// the set alone, and say which part was used so a typo is visible, not hidden.
function narrowTyped(game,items,query,facts){
 const strict=items.filter(item=>collectorMatches(game,facts(item),query));
 if(strict.length)return {items:strict,by:'',partial:false};
 const loose=narrowPrintings(game,items,query,facts);
 return loose.by?{items:loose.items,by:loose.by,partial:true}:{items:[],by:'',partial:false};
}
export function createScannerLookup({requestMagic,sources,candById,match,local=reviewLookupCatalog}={}) {
 return async(game,query,{isCurrent=()=>true}={})=>{
  const name=text(query.name).slice(0,160),number=text(query.number).slice(0,40);
  if(!name&&!number)throw Error('Enter the card name or bottom number.');
  const pack=await local(game,{number});if(!isCurrent())return [];
  const releases=pack?catalogueReleases(pack):null,q=collectorQuery(game,number,{releases});
  if(!q)throw Error(lookupHelp(game));
  // A partial Yu-Gi-Oh! code ("38", "LOB") narrows a named card, never the whole game.
  if(game==='ygo'&&!name&&!q.code)throw Error('Enter the full bottom code, like LOB-001.');
  if(!name&&collectorQueryEmpty(q))throw Error(lookupHelp(game));
  if(!name&&!q.code&&!q.numbers.length)throw Error('Add the card name, or a number with the set.');
  const spec={...query,name,number,query:q};
  let found=[],narrowed=null,total=0;
  if(pack){
   const exactName=name?pack.names.get(scanCardNameKey(game,name))||[]:[];
   const mtgPair=game==='mtg'&&q.sets.length===1&&q.numbers.length===1?pack.codes.get(q.sets[0]+':'+collectorKey(q.numbers[0].number)):null;
   let indexes=q.code?pack.codes.get(q.code)||[]:mtgPair?.length?mtgPair:exactName.length&&!query.strictName?exactName:null;
   if(!indexes)indexes=pack.rows.map((_,i)=>i);
   const named=indexes.filter(i=>{const r=pack.rows[i];return pack.ids.has(r[0])&&(!name||(query.strictName?nameKey(r[1])===nameKey(name):nameKey(r[1]).includes(nameKey(name))));});
   // Exact titles first: "Mountain" should not list Mountain Goat before Mountain printings.
   const exact=named.filter(i=>nameKey(pack.rows[i][1])===nameKey(name)),pool=exact.length?exact:named;
   const result=narrowTyped(game,pool,q,i=>printingFacts(game,pack.rows[i]));
   total=result.items.length;narrowed={from:pool.length,to:total,by:result.by,partial:result.partial};
   found=result.items.slice(0,LIMIT).map(i=>catalogCandidate(pack,i,false));
  }
  const remote=!found.length;
  if(remote){
   const set=q.sets.length===1?q.sets[0]:'',num=q.numbers[0]?.number||'';
   if(game==='mtg'&&set&&num&&q.numbers.length===1){const card=await requestMagic(`/cards/${encodeURIComponent(set)}/${encodeURIComponent(num)}`).catch(()=>null);if(card?.id)found=[{id:card.id,name:card.name,card}];}
   if(game==='mtg'&&!found.length){
    const clean=v=>v.replace(/["\\]/g,'');
    const terms=['game:paper',...(name?[`name:"${clean(name)}"`]:[]),...(q.numbers.length?['('+q.numbers.map(n=>`cn:"${clean(n.number)}"`).join(' or ')+')']:[]),...(q.sets.length?['('+q.sets.map(x=>`e:${clean(x)}`).join(' or ')+')']:[])];
    const page=await requestMagic('/cards/search?'+new URLSearchParams({q:terms.join(' '),unique:'prints'}));found=(page?.data||[]).slice(0,LIMIT).map(card=>({id:card.id,name:card.name,card}));
   }else if(game==='ptcg'&&q.numbers.length){found=(await sources.ptcg.byNameNumber(name,q.numbers[0].number)).slice(0,LIMIT).map(card=>({id:card.id,name:card.name,card,localReference:true}));}
   else if(!found.length){found=(await match(game,{name,code:game==='ygo'?q.code:'',full:''},'en',true)).cands||[];}
  }
  if(!isCurrent())return [];
  const out=new Array(found.length);let index=0;
  await Promise.all(Array.from({length:Math.min(3,found.length)},async()=>{
   while(index<found.length&&isCurrent()){
    const at=index++,c=found[at];let full=c;
    try{full=await candById(game,c.id,'Manual lookup · check printing',false,{identityOnly:true,print:c.print||'',releaseName:c.releaseName||''})||c;}catch{}
    if(isCurrent()&&(!name||scannerLookupMatches(game,full,{name,strictName:query.strictName})))out[at]={...full,game,exact:false,printingConfirmed:false,reviewSource:query.strictName?'ai-hint':'number-search'};
   }
  }));
  if(!isCurrent())return [];
  let cands=out.filter(Boolean);
  // Remote results are filtered here; local ones were already narrowed above.
  if(remote){const result=narrowTyped(game,cands,q,c=>printingFacts(game,c));cands=result.items;total=cands.length;narrowed={from:out.filter(Boolean).length,to:total,by:result.by,partial:result.partial};}
  if(narrowed&&!collectorQueryEmpty(q)&&cands.length){
   const what=narrowed.partial?`Only ${narrowed.by} matched`:`${number.toUpperCase()} matches`;
   const why=`${what} · ${total} of ${narrowed.from} printing${narrowed.from===1?'':'s'}${total>cands.length?` · showing ${cands.length}`:''} · check printing`;
   cands=cands.map(c=>({...c,why,narrowed}));
  }
  return cands;
 };
}
