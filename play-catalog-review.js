// Fresh public card metadata only; no deck, inventory or match record writes.
import {engineDeckFromSnapshot} from './experiments/phase-engine/match-input.mjs';
import {catalogNameKey,catalogListKey,catalogCardMatchesName,evaluateCatalogAdmission} from './experiments/phase-engine/catalog-admission.mjs';
export function createPracticeCatalogReview({lookupNames,isCurrent,now=()=>Date.now()}={}){
 if(typeof lookupNames!=='function'||typeof isCurrent!=='function')throw Error('CATALOG_REVIEW_READERS_REQUIRED');
 return async setup=>{
  const check=()=>{if(!isCurrent())throw Error('ACCOUNT_CHANGED');};check();
  const format=setup.match.format,lists={player:engineDeckFromSnapshot(setup.selected,format),opponent:engineDeckFromSnapshot(setup.opponent,format)},names=new Map();
  for(const list of Object.values(lists))for(const zone of ['main_deck','sideboard','commander'])for(const name of list[zone])names.set(catalogNameKey(name),name);
  const records=new Map(),wanted=[...names.values()];
  for(let i=0;i<wanted.length;i+=75){check();const batch=wanted.slice(i,i+75),result=await lookupNames(batch.map(name=>({name})));check();
   if(!Array.isArray(result?.data))throw Error('CATALOG_LOOKUP_INCOMPLETE');
   const data=[...result.data],unresolved=batch.filter(name=>!data.some(card=>catalogCardMatchesName(card,name)));
   // Collection lookups can reject combined names that the exact front-face
   // lookup recognizes. Retry once, but accept only the full certified identity.
   const fronts=[...new Set(unresolved.filter(name=>name.includes('//')).map(name=>name.split(/\s*\/\/\s*/)[0].trim()))];
   if(fronts.length){check();const retry=await lookupNames(fronts.map(name=>({name})));check();if(!Array.isArray(retry?.data))throw Error('CATALOG_LOOKUP_INCOMPLETE');data.push(...retry.data);}
   for(const name of batch){
    const matches=data.filter(card=>catalogCardMatchesName(card,name)),ids=new Set(matches.map(card=>card?.oracle_id).filter(id=>typeof id==='string'&&id));
    const card=ids.size===1?matches.find(card=>card.oracle_id===[...ids][0]):null;
    records.set(catalogNameKey(name),{name,canonicalName:card?.name||'',oracleId:card?.oracle_id||'',legality:card?.legalities?.[format.toLowerCase()]||'unknown'});
   }
  }
  check();const checkedAt=now(),reviews={},reasons=[];
  for(const [seat,list]of Object.entries(lists)){const unique=[...new Set([...list.main_deck,...list.sideboard,...list.commander].map(catalogNameKey))];const review={schema:1,format,listKey:catalogListKey(list,format),checkedAt,cards:unique.map(n=>records.get(n))};const gate=evaluateCatalogAdmission(list,format,review,{now:checkedAt});if(!gate.admitted)reasons.push(...gate.reasons.map(r=>(seat==='player'?'Your deck: ':'CPU deck: ')+r));reviews[seat]=review;}
  if(reasons.length){const error=Error('CATALOG_DECK_NOT_ADMITTED');error.reasons=reasons;throw error;}
  return structuredClone(reviews);
 };
}
