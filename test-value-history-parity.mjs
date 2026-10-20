import assert from 'node:assert/strict';
import {usd} from './ui.js';
import fs from 'node:fs';
import {blank,S} from './store.js';
import {validateWorkspace} from './confidence.js';
import {setAccountScope} from './account-scope.js';
import {normalizeValueHistory,mergeValueHistory,recordValueObservation,mergeLegacyGameHistories,roundedValueTotal} from './value-history.js';
import {readLegacyTcgValueHistory,readTcgValueHistory,trackTcgValue} from './tcg.js';
const point={date:'2026-10-16',total:12.34,copies:2,unpriced:0,currency:'USD',basis:'exact-owned-v1'};
assert.equal(normalizeValueHistory([{...point,date:'2026-02-30'},{...point,total:NaN},null]).length,0);
assert.deepEqual(mergeValueHistory([point],[{...point,total:19}]),[{...point,total:19}]);
// Observed cents match the existing display formatter without changing history.
const preserved=[{...point,total:19.43}],preservedBytes=JSON.stringify(preserved);
for(const total of [0,.004,.005,.015,1.005,2.675,19.435,123456789.125,1e20,Number.MAX_VALUE]) {
 const recorded=recordValueObservation(preserved,total,2,{unpriced:1,currency:'USD',basis:'exact-owned-v1'},new Date('2026-10-19T23:59:59.999Z'));
 assert.equal(usd(recorded.at(-1).total),usd(total));assert(Number.isFinite(recorded.at(-1).total));assert.equal(recorded[0].total,19.43);assert.equal(recorded.at(-1).date,'2026-10-19');
}
assert.equal(roundedValueTotal(1.005),1.01);assert.equal(roundedValueTotal(19.435),19.44);
assert.equal(roundedValueTotal(-0),0,'negative zero is a legitimate zero, never a signed loss');
for(const bad of [null,undefined,NaN,Infinity,-1,'1.005'])assert.equal(roundedValueTotal(bad),null);
assert.equal(JSON.stringify(preserved),preservedBytes);
assert.equal(recordValueObservation([],1,1,point,new Date('2026-10-19T20:30:00-04:00'))[0].date,'2026-10-20','snapshot dates deliberately use UTC across local midnight boundaries');
const old=Array.from({length:500},(_,i)=>({...point,date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10)}));
assert.equal(recordValueObservation(old,20,3,point,new Date('2026-10-18T12:00:00Z')).length,501,'Do not truncate old observations');
const state={...blank(),valueHistory:[point],tcg:{ptcg:{collection:[],decks:[],wishlist:[],valueHistory:[point]},ygo:{collection:[],decks:[],wishlist:[],valueHistory:[{...point,currency:'EUR',basis:'legacy'}]}}};
const roundtrip=validateWorkspace(JSON.parse(JSON.stringify(state)));
assert.deepEqual(roundtrip.valueHistory,state.valueHistory);
assert.deepEqual(roundtrip.tcg.ptcg.valueHistory,state.tcg.ptcg.valueHistory);
assert.deepEqual(roundtrip.tcg.ygo.valueHistory,state.tcg.ygo.valueHistory,'Do not relabel foreign or legacy valuation metadata');
assert.equal(mergeLegacyGameHistories(roundtrip,{ptcg:[{...point,total:999}],ygo:[]}),false);
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
setAccountScope('a');data.set('cardstashy-value-hist-ptcg::account:a',JSON.stringify([point]));
assert.deepEqual(readLegacyTcgValueHistory('ptcg'),[point]);
setAccountScope('b');assert.deepEqual(readLegacyTcgValueHistory('ptcg'),[]);
setAccountScope('a');S.state=roundtrip;
assert.equal(mergeLegacyGameHistories(S.state,{ptcg:readLegacyTcgValueHistory('ptcg')}),false);
assert.deepEqual(readTcgValueHistory('ptcg'),[point]);
const before=data.get('cardstashy-value-hist-ptcg::account:a');
trackTcgValue('ptcg',{total:0,copies:0,unpriced:0});
assert.equal(readTcgValueHistory('ptcg').at(-1).total,0,'An emptied collection with real prior history can record zero');
assert.equal(data.get('cardstashy-value-hist-ptcg::account:a'),before,'Legacy rollback remains unchanged');
const source=fs.readFileSync('app.js','utf8');
assert.match(source,/accountLocked=true;valueHistoryReady=false/);
assert.match(source,/valueHistoryReady=true;\s*importReadyValueHistory\(\)/);
assert.match(source,/if \(valueHistoryReady && !navigationWrite && observeValue\) trackValue\(valid, previous, valueGames\)/);
console.log('PASS: all-game persisted history roundtrip, per-account legacy merge isolation/idempotence, preserved metadata and >365 records, unchanged rollback keys, zero after removing holdings, ready-only observation hooks.');
// Run the actual synchronous observation hook while a non-Collection editor commits
// a new custom price. The rendering global still points at the old workspace map.
const vm=await import('node:vm');
const {collectionValue,recordValuePoint}=await import('./insights.js');
const {useMyPrices}=await import('./mtg-tcgprice.js');
const T=await import('./tcg.js');
const card={id:'history-price-fixture',name:'History Price Fixture',set:'qa',finishes:['nonfoil'],prices:{usd:null}};
const oldState=blank();oldState.collection=[{name:card.name,qty:1,condition:'Near Mint',finish:'nonfoil',printingId:card.id,printingVerified:true}];oldState.printings={[card.id]:card};oldState.myPrices={[card.id+':nonfoil']:{price:7}};
const draft=structuredClone(oldState);draft.myPrices[card.id+':nonfoil'].price=99;
useMyPrices(oldState.myPrices);
const ctx={valueHistoryReady:true,accountLocked:false,S:{state:oldState,catalog:{},ui:{view:'search'}},T,useMyPrices,collectionValue,recordValuePoint,homeValueCoverage:v=>({unpriced:v.unpriced,currency:'USD',basis:'exact-owned-v1'})};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function trackValue(state = S.state, previous = null, valueGames = null)'),source.indexOf('\nfunction valueHistories')),ctx);
ctx.trackValue(draft);assert.equal(draft.valueHistory.at(-1).total,99,'Draft custom price observed outside Collection');assert.equal(collectionValue(oldState.collection,{},oldState.printings).total,7,'Active rendering map restored');
ctx.valueHistoryReady=false;const beforeHistory=JSON.stringify(draft.valueHistory);ctx.trackValue(draft);assert.equal(JSON.stringify(draft.valueHistory),beforeHistory,'No observation before owner scope is ready');
console.log('PASS: real observation hook uses draft-owned custom prices outside Collection and restores current account map synchronously.');

assert.match(source,/observeValue:false/,"legacy migration does not observe device cache as a new value");

// Actual observation hook: view/profile/quote edits never dirty any game history.
ctx.valueHistoryReady=true;
const viewing=structuredClone(oldState);viewing.settings.displayModes={collection:'grid'};viewing.profile={avatar:'art'};viewing.quoteHistory=[{price:123}];
ctx.trackValue(viewing,oldState);assert.deepEqual(viewing.valueHistory,oldState.valueHistory);
assert.deepEqual(viewing.tcg,oldState.tcg);
const edited=structuredClone(oldState);edited.myPrices[card.id+':nonfoil'].price=99;ctx.trackValue(edited,oldState);assert.equal(edited.valueHistory.at(-1).total,99);assert.deepEqual(edited.tcg,oldState.tcg,'Magic edit cannot create Pokemon/YGO observations');
const removed=structuredClone(edited);removed.collection=[];ctx.trackValue(removed,edited);assert.equal(removed.valueHistory.at(-1).total,0,'Removing actual holdings still observes zero');
console.log('PASS: only changed owned-value inputs are observed, not navigation/profile/display/reference quotes or unrelated games.');
const tcgEdited=structuredClone(oldState);tcgEdited.tcg={};tcgEdited.tcg.ptcg={collection:[{id:'p',name:'Fixture',cardId:'p',qty:1,condition:'Near Mint',manualValue:3,manualValueCondition:'Near Mint',manualValueCurrency:'USD'}],decks:[],wishlist:[],valueHistory:[]};ctx.trackValue(tcgEdited,oldState);assert.equal(tcgEdited.tcg.ptcg.valueHistory.at(-1).total,3);assert.deepEqual(tcgEdited.valueHistory,oldState.valueHistory,'Pokemon edit cannot create Magic observations');

const refreshed=structuredClone(oldState);ctx.trackValue(refreshed,oldState,['mtg']);assert.equal(refreshed.valueHistory.at(-1).total,7,'Explicit refresh observes unchanged collection');
