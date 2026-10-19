import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {SOURCES,cache,ui,registerTcg,resetPersonalUi,tcgSets,tcgSet,tcgCardSheet} from './tcg.js';
import {normalizePtcg} from './ptcg.js';
import {pokemonCatalogueFallback,pokemonCatalogueSetEntry} from './pokemon-catalogue-supplement.js';

const original={state:S.state,view:S.ui.view,tsetId:S.ui.tsetId,storage:globalThis.localStorage,fetch:globalThis.fetch,sets:SOURCES.ptcg.sets};
const key='cardforge-ptcg-sets-v2',at=Date.now()-12000;
const stale={id:'mee',name:'Mega Evolution Energy',code:'MEE',count:8,date:'2025-09-25',series:'Mega Evolution'};
const other={id:'neo1',name:'Neo Genesis',code:'NEO1',count:111,date:'2000-12-16',custom:'preserve'};
const saved={schema:2,at,list:[stale,other],custom:'preserve-cache-metadata'};
const storage=new Map([[key,JSON.stringify(saved)],['unrelated-cache','keep-me']]);
const basic=['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal'];
const raw=Array.from({length:16},(_,i)=>pokemonCatalogueFallback('mee-'+String(i+1).padStart(3,'0'))||{
 id:'mee-'+String(i+1).padStart(3,'0'),localId:String(i+1).padStart(3,'0'),name:'Basic '+basic[i]+' Energy',category:'Energy',energyType:'Normal',set:{id:'mee',name:'Mega Evolution Energy',cardCount:{official:8}},variants:{normal:true}
});
const cards=raw.map(normalizePtcg);
let catalogueRequests=0,setRequests=0;
try {
 globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>{throw Error('No cache deletion expected: '+k);}};
 globalThis.fetch=async input=>{
  const url=new URL(input,'https://fixture.invalid');
  assert.equal(url.pathname,'/v2/en/sets/mee','only the requested set endpoint is contacted');setRequests++;
  return Response.json({id:'mee',name:stale.name,cardCount:{official:8,total:8},cards:raw.slice(0,8)});
 };
 SOURCES.ptcg.sets=async()=>{catalogueRequests++;throw Error('Fresh warm cache must not request the full catalogue');};
 resetPersonalUi();S.state=blank();S.state.settings.game='ptcg';S.ui.view='sets';
 S.state.tcg={ptcg:{collection:[{id:'owned-other',cardId:'unrelated',name:'Unrelated card',qty:2}],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 const collection=structuredClone(S.state.tcg.ptcg.collection);
 for(const card of cards)cache.ptcg[card.id]=card;
 const c={A:{},C:{},I:{},render(){},commit:async fn=>fn(S.state),writeRecord:async()=>{},openSheet(){},closeSheet(){},toast(){},go(){},rerenderKeepingFocus(){}};
 registerTcg(c);
 await c.loadSets('ptcg');
 assert.equal(catalogueRequests,0);
 assert.equal(ui('ptcg').sets.list.find(s=>s.id==='mee').count,16);
 const repaired=JSON.parse(storage.get(key));
 assert.equal(repaired.at,at,'repair does not make the catalogue newer');
 assert.equal(repaired.schema,2);assert.equal(repaired.custom,saved.custom);
 assert.deepEqual(repaired.list[1],other,'unrelated releases remain byte-equivalent as data');
 assert.equal(repaired.list[0].count,16);assert.equal(storage.get('unrelated-cache'),'keep-me');
 // Energy companion sets remain in the full catalogue, not the default booster view.
 ui('ptcg').sets.family='all';
 const catalogueHTML=tcgSets();
 const meeRow=catalogueHTML.match(/<button class="set-row[^\"]*"[^>]*data-id="mee"[\s\S]*?<\/button>/)?.[0];
 assert(meeRow);assert.match(meeRow,/<b>16<\/b><small>cards<\/small>/);assert.doesNotMatch(meeRow,/<b>8<\/b>/);
 S.ui.view='set';S.ui.tsetId='mee';await c.openSet('mee');
 assert.equal(setRequests,1);assert.equal(catalogueRequests,0);
 const U=ui('ptcg').set;
 assert.equal(U.cards.length,16,'real adapter includes the eight missing supplemental identities');
 assert.equal(U.info.count,16);assert.equal(U.contents.expectedUniqueCards,16);assert.equal(U.contents.completeness,'complete');assert.equal(U.loaded,true);
 const setHTML=tcgSet();
 assert.match(setHTML,/16 unique cards/);assert.match(setHTML,/0 of 16 unique cards/);
 assert.doesNotMatch(setHTML,/16 unique cards loaded of 8|0 of 8 unique cards|catalogue coverage is incomplete/);
 assert.match(tcgCardSheet(cards[12],{tab:'overview'}),/0 of 16/,'card detail progress shares the corrected catalogue');
 assert.deepEqual(S.state.tcg.ptcg.collection,collection,'catalogue repair does not create ownership');
 assert(cards.every(c=>c.prices.usd===null),'counts do not manufacture prices');

 // A screen already held in memory does not necessarily re-enter loadSets.
 // Its old metadata and partial-coverage snapshot must be reconciled too.
 const state=ui('ptcg');state.sets.list[0]={...stale};state.set.info={...stale};
 state.set.contents={...state.set.contents,expectedUniqueCards:8,completeness:'partial',coverageReason:''};
 const heldHTML=tcgSet();
 assert.match(heldHTML,/0 of 16 unique cards/);assert.doesNotMatch(heldHTML,/16 unique cards loaded of 8|catalogue coverage is incomplete/);
 assert.equal(state.set.contents.completeness,'complete');
 state.set.info={...stale};state.set.cards=state.set.cards.slice(0,8);state.set.contents={...state.set.contents,expectedUniqueCards:8,completeness:'complete'};
 const partialHTML=tcgSet();assert.match(partialHTML,/8 unique cards loaded of 16/);assert.equal(state.set.contents.completeness,'partial','eight loaded cards cannot count as complete after denominator repair');

 // Never truncate a newer catalogue or falsely certify an interrupted load.
 assert.equal(pokemonCatalogueSetEntry({...stale,count:20}).count,20);
 const untouched={...other,count:8};assert.equal(pokemonCatalogueSetEntry(untouched),untouched);
 state.sets.list[0]={...stale,count:20};state.set.info={...stale,count:20};state.set.cards=cards;
 state.set.contents={cards,expectedUniqueCards:20,loadedUniqueCards:16,completeness:'partial',paginationComplete:true};
 assert.match(tcgSet(),/0 of 20 unique cards/);assert.equal(state.set.info.count,20);
 state.set.info={...stale};state.set.contents={cards,expectedUniqueCards:16,loadedUniqueCards:16,completeness:'complete',paginationComplete:true};
 assert.match(tcgSet(),/0 of 20 unique cards/);assert.equal(state.set.contents.completeness,'partial','newer catalogue totals also reach an older held detail screen');
 state.set.info={...stale};state.set.contents={cards,expectedUniqueCards:8,loadedUniqueCards:16,completeness:'partial',paginationComplete:false,loadError:'Offline',coverageReason:'provider-request-failed'};
 assert.match(tcgSet(),/coverage is incomplete/);assert.equal(state.set.contents.completeness,'partial');assert.equal(state.set.contents.coverageReason,'provider-request-failed');

 // Forced refresh has the same known overlay even when a caller supplies an
 // older already-normalized list. This is not a broad cache version reset.
 SOURCES.ptcg.sets=async()=>{catalogueRequests++;return [stale,other];};
 await c.loadSets('ptcg',true);assert.equal(catalogueRequests,1);assert.equal(ui('ptcg').sets.list[0].count,16);assert.equal(JSON.parse(storage.get(key)).list[0].count,16);
 const ygo=ui('ygo');ygo.sets.list=[{...stale}];assert.equal(ui('ygo').sets.list[0].count,8,'other games are untouched');
} finally {
 SOURCES.ptcg.sets=original.sets;globalThis.fetch=original.fetch;globalThis.localStorage=original.storage;
 S.state=original.state;S.ui.view=original.view;S.ui.tsetId=original.tsetId;resetPersonalUi();
 for(const card of cards)delete cache.ptcg[card.id];
}
console.log('PASS: real warm persisted MEE catalogue load, preserved cache age/other releases, set tile and openSet/card-detail progress, held-screen repair, incomplete/newer coverage safety and unchanged ownership/prices.');
