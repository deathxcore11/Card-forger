import {ygoRarity} from './ygo-identity.js';
// One free, cached TCGCSV set response; never one paid condition request per tile.
import {rarityKey} from './ygo-prices.js';
import {referenceQuote} from './price-reference.js';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={'2025 Mega-Pack Tin':'2025 Mega-Pack'};
const pending=new Map(),sourcePending=new Map();
const productNameMatches=(product,card,rarity)=>{
 if(norm(product)===norm(card))return true;
 const m=String(product||'').match(/^(.*?)\s*\(([^()]+)\)$/);if(!m||norm(m[1])!==norm(card))return false;
 const suffix={CR:"Collector's Rare",QCR:'Quarter Century Secret Rare',UR:'Ultra Rare',SR:'Super Rare',StR:'Starlight Rare'}[m[2]]||m[2];
 return rarityKey(suffix)===rarityKey(rarity);
};
export async function ygoSetPriceRoute(url,ctx,fetchImpl=fetch){
 const name=url.searchParams.get('name')||'',code=url.searchParams.get('code')||'';
 if(!name.trim()||name.length>160||! /^[A-Z0-9-]{1,24}$/.test(code))return Response.json({error:'Invalid release'},{status:400});
 const key=new Request('https://cardstashy.cache/ygo-set-prices-v2?'+new URLSearchParams({name,code})),cache=globalThis.caches?.default;
 const cached=await cache?.match(key);if(cached)return cached;
 if(pending.has(key.url))return (await pending.get(key.url)).clone();
 const work=(async()=>{try{
  const get=async path=>{
   const source='https://tcgcsv.com/tcgplayer/2/'+path,key=new Request(source),hit=await cache?.match(key);
   if(hit)return (await hit.json()).results;
   if(sourcePending.has(source))return sourcePending.get(source);
   const read=(async()=>{
    // The provider requires an app identity and updates only once daily.
    const r=await fetchImpl(source,{headers:{'User-Agent':'CardStashy/3.82.0 (+https://cardstashy.com)','Accept':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!r.ok)throw Error('Price source unavailable');const d=await r.json();
    if(!Array.isArray(d.results)||d.results.length>20000)throw Error('Invalid source response');
    if(cache)await cache.put(key,Response.json(d,{headers:{'Cache-Control':'public,max-age=86400'}}));
    return d.results;
   })();
   sourcePending.set(source,read);try{return await read;}finally{sourcePending.delete(source);}
  };
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
  const response=Response.json({name,code,status:'ready',source:'TCGplayer via TCGCSV',updatedAt:new Date().toISOString(),products:rows},{headers:{'Cache-Control':'public,max-age=86400'}});
  ctx?.waitUntil?.(cache?.put(key,response.clone()));return response;
 }catch{return Response.json({name,code,status:'unavailable',products:[]},{status:503});}})();
 pending.set(key.url,work);try{return (await work).clone();}finally{pending.delete(key.url);}
}
export function applyYgoSetPrices(card,release,body){
 if(card?.game!=='ygo'||!release||release.providerNameAmbiguous||body?.status!=='ready'||body.name!==release.name||body.code!==release.code||!Array.isArray(body.products))return card;
 const sets=(card.sets||[]).map(p=>{
  if(p.name!==release.name||p.releasePriceAmbiguous)return p;
  const known=ygoRarity(p.rarity);
  const matches=body.products.filter(x=>x.code===p.code&&ygoRarity(x.rarity)&&(!known||rarityKey(x.rarity)===rarityKey(known))&&productNameMatches(x.name,card.name,known||x.rarity));
  if(matches.length!==1)return p;const row=matches[0];
  if(!Number.isSafeInteger(row.productId)||row.productId<1||!Array.isArray(row.quotes))return p;
  const quotes=row.quotes.filter(q=>['1st Edition','Unlimited','Limited'].includes(q.edition)&&referenceQuote(q));
  // Keep edition identity attached. Never turn a first-edition quote into a generic one.
  return {...p,rarity:known||ygoRarity(row.rarity),quotes,productId:row.productId,url:'https://www.tcgplayer.com/product/'+row.productId,priceSource:body.source,checkedAt:body.updatedAt};
 });
 return {...card,sets};
}

// Browsing a set must not require choosing a physical edition. Summarize only
// that verified release's available printing references, without selecting one
// for the detail sheet, collection value, condition lookup or price history.
export function ygoSetReference(card,{rarity='',edition=''}={}){
 const context=card?.setContext;
 if(card?.game!=='ygo'||context?.status!=='resolved'||context.releaseAmbiguous)return null;
 const rows=context.printings||[],selected=card.displayPrintingKey||'',quotes=[];
 const subtype={'1st-edition':'1st Edition',unlimited:'Unlimited',limited:'Limited'}[edition];
 if(edition&&!subtype)return null;
 for(const p of rows){
  const key=p.code+'::'+p.rarity;
  if(p.releasePriceAmbiguous||rows.filter(r=>r.code===p.code&&rarityKey(r.rarity)===rarityKey(p.rarity)).length!==1)continue;
  if(selected&&key!==selected||rarity&&rarity!=='all'&&p.rarity!==rarity)continue;
  if(p.quotes?.length){
   for(const q of p.quotes){
    if(!['1st Edition','Unlimited','Limited'].includes(q.edition)||subtype&&q.edition!==subtype||p.quotes.filter(other=>other.edition===q.edition).length!==1)continue;
    const ref=referenceQuote(q);if(ref)quotes.push({...ref,rarity:p.rarity,edition:q.edition,code:p.code});
   }
  }else if(!edition){
   const value=Number(p.price);
   if(Number.isFinite(value)&&value>0)quotes.push({value,kind:p.priceKind||'market',rarity:p.rarity,edition:'',code:p.code});
  }
 }
 if(!quotes.length)return null;
 const low=Math.min(...quotes.map(q=>q.value)),high=Math.max(...quotes.map(q=>q.value)),range=low!==high;
 const market=quotes.every(q=>q.kind==='market'),label=(market?'Market':'Listing')+(range?' range':' ref.');
 return {low,high,range,label,count:quotes.length,rarities:[...new Set(quotes.map(q=>q.rarity))],editions:[...new Set(quotes.map(q=>q.edition).filter(Boolean))],scope:context.name};
}
