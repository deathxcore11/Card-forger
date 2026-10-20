import {POKEMON_VARIANT_SCHEMA} from './pokemon-variant-options.js';
// Real renderer/action regressions with deterministic provider data. No live account or network.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {normalizeYgoSets} from './ygo.js';
import {normalizePtcg} from './ptcg.js';
import {selectedYgoCard,setContextCard,tcgCardSheet,tcgCollection,registerTcg,ui,cache,SOURCES,needsCardRefresh} from './tcg.js';
import {sellerModels} from './pricing-presentation.js';

const records=new Map(),nodes={'#sheet':{open:true},'#sheetBody':{scrollTop:23}};
globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
globalThis.document={body:{dataset:{}},querySelector:k=>nodes[k]||null};
globalThis.fetch=async()=>({ok:false,json:async()=>({})});
S.state=blank();S.state.tcg={ygo:blankGame(),ptcg:blankGame()};S.state.settings.game='ygo';S.ui.view='search';
const releases=normalizeYgoSets([
 {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08'},
 {set_code:'GFP2',set_name:'Ghosts From the Past: The 2nd Haunting',tcg_date:'2022-05-06'},
]).map(s=>({...s,expectedUniqueCards:s.code==='LOB'?126:183}));
const lob=releases.find(s=>s.code==='LOB'),ghost=releases.find(s=>s.code==='GFP2');
ui('ygo').sets.list=[lob,ghost];
const dragon={id:'89631139',game:'ygo',name:'Blue-Eyes White Dragon',typeLine:'Normal Monster',frame:'normal',text:'The legendary dragon.',stats:[],prices:{usd:2},image:'https://example.invalid/blue-eyes.jpg',artSchema:1,printPriceSchema:1,fetchedAt:new Date().toISOString(),sets:[
 {name:lob.name,code:'LOB-001',rarity:'Ultra Rare',price:5,productId:111,quotes:[{edition:'Unlimited',market:5}]},
 {name:ghost.name,code:'GFP2-EN175',rarity:'Ghost Rare',price:100,productId:222,quotes:[{edition:'1st Edition',market:100}]},
]};
cache.ygo[dragon.id]=dragon;
S.state.tcg.ygo.collection=[{id:'owned-lob',cardId:dragon.id,printing:'LOB-001',rarity:'Ultra Rare',setReleaseId:lob.id,edition:'unlimited',qty:4}];
const before=JSON.stringify(dragon),meta=html=>html.slice(html.indexOf('<div class="cs-meta">'),html.indexOf('<div id="card-panel-overview"'));
const context=(key,edition='')=>({type:'tcard',game:'ygo',id:dragon.id,priceEdition:key,priceYgoEdition:edition});
for(const [key,edition,release,owned,pid] of [
 ['LOB-001::Ultra Rare','unlimited',lob,1,111],
 ['GFP2-EN175::Ghost Rare','1st-edition',ghost,0,222],
 ['LOB-001::Ultra Rare','unlimited',lob,1,111],
]){
 const selected=selectedYgoCard(dragon,key,edition),html=tcgCardSheet(dragon,context(key,edition)),summary=meta(html);
 assert.equal(selected.displayRelease.releaseId,release.id);assert.equal(selected.sets,dragon.sets,'all search-origin printing choices survive projection');
 assert.equal(selected.setContext,undefined,'display identity must not create a browse scope');
 assert(summary.includes(`data-id="${release.id}"`));assert(summary.includes(release.name));assert(summary.includes(key.split('::')[0]));
 assert.match(summary,new RegExp(`aria-valuemax="${release.expectedUniqueCards}"`));assert.match(summary,new RegExp(`aria-valuenow="${owned}"`));
 const buy=summary.match(/class="btn small card-buy-link"[^>]*href="([^"]+)"/)?.[1];assert(buy?.includes(`/product/${pid}?`));
 if(release===ghost){assert.doesNotMatch(summary,/LOB-001|Legend of Blue Eyes|aria-valuemax="126"/);assert.match(summary,/Printing=1st\+Edition/);}
 assert(html.includes('LOB-001')&&html.includes('GFP2-EN175'),'Versions retain all printings');
}
assert.equal(JSON.stringify(dragon),before,'projection never mutates global card metadata or prices');
const unselected=meta(tcgCardSheet(dragon,context('')));assert.match(unselected,/Release not selected/);assert.doesNotMatch(unselected,/role="progressbar"|LOB-001|GFP2-EN175/);
const scoped=setContextCard('ygo',dragon,ghost,[lob,ghost]),selectedScoped=selectedYgoCard(scoped,'GFP2-EN175::Ghost Rare','1st-edition');
assert.equal(selectedScoped.setContext.releaseId,ghost.id);assert.equal(selectedScoped.sets,scoped.sets);assert.equal(selectedScoped.sets.length,1,'set-origin browsing remains intentionally scoped');
assert.equal(selectedYgoCard(scoped,'LOB-001::Ultra Rare','unlimited').prices.usd,null,'outside-scope selection cannot borrow a quote');

ui('ygo').sets.list=[];records.clear();
let unresolved=meta(tcgCardSheet(dragon,context('GFP2-EN175::Ghost Rare','1st-edition')));
assert.match(unresolved,/GFP2-EN175|Ghost Rare/);assert.match(unresolved,/Release unverified/);assert.doesNotMatch(unresolved,/role="progressbar"|data-act="tSet"|LOB-001/);
const reused=normalizeYgoSets([{set_code:'X',set_name:'Reused Release',tcg_date:'2001-01-01'},{set_code:'X',set_name:'Reused Release',tcg_date:'2023-01-01'}]);
ui('ygo').sets.list=reused;
const duplicate={...dragon,sets:[{name:'Reused Release',code:'X-001',rarity:'Rare',price:9,productId:333}]};
assert.equal(selectedYgoCard(duplicate,'X-001::Rare').displayRelease.status,'ambiguous');
unresolved=meta(tcgCardSheet(duplicate,context('X-001::Rare')));assert.match(unresolved,/X-001/);assert.match(unresolved,/Release unverified/);assert.doesNotMatch(unresolved,/role="progressbar"|data-act="tSet"/);
const repeated={...dragon,sets:[{...dragon.sets[0],code:'X-001'}, {...dragon.sets[0],code:'X-001',name:ghost.name}]};
assert.equal(selectedYgoCard(repeated,'X-001::Ultra Rare').displayRelease.releaseId,'');
ui('ygo').sets.list=[lob,ghost];

const A={},C={},I={},opened=[],toasts=[];
registerTcg({A,C,I,commit:async(fn,opts)=>opts?.guard&&!opts.guard()?false:fn(S.state),render(){},openSheet:(html,ctx)=>{S.ui.sheetCtx=ctx;opened.push(html);},closeSheet:()=>{S.ui.sheetCtx=null;},toast:x=>toasts.push(x),go(){},writeRecord:async()=>{}});
S.ui.sheetCtx=context('GFP2-EN175::Ghost Rare','1st-edition');A.tOwn({dataset:{id:dragon.id}});
assert.match(opened.at(-1),/value="GFP2-EN175\|Ghost Rare" selected/);assert.match(opened.at(-1),/value="1st-edition" selected/);
assert.match(opened.at(-1),/LOB-001/,'search-origin Add retains the full verified choice list');
Object.assign(nodes,{'#tQty':{value:'2'},'#tPrint':{value:'GFP2-EN175|Ghost Rare'},'#tEdition':{value:'1st-edition'},'#tCond':{value:'Near Mint'},'#tLoc':{value:''},'#lotManualValue':{value:''}});
await A.tOwnSave({dataset:{id:dragon.id}});
const saved=S.state.tcg.ygo.collection.at(-1);assert.equal(saved.setReleaseId,ghost.id);assert.equal(saved.printing,'GFP2-EN175');assert.equal(saved.rarity,'Ghost Rare');assert.equal(saved.edition,'1st-edition');assert.equal(saved.setReleaseUnverified,false);
await A.tCard({dataset:{id:dragon.id,entry:saved.id}});assert.equal(S.ui.sheetCtx.setId,ghost.id);assert.equal(S.ui.sheetCtx.priceEdition,'GFP2-EN175::Ghost Rare');assert.match(meta(opened.at(-1)),/aria-valuemax="183"/);
// Removing detail's oldest-release fallback must not remove collection date sorting.
const collection=tcgCollection();
assert(collection.indexOf(`data-entry="${saved.id}"`)<collection.indexOf('data-entry="owned-lob"'),'collection still orders verified release dates newest first');


// Pokémon edition rows must share the selected Buy resolver, including exact filters.
S.state.settings.game='ptcg';
const lugia={...normalizePtcg({id:'neo1-9',name:'Lugia',category:'Pokemon',rarity:'Rare',image:'https://example.invalid/lugia',localId:'9',set:{id:'neo1',name:'Neo Genesis',cardCount:{official:111}},variants:{holo:true},legal:{expanded:false}}),variantSchema:POKEMON_VARIANT_SCHEMA,priceFallbackSchema:3,fetchedAt:new Date().toISOString(),prices:{usd:20},variants:[{key:'holofoil',label:'Holofoil',usd:20,productId:86903},{key:'1st-edition-holofoil',label:'First Edition Holofoil',usd:100,productId:86903}]};
ui('ptcg').sets.list=[{id:'neo1',name:'Neo Genesis',count:111},{id:'cel25',name:'Celebrations',count:25}];cache.ptcg[lugia.id]=lugia;
for(const scopedFinish of ['', 'holofoil','1st-edition-holofoil']){
 const ctx={type:'tcard',game:'ptcg',id:lugia.id,...(scopedFinish?{setId:'neo1',setVariant:scopedFinish,priceFinish:scopedFinish}:{})};
 const html=tcgCardSheet(lugia,ctx),rows=[...html.matchAll(/<span class="variant-actions"><a[^>]*href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
 assert.equal(rows.length,2);
 for(const [i,v] of lugia.variants.entries())assert.equal(rows[i],sellerModels('ptcg',lugia,{priceFinish:v.key})[0].url);
 assert.equal(new URL(rows[0]).searchParams.get('Printing'),'Holofoil');assert.equal(new URL(rows[1]).searchParams.get('Printing'),'1st Edition Holofoil');assert.notEqual(rows[0],rows[1]);
}
assert.equal(needsCardRefresh('ptcg',{...lugia,variantSchema:9}),true);assert.equal(needsCardRefresh('ptcg',lugia),false);

// A preview must keep enriched cached identities, visible cached rows, page coverage and failures.
const cachedOther={...lugia,id:'cel25-022',set:{id:'cel25',name:'Celebrations',number:'022',total:25},variants:[]};cache.ptcg[cachedOther.id]=cachedOther;
const oldSearch=SOURCES.ptcg.search,oldGet=SOURCES.ptcg.get;let resolve,reject,calls=0;
SOURCES.ptcg.get=async()=>{throw Error('Fresh fixture should not fetch detail');};
SOURCES.ptcg.search=spec=>{calls++;assert.equal(spec.page,0);assert.equal(spec.exactName,true);return new Promise((a,b)=>{resolve=a;reject=b;});};
const settle=()=>new Promise(r=>setImmediate(r));
try{
 await A.tCard({dataset:{id:lugia.id}});const first=S.ui.sheetCtx;
 assert.equal(first.previewBusy,true);assert.equal(first.previewMore,null);assert.match(opened.at(-1),/Celebrations/);assert.match(opened.at(-1),/Loading more printing details/,'loading status remains visible alongside cache rows');
 resolve({cards:[{game:'ptcg',id:cachedOther.id,name:'Lugia',brief:true},{game:'ptcg',id:'other-1',name:'Lugia V',brief:true}],more:true});await settle();
 assert.equal(first.previewBusy,false);assert.equal(first.previewMore,true);assert.equal(first.previewError,'');assert.deepEqual(first.previewPrints,[cachedOther]);assert.equal(cache.ptcg[cachedOther.id],cachedOther);
 assert.match(opened.at(-1),/Celebrations/);assert.match(opened.at(-1),/#022/);assert.match(opened.at(-1),/Showing a preview/,'partial page status remains visible alongside results');
 await A.tCard({dataset:{id:lugia.id}});const failed=S.ui.sheetCtx;reject(Error('Fixture preview offline'));await settle();
 assert.equal(failed.previewBusy,false);assert.match(failed.previewError,/offline/);assert.equal(failed.previewMore,null);assert.match(opened.at(-1),/Celebrations/,'cached thumbnails survive request failure');assert.match(opened.at(-1),/Some printings couldn’t load/,'error status remains visible alongside cached thumbnails');
 await A.tCard({dataset:{id:lugia.id}});const closed=S.ui.sheetCtx;S.ui.sheetCtx=null;const renders=opened.length;
 resolve({cards:[{game:'ptcg',id:'late-1',name:'Lugia',brief:true}],more:false});await settle();assert.equal(opened.length,renders);assert.equal(closed.previewPrints,undefined);assert.equal(cache.ptcg['late-1'],undefined,'late results after close cannot change caches or reopen detail');
 await A.tCard({dataset:{id:lugia.id}});const complete=S.ui.sheetCtx;resolve({cards:[cachedOther],more:false});await settle();assert.equal(complete.previewMore,false);assert.equal(complete.previewBusy,false);assert.equal(calls,4,'inline preview only loads one bounded page per open');
}finally{SOURCES.ptcg.search=oldSearch;SOURCES.ptcg.get=oldGet;}
assert.deepEqual(toasts,[]);
console.log('PASS: selected YGO release/header/progress/Buy/Add/save, no oldest/ambiguous release fallback, scoped origin, exact Pokémon edition seller filters, rich cached preview identity, independent partial/error/loading state and stale-close isolation. No live network or account mutations.');
