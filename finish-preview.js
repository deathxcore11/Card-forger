import {esc} from './ui.js';
import {finishChoices,resolveFinish,FINISH_MASKS} from './finish-effects.js';
import {finishMaterialProfile,hasFinishPattern,verifiedTitleMask} from './finish-materials.js';
export {finishChoices,finishEffect,resolveFinish,selectPreviewFinish,finishArtworkCard} from './finish-effects.js';
const KEY='cardstashy-finish-effects';
export const finishEffectsOn=()=>{try{return localStorage.getItem(KEY)!=='off';}catch{return true;}};
export function setFinishEffects(enabled){try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}globalThis.dispatchEvent?.(new Event('cardstashy-finish-effects-change'));}
const reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function finishAttrs(game,c,ctx={},view='large'){
 const p=resolveFinish(game,c,ctx);
 p.materialProfile=finishMaterialProfile(game,c,p);
 return `data-finish-surface="${view}" data-finish-effect="${esc(p.effect)}" data-finish-model="${esc(JSON.stringify(p))}"`;
}
export function finishPreview(game,c,ctx={}){
 const choices=finishChoices(game,c,ctx),p=resolveFinish(game,c,ctx);
 return `<div class="finish-preview" role="group" aria-label="Card finish"><span class="small muted">Finish</span><span class="finish-choice-hint small muted" hidden aria-hidden="true">Scroll ↔</span><div class="finish-choice-rail" tabindex="0" aria-label="Card finishes, scroll horizontally">${game==='ygo'&&!choices.length?'<button type="button" class="chip" data-act="cardTab" data-tab="prices">Choose printing</button>':''}${choices.map(v=>`<button type="button" class="chip" ${game==='ygo'?'':`data-act="cardFinishPreview" data-game="${esc(game)}" data-card-id="${esc(c.id)}" data-finish="${esc(v.key)}"`} aria-pressed="${v.key===p.key}">${esc(v.label)}</button>`).join('')}</div><p class="foot" role="status">${esc(p.effect==='plain'?'Nonfoil · no simulated shine':p.status==='unknown'?(game==='ygo'&&!choices.length?'Choose the set code and rarity to preview its finish.':'Finish preview unavailable for this printing.'):p.reason||'Simulated finish')}</p></div>`;
}
// Reveal a newly selected finish within its own rail, never by scrollIntoView
// (which can move the card sheet or page). Repeated renders must respect swipes.
const finishChoiceStates=new WeakMap();
export function syncFinishChoiceRail(rail,{force=false}={}){
 if(!rail||rail.isConnected===false)return;
 const width=Number(rail.clientWidth)||0;
 if(width<=0)return; // A hidden panel has no useful geometry yet.
 const max=Math.max(0,(Number(rail.scrollWidth)||0)-width),overflow=max>1,
   hint=rail.parentElement?.querySelector?.('.finish-choice-hint');
 if(hint&&hint.hidden===overflow)hint.hidden=!overflow;
 const selected=rail.querySelector?.('[aria-pressed="true"]'),previous=finishChoiceStates.get(rail);
 finishChoiceStates.set(rail,{selected,width,max});
 if(!selected||!overflow||(!force&&previous?.selected===selected&&previous.width===width&&previous.max===max))return;
 const viewport=rail.getBoundingClientRect(),button=selected.getBoundingClientRect(),
   left=viewport.left+(rail.clientLeft||0),right=left+width,
   delta=button.width>width||button.left<left?button.left-left:button.right>right?button.right-right:0;
 if(delta)rail.scrollLeft=Math.max(0,Math.min(max,(Number(rail.scrollLeft)||0)+delta));
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
 const mounted=new Map(),watched=new Set(),choiceRails=new Set(),cleanups=[];
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
 const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{for(const [el,m] of mounted)if(entries.some(x=>x.target===m.img))size(el);for(const entry of entries)if(choiceRails.has(entry.target))syncFinishChoiceRail(entry.target);});
 const mount=el=>{
  if(!allowed(el)||!visible(el))return unmount(el);
  const p=modelOf(el),detail=['detail','zoom'].includes(el.dataset.finishSurface);if(!p.layers?.length&&!detail)return unmount(el);
  if(mounted.has(el)){const old=mounted.get(el);if(old.model===el.dataset.finishModel&&old.src===old.img.currentSrc&&old.overlay.isConnected)return size(el);unmount(el);}
  const img=el.querySelector?.('img'),host=el.dataset.finishSurface==='detail'?(el.querySelector('.cd-zoom')||el):el;
  if(!img||!img.complete||!img.naturalWidth||img.hidden)return;
  const overlay=img.ownerDocument.createElement('span');overlay.className='finish-overlay'+(el.dataset.finishSurface==='large'?' finish-auto':'');
  if(p.materialProfile)overlay.dataset.materialProfile=p.materialProfile;
  if(el.dataset.finishSurface==='large'){const phase=String(p.printingId||'').split('').reduce((n,c)=>n+c.charCodeAt(0),0)%80;overlay.style.animationDelay=`-${phase/10}s`;}
  overlay.setAttribute('aria-hidden','true');
  if(detail){const light=img.ownerDocument.createElement('span');light.className='finish-spotlight';overlay.append(light);}
  for(const l of p.layers||[]){if(!FINISH_MASKS[l.mask])continue;const part=img.ownerDocument.createElement('span');part.className=`finish-layer finish-${l.material}${l.mask==='ygo-name'?' finish-name-region':''}`;part.style.clipPath=FINISH_MASKS[l.mask];overlay.append(part);}
  if(hasFinishPattern(p.materialProfile)&&FINISH_MASKS[p.layers?.[0]?.mask]){const pattern=img.ownerDocument.createElement('span');pattern.className='finish-pattern';pattern.style.clipPath=FINISH_MASKS[p.layers[0].mask];overlay.append(pattern);}
  host.append(overlay);mounted.set(el,{img,host,overlay,model:el.dataset.finishModel,src:img.currentSrc});ro?.observe(img);size(el);
  if(p.game==='ygo'&&overlay.querySelector('.finish-name-region')){
   const src=img.currentSrc;
   void verifiedTitleMask(p.printingId,src).then(mask=>{if(!mask||mounted.get(el)?.overlay!==overlay||img.currentSrc!==src)return;for(const n of overlay.querySelectorAll('.finish-name-region')){n.style.clipPath='none';n.style.maskImage=`url("${mask}")`;n.classList.add('finish-title-glyphs');}});
  }
 };
 const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const x of entries){if(!x.isIntersecting)unmount(x.target);else mount(x.target);}}, {threshold:0});
 let pending=false;
 const sync=()=>{
  pending=false;
  for(const rail of choiceRails)if(rail.isConnected===false){ro?.unobserve(rail);choiceRails.delete(rail);}
  for(const rail of root.querySelectorAll?.('.finish-choice-rail')||[]){if(!choiceRails.has(rail)){choiceRails.add(rail);ro?.observe(rail);}syncFinishChoiceRail(rail);}
  for(const el of watched)if(!el.isConnected||!finishEligible(el)){io?.unobserve(el);watched.delete(el);unmount(el);}
  for(const el of root.querySelectorAll?.('[data-finish-surface]')||[]){
   if(!finishEligible(el))continue;
   if(!watched.has(el)){watched.add(el);io?.observe(el);}
   mount(el);
  }
  for(const el of mounted.keys())if(!allowed(el))unmount(el);
 };
 const queue=()=>{if(!pending){pending=true;queueMicrotask(sync);}};
 on(globalThis,'cardstashy-finish-effects-change',sync);
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
  on(globalThis,'resize',()=>{for(const el of mounted.keys())size(el);for(const rail of choiceRails)syncFinishChoiceRail(rail,{force:true});},{passive:true});
  const media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');on(media,'change',()=>{setInteraction();sync();});
  if(typeof MutationObserver!=='undefined'){
   const mo=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>!n.classList?.contains('finish-overlay'))))queue();});
   mo.observe(root===document?document.body:root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open','hidden','data-finish-model','aria-pressed']});cleanups.push(()=>mo.disconnect());
  }
  sync();
 }
 const dispose=()=>{for(const fn of cleanups)fn();io?.disconnect();ro?.disconnect();for(const el of mounted.keys())unmount(el);watched.clear();choiceRails.clear();attached.delete(root);};
 attached.set(root,dispose);return dispose;
}
