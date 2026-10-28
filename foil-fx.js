// Foil pop: the shared light layer that sits over every foil finish (card page, zoom, gallery, deck
// view, pack opener). It adds a holo rim, twinkling glints, a glare that follows the existing
// --mx/--my light, and a light catch when the card appears. Each moving part animates transform or
// opacity only; the measured WebGL / CSS finish underneath is untouched.
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
export function mountFinishPop(host,{surface='large',seed=''}={}){
 const doc=host.ownerDocument,pop=doc.createElement('span'),full=FULL.includes(surface);
 pop.className='finish-pop';pop.dataset.pop=full?'full':'lite';pop.setAttribute('aria-hidden','true');
 pop.innerHTML='<span class="fp-rim"><i></i></span><span class="fp-glare"></span><span class="fx-catch"></span>';
 if(full)addGlints(pop,{n:surface==='pack'?10:8,seed});
 host.append(pop);
 if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(()=>catchLight(pop));
 return pop;
}
