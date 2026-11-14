// Magic foil, rendered with WebGL on the card page, zoom, and gallery cards at every size in
// collections, binders and decks. Every treatment, from 1999 old-border foil to surge,
// galaxy, oil slick and gilded, is a recipe (mtg-foil-recipes.js) chosen from the card's own Scryfall
// data. Magic prints its inks straight onto the foil, so the whole card is foil unless the treatment
// says otherwise; dark ink absorbs it and light ink lets it through. The shader (mtg-foil-shader.js) is
// composed per foil type: a card only runs its own type's lines, which keeps big galleries light.
// Approximate simulation on reference images, not a physical-foil capture.
import {analyzeMtgCard,MTG_FRAMES} from './mtg-foil-analysis.js';
import {MTG_FOIL_RECIPES} from './mtg-foil-recipes.js';
import {MTG_FOIL_TEMPLATE,MTG_FOIL_UNIFORMS,mtgFoilFragment,foilDefs,foilKey} from './mtg-foil-shader.js';
import {foilContext,foilContextProgram,foilAnalyzer,readFoilPixels,readableCopy,mountFoilCanvas} from './foil-gl.js';
// Every foil type's lines in one text (what tests and reviews read); a card compiles only its own.
export const MTG_FOIL_FRAGMENT=MTG_FOIL_TEMPLATE;
const analyze=foilAnalyzer(new URL('./mtg-foil-worker.js',import.meta.url),(data,W,H)=>analyzeMtgCard(data,W,H));
// One WebGL context for every Magic foil; one small program per foil type, compiled when first shown.
let shared=null;
function renderer(doc,recipe){
 if(shared?.lost)return null;
 if(!shared&&!(shared=foilContext(doc)))return null;
 const key=foilKey(foilDefs(recipe));
 return shared.programs.has(key)?shared.programs.get(key):foilContextProgram(shared,key,mtgFoilFragment(recipe),MTG_FOIL_UNIFORMS);
}
// Returns a handle, or null when this surface keeps the CSS finish (unknown treatment, no WebGL).
export function mountMtgFoil(overlay,img,treatment,{surface='detail',frame='2015'}={}){
 const r=MTG_FOIL_RECIPES[treatment],box=MTG_FRAMES[frame]||MTG_FRAMES['2015'];if(!r||!overlay||!img)return null;
 const src=img.currentSrc||img.src;if(!src)return null;
 const copy=()=>readableCopy(src);
 return mountFoilCanvas(overlay,{source:copy,key:src,surface,program:()=>renderer(overlay.ownerDocument,r),
  analysis:()=>copy().then(i=>analyze(src,()=>readFoilPixels(i,372))),
  setUniforms:({gl,U})=>{gl.uniform4f(U.u_art,...box.art);gl.uniform4f(U.u_text,...box.text);gl.uniform4f(U.u_r1,r.pat,r.tint,r.cover,r.relief);gl.uniform4f(U.u_r2,r.film,r.sparkle,r.stamp||0,r.keep||0);}});
}
