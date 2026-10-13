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
S.state=blank();const A={},C={},I={},nodes=new Map(Object.entries({'#tQty':{value:'1'},'#tCond':{value:'Near Mint'},'#tPrint':{value:''},'#tEdition':{value:''},'#tLoc':{value:'Deck'}}));
globalThis.document={querySelector:s=>nodes.get(s)};
registerTcg({A,C,I,commit:async fn=>{const next=structuredClone(S.state);fn(next);S.state=validateWorkspace(next);},closeSheet(){},render(){},openSheet(){},toast(){},go(){},busy:()=>()=>{}});
for(const game of ['ygo','ptcg']){
 S.state.settings.game=game;cache[game].card={game,id:'card',name:'Fixture card',category:game==='ptcg'?'Pokemon':'Monster',typeLine:'Effect Monster',variants:[]};
 nodes.get('#tLoc').value='Deck';await A.tOwnSave({dataset:{id:'card'}});
 nodes.get('#tLoc').value='Box';await A.tOwnSave({dataset:{id:'card'}});
 nodes.get('#tLoc').value='Deck';await A.tOwnSave({dataset:{id:'card'}});
 const rows=S.state.tcg[game].collection;assert.equal(rows.length,2);assert.equal(rows.find(e=>e.location==='Deck').qty,2);assert.equal(rows.find(e=>e.location==='Box').qty,1);
 assert.deepEqual(savedLocations(S.state,game),['Box','Deck']);assert.match(tcgAddSheet(cache[game].card),/value="location:Deck" selected/);
 const restored=validateWorkspace(JSON.parse(JSON.stringify(S.state)));assert.equal(restored.settings.lastLocation[game],'Deck');assert.deepEqual(savedLocations(restored,game),['Box','Deck']);
}
console.log('PASS: reusable per-game locations, edit preservation, escaping, new-name controls, persistence and real add actions separating identical cards in different boxes.');
