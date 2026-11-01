import {syncPokemonVariantAliases} from './pokemon-variant-options.js';
import {referenceQuote} from './price-reference.js';
import {pickGroup,pickProduct} from './pokemon-art.js';
import {pokemonFinishAllowed} from './pokemon-corrections.js';
import {pokemonCatalogueFallback} from './pokemon-catalogue-supplement.js';
// Exact product/finish fallback; listing estimates are explicitly distinguished.
export function applyProductPrices(card,body){
 if(body?.cardId!==card.id)return false;
 let changed=false;const updatedKeys=[];
 card.variants ||= [];
 // Edition-specific provider quotes must never fill an Unlimited or Shadowless slot.
 const known = new Set(card.variants.map(v=>String(v.productId || "")).filter(Boolean));
 for(const q of body.quotes || []) {
  const subtype=String(q.subTypeName || "");
  if(!known.has(String(q.productId)) || !/^(?:1st Edition|Unlimited) (?:Holofoil|Normal)$/.test(subtype) || !referenceQuote(q)||!pokemonFinishAllowed(card,/Holofoil$/.test(subtype)?'holofoil':'normal'))continue;
  const key="product:"+q.productId+":"+subtype.toLowerCase().replace(/ /g,"-");
  if(!card.variants.some(v=>v.key===key)){card.variants.push({key,label:subtype,productId:q.productId,usd:referenceQuote(q).value,priceKind:referenceQuote(q).kind,market:q.marketPrice,low:q.lowPrice,mid:q.midPrice,productFallback:true});changed=true;}
 }
 // A product the Worker found by set, number and name: every finish of this card is that product.
 if(body.matchedProduct){
  card.variants ||= [];
  for(const q of body.quotes || []){const key={normal:'normal',holofoil:'holofoil','reverse holofoil':'reverse-holofoil'}[String(q.subTypeName).toLowerCase()];if(key&&pokemonFinishAllowed(card,key)&&!card.variants.some(v=>v.key===key))card.variants.push({key,label:{normal:'Normal',holofoil:'Holofoil','reverse-holofoil':'Reverse Holo'}[key],usd:null});}
  for(const v of card.variants)if(!v.productId&&["normal","holofoil","reverse-holofoil"].includes(v.key))v.productId=body.matchedProduct;
 }
 for(const v of card.variants || []){
  if(v.usd!=null||!v.productId)continue;
  const matches=(body.quotes || []).filter(q=>String(q.productId)===String(v.productId)&&String(q.subTypeName).toLowerCase()===(/1st edition/i.test(v.label)?'1st edition ':/unlimited/i.test(v.label)?'unlimited ':'')+(v.pricePrinting==='Holofoil'&&['pokeball','masterball'].includes(v.foil)?'holofoil':/reverse/i.test(v.label)?'reverse holofoil':/holo/i.test(v.label)?'holofoil':'normal'));
  if(matches.length!==1||!referenceQuote(matches[0]))continue;
  const q=matches[0];updatedKeys.push(v.key);Object.assign(v,{usd:referenceQuote(q).value,priceKind:referenceQuote(q).kind,market:q.marketPrice,low:q.lowPrice,mid:q.midPrice,productFallback:true});changed=true;
 }
 if(changed){syncPokemonVariantAliases(card,updatedKeys);const best=card.variants.find(v=>v.key==='normal'&&v.usd!=null)||card.variants.find(v=>v.usd!=null);card.prices ||= {};card.prices.usd=best?.usd ?? null;card.prices.referenceVariantLabel=best?.label || "";card.prices.referenceKind=best?.priceKind||'market';card.prices.source='TCGplayer via TCGCSV';card.prices.updated=body.updatedAt;}
 return changed;
}
const setKey=s=>String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
export async function pokemonPriceRoute(url,ctx,fetchImpl=fetch){
 const id=url.searchParams.get('id') || '';
 if(!/^[A-Za-z0-9.!?_-]{1,80}$/.test(id))return Response.json({error:'Invalid card'},{status:400});
 const cacheKey=new URL(url);cacheKey.searchParams.set('schema','4');
 const cached=await caches.default.match(cacheKey.href);if(cached)return cached;
 const get=async u=>{const saved=await caches.default.match(u);if(saved)return saved.json();const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.34 (exact product pricing)'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Price source unavailable');const d=await r.json();ctx?.waitUntil?.(caches.default.put(u,Response.json(d,{headers:{'Cache-Control':'public,max-age=86400'}})));return d;};
 try{
  // Supplement cards (upstream-only, not yet served by the API) carry their exact product IDs.
  const c=await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id)).catch(e=>{const f=pokemonCatalogueFallback(id);if(f)return f;throw e;});if(c.id!==id)throw Error('Wrong printing');
  // The card's TCGplayer product: from TCGdex's variants or its per-finish prices, else found in
  // the set's TCGplayer group by collector number and name (older sets TCGdex never mapped).
  const products=new Set([...(c.variants_detailed || []).map(v=>Number(v.thirdParty?.tcgplayer)),...Object.values(c.pricing?.tcgplayer || {}).map(v=>Number(v?.productId))].filter(Boolean));
  const groups=await get('https://tcgcsv.com/tcgplayer/3/groups'),group=groups.results?.find(g=>setKey(g.name)===setKey(c.set?.name))||pickGroup(groups.results,c.set?.name);
  if(!group)return Response.json({cardId:id,quotes:[],notice:'No exact set mapping'});
  let matchedProduct=null;
  if(!products.size){const found=pickProduct((await get('https://tcgcsv.com/tcgplayer/3/'+group.groupId+'/products')).results,c);if(found){matchedProduct=found.productId;products.add(Number(found.productId));}}
  if(!products.size)return Response.json({cardId:id,quotes:[],notice:'No exact product mapping'});
  const prices=await get('https://tcgcsv.com/tcgplayer/3/'+group.groupId+'/prices');
  let quotes=(prices.results || []).filter(q=>products.has(Number(q.productId))&&referenceQuote(q));
  // A primary set can have only some of this card's exact product IDs. These
  // two named groups are bounded supplements, never a name/number price guess.
  for(const name of ['deckexclusives','miscellaneouscardsproducts']){
   const missing=new Set([...products].filter(id=>!quotes.some(q=>Number(q.productId)===id)));
   if(!missing.size)break;
   const supplemental=groups.results?.find(g=>setKey(g.name)===name);
   if(!supplemental||supplemental.groupId===group.groupId)continue;
   try{
    const extra=await get('https://tcgcsv.com/tcgplayer/3/'+supplemental.groupId+'/prices');
    quotes.push(...(extra.results||[]).filter(q=>missing.has(Number(q.productId))&&referenceQuote(q)));
   }catch{/* An optional catalogue outage must not discard the primary quotes. */}
  }
  const response=Response.json({cardId:id,quotes,matchedProduct,updatedAt:new Date().toISOString(),source:'TCGplayer via TCGCSV'},{headers:{'Cache-Control':'public,max-age=86400'}});
  ctx?.waitUntil?.(caches.default.put(cacheKey.href,response.clone()));return response;
 }catch{return Response.json({error:'Price source temporarily unavailable'},{status:503});}
}
