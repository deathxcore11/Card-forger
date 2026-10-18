import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pokemonVariants} from './ptcg.js';
import {resolveFinish,finishChoices,finishArtworkCard} from './finish-effects.js';
import {finishPreview,finishAttrs,finishEligible} from './finish-preview.js';
import {presentationQuote} from './pricing-presentation.js';
const card={id:'base1-16',game:'ptcg',name:'Zapdos',set:{id:'base1'},category:'Pokemon',rarity:'Rare',image:'catalog.png',imageLarge:'catalog-hi.png',prices:{usd:12},variants:pokemonVariants({variants_detailed:[
 {type:'holo',subtype:'unlimited'},
 {type:'holo',subtype:'shadowless',stamp:['1st-edition']},
 {type:'holo',subtype:'shadowless'},
 {type:'holo',subtype:'1999-2000-copyright'},
]})};
card.variants[1].image='first-edition.png';
const before=JSON.stringify(card),choices=finishChoices('ptcg',card);
assert.equal(choices.length,4);
assert(choices.every(p=>p.effect==='ptcg-holo'));
for(const ctx of [{},{priceFinish:'reference'}]){
 const ctxBefore=JSON.stringify(ctx),quoteBefore=presentationQuote('ptcg',card,'reference');
 const p=resolveFinish('ptcg',card,ctx);
 assert.equal(p.effect,'ptcg-holo');assert.equal(p.sharedFinish,true);assert.equal(p.key,'');assert.equal(p.physicalFinish,'holofoil');
 assert.deepEqual(p.layers,[{mask:'pk-base-art',material:'holo'}]);
 assert.equal(finishArtworkCard('ptcg',card,ctx),card,'No edition image is borrowed');
 const html=finishPreview('ptcg',card,ctx);
 assert(!html.includes('Finish preview unavailable'));assert(!html.includes('aria-pressed="true"'),'No edition button becomes selected');
 assert(html.includes('edition not selected'));assert(!html.includes('Nonfoil'));
 assert.match(finishAttrs('ptcg',card,ctx,'detail'),/data-finish-effect="ptcg-holo"/);
 assert.deepEqual(presentationQuote('ptcg',card,'reference'),quoteBefore);
 assert.equal(JSON.stringify(ctx),ctxBefore);
}
for(const v of card.variants){
 const p=resolveFinish('ptcg',card,{priceFinish:v.key});
 assert.equal(p.key,v.key);assert.equal(p.effect,'ptcg-holo');assert(!p.sharedFinish);
}
const first=card.variants[1].key;
assert.equal(finishArtworkCard('ptcg',card,{priceFinish:first}).image,'first-edition.png');
assert.equal(resolveFinish('ptcg',card,{priceFinish:'reference',setVariant:first}).key,first);
assert.equal(finishArtworkCard('ptcg',card,{priceFinish:'reference',setVariant:first}).image,'first-edition.png');
assert.equal(resolveFinish('ptcg',card,{priceFinish:'stale-edition',setVariant:first}).effect,'unknown','Invalid explicit choice is not replaced by another context');
for(const extra of [{key:'normal',finish:'normal'},{key:'reverse',finish:'reverse-holofoil'},{key:'unconfirmed',label:'First Edition · finish unconfirmed'}]){
 assert.equal(resolveFinish('ptcg',{...card,variants:[...card.variants,extra]}).effect,'unknown','Mixed/unknown finish must not inherit shared holo');
}
assert.equal(resolveFinish('ptcg',{...card,variants:[]}).effect,'unknown');
const unproven={...card,id:'base4-19',set:{id:'base4'}};
assert.equal(resolveFinish('ptcg',unproven).effect,'unknown','Same finish is insufficient without supported presentation');
assert.equal(resolveFinish('ptcg',unproven,{priceFinish:first}).effect,'unknown');
const exact={...card,finishPresentations:[{game:'ptcg',printingId:card.id,finish:first,face:0,status:'approximate',source:'https://example.test/evidence',effectPreset:'specific-holo',layers:[{mask:'card',material:'holo'}]}]};
assert.equal(resolveFinish('ptcg',exact).effect,'unknown','Distinct masks/effects cannot be collapsed');
assert.equal(resolveFinish('ptcg',exact,{priceFinish:first}).effect,'specific-holo');
assert.equal(resolveFinish('mtg',{id:'m',set:'cmr',finishes:['nonfoil','foil']},{priceFinish:'reference'}).effect,'unknown','Pokemon fallback does not change MTG selection semantics');
const allPlain={...card,variants:[{key:'a',finish:'normal'},{key:'b',finish:'normal'}]};
assert.equal(resolveFinish('ptcg',allPlain).effect,'plain');assert.equal(resolveFinish('ptcg',allPlain).key,'');
assert.equal(JSON.stringify(card),before,'Original catalogue and price data remain unchanged');
// Surface restrictions remain independent from common-finish resolution.
const surface=(type,gallery=false,compact=false)=>({dataset:{finishSurface:type},closest:q=>q==='[hidden]'?null:q==='.view-gallery'?gallery:q==='.view-compact,.view-symbols'?compact:null});
assert(finishEligible(surface('detail')));assert(finishEligible(surface('zoom')));assert(finishEligible(surface('large',true)));
assert(!finishEligible(surface('large',false)));assert(!finishEligible(surface('large',true,true)));assert(!finishEligible(surface('medium',true)));assert(!finishEligible(surface('list',true)));
const css=readFileSync(new URL('./finish-effects.css',import.meta.url),'utf8');
assert.match(css,/\[data-finish-surface\]\.tilting \.finish-auto,[\s\S]*?animation:none;--finish-x:var\(--mx,50%\);--finish-y:var\(--my,50%\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.finish-overlay\{display:none!important\}/);
console.log('PASS: common physical finish without edition/price assignment; explicit and unknown guardrails; material and interaction scope checks.');
