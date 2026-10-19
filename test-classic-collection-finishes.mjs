// Classic Collection presentation guard. These are model/markup checks, not
// physical foil verification or browser screenshots.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finishChoices,resolveFinish,finishArtworkCard} from './finish-effects.js';
import {finishMaterialProfile} from './finish-materials.js';
import {finishPreview,finishAttrs} from './finish-preview.js';

const names=['Blastoise','Charizard','Venusaur','Imposter Professor Oak','Dark Gyarados','Here Comes Team Rocket!',"Rocket's Zapdos","_____'s Pikachu",'Cleffa','Shining Magikarp',"Team Magma's Groudon","Rocket's Admin.",'Mew ex','Gardevoir ex','Umbreon ☆','Claydol','Luxray GL LV.X','Garchomp C LV.X','Donphan','Reshiram','Zekrom','Mewtwo EX','Xerneas EX','M Rayquaza EX','Tapu Lele GX'];
const cards=names.map((name,i)=>({id:`cel25cc-CC${String(i+1).padStart(3,'0')}`,game:'ptcg',name,set:{id:'cel25cc'},category:[4,6,12].includes(i+1)?'Trainer':'Pokemon',rarity:'Classic Collection',image:`fixture-${i+1}.png`,variants:[{key:'classic-holo',label:'Holofoil · 25th celebration',finish:'holofoil',stamps:['25th-celebration']}]}));
for(const card of cards){
 const before=JSON.stringify(card),choices=finishChoices('ptcg',card),ctx={priceFinish:'classic-holo'};
 assert.equal(choices.length,1,`${card.name}: physical Holofoil option remains selectable`);
 const m=resolveFinish('ptcg',card,ctx);
 assert.equal(m.key,'classic-holo');assert.equal(m.effect,'unknown',card.name);
 assert.equal(m.status,'unknown');assert.deepEqual(m.layers,[]);
 assert.equal(finishMaterialProfile('ptcg',card,m),'');
 assert.equal(m.texture,undefined);assert.equal(m.coverage,undefined);
 assert.match(finishPreview('ptcg',card,ctx),/Holofoil/);
 assert.match(finishPreview('ptcg',card,ctx),/Finish preview unavailable for this printing/);
 assert.doesNotMatch(finishPreview('ptcg',card,ctx),/Nonfoil/,'Do not relabel an unsupported foil as a paper printing');
 for(const surface of ['detail','zoom','large'])assert.match(finishAttrs('ptcg',card,ctx,surface),/data-finish-effect="unknown"/);
 assert.equal(finishArtworkCard('ptcg',card,ctx),card,'Do not substitute the historical original artwork');
 assert.equal(JSON.stringify(card),before);
 assert.equal(resolveFinish('ptcg',card).effect,'unknown','Browse mode cannot invent a generic preview');
 for(const rarity of ['Full Art','Ultra Rare','Hyper Rare'])assert.equal(resolveFinish('ptcg',{...card,rarity},ctx).effect,'unknown','Rarity metadata cannot re-enable the generic fallback');
 assert.equal(resolveFinish('ptcg',{...card,variants:[]},ctx).effect,'unknown');
}

// Existing proof-gated override pathway remains available for future reviewed
// exact printings. This synthetic override tests routing, not real geometry.
const c=cards[12],override={game:'ptcg',printingId:c.id,finish:'classic-holo',face:0,status:'approximate',source:'https://fixture.test/explicit-printing-evidence',effectPreset:'reviewed-classic-fixture',layers:[{mask:'card',material:'holo'}]};
assert.equal(resolveFinish('ptcg',{...c,finishPresentations:[override]},{priceFinish:'classic-holo'}).effect,'reviewed-classic-fixture');
for(const changed of [{printingId:cards[13].id},{face:1},{finish:'another'},{source:''}])assert.equal(resolveFinish('ptcg',{...c,finishPresentations:[{...override,...changed}]},{priceFinish:'classic-holo'}).effect,'unknown');

// Exact set scope: main Celebrations and other games retain their treatments.
const main={id:'cel25-10',game:'ptcg',name:'Zekrom',set:{id:'cel25'},category:'Pokemon',rarity:'Rare',variants:[{key:'holofoil',finish:'holofoil'}]};
const mainModel=resolveFinish('ptcg',main,{priceFinish:'holofoil'});
assert.equal(mainModel.layers[0].mask,'pk-cel-art');assert.equal(finishMaterialProfile('ptcg',main,mainModel),'line-holo');
const modern={...main,id:'sv01-081',name:'Miraidon ex',set:{id:'sv01'}};
assert.equal(resolveFinish('ptcg',modern,{priceFinish:'holofoil'}).effect,'ptcg-full-art');
const magic={id:'magic-fixture',set:'clb',layout:'normal',finishes:['foil','etched']};
assert.equal(resolveFinish('mtg',magic,{priceFinish:'foil'}).effect,'mtg-foil');assert.equal(resolveFinish('mtg',magic,{priceFinish:'etched'}).effect,'mtg-etched');
const ygo={id:'ygo-fixture',game:'ygo',frame:'normal',sets:[{code:'TEST-001',rarity:'Secret Rare'}]};
assert.equal(resolveFinish('ygo',ygo,{priceEdition:'TEST-001::Secret Rare'}).effect,'ygo-secret');

// Both CSS and runtime already honor reduced motion. Browser lifecycle checks
// live in the separate review fixture and must not be implied by these asserts.
const css=readFileSync(new URL('./finish-effects.css',import.meta.url),'utf8'),runtime=readFileSync(new URL('./finish-preview.js',import.meta.url),'utf8');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.finish-overlay\{display:none!important\}/);
assert.match(runtime,/finishEffectsOn\(\)&&!reduced\(\)/);
assert.match(runtime,/on\(media,'change',\(\)=>\{setInteraction\(\);sync\(\);\}\)/);
console.log('PASS: all 25 Classic Collection foil identities fail closed without verified masks; exact overrides, main-set and cross-game behavior retained. Reduced-motion source contracts checked, not browser-verified.');
