// Foil pop: motion over every foil finish (card page, zoom, gallery, deck view, pack opener). When a
// card is shown, a light band crosses it (no sparkle stars), then nothing stays on top, so the
// measured WebGL / CSS finish (art foil, Yu-Gi-Oh! lettering, stamps) looks exactly as before.
// Each moving part animates transform or opacity only.
const FULL=['detail','zoom','pack'];
const hash=(s,i)=>{let h=2166136261^i;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return ((h>>>0)%1000)/1000;};
// Glints sit where a printed foil catches points of light: spread over the card, kept off the edges.
export function addGlints(host,{n=8,seed=''}={}){
 const doc=host.ownerDocument,layer=doc.createElement('i');layer.className='fx-glints';layer.setAttribute('aria-hidden','true');
 for(let i=0;i<n;i++){const g=doc.createElement('i');g.className='fx-glint';
  g.style.cssText=`left:${8+hash(seed,i*3)*84}%;top:${6+hash(seed,i*3+1)*70}%;--fx-s:${.55+hash(seed,i*3+2)*.7};--fx-d:${1.9+hash(seed,i+40)*1.6}s;--fx-dl:${-hash(seed,i+80)*3}s`;layer.append(g);}
 host.append(layer);return layer;
}
// One light sweep across the element (restarts if it is already running).
export function catchLight(el){if(!el)return;el.classList.remove('fx-catching');void el.offsetWidth;el.classList.add('fx-catching');}
// A short burst of glints (about two twinkles each), then the layer is quiet again.
export function burstGlints(el,ms=2600){if(!el)return;el.classList.remove('fx-burst');void el.offsetWidth;el.classList.add('fx-burst');clearTimeout(el._fxBurst);el._fxBurst=setTimeout(()=>el.classList.remove('fx-burst'),ms);}
export function mountFinishPop(host,{surface='large',seed=''}={}){
 const doc=host.ownerDocument,pop=doc.createElement('span'),full=FULL.includes(surface);
 pop.className='finish-pop';pop.dataset.pop=full?'full':'lite';pop.setAttribute('aria-hidden','true');
 pop.innerHTML='<span class="fx-catch"></span>';
 host.append(pop);
 if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(()=>catchLight(pop));
 return pop;
}
