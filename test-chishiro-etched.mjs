import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveFinish,FINISH_MASKS,finishChoices} from './finish-effects.js';
import {finishMaterialProfile,hasFinishPattern} from './finish-materials.js';
import {finishAttrs,finishPreview,finishEligible} from './finish-preview.js';
const c=JSON.parse(await readFile('test-fixtures/finish-effects/chishiro-nec77.json','utf8'));
const model=resolveFinish('mtg',c,{priceFinish:'etched'});
assert.equal(model.effect,'mtg-nec77-etched');assert.equal(model.status,'approximate');
assert.deepEqual(model.layers,[{mask:'mtg-nec77-metal',material:'metal'}]);
assert.equal(finishMaterialProfile('mtg',c,model),'nec77-etched');assert(hasFinishPattern('nec77-etched'));
assert.match(finishPreview('mtg',c),/approximate metallic coverage/);
assert.match(finishAttrs('mtg',c,{},'zoom'),/nec77-etched/);
for(const change of [{id:'same-name-wrong-id'},{set:'neo'},{collector_number:'73'},{collector_number:undefined},{layout:undefined},{layout:'transform'},{frame_effects:undefined},{frame_effects:['etched']},{full_art:true},{borderless:true},{finishes:undefined},{finishes:['nonfoil']}])assert.notEqual(resolveFinish('mtg',{...c,...change},{priceFinish:'etched'}).effect,model.effect,JSON.stringify(change));
for(const context of [{priceFinish:'foil'},{priceFinish:'nonfoil'},{priceFinish:'etched',face:1}])assert.equal(resolveFinish('mtg',c,context).effect,'unknown');
const ordinary={...c,id:'bffa36ac-137d-481c-b1b7-76a88ef15d54',collector_number:'1',finishes:['nonfoil','foil'],frame_effects:['legendary']};
assert.deepEqual(finishChoices('mtg',ordinary).map(p=>p.effect),['plain','mtg-foil']);
assert.equal(resolveFinish('mtg',{...ordinary,id:'eaacd338-1040-4d61-977e-7c97d0f26724',collector_number:'73',finishes:['nonfoil']}).effect,'plain');
assert.equal(resolveFinish('mtg',{id:'clb',set:'clb',layout:'normal',finishes:['etched']}).effect,'mtg-etched');
// Point-in-polygon guard against accidental full-card or rules-field exclusion.
const points=FINISH_MASKS['mtg-nec77-metal'].match(/[-\d.]+% [-\d.]+%/g).map(p=>p.split(' ').map(Number.parseFloat));
function covered(x,y){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [a,b]=points[i],[c,d]=points[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
for(const p of [[50,7],[50,59],[25,76],[85,92],[6,40]])assert(covered(...p),'Metallic field '+p);
for(const p of [[50,35],[2,50],[50,96],[50,93],[97,20]])assert(!covered(...p),'Excluded art/border/footer/stamp '+p);
const css=await readFile('finish-effects.css','utf8');assert.match(css,/nec77-etched[^}]+soft-light/);assert.match(css,/prefers-reduced-motion/);
assert.equal(finishEligible({dataset:{finishSurface:'large'},closest:()=>null}),false,'ordinary grid remains unchanged');
console.log('PASS: exact NEC #077 etched identity, approximate metallic mask, source control printings and existing surface gates.');
