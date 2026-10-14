import {createClient} from 'npm:@supabase/supabase-js@2.110.0';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const origin='https://cardforge2.deathxcore11.workers.dev';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const valid=(g:string,id:string,f:string)=>['mtg','ptcg','ygo'].includes(g)&&id.length<90&&/^[a-zA-Z0-9.!%?_:-]+$/.test(id)&&f.length<100&&/^[a-zA-Z0-9:_-]+$/.test(f);
async function json(u:string){const r=await fetch(u,{headers:{'Accept':'application/json','User-Agent':'CardStashy/3.27 (daily market history)'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Provider unavailable');return r.json();}
export async function current(g:string,id:string,f:string){
 let name='',set='',value:number|null=null,source='';
 if(g==='mtg') {const c=await json('https://api.scryfall.com/cards/'+id);if(c.id!==id)throw Error('Printing mismatch');name=c.name;set=c.set;source='TCGplayer retail via Scryfall';value=c.prices?.[f==='nonfoil'?'usd':'usd_'+f];if(!['nonfoil','foil','etched'].includes(f))throw Error('Choose a finish');}
 else if(g==='ptcg'){const c=await json('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(id));if(c.id!==id)throw Error('Printing mismatch');name=c.name;set=c.set?.id;source='TCGplayer market via TCGdex';let q=c.pricing?.tcgplayer?.[f];if(f==='reference'){q=c.pricing?.tcgplayer?.normal || Object.values(c.pricing?.tcgplayer || {}).find((v:any)=>v?.marketPrice!=null);}else if(f.startsWith('detail:')){const variant=c.variants_detailed?.find((v:any)=>'detail:'+v.variantId===f);const candidates=Object.values(variant?.pricing?.tcgplayer || {});q=candidates.length===1 ? candidates[0] : null;}value=q?.marketPrice ?? null;
 if(value===null){const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');const groups=await json('https://tcgcsv.com/tcgplayer/3/groups');const group=groups.results?.find((g:any)=>norm(g.name)===norm(c.set?.name || ''));const v=c.variants_detailed?.find((v:any)=>f==='reference'||'detail:'+v.variantId===f);if(group&&v?.thirdParty?.tcgplayer){const rows=await json('https://tcgcsv.com/tcgplayer/3/'+group.groupId+'/prices');const sub=({holo:'Holofoil',reverse:'Reverse Holofoil',normal:'Normal'} as any)[v.type];const matches=rows.results?.filter((r:any)=>r.productId===v.thirdParty.tcgplayer&&r.subTypeName===sub) || [];if(matches.length===1){value=matches[0].marketPrice;source='TCGplayer market via TCGCSV';}}}
 }
 else {if(f!=='reference')throw Error('Edition history unavailable');const c=(await json('https://db.ygoprodeck.com/api/v7/cardinfo.php?id='+id)).data?.[0];if(String(c?.id)!==id)throw Error('Card mismatch');name=c.name;source='TCGplayer reference via YGOPRODeck';value=c.card_prices?.[0]?.tcgplayer_price;}
 return {name,set,source,value:value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null};
}
async function save(g:string,id:string,f:string,source:string,points:unknown[]){const {error}=await db.rpc('merge_market_series',{g,c:id,f,s:source,p:points});if(error)throw error;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 try {
  const u=new URL(req.url);
  if(req.method==='POST'){
   // No browser can upload prices. GitHub signs a short-lived repository-scoped token.
   const token=req.headers.get('authorization')?.replace(/^Bearer /,'') || '';
   const {payload}=await jwtVerify(token,jwks,{issuer:'https://token.actions.githubusercontent.com',audience:'cardstashy-market-history'});
   if(payload.repository!=='deathxcore11/Card-forger'||payload.ref!=='refs/heads/claude/edit-publish-github-bpm8zu'||payload.workflow_ref!=='deathxcore11/Card-forger/.github/workflows/market-history.yml@refs/heads/claude/edit-publish-github-bpm8zu')return reply({error:'Untrusted importer'},403);
   if(Number(req.headers.get('content-length') || 0)>1000000)return reply({error:'Batch too large'},413);
   const text=await req.text();if(text.length>1000000)return reply({error:'Batch too large'},413);
   const rows=JSON.parse(text);if(!Array.isArray(rows)||rows.length>100)return reply({error:'Invalid batch'},400);
   for(const r of rows){if(!valid(r.game,r.card_id,r.finish)||!['TCGplayer retail via MTGJSON','TCGplayer retail via Scryfall','TCGplayer market via TCGdex','TCGplayer market via TCGCSV','TCGplayer reference via YGOPRODeck'].includes(r.source)||!Array.isArray(r.points)||r.points.length>366||r.points.some((p:any)=>!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(p.value)||p.value<0||p.value>10000000))throw Error('Invalid quote');}
   for(let start=0;start<rows.length;start+=8)await Promise.all(rows.slice(start,start+8).map(r=>save(r.game,r.card_id,r.finish,r.source,r.points)));
   return reply({saved:rows.length});
  }
  if(req.method!=='GET')return reply({error:'Method not allowed'},405);
  const g=u.searchParams.get('game') || '',id=u.searchParams.get('id') || '',f=u.searchParams.get('finish') || 'reference';
  if(!valid(g,id,f))return reply({error:'Invalid card'},400);
  const {data:watch}=await db.from('market_watch').select('*').eq('game',g).eq('card_id',id).eq('finish',f).maybeSingle();
  let notice='';
  if(!watch||Date.now()-Date.parse(watch.touched_at)>86400000){
   const {count}=await db.from('market_watch').select('*',{head:true,count:'exact'});
   if(!watch&&(count || 0)>=3000)notice='History tracking capacity reached.';
   else try {const q=await current(g,id,f);const {error}=await db.from('market_watch').upsert({game:g,card_id:id,finish:f,name:q.name,set_code:q.set,touched_at:new Date().toISOString()});if(error)throw error;if(q.value!==null)await save(g,id,f,q.source,[{date:new Date().toISOString().slice(0,10),value:q.value}]);}catch{notice='The provider is unavailable. Saved history is still shown.';}
  }
  const {data,error}=await db.from('market_series').select('source,currency,finish,points,updated_at').eq('game',g).eq('card_id',id).eq('finish',f);
  if(error)throw error;return reply({game:g,cardId:id,finish:f,series:data,notice});
 }catch{return reply({error:'History temporarily unavailable'},503);}
});
