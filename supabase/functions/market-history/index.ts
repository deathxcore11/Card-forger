import {createClient} from 'npm:@supabase/supabase-js@2.110.0';
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.1.0';
const url=Deno.env.get('SUPABASE_URL')!;
const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const origin='https://cardforge2.deathxcore11.workers.dev';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const valid = (g: unknown, id: unknown, f: unknown) => typeof g === 'string' && typeof id === 'string' && typeof f === 'string'
 && ['mtg', 'ptcg', 'ygo'].includes(g) && /^[a-zA-Z0-9.!%?_:-]{1,89}$/.test(id) && /^[a-zA-Z0-9:_-]{1,99}$/.test(f)
 && (g !== 'mtg' || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
 && (g !== 'ygo' || /^[1-9][0-9]{0,9}$/.test(id))
 && (g !== 'mtg' || ['nonfoil', 'foil', 'etched'].includes(f)) && (g !== 'ygo' || f === 'reference');
async function json(u: string) {
 const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'CardStashy/3.27 (daily market history)' }, signal: AbortSignal.timeout(12000) });
 if (r.status === 400 || r.status === 404) throw invalid('Unknown card');
 if (!r.ok) throw Error('Provider unavailable');
 return r.json();
}
const price = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string') && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const baseFinish = (v: any) => ({ normal: 'normal', holo: 'holofoil', reverse: 'reverse-holofoil' } as Record<string, string>)[v.type];
const legacyFinish = (v: any) => v.stamp?.includes('1st-edition') ? (v.type === 'holo' ? '1st-edition-holofoil' : '1st-edition') : v.subtype === 'unlimited' ? (v.type === 'holo' ? 'unlimited-holofoil' : 'unlimited') : baseFinish(v);
const plainVariant = (v: any) => (!v.subtype || v.subtype === 'unlimited') && (!v.size || v.size === 'standard') && !(v.stamp || []).some((s: string) => s !== '1st-edition');
// Validate availability independently of price. Unknown keys (including inherited
// object properties) are never variants. Detailed identities must exist exactly.
export function supportedPokemonFinish(c: any, f: string): boolean {
 if (f === 'reference') return true;
 const detailed = Array.isArray(c.variants_detailed) ? c.variants_detailed : [];
 if (f.startsWith('detail:')) return detailed.some((v: any) => v.variantId != null && 'detail:' + v.variantId === f);
 const prices = c.pricing?.tcgplayer;
 if (prices && Object.hasOwn(prices, f) && prices[f] && typeof prices[f] === 'object' && Object.hasOwn(prices[f], 'marketPrice')) return true;
 if (detailed.some((v: any) => plainVariant(v) && legacyFinish(v) === f)) return true;
 const flag = ({ normal: 'normal', holofoil: 'holo', 'reverse-holofoil': 'reverse', firstEdition: 'firstEdition', wPromo: 'wPromo' } as Record<string, string>)[f];
 return !!flag && c.variants?.[flag] === true;
}
export async function current(g: string, id: string, f: string) {
 if (!valid(g, id, f)) throw invalid('Invalid card or finish');
 let name = '', set = '', value: unknown = null, source = '';
 if (g === 'mtg') {
  const c = await json('https://api.scryfall.com/cards/' + encodeURIComponent(id));
  if (c.id !== id) throw invalid('Printing mismatch');
  if (!Array.isArray(c.finishes) || !c.finishes.includes(f)) throw invalid('Unsupported finish');
  name = c.name; set = c.set; source = 'TCGplayer retail via Scryfall'; value = c.prices?.[f === 'nonfoil' ? 'usd' : 'usd_' + f];
 } else if (g === 'ptcg') {
  const c = await json('https://api.tcgdex.net/v2/en/cards/' + encodeURIComponent(id));
  if (c.id !== id) throw invalid('Printing mismatch');
  if (!supportedPokemonFinish(c, f)) throw invalid('Unsupported finish');
  name = c.name; set = c.set?.id || ''; source = 'TCGplayer market via TCGdex';
  const pricing = c.pricing?.tcgplayer || {}, detailed = Array.isArray(c.variants_detailed) ? c.variants_detailed : [];
  let q = Object.hasOwn(pricing, f) ? pricing[f] : null;
  let variants = detailed.filter((v: any) => f.startsWith('detail:') ? 'detail:' + v.variantId === f : plainVariant(v) && legacyFinish(v) === f);
  if (f === 'reference') {
   q = pricing.normal || Object.values(pricing).find((v: any) => price(v?.marketPrice) !== null);
   // A reference may pick one plain finish, never an arbitrary stamped printing.
   variants = [];
   for (const key of ['normal', 'holofoil', 'unlimited-holofoil', 'unlimited', 'reverse-holofoil']) {
    const matches = detailed.filter((v: any) => plainVariant(v) && !v.stamp?.length && legacyFinish(v) === key);
    if (matches.length) { variants = matches; break; }
   }
  } else if (f.startsWith('detail:')) {
   const candidates = Object.values(variants[0]?.pricing?.tcgplayer || {}).filter((v: any) => v && typeof v === 'object' && Object.hasOwn(v, 'marketPrice'));
   q = candidates.length === 1 ? candidates[0] : null;
  }
  value = q?.marketPrice ?? null;
  if (price(value) === null) {
   // Only a single verified product/finish may supply a fallback. No product
   // match means supported-but-unpriced, not another version's market value.
   const products = [...new Set(variants.map((v: any) => v.thirdParty?.tcgplayer).filter(Boolean))];
   const finishes = [...new Set(variants.map((v: any) => legacyFinish(v)))];
   if (products.length === 1 && finishes.length === 1) {
    try {
     const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
     const groups = await json('https://tcgcsv.com/tcgplayer/3/groups');
     const group = groups.results?.find((g: any) => norm(g.name) === norm(c.set?.name || ''));
     const sub = ({ holofoil: 'Holofoil', 'reverse-holofoil': 'Reverse Holofoil', normal: 'Normal', '1st-edition': '1st Edition', '1st-edition-holofoil': '1st Edition Holofoil', unlimited: 'Unlimited', 'unlimited-holofoil': 'Unlimited Holofoil' } as Record<string, string>)[String(finishes[0])];
     if (group && sub) {
      const rows = await json('https://tcgcsv.com/tcgplayer/3/' + group.groupId + '/prices');
      const matches = rows.results?.filter((r: any) => r.productId === products[0] && (norm(r.subTypeName) === norm(sub) || norm(r.subTypeName) === norm(sub) + 'normal')) || [];
      if (matches.length === 1) { value = matches[0].marketPrice; source = 'TCGplayer market via TCGCSV'; }
     }
    } catch { /* An unavailable optional fallback must not hide saved history. */ }
   }
  }
 } else {
  const c = (await json('https://db.ygoprodeck.com/api/v7/cardinfo.php?id=' + encodeURIComponent(id))).data?.[0];
  if (String(c?.id) !== id) throw invalid('Card mismatch');
  name = c.name; source = 'TCGplayer reference via YGOPRODeck'; value = c.card_prices?.[0]?.tcgplayer_price;
 }
 return { name, set, source, value: price(value) };
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
   const {error}=await db.rpc('merge_market_batch',{rows});if(error)throw error;
   return reply({saved:rows.length});
  }
  if(req.method!=='GET')return reply({error:'Method not allowed'},405);
  const g=u.searchParams.get('game') || '',id=u.searchParams.get('id') || '',f=u.searchParams.get('finish') || 'reference';
  if(!valid(g,id,f))return reply({error:'Invalid card'},400);
  const {data:watch,error:watchError}=await db.from('market_watch').select('*').eq('game',g).eq('card_id',id).eq('finish',f).maybeSingle();
  // Reading existing history remains usable if registration or its migration is
  // unavailable. New watches require both a verified variant and a real quote.
  let notice=watchError ? 'History registration is unavailable. Saved history is still shown.' : '';
  if(!watchError && (!watch || !Number.isFinite(Date.parse(watch.touched_at)) || Date.now()-Date.parse(watch.touched_at)>86400000)) {
   try {
    const q=await current(g,id,f);
    if(q.value===null) notice='This variant is supported but has no current USD quote. Saved history is still shown; no new tracking was added.';
    else {
     const {data:registration,error}=await db.rpc('register_market_watch',{g,c:id,f,n:q.name,s:q.set});
     if(error) notice='History registration is unavailable. Saved history is still shown.';
     else if(registration==='capacity') notice='History tracking capacity reached.';
     else if(registration==='rate_limited') notice='New history tracking is busy. Try again in a minute.';
     else if(registration!=='registered') notice='History registration is unavailable. Saved history is still shown.';
     else await save(g,id,f,q.source,[{date:new Date().toISOString().slice(0,10),value:q.value}]);
    }
   } catch(e) {
    notice=(e as any)?.status===400 ? 'That card or finish is not supported. Saved history is still shown.' : 'The provider is unavailable. Saved history is still shown.';
   }
  }
  const {data,error}=await db.from('market_series').select('source,currency,finish,points,updated_at').eq('game',g).eq('card_id',id).eq('finish',f);
  if(error)throw error;return reply({game:g,cardId:id,finish:f,series:data,notice});
 }catch{return reply({error:'History temporarily unavailable'},503);}
});
