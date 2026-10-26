// Runs the per-card Magic foil analysis off the main thread so large galleries keep scrolling smoothly.
import {analyzeMtgCard} from './mtg-foil-analysis.js';
self.onmessage=e=>{
 const {id,width,height,pixels}=e.data;
 try{const {mask,relief}=analyzeMtgCard(new Uint8ClampedArray(pixels),width,height);self.postMessage({id,mask:mask.buffer,relief:relief.buffer},[mask.buffer,relief.buffer]);}
 catch(error){self.postMessage({id,error:String(error)});}
};
