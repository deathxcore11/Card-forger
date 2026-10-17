import assert from 'node:assert/strict';
import {savedLocations,rememberLocation,locationPicker,chooseLocation} from './collection-locations.js';
import {validateWorkspace} from './confidence.js';
import {S,blank} from './store.js';
import {registerTcg,cache,tcgAddSheet} from './tcg.js';
const state=blank();state.collection=[{location:' Deck '},{location:'deck'},{location:'Blue box'}];state.tcg={ptcg:{collection:[{location:'Fire binder'}]},ygo:{collection:[{location:'Trade box'}]}};
assert.deepEqual(savedLocations(state,'mtg'),['Blue box','Deck']);assert.deepEqual(savedLocations(state,'ptcg'),['Fire binder']);
assert.equal(rememberLocation(state,'mtg',' deck '),'Deck');assert.equal(rememberLocation(state,'mtg','New place'),'New place');assert.equal(state.settings.lastLocation.mtg,'New place');
assert.equal(rememberLocation(state,'mtg',''),'');assert.ok(savedLocations(state,'mtg').includes('New place'),'saved label survives an empty location and removing its cards');
const menu=locationPicker(state,'mtg','loc','Blue box');assert.match(menu,/location:Blue box" selected/);assert.match(menu,/Add a new location/);
assert.match(locationPicker(state,"mtg","loc","deck"),/location:Deck" selected/);
assert.match(locationPicker(state,'mtg','loc',''),/value="" selected/,'editing an unsorted card preserves its location');
assert.match(locationPicker(state,'mtg','loc','<box>'),/&lt;box&gt;/);assert.doesNotMatch(locationPicker(state,'mtg','loc','<box>'),/value="<box>"/);
let focused=false;const input={value:'',hidden:true,focus:()=>focused=true};const root={querySelector:()=>input};
chooseLocation({dataset:{field:'loc'},value:'location:Blue box'},root);assert.equal(input.value,'Blue box');assert.equal(input.hidden,true);
chooseLocation({dataset:{field:'loc'},value:'new'},root);assert.equal(input.value,'');assert.equal(input.hidden,false);assert.equal(focused,true);
// Exercise real add actions for both adapters: two locations must not be merged.
S.state=blank();S.ui.sheetCtx=null;const A={},C={},I={},nodes=new Map(Object.entries({'#tQty':{value:'1'},'#tCond':{value:'Near Mint'},'#tPrint':{value:''},'#tEdition':{value:''},'#tLoc':{value:'Deck'}}));
globalThis.document={querySelector:s=>nodes.get(s)};
registerTcg({A,C,I,commit:async (fn,opts)=>{if(opts?.guard&&!opts.guard())return false;const next=structuredClone(S.state),result=fn(next);S.state=validateWorkspace(next);return result;},closeSheet(){S.ui.sheetCtx=null;},render(){},openSheet(_html,ctx){S.ui.sheetCtx=ctx;},toast(){},go(){},busy:()=>()=>{}});
for(const game of ['ygo','ptcg']){
 S.state.settings.game=game;cache[game].card={game,id:'card',name:'Fixture card',category:game==='ptcg'?'Pokemon':'Monster',typeLine:'Effect Monster',variants:[]};
 // Every production Add button comes from tOwn, which creates a fresh guarded tadd sheet.
 for(const location of ['Deck','Box','Deck']){
  A.tOwn({dataset:{id:'card'}});
  assert.equal(S.ui.sheetCtx.type,'tadd');assert.equal(S.ui.sheetCtx.game,game);assert.equal(S.ui.sheetCtx.setId,'');
  nodes.get('#tLoc').value=location;await A.tOwnSave({dataset:{id:'card'}});
  assert.equal(S.ui.sheetCtx,null,'successful generic Add closes its own sheet');
 }
 const saved=JSON.stringify(S.state.tcg[game].collection);
 await A.tOwnSave({dataset:{id:'card'}});
 assert.equal(JSON.stringify(S.state.tcg[game].collection),saved,'a stale save after Add closes cannot add another copy');
 const rows=S.state.tcg[game].collection;assert.equal(rows.length,2);assert.equal(rows.find(e=>e.location==='Deck').qty,2);assert.equal(rows.find(e=>e.location==='Box').qty,1);
 assert.deepEqual(savedLocations(S.state,game),['Box','Deck']);assert.match(tcgAddSheet(cache[game].card),/value="location:Deck" selected/);
 const restored=validateWorkspace(JSON.parse(JSON.stringify(S.state)));assert.equal(restored.settings.lastLocation[game],'Deck');assert.deepEqual(savedLocations(restored,game),['Box','Deck']);
}
console.log('PASS: reusable per-game locations, edit preservation, escaping, new-name controls, persistence and real add actions separating identical cards in different boxes.');

const binderState=blank();rememberLocation(binderState,'ptcg','Blue box');assert.equal((binderState.settings.binders || []).length,0);rememberLocation(binderState,'ptcg','Fire binder',{createBinder:true});rememberLocation(binderState,'ptcg','fire binder',{createBinder:true});assert.equal(binderState.settings.binders.length,1);assert.equal(binderState.settings.binders[0].rule,'location');assert.equal(binderState.settings.binders[0].game,'ptcg');assert.match(locationPicker(binderState,'ptcg','loc'),/Create a binder/);assert.match(locationPicker(binderState,'ptcg','loc'),/Fire binder · binder/);const restoredBinder=validateWorkspace(JSON.parse(JSON.stringify(binderState)));assert.equal(restoredBinder.settings.binders.length,1);
