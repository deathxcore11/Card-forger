import {RELEASE} from '../release-record.js';
// Shared real-app fixture server. This module does not import or launch a browser.
// Provider shapes use the production adapters; synthetic art tests layout only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {blank} from '../store.js';
import {cardKey} from '../core.js';
import {validateWorkspace} from '../confidence.js';
import {normalizePtcg} from '../ptcg.js';
import {normalizeYgo} from '../ygo.js';
import {pokemonDeckCover, artworkSources} from '../artwork.js';
import {validateHistory} from '../shared-history.js';
import {SUPABASE} from '../config.js';
import {COMMUNITY_ILLUSTRATIONS} from '../community-art.js';

export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const RESULTS=resolve(ROOT,'test-results');
export const GAMES=['mtg','ptcg','ygo'];
export const WIDTHS=[320,390,768,1440,2560];
export const NOW=Date.parse('2026-10-17T12:00:00.000Z'), ISO=new Date(NOW).toISOString();
const IMAGE='https://detail-fixtures.invalid';
const SVG='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#24536c"/><stop offset="1" stop-color="#b68448"/></linearGradient></defs><rect width="630" height="880" fill="url(#a)"/><circle cx="420" cy="290" r="145" fill="#e8c27d"/><path d="M0 600 180 320 400 570 630 340V880H0Z" fill="#182c4b"/><text x="30" y="65" font-size="27" fill="white">SYNTHETIC LAYOUT FIXTURE</text></svg>';
export const artEvidence='Synthetic SVGs stand in only for explicitly supplied image URLs. They validate layout, image identity and fallback behavior, not provider image availability or real card illustration pixels.';
const historyEndpoint=new URL('/functions/v1/market-history',SUPABASE.url);
const rawPtcg=(suffix,name,pricing)=>({id:`sv08-${suffix}`,name,localId:suffix,category:'Pokemon',stage:'Basic',hp:100,types:['Grass'],rarity:'Rare',image:`${IMAGE}/ptcg-${suffix}.png`,set:{id:'sv08',name:'Surging Sparks · detailed fixture set',cardCount:{official:191},releaseDate:'2024-11-08'},legal:{standard:true,expanded:true},regulationMark:'H',retreat:1,variants:{normal:true,holo:true,reverse:true},attacks:[{name:'Fixture attack',cost:['Grass'],damage:30}],pricing});
const rawYgo=(id,name,price='2.00')=>({id,name,type:'Effect Monster',frameType:'effect',race:'Dragon',attribute:'LIGHT',level:8,atk:3000,def:2500,archetype:'Blue-Eyes',desc:'A deterministic card fixture. Draw a card.',card_images:[{id}],card_sets:[{set_code:'SET-001',set_name:'First fixture printing',set_rarity:'Rare',set_price:price===null?'': '20.00'},{set_code:'SET-002',set_name:'Second fixture printing',set_rarity:'Common',set_price:price===null?'':'1.00'}],card_prices:[{tcgplayer_price:price,cardmarket_price:price===null?'':'8.50'}],misc_info:[{formats:['TCG','OCG'],tcg_date:'2002-03-08'}]});
const magic=(suffix,name,prices)=>({id:`fixture-mtg-${suffix}`,oracle_id:`oracle-${suffix}`,name,lang:'en',type_line:'Legendary Creature — Elf Druid',oracle_text:'Vigilance. Draw a card.',cmc:3,mana_cost:'{2}{G}',colors:['G'],color_identity:['G'],keywords:['Vigilance'],power:'3',toughness:'3',legalities:{standard:'legal',commander:'legal',modern:'legal'},set:'fdn',set_name:'Foundations · detailed fixture set',collector_number:'101',rarity:'rare',finishes:['nonfoil','foil','etched'],tcgplayer_id:42,tcgplayer_etched_id:43,purchase_uris:{tcgplayer:'https://www.tcgplayer.com/product/42',cardmarket:'https://www.cardmarket.com/en/Magic/Products/Singles/Foundations/Fixture',cardhoarder:'https://www.cardhoarder.com/cards/1234'},image_uris:{normal:`${IMAGE}/mtg-${suffix}.png`,small:`${IMAGE}/mtg-${suffix}.png`,art_crop:`${IMAGE}/mtg-${suffix}-crop.png`},prices,checkedAt:ISO,full:true,released_at:'2024-11-15'});
export const RAW={
 ptcg:[rawPtcg('001','Dhelmise V',{tcgplayer:{normal:{marketPrice:2,productId:111},holofoil:{marketPrice:5,productId:222},'reverse-holofoil':{marketPrice:null,productId:333},updated:'2026-10-16'},cardmarket:{trend:3.25,idProduct:444}}),rawPtcg('002','Unknown Pokémon',{}),rawPtcg('003','Personal Pokémon',{}),rawPtcg('004','Dated Pokémon',{tcgplayer:{normal:{marketPrice:7,productId:777},updated:'2020-01-01'}})],
 ygo:[rawYgo(89631139,'Blue-Eyes White Dragon'),rawYgo(38517737,'Blue-Eyes Alternative White Dragon'),rawYgo(30576089,'Unknown Dragon',null),rawYgo(46986414,'Personal Dragon',null)]
};
// One recognizable featured printing, with deliberately synthetic product/price data.
Object.assign(RAW.ptcg[0],{id:'swsh1-9',localId:'9',set:{id:'swsh1',name:'Sword & Shield',cardCount:{official:202},releaseDate:'2020-02-07'}});
export const CARDS={
 mtg:[magic('current','Current fixture commander',{usd:'12.50',usd_foil:'15.75',usd_etched:'21.25',eur:'9.30',eur_foil:'11.20',tix:'0.04'}),magic('unknown','Unknown fixture commander',{usd:null,usd_foil:null,usd_etched:null}),magic('eur','EUR only fixture commander',{usd:null,usd_foil:null,usd_etched:null,eur:'9.30'}),magic('personal','Private fixture commander',{usd:null,usd_foil:null,usd_etched:null})],
 ptcg:RAW.ptcg.map(c=>({...normalizePtcg(c),fetchedAt:ISO,printPriceSchema:1})),
 ygo:RAW.ygo.map(c=>({...normalizeYgo(c),fetchedAt:ISO,printPriceSchema:1}))
};
// Preserve the provider's exact printing, rarity and product distinction.
CARDS.ygo[0].sets[0]={...CARDS.ygo[0].sets[0],productId:555,checkedAt:ISO,quotes:[{edition:'Unlimited',market:20}]};
CARDS.ygo[0].sets[1]={...CARDS.ygo[0].sets[1],productId:556,checkedAt:ISO};
CARDS.ygo[0].sets.push({code:'SET-001',name:'Same-code different-rarity fixture',rarity:'Super Rare',price:null,productId:557,checkedAt:ISO,quotes:[{edition:'1st Edition',market:31},{edition:'Unlimited',market:11}]});
CARDS.ptcg[3].variants[0].historyQuote='2020-01-01';
const dual=magic('dual','Fixture dawn // Fixture dusk',{usd:'12.50'});
// Transform printings carry wording, mana and stats on their individual faces,
// not the single-face helper's inherited oracle_text (which masks card_faces).
for(const field of ['image_uris','oracle_text','mana_cost','power','toughness'])delete dual[field];
dual.layout='transform';dual.type_line='Creature — Human // Creature — Werewolf';dual.finishes=['nonfoil'];dual.card_faces=['dawn','dusk'].map((face,i)=>({name:'Fixture '+face,type_line:i?'Creature — Werewolf':'Creature — Human',oracle_text:'Vigilance.',mana_cost:i?'':'{2}{G}',power:String(2+i),toughness:String(2+i),image_uris:{normal:`${IMAGE}/dual-${face}.png`,art_crop:`${IMAGE}/dual-${face}-crop.png`}}));CARDS.mtg.push(dual);
export const DHELMISE_COVER=pokemonDeckCover({name:'Dhelmise V',icons:['dhelmise'],list:[{name:'Dhelmise V',set:'SSH',number:'009',qty:4,kind:'Pokemon'}]});
export function metaFeed(game){
 if(game==='ptcg')return {game,artSchema:2,source:'Limitless deterministic fixture',events:[],decks:[],top:[],archetypes:[{id:'dhelmise',name:'Dhelmise',icons:['dhelmise'],count:8,top8:0,share:.2,best:'',cover:{...DHELMISE_COVER,source:{eventId:'fixture-event',rank:17}}},{id:'no-art',name:'No supplied cover',icons:[],count:2,top8:0,share:.05,best:'',cover:null}]};
 const c=CARDS[game][0],key=`fixture-${game}-deck`;
 return {game,source:'Deterministic tournament fixture',days:30,coverage:{events:1,players:24},events:[],top:[],archetypes:[{name:c.name,best:key,count:1,lists:1,share:1}],decks:[{key,name:`${game} fixture deck`,event:'Fixture event',place:'Top 8',rank:8,date:'2026-10-16',...(game==='mtg'?{main:[{name:c.name,qty:4}],commanders:[{name:c.name,qty:1}],side:[]}:{main:[c.id],cover:c.id,extra:[],side:[]})}]};
}
export function makeFixtures(game='mtg'){
 const state=blank();state.settings.game=game;state.tcg={ptcg:{collection:[],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 state.myPrices={};const catalog=Object.fromEntries(CARDS.mtg.map(c=>[cardKey(c.name),c]));
 const cache={ptcg:Object.fromEntries(CARDS.ptcg.map(c=>[c.id,c])),ygo:Object.fromEntries(CARDS.ygo.map(c=>[c.id,c]))};
 for(const g of GAMES){
  const st=g==='mtg'?state:state.tcg[g];
  st.collection=CARDS[g].map((c,i)=>({id:`lot-${g}-${i}`,name:c.name,qty:i===0?2:1,condition:i===0?'Lightly Played':'Near Mint',language:'en',finish:'nonfoil',addedAt:ISO,...(g==='mtg'?{printingId:c.id,printingVerified:true,set:c.set,collectorNumber:c.collector_number}:{cardId:c.id,key:`id:${c.id}`,...(g==='ptcg'?{variant:'normal',printing:c.set.id,number:c.set.number}:{printing:c.sets[0].code,rarity:c.sets[0].rarity,edition:'unlimited'})}),...(i===0?{manualValue:1.75,manualValueCondition:'Lightly Played',manualValueCurrency:'USD'}:{})}));
  const c=CARDS[g][0];st.decks=[{id:`saved-${g}`,name:`Saved ${g} fixture deck`,locked:false,versions:[],...(g==='mtg'?{format:'Commander',commander:c.name,cards:[{name:c.name,qty:1}],side:[]}:{format:g==='ptcg'?'standard':'tcg',zones:{main:[{name:c.name,cardId:c.id,qty:2}],extra:[],side:[]}})}];
  const personal=CARDS[g][g==='ptcg'?2:3];state.myPrices[personal.id+':nonfoil']={price:987.65,name:personal.name,at:ISO};
 }
 state.printings=Object.fromEntries(CARDS.mtg.map(c=>[c.id,c]));state.activeDeck='saved-mtg';
 const meta=Object.fromEntries(GAMES.map(g=>[g==='mtg'?'mtg:Standard':g,{at:NOW,data:metaFeed(g)}]));meta['mtg:EDH']={at:NOW,data:metaFeed('mtg')};
 return {state,catalog,cache,storage:{'cardforge-v2':state,'cardforge-catalog-v1':catalog,'cardforge-tcg-cache-v1':cache,'cardforge-meta-v1':meta,'cardforge-community-v1':Object.fromEntries(GAMES.map(g=>[g,{at:NOW,data:{game:g,status:'unavailable',items:[],fetchedAt:ISO}}])),'cardforge-sets-v1':{at:NOW,sets:[{code:'fdn',name:'Foundations',released_at:'2024-11-15',set_type:'core',icon:`${IMAGE}/set-symbol.png`}]},'cardstashy-watch-sent-v1':Object.fromEntries(GAMES.flatMap(g=>CARDS[g].map(c=>[g+':'+c.id,NOW]))),'cardforge-hero-v2':{date:'2026-10-17',...Object.fromEntries(GAMES.map(g=>[g,{name:CARDS[g][0].name,id:CARDS[g][0].id,art:g==='mtg'?CARDS[g][0].image_uris.art_crop:CARDS[g][0].image}]))},'cf-mtg-tcg-v1':{fdn:{t:NOW,prices:{}}}}};
}
export function historyFixture(url){
 const game=url.searchParams.get('game'),cardId=url.searchParams.get('id'),finish=url.searchParams.get('finish');
 const current=CARDS[game]?.[0]?.id===cardId,archive=url.pathname.endsWith('/archive');
 return {game,cardId,finish,notice:'No invented dates or unavailable quotes in this fixture.',series:current&&!archive?[{source:'Deterministic matching USD source',currency:'USD',finish,points:[{date:'2026-10-14',value:2},{date:'2026-10-15',value:3},{date:'2026-10-16',value:4}]}]:[]};
}
// A viewed price chart can schedule this existing public maintenance request.
// It is always intercepted. Only public IDs are admitted to its separate ledger;
// synthetic catalogue IDs receive the same rejection as the real watch route.
export function priceWatchFixtureRequest(base,url,method,body,{knownMtgIds=[],headers={}}={}){
 if(method!=='POST'||url?.origin!==base||url.pathname!=='/api/prices/watch'||url.search||url.hash||url.username||url.password)return null;
 if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!=='game,ids'||!['mtg','ygo'].includes(body.game)||!Array.isArray(body.ids)||!body.ids.length||body.ids.length>300)return null;
 if(Object.entries(headers).some(([name,value])=>/^(?:authorization|proxy-authorization|cookie|apikey|x-api-key|x-auth-token)$/i.test(name)&&String(value)))return null;
 const known=new Set(Array.isArray(knownMtgIds)?knownMtgIds:[]),providerId=id=>typeof id==='string'&&(body.game==='mtg'?/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id):/^[1-9][0-9]{0,9}$/.test(id));
 if(body.ids.some(id=>!providerId(id)&&!(body.game==='mtg'&&typeof id==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(id)&&known.has(id))))return null;
 const synthetic=body.ids.some(id=>!providerId(id));
 return {classification:'public-shared-price-registration',game:body.game,ids:[...body.ids],synthetic,forwarded:false,status:synthetic?400:200,response:{error:synthetic?'bad_request':'not_configured'}};
}
export async function validateFixtures(){
 assert.equal(dual.oracle_text,undefined,'Transform wording is face-specific');assert.equal(dual.image_uris,undefined,'Transform artwork is face-specific');assert.equal(dual.card_faces.length,2);assert(dual.card_faces.every(face=>face.oracle_text&&face.image_uris.normal&&face.image_uris.art_crop));
 for(const game of GAMES){
  const f=makeFixtures(game),valid=validateWorkspace(structuredClone(f.state));
  for(const g of GAMES){const st=g==='mtg'?valid:valid.tcg[g];assert.equal(st.collection.length,CARDS[g].length);for(const [i,e] of st.collection.entries()){assert.equal(e[g==='mtg'?'printingId':'cardId'],CARDS[g][i].id);assert.equal(e.condition,i===0?'Lightly Played':'Near Mint');}assert.equal(st.collection[0].manualValue,1.75);}
  const url=new URL(historyEndpoint);url.search=new URLSearchParams({game,id:CARDS[game][0].id,finish:game==='mtg'?'nonfoil':'reference'});assert.equal(validateHistory(historyFixture(url),{game,cardId:CARDS[game][0].id,finish:url.searchParams.get('finish')}).series[0].points.length,3);
 }
 assert.equal(CARDS.ptcg[0].variants.find(v=>v.key==='normal').productId,111);assert.equal(CARDS.ptcg[0].variants.find(v=>v.key==='holofoil').productId,222);assert.equal(CARDS.ygo[0].sets[0].price,20);assert.equal(CARDS.ygo[0].prices.usd,2);
 const m=metaFeed('ptcg');assert.equal(m.archetypes[0].cover.printing.name,'Dhelmise V');assert.equal(m.archetypes[0].cover.source.rank,17);assert.equal(m.archetypes[0].top8,0);assert.equal(m.archetypes[0].best,'');assert.equal(m.decks.length,0);assert.equal(m.archetypes[1].cover,null);
 const watchBase='http://127.0.0.1:45003',watchUrl=new URL(watchBase+'/api/prices/watch'),publicWatch={game:'mtg',ids:['00000000-0000-4000-8000-000000000001']};
 const productionWatch=priceWatchFixtureRequest(watchBase,watchUrl,'POST',publicWatch);assert.equal(productionWatch.classification,'public-shared-price-registration');assert.equal(productionWatch.forwarded,false);assert.deepEqual(productionWatch.response,{error:'not_configured'},'an intercepted public registration never claims a real shared-cache write');
 assert.equal(priceWatchFixtureRequest(watchBase,watchUrl,'POST',{game:'ygo',ids:['89631139']}).status,200);
 assert.equal(priceWatchFixtureRequest(watchBase,watchUrl,'POST',{game:'mtg',ids:['ask-kci']}),null,'unknown synthetic identifiers cannot bypass the deny-all mutation guard');
 const syntheticWatch=priceWatchFixtureRequest(watchBase,watchUrl,'POST',{game:'mtg',ids:['ask-kci']},{knownMtgIds:['ask-kci']});assert.equal(syntheticWatch.forwarded,false);assert.equal(syntheticWatch.status,400);assert.deepEqual(syntheticWatch.response,{error:'bad_request'},'a known fixture card is auditable without pretending its made-up ID is a provider printing');
 for(const body of [{...publicWatch,collection:[]},{...publicWatch,profile:'private'},{...publicWatch,token:'private'},{game:'ptcg',ids:['base1-1']},{game:'mtg',ids:[]},{game:'mtg',ids:Array(301).fill(publicWatch.ids[0])},{game:'mtg',ids:[null]},{game:'mtg',ids:['987.65']},{game:'ygo',ids:['1&token=private']}])assert.equal(priceWatchFixtureRequest(watchBase,watchUrl,'POST',body),null,'private fields, unsupported games and malformed IDs remain forbidden');
 for(const [name,value] of [['authorization','Bearer private'],['cookie','session=private'],['apikey','private']])assert.equal(priceWatchFixtureRequest(watchBase,watchUrl,'POST',publicWatch,{headers:{[name]:value}}),null,'credential-bearing public-looking requests remain forbidden');
 for(const [url,method] of [[new URL('https://external.invalid/api/prices/watch'),'POST'],[new URL(watchBase+'/api/prices/watch?account=private'),'POST'],[new URL(watchBase+'/api/prices/other'),'POST'],[watchUrl,'PUT'],[watchUrl,'GET']])assert.equal(priceWatchFixtureRequest(watchBase,url,method,publicWatch),null,'only the exact local public registration endpoint is classified');
 const manifest=JSON.parse(await readFile(resolve(ROOT,'rulebooks/manifest.json'),'utf8'));
 for(const g of GAMES){const info=manifest[g],raw=gunzipSync(await readFile(resolve(ROOT,info.file)));assert.equal(createHash('sha256').update(raw).digest('hex'),info.sha256);const pack=JSON.parse(raw);assert.equal(pack.game,g);assert.equal(pack.entries.length,info.count);if(g==='ptcg')assert(pack.entries.some(e=>e.id==='0-p10'&&e.page===10));}
 return 'Fixture workspace, exact printing/card IDs, normalized provider schemas, history boundaries, art provenance and all three bundled corpus hashes passed. No browser started.';
}
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.gz':'application/gzip'};
export async function startServer(){
 const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname),file=resolve(ROOT,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(ROOT+'/')||req.method!=='GET')throw Error('Invalid request');let body=await readFile(file);if(path==='/config.js')body=Buffer.from(body.toString().replace(/key:\s*"[^"]*"/,'key: ""'));res.setHeader('Content-Type',MIME[extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end('Fixture server: not found');}});
 await mkdir(RESULTS,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
// Opt-in exception for one deterministic local Rules guide fixture only. The
// ordinary Rules/detail suites keep their original deny-all-mutations policy.
export function isAllowedRulesFixtureRequest(base,url,method,body,enabled=false){
 return !!enabled&&method==='POST'&&url.origin===base&&url.pathname==='/api/ai/ask'&&!url.search&&body?.mode==='rules';
}
export async function openApp(browser,base,{game='mtg',width=390,height=1000,reducedMotion='no-preference',hash='#collection',glass=true,rulesResponder=null,isMobile=false,hasTouch=true}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch,isMobile,reducedMotion,locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],writes=[],unexpected=[],requests=[],images=[],rulesRequests=[],publicPriceWatchRequests=[];let gate=null,failRulebook=false;
 const artURLs=new Set([DHELMISE_COVER.imageLarge,...Object.values(CARDS).flatMap(cards=>cards.flatMap(c=>[...artworkSources(c,true),...artworkSources(c,false),c.art,c.artDirect,c.image_uris?.art_crop].filter(Boolean))).map(u=>new URL(u,base+'/').href)]);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),json=body=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});requests.push(`${req.method()} ${url.href}`);
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET','access-control-allow-headers':'apikey'},body:''});
  if(!['GET','HEAD'].includes(req.method())){
   let body;try{body=req.postDataJSON();}catch{}
   if(url.origin===base&&url.pathname==='/api/prices/watch'){
    let knownMtgIds=CARDS.mtg.map(card=>card.id);
    try{const current=await page.evaluate(()=>Object.values(window.__uiTestState?.catalog||{}).map(card=>card?.id).filter(id=>typeof id==='string'));if(Array.isArray(current))knownMtgIds=knownMtgIds.concat(current);}catch{}
    const call=priceWatchFixtureRequest(base,url,req.method(),body,{knownMtgIds,headers:await req.allHeaders()});
    if(call){publicPriceWatchRequests.push({...call,body:structuredClone(body)});return route.fulfill({status:call.status,contentType:'application/json',body:JSON.stringify(call.response)});}
   }
   if(isAllowedRulesFixtureRequest(base,url,req.method(),body,typeof rulesResponder==='function')){
    const call={body:structuredClone(body),settled:false};rulesRequests.push(call);
    if(gate?.match(url)){const g=gate;gate=null;g.started();await g.wait;}
    try{const result=await rulesResponder(body);call.status=result.status??200;call.response=structuredClone(result.body);await route.fulfill({status:call.status,contentType:'application/json',body:JSON.stringify(result.body)});}catch(error){errors.push('Rules fixture response failed: '+error.message);await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Deterministic Rules fixture failed.'})});}finally{call.settled=true;}
    return;
   }
   writes.push(`${req.method()} ${url.href}`);return json({error:'External writes are forbidden in this fixture.'});
  }
  if(gate?.match(url)){const g=gate;gate=null;g.started();await g.wait;}
  if(url.origin===base&&url.pathname.startsWith('/rulebooks/')&&failRulebook)return route.fulfill({status:503,body:'Deterministic offline rulebook fixture'});
  if(url.origin===historyEndpoint.origin&&url.pathname===historyEndpoint.pathname)return json(historyFixture(url));
  if(url.hostname==='fonts.googleapis.com')return route.fulfill({status:200,contentType:'text/css',body:'/* deterministic system fonts */'});
  if(req.resourceType()==='image'&&(Object.values(COMMUNITY_ILLUSTRATIONS).some(x=>new URL(x.url,base+'/').href===url.href)||artURLs.has(url.href)||url.hostname==='detail-fixtures.invalid'||url.origin===base&&/^\/img\/pks\/(s|r)\//.test(url.pathname)||url.href==='https://images.ygoprodeck.com/images/sets/SET.jpg'||url.hostname==='r2.limitlesstcg.net'||url.hostname==='svgs.scryfall.io'&&/^\/(card-symbols|sets)\//.test(url.pathname)||url.hostname==='images.pokemontcg.io'&&/\/(logo|symbol)\.png$/.test(url.pathname))){images.push(url.href);return route.fulfill({status:200,contentType:'image/svg+xml',body:SVG});}
  if(url.origin===base){
   if(url.pathname==='/catalog.json')return json({cards:[],snapshot_date:'2000-01-01'});
   if(url.pathname==='/api/daily-card'){const g=url.searchParams.get('game'),c=CARDS[g]?.[0];return json({game:g,date:'2026-10-17',card:{id:c?.id,name:c?.name,art:''}});}
   if(url.pathname==='/api/releases/current')return json(RELEASE);
   if(url.pathname==='/api/community')return json({game:url.searchParams.get('game'),status:'unavailable',items:[],fetchedAt:ISO});
   if(url.pathname==='/api/meta/curation')return json({game:url.searchParams.get('game'),format:url.searchParams.get('format'),status:'unavailable',rankedIds:[],annotations:[]});
   if(url.pathname==='/api/meta/mtg')return json(metaFeed('mtg'));
   if(url.pathname==='/api/prices/archive'||url.pathname==='/api/prices/recent')return json(historyFixture(url));
   if(url.pathname.startsWith('/api/prices/'))return json({points:[],series:[],cards:[],products:[],variants:[],prices:{},partial:false});
   if(url.pathname.startsWith('/api/meta/ygo'))return json(url.pathname.endsWith('/top')?{results:[]}:[]);
   // Sealed-product artwork routes (set backdrop, booster pack): deterministic no-artwork answer; the UI falls back.
   if(/^\/img\/(?:mtg-set|pack)\//.test(url.pathname))return route.fulfill({status:404,contentType:'text/plain',body:'No product artwork fixture'});
   if(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/img/'))return route.continue();
  }
  if(url.hostname==='api.scryfall.com'){
   if(url.pathname==='/cards/search'){const q=url.searchParams.get('q')||'',hit=CARDS.mtg.find(c=>q.includes(c.oracle_id));return json({object:'list',data:hit?[hit]:CARDS.mtg,has_more:false,total_cards:hit?1:CARDS.mtg.length});}
   if(url.pathname.endsWith('/rulings'))return json({data:[]});
   if(url.pathname==='/cards/named')return json(CARDS.mtg.find(c=>c.name===(url.searchParams.get('exact')||url.searchParams.get('fuzzy')))||CARDS.mtg[0]);
   if(url.pathname==='/sets')return json({data:[]});
   if(url.pathname.startsWith('/cards/'))return json(CARDS.mtg.find(c=>url.pathname.endsWith(c.id))||CARDS.mtg[0]);
  }
  if(url.hostname==='api.tcgdex.net'){
   if(url.pathname==='/v2/en/cards')return json(RAW.ptcg);
   if(url.pathname.startsWith('/v2/en/cards/'))return json(RAW.ptcg.find(c=>url.pathname.endsWith(c.id))||RAW.ptcg[0]);
   if(url.pathname.startsWith('/v2/en/sets')||url.pathname.startsWith('/v2/en/series'))return json([]);
  }
  if(url.hostname==='db.ygoprodeck.com'){
   if(url.pathname.endsWith('/cardinfo.php')){const ids=(url.searchParams.get('id')||'').split(','),data=RAW.ygo.filter(c=>ids.includes(String(c.id)));return json({data:data.length?data:RAW.ygo,meta:{total_rows:data.length||RAW.ygo.length,rows_remaining:0}});}
   if(url.pathname.endsWith('/cardsets.php'))return json([]);
   if(url.pathname.endsWith('/archetypes.php'))return json([{archetype_name:'Blue-Eyes'}]);
  }
  unexpected.push(`${req.method()} ${url.href}`);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({error:'Unmapped fixture request. No Internet request was forwarded.'})});
 });
 const f=makeFixtures(game);
 await page.addInitScript(({storage,now,glass})=>{const NativeDate=Date,offset=now-NativeDate.now();globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}static now(){return NativeDate.now()+offset;}};Math.random=()=>0;if(!localStorage.getItem('detail-rules-fixtures-installed')){for(const [k,v]of Object.entries(storage))localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('cardstashy-tour-v1','done');localStorage.setItem('cardstashy-glass',glass?'on':'off');localStorage.setItem('detail-rules-fixtures-installed','1');}}, {storage:f.storage,now:NOW,glass});
 await page.goto(base+'/'+hash);await page.locator('#app.ready').waitFor();
 // Resolve imports outside polling. Every waitForFunction below is synchronous.
 await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});
 await page.waitForFunction(g=>document.body.dataset.game===g&&window.__uiTestState.state.settings.game===g,game);
 const health=()=>{assert.deepEqual(errors,[],'No uncaught application error');assert.deepEqual(writes,[],'No payment, AI, private-state or unrecognized network writes');assert(publicPriceWatchRequests.every(call=>call.forwarded===false),'Public price registration attempts are local fixtures only');assert.deepEqual(unexpected,[],'Every provider call mapped to a local deterministic fixture');};
 return {context,page,requests,images,rulesRequests,publicPriceWatchRequests,health,fixtures:f,
  hold(match){let started,release;const seen=new Promise(r=>{started=r;}),wait=new Promise(r=>{release=r;});gate={match,started,wait};return {seen,release};},
  failRules(value=true){failRulebook=value;},
  async close(){health();await context.close();}
 };
}
export async function navigate(page,hash){await page.evaluate(h=>{location.hash=h;},hash);await page.waitForFunction(h=>location.hash===h&&window.__uiTestState.ui.view===h.slice(1).split('/')[0],hash);}
export async function closeSheet(page){await page.locator('#sheet [data-act="closeSheet"]').first().click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);}
export async function inventorySnapshot(page){return page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.printings,window.__uiTestState.state.decks,window.__uiTestState.state.tcg]));}
// The ordinary Magic Collection opens a named catalogue card, not necessarily an
// explicit ctx.print. Resolve the same real source as the production renderer.
export function detailHistoryContext(game){
 const ctx=window.__uiTestState.ui.sheetCtx,card=game==='mtg'?(ctx.print||window.__responsiveStore.meta(ctx.name)):window.__uiTestTcg.cardOf(game,ctx.id),body=document.querySelector('#sheetBody');
 if(!card?.id)throw Error('Real detail card missing for '+game+' context');
 const quote=window.__responsivePricing.quoteForContext(game,card,ctx);
 if(!quote||quote.game!==game||quote.cardId!==card.id)throw Error('Real detail quote does not match its displayed card');
 const key=window.__responsiveHistory.historyKey(quote);
 window.__openingDetail={ctx,body,identity:body.dataset.detailIdentity,key,quote,card:body.querySelector('.cs-card'),generation:body.detailMountGeneration};
 return {key,game:quote.game,id:quote.cardId,finish:quote.finish,entry:ctx.entryId,generation:body.detailMountGeneration};
}
// Serialized by waitForFunction, and exercised directly by the pure lifecycle
// regression. Match the real cache TTL: a retained stale entry is not completion
// while its replacement request and synchronous refresh callback are pending.
export function detailHistoryReady(){
 const old=window.__openingDetail,ctx=window.__uiTestState.ui.sheetCtx,body=document.querySelector('#sheetBody'),entry=window.__responsiveHistory.sharedHistory.get(old.key),now=Date.now();
 const complete=entry?.series?.some(s=>s.points?.length>2&&now-Date.parse(s.points.at(-1).date)<3*864e5);
 return document.querySelector('#sheet').open&&ctx===old.ctx&&body===old.body&&body.dataset.detailIdentity===old.identity&&entry?.game===old.quote.game&&entry.cardId===old.quote.cardId&&entry.finish===old.quote.finish&&Number.isFinite(entry.checked)&&now-entry.checked<(complete?3600000:30000)&&['ready','empty','unsupported','unavailable'].includes(entry.status);
}
// Both browser and pure regressions use this exact fractional CSS-space probe.
// clientWidth/clientHeight are integer-rounded and cannot decide line wrapping.
export function collectionControlGeometry(n){
 const el=document.activeElement,r=n.getBoundingClientRect(),a=el.getBoundingClientRect(),s=getComputedStyle(el),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=[s.fontStyle,s.fontVariant,s.fontWeight,s.fontSize,s.fontFamily].join(' ');
 const num=v=>parseFloat(v)||0,px=num(s.paddingLeft)+num(s.paddingRight),py=num(s.paddingTop)+num(s.paddingBottom),bx=num(s.borderLeftWidth)+num(s.borderRightWidth),by=num(s.borderTopWidth)+num(s.borderBottomWidth);
 const boxWidth=num(s.width)+(s.boxSizing==='border-box'?0:px+bx),boxHeight=num(s.height)+(s.boxSizing==='border-box'?0:py+by),scaleX=a.width/boxWidth,scaleY=a.height/boxHeight;
 const contentWidth=a.width/scaleX-bx-px,contentHeight=a.height/scaleY-by-py,label=el.selectedOptions?.[0]?.label||'',icon=getComputedStyle(el,'::picker-icon'),available=contentWidth-num(icon.width)-num(s.columnGap),words=label.split(/\s+/),longest=Math.max(...words.map(w=>ctx.measureText(w).width));
 let lines=1,line='';for(const word of words){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>available){lines++;line=word;}else line=next;}
 const nowrap=['nowrap','pre'].includes(s.whiteSpace),lineHeight=num(s.lineHeight)||num(s.fontSize)*1.2,hit=document.elementFromPoint(a.left+a.width/2,a.top+a.height/2);
 return {inside:el.parentElement===n,change:el.dataset.change,field:el.dataset.field||'',value:el.value,label,accessible:el.getAttribute('aria-label'),tabIndex:el.tabIndex,disabled:el.disabled,selectedWordWidth:longest,selectedTextWidth:ctx.measureText(label).width,labelWidth:available,nowrap,requiredTextHeight:(nowrap?1:lines)*lineHeight,labelHeight:contentHeight,scaleX,scaleY,ellipsis:s.textOverflow==='ellipsis',scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,rect:a.toJSON(),rail:r.toJSON(),railWidth:n.clientWidth,railScroll:n.scrollWidth,position:n.scrollLeft,overflow:getComputedStyle(n).overflowX,hit:hit===el||el.contains(hit)};
}
// SVG title/desc are accessible metadata, not rendered glyphs. Nothing else,
// including hidden HTML or real SVG text/tspan without rectangles, is exempt.
export function collectionRowGeometry(n){
 // Locator.evaluate first resolves a remote ElementHandle, then evaluates it in
 // another protocol call. A legitimate Collection render may detach that handle
 // between calls. Resolve and measure the exact current row in this single
 // synchronous page callback instead; never retry or accept another context.
 let identity=null;
 if(typeof n?.getBoundingClientRect!=='function'){
  const expected=n,need=(ok,message)=>{if(!ok)throw Error('Collection row identity: '+message);};
  need(expected&&['mtg','ptcg','ygo'].includes(expected.game)&&['compact','symbols'].includes(expected.mode)&&typeof expected.batch==='boolean'&&Number.isFinite(expected.width)&&new RegExp('^lot-'+expected.game+'-\\d+$').test(expected.id),'invalid descriptor');
  const {game,mode,batch,width,id}=expected,selector='.display-list > .lot:has(> .lot-art[data-entry="'+id+'"])';
  const resolve=()=>{
   const roots=document.querySelectorAll('#content'),state=window.__uiTestState;need(roots.length===1&&roots[0].isConnected,'unique connected content root');const root=roots[0];
   need(document.body.dataset.game===game&&state?.state.settings.game===game&&document.body.dataset.view==='collection'&&state.ui.view==='collection'&&location.hash==='#collection','current Collection game and route');
   need(root.classList.contains('view-'+mode)&&(state.state.settings.displayModes?.[game]?.collection||'compact')===mode,'current display mode');
   need(innerWidth===width&&state.ui.batch?.game===game&&state.ui.batch.active===batch,'current viewport and batch state');
   const rows=root.querySelectorAll(selector);need(rows.length===1,'unique current lot');const node=rows[0];
   need(node.isConnected&&node.closest('#content')===root&&node.parentElement.matches('.display-list')&&root.contains(node.parentElement),'connected direct current list row');
   need(node.querySelector(':scope > .lot-art')?.dataset.entry===id&&node.querySelector(':scope > .lot-info > .lot-name')?.dataset.entry===id,'matching artwork and name entry');
   const entries=(game==='mtg'?state.state:state.state.tcg?.[game])?.collection;need(entries?.filter(e=>e.id===id).length===1,'unique current owned entry');need(!!node.querySelector(':scope > .batch-mark')===batch,'matching rendered batch mark');
   return {root,node,rows};
  };
  let current=resolve(),scroll=null;n=current.node;
  if(expected.scroll){
   const before=n.getBoundingClientRect().toJSON();n.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});current=resolve();need(current.node===n,'scroll kept the same current row');
   const after=n.getBoundingClientRect(),style=getComputedStyle(n);need(after.width>0&&after.height>0&&after.left>=-2&&after.right<=innerWidth+2&&after.top>=-2&&after.bottom<=innerHeight+2&&style.visibility==='visible'&&style.opacity!=='0','scrolled row is visibly inside the viewport');
   for(let p=n.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);need(s.visibility==='visible'&&s.opacity!=='0','scrolled row has visible ancestors');}
   scroll={before,after:after.toJSON(),viewport:{width:innerWidth,height:innerHeight},visible:true,same:true};
  }
  const {root,rows}=current;
  const prior=expected.previous?window.__conditionPriorRow:null;
  if(expected.previous)need(prior&&!prior.isConnected&&prior!==n&&prior.querySelector('.lot-art')?.dataset.entry===id,'real prior row replaced');
  identity={id,game,mode,batch,width,scroll,connected:n.isConnected,current:root.querySelectorAll(selector)[0]===n,rootConnected:root.isConnected,unique:rows.length,previous:expected.previous?{connected:prior.isConnected,replaced:prior!==n}:null,data:{id,metadata:n.querySelector('.lot-sub').textContent.replace(/\s+/g,' ').trim(),icons:[...n.querySelectorAll('.lot-sub svg.emb')].map(x=>({role:x.getAttribute('role'),label:x.getAttribute('aria-label'),title:x.querySelector('title')?.textContent,hidden:x.getAttribute('aria-hidden'),parentLabel:x.parentElement.getAttribute('aria-label')})),note:n.querySelector('.condition-badge[data-condition="Lightly Played"]')?.dataset.conditionInfo||null,price:n.querySelector('.price').textContent,quantity:n.querySelector('.stepper b').textContent,actions:[...n.querySelectorAll('.lot-side button')].map(b=>[b.dataset.act,b.dataset.act==='qty'?b.getAttribute('aria-label'):b.textContent,b.getAttribute('aria-label')])}};
 }
 const rect=x=>x.getBoundingClientRect().toJSON(),style=getComputedStyle(n),inset=k=>['padding'+k,'border'+k+'Width'].reduce((sum,key)=>sum+(parseFloat(style[key])||0),0),contentWidth=parseFloat(style.width)-(style.boxSizing==='border-box'?inset('Left')+inset('Right'):0),rowRect=n.getBoundingClientRect(),scaleX=rowRect.width/(contentWidth+inset('Left')+inset('Right')),info=n.querySelector('.lot-info'),side=n.querySelector('.lot-side'),art=n.querySelector('.lot-art'),mark=n.querySelector('.batch-mark'),targets=[...n.querySelectorAll('.lot-sub,.condition-badge,.lot-side .price,.lot-side .stepper b,.lot-side button')],bad=[],icons=[],metadata=new Set();let words=0;
 for(const target of targets){for(const icon of target.querySelectorAll('svg.emb'))metadata.add(icon);const bound=target.getBoundingClientRect();if(!bound.width||!bound.height||getComputedStyle(target).visibility!=='visible'||target.scrollWidth>target.clientWidth+2)bad.push({text:target.textContent,reason:'hidden or clipped metadata'});const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let text;
  while((text=walker.nextNode())){
   let meta=null;for(let p=text.parentElement;p&&p!==target;p=p.parentElement)if(p.namespaceURI==='http://www.w3.org/2000/svg'&&['title','desc'].includes(p.localName)){meta=p;break;}
   if(meta){metadata.add(meta.ownerSVGElement);continue;}
   for(const word of text.textContent.matchAll(/[\p{L}\p{N}]+/gu)){if(word[0].length<3&&!target.matches('.condition-badge'))continue;words++;const range=document.createRange();range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);const rects=[...range.getClientRects()].filter(r=>r.width&&r.height),rows=new Set(rects.map(r=>Math.round(r.top)));if(!rects.length||rows.size>1||rects.some(r=>r.left<bound.left-2||r.right>bound.right+2||r.top<bound.top-2||r.bottom>bound.bottom+2))bad.push({word:word[0],rects:rects.map(r=>r.toJSON()),bound:bound.toJSON()});}
  }
 }
 for(const icon of metadata){
  if(!icon){bad.push({reason:'SVG metadata has no visible owner'});continue;}
  const parent=icon.parentElement,r=icon.getBoundingClientRect(),p=parent.getBoundingClientRect(),title=icon.querySelector('title')?.textContent.trim(),label=icon.getAttribute('aria-label'),parentLabel=parent.getAttribute('aria-label'),decorative=icon.matches('svg.emb.star[aria-hidden="true"]')&&parent.matches('.lvl');
  const visible=r.width>0&&r.height>0&&getComputedStyle(icon).visibility==='visible'&&getComputedStyle(icon).opacity!=='0'&&getComputedStyle(parent).opacity!=='0',named=decorative?/^(Level|Rank) \d+$/.test(parentLabel||'')&&parentLabel.split(' ').at(-1)===parent.textContent.trim():icon.getAttribute('aria-hidden')!=='true'&&icon.getAttribute('role')==='img'&&!!label&&!!title&&label===title;
  icons.push({label,title,parentLabel,decorative,rect:rect(icon),visible,named});if(!visible||!named||r.left<p.left-2||r.right>p.right+2||r.top<p.top-2||r.bottom>p.bottom+2)bad.push({reason:'Accessible icon is hidden, clipped or unnamed',label,parentLabel,rect:rect(icon)});
 }
 const controls=[...side.querySelectorAll('button,.stepper')].map(x=>({text:x.textContent,rect:rect(x)})),footer=[...side.children].map(rect),steppers=[...side.querySelectorAll('.stepper')].map(x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect();return {height:r.height,buttonHeight:Math.max(...[...x.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)),chrome:['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'].reduce((sum,k)=>sum+(parseFloat(s[k])||0),0)};});return {identity,row:rect(n),contentWidth,scaleX,columnGap:(parseFloat(style.columnGap)||0)*scaleX,containerName:style.containerName,containerType:style.containerType,contentLeft:rowRect.left+inset('Left')*scaleX,contentRight:rowRect.right-inset('Right')*scaleX,info:rect(info),side:rect(side),art:art.getClientRects().length?rect(art):null,mark:mark?rect(mark):null,cols:getComputedStyle(n).gridTemplateColumns.split(' ').length,words,bad,icons,controls,footer,steppers};
}
// Read-only ownership diagnostics use the exact replacement reference, never a
// locator that could silently follow another render while proving sensor motion.
export function detailMotionState(){
 const old=window.__motionProof,body=document.querySelector('#sheetBody'),card=body.querySelector('.cs-card .cd-img'),r=card.getBoundingClientRect(),sheet=body.getBoundingClientRect();
 return {same:card===old.card&&body===old.body&&old.ctx===window.__uiTestState.ui.sheetCtx&&body.detailMountGeneration===old.generation&&body.dataset.detailIdentity===old.identity,connected:card.isConnected,generation:body.detailMountGeneration,foreground:window.__responsiveFeel.motionCard()===card,foregroundDialog:[...document.querySelectorAll('dialog[open]')].at(-1)?.id,visible:r.bottom>Math.max(0,sheet.top)&&r.top<Math.min(innerHeight,sheet.bottom)&&r.right>0&&r.left<innerWidth,rect:r.toJSON(),hover:card.matches(':hover'),hovered:[...document.querySelectorAll(':hover')].slice(-4).map(n=>n.tagName+'.'+n.className),pointer:window.__openingPointer.slice(),gyro:card.classList.contains('gyro'),tx:card.style.getPropertyValue('--tx'),ty:card.style.getPropertyValue('--ty')};
}
// Card detail tabs are an intentional horizontal scroller. Their focus/visibility
// is asserted independently; they must not create page or sheet overflow.
// Collection has its own audited filter rail. Admit a clipped source select only
// after the caller has proved keyboard/touch access at this exact game/width and
// selection snapshot. Generic scrollers, hidden controls and other roots fail.
export function auditedCollectionControl(control,audit){
 const r=control.rail,known={tCollSet:[''],tCollSort:[''],tCollKind:['kind','rarity','show']};
 return !!audit&&control.root==='content'&&control.view==='collection'&&['ptcg','ygo'].includes(control.game)&&audit.game===control.game&&audit.width===control.viewport&&control.tag==='SELECT'&&known[control.change]?.includes(control.field)&&r?.direct&&r.known&&/^(auto|scroll)$/.test(r.overflow)&&r.left>=-.5&&r.right<=control.viewport+.5&&r.client>0&&r.scroll>=r.client&&control.width<=r.client+2&&control.left+r.position>=r.left-2&&control.right+r.position<=r.left+r.scroll+2&&audit.controls?.some(n=>n.change===control.change&&n.field===control.field&&n.value===control.value);
}
// A finish choice may sit beyond the viewport only inside its actual, contained
// horizontal rail. This is not an exemption for generic scrollers or buttons.
export function auditedFinishChoiceControl(control){
 const r=control.finishRail;
 return control.root==='sheetBody'&&['mtg','ptcg','ygo'].includes(control.game)&&control.tag==='BUTTON'&&r?.known&&r.direct&&r.connected&&r.visible&&r.focusable&&r.chip&&r.type==='button'&&['true','false'].includes(r.pressed)&&
  (control.game==='ygo'?(!r.action||(r.action==='ygoPickRarity'&&!r.game&&!!r.cardId&&/^[^:]+::.+$/.test(r.edition||''))):r.action==='cardFinishPreview'&&r.game===control.game&&!!r.cardId&&!!r.finish)&&
  /^(auto|scroll)$/.test(r.overflow)&&r.display==='flex'&&r.wrap==='nowrap'&&r.left>=-.5&&r.right<=control.viewport+.5&&r.right>r.left&&r.client>0&&r.scroll>r.client+1&&r.scale>0&&r.position>=-1&&r.position<=r.scroll-r.client+2&&
  Number.isFinite(r.scroll)&&control.width>0&&control.width<=r.scroll+2&&Math.abs(control.right-control.left-control.width)<.5&&control.height>=44*r.scale-.5&&control.left+r.position>=r.contentLeft-2&&control.right+r.position<=r.contentLeft+r.scroll+2&&control.top>=r.top-2&&control.bottom<=r.bottom+2;
}
// Exact set-family presets may scroll inside their own bounded native rail.
// Reject arbitrary buttons, hidden content, invalid actions and page overflow.
export function auditedSetFamilyControl(control){
 const r=control.familyRail;
 return control.root==='content'&&control.view==='sets'&&['mtg','ptcg','ygo'].includes(control.game)&&control.tag==='BUTTON'&&r?.known&&r.direct&&r.connected&&r.visible&&r.focusable&&!r.inForm&&r.buttons===4&&['true','false'].includes(r.pressed)&&
  r.action===(control.game==='mtg'?'setsFamily':'tSetsFamily')&&['main','companion','promos','all'].includes(r.value)&&r.whiteSpace==='nowrap'&&
  /^(auto|scroll)$/.test(r.overflow)&&r.display==='flex'&&r.wrap==='nowrap'&&r.left>=-.5&&r.right<=control.viewport+.5&&r.right>r.left&&r.client>0&&r.scroll>r.client+1&&r.scale>0&&r.position>=-1&&r.position<=r.scroll-r.client+2&&
  Number.isFinite(r.scroll)&&control.width>0&&control.width<=r.client+2&&Math.abs(control.right-control.left-control.width)<.5&&control.height>=42*r.scale-.5&&control.left+r.position>=r.contentLeft-2&&control.right+r.position<=r.contentLeft+r.scroll+2&&control.top>=r.top-2&&control.bottom<=r.bottom+2;
}
export async function noOverflow(page,scope,label,settleFinite=false,collectionAudit=null){
 const result=await page.evaluate(async({scope,settleFinite})=>{
  // Measure what a person can see: after a viewport change, the first painted frame.
  if(typeof requestAnimationFrame==='function')await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  // Resolve current scopes in this page task, not remote handles. Finite motion
  // may legitimately finish on a replaced node; reacquire and settle the new
  // scope too, without ever retrying a failed geometry assertion.
  const context=()=>({game:document.body.dataset.game,view:document.body.dataset.view,hash:location.hash,uiGame:window.__uiTestState?.state.settings.game,uiView:window.__uiTestState?.ui.view,sheet:document.querySelector('#sheet'),sheetOpen:document.querySelector('#sheet')?.open,sheetCtx:window.__uiTestState?.ui.sheetCtx,sheetIdentity:JSON.stringify(['type','game','id','name','entryId','entry','tab','face','priceFinish','pricePrinting','priceRarity','priceEdition'].map(k=>window.__uiTestState?.ui.sheetCtx?.[k]).concat(window.__uiTestState?.ui.sheetCtx?.print?.id)),width:innerWidth,height:innerHeight}),initial=context(),started=performance.now();let root,previous,replacements=0,passes=0;
  const resolve=()=>{const now=context();if(Object.keys(initial).some(k=>initial[k]!==now[k]))throw Error('Overflow scope context changed: '+scope);const nodes=document.querySelectorAll(scope);if(nodes.length!==1||!nodes[0].isConnected)throw Error('Overflow scope must be unique and connected: '+scope);if(previous&&previous!==nodes[0])replacements++;return previous=nodes[0];};
  for(;;){
   root=resolve();if(!settleFinite)break;if(performance.now()-started>=15000)throw Error('Overflow finite motion exceeded 15000ms: '+scope);
   const animations=root.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)&&!['finished','idle'].includes(a.playState));
   if(!animations.length)break;const remaining=15000-(performance.now()-started);if(remaining<=0)throw Error('Overflow finite motion exceeded 15000ms: '+scope);passes++;
   let timer;try{await Promise.race([Promise.all(animations.map(a=>a.finished.catch(()=>{}))),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Overflow finite motion exceeded 15000ms: '+scope)),remaining);})]);}finally{clearTimeout(timer);}
  }
  const r=root.getBoundingClientRect(),style=getComputedStyle(root);if(!r.width||!r.height||root.clientWidth<=0||style.visibility!=='visible'||style.opacity==='0')throw Error('Overflow scope is hidden or zero-sized: '+scope);
  return {connected:root.isConnected,current:document.querySelectorAll(scope)[0]===root,settlement:{passes,replacements},width:innerWidth,root:document.documentElement.scrollWidth,scope:root.scrollWidth,client:root.clientWidth,rect:{left:r.left,right:r.right},bad:[...root.querySelectorAll('button,input,select,summary,a')].filter(n=>n.getClientRects().length&&!n.closest('[hidden]')&&!n.closest('.cs-tabs')).filter(n=>{const b=n.getBoundingClientRect();return b.left<-.5||b.right>innerWidth+.5;}).map(n=>{
   const b=n.getBoundingClientRect(),rail=n.closest('.filter-pills'),a=rail?.getBoundingClientRect(),finish=n.closest('.finish-choice-rail');
   let finishRail=null;
   if(finish){
    const r=finish.getBoundingClientRect(),css=getComputedStyle(finish),scale=r.width/finish.offsetWidth;
    let visible=true;for(let ancestor=n;ancestor&&ancestor!==root;ancestor=ancestor.parentElement){const s=getComputedStyle(ancestor);if(s.visibility!=='visible'||s.opacity==='0'||s.display==='none')visible=false;}
    finishRail={known:finish.matches('.finish-preview > .finish-choice-rail')&&finish.parentElement?.parentElement?.matches('.cd-art-stack'),direct:n.parentElement===finish,connected:finish.isConnected&&n.isConnected,visible,focusable:n.tabIndex>=0&&!n.disabled,chip:n.matches('.chip'),type:n.type,pressed:n.getAttribute('aria-pressed'),action:n.dataset.act||'',game:n.dataset.game||'',cardId:n.dataset.cardId||'',finish:n.dataset.finish||'',edition:n.dataset.edition||'',left:r.left,right:r.right,top:r.top,bottom:r.bottom,scale,contentLeft:r.left+finish.clientLeft*scale,client:finish.clientWidth*scale,scroll:finish.scrollWidth*scale,position:finish.scrollLeft*scale,overflow:css.overflowX,display:css.display,wrap:css.flexWrap};
   }
   const family=n.closest('.set-browser-quick');let familyRail=null;
   if(family){
    const r=family.getBoundingClientRect(),css=getComputedStyle(family),scale=r.width/family.offsetWidth;
    let visible=true;for(let ancestor=n;ancestor&&ancestor!==root;ancestor=ancestor.parentElement){const s=getComputedStyle(ancestor);if(s.visibility!=='visible'||s.opacity==='0'||s.display==='none'||s.pointerEvents==='none')visible=false;}
    familyRail={known:family.matches('.set-browser-controls > .set-browser-quick')&&family.getAttribute('role')==='group',direct:n.parentElement===family,connected:family.isConnected&&n.isConnected,visible,focusable:n.tabIndex>=0&&!n.disabled,inForm:!!n.form,buttons:family.querySelectorAll(':scope > button').length,pressed:n.getAttribute('aria-pressed'),action:n.dataset.act||'',value:n.dataset.value||'',whiteSpace:getComputedStyle(n).whiteSpace,left:r.left,right:r.right,top:r.top,bottom:r.bottom,scale,contentLeft:r.left+family.clientLeft*scale,client:family.clientWidth*scale,scroll:family.scrollWidth*scale,position:family.scrollLeft*scale,overflow:css.overflowX,display:css.display,wrap:css.flexWrap};
   }
   return {text:n.tagName==='SELECT'?n.selectedOptions[0]?.label:n.textContent.slice(0,90),class:n.className,tag:n.tagName,change:n.dataset.change,field:n.dataset.field||'',value:n.value,root:root.id,view:document.body.dataset.view,game:document.body.dataset.game,viewport:innerWidth,left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,rail:rail&&{known:rail.matches('.coll-tools > .filter-pills'),direct:n.parentElement===rail,left:a.left,right:a.right,client:rail.clientWidth,scroll:rail.scrollWidth,position:rail.scrollLeft,overflow:getComputedStyle(rail).overflowX},finishRail,familyRail};
  })};},{scope,settleFinite});
 assert(result.connected&&result.current,`${label}: current connected overflow scope`);assert(result.root<=result.width+2&&result.scope<=result.client+2,`${label}: no horizontal overflow ${JSON.stringify(result)}`);assert.deepEqual(result.bad.filter(n=>!auditedCollectionControl(n,collectionAudit)&&!auditedFinishChoiceControl(n)&&!auditedSetFamilyControl(n)),[],`${label}: all visible controls fit the viewport or a specifically verified clipped rail`);return result;
}
export async function capture(page,name){await page.screenshot({path:resolve(RESULTS,name+'.png'),fullPage:true,animations:'disabled'});}
export async function saveReport(name,report,error){await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,name+'.json'),JSON.stringify({generatedAt:new Date().toISOString(),artEvidence,status:error?'failed':'passed',checks:report,...(error?{error:String(error.stack||error)}:{})},null,2));}
