// Runs the per-card foil analysis off the main thread so large galleries keep scrolling smoothly.
import {analyzeYgoArt,YGO_LAYOUT_ART} from './ygo-foil-analysis.js';
self.onmessage=e=>{
 const {id,width,height,pixels,layout,box}=e.data;
 try{const {mask,relief}=analyzeYgoArt(new Uint8ClampedArray(pixels),width,height,box||YGO_LAYOUT_ART[layout]||YGO_LAYOUT_ART.standard);self.postMessage({id,mask:mask.buffer,relief:relief.buffer},[mask.buffer,relief.buffer]);}
 catch(error){self.postMessage({id,error:String(error)});}
};
