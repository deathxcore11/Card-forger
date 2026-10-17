// Integration through real tOtherPrintings/tCard actions and injected providers.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {registerTcg,ui,cache,SOURCES,tcgCardSheet,setContextCard} from './tcg.js';
import {normalizePtcg,ptcgSource} from './ptcg.js';
import {normalizeYgoSets} from './ygo.js';
import {printingRows,printingSelection} from './printing-picker.js';
import {presentationQuote} from './pricing-presentation.js';
const records=new Map();globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)};
globalThis.document={body:{dataset:{}},querySelector:()=>({scrollTop:19})};globalThis.fetch=async()=>{throw Error('Unexpected network');};
S.state=blank();S.state.tcg={ptcg:blankGame(),ygo:blankGame()};S.state.settings.game='ptcg';S.ui.view='search';
const A={},C={},I={},opened=[],toasts=[];let config;
const context={A,C,I,commit:async()=>{throw Error('Printing selection must not commit');},render(){},toast:x=>toasts.push(x),go:()=>{throw Error('Printing picker must not navigate Search');},closeSheet:()=>{S.ui.sheetCtx=null;},openSheet:(html,sctx)=>{S.ui.sheetCtx=sctx;opened.push(html);},writeRecord:async()=>{},openPrintingPicker:async value=>{config=value;}};
registerTcg(context);
const realSearch=SOURCES.ptcg.search,realGet=SOURCES.ptcg.get,realYgoGet=SOURCES.ygo.get;
const pk=(id,name='Pikachu',variants={normal:true})=>normalizePtcg({id,name,category:'Pokemon',set:{id:id.split('-')[0],name:'Set '+id.split('-')[0]},variants,legal:{standard:true,expanded:true},pricing:{tcgplayer:{normal:{marketPrice:2},holofoil:{marketPrice:8}}}});
const source=pk('seta-1');cache.ptcg[source.id]=source;const next=pk('setb-2');
const parent={type:'tcard',game:'ptcg',id:source.id,tab:'versions',entryId:'old-lot',setId:'seta',setVariant:'normal',scroll:84};S.ui.sheetCtx=parent;
Object.assign(ui('ptcg').search,{q:'Unrelated search',f:{category:'Trainer'},own:'owned',maxPrice:'1',sort:'priceAsc',results:[source],page:2,more:true});
const searchBefore=structuredClone(ui('ptcg').search),stateBefore=structuredClone(S.state);
const calls=[];let gets=[];
SOURCES.ptcg.search=async spec=>{calls.push(spec);return spec.page===0?{cards:[{...next,brief:true},{...pk('bad-1','Pikachu ex'),brief:true}],more:true,total:3}:{cards:[pk('setc-3')],more:false,total:3};};
SOURCES.ptcg.get=async id=>{gets.push(id);return id===next.id?next:pk(id);};
try {
 assert.match(tcgCardSheet(source,parent),/data-act="tOtherPrintings"[^>]*data-id="seta-1"/);
 await A.tOtherPrintings({dataset:{id:source.id,name:source.name}});
 assert.equal(config.card,source,'source identity comes from global card, never parent release projection');assert.equal(config.parentContext,parent);
 assert.deepEqual(ui('ptcg').search,searchBefore);assert.deepEqual(S.state,stateBefore);
 const signal=new AbortController().signal;
 const first=await config.loadPage({cursor:null,signal});assert.deepEqual(first.cards.map(c=>c.id),['setb-2']);assert.deepEqual(gets,['setb-2'],'suffix-distinct cards are excluded before detail requests');assert.equal(first.nextCursor,1);assert.equal(first.complete,false);assert.equal(calls[0].exactName,true);
 const last=await config.loadPage({cursor:first.nextCursor,signal});assert.equal(last.complete,true);assert.equal(last.nextCursor,null);
 assert.deepEqual(ui('ptcg').search,searchBefore);assert.deepEqual(S.state,stateBefore);
 const rows=printingRows('ptcg',first.cards,{source,catalogue:[],projectCard:config.projectCard});
 const holo=rows.find(row=>row.variantKey==='holofoil');assert(holo?.selectable);assert.equal(holo.price,8);
 await config.onSelect(printingSelection(holo),parent);
 const selected=S.ui.sheetCtx;assert.equal(selected.id,next.id);assert.equal(selected.setId,'setb');assert.equal(selected.setVariant,'holofoil');assert.equal(selected.priceFinish,'holofoil');assert.equal(selected.entryId,'');assert.equal(selected.setMembership.releaseId,'setb','new selection carries its own proven membership even without Sets catalogue');assert.equal(selected.setMembership.cardId,next.id);
 const projection=setContextCard('ptcg',{...next,setContext:selected.setMembership},selected.setId,[],{variantKey:selected.setVariant});assert.equal(presentationQuote('ptcg',projection,'holofoil').value,8);
 assert.deepEqual(ui('ptcg').search,searchBefore);assert.deepEqual(S.state,stateBefore);
 // Cancellation stops hydration queue and never changes Search or selected detail.
 S.ui.sheetCtx=parent;await A.tOtherPrintings({dataset:{id:source.id,name:source.name}});const abort=new AbortController();abort.abort();const count=calls.length;await assert.rejects(config.loadPage({cursor:null,signal:abort.signal}),/cancelled/);assert.equal(calls.length,count);
 // Name-only links resolve a real exact card and reuse the first source page.
 S.ui.sheetCtx=null;calls.length=0;SOURCES.ptcg.search=async spec=>{calls.push(spec);return {cards:[pk('name-1','Exact new name')],more:false,total:1};};
 await A.tOtherPrintings({dataset:{name:'Exact new name'}});assert.equal(config.card.id,'name-1');await config.loadPage({cursor:null,signal});assert.equal(calls.length,1,'name-only launch does not repeat its source page');
 // Name-only resolution belongs to its originating view and route, even with
 // no parent sheet; navigation must not open a late picker over another page.
 const previousConfig=config,previousToasts=toasts.length;S.ui.sheetCtx=null;S.ui.view='meta';globalThis.location={hash:'#meta'};
 let resolveName;SOURCES.ptcg.search=()=>new Promise(resolve=>resolveName=resolve);
 const staleName=A.tOtherPrintings({dataset:{name:'Unique delayed name'}});S.ui.view='collection';globalThis.location.hash='#collection';
 resolveName({cards:[pk('delayed-1','Unique delayed name')],more:false,total:1});await staleName;assert.equal(config,previousConfig,'late name lookup never opens over a different view');assert.equal(toasts.length,previousToasts);
 S.ui.view='tdeck';globalThis.location.hash='#tdeck/first';
 const staleRoute=A.tOtherPrintings({dataset:{name:'Another unique delayed name'}});globalThis.location.hash='#tdeck/second';
 resolveName({cards:[pk('delayed-2','Another unique delayed name')],more:false,total:1});await staleRoute;assert.equal(config,previousConfig,'same-view route navigation also invalidates launch');
 let rejectName;SOURCES.ptcg.search=()=>new Promise((resolve,reject)=>rejectName=reject);
 const staleFailure=A.tOtherPrintings({dataset:{name:'Delayed failing name'}});globalThis.location.hash='#tdeck/third';rejectName(Error('old request failed'));await staleFailure;assert.equal(toasts.length,previousToasts,'stale launch failure stays silent');
 S.ui.view='search';globalThis.location.hash='#search';
 // Failed details cannot be marked complete even when a later page succeeds.
 S.ui.sheetCtx=parent;await A.tOtherPrintings({dataset:{id:source.id,name:source.name}});SOURCES.ptcg.search=async spec=>({cards:[{game:'ptcg',id:spec.page?'ok-1':'unavailable-1',name:'Pikachu',brief:true,prices:{}}],more:!spec.page});SOURCES.ptcg.get=async id=>{if(id==='unavailable-1')throw Error('Unavailable');return pk(id);};
 const incomplete=await config.loadPage({cursor:null,signal}),tail=await config.loadPage({cursor:incomplete.nextCursor,signal});assert.equal(tail.complete,false);assert.match(tail.note,/1 card details/);
 // YGO exact-release/printing/edition is separate from the old owned entry.
 S.state.settings.game='ygo';const releases=normalizeYgoSets([{code:'LOB',name:'Original',date:'2002-03-08'},{code:'LOB',name:'Anniversary',date:'2023-04-20'}]);ui('ygo').sets.list=releases;
 const yc={id:'y1',game:'ygo',name:'Blue-Eyes White Dragon',prices:{usd:999},sets:releases.map((release,i)=>({name:release.name,code:i?'LOB-EN001':'LOB-001',rarity:'Ultra Rare',price:77,quotes:[{edition:'1st Edition',market:13+i},{edition:'Unlimited',market:3+i}]})),fetchedAt:new Date().toISOString(),artSchema:1,printPriceSchema:1,stats:[]};cache.ygo.y1=yc;
 const oldContext={type:'tcard',game:'ygo',id:'y1',setId:releases[0].id,entryId:'old-ygo',priceYgoEdition:'1st-edition',priceEdition:'LOB-001::Ultra Rare',tab:'versions'};S.ui.sheetCtx=oldContext;
 Object.assign(ui('ygo').search,{q:'Leave alone',f:{type:'Spell Card'},maxPrice:'5',own:'missing',sort:'price'});const ySearch=structuredClone(ui('ygo').search),yState=structuredClone(S.state);
 SOURCES.ygo.get=async()=>{throw Error('Fresh source should not refetch');};await A.tOtherPrintings({dataset:{id:'y1',name:yc.name}});const yp=await config.loadPage({cursor:null,signal});
 const yrows=printingRows('ygo',yp.cards,{source:yc,catalogue:yp.catalogue,projectCard:config.projectCard});const unlimited=yrows.find(row=>row.releaseId===releases[1].id&&row.edition==='unlimited');assert(unlimited?.selectable);
 await config.onSelect(printingSelection(unlimited),oldContext);
 assert.equal(S.ui.sheetCtx.setId,releases[1].id);assert.equal(S.ui.sheetCtx.priceEdition,'LOB-EN001::Ultra Rare');assert.equal(S.ui.sheetCtx.priceYgoEdition,'unlimited');assert.equal(S.ui.sheetCtx.entryId,'');assert.deepEqual(ui('ygo').search,ySearch);assert.deepEqual(S.state,yState);
 console.log('PASS: actual TCG printing entry/loader/selection preserves Search, exact suffixes, paging, cancellation, failed-detail honesty, fresh release membership, YGO edition and zero collection/default-price commits.');
} finally {SOURCES.ptcg.search=realSearch;SOURCES.ptcg.get=realGet;SOURCES.ygo.get=realYgoGet;}
// Exact-name filtering occurs before adapter pagination, not after a capped page.
const realSets=ptcgSource.sets;ptcgSource.sets=async()=>[{id:'exact'}];
globalThis.fetch=async()=>Response.json([...Array.from({length:60},(_,i)=>({id:'exact-'+i,name:'Pikachu ex'})),{id:'exact-999',name:'Pikachu'},{id:'exact-998',name:'PIKACHU'},{id:'exact-997',name:'Flying Pikachu'},{id:'exact-996',name:'Pikachu-EX'}]);
try {const first=await ptcgSource.search({q:'Pikachu',exactName:true,size:1});assert.equal(first.total,2);assert.equal(first.more,true);const next=await ptcgSource.search({q:'Pikachu',exactName:true,size:1,page:1});assert.equal(next.more,false);assert.notEqual(first.cards[0].id,next.cards[0].id);assert(first.cards.every(c=>c.name.toLowerCase()==='pikachu'));}finally{ptcgSource.sets=realSets;}
console.log('PASS: exact Pokémon whole-name family precedes pagination and excludes ex/EX/Flying suffix/name variants.');
