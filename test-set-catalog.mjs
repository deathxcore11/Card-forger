import assert from 'node:assert/strict';
import fs from 'node:fs';
import {S,blank} from './store.js';
import {SOURCES,ui,registerTcg,tcgSets} from './tcg.js';
import {ptcgSource} from './ptcg.js';
import {pokemonFallback} from './artwork.js';
import {setRowContent} from './set-list-ui.js';
assert.equal(pokemonFallback({id:'swsh12.5gg-GG01'}),'https://images.pokemontcg.io/swsh12pt5gg/GG01_hires.png');
assert.equal(pokemonFallback({id:'swsh12.5gg-GG70'}),'https://images.pokemontcg.io/swsh12pt5gg/GG70_hires.png');
assert.equal(pokemonFallback({id:'bog-1'}),'https://images.pokemontcg.io/bp/1_hires.png');
assert.equal(pokemonFallback({id:'bog-../../bad'}),'');
const original=globalThis.fetch;
globalThis.fetch=async url=>{
 const path=new URL(url).pathname.replace('/v2/en','');
 if(path==='/sets')return Response.json([{id:'bog',name:'Best of Game',cardCount:{total:9}},{id:'orphan',name:'Orphan set',cardCount:{total:2}},{id:'A1',name:'Pocket',cardCount:{total:10}}]);
 if(path==='/series')return Response.json([{id:'old'},{id:'failed'},{id:'tcgp'}]);
 if(path==='/series/old')return Response.json({name:'E-Card',sets:[{id:'bog',name:'Best of Game',cardCount:{total:9}}]});
 if(path==='/series/failed')throw Error('Temporary enrichment outage');
 if(path==='/sets/bog')return Response.json({id:'bog',name:'Best of Game',cards:[{id:'bog-1',localId:'1',name:'Electabuzz'}]});
 throw Error('Unexpected request '+path);
};
try{
 const sets=await ptcgSource.sets();assert.deepEqual(new Set(sets.map(s=>s.id)),new Set(['bog','orphan']));
 const bog=sets.find(s=>s.id==='bog');assert.equal(bog.image,'https://images.pokemontcg.io/bp/logo.png');assert.equal(bog.date,'2002-12-01');
 const cards=await ptcgSource.setCards(bog);assert.equal(cards[0].image,'https://images.pokemontcg.io/bp/1_hires.png');assert.equal(cards[0].set.number,'1');
 globalThis.fetch=async url=>new URL(url).pathname.endsWith('/sets')?Response.json([{id:'orphan',name:'Orphan set',cardCount:{total:2}}]):Promise.reject(Error('All enrichment unavailable'));
 assert.equal((await ptcgSource.sets()).length,1,'complete catalogue survives total series outage');
}finally{globalThis.fetch=original;}
const row=setRowContent({name:'<Bad>',code:'GG',count:70,owned:3});assert.ok(row.includes('&lt;Bad&gt;'));assert.ok(row.includes('set-media no-art'));assert.ok(row.includes('3 owned'));assert.ok(row.includes('cards'));
console.log('PASS: complete set catalogue survives partial and total enrichment outages; exact gallery and Best of Game art; preserved card identity; shared escaped set-row structure.');

// Execute the registered loader with the app's actual automatic-load condition. A successful
// HTTP request with no usable catalogue is a retryable failure, not another render/load cycle.
const autoLoadLine=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8').split('\n').find(line=>line.includes('["sets","collection"]')&&line.includes('tcgCtx.loadSets'));
assert.ok(autoLoadLine,'the real app automatic set-loader condition is covered');
const scheduleCatalogue=new Function('ui','SU','tcgCtx','g','setTimeout','screen = null','navigationCurrent = () => true',autoLoadLine);
const priorState=S.state,priorView=S.ui.view,priorStorage=globalThis.localStorage,sourceSets={ygo:SOURCES.ygo.sets,ptcg:SOURCES.ptcg.sets};
const records=new Map();globalThis.localStorage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,String(value))};
try{
 for(const game of ['ygo','ptcg'])for(const view of ['sets','collection']){
  S.state=blank();S.state.settings.game=game;S.ui.view=view;
  const screen=ui(game).sets,scheduled=[],A={},C={},I={};let response=[],requests=0,renders=0;
  const context={A,C,I,render:()=>{renders++;scheduleCatalogue(S.ui,screen,context,game,fn=>scheduled.push(fn));},commit:async fn=>fn(S.state),openSheet(){},closeSheet(){},toast(){},go(){},rerenderKeepingFocus(){}};
  registerTcg(context);SOURCES[game].sets=async()=>{requests++;return structuredClone(response);};
  for(const bad of [[],null,{sets:[]},[null]]){
   records.clear();Object.assign(screen,{list:[],busy:false,error:''});scheduled.length=0;requests=0;renders=0;response=bad;
   context.render();assert.equal(scheduled.length,1,`${game}/${view}: cold render starts one catalogue request`);
   await scheduled.shift()();
   assert.equal(requests,1);assert.equal(screen.busy,false);assert.match(screen.error,/empty or invalid set catalogue/);
   assert.deepEqual(screen.list,[]);assert.equal(records.size,0,'invalid response is never cached');
   assert.equal(scheduled.length,0,`${game}/${view}: error stops automatic render/load scheduling`);
   assert.equal(renders,3,'initial, loading and failure renders only');
   assert.match(tcgSets(),/data-act="tSetsReload"/,'the existing explicit retry remains available');
  }
  response=[{id:'QA',code:'QA',name:'Catalogue regression release',date:'2026-10-01',count:1}];
  await A.tSetsReload();assert.equal(screen.error,'');assert.equal(screen.list.length,1);assert.equal(screen.busy,false);
  const key=[...records.keys()].find(key=>key.startsWith(`cardforge-${game}-sets-`)),goodCache=JSON.parse(records.get(key)),goodList=structuredClone(screen.list);
  assert.ok(key,'successful explicit retry saves a good catalogue');
  for(const bad of [[],{invalid:true}]){
   response=bad;await A.tSetsReload();
   assert.match(screen.error,/empty or invalid set catalogue/);assert.deepEqual(screen.list,goodList,'failed refresh preserves the last good in-memory catalogue');
   const retained=JSON.parse(records.get(key));assert.deepEqual(retained.list,goodCache.list,'failed refresh preserves the last good cached catalogue');assert.equal(retained.at,goodCache.at,'failed refresh cannot make old data appear fresh');
   assert.equal(scheduled.length,0);
  }
  response=[{id:'QB',code:'QB',name:'Recovered catalogue release',date:'2026-10-02',count:2}];
  await A.tSetsReload();assert.equal(screen.error,'');assert.equal(screen.busy,false);assert.equal(screen.list[0].code,'QB');assert.equal(JSON.parse(records.get(key)).list[0].code,'QB');assert.equal(scheduled.length,0,'successful explicit retry does not restart an automatic loop');
 }
}finally{SOURCES.ygo.sets=sourceSets.ygo;SOURCES.ptcg.sets=sourceSets.ptcg;S.state=priorState;S.ui.view=priorView;globalThis.localStorage=priorStorage;}
console.log('PASS: real registered catalogue loaders reject empty/malformed responses, stop automatic render loops, preserve good lists/cache ages and recover through explicit retry in both TCG games.');
