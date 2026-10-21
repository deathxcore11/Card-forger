// Device motion is an optional input, never a requirement for viewing a card.
const KEY='cardstashy-motion-tilt';
export const motionTiltOn=()=>{try{return localStorage.getItem(KEY)!=='off';}catch{return true;}};
export function setMotionTilt(on){try{localStorage.setItem(KEY,on?'on':'off');globalThis.dispatchEvent?.(new Event('cardstashy-motion-tilt-change'));return true;}catch{return false;}}
export const touchDevice=()=>!!(globalThis.navigator?.maxTouchPoints>0||globalThis.matchMedia?.('(any-pointer: coarse)').matches);
export function tiltCoordinates(sample,origin,angle=0){
 const clamp=v=>Math.max(-1,Math.min(1,v/18)),x=clamp(sample.gamma-origin.gamma),y=clamp(sample.beta-origin.beta),r=angle*Math.PI/180;
 return {x:x*Math.cos(r)+y*Math.sin(r),y:y*Math.cos(r)-x*Math.sin(r)};
}
export function attachZoomMotion({dialog,surface,button,active}){
 if(!touchDevice()||!globalThis.DeviceOrientationEvent){button.hidden=true;return ()=>{};}
 button.hidden=false;
 const media=matchMedia('(prefers-reduced-motion: reduce)'),EventType=globalThis.DeviceOrientationEvent;
 let origin=null,frame=0,last=null,granted=typeof EventType.requestPermission!=='function',disposed=false;
 const reset=()=>{surface.style.removeProperty('transform');surface.style.removeProperty('--mx');surface.style.removeProperty('--my');origin=null;};
 const sync=()=>{const on=motionTiltOn();button.setAttribute('aria-pressed',String(on&&granted));button.textContent=!on?'Tilt off':!granted?'Enable tilt':'Tilt on';button.disabled=media.matches;button.title=media.matches?'Tilt follows Reduce motion':'Move your phone to move the light';if(!on||media.matches)reset();};
 const apply=()=>{frame=0;if(disposed||!motionTiltOn()||media.matches||document.hidden||!active()||!last){reset();return;}
  origin||={...last};const {x,y}=tiltCoordinates(last,origin,screen.orientation?.angle||0);
  surface.style.transform=`perspective(900px) rotateX(${-y*8}deg) rotateY(${x*8}deg)`;
  surface.style.setProperty('--mx',`${50+x*40}%`);surface.style.setProperty('--my',`${50+y*40}%`);
 };
 const turn=e=>{if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;granted=true;last={beta:e.beta,gamma:e.gamma};if(!frame)frame=requestAnimationFrame(apply);};
 const click=async()=>{if(media.matches)return;try{if(!granted&&typeof EventType.requestPermission==='function'){
  if(await EventType.requestPermission()!=='granted'){button.textContent='Tilt unavailable';return;}granted=true;if(disposed)return;setMotionTilt(true);
 }else if(!setMotionTilt(!motionTiltOn())){button.textContent='Could not save tilt';return;}sync();}catch{button.textContent='Tilt unavailable';}};
 const changed=()=>{reset();sync();};
 window.addEventListener('deviceorientation',turn,{passive:true});window.addEventListener('cardstashy-motion-tilt-change',changed);window.addEventListener('orientationchange',reset);document.addEventListener('visibilitychange',reset);media.addEventListener('change',changed);button.addEventListener('click',click);dialog.addEventListener('cardstashy-zoom-view',reset);sync();
 return ()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener('deviceorientation',turn);window.removeEventListener('cardstashy-motion-tilt-change',changed);window.removeEventListener('orientationchange',reset);document.removeEventListener('visibilitychange',reset);media.removeEventListener('change',changed);button.removeEventListener('click',click);dialog.removeEventListener('cardstashy-zoom-view',reset);reset();};
}
