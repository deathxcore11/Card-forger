// Catalog legality supplements, never replaces, engine construction and coverage.
const key=n=>String(n||'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
export const catalogNameKey=key;
export function catalogListKey(list,format){return JSON.stringify([format,...['main_deck','sideboard','commander'].map(zone=>list[zone].map(key).sort())]);}
export function evaluateCatalogAdmission(list,format,review,{now=Date.now(),maxAgeMs=86400000}={}){
 const reasons=[];
 if(review?.schema!==1||review.format!==format||review.listKey!==catalogListKey(list,format))return {admitted:false,reasons:['Catalog review does not match this exact deck version.']};
 if(!Number.isSafeInteger(review.checkedAt)||review.checkedAt>now||now-review.checkedAt>maxAgeMs)reasons.push('Catalog legality needs a fresh check.');
 const names=[...new Set([...list.main_deck,...list.sideboard,...list.commander].map(key))],cards=review.cards;
 if(!Array.isArray(cards)||cards.length!==names.length||new Set(cards.map(c=>key(c?.name))).size!==names.length)return {admitted:false,reasons:[...reasons,'Catalog review is incomplete.']};
 for(const name of names){const c=cards.find(c=>key(c?.name)===name);if(!c||typeof c.oracleId!=='string'||!c.oracleId||c.legality!=='legal')reasons.push(name+': '+(c?.legality||'legality unknown')+' in '+format+'.');}
 return {admitted:reasons.length===0,reasons};
}
