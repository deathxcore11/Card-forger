import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {modeFor,recordQuote,quoteModel,historyPanel,priceOverview,variantChoices,registerWorkbench,selectionState} from './workbench-ui.js';
import {validateWorkspace} from './confidence.js';
import {deckPage,collectionList} from './views.js';
import {tcgCollection,tcgCardSheet,cache} from './tcg.js';
const fixture={id:'edition-a',name:'Fixture',prices:{usd:'1.25',usd_foil:'3.50'},finishes:['nonfoil','foil'],type_line:'Creature',image_uris:{normal:'https://example.com/card.jpg'},set:'tst',collector_number:'1'};
S.state=blank();S.catalog.fixture=fixture;
const a=quoteModel('mtg',fixture,'nonfoil'),foil=quoteModel('mtg',fixture,'foil');assert.notEqual(a.key,foil.key);
recordQuote(S.state,a,'2026-10-01T10:00:00Z');recordQuote(S.state,{...a,value:1.5},'2026-10-01T12:00:00Z');recordQuote(S.state,{...a,value:1.7},'2026-10-03T12:00:00Z');
assert.deepEqual(S.state.settings.marketHistory[a.key].points.map(p=>p.value),[1.5,1.7]);recordQuote(S.state,{...a,value:null},'2026-10-04T10:00:00Z');assert.equal(S.state.settings.marketHistory[a.key].points.length,2);
recordQuote(S.state,foil,'2026-10-01T10:00:00Z');assert.equal(S.state.settings.marketHistory[foil.key].points.length,1);assert.match(historyPanel(a,'all'),/2026-10-03/);assert.match(historyPanel(foil,'all'),/1 verified observation/);
assert.deepEqual(variantChoices({variants:[{key:'a',label:'Normal',market:1},{key:'b',label:'Normal',market:null}]}),[['a','Normal · $1.00'],['b','Normal · price unavailable']]);
const pk={id:'p1',name:'Fixture Pokémon',game:'ptcg',prices:{usd:4},variants:[{key:'reverse',label:'Reverse holo',market:8}]};assert.notEqual(quoteModel('ptcg',pk).key,quoteModel('ptcg',pk,'reverse').key);assert.equal(quoteModel('ptcg',pk,'missing').value,null);
assert.equal(quoteModel('mtg',{...fixture,prices:{usd:null}},'nonfoil').value,null);
for(const g of ['mtg','ptcg','ygo'])assert.match(priceOverview(g,g==='mtg'?fixture:pk),/Selected version[\s\S]*Price history[\s\S]*Find sellers/);
// Actual view controls and batch actions across all three game stores.
const A={},C={},nodes=new Map([['#batchLocation',{value:'Blue box'}],['#batchDeck',{value:'deck'}]]);globalThis.document={querySelector:s=>nodes.get(s)};let ctx,lastOptions;
registerWorkbench({A,C,commit:async(fn,opts)=>{const next=structuredClone(S.state);fn(next);S.state=validateWorkspace(next);lastOptions=opts;},render(){},openSheet:(html,c)=>{ctx=c;S.ui.sheetCtx=c;},closeSheet:()=>{ctx=null;S.ui.sheetCtx=null},refreshSheet(){},toast(){},getGame:()=>S.state.settings.game||'mtg',getCard:(g,e)=>g==='mtg'?fixture:{...pk,id:e.cardId,name:e.name,game:g},links:()=>[],zoneFor:()=> 'main'});
for(const g of ['mtg','ptcg','ygo']){
 S.state.settings.game=g;S.state.tcg ||= {};S.state.tcg[g] ||= blankGame();const st=g==='mtg'?S.state:S.state.tcg[g];st.collection=[{id:'entry',cardId:'p1',name:'Fixture',qty:2,finish:'nonfoil',condition:'Near Mint',location:''}];st.decks=[{id:'deck',name:'Draft',commander:'',format:g==='mtg'?'Standard':'standard',cards:[],zones:{main:[],extra:[],side:[]}}];
 await A.viewSave({dataset:{game:g,area:'collection',mode:'symbols'}});assert.equal(modeFor(g,'collection'),'symbols');assert.equal(modeFor(g,'search'),'gallery');
 A.batchStart({dataset:{game:g}});C.batchToggle({dataset:{game:g,id:'entry'},checked:true});assert.deepEqual(selectionState(g).ids,['entry']);
 A.batchAction({dataset:{game:g,kind:'move'}});await A.batchApply();assert.equal((g==='mtg'?S.state:S.state.tcg[g]).collection[0].location,'Blue box');assert.ok(lastOptions.undo);
 C.batchToggle({dataset:{game:g,id:'entry'},checked:true});A.batchAction({dataset:{game:g,kind:'wish'}});await A.batchApply();assert.equal((g==='mtg'?S.state:S.state.tcg[g]).wishlist[0].qty,2);
 C.batchToggle({dataset:{game:g,id:'entry'},checked:true});A.batchAction({dataset:{game:g,kind:'deck'}});await A.batchApply();const d=(g==='mtg'?S.state:S.state.tcg[g]).decks[0];assert.equal((g==='mtg'?d.cards:d.zones.main)[0].qty,2);assert.equal((g==='mtg'?S.state:S.state.tcg[g]).collection[0].qty,2,'deck addition must not change ownership');
 if(g==='mtg'){S.ui.deckId='deck';S.state.activeDeck='deck';S.ui.deckTab='cards';assert.doesNotThrow(()=>deckPage());assert.match(collectionList(),/batchToggle/);}
 else {cache[g].p1={...pk,id:'p1',game:g,category:'Pokemon',stats:[],sets:[],variants:[]};assert.match(tcgCollection(),/batchToggle/);assert.match(tcgCardSheet(cache[g].p1,{tab:'prices'}),/Selected version/);}
}
assert.equal(validateWorkspace(JSON.parse(JSON.stringify(S.state))).settings.displayModes.mtg.collection,'symbols');
console.log('PASS: quote/finish isolation, daily deduplication, unknown quotes, shared pricing structure, saved view modes, game-scoped batch move/wishlist/deck actions, unchanged ownership, Undo registration and actual deck rendering.');
