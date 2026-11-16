// Runs the per-card Magic foil analysis off the main thread so large galleries keep scrolling smoothly.
import {mtgCardMaps} from './mtg-foil-analysis.js';
self.onmessage=e=>{
 const {id,width,height,pixels,pat,frame,emblem}=e.data;
 try{const {mask,relief,box,star}=mtgCardMaps(new Uint8ClampedArray(pixels),width,height,{pat,frame,emblem});self.postMessage({id,mask:mask.buffer,relief:relief.buffer,box,star},[mask.buffer,relief.buffer]);}
 catch(error){self.postMessage({id,error:String(error)});}
};
