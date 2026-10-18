import {esc} from './ui.js';
import {finishChoices,resolveFinish,FINISH_MASKS} from './finish-effects.js';
export {finishChoices,finishEffect,resolveFinish,selectPreviewFinish,finishArtworkCard} from './finish-effects.js';
const KEY='cardstashy-finish-effects';
export const finishEffectsOn=()=>{try{return localStorage.getItem(KEY)!=='off';}catch{return true;}};
const reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function finishAttrs(game,c,ctx={},view='large'){
 const p=resolveFinish(game,c,ctx);
 return `data-finish-surface="${view}" data-finish-effect="${esc(p.effect)}" data-finish-model="${esc(JSON.stringify(p))}"`;
}
export function finishPreview(game,c,ctx={}){
 const choices=finishChoices(game,c,ctx),p=resolveFinish(game,c,ctx);
 return `<div class="finish-preview" role="group" aria-label="Card finish"><span class="small muted">Finish</span><div>${choices.map(v=>`<button type="button" class="chip" ${game==='ygo'?'':`data-act="cardFinishPreview" data-game="${esc(game)}" data-card-id="${esc(c.id)}" data-finish="${esc(v.key)}"`} aria-pressed="${v.key===p.key}">${esc(v.label)}</button>`).join('')}</div><p class="foot" role="status">${esc(p.effect==='plain'?'Nonfoil · no simulated shine':p.status==='unknown'?'Finish preview unavailable for this printing.':p.reason||'Simulated finish')}</p><button type="button" class="chip" data-finish-toggle aria-pressed="${finishEffectsOn()}">Visual effects ${finishEffectsOn()?'on':'off'}</button></div>`;
}
// Object-fit: contain geometry in untransformed CSS pixels; the same parent transforms both layers.
export function containedImageBox(width,height,naturalWidth,naturalHeight){
 if(![width,height,naturalWidth,naturalHeight].every(x=>Number.isFinite(x)&&x>0))return null;
 const k=Math.min(width/naturalWidth,height/naturalHeight),w=naturalWidth*k,h=naturalHeight*k;
 return {left:(width-w)/2,top:(height-h)/2,width:w,height:h};
}
export function finishEligible(el){
 if(!el?.dataset?.finishSurface||el.hidden||el.closest?.('[hidden]'))return false;
 return el.dataset.finishSurface==='detail'||el.dataset.finishSurface==='zoom'||(el.dataset.finishSurface==='large'&&!!el.closest?.('.view-gallery')&&!el.closest?.('.view-compact,.view-symbols'));
}
function modelOf(el){try{return JSON.parse(el.dataset.finishModel||'{}');}catch{return {};}}
const attached=new WeakMap();
export function attachFinishPreview(root){
 if(!root)return ()=>{};
 if(attached.has(root))return attached.get(root);
 const mounted=new Map(),watched=new Set(),cleanups=[];
 const on=(el,type,fn,options)=>{el?.addEventListener?.(type,fn,options);cleanups.push(()=>el?.removeEventListener?.(type,fn,options));};
 const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<(globalThis.innerHeight||Infinity)&&r.right>0&&r.left<(globalThis.innerWidth||Infinity);};
 const foreground=el=>{const top=[...(globalThis.document?.querySelectorAll?.('dialog[open]')||[])].at(-1);return !top||top.contains(el);};
 const allowed=el=>finishEffectsOn()&&!reduced()&&!globalThis.document?.hidden&&finishEligible(el)&&el.isConnected!==false&&foreground(el);
 const unmount=el=>{const m=mounted.get(el);if(m){ro?.unobserve(m.img);m.overlay.remove();mounted.delete(el);}};
 const size=el=>{
  const m=mounted.get(el);if(!m)return;
  const {img,overlay,host}=m,css=globalThis.getComputedStyle?.(img),px=v=>parseFloat(v)||0;
  const left=px(css?.paddingLeft),top=px(css?.paddingTop),box=containedImageBox(img.clientWidth-left-px(css?.paddingRight),img.clientHeight-top-px(css?.paddingBottom),img.naturalWidth,img.naturalHeight);
  if(!box||img.hidden){if(!overlay.hidden)overlay.hidden=true;return;}
  let x=(img.offsetLeft||0)+(img.clientLeft||0)+left,y=(img.offsetTop||0)+(img.clientTop||0)+top,ancestor=img.offsetParent;
  while(ancestor&&ancestor!==host){x+=ancestor.offsetLeft||0;y+=ancestor.offsetTop||0;ancestor=ancestor.offsetParent;}
  if(ancestor!==host){if(!overlay.hidden)overlay.hidden=true;return;}
  Object.assign(overlay.style,{left:`${x+box.left}px`,top:`${y+box.top}px`,width:`${box.width}px`,height:`${box.height}px`});if(overlay.hidden)overlay.hidden=false;
 };
 const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{for(const [el,m] of mounted)if(entries.some(x=>x.target===m.img))size(el);});
 const mount=el=>{
  if(!allowed(el)||!visible(el))return unmount(el);
  const p=modelOf(el);if(!p.layers?.length)return unmount(el);
  if(mounted.has(el)){const old=mounted.get(el);if(old.model===el.dataset.finishModel&&old.overlay.isConnected)return size(el);unmount(el);}
  const img=el.querySelector?.('img'),host=el.dataset.finishSurface==='detail'?(el.querySelector('.cd-zoom')||el):el;
  if(!img||!img.complete||!img.naturalWidth||img.hidden)return;
  const overlay=img.ownerDocument.createElement('span');overlay.className='finish-overlay'+(el.dataset.finishSurface==='large'?' finish-auto':'');
  if(el.dataset.finishSurface==='large'){const phase=String(p.printingId||'').split('').reduce((n,c)=>n+c.charCodeAt(0),0)%80;overlay.style.animationDelay=`-${phase/10}s`;}
  overlay.setAttribute('aria-hidden','true');
  for(const l of p.layers){if(!FINISH_MASKS[l.mask])continue;const part=img.ownerDocument.createElement('span');part.className=`finish-layer finish-${l.material}`;part.style.clipPath=FINISH_MASKS[l.mask];overlay.append(part);}
  host.append(overlay);mounted.set(el,{img,host,overlay,model:el.dataset.finishModel});ro?.observe(img);size(el);
 };
 const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const x of entries){if(!x.isIntersecting)unmount(x.target);else mount(x.target);}}, {threshold:0});
 let pending=false;
 const sync=()=>{
  pending=false;
  for(const el of watched)if(!el.isConnected||!finishEligible(el)){io?.unobserve(el);watched.delete(el);unmount(el);}
  for(const el of root.querySelectorAll?.('[data-finish-surface]')||[]){
   if(!finishEligible(el))continue;
   if(!watched.has(el)){watched.add(el);io?.observe(el);}
   mount(el);
  }
  for(const el of mounted.keys())if(!allowed(el))unmount(el);
 };
 const queue=()=>{if(!pending){pending=true;queueMicrotask(sync);}};
 on(root,'click',e=>{
  const button=e.target.closest?.('[data-finish-toggle]');if(!button)return;
  const enabled=!finishEffectsOn();try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}
  for(const b of root.querySelectorAll?.('[data-finish-toggle]')||[]){b.setAttribute('aria-pressed',String(enabled));b.textContent=`Visual effects ${enabled?'on':'off'}`;}
  sync();
 });
 // Visible large cards use a shared CSS light sweep. The existing detail tilt owns
 // its light coordinates. No per-card JavaScript animation loop is installed.
 const interact=e=>{const el=e.target.closest?.('[data-finish-surface]');if(el)mount(el);};
 if(root.querySelectorAll&&globalThis.document){
  let interactionOn=false;
  const interactionEvents=[['pointerover',{passive:true}],['pointerdown',{passive:true}],['focusin',false],['load',{capture:true,passive:true}]];
  const setInteraction=()=>{
   const enable=!reduced();if(enable===interactionOn)return;interactionOn=enable;
   for(const [type,options] of interactionEvents)root[enable?'addEventListener':'removeEventListener']?.(type,interact,options);
  };
  setInteraction();cleanups.push(()=>{for(const [type,options] of interactionEvents)root.removeEventListener?.(type,interact,options);});
  on(globalThis.document,'visibilitychange',sync);
  on(globalThis,'resize',()=>{for(const el of mounted.keys())size(el);},{passive:true});
  const media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');on(media,'change',()=>{setInteraction();sync();});
  if(typeof MutationObserver!=='undefined'){
   const mo=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>!n.classList?.contains('finish-overlay'))))queue();});
   mo.observe(root===document?document.body:root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open','hidden','data-finish-model']});cleanups.push(()=>mo.disconnect());
  }
  sync();
 }
 const dispose=()=>{for(const fn of cleanups)fn();io?.disconnect();ro?.disconnect();for(const el of mounted.keys())unmount(el);watched.clear();attached.delete(root);};
 attached.set(root,dispose);return dispose;
}
