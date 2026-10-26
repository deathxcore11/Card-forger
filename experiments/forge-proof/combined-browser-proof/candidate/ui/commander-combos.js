// Explicit, bounded community lookup. Cached against this exact deck, never
// persisted on a deck as trusted evidence and never used as a win-rate model.
import {commanderDeckRows} from './commander-evidence.js';
const key=s=>String(s||'').normalize('NFKC').split(' // ')[0].trim().toLowerCase();
const cache=new Map(),pending=new Map(),trusted=new WeakSet();
export const comboDeckKey=deck=>JSON.stringify([commanderDeckRows(deck).map(r=>[key(r.name),r.qty]).sort(),[...(deck.commanders||[]),...(deck.commander?[deck.commander]:[])].map(c=>key(typeof c==='string'?c:c.name)).sort()]);
export const cachedCommanderCombos=deck=>{const x=cache.get(comboDeckKey(deck));return x&&Date.now()-x.time<86400000?x.value:null;};
export const isCheckedComboEvidence=(value,deck)=>!!value&&trusted.has(value)&&value.deckKey===comboDeckKey(deck);
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const clip=(s,n=5000)=>String(s||'').slice(0,n);
export function normalizeComboResponse(response,deck,catalog={}){
 const rows=commanderDeckRows(deck),index=new Map(Object.values(catalog).filter(Boolean).map(c=>[key(c.name),c]));
 const counts=new Map(rows.map(r=>[key(r.name),r.qty]));
 const commanders=new Set([...(deck.commanders||[]),...(deck.commander?[deck.commander]:[])].map(c=>key(typeof c==='string'?c:c.name)));
 const included=[],rejected=[];
 for(const item of (Array.isArray(response?.combos)?response.combos:response?.combos?.included||response?.included||[]).slice(0,500)){
  const c=item.combo||item,uses=c.uses;
  if(c.status&&c.status!=='OK'||!c.id||!Array.isArray(uses)||!uses.length){rejected.push('Malformed combination');continue;}
  const needed=new Map();let valid=true;
  for(const u of uses){const name=key(u.card?.name),local=index.get(name),qty=Number(u.quantity);
   if(!name||!Number.isInteger(qty)||qty<=0||u.mustBeCommander&&!commanders.has(name)||local?.oracle_id&&u.card?.oracleId!==local.oracle_id)valid=false;
   needed.set(name,(needed.get(name)||0)+(Number.isInteger(qty)?qty:Infinity));
  }
  if([...needed].some(([n,q])=>(counts.get(n)||0)<q))valid=false;
  if(!valid){rejected.push(String(c.id));continue;}
  const results=(c.produces||[]).map(p=>clip(p.feature?.name,200));
  included.push({id:clip(c.id,100),url:'https://commanderspellbook.com/combo/'+encodeURIComponent(c.id)+'/',cards:uses.map(u=>({name:u.card.name,oracleId:u.card.oracleId||null,quantity:u.quantity,zones:u.zoneLocations||[],mustBeCommander:u.mustBeCommander===true,state:clip([u.battlefieldCardState,u.graveyardCardState,u.exileCardState,u.libraryCardState].filter(Boolean).join('\n'))})),prerequisites:clip([c.easyPrerequisites,c.notablePrerequisites,...(c.requires||[]).map(r=>r.feature?.name)].filter(Boolean).join('\n')),manaNeeded:clip(c.manaNeeded,200),steps:clip(c.description),results,bracketTag:clip(c.bracketTag,1),extraTurn:results.some(r=>/infinite extra turns/i.test(r)),massLandDenial:item.massLandDenial===true,relevant:item.relevant===true,definitelyTwoCard:item.definitelyTwoCard===true});
 }
 const value=freeze({status:'checked',deckKey:comboDeckKey(deck),included:Object.freeze(included.map(c=>Object.freeze(c))),rejected:rejected.length,source:'Commander Spellbook',retrievedAt:new Date().toISOString(),coverage:'Known indexed combinations only. Presence does not verify startup, execution timing, an outlet or absence of other combos.'});
 trusted.add(value);return value;
}
export async function lookupCommanderCombos(deck,catalog={}, {fetcher=globalThis.fetch,signal}={}){
 const fingerprint=comboDeckKey(deck),hit=cachedCommanderCombos(deck);if(hit)return hit;
 if(pending.has(fingerprint))return pending.get(fingerprint);
 const task=(async()=>{
  const commanders=new Set([...(deck.commanders||[]),...(deck.commander?[deck.commander]:[])].map(c=>key(typeof c==='string'?c:c.name))),main=[],command=[];
  for(const r of commanderDeckRows(deck))(commanders.has(key(r.name))?command:main).push({card:r.name,quantity:r.qty});
  if(main.length+command.length>250||!main.length)throw Error('Choose a bounded Commander deck before checking combinations.');
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const timer=setTimeout(abort,12000);
  try{const response=await fetcher('https://backend.commanderspellbook.com/estimate-bracket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({main,commanders:command}),signal:controller.signal});
   if(!response.ok)throw Error(response.status===429?'Combination service is busy. Try again later.':'Combination lookup is unavailable.');
   const value=normalizeComboResponse(await response.json(),deck,catalog);cache.set(fingerprint,{time:Date.now(),value});while(cache.size>32)cache.delete(cache.keys().next().value);return value;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 })();pending.set(fingerprint,task);try{return await task;}finally{pending.delete(fingerprint);}
}
