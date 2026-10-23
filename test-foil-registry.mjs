// Foil routing repair (Foil Engineering Guide v1.0, first pull request): the selected printing and finish
// decide the material, never a frame style, a serial number, a set-wide guess or the page a card was opened
// from. Fixture fields are copied from live provider records (Scryfall, TCGdex, YGOPRODeck) on 2026-10-23.
import assert from 'node:assert/strict';
import {mtgFoilProfile,mtgFoilEffect,MTG_UNMODELLED} from './mtg-foil-recipes.js';
import {ptcgFoilEffect,ptcgUnmodelledFoil,PTCG_FOIL_RECIPES} from './ptcg-foil-recipes.js';
import {ygoPrintingRelease,setYgoReleaseLookup,YGO_MODERN_FROM} from './ygo-foil-recipes.js';
import {resolveFinish} from './finish-effects.js';

// ---------- Magic ----------
const mtg=(o)=>({id:o.id||'fixture-'+(o.set||'x')+'-'+(o.collector_number||'1'),game:'mtg',layout:'normal',frame:'2015',rarity:'rare',image_uris:{normal:'x'},...o});
const pick=(c,finish)=>resolveFinish('mtg',c,{finish});
// Selected nonfoil stays nonfoil whatever the specialty tags say (M3C 218 Acidic Slime, LTR 687 Andúril).
for(const c of [mtg({set:'m3c',collector_number:'218',finishes:['nonfoil','foil'],promo_types:['ripplefoil']}),mtg({set:'ltr',collector_number:'687',finishes:['nonfoil','foil'],promo_types:['silverfoil','scroll']})]){
 assert.equal(pick(c,'nonfoil').effect,'plain',`${c.set} ${c.collector_number}: a nonfoil copy draws no foil`);
 assert.notEqual(pick(c,'foil').treatment,undefined);
}
assert.equal(pick(mtg({set:'m3c',collector_number:'218',finishes:['nonfoil','foil'],promo_types:['ripplefoil']}),'foil').treatment,'mtg-ripple','the selected foil resolves the verified ripple');
// A serial number is not a material.
{const sld=mtg({set:'sld',collector_number:'717',finishes:['nonfoil'],promo_types:['serialized','sldbonus']});
 assert.equal(pick(sld,'nonfoil').effect,'plain','SLD 717 Giant Growth is serialized and nonfoil');
 assert.equal(pick(sld,'foil').status,'unknown','a foil that the printing does not offer is never invented');}
assert.equal(mtgFoilEffect({promo_types:['boosterfun','serialized','universesbeyond']}),'mtg-traditional','LTR 0, the 1/1 One Ring, is traditional foil');
assert.equal(mtgFoilEffect({promo_types:['boosterfun','serialized','poster','doublerainbow','universesbeyond']}),'mtg-doublerainbow','serialized double-rainbow cards carry their own tag (LTR 748z)');
// Appearance is not finish.
assert.equal(mtgFoilEffect({promo_types:['boosterfun','poster','universesbeyond']}),'mtg-traditional','poster art is traditional foil (LTR 748)');
assert.equal(mtgFoilEffect({promo_types:['scroll']}),'mtg-traditional','scroll is a frame style');
assert.equal(mtgFoilEffect({promo_types:['boosterfun','silverfoil','scroll']}),'mtg-silver','LTR 697: silverfoil names the material');
assert.equal(mtgFoilEffect({set:'dbl',collector_number:'1'}),'mtg-silverscreen','DBL foils are silver screen without a promo tag (DBL 1 Adeline)');
assert.equal(mtgFoilEffect({promo_types:['embossed','instore']}),'mtg-embossed','PAFR 87a Acererak is embossed; the ampersand tag is deprecated');
// Named-but-unmodelled materials keep their identity and say so.
for(const [tag,fixture] of [['singularityfoil','EOE 382 Sothera'],['cosmicfoil','SPM 242 / MSH 385'],['facetfoil','FRA 455 Craterclaw Colossus'],['silverscroll','SOA 167 Japanese Abrade'],['gleaminggold','HOB 249 Smaug'],['chocobotrackfoil','FIN Chocobo Track']]){
 const m=mtgFoilProfile({promo_types:[tag]},'foil');
 assert.equal(m.status,'approximate',fixture);assert.equal(m.name,MTG_UNMODELLED[tag].name,fixture);assert.notEqual(m.treatment,'mtg-emblem',fixture+' is never a made-up emblem');
 const p=pick(mtg({set:'x',finishes:['foil'],promo_types:[tag]}),'foil');
 assert.equal(p.label,MTG_UNMODELLED[tag].name,fixture+' shows its real name');assert.equal(p.profileStatus,'approximate');assert.match(p.reason,/not yet modelled/);
}
assert.equal(mtgFoilEffect({promo_types:['facetfoil']}),'mtg-traditional','facet is not aliased to fracture');
// Unknown foil strings are kept as data, not turned into a shader.
{const m=mtgFoilProfile({promo_types:['warpdrivefoil']},'foil');assert.equal(m.treatment,'mtg-traditional');assert.deepEqual(m.unrecognized,['warpdrivefoil']);assert.equal(m.status,'approximate');
 const p=pick(mtg({set:'x',finishes:['foil'],promo_types:['warpdrivefoil']}),'foil');assert.deepEqual(p.unrecognizedTags,['warpdrivefoil']);assert.match(p.reason,/Unrecognized foil/);}
// Etched is drawn only when etched is the selected finish, never because it is available.
{const c=mtg({set:'cmm',finishes:['nonfoil','foil','etched']});assert.equal(pick(c,'nonfoil').effect,'plain');assert.equal(pick(c,'foil').treatment,'mtg-traditional');assert.equal(pick(c,'etched').effect,'mtg-etched');
 assert.equal(resolveFinish('mtg',c,{}).effect,'plain','with no selection a browsed printing is shown nonfoil');}
console.log('PASS: Magic — selected finish first; serial numbers, poster and scroll are not materials; named unmodelled materials keep their names; unknown tags retained.');

// ---------- Pokémon ----------
assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-bwxy',set:'bw1'}),ptcgFoilEffect({finish:'holofoil',era:'pk-bwxy',set:'bw2'}),'no odd/even Tinsel guess');
assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-bwxy',set:'bw8'}),'ptcg-tinsel','BW holos are the Tinsel family');
for(const [foil,name] of [['loveball','Love Ball'],['friendball','Friend Ball'],['quickball','Quick Ball'],['duskball','Dusk Ball']]){
 const t=ptcgFoilEffect({finish:'reverse-holofoil',era:'pk-sv',foil,set:'me02.5'});
 assert(!/pokeball|masterball/.test(t),`${name} never collapses to a Poké Ball sheet (${t})`);assert.equal(ptcgUnmodelledFoil(foil),name);
}
assert.equal(ptcgFoilEffect({finish:'reverse-holofoil',era:'pk-sv',foil:'pokeball',set:'sv08.5'}),'ptcg-prismatic-pokeball');
assert.equal(ptcgFoilEffect({finish:'reverse-holofoil',era:'pk-sv',foil:'masterball',set:'sv08.5'}),'ptcg-prismatic-masterball');
assert.equal(ptcgUnmodelledFoil('pokeball'),'');assert.equal(ptcgUnmodelledFoil('masterball'),'');
// English 151: an ordinary reverse has no Ball pattern and ordinary holos are not HD Cosmos.
assert(!/ball/.test(ptcgFoilEffect({finish:'reverse-holofoil',era:'pk-sv',set:'sv03.5'})),'English 151 ordinary reverse has no Japanese Ball pattern');
assert.notEqual(ptcgFoilEffect({finish:'holofoil',era:'pk-sv',set:'sv03.5'}),'ptcg-cosmos-hd','151 holos are not all HD Cosmos');
// Ordinary Illustration Rares are not the textured SIR family.
assert.equal(PTCG_FOIL_RECIPES['ptcg-illustration'].relief,0);assert(PTCG_FOIL_RECIPES['ptcg-special-illustration'].relief>0);
console.log('PASS: Pokémon — no odd/even Tinsel, Ball motifs keep their identity, English 151 keeps ordinary sheets, IR has no blanket relief.');

// ---------- Yu-Gi-Oh! ----------
// The selected printing's own release decides, whichever page opened it (OP16 Ultimate, BOSH-era Super).
const releases=[{code:'OP16',name:'OTS Tournament Pack 16',date:'2021-05-07'},{code:'RA01',name:'25th Anniversary Rarity Collection',date:'2023-11-03'},{code:'SDY',name:'Starter Deck: Yugi',date:'2002-03-29'},{code:'DUP',name:'Duplicate Pack',date:'2020-01-01'},{code:'DUP',name:'Duplicate Pack',date:'2021-01-01'}];
setYgoReleaseLookup((name,code)=>releases.filter(r=>r.name===name&&r.code===code));
assert.deepEqual(ygoPrintingRelease({code:'OP16-EN001',name:'OTS Tournament Pack 16'}),{code:'OP16',date:'2021-05-07',source:'catalogue'});
assert.equal(ygoPrintingRelease({code:'DUP-EN001',name:'Duplicate Pack'}).source,'ambiguous','two releases with one name and prefix give no date');
assert.equal(ygoPrintingRelease({code:'ZZZ-EN001',name:'Unknown'}).date,'','missing data stays missing');
const ygo=(rarity,code,name,extra={})=>({id:'89631139',game:'ygo',type:'Normal Monster',typeLine:'Dragon / Normal',frame:'normal',sets:[{rarity,code,name}],...extra});
const context=(card,r)=>({...card,setContext:{game:'ygo',cardId:card.id,releaseId:'ygo:'+r.code,name:r.name,code:r.code,date:r.date,status:'resolved',printings:card.sets,printing:card.sets[0],printingAmbiguous:false}});
for(const [rarity,code,name] of [['Ultimate Rare','OP16-EN001','OTS Tournament Pack 16'],['Super Rare','OP16-EN002','OTS Tournament Pack 16'],['Secret Rare','SDY-001','Starter Deck: Yugi']]){
 const card=ygo(rarity,code,name),r=releases.find(x=>x.name===name),key=`${code}::${rarity}`;
 const search=resolveFinish('ygo',card,{priceEdition:key}),set=resolveFinish('ygo',context(card,r),{priceEdition:key});
 assert.equal(search.effect,set.effect,`${code} ${rarity}: same material from search and from its set`);
 assert.equal(search.stars||0,set.stars||0,`${code} ${rarity}: same symbol foil from search and from its set`);
}
assert.equal(resolveFinish('ygo',ygo('Ultimate Rare','OP16-EN001','OTS Tournament Pack 16'),{priceEdition:'OP16-EN001::Ultimate Rare'}).effect,'ygo-ultimate-prismatic','OP16 Ultimate is the Prismatic-style generation from search too');
assert(resolveFinish('ygo',ygo('Super Rare','OP16-EN002','OTS Tournament Pack 16'),{priceEdition:'OP16-EN002::Super Rare'}).stars,'a 2021 Super Rare keeps its symbol foil from search');
// A different release's set page never lends its date to this printing.
{const card=ygo('Super Rare','SDY-001','Starter Deck: Yugi'),wrong={...card,setContext:{...context(card,releases[1]).setContext}};
 assert.equal(ygoPrintingRelease(card.sets[0],wrong.setContext).date,'2002-03-29','a 2002 printing opened under a 2023 page keeps its own date');}
assert(YGO_MODERN_FROM);
// Stand-in rarities say so.
{const p=resolveFinish('ygo',ygo('Extra Secret Rare','X-EN001','X'),{priceEdition:'X-EN001::Extra Secret Rare'});assert.equal(p.profileStatus,'approximate');assert.match(p.reason,/Extra Secret Rare · not yet modelled/);}
setYgoReleaseLookup(null);
console.log('PASS: Yu-Gi-Oh! — the selected printing carries its own release into every view; ambiguous or missing releases give no date; stand-in rarities are labelled.');

// ---------- Patterns stay attached to the card ----------
// Tilt moves the light, never the material: no shader may add the tilt to a pattern's own coordinates
// (star fields, cosmos orbs, starfoil, water-web ridges). Moving highlights and colour phase are allowed.
{const {PTCG_FOIL_FRAGMENT}=await import('./ptcg-foil.js'),{MTG_FOIL_FRAGMENT}=await import('./mtg-foil.js'),{YGO_RARITY_FRAGMENT}=await import('./ygo-rarity-foil.js');
 for(const [name,src] of [['Pokémon',PTCG_FOIL_FRAGMENT],['Magic',MTG_FOIL_FRAGMENT],['Yu-Gi-Oh!',YGO_RARITY_FRAGMENT]]){
  const drift=src.match(/vec2 \w+=\w+\*[\w.]+[+-]u_tilt|vnoise\(\w+\*[\d.]+[+-]u_tilt|vnoise\(\w+\*[\d.]+\+vec2\([^)]*\)[+-]u_tilt/g)||[];
  assert.deepEqual(drift,[],`${name} pattern coordinates must not move with tilt`);
 }}
console.log('PASS: no shader moves a pattern across the card when it tilts.');
