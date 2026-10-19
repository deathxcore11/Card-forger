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
// A missing Pokémon product is unknown, not permission to adopt a conflicting
// promo product while normalizing, scanning, importing, or restoring a backup.
for(const order of [false,true]){
 const legacy={id:'legacy-cosmos',name:'Galarian Ponyta',cardId:'swshp-SWSH013',variant:'holofoil',qty:1,condition:'Near Mint'},
       explicit={...legacy,id:'explicit-general-mills',productId:232767};
 const state=blank();state.tcg={ptcg:{collection:order?[explicit,legacy]:[legacy,explicit]}};
 state.settings.binders=[{game:'ptcg',featured:legacy.id,favorites:[legacy.id,explicit.id]}];
 const before=JSON.stringify(state);stackWorkspaceCollections(state);
 assert.equal(JSON.stringify(state),before,'normalization preserves unknown versus explicit product lots and cover references');
 assert.equal(validateWorkspace(state).tcg.ptcg.collection.length,2,'import/restore validation cannot collapse unknown product evidence');
 addCollectionEntry(state.tcg.ptcg.collection,'ptcg',{...explicit,id:'another-explicit'});
 assert.equal(state.tcg.ptcg.collection.length,2);assert.equal(state.tcg.ptcg.collection.find(e=>e.id===explicit.id).qty,2,'same proven product still stacks');
 assert.equal(state.tcg.ptcg.collection.find(e=>e.id===legacy.id).productId,undefined);
}
for(const [leftProduct,rightProduct,manual,separate] of [[206430,232767,false,true],[206430,206430,false,false],[undefined,undefined,false,false],[undefined,232767,true,true]]){
 const base={name:'Galarian Ponyta',cardId:'swshp-SWSH013',variant:'holofoil',qty:1,condition:'Near Mint',...(manual?{manualValue:.77,manualValueCondition:'Near Mint'}:{})};
 const left={...base,id:'left',...(leftProduct?{productId:leftProduct}:{}),stackOrigins:[{id:'left-origin',qty:1}]},right={...base,id:'right',...(rightProduct?{productId:rightProduct}:{}),stackOrigins:[{id:'right-origin',qty:1}]};
 const state=blank();state.tcg={ptcg:{collection:[left,right]}};const before=JSON.stringify(state.tcg.ptcg.collection);stackWorkspaceCollections(state);
 assert.equal(state.tcg.ptcg.collection.length,separate?2:1);
 if(separate)assert.equal(JSON.stringify(state.tcg.ptcg.collection),before,'different or unknown product evidence preserves exact lots, private values and origin records');
 else{const row=state.tcg.ptcg.collection[0];assert.equal(row.qty,2);assert(row.stackOrigins.some(x=>x.id==='left-origin'));assert(row.stackOrigins.some(x=>x.id==='right-origin'));}
}
for(const game of ['mtg','ptcg','ygo']){
 const identity=game==='mtg'?{printingId:'print',printingVerified:true,finish:'foil'}:{cardId:'print',variant:'holofoil',...(game==='ygo'?{setReleaseId:'release',edition:'unlimited'}:{})};
 const state=blank();state.tcg={ptcg:{collection:[]},ygo:{collection:[]}};
 const entry={id:'capture-a',name:'Exact card',qty:1,condition:'Near Mint',productId:42,scanCaptureId:'same-capture',...identity};
 addScannedEntry(state,game,entry);const before=JSON.stringify(state);
 assert.throws(()=>addScannedEntry(state,game,{...entry,id:'retry',productId:43}),/already saved/,'same capture cannot silently change explicit product');
 assert.equal(JSON.stringify(state),before);
 if(game==='ptcg')assert.throws(()=>addScannedEntry(state,game,{...entry,id:'unknown-retry',productId:undefined}),/already saved/,'unknown identity cannot masquerade as verified retry');
}
// Import replacement still owns only the quantities from its particular source.
const imported=[{id:'one',name:'Card',qty:2,printingId:'p',printingVerified:true,finish:'nonfoil',condition:'Near Mint',sourceKey:'a'},{id:'two',name:'Card',qty:3,printingId:'p',printingVerified:true,finish:'nonfoil',condition:'Near Mint',sourceKey:'b'}];
const consolidated=validateWorkspace({...blank(),collection:imported}).collection;
assert.equal(consolidated.length,1);assert.equal(consolidated[0].qty,5);
const replaced=applyImport(consolidated,{lots:[{...imported[0],qty:4}],hash:'new'},'replace-source','a',()=> 'replacement');
const restacked=validateWorkspace({...blank(),collection:replaced}).collection;
assert.equal(restacked.length,1);assert.equal(restacked[0].qty,7,'replace source changes its own 2 copies to 4, retaining the other source’s 3');
console.log('PASS: all-game duplicate stacking, distinct variants, old duplicate migration, quantity/reservation conservation, binder covers and durable scan retry receipts.');
