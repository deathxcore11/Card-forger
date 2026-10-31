import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {registerTcg,cache,SOURCES,provenModel,proven,provenSheetHtml} from './tcg.js';
import {normalizePtcg} from './ptcg.js';
import {metaState} from './meta.js';
const pk=(id,attack)=>normalizePtcg({id,name:'Pikachu',localId:id.split('-').at(-1),category:'Pokemon',stage:'Basic',set:{id:id.slice(0,id.lastIndexOf('-')),name:'Fixture'},attacks:[{name:attack,damage:20}],pricing:{tcgplayer:{normal:{marketPrice:1}}}});
const first=pk('base1-58','Gnaw'),second=pk('sv04-027','Other attack');
const A={},c={A,C:{},I:{},commit:async fn=>fn(S.state),render:()=>{},openSheet:()=>{},closeSheet:()=>{},toast:()=>{},writeRecord:async()=>{},go:()=>{},busy:()=>()=>{}};
registerTcg(c);let spec;c.openProven=s=>{spec=s;};
const originalName=SOURCES.ptcg.byName,originalTournament=SOURCES.ptcg.tournamentCard;
const setup=reverse=>{
 S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:{collection:[{cardId:first.id,name:first.name,key:'id:'+first.id,qty:1}],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};
 for(const key of Object.keys(cache.ptcg))delete cache.ptcg[key];for(const card of reverse?[second,first]:[first,second])cache.ptcg[card.id]=card;
 const d={key:reverse?'reverse':'forward',name:'Two Pikachu printings',place:1,event:'Fixture',list:[{name:'Pikachu',set:'BASE1',number:'58',qty:1,kind:'Pokemon'},{name:'Pikachu',set:'SV04',number:'27',qty:2,kind:'Pokemon'}]};
 metaState('ptcg').data={decks:[d],top:[]};A.tMetaDeck({dataset:{key:d.key}});return d;
};
try {
 SOURCES.ptcg.byName=async()=>{throw Error('Explicit tournament printing must never use name lookup');};
 for(const reverse of [false,true]) {
  setup(reverse);await spec.load(()=>{});const rows=spec.rowsFn();assert.notEqual(rows[0].key,rows[1].key);assert.deepEqual(rows.map(r=>r.owned),[1,0],'same name with different attacks is not the same owned card');
  await spec.save(rows,'original');assert.deepEqual(S.state.tcg.ptcg.decks[0].zones.main.map(r=>[r.cardId,r.qty]),[[first.id,1],[second.id,2]]);
 }
 const d=setup(false);d.key='missing';d.list[1].set='MISSING';metaState('ptcg').data={decks:[d],top:[]};SOURCES.ptcg.tournamentCard=async()=>null;A.tMetaDeck({dataset:{key:d.key}});
 assert.match((await spec.load(()=>{})).failed.join(','),/MISSING/);await assert.rejects(spec.save(spec.rowsFn(),'original'),/Nothing saved.*unmatched printings/);assert.equal(S.state.tcg.ptcg.decks.length,0);
 setup(false);await spec.load(()=>{});S.state.settings.game='mtg';await spec.save(spec.rowsFn(),'original');assert.equal(S.state.tcg.ptcg.decks.length,1,'pending Pokémon save keeps captured game');assert.equal(S.state.decks.length,0);
 // The reported Dhelmise list contains 2 Psychic Energy MEE 13. The provider's
 // exact card is named Basic Psychic Energy; no different printing is substituted.
 const energy=normalizePtcg({id:'mee-013',name:'Basic Psychic Energy',localId:'013',category:'Energy',energyType:'Normal',set:{id:'mee',name:'Mega Evolution Energy'}});
 const energyDeck=setup(false);energyDeck.key='dhelmise-energy-regression';energyDeck.list=[{name:'Psychic Energy',set:'MEE',number:'13',qty:2,kind:'Energy'}];cache.ptcg[energy.id]=energy;metaState('ptcg').data={decks:[energyDeck],top:[]};A.tMetaDeck({dataset:{key:energyDeck.key}});
 await spec.load(()=>{});Object.assign(proven,{spec,mode:'original',busy:false,msg:''});
 const energyRows=spec.rowsFn(),energyHTML=provenSheetHtml();
 assert.equal(energyRows[0].owned,0,'unowned Basic Energy must not acquire fabricated collection quantities');
 assert.equal(energyRows[0].price,null,'an exact printing without a quote remains unpriced, not free');
 assert.equal(energyRows[0].matchPending,false,'printing identity can be resolved independently of its price');
 assert.match(energyHTML,/<b>0\/2<\/b><span>owned/);assert.match(energyHTML,/2 unpriced · Incomplete total/);assert.match(energyHTML,/Price unavailable/);
 assert.doesNotMatch(energyHTML,/Basic Energy · assumed|✓ owned/);
 await spec.save(energyRows,'original');const savedEnergy=S.state.tcg.ptcg.decks[0];
 assert.deepEqual(savedEnergy.zones.main.map(r=>[r.cardId,r.qty]),[['mee-013',2]]);
 assert.equal(savedEnergy.buildDiagnostics.ownedCopies,0);assert.equal(savedEnergy.buildDiagnostics.unpricedPurchaseCopies,2);assert.equal(savedEnergy.buildDiagnostics.purchaseEstimate,null);
 assert.equal(S.state.tcg.ptcg.collection.length,1,'saving the deck never inserts Energy into the collection');
 // A slow exact-card lookup must not write into another account after sign-out.
 const scopedDeck=setup(false);scopedDeck.key='scoped-save';scopedDeck.list=[{key:'scoped-energy-request',name:'Psychic Energy',set:'MEE',number:'13',qty:2,kind:'Energy'}];metaState('ptcg').data={decks:[scopedDeck],top:[]};A.tMetaDeck({dataset:{key:scopedDeck.key}});
 let releaseEnergy,session='a';SOURCES.ptcg.tournamentCard=()=>new Promise(r=>releaseEnergy=r);c.commit.scoped=()=>{const captured=session;return async fn=>{if(session!==captured)throw Error('Account changed');return fn(S.state);};};
 const accountSave=spec.save(spec.rowsFn(),'original');for(let i=0;i<20&&!releaseEnergy;i++)await Promise.resolve();assert(releaseEnergy,"Fresh scoped lookup starts");session='b';releaseEnergy(energy);await assert.rejects(accountSave,/Account changed/);assert.equal(S.state.tcg.ptcg.decks.length,0);delete c.commit.scoped;
 // Once exact cards are loaded, saving the original needs no new price fetch.
 setup(false);await spec.load(()=>{});first.prices.usd=null;second.prices.usd=null;
 const oldGet=SOURCES.ptcg.get;let priceFetches=0;SOURCES.ptcg.get=async()=>{priceFetches++;throw Error('price service offline');};
 try{await spec.save(spec.rowsFn(),'original');assert.equal(S.state.tcg.ptcg.decks.length,1);assert.equal(priceFetches,0);}finally{SOURCES.ptcg.get=oldGet;}
 const representative={...setup(false),key:'representative',rank:17,place:'Top 17'};
 metaState('ptcg').data={decks:[],archetypes:[{representative}],top:[]};A.tMetaDeck({dataset:{key:'representative'}});
 assert.equal(spec.key,'representative');assert.match(spec.evidence,/Top 17/);await spec.load(()=>{});await spec.save(spec.rowsFn(),'original');assert.equal(S.state.tcg.ptcg.decks.length,1);
 // Name grouping is only an adaptation heuristic; actual rows keep printing keys.
 const r=(key,name,price)=>({key,name,price,qty:4,owned:0,kind:'Pokemon'}),rows=[r('exact-a','Pikachu',5)],lists=[[r('reprint-a','Pikachu',2),r('exact-b','Raichu',8)],[r('reprint-a','Pikachu',3),r('reprint-b','Raichu',4)]];
 const model=provenModel({rows,lists,compareRows:rs=>rs.map(r=>({...r,key:r.name.toLowerCase()}))});assert.equal(model.similar.length,2);assert.ok(model.engine.has('exact-a'));assert.deepEqual(model.pool.map(r=>r.key),['reprint-b']);
 Object.assign(proven,{spec:{g:'mtg',key:'side-draft',title:'Fixture',rows:[{key:'owned',name:'Owned',qty:1,owned:1,price:null,kind:'creature'}],lists:[],sideRowsFn:()=>[{key:'side',name:'Side',qty:1,owned:0,price:null,kind:'spell'}]},mode:'draft',busy:false,msg:''});assert.match(provenSheetHtml(),/Main deck ready — sideboard still needs cards/);assert.doesNotMatch(provenSheetHtml(),/Ready — you own every card/);
} finally {SOURCES.ptcg.byName=originalName;SOURCES.ptcg.tournamentCard=originalTournament;}

// Double taps remain one save even if a price refresh has re-rendered the form.
globalThis.document={querySelector:()=>null};S.ui.sheetCtx={type:'proven',key:'single-save'};
let releaseSave,saveCalls=0;
const pendingSpec={g:'ptcg',key:'single-save',title:'Fixture',rows:[{key:'row',name:'Psychic Energy',qty:2,owned:2,price:0,kind:'Energy',assumedOwned:true,matchPending:true}],lists:[],load:async()=>({failed:[]}),save:()=>{saveCalls++;return new Promise(r=>releaseSave=r);}};
Object.assign(proven,{spec:pendingSpec,mode:'original',busy:false,msg:''});provenSheetHtml();const firstSave=A.provenSave({});provenSheetHtml();await A.provenSave({});assert.equal(saveCalls,1);releaseSave();await firstSave;
pendingSpec.save=async()=>{throw Error('Nothing saved: Psychic Energy MEE 13 needs matching.');};provenSheetHtml();await A.provenSave({});const failedHTML=provenSheetHtml();assert.match(failedHTML,/role="alert">Nothing saved/);assert.match(failedHTML,/Retry card matching/);assert.match(failedHTML,/Printing not matched/);
console.log('PASS: Pokémon proven originals retain exact printings, preserve ownership identity, reject partial saves, survive game switches, and group adaptation candidates without duplicating same-name printings.');
