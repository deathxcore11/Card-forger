import {pokemonPromoRootProduct} from './pokemon-promo-evidence.js';
// Pure Pokémon identity helpers. Prices never distinguish physical variants.
export const POKEMON_VARIANT_SCHEMA=14;
export const pokemonPhysicalFinish=v=>v?.finish||({normal:'normal',holo:'holofoil',reverse:'reverse-holofoil'}[v?.type])||({'normal':'normal','holofoil':'holofoil','reverse-holofoil':'reverse-holofoil','1st-edition':'normal','1st-edition-holofoil':'holofoil',unlimited:'normal','unlimited-holofoil':'holofoil'}[v?.key])||'';
const product=v=>String(v?.thirdParty?.tcgplayer||v?.productId||'');
const legacyDetailBase=d=>'detail:'+(d.variantId||JSON.stringify([d.type,d.subtype,d.stamp,d.size]));
const detailBase=d=>legacyDetailBase({...d,...(Array.isArray(d.stamp)?{stamp:[...new Set(d.stamp)].sort()}: {})});
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
export const pokemonSourceLiteral=d=>JSON.stringify(ordered({...d,...(Array.isArray(d?.stamp)?{stamp:[...new Set(d.stamp)].sort()}: {})}));
// Retain missing dimensions as missing. A marketplace product is not a
// physical identity. Stamp order is not semantic; source occurrences retain it.
export const pokemonSourceIdentity=d=>JSON.stringify(ordered(Object.fromEntries(Object.entries(d||{}).filter(([k])=>!['pricing','thirdParty'].includes(k)).map(([k,v])=>[k,k==='stamp'&&Array.isArray(v)?[...new Set(v)].sort():v]))));
const identityKey=d=>{
 let hash=14695981039346656037n;for(const byte of new TextEncoder().encode(pokemonSourceIdentity(d)))hash=BigInt.asUintN(64,(hash^BigInt(byte))*1099511628211n);
 return 'detail:v2:'+hash.toString(16).padStart(16,'0');
};
export function pokemonDetailedRecords(card){
 const details=card?.variants_detailed||[];
 const records=details.map((d,sourceIndex)=>{
  const first=d.stamp?.includes('1st-edition'),finish=pokemonPhysicalFinish(d),special=!!(d.subtype&&d.subtype!=='unlimited'||(d.stamp||[]).some(x=>x!=='1st-edition')||d.size&&d.size!=='standard');
  const wanted=first?[d.type==='holo'?'1st-edition-holofoil':'1st-edition']:d.subtype==='unlimited'||card.variants?.firstEdition?[d.type==='holo'?'unlimited-holofoil':'unlimited',finish]:[finish];
  const bucket=wanted.find(k=>d.pricing?.tcgplayer?.[k]);
  return {detail:d,wanted,bucket,special,finish,sourceIndex};
 });
 for(const r of records){
  const d=r.detail,pid=product(d)||String(d.pricing?.tcgplayer?.[r.bucket]?.productId||'');
  // The root bucket identifies its existing product even when a detailed quote
  // arrives, disappears, or provider rows reorder. Secondary products stay detailed.
  const anchor=r.wanted.find(k=>pid&&(k===r.wanted[0]||r.bucket===k)&&String(k==='holofoil'&&pokemonPromoRootProduct(card.id)||card.pricing?.tcgplayer?.[k]?.productId||'')===pid);
  const competitors=records.filter(x=>!x.special&&x.wanted.some(k=>r.wanted.includes(k)));
  const bare=!r.special&&!r.bucket&&!d.pricing&&!d.thirdParty?.tcgplayer;
  const soleBucket=r.bucket&&competitors.length===1;
  r.key=!r.special&&(anchor||soleBucket)?anchor||r.bucket:bare&&competitors.length===1?r.wanted[0]:detailBase(d);
 }
 const counts=new Map();for(const r of records)counts.set(r.key,(counts.get(r.key)||0)+1);
 for(const r of records)if(counts.get(r.key)>1){
  // Never let Map insertion order rebind a shared finish to another product.
  const base=detailBase(r.detail),sameBase=records.filter(x=>detailBase(x.detail)===base),pid=product(r.detail);
  r.key=sameBase.length>1&&pid?base+':product:'+pid:base;
 }
 // Preserve every already-unique legacy key. Only ambiguous groups need a
 // descriptor-complete fallback. Exact duplicate literals retain occurrences.
 const grouped=new Map();for(const r of records){r.legacyKey=r.key.startsWith(detailBase(r.detail))?legacyDetailBase(r.detail)+r.key.slice(detailBase(r.detail).length):r.key;const rows=grouped.get(r.key)||[];rows.push(r);grouped.set(r.key,rows);}
 for(const rows of grouped.values())if(new Set(rows.map(r=>pokemonSourceIdentity(r.detail))).size>1)
  for(const r of rows){r.key=identityKey(r.detail);r.providerIdConflict=!!r.detail.variantId&&rows.filter(x=>x.detail.variantId===r.detail.variantId).length>1;}
 return records;
}
// A dry-run compatibility result. Callers retain an ambiguous original lot;
// this helper never writes storage or chooses a first source occurrence.
export function pokemonLegacySelection(card,key) {
 const rows=card?.variants||[],exact=rows.filter(v=>v.key===key);
 if(exact.length===1&&!/unconfirmed/i.test(exact[0].label||''))return {status:'unchanged',key,targets:[key]};
 const targets=[...new Set(rows.filter(v=>v.legacyKey===key).map(v=>v.key))];
 return targets.length===1?{status:'unique',key:targets[0],targets}:targets.length?{status:'ambiguous',key,targets}:{status:'unknown',key,targets:[]};
}
export function pokemonDetailedVariant(card,key){
 const rows=pokemonDetailedRecords(card),hits=rows.filter(r=>r.key===key);
 if(hits.length&&new Set(hits.map(r=>JSON.stringify(ordered(r.detail)))).size===1)return hits[0].detail;
 // Existing detail keys remain valid only while they identify exactly one row.
 if(key?.startsWith('detail:')){const old=rows.filter(r=>detailBase(r.detail)===key);if(old.length===1)return old[0].detail;}
 return null;
}
const signature=v=>JSON.stringify([String(v?.productId||''),pokemonPhysicalFinish(v),v?.foil??null,v?.size??null,v?.subtype??null,v?.language??null,v?.region??null,v?.edition??null,v?.artIdentity??null,[...(v?.stamps||[])].sort()]);
export function pokemonVariantAliasTarget(card,v){
 if(!v?.aliasOf||!v.productId)return null;
 const matches=(card?.variants||[]).filter(x=>x.key===v.aliasOf&&!x.aliasOf&&signature(x)===signature(v));
 return matches.length===1?matches[0]:null;
}
export function pokemonVariantChoices(card,requestedKey=''){
 const variants=card?.variants||[],requested=variants.find(v=>v.key===requestedKey),target=pokemonVariantAliasTarget(card,requested);
 return variants.filter(v=>!v.referenceOnly&&!pokemonVariantAliasTarget(card,v)).map(v=>target===v?requested:v);
}
export function samePokemonVariant(card,a,b){
 if(a===b)return true;
 const rows=card?.variants||[],left=rows.find(v=>v.key===a),right=rows.find(v=>v.key===b);
 return !!left&&!!right&&(pokemonVariantAliasTarget(card,left)||left)===(pokemonVariantAliasTarget(card,right)||right);
}
export function pokemonVariantProductConflict(card,entry={}){
 if(!entry.productId||!entry.variant)return false;
 const matches=(card?.variants||[]).filter(v=>v.key===entry.variant);
 return matches.length!==1||!matches[0].productId||String(matches[0].productId)!==String(entry.productId);
}
// Synchronize only proven aliases, without rewriting any saved owned-lot keys.
export function syncPokemonVariantAliases(card,updatedKeys=[]){
 const fields=['usd','priceKind','low','mid','market','fallback','productFallback','historyQuote'];
 for(const v of card?.variants||[]){const target=pokemonVariantAliasTarget(card,v);if(!target)continue;
  if(updatedKeys.includes(v.key)&&!updatedKeys.includes(target.key))for(const k of fields)target[k]=v[k];
  for(const k of fields)v[k]=target[k];
 }
}
