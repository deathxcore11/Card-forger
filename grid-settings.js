// Browser-local display preferences; never stored in collection/account data.
export const GRID_KEY='cardstashy-grid-size', PINCH_KEY='cardstashy-grid-pinch';
export const GRID_SIZES=['small','medium','large'];
const storageDefault=()=>{try{return globalThis.localStorage;}catch{return null;}};
export const normalizeGridSize=value=>GRID_SIZES.includes(value)?value:'medium';
export const readGridSize=(storage=storageDefault())=>{try{return normalizeGridSize(storage?.getItem(GRID_KEY));}catch{return 'medium';}};
export const readGridPinch=(storage=storageDefault())=>{try{return storage?.getItem(PINCH_KEY)==='on';}catch{return false;}};
export function applyGridSize(value,{document=globalThis.document,storage=storageDefault(),persist=true}={}){
 const size=normalizeGridSize(value);let saved=!persist;
 if(persist)try{if(storage){storage.setItem(GRID_KEY,size);saved=true;}}catch{}
 if(document?.documentElement)document.documentElement.dataset.gridSize=size;
 for(const input of document?.querySelectorAll('[data-change="setGridSize"]')||[])input.checked=input.value===size;
 return {size,saved};
}
export function applyGridPinch(value,{document=globalThis.document,storage=storageDefault(),persist=true}={}){
 const enabled=value===true;let saved=!persist;
 if(persist)try{if(storage){storage.setItem(PINCH_KEY,enabled?'on':'off');saved=true;}}catch{}
 if(document?.documentElement)document.documentElement.dataset.gridPinch=enabled?'on':'off';
 for(const input of document?.querySelectorAll('[data-change="setGridPinch"]')||[])input.checked=enabled;
 return {enabled,saved};
}
export function gridSettings({document=globalThis.document,storage=storageDefault()}={}){
 const size=normalizeGridSize(document?.documentElement?.dataset.gridSize||readGridSize(storage)),pinch=document?.documentElement?.dataset.gridPinch==='on'||(!document?.documentElement?.dataset.gridPinch&&readGridPinch(storage));
 return `<section class="panel settings-card settings-grid"><div class="settings-card-heading"><div><p class="eyebrow">CARD GRIDS</p><h2>Room to browse</h2></div></div><fieldset class="grid-size-field"><legend>Card size</legend><div class="grid-size-control">${GRID_SIZES.map(id=>`<label><input type="radio" name="cardGridSize" value="${id}" data-change="setGridSize" ${id===size?'checked':''}><span>${id[0].toUpperCase()+id.slice(1)}</span></label>`).join('')}</div></fieldset><p class="foot">Applies to card galleries in all three games. List views keep their current layout.</p><label class="check"><input type="checkbox" data-change="setGridPinch" ${pinch?'checked':''}> Pinch to resize card grids</label><p class="foot">Spread two fingers for larger cards; pinch for smaller cards. Only card grids use this gesture when enabled. Turn it off to use browser pinch zoom there.</p></section>`;
}
export function pinchGridSize(size,ratio){
 const index=GRID_SIZES.indexOf(normalizeGridSize(size));
 return GRID_SIZES[Math.max(0,Math.min(2,index+(ratio>=1.22?1:ratio<=.82?-1:0)))];
}
const GRID='#content.view-gallery .card-grid, #content.view-gallery .display-list';
export function initGrid({document=globalThis.document,window=globalThis.window,storage=storageDefault(),onPinchStart=()=>{},announce=()=>{}}={}){
 if(!document?.documentElement||!window?.addEventListener)return ()=>{};
 const opts={document,storage};applyGridSize(readGridSize(storage),{...opts,persist:false});applyGridPinch(readGridPinch(storage),{...opts,persist:false});
 let gesture=null,suppressUntil=0,blockedGrid=null,multiTouch=false;
 const enabled=()=>document.documentElement.dataset.gridPinch==='on'&&!document.querySelector('dialog[open]');
 const distance=touches=>Math.hypot(touches[1].clientX-touches[0].clientX,touches[1].clientY-touches[0].clientY);
 const onStart=e=>{
  if(!enabled()||e.touches.length!==2)return;
  const grid=e.touches[0].target.closest?.(GRID);
  if(!grid||e.touches[1].target.closest?.(GRID)!==grid)return;
  const start=distance(e.touches);if(start<20)return;
  gesture={grid,start,ratio:1,size:normalizeGridSize(document.documentElement.dataset.gridSize),anchor:e.touches[0].target.closest?.('.lot,.grid-card')};
  blockedGrid=grid;multiTouch=true;onPinchStart();if(e.cancelable)e.preventDefault();e.stopPropagation();
 };
 const onMove=e=>{
  if(!gesture)return;
  if(!enabled()||!gesture.grid.isConnected||e.touches.length!==2){gesture=null;return;}
  gesture.ratio=distance(e.touches)/gesture.start;if(e.cancelable)e.preventDefault();e.stopPropagation();
 };
 const onEnd=e=>{
  if(multiTouch){suppressUntil=window.performance.now()+500;if(!e.touches.length)multiTouch=false;}
  if(!gesture)return;
  if(e.touches.length>=2)return;
  const saved=gesture;gesture=null;suppressUntil=window.performance.now()+500;
  if(e.type==='touchcancel'||!enabled()||!saved.grid.isConnected)return;
  const size=pinchGridSize(saved.size,saved.ratio);if(size===saved.size)return;
  const top=saved.anchor?.getBoundingClientRect().top;
  const result=applyGridSize(size,opts);
  window.requestAnimationFrame(()=>{if(saved.anchor?.isConnected&&Number.isFinite(top)&&!document.querySelector('dialog[open]'))window.scrollBy(0,saved.anchor.getBoundingClientRect().top-top);});
  announce(`Card size: ${size[0].toUpperCase()+size.slice(1)}${result.saved?'':' · not saved on this device'}`);
 };
 const onClick=e=>{if(blockedGrid?.contains(e.target)&&(multiTouch||gesture||window.performance.now()<suppressUntil)){e.preventDefault();e.stopImmediatePropagation();}};
 const cancel=()=>{gesture=null;multiTouch=false;blockedGrid=null;suppressUntil=0;};
 const onStorage=e=>{if(e.storageArea&&e.storageArea!==storage)return;cancel();if(e.key===GRID_KEY||e.key===null)applyGridSize(readGridSize(storage),{...opts,persist:false});if(e.key===PINCH_KEY||e.key===null)applyGridPinch(readGridPinch(storage),{...opts,persist:false});};
 const touchEvents=[['touchstart',onStart],['touchmove',onMove],['touchend',onEnd],['touchcancel',onEnd]];
 let listening=false,observer=null;
 const listen=next=>{
  if(next===listening)return;
  listening=next;
  for(const [name,fn] of touchEvents)next?document.addEventListener(name,fn,{capture:true,passive:false}):document.removeEventListener(name,fn,true);
  next?document.addEventListener('click',onClick,true):document.removeEventListener('click',onClick,true);
  if(!next)cancel();
 };
 // Non-passive gesture listeners exist only while the shortcut is enabled.
 // The default browser-zoom path incurs no extra touch/scroll handler work.
 const sync=()=>listen(!observer||document.documentElement.dataset.gridPinch==='on');
 if(window.MutationObserver){observer=new window.MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-grid-pinch']});}
 sync();
 window.addEventListener('storage',onStorage);window.addEventListener('hashchange',cancel);document.addEventListener('visibilitychange',cancel);
 return ()=>{observer?.disconnect();listen(false);window.removeEventListener('storage',onStorage);window.removeEventListener('hashchange',cancel);document.removeEventListener('visibilitychange',cancel);cancel();};
}
