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
 // Serialized double-rainbow cards carry their own tag (Scryfall LTR 748z: serialized, poster, doublerainbow).
 [{name:'The One Ring',set:'ltr',collector_number:'748z',promo_types:['boosterfun','serialized','poster','doublerainbow','universesbeyond']},'mtg-doublerainbow'],
 // A serial number is not a material: the 1/1 One Ring (LTR 0) is traditional foil.
 [{name:'The One Ring',set:'ltr',collector_number:'0',promo_types:['boosterfun','serialized','universesbeyond']},'mtg-traditional'],
 // Poster and scroll are art/frame styles; silverfoil names the scroll showcase's material (LTR 697).
 [{name:'The One Ring',set:'ltr',collector_number:'748',promo_types:['boosterfun','poster','universesbeyond']},'mtg-traditional'],
 [{name:'The One Ring',set:'ltr',collector_number:'697',promo_types:['boosterfun','silverfoil','scroll','universesbeyond']},'mtg-silver'],
 // Innistrad: Double Feature foils are silver screen with no promo tag (DBL 1 Adeline).
 [{name:'Adeline, Resplendent Cathar',set:'dbl',collector_number:'1'},'mtg-silverscreen'],
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
assert.equal(foil.effect,'mtg-foil','CSS fallback effect unchanged');assert.equal(foil.treatment,'mtg-surge');assert.equal(foil.frame,'2015');assert.equal(foil.label,'Surge foil','The finish chip names the treatment');assert.equal(foil.reason,'Simulated finish · approximate coverage');
assert.equal(finishChoices('mtg',card,{}).find(v=>v.key==='nonfoil').treatment,undefined);
const plain=finishChoices('mtg',{...card,promo_types:[]},{}).find(v=>v.key==='foil');assert.equal(plain.treatment,'mtg-traditional');assert.equal(plain.label,'Traditional foil');
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
// Shader: ink-selective treatments never reach the rules box, and where the foil does not cover, the
// card's own pixel is what the ink-over-foil step returns.
for(const ch of ['r','b','a'])assert.match(MTG_FOIL_FRAGMENT,new RegExp(`cov=mk\\.${ch}\\*\\(1\\.-text\\);`),'ink '+ch+' stays out of the rules box');
assert.match(MTG_FOIL_FRAGMENT,/vec3 outC=mix\(base,shoulder\(lit\),c\);/,'Zero coverage keeps the source pixel under the foil');
// Textured foil keeps the art and text readable: gentle relief and half the printed art left visible.
{const t=MTG_FOIL_RECIPES['mtg-textured'];assert(t.relief<=.4,'textured relief stays gentle');assert(t.keep>=.4,'textured foil keeps the printed art visible');}
// Foil index additions: masterpieces, ampersand, silver screen, scroll, Vault Boy, Premium Deck Series,
// unknown set-specific '...foil' promo types, and the M15 holo stamp on modern rares and mythics.
{const R=await import('./mtg-foil-recipes.js');
 assert.equal(mtgFoilEffect({set_type:'masterpiece',set:'kld'}),'mtg-masterpiece');assert.equal(mtgFoilEffect({set:'pd2'}),'mtg-pds');
 for(const [p,e] of [['ampersand','mtg-ampersand'],['silverscreen','mtg-silverscreen'],['scroll','mtg-traditional'],['vaultboy','mtg-traditional'],['chocobotrackfoil','mtg-traditional'],['textured','mtg-textured']])assert.equal(mtgFoilEffect({promo_types:[p]}),e,p);
 assert.equal(mtgFoilEffect({promo_types:['boosterfun']}),'mtg-traditional','non-foil promo types keep traditional');
 assert(R.mtgHoloStamp({frame:'2015',rarity:'mythic'}));assert(!R.mtgHoloStamp({frame:'2015',rarity:'common'}));assert(!R.mtgHoloStamp({frame:'2003',rarity:'rare'}));
 for(const k of ['mtg-masterpiece','mtg-ampersand','mtg-silverscreen','mtg-scroll','mtg-vaultboy','mtg-pds','mtg-emblem'])assert(MTG_FOIL_RECIPES[k],k);}
// One small shader per foil type: every recipe composes to plain GLSL (no directive left behind), a card
// only carries its own type's lines, and recipes that draw differently never share a program.
{const {MTG_FOIL_TEMPLATE,composeFoil,foilDefs,foilKey,mtgFoilFragment}=await import('./mtg-foil-shader.js'),R=await import('./mtg-foil-recipes.js');
 const keys=new Map();
 for(const [k,r] of Object.entries(MTG_FOIL_RECIPES))for(const kind of [0,1,2]){const src=mtgFoilFragment(r,kind),key=foilKey(foilDefs(r,kind));
  assert.doesNotMatch(src,/^\s*#/m,k+': no preprocessor line reaches the driver');assert.match(src,/void main\(\)/,k);
  assert(src.length<MTG_FOIL_TEMPLATE.length*.75,k+' compiles only part of the template');
  if(keys.has(key))assert.equal(keys.get(key),src,'one key, one shader');keys.set(key,src);}
 assert.doesNotMatch(mtgFoilFragment(MTG_FOIL_RECIPES['mtg-traditional']),/voro\(q\*|u_emblem|shootingStar/,'a traditional foil carries no other type\'s pattern');
 assert.match(mtgFoilFragment(MTG_FOIL_RECIPES['mtg-oldborder']),/shootingStar\(uv\)/,'old-border keeps its shooting star');
 assert.throws(()=>composeFoil('#if PAT==1\nx',{PAT:1}),/#if without #endif/);assert.throws(()=>composeFoil('#endif',{}),/without #if/);assert.throws(()=>composeFoil('#if pat\n#endif',{}),/bad condition/);
 assert.equal(composeFoil('a\n#if X==2\nb\n#elif X>2&&Y\nc\n#else\nd\n#endif\ne',{X:3,Y:1}),'a\nc\ne');assert.equal(composeFoil('#if X\n#if Y\nb\n#else\nc\n#endif\n#else\nd\n#endif',{X:0,Y:1}),'d');
 // 21 is the native app's facet foil and stamp value 2 its oval stamp: the web numbers must not collide.
 assert(!Object.values(MTG_PATTERN).includes(21));assert.equal(MTG_PATTERN.compleat,22);
 // Big emblems come from the printing's own set, and only on the treatments that have one.
 // Fields copied from Scryfall: Indominus Rex, Alpha (REX 39) and Tiamat (PAFR 235a); the id and the image address are placeholders.
 const rex={id:'r',name:'Indominus Rex, Alpha',game:'mtg',set:'rex',collector_number:'39',layout:'normal',finishes:['foil'],frame:'2015',frame_effects:['legendary','inverted'],border_color:'borderless',promo_types:['universesbeyond','embossed','boosterfun'],image_uris:{normal:'https://cards.scryfall.io/normal/front/r.jpg'}};
 const tiamat={name:'Tiamat',set:'pafr',collector_number:'235a',frame:'2015',promo_types:['embossed','instore'],finishes:['foil']};
 assert.equal(R.mtgFoilEmblem(rex),'rex');assert.equal(R.mtgFoilEmblem(tiamat),'amp');
 assert.equal(R.mtgFoilEmblem({set:'rex',promo_types:[]}),'','a plain Jurassic World foil has no emblem');assert.equal(R.mtgFoilEmblem({set:'sld',promo_types:['embossed']}),'','other embossed promos have no measured emblem');
 assert.equal(foilDefs(MTG_FOIL_RECIPES['mtg-embossed'],1).EMB,1);assert.equal(foilDefs(MTG_FOIL_RECIPES['mtg-traditional'],1).EMB,0,'only the gloss pattern takes an emblem');
 assert.equal(finishChoices('mtg',rex,{}).find(v=>v.key==='foil').emblem,'rex','the finish carries the emblem to the foil');
 assert.equal(foil.emblem,undefined,'a surge foil carries none');
 for(const e of Object.values(R.MTG_EMBLEMS)){const {existsSync}=await import('node:fs');assert(existsSync(new URL('./'+e.src,import.meta.url)),e.src);}}
console.log('PASS: Magic foil router picks each printing\'s treatment from Scryfall data (old border, FTV, textured, surge, galaxy, oil slick, compleat, gilded, neon, serialized, fracture, raised); recipes, frames, finish wiring and ink analysis verified.');
