// Public-provider-shaped, entirely synthetic browser QA. Importing this module
// never starts a server/browser or performs a request. No real user data is used.
import assert from 'node:assert/strict';
import {blank} from '../store.js';
import {cardKey} from '../core.js';
import {validateWorkspace} from '../confidence.js';
import {normalizeYgo,normalizeYgoSets,summarizeYgoSetContents} from '../ygo.js';
import {normalizePtcg,ptcgSource} from '../ptcg.js';
import {pkCatalogueSymbolSources} from '../emblems.js';
import {artworkSources} from '../artwork.js';
import {presentationQuote} from '../pricing-presentation.js';
import {setContextCard} from '../tcg.js';
import {SUPABASE} from '../config.js';
import {historyResponseStatus} from '../shared-history.js';
import {capture} from './detail-rules-fixtures.mjs';
export {startServer,navigate,closeSheet,noOverflow,capture,inventorySnapshot,RESULTS} from './detail-rules-fixtures.mjs';

export const WIDTHS=[320,390,768,1024,1440,2560];
export const GAMES=['mtg','ptcg','ygo'];
export const NOW=Date.parse('2026-10-17T12:00:00Z'),ISO=new Date(NOW).toISOString();
export const ART_EVIDENCE='SYNTHETIC PUBLIC-PROVIDER FIXTURES ONLY. Card artwork and set symbols are labeled SVG stand-ins intercepted at the exact supplied/derived provider URLs. Evidence proves source identity, white CSS treatment, layout and finite fallback, not real publisher image pixels or live image availability. No private images, account data, paid calls or external writes.';
const IMAGE='https://card-polish-fixtures.invalid';
export const YGO_RAW_SETS=[{set_code:'VASM',set_name:'Valiant Smashers',tcg_date:'2023-11-16',num_of_cards:60},{set_code:'OTHR',set_name:'Synthetic unrelated release',tcg_date:'2022-01-01',num_of_cards:1}];
export const YGO_SETS=normalizeYgoSets(YGO_RAW_SETS),VASM=YGO_SETS[0];
export const SETS={
 mtg:[{code:'fdn',name:'Foundations',released_at:'2024-11-15',set_type:'core',card_count:2,icon_svg_uri:'https://svgs.scryfall.io/sets/fdn.svg'}],
 ptcg:[
  {id:'sv08',name:'Surging Sparks',releaseDate:'2024-11-08',cardCount:{total:2,official:2},logo:'https://assets.tcgdex.net/en/sv/sv08/logo',symbol:'https://assets.tcgdex.net/en/sv/sv08/symbol'},
  {id:'sv03',name:'Obsidian Flames',releaseDate:'2023-08-11',cardCount:{total:1,official:1},logo:'https://assets.tcgdex.net/en/sv/sv03/logo',symbol:'https://assets.tcgdex.net/en/sv/sv03/symbol'},
  // A catalogue entry still needs a real name when artwork metadata is absent.
  // Its existing name-derived fallback chain is tested separately from Base
  // Set's intentional no-expansion-symbol path (which must create no image).
  {id:'synthetic-missing',name:'Synthetic Missing Symbol',releaseDate:'2022-01-01',cardCount:{}},
  {id:'base1',name:'Base Set',releaseDate:'1999-01-09',cardCount:{total:102,official:102}},
 ],
 ygo:YGO_SETS,
};
const printing=(code,rarity,price='')=>({set_name:VASM.name,set_code:code,set_rarity:rarity,set_price:price});
const ygo=(id,name,rows,reference='999.00')=>({id,name,type:'Effect Monster',frameType:'effect',race:'Warrior',attribute:'LIGHT',level:4,atk:1500,def:1000,desc:'Synthetic regression card. Provider rows are not live offers.',card_images:[{id}],card_sets:rows,card_prices:[{tcgplayer_price:reference}],misc_info:[{formats:['TCG','OCG'],tcg_date:'2023-11-16'}]});
const magic=(id,price)=>({id,oracle_id:'oracle-'+id,name:id==='fixture-polish-known'?'Synthetic known Magic':'Synthetic unpriced Magic',lang:'en',type_line:'Artifact',oracle_text:'Synthetic regression text.',cmc:0,mana_cost:'',colors:[],color_identity:[],keywords:[],legalities:{standard:'legal',commander:'legal'},set:'fdn',set_name:'Foundations',collector_number:id==='fixture-polish-known'?'1':'2',rarity:'rare',finishes:['nonfoil'],image_uris:{normal:IMAGE+'/'+id+'.svg',small:IMAGE+'/'+id+'.svg',art_crop:IMAGE+'/'+id+'.svg'},prices:{usd:price,usd_foil:null},checkedAt:ISO,full:true,released_at:'2024-11-15'});
const pokemon=(id,price)=>({id,localId:id.endsWith('001')?'001':'002',name:id.endsWith('001')?'Synthetic known Pokémon':'Synthetic unpriced Pokémon',category:'Pokemon',stage:'Basic',hp:80,types:['Lightning'],rarity:'Rare',image:IMAGE+'/'+id,set:SETS.ptcg[0],legal:{standard:true,expanded:true},variants:{normal:true},pricing:{tcgplayer:{normal:{marketPrice:price},updated:'2026-10-17'}},attacks:[{name:'Synthetic attack',cost:[],damage:10}]});
export const RAW={
 mtg:[magic('fixture-polish-known','12.50'),magic('fixture-polish-unknown',null)],
 ptcg:[pokemon('sv08-001',12.5),pokemon('sv08-002',null)],
 ygo:[
  ygo(99020001,'Synthetic multiple VASM printings',[{set_name:'Synthetic unrelated release',set_code:'OTHR-EN999',set_rarity:'Ultra Rare',set_price:'888.00'},printing('VASM-EN001','Super Rare'),printing('VASM-EN001','Ultra Rare'),printing('VASM-E001','Ultra Rare'),printing('VASM-EN001',"Collector's Rare")]),
  ygo(99020002,'Synthetic known VASM printing',[printing('VASM-EN002','Ultra Rare','12.50')]),
  ygo(99020003,'Synthetic unpriced VASM collector',[printing('VASM-EN003',"Collector's Rare")]),
  ygo(99020004,'Synthetic unpriced VASM common',[printing('VASM-EN004','Common')]),
 ],
};
export const CARDS={mtg:RAW.mtg,ptcg:RAW.ptcg.map(c=>({...normalizePtcg(c),fetchedAt:ISO,printPriceSchema:1})),ygo:RAW.ygo.map(c=>({...normalizeYgo(c),fetchedAt:ISO,printPriceSchema:1}))};
export const EXPECTED={mtg:{set:'fdn',known:CARDS.mtg[0].id,unknown:CARDS.mtg[1].id},ptcg:{set:'sv08',known:'sv08-001',unknown:'sv08-002'},ygo:{set:VASM.id,multiple:'99020001',known:'99020002',unknown:'99020003',common:'99020004'}};
export const SYMBOLS={
 normal:['/img/pks/s/surging-sparks.png','https://pokesymbols.com/images/tcg/sets/symbols/surging-sparks.png','https://assets.tcgdex.net/en/sv/sv08/symbol.webp'],
 broken:['/img/pks/s/obsidian-flames.png','https://pokesymbols.com/images/tcg/sets/symbols/obsidian-flames.png','https://assets.tcgdex.net/en/sv/sv03/symbol.webp'],
 missing:['/img/pks/s/synthetic-missing-symbol.png','https://pokesymbols.com/images/tcg/sets/symbols/synthetic-missing-symbol.png'],
};
const historyEndpoint=new URL('/functions/v1/market-history',SUPABASE.url);
export const isHistoryURL=url=>url.origin===historyEndpoint.origin&&url.pathname===historyEndpoint.pathname||['/api/prices/archive','/api/prices/recent'].includes(url.pathname);
export const emptyHistory=url=>({game:url.searchParams.get('game'),cardId:url.searchParams.get('id'),finish:url.searchParams.get('finish'),series:[],notice:'No recorded quotes for this selection.'});
const ART='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" rx="28" fill="#233c59"/><circle cx="315" cy="300" r="160" fill="#a27637"/><path d="M0 650 200 430 420 700 630 450V880H0Z" fill="#174b46"/><text x="22" y="50" fill="white" font-size="26">SYNTHETIC CARD FIXTURE</text><text x="22" y="845" fill="white" font-size="23">NOT REAL CARD ART</text></svg>';
const SYMBOL='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100" viewBox="0 0 120 100"><path d="M60 5 76 35 114 38 87 62 95 95 60 78 25 95 33 62 6 38 44 35Z" fill="#18232d"/><text x="33" y="57" fill="#c58b35" font-size="11">FIXTURE</text></svg>';
const LOGO='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110"><rect width="320" height="110" rx="20" fill="#1764bb"/><text x="12" y="65" font-size="24" fill="#ffc52a">SYNTHETIC SET LOGO</text></svg>';

export function makeFixtures(game='ygo'){
 const state=blank();state.settings.game=game;state.tcg={ygo:{collection:[],decks:[],wishlist:[]},ptcg:{collection:[],decks:[],wishlist:[]}};
 // No owned lots: reference provider checks cannot silently turn into condition
 // or private-value claims. All persistence is confined to this browser context.
 const catalog=Object.fromEntries(CARDS.mtg.map(c=>[cardKey(c.name),c])),cache={ptcg:Object.fromEntries(CARDS.ptcg.map(c=>[c.id,c])),ygo:Object.fromEntries(CARDS.ygo.map(c=>[c.id,c]))};
 state.printings=Object.fromEntries(CARDS.mtg.map(c=>[c.id,c]));
 return {state,catalog,cache,storage:{'cardforge-v2':state,'cardforge-catalog-v1':catalog,'cardforge-tcg-cache-v1':cache,
  'cardforge-community-v2':Object.fromEntries(GAMES.map(g=>[g,{at:NOW,data:{game:g,status:'unavailable',items:[],fetchedAt:ISO}}])),
  'cardforge-meta-v1':Object.fromEntries(['mtg:Standard','mtg:EDH','ptcg','ygo'].map(g=>[g,{at:NOW,data:{events:[],decks:[],archetypes:[],top:[]}}])),
  'cardstashy-watch-sent-v1':Object.fromEntries(GAMES.flatMap(g=>CARDS[g].map(c=>[g+':'+c.id,NOW]))),
  'cardforge-hero-v1':{date:'2026-10-17',...Object.fromEntries(GAMES.map(g=>[g,{game:g,date:'2026-10-17',name:CARDS[g][0].name,id:CARDS[g][0].id,art:IMAGE+'/hero-'+g+'.svg'}]))},
  'cf-mtg-tcg-v1':{fdn:{t:NOW,prices:{}}}}};
}
export function providerFixture(url){
 const host=url.hostname,path=url.pathname;
 if(host==='api.scryfall.com'){
  if(path==='/sets')return {data:SETS.mtg};
  if(path==='/sets/fdn')return SETS.mtg[0];
  if(path==='/cards/search')return {object:'list',data:CARDS.mtg,total_cards:2,has_more:false};
  if(path.endsWith('/rulings'))return {data:[]};
  if(path==='/cards/named')return CARDS.mtg.find(c=>c.name===(url.searchParams.get('exact')||url.searchParams.get('fuzzy')));
  if(path.startsWith('/cards/')){const parts=path.split('/').filter(Boolean);return parts.length>=3?CARDS.mtg.find(c=>c.set===parts[1]&&c.collector_number===parts[2]):CARDS.mtg.find(c=>c.id===parts.at(-1));}
 }
 if(host==='api.tcgdex.net'){
  if(path==='/v2/en/sets')return SETS.ptcg;
  if(path==='/v2/en/series')return [];
  if(path.startsWith('/v2/en/sets/')){const set=SETS.ptcg.find(s=>s.id===decodeURIComponent(path.split('/').at(-1)));return set?{...set,cards:RAW.ptcg.filter(c=>c.set.id===set.id)}:undefined;}
  if(path==='/v2/en/cards')return RAW.ptcg;
  if(path.startsWith('/v2/en/cards/'))return RAW.ptcg.find(c=>c.id===decodeURIComponent(path.split('/').at(-1)));
 }
 if(host==='db.ygoprodeck.com'){
  if(path.endsWith('/cardsets.php'))return YGO_RAW_SETS;
  if(path.endsWith('/archetypes.php'))return [];
  if(path.endsWith('/cardinfo.php')){const release=url.searchParams.get('cardset'),ids=(url.searchParams.get('id')||'').split(','),data=release?RAW.ygo.filter(c=>c.card_sets.some(p=>p.set_name===release)):RAW.ygo.filter(c=>ids.includes(String(c.id)));return {data,meta:{total_rows:data.length,rows_remaining:0}};}
 }
 if(host==='api.pokemontcg.io'&&path==='/v2/cards')return {data:[]};
 return undefined;
}
// Passive observation: never replace src, inline handlers or app render logic.
// A boot render may retire an image before its chain finishes. Give each actual
// DOM image a lifetime, and record the content replacement that retired it.
function observeSymbolMounts(){
 const records=[],seen=new WeakMap();let revision=0;
 const includes=(root,node)=>root===node||root.contains?.(node);
 const add=root=>{for(const node of [root,...(root.querySelectorAll?.('img.set-catalogue-symbol')||[])]){
  if(!node.matches?.('img.set-catalogue-symbol')||seen.has(node))continue;
  const record={mount:records.length+1,revision,id:node.closest('[data-set-symbol-id]')?.dataset.setSymbolId,initial:node.src,events:[],retiredAt:null,node};seen.set(node,record);records.push(record);
  for(const type of ['error','load'])node.addEventListener(type,()=>record.events.push({type,url:node.src}),{capture:true});
 }};
 new MutationObserver(changes=>{for(const change of changes){
  if(change.target.id==='content')revision++;
  for(const root of change.removedNodes)for(const record of records)if(record.retiredAt===null&&includes(root,record.node))record.retiredAt=revision;
  for(const root of change.addedNodes)add(root);
 }}).observe(document,{childList:true,subtree:true});
 window.__polishSymbolMounts=()=>records.map(({node,...record})=>({...record,events:record.events.map(e=>({...e})),connected:node.isConnected,complete:node.complete,hidden:node.hidden,handlersDisabled:node.onerror===null&&node.onload===null,remaining:[node.dataset.symbolNext,node.dataset.symbolLast].filter(Boolean)}));
}
export function assertSymbolMounts(records,id,expected,{failed=true}={}){
 const mounts=records.filter(r=>r.id===id);
 // Only the TCG catalogue completion and independent shared-symbol-index
 // completion can mount populated catalogues before any interaction here.
 assert(mounts.length>=1&&mounts.length<=2,id+': at most two distinct boot mounts, not arbitrary repeated chains');
 assert.equal(new Set(mounts.map(r=>r.mount)).size,mounts.length,id+': distinct DOM identities');
 const active=mounts.filter(r=>r.connected);assert.equal(active.length,1,id+': exactly one current DOM image');
 for(const [i,mount] of mounts.entries()){
  assert.equal(mount.initial,expected[0],id+': every new image starts at the declared first source');
  assert.deepEqual(mount.events.map(e=>e.url),expected.slice(0,mount.events.length),id+': no source repeat, omission or reordering within one DOM image');
  assert(mount.events.length<=expected.length,id+': finite per-image source bound');
  assert(mount.events.every(e=>e.type===(failed?'error':'load')),id+': expected real image result');
  if(mount.connected){assert.equal(mount.retiredAt,null);assert.equal(mount.events.length,expected.length,id+': current image completed its whole declared chain');assert(mount.complete);if(failed){assert(mount.hidden&&mount.handlersDisabled,id+': terminal failure disables both handlers');assert.deepEqual(mount.remaining,[]);}}
  else{assert(mount.retiredAt>mount.revision,id+': retired image belongs to an actual content replacement');const next=mounts[i+1];assert(next&&next.revision===mount.retiredAt,id+': each retired image is replaced by a distinct mount in that render');}
 }
 return mounts;
}
function validateSymbolMountAssertions(){
 const sources=['https://fixture.invalid/first','https://fixture.invalid/second','https://fixture.invalid/last'];
 const current={mount:2,revision:3,id:'fixture',initial:sources[0],events:sources.map(url=>({type:'error',url})),retiredAt:null,connected:true,complete:true,hidden:true,handlersDisabled:true,remaining:[]};
 const retired={...current,mount:1,revision:2,retiredAt:3,connected:false};
 assertSymbolMounts([current],'fixture',sources);assertSymbolMounts([retired,current],'fixture',sources);assertSymbolMounts([{...retired,events:retired.events.slice(0,1)},current],'fixture',sources);
 assert.throws(()=>assertSymbolMounts([{...current,events:[...current.events,...current.events]}],'fixture',sources),/repeat|finite/,'Two chains on ONE DOM image remain a regression');
 assert.throws(()=>assertSymbolMounts([{...current,events:[current.events[1],current.events[0],current.events[2]]}],'fixture',sources),/reordering/);
 assert.throws(()=>assertSymbolMounts([{...retired,retiredAt:null},current],'fixture',sources),/content replacement/);
 assert.throws(()=>assertSymbolMounts([{...retired,mount:0},retired,current],'fixture',sources),/at most two/);
 assert.throws(()=>assertSymbolMounts([{...current,handlersDisabled:false}],'fixture',sources),/disables both handlers/);
 assert.throws(()=>assertSymbolMounts([{...current,events:current.events.slice(0,2)}],'fixture',sources),/completed its whole/);
}
export async function validateFixtures(){
 validateSymbolMountAssertions();
 assert.equal(VASM.code,'VASM');assert.equal(VASM.name,'Valiant Smashers');
 const summary=summarizeYgoSetContents(VASM,CARDS.ygo),multi=setContextCard('ygo',CARDS.ygo.find(c=>c.id===EXPECTED.ygo.multiple),VASM,YGO_SETS),known=setContextCard('ygo',CARDS.ygo.find(c=>c.id===EXPECTED.ygo.known),VASM,YGO_SETS);
 assert.equal(summary.loadedUniqueCards,4);assert.equal(multi.setContext.printings.length,4);assert.equal(multi.setContext.printingAmbiguous,true);assert.equal(multi.setContext.price,null);
 assert.equal(CARDS.ygo[0].prices.usd,999);assert.equal(multi.setContext.printings.filter(p=>p.rarity==='Ultra Rare').length,2);assert.equal(multi.setContext.printings.filter(p=>p.rarity==='Super Rare').length,1);
 assert.equal(presentationQuote('ygo',multi).value,null);assert.equal(presentationQuote('ygo',multi,'reference','VASM-EN001::Super Rare').value,null);assert.equal(presentationQuote('ygo',known).value,12.5);
 assert.equal(presentationQuote('mtg',CARDS.mtg[0],'nonfoil').value,12.5);assert.equal(presentationQuote('ptcg',CARDS.ptcg[0],'normal').value,12.5);
 for(const game of GAMES)assert.equal(validateWorkspace(structuredClone(makeFixtures(game).state)).settings.game,game);
 assert.notEqual(CARDS.mtg[0].name,CARDS.mtg[1].name);assert.notEqual(CARDS.mtg[0].collector_number,CARDS.mtg[1].collector_number);
 assert.equal(SETS.ptcg[2].name,'Synthetic Missing Symbol');assert.equal(SETS.ptcg[2].symbol,undefined);assert.equal(SETS.ptcg[2].logo,undefined);
 // Run the production provider adapter without a server or network. A fixture
 // can normalize cards correctly yet still invalidate the whole set catalogue.
 const originalFetch=globalThis.fetch,providerCalls=[];let pokemonSets;
 try{
  globalThis.fetch=async input=>{const url=new URL(String(input)),data=providerFixture(url);assert.equal(url.hostname,'api.tcgdex.net','Pure provider validation cannot contact another host');assert.notEqual(data,undefined,'Every adapter read has an explicit fixture: '+url.href);providerCalls.push(url.pathname);return {ok:true,status:200,json:async()=>structuredClone(data)};};
  pokemonSets=await ptcgSource.sets();
  assert.deepEqual(providerCalls,['/v2/en/sets','/v2/en/series']);
  assert.deepEqual(pokemonSets.map(s=>s.id),SETS.ptcg.map(s=>s.id),'Every valid release survives the real provider adapter');
  assert(pokemonSets.every(s=>s.id&&s.name),'The app rejects the entire catalogue if any release lacks id or name');
  for(const [id,key]of [['sv08','normal'],['sv03','broken'],['synthetic-missing','missing']])assert.deepEqual(pkCatalogueSymbolSources(pokemonSets.find(s=>s.id===id)),SYMBOLS[key].map(u=>u.startsWith('/')?u.slice(1):u),'Exact declared symbol chain for '+id);
  assert.deepEqual(pkCatalogueSymbolSources(pokemonSets.find(s=>s.id==='base1')),[],'Base Set has no expansion symbol and must create no image');
  const cards=await ptcgSource.setCards(pokemonSets[0]);assert.deepEqual(cards.map(c=>c.id),CARDS.ptcg.map(c=>c.id));assert(cards.every(c=>c.set.id===EXPECTED.ptcg.set),'Set response preserves exact release identity');
 }finally{globalThis.fetch=originalFetch;}
 for(const game of GAMES){const history=emptyHistory(new URL('https://fixture.invalid/api/prices/recent?'+new URLSearchParams({game,id:EXPECTED[game].known,finish:'reference'})));assert.equal(history.series.length,0);assert.equal(historyResponseStatus(history),'empty','The fixture must exercise a verified empty response, not a provider outage.');}
 return 'PASS: exact VASM code/rarity collisions, unique rarity proof, poisoned generic prices, all-game $12.50 references, empty provider histories and Pokemon missing/failed-symbol fixtures. No browser/server or network started.';
}

export async function openApp(browser,base,{game='ygo',hash='#sets',width=390,height=1000,reducedMotion='no-preference',failSymbols=false,evidenceLabel=game}={}){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Browser fixtures are hosted Actions only.');
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,reducedMotion,locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],writes=[],unexpected=[],requests=[],images=[];const fixtures=makeFixtures(game);
 const diagnostics=()=>({errors:[...errors],writes:[...writes],unexpected:[...unexpected],requests:requests.map(r=>({...r})),images:[...images]});
 try{
 const artURLs=new Set(CARDS.mtg.flatMap(c=>Object.values(c.image_uris)).concat(...Object.values(CARDS).flat().map(c=>[...artworkSources(c,false),...artworkSources(c,true),c.art,c.artDirect]).flat()).filter(Boolean).map(u=>new URL(u,base+'/').href));
 for(const game of GAMES)artURLs.add(IMAGE+'/hero-'+game+'.svg');
 for(const set of SETS.mtg)artURLs.add(set.icon_svg_uri);
 for(const code of ['VASM','OTHR'])artURLs.add('https://images.ygoprodeck.com/images/sets/'+code+'.jpg');
 for(const set of SETS.ptcg)for(const suffix of ['symbol.png','logo.png'])artURLs.add('https://images.pokemontcg.io/'+set.id+'/'+suffix);
 for(const suffix of ['logo.webp','symbol.webp'])for(const id of ['sv08','sv03'])artURLs.add('https://assets.tcgdex.net/en/sv/'+id+'/'+suffix);
 for(const path of Object.values(SYMBOLS).flat())artURLs.add(new URL(path,base+'/').href);
 for(const slug of ['rare','common','ultra-rare'])for(const path of ['/img/pks/r/'+slug+'.png','https://pokesymbols.com/images/tcg/rarities/'+slug+'.png'])artURLs.add(new URL(path,base+'/').href);
 artURLs.add('https://svgs.scryfall.io/card-symbols/C.svg');
 const symbolURLs=new Set(Object.values(SYMBOLS).flat().map(u=>new URL(u,base+'/').href)),brokenURLs=new Set([...SYMBOLS.broken,...SYMBOLS.missing].map(u=>new URL(u,base+'/').href));
 page.on('pageerror',error=>errors.push(error.message));
 assert.equal(typeof context.routeWebSocket,'function');await context.routeWebSocket('**/*',ws=>{unexpected.push('WEBSOCKET '+ws.url());ws.close();});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),record={method:req.method(),url:url.href,settled:false};requests.push(record);
  const fulfill=async(body,status=200,type='application/json')=>{try{await route.fulfill({status,contentType:type,headers:{'access-control-allow-origin':'*'},body:type==='application/json'?JSON.stringify(body):body});}finally{record.settled=true;}};
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(req.method()+' '+url.href);return fulfill({error:'Mutations, AI and paid calls forbidden.'},403);}
  if(req.method()==='OPTIONS')return fulfill('',204,'text/plain');
  if(url.hostname==='fonts.googleapis.com')return fulfill('/* fixture system fonts */',200,'text/css');
  if(req.resourceType()==='image'&&artURLs.has(url.href)){images.push(url.href);const failed=failSymbols&&symbolURLs.has(url.href)||brokenURLs.has(url.href);return fulfill(failed?'not an image':/\/logo\.(?:png|webp)$/.test(url.pathname)?LOGO:symbolURLs.has(url.href)||url.hostname==='svgs.scryfall.io'?SYMBOL:ART,200,'image/svg+xml');}
  if(isHistoryURL(url))return fulfill(emptyHistory(url));
  if(url.origin===base){
   if(url.pathname==='/catalog.json')return fulfill({cards:[],snapshot_date:'2000-01-01'});
   if(url.pathname==='/api/community')return fulfill({game:url.searchParams.get('game'),status:'unavailable',items:[],fetchedAt:ISO});
   if(url.pathname.startsWith('/api/prices/'))return fulfill({points:[],series:[],cards:[],products:[],variants:[],prices:{},partial:false});
   if(url.pathname.startsWith('/api/meta/'))return fulfill({events:[],decks:[],archetypes:[],top:[]});
   if(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/img/')){record.settled=true;return route.continue();}
  }
  const fixture=providerFixture(url);if(fixture!==undefined)return fulfill(fixture);
  unexpected.push(req.method()+' '+url.href);return fulfill({error:'Unmapped request blocked; no external traffic forwarded.'},451);
 });
 await page.addInitScript(({storage,now})=>{const NativeDate=Date,offset=now-NativeDate.now();globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}static now(){return NativeDate.now()+offset;}};Math.random=()=>0;if(!localStorage.getItem('card-polish-fixtures-installed')){for(const[k,v]of Object.entries(storage))localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('cardstashy-tour-v1','done');localStorage.setItem('cardstashy-glass','off');localStorage.setItem('card-polish-fixtures-installed','1');}}, {storage:fixtures.storage,now:NOW});
 await page.addInitScript(observeSymbolMounts);
 await page.goto(base+'/'+hash);await page.locator('#app.ready').waitFor();await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');window.__polishPricing=await import('/pricing-presentation.js');});
 await page.waitForFunction(g=>document.body.dataset.game===g&&window.__uiTestState.state.settings.game===g,game);
 const health=()=>{const issues=[];for(const [actual,label]of [[errors,'No uncaught app errors'],[writes,'No attempted writes/paid calls'],[unexpected,'Every external read explicitly mocked; none forwarded']])try{assert.deepEqual(actual,[],label);}catch(error){issues.push(error);}if(issues.length){const error=new AggregateError(issues,'Fixture safety failure');error.fixtureDiagnostics=diagnostics();throw error;}};
 return {context,page,fixtures,requests,images,health,diagnostics};
 }catch(error){error.fixtureDiagnostics=diagnostics();try{await capture(page,'card-polish-bootstrap-failure-'+evidenceLabel);}catch(captureError){error.fixtureDiagnostics.screenshotError=String(captureError);}await context.close();throw error;}
}
