// Pokémon foil: the era/variant router, mask parsing (coverage and art window), and the shader's
// coverage rules. Pixel rendering is covered by the offline renders and hosted browser runs.
import assert from 'node:assert/strict';
import {ptcgFoilEffect,PTCG_FOIL_RECIPES,PTCG_PATTERN} from './ptcg-foil-recipes.js';
import {maskShape,shapeBox,artBox,artOverflow,PTCG_FOIL_FRAGMENT} from './ptcg-foil.js';
import {FINISH_MASKS,withPtcgTreatment} from './finish-effects.js';
import {readableCopy} from './foil-gl.js';
import {readFileSync} from 'node:fs';
const holo=era=>ptcgFoilEffect({finish:'holofoil',era}),rev=(era,foil)=>ptcgFoilEffect({finish:'reverse-holofoil',era,foil});
// Each era prints its own holo sheet; the Pokémon sits on white ink (underbase) in every holo window.
assert.equal(holo('pk-wotc'),'ptcg-wotc-holo');assert.equal(holo('pk-gym'),'ptcg-wotc-holo');assert.equal(holo('pk-neo'),'ptcg-wotc-holo');
assert.equal(holo('pk-lc'),'ptcg-lc-holo');assert.equal(holo('pk-ecard'),'ptcg-ecard-holo');assert.equal(holo('pk-exb'),'ptcg-ex-holo');
assert.equal(holo('pk-dppt'),'ptcg-ex-holo');assert.equal(holo('pk-hgss'),'ptcg-ex-holo');assert.equal(holo('pk-sm'),'ptcg-water-web');assert.equal(holo('pk-swsh'),'ptcg-vsheen');assert.equal(holo('pk-sv'),'ptcg-sv-holo');assert.equal(holo('pk-bwxy'),'ptcg-classic-holo');
assert.equal(PTCG_FOIL_RECIPES['ptcg-ex-holo'].pat,PTCG_PATTERN.cosmos,'EX to HGSS holos print Cosmos');
// Per-set sheets (TCGdex set ids) and special rarities, from the redesign brief.
{const H=(set,o={})=>ptcgFoilEffect({finish:'holofoil',era:'pk-bwxy',set,...o}),R=(set,era='pk-exb')=>ptcgFoilEffect({finish:'reverse-holofoil',era,set});
 assert.equal(H('bw1'),'ptcg-tinsel');assert.equal(H('bw2'),'ptcg-tinsel2');assert.equal(H('xy1'),'ptcg-vsheen');assert.equal(H('xy12'),'ptcg-starlight2');assert.equal(H('col1'),'ptcg-vsheen-spectrum');
 assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-sm',set:'det1'}),'ptcg-striped');assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-sv',set:'sv03.5'}),'ptcg-cosmos-hd');
 assert.equal(R('ex5'),'ptcg-energy2-reverse');assert.equal(R('ex8'),'ptcg-pinwheel-reverse');assert.equal(R('ex9'),'ptcg-emerald-reverse');assert.equal(R('ex10'),'ptcg-ball-hologram-reverse');assert.equal(R('ex12'),'ptcg-reverse');assert.equal(R('ex1','pk-exa'),'ptcg-rmirror-reverse');
 assert.equal(R('bw3','pk-bwxy'),'ptcg-emblem-reverse');assert.equal(R('xy3','pk-bwxy'),'ptcg-reverse');assert.equal(R('sv01','pk-sv'),'ptcg-sv-reverse','the SV reverse keeps its measured sheet');
 assert.equal(ptcgFoilEffect({finish:'reverse-holofoil',era:'pk-sv',set:'sv08.5',foil:'pokeball'}),'ptcg-prismatic-pokeball');assert.equal(ptcgFoilEffect({finish:'reverse-holofoil',era:'pk-sv',set:'sv08.5',foil:'masterball'}),'ptcg-prismatic-masterball');
 assert.equal(H('bw7',{rarity:'ACE SPEC Rare'}),'ptcg-ace-spec');assert.equal(H('swsh10',{rarity:'Radiant Rare',fullArt:true}),'ptcg-radiant');assert.equal(H('swsh4',{rarity:'Amazing Rare'}),'ptcg-rainbow-glitter');
 assert.equal(H('sm7',{rarity:'Rare Prism Star'}),'ptcg-prism');assert.equal(H('xy8',{rarity:'Rare BREAK'}),'ptcg-prism');assert.equal(H('g1',{number:'RC5'}),'ptcg-rc-dots');
 assert.equal(H('sm115',{rarity:'Shiny rare',fullArt:true}),'ptcg-rainbow-glitter');assert.equal(H('swsh4.5',{rarity:'Shiny rare',fullArt:true}),'ptcg-glitter-sheen');
 assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-swsh',foil:'league'}),'ptcg-crosshatch');assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-bwxy',foil:'tinsel'}),'ptcg-tinsel');
 assert.equal(ptcgFoilEffect({finish:'holofoil',era:'pk-sv',rarity:'Double rare'}),'ptcg-double-rare');assert.equal(PTCG_FOIL_RECIPES['ptcg-double-rare'].pat,PTCG_PATTERN.starfoil);
 assert.equal(PTCG_FOIL_RECIPES['ptcg-pokeball'].coat,1,'Poké Ball stamps are a top-side coat');assert.equal(PTCG_FOIL_RECIPES['ptcg-reverse'].coat,0);}
// All 39 patterns of the brief have a treatment, each pattern id is drawn by its own shader branch.
{const {PTCG_HOLO_PATTERNS}=await import('./ptcg-foil-recipes.js');assert.equal(PTCG_HOLO_PATTERNS.length,39);for(const p of PTCG_HOLO_PATTERNS)assert(PTCG_FOIL_RECIPES[p.key],p.name);
 assert.equal(new Set(PTCG_HOLO_PATTERNS.map(p=>PTCG_FOIL_RECIPES[p.key].pat)).size,39,'each of the 39 looks has its own pattern id');
 assert.equal(Math.max(...Object.values(PTCG_PATTERN)),48);}
assert.match(PTCG_FOIL_FRAGMENT,/if\(u_r2\.w>\.5\)outC=base\+\(1\.-base\)\*clamp\(F\*1\.1-\.18,0\.,1\.\)\*coatMask\*cov;/,'Top-side coats brighten over the ink instead of multiplying it');
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
// Art that breaks out of its window (a head over the frame) is ink, not reverse foil; the thin window
// border and the rest of the frame stay foil.
{const W=120,H=168,px=new Uint8ClampedArray(W*H*4),box=[.1,.15,.9,.5],X=v=>v*W,Y=v=>v*H;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){let c=[225,200,70];const inBox=x>=X(.1)&&x<X(.9)&&y>=Y(.15)&&y<Y(.5),edge=!inBox&&x>=X(.1)-2&&x<X(.9)+2&&y>=Y(.15)-2&&y<Y(.5)+2;
  if(inBox)c=[60,120,200];else if(edge)c=[200,205,215];if(Math.hypot(x-60,y-24)<11)c=[190,40,40];if(y>Y(.6)&&y<Y(.62)&&x>20&&x<100)c=[20,20,20];px.set([...c,255],(y*W+x)*4);}
 const m=artOverflow(px,W,H,box),at=(x,y)=>m[Math.round(y)*W+Math.round(x)];
 assert(at(60,18)>.9,'The head above the window is kept as ink');
 assert.equal(at(5,Y(.3)),0,'Frame beside the window stays foil');assert.equal(at(X(.5),Y(.5)+1),0,'The thin window border stays foil');
 assert.equal(at(60,Y(.61)),0,'Attack text below the window is not mistaken for overflow');assert.equal(at(60,Y(.3)),0,'Inside the window is left to the window mask');}
// Preset wiring: treatments follow the measured mask's era; unknown and plain presets stay untouched.
const p=withPtcgTreatment({rarity:'Rare'},{effect:'ptcg-holo',status:'approximate',layers:[{mask:'pk-neo-art',material:'holo'}]});assert.equal(p.treatment,'ptcg-wotc-holo');
assert.equal(withPtcgTreatment({},{effect:'ptcg-reverse',status:'approximate',layers:[{mask:'pk-lc-surround'}]}).treatment,'ptcg-lc-reverse');
assert.equal(withPtcgTreatment({},{effect:'unknown',status:'unknown',layers:[]}).treatment,undefined);
// Shader: coverage is the measured mask, narrowed by the underbase in holo windows, lighter on the lower half of full arts.
assert.match(PTCG_FOIL_FRAGMENT,/float cov=smoothstep\(\.35,\.65,mk\.a\)\*mix\(1\.,smoothstep\(\.22,\.6,mk\.r\),u_r1\.z\)\*\(1\.-\.5\*u_r2\.y\*smoothstep\(\.52,\.64,uv\.y\)\);/);
assert.match(PTCG_FOIL_FRAGMENT,/return mix\(base,shoulder\(T\*F\*1\.35\),clamp\(cover,0\.,1\.\)\);/,'Zero coverage returns the exact source pixel');
// Card images load from TCGdex without CORS, so the foil must read pixels from its own CORS copy, never the <img>.
assert.equal(typeof readableCopy,'function');
const ptcgSource=readFileSync(new URL('./ptcg-foil.js',import.meta.url),'utf8');
assert.match(ptcgSource,/source:copy,/,'Pokémon foil draws from the readable copy');
assert.doesNotMatch(ptcgSource,/readFoilPixels\(img\)/,'Pokémon foil never reads the untainted-only <img> directly');
assert.match(PTCG_FOIL_FRAGMENT,/overInk\(base,F,cov\*mix\(\.92,\.5,u_r2\.y\)\)/,'Full arts keep half the illustration under the foil');
assert.match(PTCG_FOIL_FRAGMENT,/float a=smoothstep\(0\.,\.03,cov\);gl_FragColor=vec4\(toSrgb\(clamp\(outC,0\.,1\.\)\)\*a,a\);/,'Unfoiled pixels are transparent so the printed card shows through');
// e-Card holo dashes: in the left strip, non-yellow marks get foil; the yellow border and everything beyond the strip do not.
{const {ecardStrip}=await import('./ptcg-foil.js');const W=100,H=10,px=new Uint8ClampedArray(W*H*4),mk=new Uint8ClampedArray(W*H*4);
 for(let k=0;k<W*H;k++){const x=k%W,y=(k-x)/W,dash=x<7&&y===5;px.set(dash?[60,50,70,255]:[245,215,40,255],k*4);}
 ecardStrip(px,mk,W,H);assert.equal(mk[(5*W+3)*4+3],255,'a dash in the strip is foil');assert.equal(mk[(2*W+3)*4+3],0,'yellow border stays plain');
 px.set([60,50,70,255],(5*W+40)*4);ecardStrip(px,mk,W,H);assert.equal(mk[(5*W+40)*4+3],0,'dark ink beyond the strip is untouched');
 assert.equal(PTCG_FOIL_RECIPES['ptcg-ecard-holo'].strip,1);assert.equal(PTCG_FOIL_RECIPES['ptcg-wotc-holo'].strip,0);}
// A // comment runs to the end of its line in GLSL: shader code must never sit after one (it would be silently skipped).
{const {YGO_RARITY_FRAGMENT}=await import('./ygo-rarity-foil.js');for(const [name,src] of [['Pokémon',PTCG_FOIL_FRAGMENT],['Yu-Gi-Oh!',YGO_RARITY_FRAGMENT]])for(const line of src.split('\n')){const k=line.indexOf('//');if(k>=0)assert(!/;/.test(line.slice(k)),`${name} shader comment swallows code: ${line.slice(k,k+90)}`);}}
console.log('PASS: Pokémon foil follows each era (WotC, Legendary Collection, e-Card, EX, DP-SWSH, SV) and variant (cosmos, Poké Ball, Master Ball, gold); holo windows keep the Pokémon solid; full arts by rarity keep text readable; every measured mask parses; art breaking out of the window stays ink on reverse holos.');
