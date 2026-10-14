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
 const game=url.searchParams.get('game'),id=url.searchParams.get('id')||'',finish=url.searchParams.get('finish')||'reference',edition=url.searchParams.get('edition')||'';
 if(!['mtg','ptcg','ygo'].includes(game)||!/^[A-Za-z0-9.!%?_:-]{1,89}$/.test(id)||!/^[A-Za-z0-9:_-]{1,99}$/.test(finish)||!/^[-A-Za-z0-9]{0,60}$/.test(edition))return Response.json({error:'Invalid history request'},{status:400});
 const cache=globalThis.caches?.default,cacheKey=new Request(url.href),saved=await cache?.match(cacheKey);if(saved)return saved;
 const get=async u=>{
  const k=new Request(u),old=await cache?.match(k);if(old)return old.json();
  const r=await fetchImpl(u,{headers:{Accept:'application/json','User-Agent':'CardStashy/3.36 (exact historical printing lookup)'},signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('Archive source unavailable');const d=await r.json();
  ctx?.waitUntil?.(cache?.put(k,Response.json(d,{headers:{'Cache-Control':'public,max-age=43200'}})));return d;
 };
 const empty=notice=>Response.json({game,cardId:id,finish,series:[],notice});
 try{
  let provider,productId,setKey,archiveGame,label,subtype;
  if(game==='mtg'){
   provider=await get('https://api.scryfall.com/cards/'+encodeURIComponent(id));if(provider.id!==id)return empty('Printing identity mismatch.');
   productId=finish==='etched'?provider.tcgplayer_etched_id:provider.tcgplayer_id;setKey=provider.set;archiveGame='mtg';label=`${provider.set_name} #${provider.collector_number}`;subtype={nonfoil:'normal',foil:'foil',etched:'etched'}[finish];
  }else{
   provider=game==='ptcg'?await get('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id)):(await get('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+encodeURIComponent(id))).data?.[0];
   if(String(provider?.id)!==id)return empty('Card identity mismatch.');
   archiveGame=game==='ptcg'?'pokemon':'yugioh';const category=game==='ptcg'?'3':'2';let setName;
   if(game==='ptcg'){
    let variants=(provider.variants_detailed || []).filter(v=>v.thirdParty?.tcgplayer);
    if(finish.startsWith('detail:'))variants=variants.filter(v=>'detail:'+v.variantId===finish);
    else if(finish!=='reference')variants=variants.filter(v=>({normal:'normal',holo:'holofoil',reverse:'reverse-holofoil'}[v.type]||v.type)===finish);
    const products=[...new Set(variants.map(v=>Number(v.thirdParty.tcgplayer)))];
    if(products.length!==1)return empty('Choose an exact finish to load archived prices.');
    productId=products[0];subtype={normal:'normal',holo:'holofoil',reverse:'reverse holofoil'}[variants[0].type];setName=provider.set?.name;label=`${setName} #${provider.localId}`;
   }else{
    const versions=(provider.card_sets || []).filter(s=>s.set_code===edition);
    if(!versions.length)return empty('Choose a set printing to load archived prices.');setName=versions[0].set_name;label=`${setName} · ${edition}`;
   }
   const [groups,joins]=await Promise.all([get(`https://tcgcsv.com/tcgplayer/${category}/groups`),get(ROOT+'/maps/groups.json')]);
   const matches=(groups.results || []).filter(g=>norm(g.name)===norm(setName)&&joins[category]?.[String(g.groupId)]);
   if(matches.length!==1)return empty('No unambiguous archived set mapping for this printing.');setKey=joins[category][String(matches[0].groupId)];
  }
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(setKey||''))return empty('No archived set for this printing.');
  const [products,data]=await Promise.all([get(`${ROOT}/maps/products/${archiveGame}/${setKey}.json`),get(`${ROOT}/data/${archiveGame}/${setKey}.json`)]);
  let hit;
  if(game==='ygo'){
   const matches=Object.entries(products).filter(([,v])=>v[0]===edition&&!v[1]);if(matches.length!==1)return empty('This printing has an ambiguous archived product mapping.');productId=matches[0][0];hit=matches[0][1];
  }else hit=products[String(productId)];
  if(!hit||hit[1])return empty('This exact product variant has no separate archived series.');
  const record=data.cards?.[hit[0]] || {},series=[];
  for(const [sub,raw] of Object.entries(record)){
   if(game!=='ygo'&&sub!==subtype)continue;const points=archivePoints(raw,now);if(!points.length)continue;
   series.push({source:`${SOURCE} · ${productId} · ${sub}`,currency:'USD',finish,archived:true,label:`${label} · ${sub}`,productId:Number(productId),archiveCommit:ARCHIVE_COMMIT,archiveUpdated:data.updated,provenance:`${ROOT}/data/${archiveGame}/${setKey}.json`,points});
  }
  const response=Response.json({game,cardId:id,finish,series,notice:series.length?'':'No dated archived quotes for this exact version.'},{headers:{'Cache-Control':'public,max-age=43200'}});
  ctx?.waitUntil?.(cache?.put(cacheKey,response.clone()));return response;
 }catch{return empty('Historical archive unavailable. Current and previously saved quotes remain available.');}
}
