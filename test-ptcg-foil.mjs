// Pokémon foil: the era/variant router, mask parsing (coverage and art window), and the shader's
// coverage rules. Pixel rendering is covered by the offline renders and hosted browser runs.
import assert from 'node:assert/strict';
import {ptcgFoilEffect,PTCG_FOIL_RECIPES,PTCG_PATTERN} from './ptcg-foil-recipes.js';
import {maskShape,shapeBox,artBox,PTCG_FOIL_FRAGMENT} from './ptcg-foil.js';
import {FINISH_MASKS,withPtcgTreatment} from './finish-effects.js';
const holo=era=>ptcgFoilEffect({finish:'holofoil',era}),rev=(era,foil)=>ptcgFoilEffect({finish:'reverse-holofoil',era,foil});
// Each era prints its own holo sheet; the Pokémon sits on white ink (underbase) in every holo window.
assert.equal(holo('pk-wotc'),'ptcg-wotc-holo');assert.equal(holo('pk-gym'),'ptcg-wotc-holo');assert.equal(holo('pk-neo'),'ptcg-wotc-holo');
assert.equal(holo('pk-lc'),'ptcg-lc-holo');assert.equal(holo('pk-ecard'),'ptcg-ecard-holo');assert.equal(holo('pk-exb'),'ptcg-ex-holo');
assert.equal(holo('pk-dppt'),'ptcg-classic-holo');assert.equal(holo('pk-swsh'),'ptcg-classic-holo');assert.equal(holo('pk-sv'),'ptcg-sv-holo');
assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-swsh',foil:'cosmos'}),'ptcg-cosmos');
for(const k of Object.keys(PTCG_FOIL_RECIPES).filter(k=>/holo$|cosmos$/.test(k)))assert.equal(PTCG_FOIL_RECIPES[k].underbase,1,k+' keeps the Pokémon solid');
// Reverse holos: Legendary Collection fireworks, e-Card crystal, and the named pattern sheets.
assert.equal(rev('pk-lc'),'ptcg-lc-reverse');assert.equal(rev('pk-ecard'),'ptcg-ecard-reverse');assert.equal(rev('pk-hgss'),'ptcg-reverse');
assert.equal(rev('pk-sv','pokeball'),'ptcg-pokeball');assert.equal(rev('pk-sv','masterball'),'ptcg-masterball');assert.equal(rev('pk-sv','cosmos'),'ptcg-cosmos-reverse');
for(const k of Object.keys(PTCG_FOIL_RECIPES).filter(k=>/reverse|ball/.test(k)))assert.equal(PTCG_FOIL_RECIPES[k].underbase,0,k+' foils the whole surround');
// Full arts by rarity: textured eras, rainbow, gold, illustration rares, shiny, double rare.
const full=(rarity,o={})=>ptcgFoilEffect({finish:'holofoil',fullArt:true,rarity,...o});
assert.equal(full('Special illustration rare'),'ptcg-special-illustration');assert.equal(full('Illustration rare'),'ptcg-illustration');
assert.equal(full('Rare Rainbow'),'ptcg-rainbow');assert.equal(full('Secret Rare',{gold:true}),'ptcg-gold');assert.equal(full('Secret Rare',{foil:'gold'}),'ptcg-gold');
assert.equal(full('Shiny Ultra Rare'),'ptcg-shiny');assert.equal(full('Double rare'),'ptcg-double-rare');
assert.equal(full('Ultra Rare',{textured:true}),'ptcg-textured');assert.equal(full('Holo Rare V'),'ptcg-full-art');
for(const [k,r] of Object.entries(PTCG_FOIL_RECIPES)){assert(Object.values(PTCG_PATTERN).includes(r.pat),k);if(/full|textured|rainbow|gold|illustration|shiny|double/.test(k))assert.equal(r.soft,1,k+' keeps attack text readable');}
assert.equal(ptcgFoilEffect({finish:'normal'}),'','Nonfoil has no treatment');
// Masks: every measured Pokémon mask parses; surrounds report their art window as the hole.
for(const [k,v] of Object.entries(FINISH_MASKS).filter(([k])=>k.startsWith('pk-')||k==='card')){const s=maskShape(v);assert(s,k);const [x0,y0,x1,y1]=shapeBox(s);assert(x0>=0&&y0>=0&&x1<=1&&y1<=1&&x1>x0&&y1>y0,k);}
const hole=artBox(maskShape(FINISH_MASKS['pk-sv-surround']));assert.deepEqual(hole.map(x=>+x.toFixed(3)),[.085,.102,.916,.469],'SV surround hole is the art window');
assert.deepEqual(shapeBox(maskShape(FINISH_MASKS.card)),[0,0,1,1]);
// Preset wiring: treatments follow the measured mask's era; unknown and plain presets stay untouched.
const p=withPtcgTreatment({rarity:'Rare'},{effect:'ptcg-holo',status:'approximate',layers:[{mask:'pk-neo-art',material:'holo'}]});assert.equal(p.treatment,'ptcg-wotc-holo');
assert.equal(withPtcgTreatment({},{effect:'ptcg-reverse',status:'approximate',layers:[{mask:'pk-lc-surround'}]}).treatment,'ptcg-lc-reverse');
assert.equal(withPtcgTreatment({},{effect:'unknown',status:'unknown',layers:[]}).treatment,undefined);
// Shader: coverage is the measured mask, narrowed by the underbase in holo windows, lighter on the lower half of full arts.
assert.match(PTCG_FOIL_FRAGMENT,/float cov=mk\.a\*mix\(1\.,mk\.r,u_r1\.z\)\*\(1\.-\.5\*u_r2\.y\*smoothstep\(\.52,\.64,uv\.y\)\);/);
assert.match(PTCG_FOIL_FRAGMENT,/return mix\(base,shoulder\(T\*F\*1\.35\),clamp\(cover,0\.,1\.\)\);/,'Zero coverage returns the exact source pixel');
console.log('PASS: Pokémon foil follows each era (WotC, Legendary Collection, e-Card, EX, DP-SWSH, SV) and variant (cosmos, Poké Ball, Master Ball, gold); holo windows keep the Pokémon solid; full arts by rarity keep text readable; every measured mask parses.');
