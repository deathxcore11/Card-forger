import {ptcgProduct,sameSubtype} from './ptcg-product.js';
import {pickGroup} from './pokemon-art.js';
import {ygoProductMatches} from './ygo-prices.js';
import {readExactYgoHistoryRequest,exactYgoHistoryCacheKey,resolveExactYgoHistoryPrinting,exactYgoHistoryGroup,exactYgoHistoryProduct,exactYgoHistoryRows,exactYgoHistoryStatus,validateExactYgoProvider} from './ygo-history-identity.js';
// Public, pinned archive snapshot. Exact provider product joins; no invented daily values.
export const ARCHIVE_COMMIT='1789c5a80de7b2b6adc287fa7a8db0970cd7b2e7';
const ROOT=`https://raw.githubusercontent.com/novaoc/rarebox-price-history/${ARCHIVE_COMMIT}`;
const SOURCE='TCGplayer archived market/mid prices via Rarebox';
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function archivePoints(points,now=Date.now()){
 const cutoff=new Date(now-365*864e5).toISOString().slice(0,10),today=new Date(now).toISOString().slice(0,10),days=new Map();
 for(const p of points || []){
  if(!Array.isArray(p)||!Number.isInteger(p[0])||p[0]<0||p[0]>100000||!Number.isFinite(p[1])||p[1]<=0||p[1]>1e7)continue;
  const date=new Date(p[0]*864e5).toISOString().slice(0,10);if(date<cutoff||date>today)continue;days.set(date,{date,value:p[1]});
 }
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export async function archivePriceRoute(url,ctx,fetchImpl=fetch,now=Date.now()){
 const game=url.searchParams.get('game'),id=url.searchParams.get('id')||'',finish=url.searchParams.get('finish')||'reference',edition=url.searchParams.get('edition')||'',rarity=url.searchParams.get('rarity')||'';
 let exact;try{exact=readExactYgoHistoryRequest(url);}catch{return Response.json({error:'Invalid exact history request'},{status:400});}
 if(!['mtg','ptcg','ygo'].includes(game)||!/^[A-Za-z0-9.!%?_:-]{1,89}$/.test(id)||!/^[A-Za-z0-9:_-]{1,99}$/.test(finish)||!/^[-A-Za-z0-9]{0,60}$/.test(edition))return Response.json({error:'Invalid history request'},{status:400});
 const cache=globalThis.caches?.default,cacheKey=exact?exactYgoHistoryCacheKey(url,exact):new Request(url.href),saved=await cache?.match(cacheKey);if(saved)return saved;
 const get=async u=>{
  const k=new Request(u),old=await cache?.match(k);if(old){const d=await old.json();return exact?validateExactYgoProvider(d,u):d;}
  const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.36 (exact historical printing lookup)'},signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('Archive source unavailable');const d=await r.json();if(exact)validateExactYgoProvider(d,u);
  ctx?.waitUntil?.(cache?.put(k,Response.json(d,{headers:{'Cache-Control':'public,max-age=43200'}})));return d;
 };
 const empty=(notice,status='unsupported')=>Response.json({game,cardId:id,finish,...exact,...(exact?{status}:{}),series:[],notice});
 try{
  let provider,productId,setKey,archiveGame,label,subtype;
  if(game==='mtg'){
   provider=await get('https://api.scryfall.com/cards/'+encodeURIComponent(id));if(provider.id!==id)return empty('Printing identity mismatch.');
   productId=finish==='etched'?provider.tcgplayer_etched_id:provider.tcgplayer_id;setKey=provider.set;archiveGame='mtg';label=`${provider.set_name} #${provider.collector_number}`;subtype={nonfoil:'normal',foil:'foil',etched:'etched'}[finish];
  }else{
   provider=game==='ptcg'?await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id)):(await get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(id))).data?.[0];
   if(String(provider?.id)!==id)return empty('Card identity mismatch.');
   archiveGame=game==='ptcg'?'pokemon':'yugioh';const category=game==='ptcg'?'3':'2';let setName,release;
   if(game==='ptcg'){
    const hit=ptcgProduct(provider,finish);
    if(!hit)return empty('Choose an exact finish to load archived prices.');
    productId=hit.productId;subtype=hit.subtype.toLowerCase();setName=provider.set?.name;label=`${setName} #${provider.localId}`;
   }else{
    const resolved=exact?await resolveExactYgoHistoryPrinting(provider,exact,get):null;release=resolved?.release;
    const versions=resolved?[resolved.set]:(provider.card_sets || []).filter(s=>s.set_code===edition && (!rarity || s.set_rarity===rarity));
    if(versions.length!==1)return empty('Choose an exact printing and rarity to load archived prices.');setName=versions[0].set_name;label=`${setName} · ${edition}`;
   }
   const [groups,joins]=await Promise.all([get(`https://tcgcsv.com/tcgplayer/${category}/groups`),get(ROOT+'/maps/groups.json')]);
   let matches=exact?[exactYgoHistoryGroup(groups.results,release)].filter(g=>g&&joins[category]?.[String(g.groupId)]):(groups.results || []).filter(g=>norm(g.name)===norm(setName)&&joins[category]?.[String(g.groupId)]);
   if(!matches.length&&game==='ptcg'){const g=pickGroup((groups.results || []).filter(x=>joins[category]?.[String(x.groupId)]),setName);if(g)matches=[g];}
   if(matches.length!==1)return empty('No unambiguous archived set mapping for this printing.');setKey=joins[category][String(matches[0].groupId)];
   if(game==='ygo' && rarity){const currentProducts=await get(`https://tcgcsv.com/tcgplayer/2/${matches[0].groupId}/products`),hits=exact?[exactYgoHistoryProduct(currentProducts.results,exact,matches[0].groupId)].filter(Boolean):ygoProductMatches({code:edition,rarity},currentProducts.results || []);if(hits.length!==1)return empty('No exact rarity mapping for this archive.');productId=hits[0].productId;}
  }
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(setKey||''))return empty('No archived set for this printing.');
  const [products,data]=await Promise.all([get(`${ROOT}/maps/products/${archiveGame}/${setKey}.json`),get(`${ROOT}/data/${archiveGame}/${setKey}.json`)]);
  let hit;
  if(game==='ygo' && !productId){
   const matches=Object.entries(products).filter(([,v])=>v[0]===edition&&!v[1]);if(matches.length!==1)return empty('This printing has an ambiguous archived product mapping.');productId=matches[0][0];hit=matches[0][1];
  }else hit=products[String(productId)];
  if(!hit||hit[1])return empty('This exact product variant has no separate archived series.');
  if(exact&&(hit[0]!==edition||Object.values(products).filter(v=>Array.isArray(v)&&v[0]===edition&&!v[1]).length!==1))return empty('No unambiguous exact archive product mapping.');
  const record=exact&&Object.hasOwn(data.cards||{},hit[0])?data.cards[hit[0]]:data.cards?.[hit[0]] || {},series=[];
  const rows=exact?exactYgoHistoryRows(record,exact):Object.entries(record);
  if(!rows)return empty('No separate archived history for this physical edition.');
  for(const [sub,raw] of rows){
   if(game==='mtg'&&sub!==subtype||game==='ptcg'&&!sameSubtype(sub,subtype))continue;const points=archivePoints(raw,now);if(!points.length)continue;
   series.push({source:`${SOURCE} · ${productId} · ${sub}`,currency:'USD',finish,...exact,...(exact?{subtype:sub}:{}),archived:true,label:`${label} · ${sub}`,productId:Number(productId),archiveCommit:ARCHIVE_COMMIT,archiveUpdated:data.updated,provenance:`${ROOT}/data/${archiveGame}/${setKey}.json`,points});
  }
  const response=Response.json({game,cardId:id,finish,...exact,...(exact?{status:series.length?'ready':'empty'}:{}),series,notice:series.length?'':'No dated archived quotes for this exact version.'},{headers:{'Cache-Control':'public,max-age=43200'}});
  ctx?.waitUntil?.(cache?.put(cacheKey,response.clone()));return response;
 }catch(e){return exact?empty(e.message,exactYgoHistoryStatus(e)):empty('Historical archive unavailable. Current and previously saved quotes remain available.');}
}
