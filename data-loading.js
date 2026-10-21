// A small "Loading card data" card with the animated logo, floating over a set while its cards load.
// It appears only if loading takes longer than a blink and leaves on its own; nothing to tap.
import {brandMark} from './brand.js';
let el=null,timer=0;
export function syncDataLoading(loading,doc=globalThis.document){
 if(!doc?.body)return;
 if(loading){
  if(el||timer)return;
  timer=setTimeout(()=>{timer=0;el=doc.createElement('div');el.className='data-loading';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
   el.innerHTML=`<div class="data-loading-card">${brandMark('brand-loading')}<b>Loading card data</b><span>Hang tight, this can take a moment.</span></div>`;doc.body.append(el);},250);
  return;
 }
 clearTimeout(timer);timer=0;
 if(el){const old=el;el=null;old.classList.add('leaving');setTimeout(()=>old.remove(),260);}
}
