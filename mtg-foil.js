// Magic foil, rendered with WebGL on the card page, zoom, and gallery cards at every size in
// collections, binders and decks. Every treatment, from 1999 old-border foil to surge,
// galaxy, oil slick and gilded, is a recipe (mtg-foil-recipes.js) chosen from the card's own Scryfall
// data. Magic prints its inks straight onto the foil, so the whole card is foil unless the treatment
// says otherwise; dark ink absorbs it and light ink lets it through. The shader (mtg-foil-shader.js) is
// composed per foil type: a card only runs its own type's lines, which keeps big galleries light.
// Approximate simulation on reference images, not a physical-foil capture.
import {mtgCardMaps,MTG_FRAMES,MTG_MAP_W,MTG_MAP_H} from './mtg-foil-analysis.js';
import {MTG_FOIL_RECIPES} from './mtg-foil-recipes.js';
import {MTG_FOIL_TEMPLATE,MTG_FOIL_UNIFORMS,mtgFoilFragment,foilDefs,foilKey} from './mtg-foil-shader.js';
import {foilContext,foilContextProgram,foilAnalyzer,readableCopy,mountFoilCanvas} from './foil-gl.js';
// Every foil type's lines in one text (what tests and reviews read); a card compiles only its own.
export const MTG_FOIL_FRAGMENT=MTG_FOIL_TEMPLATE;
const analyze=foilAnalyzer(new URL('./mtg-foil-worker.js',import.meta.url),(data,W,H,o)=>mtgCardMaps(data,W,H,o));
// The card at the maps' fixed size (the Foil Test Bench's, where every per-card rule was checked).
function readMapPixels(img){
 const c=(globalThis.document||img.ownerDocument).createElement('canvas');c.width=MTG_MAP_W;c.height=MTG_MAP_H;const x=c.getContext('2d',{willReadFrequently:true});
 x.imageSmoothingQuality='high';x.drawImage(img,0,0,MTG_MAP_W,MTG_MAP_H);return {W:MTG_MAP_W,H:MTG_MAP_H,data:x.getImageData(0,0,MTG_MAP_W,MTG_MAP_H).data};
}
// Silver scroll's plates are read on Scryfall's 'large' scan (672 px): on the 488 px 'normal' scan the plates are too noisy to
// read as flat, so the name plate would come out as picture (checked on SOA 131, 140, 149, 157, 167, 176, 185).
export const largeScan=src=>/^https:\/\/cards\.scryfall\.io\/(small|normal)\//.test(src)?src.replace(/^(https:\/\/cards\.scryfall\.io\/)(small|normal)\//,'$1large/'):src;
// The Jurassic World emblem (embossed foil, pattern 29): one measured shape for every card, read once at the maps' size.
let emblem=null;
const emblemPixels=()=>emblem||(emblem=readableCopy(new URL('./assets/finishes/mtg-emblem-rex.png',import.meta.url).href).then(i=>readMapPixels(i).data).catch(()=>null));
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
 const copy=()=>readableCopy(src);let maps=null;
 // One image can wear several recipes on a page, and its maps differ by pattern (silver ink, gold window, emblem, facets).
 return mountFoilCanvas(overlay,{source:copy,key:src+'|'+r.pat+'|'+frame,surface,program:()=>renderer(overlay.ownerDocument,r),
  // Each card's own maps (mtgCardMaps): its inks, its picture and rules boxes snapped to its printed frame lines, and the
  // shooting star its scan already carries. Until they land nothing is drawn (the CSS finish shows).
  analysis:()=>Promise.all([r.pat===23?readableCopy(largeScan(src)).catch(copy):copy(),r.pat===29?emblemPixels():null]).then(([i,em])=>analyze(src+'|'+r.pat+'|'+frame,()=>readMapPixels(i),{pat:r.pat,frame:box,emblem:em})).then(a=>(maps=a)),
  setUniforms:({gl,U})=>{const b=maps?.box||box,st=maps?.star;gl.uniform4f(U.u_art,...b.art);gl.uniform4f(U.u_text,...b.text);gl.uniform4f(U.u_r1,r.pat,r.tint,r.cover,r.relief);gl.uniform4f(U.u_r2,r.film,r.sparkle,r.stamp||0,r.keep||0);
   if(U.u_star)gl.uniform3f(U.u_star,st?st.x:b.text[0]+.1,st?st.y:b.text[3]-.005,st?2:1);}});
}
