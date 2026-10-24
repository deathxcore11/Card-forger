import {ygoSetId,resolveYgoSet} from './ygo.js';
import {rarityKey} from './ygo-prices.js';

// Source contracts: https://ygoprodeck.com/api-guide/ and
// https://tickermint.cards/developers (per-printing USD histories). The pinned
// Rarebox fixture uses the same TCGplayer subtype labels in lowercase.
// `edition` is the existing printing-code parameter. `selectedEdition` names
// the physical edition; neither a missing edition nor a release prefix is exact.
export const YGO_HISTORY_SCHEMA='ygo-exact-v1';
const text=v=>String(v??'').normalize('NFC').trim();
const groupName=v=>text(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const editions=new Set(['1st-edition','unlimited','limited']);
const subtypeEditions=new Map([['1st edition','1st-edition'],['unlimited','unlimited'],['limited','limited']]);
// Exact joins accept named rarities and only the abbreviations already supported
// by the pricing adapter. Unknown/missing evidence never normalizes to a match.
const rarityNames=['Common','Short Print','Rare','Super Rare','Ultra Rare','Secret Rare','Ultimate Rare','Ghost Rare','Gold Rare','Gold Secret Rare','Platinum Rare','Platinum Secret Rare','Prismatic Secret Rare','Starlight Rare',"Collector's Rare",'Quarter Century Secret Rare','Premium Gold Rare','10000 Secret Rare','Normal Parallel Rare','Super Parallel Rare','Ultra Parallel Rare','Secret Parallel Rare','Duel Terminal Normal Parallel Rare','Duel Terminal Rare Parallel Rare','Duel Terminal Super Parallel Rare','Duel Terminal Ultra Parallel Rare','Duel Terminal Secret Parallel Rare','Mosaic Rare','Shatterfoil Rare','Starfoil Rare','Holographic Rare','Extra Secret Rare'];
const rarityNamesByKey=new Map(rarityNames.map(name=>[name.toLowerCase(),name.toLowerCase()]));
for(const [abbr,name] of Object.entries({ScR:'Secret Rare',StR:'Starlight Rare',UR:'Ultra Rare',SR:'Super Rare',R:'Rare',C:'Common',QCR:'Quarter Century Secret Rare'}))rarityNamesByKey.set(abbr.toLowerCase(),name.toLowerCase());
export const exactYgoRarityKey=(value,printing={})=>{
 const scoped=rarityKey(value,printing);
 if(scoped==='prismaticcollectorsrare')return "prismatic collector's rare";
 if(scoped==='prismaticultimaterare')return 'prismatic ultimate rare';
 return typeof value==='string'?rarityNamesByKey.get(value.trim().toLowerCase().replace(/\s+/g,' '))||'':'';
};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function providerObject(value){
 if(!object(value)||Object.hasOwn(value,'error')||value.success===false||Object.hasOwn(value,'errors')&&(!Array.isArray(value.errors)||value.errors.length))throw Error('History provider returned an invalid or failed response');
 return value;
}
function providerRecords(value){
 if(!Array.isArray(value))throw Error('History provider returned an invalid record list');
 for(const row of value)providerObject(row);
 return value;
}
// Validate evidence before coercion. Arrays, booleans and objects can stringify
// to numeric-looking IDs but are malformed provider metadata, not a mapping miss.
function providerId(value){
 if(!['string','number'].includes(typeof value)||!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<=0)throw Error('History provider returned an invalid identity');
 return String(value);
}
// Only the new exact path uses these strict envelope checks. Valid empty
// collections are mapping misses; absent/wrong-shaped containers are outages.
export function validateExactYgoProvider(data,url){
 if(url.endsWith('/cardsets.php')){
  providerRecords(data);if(data.some(r=>typeof r.set_name!=='string'||!r.set_name.trim()||typeof r.set_code!=='string'||!r.set_code.trim()||r.tcg_date!=null&&typeof r.tcg_date!=='string'))throw Error('Release catalogue schema unavailable');return data;
 }
 providerObject(data);
 if(url.includes('/cardinfo.php?')){
  providerRecords(data.data);for(const card of data.data){providerId(card.id);providerRecords(card.card_sets);}
 }else if(url.endsWith('/groups')||url.endsWith('/products')){
  providerRecords(data.results);
  for(const row of data.results){
   if(url.endsWith('/groups')){providerId(row.groupId);if(typeof row.name!=='string')throw Error('Group schema unavailable');}
   else{providerId(row.productId);if(Object.hasOwn(row,'groupId'))providerId(row.groupId);if(row.extendedData!=null){providerRecords(row.extendedData);if(row.extendedData.some(f=>typeof f.name!=='string'))throw Error('Product identity field schema unavailable');}}
  }
 }else if(url.endsWith('/maps/groups.json')){
  providerObject(data['2']);if(Object.values(data['2']).some(v=>typeof v!=='string'))throw Error('Archive group map schema unavailable');
 }else if(url.includes('/maps/products/yugioh/')){
  if(Object.values(data).some(v=>!Array.isArray(v)||v.length<2||typeof v[0]!=='string'||![0,1].includes(v[1])))throw Error('Archive product map schema unavailable');
 }else if(url.includes('/data/yugioh/')){
  providerObject(data.cards);for(const record of Object.values(data.cards))providerObject(record);
 }
 return data;
}

export function parseYgoHistoryRelease(id){
 if(typeof id!=='string'||id.length>8192)return null;
 try{
  const parts=id.split(':');if(parts.length!==4||parts[0]!=='ygo')return null;
  const [code,date,name]=parts.slice(1).map(decodeURIComponent),release={code,date,name};
  if(!/^[-A-Za-z0-9]{1,60}$/.test(code)||!name||/[\u0000-\u001f\u007f]/.test(name)||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)||ygoSetId(release)!==id)return null;
  if(date&&(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))return null;
  return release;
 }catch{return null;}
}
export function canRequestExactYgoHistory(q){
 const release=parseYgoHistoryRelease(q?.releaseId);
 return !!(q?.game==='ygo'&&q.selectionVerified!==false&&typeof q.cardId==='string'&&/^\d{1,12}$/.test(q.cardId)&&q.finish==='reference'&&release&&/^[-A-Za-z0-9]{1,60}$/.test(q.edition||'')&&(q.edition===release.code||q.edition.startsWith(release.code+'-'))&&typeof q.rarity==='string'&&q.rarity.trim()===q.rarity&&!!exactYgoRarityKey(q.rarity,{...release,code:q.edition})&&q.rarity.length<=100&&!/[\u0000-\u001f\u007f]/.test(q.rarity)&&editions.has(q.selectedEdition)&&q.currency==='USD');
}
export function exactYgoHistoryIdentity(q){
 return {historySchema:YGO_HISTORY_SCHEMA,game:q.game,cardId:q.cardId,finish:q.finish,releaseId:q.releaseId,edition:q.edition,rarity:q.rarity,selectedEdition:q.selectedEdition,currency:q.currency};
}
export function sameExactYgoHistoryIdentity(data,q){
 const identity=exactYgoHistoryIdentity(q);
 return canRequestExactYgoHistory(q)&&Object.entries(identity).every(([k,v])=>data?.[k]===v);
}
export function readExactYgoHistoryRequest(url){
 const p=url.searchParams;
 if(!p.has('releaseId')&&!p.has('selectedEdition'))return null;
 const q={game:p.get('game'),cardId:p.get('id'),finish:p.get('finish')||'reference',releaseId:p.get('releaseId'),edition:p.get('edition'),rarity:p.get('rarity'),selectedEdition:p.get('selectedEdition'),currency:p.get('currency')};
 if(['game','id','finish','releaseId','edition','rarity','selectedEdition','currency'].some(k=>p.getAll(k).length>1)||!canRequestExactYgoHistory(q))throw Error('Invalid exact history identity');
 return exactYgoHistoryIdentity(q);
}
export function exactYgoHistoryCacheKey(url,q){
 const key=new URL(url.origin+url.pathname);
 key.search=new URLSearchParams({...q,id:q.cardId});
 const release=parseYgoHistoryRelease(q.releaseId),rarity=exactYgoRarityKey(q.rarity,{name:release?.name,code:q.edition});
 if(rarity==="prismatic collector's rare"||rarity==='prismatic ultimate rare')key.searchParams.set('printingJoin','ra01-v1');
 return new Request(key.href);
}
// The public feeds expose TCGplayer subtype labels. Only these explicit labels
// are supported (case/whitespace differences are harmless). Never infer Normal,
// Foil, an unknown label, or a combined edition as an Unlimited/1st edition.
export function ygoHistorySubtype(value){
 return subtypeEditions.get(String(value??'').trim().toLowerCase().replace(/\s+/g,' '))||'';
}
export function exactYgoHistoryRows(data,q){
 providerObject(data);
 if(Object.values(data).some(rows=>!Array.isArray(rows)))throw Error('History provider returned invalid observations');
 const matches=Object.entries(data).filter(([sub])=>ygoHistorySubtype(sub)===q.selectedEdition);
 if(matches.length!==1)return null;
 if(!Array.isArray(matches[0][1]))throw Error('History provider returned invalid observations');
 return matches;
}
const unsupported=message=>Object.assign(new Error(message),{historyStatus:'unsupported'});
export async function resolveExactYgoHistoryPrinting(card,q,get){
 if(providerId(card?.id)!==q.cardId)throw unsupported('Card identity mismatch.');
 const catalogue=await get('https://db.ygoprodeck.com/api/v7/cardsets.php');
 if(!Array.isArray(catalogue))throw Error('Release catalogue unavailable.');
 const result=resolveYgoSet(catalogue,q.releaseId),release=result.set;
 if(result.status!=='resolved'||release.id!==q.releaseId||release.providerNameAmbiguous)throw unsupported('No unambiguous canonical release mapping.');
 if(!groupName(release.name))throw unsupported('No unambiguous provider release name.');
 // Card rows omit release dates. If more than one canonical release can map to
 // the same provider group name, the date cannot be proved and must stay unknown.
 const names=new Set(catalogue.filter(s=>groupName(s.set_name)===groupName(release.name)).map(ygoSetId).filter(Boolean));
 if(names.size!==1)throw unsupported('No unambiguous provider release name.');
 const printing={name:release.name,code:q.edition},requestedRarity=exactYgoRarityKey(q.rarity,printing);
 const versions=(card.card_sets||[]).filter(s=>typeof s.set_name==='string'&&text(s.set_name)===release.name&&s.set_code===q.edition&&!!exactYgoRarityKey(s.set_rarity,printing)&&exactYgoRarityKey(s.set_rarity,printing)===requestedRarity);
 if(versions.length!==1)throw unsupported('No exact printing and rarity in this release.');
 return {set:versions[0],release};
}
export function exactYgoHistoryGroup(groups,release){
 if(!groupName(release.name))return null;
 const hits=(groups||[]).filter(g=>groupName(g.name)===groupName(release.name));
 if(hits.length!==1)return null;providerId(hits[0].groupId);return hits[0];
}
export function exactYgoHistoryProduct(products,q,groupId){
 const release=parseYgoHistoryRelease(q.releaseId),printing={name:release?.name,code:q.edition},rarity=exactYgoRarityKey(q.rarity,printing);if(!rarity)return null;
 const collisionKey=value=>typeof value==='string'?value.toLowerCase().replace(/[^a-z0-9]/g,''):'';
 const candidates=[];let collision=false;
 for(const product of products||[]){
  const fields=product.extendedData||[],numbers=fields.filter(f=>/^(?:number|card number|cardnumber)$/i.test(String(f.name||'').trim())),rarities=fields.filter(f=>/^rarity$/i.test(String(f.name||'').trim()));
  const near=numbers.some(f=>collisionKey(f.value)===collisionKey(q.edition));
  if(!near)continue;
  // Duplicate/conflicting identity fields cannot be resolved by last-write wins.
  if(numbers.length!==1||rarities.length!==1){collision=true;continue;}
  const code=numbers[0].value,productRarity=exactYgoRarityKey(rarities[0].value,printing);
  if(!productRarity){collision=true;continue;}
  if(productRarity!==rarity)continue;
  // Punctuation removal is only a collision veto, never an equivalence rule.
  if(code!==q.edition){collision=true;continue;}
  candidates.push(product);
 }
 const hits=collision?[]:candidates;
 if(hits.length!==1)return null;
 const hit=hits[0];providerId(hit.productId);
 return !Object.hasOwn(hit,'groupId')||providerId(hit.groupId)===providerId(groupId)?hit:null;
}
export const exactYgoHistoryStatus=error=>error?.historyStatus==='unsupported'?'unsupported':'unavailable';
