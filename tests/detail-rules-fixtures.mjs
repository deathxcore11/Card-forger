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
const dual=magic('dual','Fixture dawn // Fixture dusk',{usd:'12.50'});delete dual.image_uris;dual.layout='transform';dual.finishes=['nonfoil'];dual.card_faces=['dawn','dusk'].map((face,i)=>({name:'Fixture '+face,type_line:i?'Creature — Werewolf':'Creature — Human',oracle_text:'Vigilance.',power:String(2+i),toughness:String(2+i),image_uris:{normal:`${IMAGE}/dual-${face}.png`,art_crop:`${IMAGE}/dual-${face}-crop.png`}}));CARDS.mtg.push(dual);
export const DHELMISE_COVER=pokemonDeckCover({name:'Dhelmise V',icons:['dhelmise'],list:[{name:'Dhelmise V',set:'SSH',number:'009',qty:4,kind:'Pokemon'}]});
export function metaFeed(game){
 if(game==='ptcg')return {game,artSchema:1,source:'Limitless deterministic fixture',events:[],decks:[],top:[],archetypes:[{id:'dhelmise',name:'Dhelmise',icons:['dhelmise'],count:8,top8:0,share:.2,best:'',cover:{...DHELMISE_COVER,source:{eventId:'fixture-event',rank:17}}},{id:'no-art',name:'No supplied cover',icons:[],count:2,top8:0,share:.05,best:'',cover:null}]};
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
 return {state,catalog,cache,storage:{'cardforge-v2':state,'cardforge-catalog-v1':catalog,'cardforge-tcg-cache-v1':cache,'cardforge-meta-v1':meta,'cardforge-community-v1':Object.fromEntries(GAMES.map(g=>[g,{at:NOW,data:{game:g,status:'unavailable',items:[],fetchedAt:ISO}}])),'cardforge-sets-v1':{at:NOW,sets:[{code:'fdn',name:'Foundations',released_at:'2024-11-15',set_type:'core',icon:`${IMAGE}/set-symbol.png`}]},'cardstashy-watch-sent-v1':Object.fromEntries(GAMES.flatMap(g=>CARDS[g].map(c=>[g+':'+c.id,NOW]))),'cardforge-hero-v1':{date:'2026-10-17',...Object.fromEntries(GAMES.map(g=>[g,{name:CARDS[g][0].name,id:CARDS[g][0].id,art:g==='mtg'?CARDS[g][0].image_uris.art_crop:CARDS[g][0].image}]))},'cf-mtg-tcg-v1':{fdn:{t:NOW,prices:{}}}}};
}
export function historyFixture(url){
 const game=url.searchParams.get('game'),cardId=url.searchParams.get('id'),finish=url.searchParams.get('finish');
 const current=CARDS[game]?.[0]?.id===cardId,archive=url.pathname.endsWith('/archive');
 return {game,cardId,finish,notice:'No invented dates or unavailable quotes in this fixture.',series:current&&!archive?[{source:'Deterministic matching USD source',currency:'USD',finish,points:[{date:'2026-10-14',value:2},{date:'2026-10-15',value:3},{date:'2026-10-16',value:4}]}]:[]};
}
export async function validateFixtures(){
 for(const game of GAMES){
  const f=makeFixtures(game),valid=validateWorkspace(structuredClone(f.state));
  for(const g of GAMES){const st=g==='mtg'?valid:valid.tcg[g];assert.equal(st.collection.length,CARDS[g].length);for(const [i,e] of st.collection.entries()){assert.equal(e[g==='mtg'?'printingId':'cardId'],CARDS[g][i].id);assert.equal(e.condition,i===0?'Lightly Played':'Near Mint');}assert.equal(st.collection[0].manualValue,1.75);}
  const url=new URL(historyEndpoint);url.search=new URLSearchParams({game,id:CARDS[game][0].id,finish:game==='mtg'?'nonfoil':'reference'});assert.equal(validateHistory(historyFixture(url),{game,cardId:CARDS[game][0].id,finish:url.searchParams.get('finish')}).series[0].points.length,3);
 }
 assert.equal(CARDS.ptcg[0].variants.find(v=>v.key==='normal').productId,111);assert.equal(CARDS.ptcg[0].variants.find(v=>v.key==='holofoil').productId,222);assert.equal(CARDS.ygo[0].sets[0].price,20);assert.equal(CARDS.ygo[0].prices.usd,2);
 const m=metaFeed('ptcg');assert.equal(m.archetypes[0].cover.printing.name,'Dhelmise V');assert.equal(m.archetypes[0].cover.source.rank,17);assert.equal(m.archetypes[0].top8,0);assert.equal(m.archetypes[0].best,'');assert.equal(m.decks.length,0);assert.equal(m.archetypes[1].cover,null);
 const manifest=JSON.parse(await readFile(resolve(ROOT,'rulebooks/manifest.json'),'utf8'));
 for(const g of GAMES){const info=manifest[g],raw=gunzipSync(await readFile(resolve(ROOT,info.file)));assert.equal(createHash('sha256').update(raw).digest('hex'),info.sha256);const pack=JSON.parse(raw);assert.equal(pack.game,g);assert.equal(pack.entries.length,info.count);if(g==='ptcg')assert(pack.entries.some(e=>e.id==='0-p10'&&e.page===10));}
 return 'Fixture workspace, exact printing/card IDs, normalized provider schemas, history boundaries, art provenance and all three bundled corpus hashes passed. No browser started.';
}
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.gz':'application/gzip'};
export async function startServer(){
 const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://local').pathname),file=resolve(ROOT,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(ROOT+'/')||req.method!=='GET')throw Error('Invalid request');let body=await readFile(file);if(path==='/config.js')body=Buffer.from(body.toString().replace(/key:\s*"[^"]*"/,'key: ""'));res.setHeader('Content-Type',MIME[extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end('Fixture server: not found');}});
 await mkdir(RESULTS,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
// Opt-in exception for one deterministic local Rules guide fixture only. The
// ordinary Rules/detail suites keep their original deny-all-mutations policy.
export function isAllowedRulesFixtureRequest(base,url,method,body,enabled=false){
 return !!enabled&&method==='POST'&&url.origin===base&&url.pathname==='/api/ai/ask'&&!url.search&&body?.mode==='rules';
}
export async function openApp(browser,base,{game='mtg',width=390,height=1000,reducedMotion='no-preference',hash='#collection',glass=true,rulesResponder=null}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,reducedMotion,locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],writes=[],unexpected=[],requests=[],images=[],rulesRequests=[];let gate=null,failRulebook=false;
 const artURLs=new Set([DHELMISE_COVER.imageLarge,...Object.values(CARDS).flatMap(cards=>cards.flatMap(c=>[...artworkSources(c,true),...artworkSources(c,false),c.art,c.artDirect,c.image_uris?.art_crop].filter(Boolean))).map(u=>new URL(u,base+'/').href)]);
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),json=body=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});requests.push(`${req.method()} ${url.href}`);
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET','access-control-allow-headers':'apikey'},body:''});
  if(!['GET','HEAD'].includes(req.method())){
   let body;try{body=req.postDataJSON();}catch{}
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
  if(req.resourceType()==='image'&&(artURLs.has(url.href)||url.hostname==='detail-fixtures.invalid'||url.origin===base&&/^\/img\/pks\/(s|r)\//.test(url.pathname)||url.href==='https://images.ygoprodeck.com/images/sets/SET.jpg'||url.hostname==='r2.limitlesstcg.net'||url.hostname==='svgs.scryfall.io'&&/^\/(card-symbols|sets)\//.test(url.pathname)||url.hostname==='images.pokemontcg.io'&&/\/(logo|symbol)\.png$/.test(url.pathname))){images.push(url.href);return route.fulfill({status:200,contentType:'image/svg+xml',body:SVG});}
  if(url.origin===base){
   if(url.pathname==='/catalog.json')return json({cards:[],snapshot_date:'2000-01-01'});
   if(url.pathname==='/api/community')return json({game:url.searchParams.get('game'),status:'unavailable',items:[],fetchedAt:ISO});
   if(url.pathname==='/api/meta/mtg')return json(metaFeed('mtg'));
   if(url.pathname==='/api/prices/archive'||url.pathname==='/api/prices/recent')return json(historyFixture(url));
   if(url.pathname.startsWith('/api/prices/'))return json({points:[],series:[],cards:[],products:[],variants:[],prices:{},partial:false});
   if(url.pathname.startsWith('/api/meta/ygo'))return json(url.pathname.endsWith('/top')?{results:[]}:[]);
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
 const health=()=>{assert.deepEqual(errors,[],'No uncaught application error');assert.deepEqual(writes,[],'No payment, AI or other external network writes');assert.deepEqual(unexpected,[],'Every provider call mapped to a local deterministic fixture');};
 return {context,page,requests,images,rulesRequests,health,fixtures:f,
  hold(match){let started,release;const seen=new Promise(r=>{started=r;}),wait=new Promise(r=>{release=r;});gate={match,started,wait};return {seen,release};},
  failRules(value=true){failRulebook=value;},
  async close(){health();await context.close();}
 };
}
export async function navigate(page,hash){await page.evaluate(h=>{location.hash=h;},hash);await page.waitForFunction(h=>location.hash===h&&window.__uiTestState.ui.view===h.slice(1).split('/')[0],hash);}
export async function closeSheet(page){await page.locator('#sheet [data-act="closeSheet"]').first().click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);}
export async function inventorySnapshot(page){return page.evaluate(()=>JSON.stringify([window.__uiTestState.state.collection,window.__uiTestState.state.printings,window.__uiTestState.state.decks,window.__uiTestState.state.tcg]));}
// Card detail tabs are an intentional horizontal scroller. Their focus/visibility
// is asserted independently; they must not create page or sheet overflow.
export async function noOverflow(page,scope,label){
 const result=await page.locator(scope).evaluate(root=>{const r=root.getBoundingClientRect();return {width:innerWidth,root:document.documentElement.scrollWidth,scope:root.scrollWidth,client:root.clientWidth,rect:{left:r.left,right:r.right},bad:[...root.querySelectorAll('button,input,select,summary,a')].filter(n=>n.getClientRects().length&&!n.closest('[hidden]')&&!n.closest('.cs-tabs')).filter(n=>{const b=n.getBoundingClientRect();return b.left<-.5||b.right>innerWidth+.5;}).map(n=>({text:n.textContent.slice(0,90),class:n.className}))};});
 assert(result.root<=result.width+2&&result.scope<=result.client+2,`${label}: no horizontal overflow ${JSON.stringify(result)}`);assert.deepEqual(result.bad,[],`${label}: all visible controls fit the viewport`);
}
export async function capture(page,name){await page.screenshot({path:resolve(RESULTS,name+'.png'),fullPage:true,animations:'disabled'});}
export async function saveReport(name,report,error){await mkdir(RESULTS,{recursive:true});await writeFile(resolve(RESULTS,name+'.json'),JSON.stringify({generatedAt:new Date().toISOString(),artEvidence,status:error?'failed':'passed',checks:report,...(error?{error:String(error.stack||error)}:{})},null,2));}
