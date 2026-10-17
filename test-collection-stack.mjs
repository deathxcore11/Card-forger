import assert from 'node:assert/strict';
import {blank} from './store.js';
import {validateWorkspace,applyImport} from './confidence.js';
import {addCollectionEntry,addScannedEntry,stackWorkspaceCollections} from './collection-stack.js';
for(const game of ['mtg','ptcg','ygo']){
 const base={id:'first',name:'Same card',qty:1,condition:'Near Mint',language:'en',location:'',reserved:1,
  ...(game==='mtg'?{printingId:'print-1',printingVerified:true,finish:'nonfoil',set:'TST',collectorNumber:'1'}:{cardId:'print-1',variant:game==='ptcg'?'normal':'',printing:game==='ygo'?'TST-001':'',rarity:game==='ygo'?'Rare':'',edition:game==='ygo'?'unlimited':'',setReleaseId:game==='ygo'?'release-1':''})};
 const state=blank();state.tcg={ptcg:{collection:[]},ygo:{collection:[]}};const workspace=game==='mtg'?state:state.tcg[game];
 workspace.collection=[structuredClone(base)];
 addCollectionEntry(workspace.collection,game,{...base,id:'second',qty:2,reserved:0});
 assert.equal(workspace.collection.length,1);assert.equal(workspace.collection[0].id,'first');assert.equal(workspace.collection[0].qty,3);assert.equal(workspace.collection[0].reserved,1);
 const differences=[{condition:'Lightly Played'},{language:'ja'},{location:'Trade binder'},{signed:true},{manualValue:5,manualValueCondition:'Near Mint'},
  ...(game==='mtg'?[{finish:'foil'},{printingId:'print-2'}]:game==='ptcg'?[{variant:'holofoil'},{cardId:'print-2'}]:[{edition:'1st-edition'},{rarity:'Ultra Rare'},{setReleaseId:'release-2'},{printing:'TST-002'}])];
 for(const difference of differences){const size=workspace.collection.length;addCollectionEntry(workspace.collection,game,{...base,...difference,id:'different-'+size});assert.equal(workspace.collection.length,size+1,JSON.stringify(difference));}
 const scan={...base,id:'scan-1',qty:1,reserved:0,scanCaptureId:'capture-1'};
 addScannedEntry(state,game,scan);assert.equal(workspace.collection[0].qty,4);
 addScannedEntry(state,game,{...scan,id:'scan-2',scanCaptureId:'capture-2'});assert.equal(workspace.collection[0].qty,5);
 addScannedEntry(state,game,{...scan});assert.equal(workspace.collection[0].qty,5);
 const restored=JSON.parse(JSON.stringify(state));addScannedEntry(restored,game,{...scan});assert.equal((game==='mtg'?restored:restored.tcg[game]).collection[0].qty,5,'retry survives reload');
 assert.throws(()=>addScannedEntry(state,game,{...scan,qty:2}),/already saved/);
 // Existing duplicates migrate without losing quantities, reservations or binder covers.
 state.settings.binders=[{game,featured:'old-duplicate',favorites:['first','old-duplicate']}];
 workspace.collection.push({...base,id:'old-duplicate',qty:2,reserved:1});
 stackWorkspaceCollections(state);assert.equal(workspace.collection[0].qty,7);assert.equal(workspace.collection[0].reserved,2);
 assert.deepEqual(state.settings.binders[0].favorites,['first']);assert.equal(state.settings.binders[0].featured,'first');
 const snapshot=JSON.stringify(state);stackWorkspaceCollections(state);assert.equal(JSON.stringify(state),snapshot,'normalization is idempotent');
}
// Import replacement still owns only the quantities from its particular source.
const imported=[{id:'one',name:'Card',qty:2,printingId:'p',printingVerified:true,finish:'nonfoil',condition:'Near Mint',sourceKey:'a'},{id:'two',name:'Card',qty:3,printingId:'p',printingVerified:true,finish:'nonfoil',condition:'Near Mint',sourceKey:'b'}];
const consolidated=validateWorkspace({...blank(),collection:imported}).collection;
assert.equal(consolidated.length,1);assert.equal(consolidated[0].qty,5);
const replaced=applyImport(consolidated,{lots:[{...imported[0],qty:4}],hash:'new'},'replace-source','a',()=> 'replacement');
const restacked=validateWorkspace({...blank(),collection:replaced}).collection;
assert.equal(restacked.length,1);assert.equal(restacked[0].qty,7,'replace source changes its own 2 copies to 4, retaining the other source’s 3');
console.log('PASS: all-game duplicate stacking, distinct variants, old duplicate migration, quantity/reservation conservation, binder covers and durable scan retry receipts.');
