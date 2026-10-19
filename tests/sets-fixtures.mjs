// Hosted Sets regression fixtures. No browser is imported or started here.
// The server/helper architecture is shared read-only with the detail suite.
// Every provider response is synthetic; no live API, AI, payment or cloud write
// can be forwarded. Known card IDs deliberately retain their exact identity.
import assert from 'node:assert/strict';
import {blank} from '../store.js';
import {cardKey} from '../core.js';
import {validateWorkspace} from '../confidence.js';
import {normalizePtcg} from '../ptcg.js';
import {normalizeYgo, normalizeYgoSets, ygoSetId, summarizeYgoSetContents, resolveYgoSet} from '../ygo.js';
import {artworkSources} from '../artwork.js';
import {pkCatalogueSymbolSources} from '../emblems.js';
import {setRowContent} from '../set-list-ui.js';
import {SUPABASE} from '../config.js';
import {capture as captureEvidence} from './detail-rules-fixtures.mjs';
export {startServer, navigate, closeSheet, inventorySnapshot, noOverflow, capture, saveReport, WIDTHS, RESULTS} from './detail-rules-fixtures.mjs';

export const GAMES=['mtg','ptcg','ygo'];
export const NOW=Date.parse('2026-10-17T12:00:00.000Z'),ISO=new Date(NOW).toISOString();
export const IMAGE='https://sets-fixtures.invalid';
export const ART_EVIDENCE='SYNTHETIC SETS FIXTURE: supplied and derived image URLs are intercepted with labeled SVGs. These tests verify identity, layout and fallback, not real provider illustrations or live availability.';
const SVG='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#223a59"/><circle cx="315" cy="330" r="175" fill="#c7a662"/><path d="M0 680 180 440 380 700 630 500V880H0Z" fill="#164948"/><text x="24" y="54" fill="white" font-size="26">SYNTHETIC SETS FIXTURE</text><text x="24" y="836" fill="white" font-size="23">NOT REAL CARD ART</text></svg>';
const digits=n=>String(n).padStart(3,'0');
const original={set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08',num_of_cards:744,set_image:`${IMAGE}/lob-original.svg`};
const anniversary={set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-21',num_of_cards:126,set_image:`${IMAGE}/lob-anniversary.svg`};
const paged={set_code:'FXP',set_name:'Synthetic paginated booster fixture',tcg_date:'2025-02-01',num_of_cards:207,set_image:`${IMAGE}/broken-set.svg`};
export const YGO_RAW_SETS=[original,anniversary,paged,{set_code:'KC01',set_name:'Synthetic KC01 fixture',tcg_date:'2022-01-01',num_of_cards:1},...Array.from({length:123},(_,i)=>({set_code:`FX${digits(i)}`,set_name:`Synthetic ${i%3===0?'Starter Deck':i%3===1?'Anniversary Collection':'Booster'} ${digits(i)}`,tcg_date:`${2020-i%4}-01-01`,num_of_cards:i===0?0:10,set_image:i%5?`${IMAGE}/set-${i}.svg`:undefined})),{set_code:'UND',set_name:'Synthetic undated release',num_of_cards:0}];
export const RELEASES=normalizeYgoSets(YGO_RAW_SETS);
export const LOB=RELEASES.find(s=>s.id===ygoSetId(original));
export const ANNIVERSARY=RELEASES.find(s=>s.id===ygoSetId(anniversary));
export const PAGED=RELEASES.find(s=>s.id===ygoSetId(paged));
export const SETS={
 mtg:[{code:'fxa',name:'Synthetic Magic A',released_at:'2025-01-01',set_type:'expansion',card_count:123,icon_svg_uri:`${IMAGE}/mtg-a.svg`},{code:'fxb',name:'Synthetic Magic B',released_at:'2024-01-01',set_type:'expansion',card_count:3,icon_svg_uri:`${IMAGE}/broken-set.svg`},{code:'fxu',name:'Synthetic unknown Magic',released_at:'',set_type:'expansion',card_count:null,icon_svg_uri:`${IMAGE}/unknown.svg`},{code:'fxpromo',name:'Synthetic promo excluded by default',released_at:'2023-01-01',set_type:'promo',card_count:1}],
 ptcg:[{id:'fixturea',name:'Synthetic Pokémon A',releaseDate:'2025-01-01',cardCount:{total:123,official:123},logo:`${IMAGE}/ptcg-a`},{id:'fixtureb',name:'Synthetic Pokémon B',releaseDate:'2024-01-01',cardCount:{total:3,official:3},logo:`${IMAGE}/broken-set`},{id:'fixtureunknown',name:'Synthetic unknown Pokémon',releaseDate:'',cardCount:{},logo:`${IMAGE}/unknown`},...Array.from({length:121},(_,i)=>({id:`fixture${digits(i)}`,name:`Synthetic Pokémon set ${digits(i)}`,releaseDate:`${2023-i%3}-01-01`,cardCount:{total:10}}))],
 ygo:RELEASES
};
// Exact user screenshot families; source metadata checked against Scryfall on
// 2026-10-19. Counts and artwork remain synthetic and do not represent live cards.
export const SET_BROWSER_FAMILY_CASES=[['trk','Star Trek','expansion'],['fra','Reality Fracture','expansion'],['trc','Star Trek Commander','commander'],['frc','Reality Fracture Commander','commander'],['mbc','Mystery Booster Commander Edition','draft_innovation']].map(([code,name,set_type])=>({code,name,set_type,released_at:'2026-11-13',card_count:100,icon_svg_uri:`${IMAGE}/screenshot-${code}.svg`}));
SETS.mtg.push(...SET_BROWSER_FAMILY_CASES);
// The catalogue now tries symbols, not the supplied logo. Fail every exact
// source for this one release without permitting a wildcard external host.
export const BROKEN_SET_SYMBOL_SOURCES=Object.freeze(pkCatalogueSymbolSources(SETS.ptcg.find(s=>s.id==='fixtureb')));
export const isBrokenSetSymbol=(url,base)=>BROKEN_SET_SYMBOL_SOURCES.some(source=>new URL(source,base+'/').href===url.href);
// These exact derived icon requests are part of the synthetic fixtures: the
// colorless Magic tile emblem and the promo row with no supplied icon URL.
// Never wildcard an external image host or forward a missing asset to it.
export const SYNTHETIC_ICON_URLS=Object.freeze([
 'https://svgs.scryfall.io/card-symbols/C.svg',
 'https://svgs.scryfall.io/sets/fxpromo.svg'
]);
const magic=(set,n)=>({id:`fixture-mtg-set-${set==='fxa'?'a':'b'}-${digits(n)}`,oracle_id:n===1?'same-oracle-both-printings':`fixture-oracle-${set}-${n}`,name:n===1?'Fixture exact printing':'Fixture Magic '+digits(n),lang:'en',type_line:'Artifact',oracle_text:'Synthetic fixture text.',cmc:0,mana_cost:'',colors:[],color_identity:[],keywords:[],legalities:{standard:'legal',commander:'legal'},set,set_name:SETS.mtg.find(s=>s.code===set).name,collector_number:String(n),rarity:n%2?'common':'rare',finishes:['nonfoil','foil'],image_uris:{normal:`${IMAGE}/mtg-${set}-${n}.svg`,small:`${IMAGE}/mtg-${set}-${n}.svg`,art_crop:`${IMAGE}/mtg-${set}-${n}.svg`},prices:{usd:n===1?null:String(n),usd_foil:n===1?null:String(n+1)},checkedAt:ISO,full:true,released_at:SETS.mtg.find(s=>s.code===set).released_at});
const pokemon=(set,n)=>({id:`${set}-${digits(n)}`,localId:digits(n),name:n===1?'Fixture same-name Trainer':'Fixture Pokémon '+digits(n),category:n===1?'Trainer':'Pokemon',trainerType:n===1?'Supporter':undefined,stage:n===1?undefined:'Basic',hp:n===1?undefined:80,types:n===1?[]:['Colorless'],rarity:n%2?'Common':'Rare',image:`${IMAGE}/ptcg-${set}-${n}`,set:SETS.ptcg.find(s=>s.id===set),legal:{standard:true,expanded:true},variants:{normal:true,holo:true},pricing:{tcgplayer:{normal:{marketPrice:n===1?null:n},holofoil:{marketPrice:n===1?null:n+1},updated:'2026-10-17'}},attacks:n===1?[]:[{name:'Fixture attack',cost:[],damage:10}],effect:n===1?'Synthetic Trainer fixture text.':''});
const ygo=(id,name,prints)=>({id,name,type:'Spell Card',frameType:'spell',race:'Normal',desc:'Synthetic provider rows. Not a live printing or price claim.',card_images:[{id}],card_sets:prints,card_prices:[{tcgplayer_price:'999.00',cardmarket_price:'888.00'}],misc_info:[{formats:['TCG','OCG'],tcg_date:'2002-03-08'}]});
const printing=(release,code,rarity='Common',price='')=>({set_name:release.set_name,set_code:code,set_rarity:rarity,set_price:price});
const ygoIds=[4614116,89631139,46986414,...Array.from({length:11},(_,i)=>99000100+i)];
const ygoRows=ygoIds.map((id,i)=>ygo(id,i===0?'Dark Energy':i===1?'Blue-Eyes White Dragon':i===2?'Dark Magician':`Synthetic LOB card ${digits(i)}`,[...(i===0?[printing({set_name:'Synthetic KC01 fixture'},'KC01-EN001','Ultra Rare','999.00')]:[]),printing(original,i===0?'LOB-118':i===1?'LOB-001':i===2?'LOB-005':`LOB-${digits(i+20)}`,i===1||i===2?'Ultra Rare':'Common'),printing(anniversary,i===0?'LOB-EN118':i===1?'LOB-EN001':i===2?'LOB-EN005':`LOB-EN${digits(i+20)}`,i===1||i===2?'Ultra Rare':'Common'),...(i===2?[printing(original,'LOB-EN005','Ultra Rare'),printing(original,'LOB-E005','Rare')]:[])]));
export const RAW={mtg:[...Array.from({length:123},(_,i)=>magic('fxa',i+1)),...Array.from({length:3},(_,i)=>magic('fxb',i+1))],ptcg:[...Array.from({length:123},(_,i)=>pokemon('fixturea',i+1)),...Array.from({length:3},(_,i)=>pokemon('fixtureb',i+1))],ygo:ygoRows};
export const YGO_PAGED=Array.from({length:103},(_,i)=>ygo(99100000+i,`Synthetic paged card ${digits(i)}`,[printing(paged,`FXP-${digits(i+1)}`)]));
export const CARDS={mtg:RAW.mtg,ptcg:RAW.ptcg.map(c=>({...normalizePtcg(c),fetchedAt:ISO,printPriceSchema:1})),ygo:[...RAW.ygo,...YGO_PAGED].map(c=>({...normalizeYgo(c),fetchedAt:ISO,printPriceSchema:1}))};
export const EXPECTED={mtg:{a:'fxa',b:'fxb',id:CARDS.mtg[0].id,otherId:'fixture-mtg-set-b-001',count:123},ptcg:{a:'fixturea',b:'fixtureb',id:'fixturea-001',otherId:'fixtureb-001',count:123},ygo:{a:LOB.id,b:ANNIVERSARY.id,id:'4614116',otherId:'89631139',count:126}};

export function makeSetsFixtures(game='ygo',{ownership='exact',legacy=false}={}){
 const state=blank();state.settings.game=game;state.tcg={ptcg:{collection:[],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 const lot=(g,id,extra)=>({id:`fixture-owned-${g}-${id}`,cardId:id,name:CARDS[g].find(c=>c.id===id)?.name||'',key:`id:${id}`,qty:5,condition:'Lightly Played',language:'en',finish:'nonfoil',addedAt:ISO,...extra});
 state.collection=[lot('mtg',EXPECTED.mtg.otherId,{printingId:EXPECTED.mtg.otherId,printingVerified:true,set:'FXB',collectorNumber:'1'})];
 state.tcg.ptcg.collection=[lot('ptcg',EXPECTED.ptcg.otherId,{key:'name:Fixture same-name Trainer',variant:'normal',printing:'fixtureb',number:'001'})];
 state.tcg.ygo.collection=[lot('ygo','4614116',{printing:'KC01-EN001',rarity:'Ultra Rare',edition:'unlimited'}),lot('ygo','46986414',{printing:'LOB-EN005',rarity:'Ultra Rare',edition:''})];
 if(ownership==='exact')state.tcg.ygo.collection.push(lot('ygo','89631139',{printing:'LOB-001',rarity:'Ultra Rare',edition:'unlimited',setReleaseId:LOB.id,setName:LOB.name}));
 state.myPrices={'4614116:nonfoil':{price:987.65,name:'Dark Energy',at:ISO}};
 state.printings=Object.fromEntries(CARDS.mtg.map(c=>[c.id,c]));
 const catalog=Object.fromEntries(CARDS.mtg.map(c=>[cardKey(c.name),c])),cache={ptcg:Object.fromEntries(CARDS.ptcg.map(c=>[c.id,c])),ygo:Object.fromEntries(CARDS.ygo.map(c=>[c.id,c]))};
 const storage={'cardforge-v2':state,'cardforge-catalog-v1':catalog,'cardforge-tcg-cache-v1':cache,'cardforge-community-v1':Object.fromEntries(GAMES.map(g=>[g,{at:NOW,data:{game:g,status:'unavailable',items:[],fetchedAt:ISO}}])),'cardforge-meta-v1':Object.fromEntries(['mtg:Standard','mtg:EDH','ptcg','ygo'].map(g=>[g,{at:NOW,data:{game:g.split(':')[0],events:[],decks:[],archetypes:[],top:[]}}])),'cardstashy-watch-sent-v1':Object.fromEntries(GAMES.flatMap(g=>CARDS[g].map(c=>[`${g}:${c.id}`,NOW]))),'cardforge-hero-v2':{date:'2026-10-17',...Object.fromEntries(GAMES.map(g=>[g,{name:CARDS[g][0].name,id:CARDS[g][0].id,art:`${IMAGE}/hero-${g}.svg`}]))},'cf-mtg-tcg-v1':{fxa:{t:NOW,prices:{}},fxb:{t:NOW,prices:{}}}};
 if(legacy)storage['cardforge-ygo-sets-v2']={at:NOW,list:[original,anniversary].map(s=>({id:s.set_code,code:s.set_code,name:s.set_name,date:s.tcg_date,count:s.num_of_cards}))};
 return {state,catalog,cache,storage};
}

export function providerFixture(url){
 const host=url.hostname,path=url.pathname;
 if(host==='api.scryfall.com'){
  if(path==='/sets')return {data:SETS.mtg};
  if(path.startsWith('/sets/'))return SETS.mtg.find(s=>s.code===decodeURIComponent(path.split('/').at(-1)))||{object:'error',details:'Unknown synthetic set'};
  if(path==='/cards/search'){
   const q=url.searchParams.get('q')||'',set=q.match(/\be:([^\s]+)/)?.[1],rows=set?CARDS.mtg.filter(c=>c.set===set):CARDS.mtg.filter(c=>q.includes(c.oracle_id)),page=Number(url.searchParams.get('page')||1),size=100;
   return {object:'list',data:rows.slice((page-1)*size,page*size),total_cards:rows.length,has_more:page*size<rows.length,...(page*size<rows.length?{next_page:`https://api.scryfall.com/cards/search?${new URLSearchParams({q,page:String(page+1)})}`}:{})};
  }
  if(path.endsWith('/rulings'))return {data:[]};
  if(path==='/cards/named')return CARDS.mtg.find(c=>c.name===(url.searchParams.get('exact')||url.searchParams.get('fuzzy')));
  if(path.startsWith('/cards/')){const parts=path.split('/').filter(Boolean);return parts.length>=3?CARDS.mtg.find(c=>c.set===parts[1]&&c.collector_number===decodeURIComponent(parts[2])):CARDS.mtg.find(c=>c.id===parts.at(-1));}
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
  if(path.endsWith('/cardinfo.php')){
   const name=url.searchParams.get('cardset'),ids=(url.searchParams.get('id')||'').split(',');
   let rows=name===PAGED.name?YGO_PAGED:name?[...RAW.ygo,...RAW.ygo.filter(c=>c.id===46986414)].filter(c=>c.card_sets.some(p=>p.set_name===name)):RAW.ygo.filter(c=>ids.includes(String(c.id)));
   const offset=Number(url.searchParams.get('offset')||0),size=Number(url.searchParams.get('num')||100);
   return {data:rows.slice(offset,offset+size),meta:{total_rows:rows.length,rows_remaining:Math.max(0,rows.length-offset-size)}};
  }
 }
 return undefined;
}
const historyEndpoint=new URL('/functions/v1/market-history',SUPABASE.url);
const history=url=>({game:url.searchParams.get('game'),cardId:url.searchParams.get('id'),finish:url.searchParams.get('finish'),series:[],notice:'Synthetic fixture has no matching history quote.'});
export async function validateSetsFixtures(){
 const broken=SETS.ptcg.find(s=>s.id==='fixtureb'),base='http://127.0.0.1:1';
 assert.deepEqual(BROKEN_SET_SYMBOL_SOURCES,['img/pks/s/synthetic-pokemon-b.png','https://pokesymbols.com/images/tcg/sets/symbols/synthetic-pokemon-b.png']);
 assert.deepEqual(BROKEN_SET_SYMBOL_SOURCES,pkCatalogueSymbolSources({...broken,symbol:''}),'The failure fixture follows the real normalized catalogue symbol chain');
 for(const source of BROKEN_SET_SYMBOL_SOURCES)assert(isBrokenSetSymbol(new URL(source,base+'/'),base),'Every real symbol fallback is intercepted as an exact synthetic failure');
 for(const source of pkCatalogueSymbolSources(SETS.ptcg[0]))assert.equal(isBrokenSetSymbol(new URL(source,base+'/'),base),false,'The neighboring release must not inherit the failed-symbol rule');
 const brokenMarkup=setRowContent({name:broken.name,code:'FIXTUREB',pokemonSet:broken});
 assert(brokenMarkup.includes('src="'+BROKEN_SET_SYMBOL_SOURCES[0]+'"'));assert(brokenMarkup.includes('data-symbol-next="'+BROKEN_SET_SYMBOL_SOURCES[1]+'"'));assert(!brokenMarkup.includes('data-symbol-last='));assert(!brokenMarkup.includes(broken.logo),'A broken logo alone cannot exercise catalogue symbol fallback');
 assert.equal(new Set(SYNTHETIC_ICON_URLS).size,2);
 assert.deepEqual(SYNTHETIC_ICON_URLS,['https://svgs.scryfall.io/card-symbols/C.svg','https://svgs.scryfall.io/sets/fxpromo.svg']);
 assert.equal(SETS.mtg.find(s=>s.code==='fxpromo').icon_svg_uri,undefined,'Promo fixture exercises the derived icon URL');
 assert.notEqual(LOB.id,ANNIVERSARY.id);assert.equal(LOB.expectedUniqueCards,126);assert.equal(LOB.printingCount,744);
 assert.equal(resolveYgoSet(RELEASES,'LOB').status,'ambiguous');assert.equal(resolveYgoSet(RELEASES,LOB.id).set.id,LOB.id);
 const normal=RAW.ygo.map(normalizeYgo),before=JSON.stringify(normal),summary=summarizeYgoSetContents(LOB,[...normal,...normal]);
 assert.equal(summary.loadedUniqueCards,14);assert.equal(summary.expectedUniqueCards,126);assert.equal(summary.completeness,'partial');assert.equal(new Set(summary.cards.map(c=>c.id)).size,14);assert.equal(JSON.stringify(normal),before);
 assert(summary.cards.every(c=>c.setContext.releaseId===LOB.id));assert(summary.cards[0].sets.some(p=>p.code==='KC01-EN001'));assert(summary.cards[0].setContext.printings.every(p=>p.name===LOB.name));assert.equal(summary.cards[0].prices.usd,999);
 const p=summarizeYgoSetContents(PAGED,YGO_PAGED.slice(0,100).map(normalizeYgo),{paginationComplete:false,loadError:'Synthetic failure'});assert.equal(p.loadedUniqueCards,100);assert.equal(p.expectedUniqueCards,null);assert.equal(p.completeness,'partial');
 for(const g of GAMES){const f=makeSetsFixtures(g),valid=validateWorkspace(structuredClone(f.state));assert.equal(valid.settings.game,g);assert.equal(valid.collection[0].printingId,EXPECTED.mtg.otherId);assert.equal(valid.collection[0].condition,'Lightly Played');assert.equal(valid.tcg.ptcg.collection[0].cardId,EXPECTED.ptcg.otherId);assert.equal(valid.tcg.ptcg.collection[0].condition,'Lightly Played');assert.equal(valid.tcg.ptcg.collection[0].key,'name:Fixture same-name Trainer','Trainer fixture retains gameplay name-equivalence while Set ownership must remain printing-exact');assert.equal(valid.tcg.ygo.collection[0].cardId,'4614116');assert.equal(valid.tcg.ygo.collection[0].printing,'KC01-EN001');assert.equal(valid.tcg.ygo.collection[0].condition,'Lightly Played');assert.equal(valid.tcg.ygo.collection.at(-1).qty,5);assert.equal(valid.tcg.ygo.collection.at(-1).setReleaseId,LOB.id);assert.equal(valid.tcg.ygo.collection[1].edition,'');assert.equal(valid.tcg.ygo.collection[1].setReleaseId,undefined);assert(CARDS[g].some(c=>c.id===EXPECTED[g].id));}
 const pg=providerFixture(new URL('https://api.scryfall.com/cards/search?q=e%3Afxa'));assert.equal(pg.data.length,100);assert.equal(providerFixture(new URL(pg.next_page)).data.length,23);assert.equal(providerFixture(new URL('https://api.scryfall.com/cards/fxa/1/en')).id,EXPECTED.mtg.id);
 assert.equal(providerFixture(new URL('https://db.ygoprodeck.com/api/v7/cardinfo.php?'+new URLSearchParams({cardset:LOB.name}))).data.length,15);
 return 'PASS: Sets fixtures retain exact all-three-game IDs, condition/printing contexts, 14/126 partial coverage, duplicate regional rows, release collisions, paginated boundaries and synthetic-art provenance. No browser started.';
}

export async function openSetsApp(browser,base,{game='ygo',hash='#sets',width=390,height=1000,reducedMotion='no-preference',ownership='exact',legacy=false,setPrices=false,evidenceLabel=game}={}){
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/,'Fixture server must be loopback');
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,reducedMotion,locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],writes=[],unexpected=[],requests=[],images=[],rules=[];const gates=[];const fixtures=makeSetsFixtures(game,{ownership,legacy});
 const diagnostics=()=>({errors:[...errors],writes:[...writes],unexpected:[...unexpected],requests:requests.map(r=>({...r}))});
 try{
 const artURLs=new Set(CARDS.mtg.flatMap(c=>Object.values(c.image_uris)).concat(...Object.values(CARDS).flat().map(c=>[...artworkSources(c,false),...artworkSources(c,true),c.art,c.artDirect]).flat()).filter(Boolean).map(u=>new URL(u,base+'/').href));
 for(const url of SYNTHETIC_ICON_URLS)artURLs.add(url);
 for(const code of RELEASES.map(s=>s.code))artURLs.add(`https://images.ygoprodeck.com/images/sets/${encodeURIComponent(code)}.jpg`);
 for(const s of SETS.ptcg)for(const suffix of ['symbol.png','logo.png'])artURLs.add(`https://images.pokemontcg.io/${s.id}/${suffix}`);
 page.on('pageerror',e=>errors.push(e.message));
 // Service workers are blocked above; websocket creation is blocked as well.
 assert.equal(typeof context.routeWebSocket,'function','Hosted runner must support fail-closed WebSocket routing');
 await context.routeWebSocket('**/*',ws=>{unexpected.push('WEBSOCKET '+ws.url());ws.close();});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),record={method:req.method(),url:url.href,settled:false};requests.push(record);
  const fulfill=async(body,status=200,type='application/json')=>{try{await route.fulfill({status,contentType:type,headers:{'access-control-allow-origin':'*'},body:type==='application/json'?JSON.stringify(body):body});}finally{record.settled=true;}};
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes.push(`${req.method()} ${url.href}`);return fulfill({error:'Live mutations, AI and paid calls are forbidden.'},403);}
  if(req.method()==='OPTIONS')return fulfill('',204,'text/plain');
  for(const gate of gates){if(!gate.used&&gate.match(url,req)){gate.used=true;gate.started();await gate.wait;}}
  const planned=rules.find(r=>r.remaining>0&&r.match(url,req));if(planned){planned.remaining--;return fulfill({error:'Deterministic source outage',message:'Synthetic source unavailable'},planned.status);}
  if(url.hostname==='fonts.googleapis.com')return fulfill('/* synthetic fixtures use system fonts */',200,'text/css');
  if(req.resourceType()==='image'&&(isBrokenSetSymbol(url,base)||url.hostname==='sets-fixtures.invalid'||artURLs.has(url.href)||url.origin===base&&/^\/img\/pks\/(s|r)\//.test(url.pathname))){images.push(url.href);const broken=url.href.includes('broken-set')||isBrokenSetSymbol(url,base);return fulfill(broken?'':SVG,broken?404:200,'image/svg+xml');}
  if(url.origin===historyEndpoint.origin&&url.pathname===historyEndpoint.pathname)return fulfill(history(url));
  if(url.origin===base){
   if(url.pathname==='/catalog.json')return fulfill({cards:[],snapshot_date:'2000-01-01'});
   if(url.pathname==='/api/community')return fulfill({game:url.searchParams.get('game'),status:'unavailable',items:[],fetchedAt:ISO});
   if(url.pathname==='/api/prices/archive'||url.pathname==='/api/prices/recent')return fulfill(history(url));
   if(setPrices&&url.pathname==='/api/prices/yugioh-set')return fulfill({name:LOB.name,code:'LOB',status:'ready',source:'Synthetic set price fixture',updatedAt:ISO,products:[{name:'Dark Energy',code:'LOB-118',rarity:'Common',productId:100001,quotes:[{edition:'1st Edition',market:15},{edition:'Unlimited',market:12.34}]},{name:'Blue-Eyes White Dragon',code:'LOB-001',rarity:'Ultra Rare',productId:100002,quotes:[{edition:'1st Edition',market:150}]}]});
   if(url.pathname.startsWith('/api/prices/'))return fulfill({points:[],series:[],cards:[],products:[],variants:[],prices:{},partial:false});
   if(url.pathname.startsWith('/api/meta/'))return fulfill({events:[],decks:[],archetypes:[],top:[]});
   if(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/img/')){record.settled=true;return route.continue();}
  }
  const fixture=providerFixture(url);if(fixture!==undefined)return fulfill(fixture);
  unexpected.push(`${req.method()} ${url.href}`);return fulfill({error:'Unmapped request blocked. No external traffic forwarded.'},451);
 });
 await page.addInitScript(({storage,now})=>{const NativeDate=Date,offset=now-NativeDate.now();globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}static now(){return NativeDate.now()+offset;}};Math.random=()=>0;if(!localStorage.getItem('sets-fixtures-installed')){for(const[k,v]of Object.entries(storage))localStorage.setItem(k,JSON.stringify(v));localStorage.setItem('cardstashy-tour-v1','done');localStorage.setItem('cardstashy-glass','off');localStorage.setItem('sets-fixtures-installed','1');}}, {storage:fixtures.storage,now:NOW});
 await page.goto(base+'/'+hash);await page.locator('#app.ready').waitFor();
 await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;window.__uiTestTcg=await import('/tcg.js');});
 await page.waitForFunction(g=>document.body.dataset.game===g&&window.__uiTestState.state.settings.game===g,game);
 const health=()=>{
  const issues=[];
  for(const [actual,message]of [[errors,'No uncaught application errors'],[writes,'No attempted live mutations or paid calls'],[unexpected,'Every external request was mapped or blocked, with none forwarded']]){
   try{assert.deepEqual(actual,[],message);}catch(error){issues.push(error);}
  }
  if(issues.length){const error=new AggregateError(issues,'Fixture safety checks failed');error.fixtureDiagnostics=diagnostics();error.stack+='\n'+issues.map(e=>e.stack).join('\n');throw error;}
 };
 return {context,page,fixtures,requests,images,health,diagnostics,
  fail(match,{count=1,status=503}={}){rules.push({match,remaining:count,status});},
  hold(match){let started,release;const seen=new Promise(r=>{started=r;}),wait=new Promise(r=>{release=r;}),gate={match,started,wait,used:false};gates.push(gate);return {seen,release};},
  async close(){try{health();}finally{await context.close();}}
 };
 }catch(error){
  // A failed boot still belongs to this independent fixture context. Preserve
  // diagnostics and pixels when available, then close it before the next game.
  error.fixtureDiagnostics=diagnostics();
  try{await captureEvidence(page,'sets-bootstrap-failure-'+evidenceLabel);}catch(captureError){error.fixtureDiagnostics.screenshotError=captureError.stack;}
  try{await context.close();}catch(closeError){error.fixtureDiagnostics.cleanupError=closeError.stack;}
  throw error;
 }
}
