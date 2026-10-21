// Magic foil: the treatment router (real Scryfall fields), recipe coverage, finish wiring and the
// per-image ink analysis. Pixel rendering is covered by the offline lab and hosted browser runs.
import assert from 'node:assert/strict';
import {MTG_FOIL_RECIPES,MTG_PATTERN,mtgFoilEffect,mtgFrameKey} from './mtg-foil-recipes.js';
import {analyzeMtgCard,MTG_FRAMES} from './mtg-foil-analysis.js';
import {MTG_FOIL_FRAGMENT} from './mtg-foil.js';
import {resolveFinish,finishChoices} from './finish-effects.js';
// Router: fields copied from Scryfall for real printings.
const cases=[
 [{name:'Mother of Runes',set:'ulg',frame:'1997',promo_types:[]},'mtg-oldborder'],
 [{name:'Sheoldred, the Apocalypse',set:'dmu',frame:'2015',promo_types:[]},'mtg-traditional'],
 [{name:'Fyndhorn Elves',set:'v13',frame:'2003',set_type:'from_the_vault'},'mtg-ftv'],
 [{name:'Mana Drain',set:'otp',frame:'2015',promo_types:['textured','boosterfun']},'mtg-textured'],
 [{name:'Sceptre of Eternal Glory',set:'40k',promo_types:['surgefoil','universesbeyond']},'mtg-surge'],
 [{name:'_____ Goblin',set:'unf',promo_types:['boosterfun','galaxyfoil']},'mtg-galaxy'],
 [{name:'Mondrak, Glory Dominus',set:'one',promo_types:['oilslick','raisedfoil']},'mtg-oilslick'],
 [{name:'Mondrak, Glory Dominus',set:'one',promo_types:['stepandcompleat','boosterfun']},'mtg-compleat'],
 [{name:'Void Rend',set:'snc',promo_types:['gilded','boosterfun']},'mtg-gilded'],
 [{name:'Cavern of Souls',set:'lci',promo_types:['neonink']},'mtg-neon'],
 [{name:'Sol Ring',set:'sld',promo_types:['serialized']},'mtg-doublerainbow'],
 [{name:'Llanowar Elves',set:'fdn',promo_types:['fracturefoil','japanshowcase','boosterfun']},'mtg-fracture'],
 [{name:'Underworld Breach',set:'sld',promo_types:['raisedfoil']},'mtg-raised']];
for(const [c,want] of cases)assert.equal(mtgFoilEffect(c,'foil'),want,c.name);
assert.equal(mtgFoilEffect({promo_types:['galaxyfoil']},'etched'),'mtg-etched','Etched finish wins over promo types');
assert.equal(mtgFoilEffect({promo_types:['galaxyfoil']},'nonfoil'),'','Nonfoil has no treatment');
assert.equal(mtgFoilEffect({},'foil'),'mtg-traditional','Unknown data falls back to traditional foil, never a special treatment');
// Every recipe is reachable, names a real pattern, and every frame key has geometry.
for(const [k,r] of Object.entries(MTG_FOIL_RECIPES)){assert(Object.values(MTG_PATTERN).includes(r.pat),k);assert(r.label&&r.note,k);}
for(const c of [{frame:'1993'},{frame:'1997'},{frame:'2003'},{frame:'2015'},{frame:'future'},{border_color:'borderless'},{full_art:true}])assert(MTG_FRAMES[mtgFrameKey(c)],JSON.stringify(c));
assert.equal(mtgFrameKey({frame:'future'}),'2015');assert.equal(mtgFrameKey({frame:'1993'}),'1997');
// Finish wiring: foil printings carry their treatment and frame; nonfoil stays plain.
const card={id:'x',game:'mtg',set:'40k',collector_number:'1',layout:'normal',finishes:['nonfoil','foil'],frame:'2015',promo_types:['surgefoil'],image_uris:{normal:'https://cards.scryfall.io/normal/front/x.jpg'}};
const foil=finishChoices('mtg',card,{}).find(v=>v.key==='foil');
assert.equal(foil.effect,'mtg-foil','CSS fallback effect unchanged');assert.equal(foil.treatment,'mtg-surge');assert.equal(foil.frame,'2015');assert.match(foil.reason,/^Surge foil · simulated finish/);
assert.equal(finishChoices('mtg',card,{}).find(v=>v.key==='nonfoil').treatment,undefined);
const plain=finishChoices('mtg',{...card,promo_types:[]},{}).find(v=>v.key==='foil');assert.equal(plain.treatment,'mtg-traditional');assert.equal(plain.reason,'Simulated finish · approximate coverage');
const cmr={...card,set:'cmr',finishes:['etched'],promo_types:[]};assert.equal(finishChoices('mtg',cmr,{})[0].treatment,'mtg-etched');
// Analysis: gold ink, fluorescent ink, bare paper and drawn lines are found where they are.
const W=120,H=168,px=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let c=[60,70,90];
 if(y<40)c=x<60?[214,170,60]:[255,30,200];   // gold ink | neon pink
 else if(y<80)c=[236,234,228];                // bare paper
 else if(y<120)c=(x%12<2)?[10,10,10]:[236,234,228]; // inked lines on paper
 px.set([...c,255],(y*W+x)*4);}
const {mask}=analyzeMtgCard(px,W,H),at=(x,y,ch)=>mask[(y*W+x)*4+ch];
assert(at(30,20,0)>200&&at(90,20,0)<40,'Gold ink found, neon is not gold');
assert(at(90,20,1)>200&&at(30,20,1)<40,'Fluorescent ink found, gold is not neon');
assert(at(60,60,2)>200&&at(30,20,2)<40&&at(60,150,2)<40,'Bare paper found, inks and dark areas are not paper');
assert(at(12,100,3)>120&&at(60,60,3)<20,'Drawn lines found, flat paper has none');
// Shader: ink-selective treatments never reach the rules box; patterned sheets are softer there.
assert.match(MTG_FOIL_FRAGMENT,/if\(mode>1\.5&&\(mode<2\.5\|\|mode>3\.5\)\)cov\*=1\.-text;/);
assert.match(MTG_FOIL_FRAGMENT,/cov\*=1\.-\.45\*text\*patterned;/);
assert.match(MTG_FOIL_FRAGMENT,/return mix\(base,shoulder\(T\*F\*1\.35\),clamp\(cover,0\.,1\.\)\);/,'Zero coverage returns the exact source pixel');
console.log('PASS: Magic foil router picks each printing\'s treatment from Scryfall data (old border, FTV, textured, surge, galaxy, oil slick, compleat, gilded, neon, serialized, fracture, raised); recipes, frames, finish wiring and ink analysis verified.');
