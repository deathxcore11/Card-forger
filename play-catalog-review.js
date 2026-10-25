// Fresh public card metadata only; no deck, inventory or match record writes.
import {engineDeckFromSnapshot} from './experiments/phase-engine/match-input.mjs';
import {catalogNameKey,catalogListKey,evaluateCatalogAdmission} from './experiments/phase-engine/catalog-admission.mjs';
export function createPracticeCatalogReview({lookupNames,isCurrent,now=()=>Date.now()}={}){
 if(typeof lookupNames!=='function'||typeof isCurrent!=='function')throw Error('CATALOG_REVIEW_READERS_REQUIRED');
 return async setup=>{
  const check=()=>{if(!isCurrent())throw Error('ACCOUNT_CHANGED');};check();
  const format=setup.match.format,lists={player:engineDeckFromSnapshot(setup.selected,format),opponent:engineDeckFromSnapshot(setup.opponent,format)},names=new Map();
  for(const list of Object.values(lists))for(const zone of ['main_deck','sideboard','commander'])for(const name of list[zone])names.set(catalogNameKey(name),name);
  const records=new Map(),wanted=[...names.values()];
  for(let i=0;i<wanted.length;i+=75){check();const batch=wanted.slice(i,i+75),result=await lookupNames(batch.map(name=>({name})));check();
   if(!Array.isArray(result?.data))throw Error('CATALOG_LOOKUP_INCOMPLETE');
   for(const name of batch){const card=result.data.find(c=>[c.name,...(c.card_faces||[]).map(f=>f.name)].some(n=>catalogNameKey(n)===catalogNameKey(name)));records.set(catalogNameKey(name),{name,oracleId:card?.oracle_id||'',legality:card?.legalities?.[format.toLowerCase()]||'unknown'});}
  }
  check();const checkedAt=now(),reviews={},reasons=[];
  for(const [seat,list]of Object.entries(lists)){const unique=[...new Set([...list.main_deck,...list.sideboard,...list.commander].map(catalogNameKey))];const review={schema:1,format,listKey:catalogListKey(list,format),checkedAt,cards:unique.map(n=>records.get(n))};const gate=evaluateCatalogAdmission(list,format,review,{now:checkedAt});if(!gate.admitted)reasons.push(...gate.reasons.map(r=>(seat==='player'?'Your deck: ':'CPU deck: ')+r));reviews[seat]=review;}
  if(reasons.length){const error=Error('CATALOG_DECK_NOT_ADMITTED');error.reasons=reasons;throw error;}
  return structuredClone(reviews);
 };
}
