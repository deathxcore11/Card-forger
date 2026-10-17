// One free, cached TCGCSV set response; never one paid condition request per tile.
import {rarityKey} from './ygo-prices.js';
import {referenceQuote} from './price-reference.js';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={'2025 Mega-Pack Tin':'2025 Mega-Pack'};
const pending=new Map();
export async function ygoSetPriceRoute(url,ctx,fetchImpl=fetch){
 const name=url.searchParams.get('name')||'',code=url.searchParams.get('code')||'';
 if(!name.trim()||name.length>160||! /^[A-Z0-9-]{1,24}$/.test(code))return Response.json({error:'Invalid release'},{status:400});
 const key=new Request('https://cardstashy.cache/ygo-set-prices-v1?'+new URLSearchParams({name,code})),cache=globalThis.caches?.default;
 const cached=await cache?.match(key);if(cached)return cached;
 if(pending.has(key.url))return (await pending.get(key.url)).clone();
 const work=(async()=>{try{
  const get=async path=>{const r=await fetchImpl('https://tcgcsv.com/tcgplayer/2/'+path,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw Error('Price source unavailable');const d=await r.json();if(!Array.isArray(d.results)||d.results.length>20000)throw Error('Invalid source response');return d.results;};
  const groups=await get('groups'),matches=groups.filter(g=>norm(g.name)===norm(aliases[name]||name)&&norm(g.abbreviation)===norm(code));
  if(matches.length!==1)return Response.json({name,code,status:'unmapped',products:[]});
  const id=matches[0].groupId;if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid group');
  const [products,prices]=await Promise.all([get(id+'/products'),get(id+'/prices')]);
  const quotes=new Map();for(const p of prices)if(referenceQuote(p)&&['1st Edition','Unlimited','Limited'].includes(p.subTypeName)){
   if(!quotes.has(p.productId))quotes.set(p.productId,[]);
   quotes.get(p.productId).push({edition:p.subTypeName,market:p.marketPrice,mid:p.midPrice,low:p.lowPrice});
  }
  const rows=products.filter(p=>p.groupId===id&&p.categoryId===2&&Number.isSafeInteger(p.productId)&&p.productId>0).map(p=>{
   const f=Object.fromEntries((p.extendedData||[]).map(x=>[norm(x.name),x.value]));
   return {name:p.name,code:f.number||f.cardnumber||'',rarity:f.rarity||'',productId:p.productId,quotes:quotes.get(p.productId)||[]};
  }).filter(p=>p.code.startsWith(code+'-')&&p.rarity);
  const response=Response.json({name,code,status:'ready',source:'TCGplayer via TCGCSV',updatedAt:new Date().toISOString(),products:rows},{headers:{'Cache-Control':'public,max-age=21600'}});
  ctx?.waitUntil?.(cache?.put(key,response.clone()));return response;
 }catch{return Response.json({name,code,status:'unavailable',products:[]},{status:503});}})();
 pending.set(key.url,work);try{return (await work).clone();}finally{pending.delete(key.url);}
}
export function applyYgoSetPrices(card,release,body){
 if(card?.game!=='ygo'||!release||release.providerNameAmbiguous||body?.status!=='ready'||body.name!==release.name||body.code!==release.code||!Array.isArray(body.products))return card;
 const sets=(card.sets||[]).map(p=>{
  if(p.name!==release.name||p.releasePriceAmbiguous)return p;
  const matches=body.products.filter(x=>x.code===p.code&&rarityKey(x.rarity)===rarityKey(p.rarity)&&norm(x.name)===norm(card.name));
  if(matches.length!==1)return p;const row=matches[0];
  if(!Number.isSafeInteger(row.productId)||row.productId<1||!Array.isArray(row.quotes))return p;
  const quotes=row.quotes.filter(q=>['1st Edition','Unlimited','Limited'].includes(q.edition)&&referenceQuote(q));
  // Keep edition identity attached. Never turn a first-edition quote into a generic one.
  return {...p,quotes,productId:row.productId,url:'https://www.tcgplayer.com/product/'+row.productId,priceSource:body.source,checkedAt:body.updatedAt};
 });
 return {...card,sets};
}
