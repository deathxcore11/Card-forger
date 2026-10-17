// Home-only game navigation. Horizontal intent locks before suppressing a click;
// inputs, native edge gestures, overlays and nested horizontal scrollers keep control.
import { GAME_IDS } from './games.js';
export function swipeGame(current,dx,dy,elapsed){
 if(Math.abs(dx)<72 || Math.abs(dx)<Math.abs(dy)*1.6 || elapsed>700 || elapsed<0)return null;
 const i=GAME_IDS.indexOf(current);return i<0?null:GAME_IDS[(i+(dx<0?1:-1)+GAME_IDS.length)%GAME_IDS.length];
}
export function attachHomeSwipe(root,{enabled,current,switchGame,view=globalThis}){
 if(!root)return ()=>{};
 let gesture=null,busy=false,suppressUntil=0;
 const blocked=target=>{
  if(target.closest?.('input,textarea,select,[contenteditable="true"],[role="slider"],.zoom-stage,[data-home-gesture],.deck-tile,[data-hold-card],[draggable="true"],.hh-art-link,.hh-credit'))return true;
  for(let el=target;el&&el!==root;el=el.parentElement){
   if(el.scrollWidth>el.clientWidth+8 && /auto|scroll/.test(view.getComputedStyle(el).overflowX))return true;
  }
  return false;
 };
 const start=e=>{
  gesture=null;if(busy||!enabled()||e.touches.length!==1||blocked(e.target))return;
  const t=e.touches[0];if(t.clientX<24||t.clientX>view.innerWidth-24)return;
  gesture={x:t.clientX,y:t.clientY,dx:0,dy:0,time:Date.now(),locked:false,game:current()};
 };
 const move=e=>{
  if(!gesture)return;if(e.touches.length!==1||!enabled()){gesture=null;return;}
  const t=e.touches[0];gesture.dx=t.clientX-gesture.x;gesture.dy=t.clientY-gesture.y;
  if(!gesture.locked&&Math.abs(gesture.dy)>12&&Math.abs(gesture.dy)>=Math.abs(gesture.dx)){gesture=null;return;}
  if(Math.abs(gesture.dx)>16&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.6)gesture.locked=true;
  if(gesture.locked&&e.cancelable)e.preventDefault();
 };
 const end=async e=>{
  const g=gesture;gesture=null;if(!g||!g.locked||!enabled()||current()!==g.game||e.touches?.length)return;
  const t=e.changedTouches?.[0],dx=t?t.clientX-g.x:g.dx,dy=t?t.clientY-g.y:g.dy;
  const next=swipeGame(g.game,dx,dy,Date.now()-g.time);if(!next)return;
  suppressUntil=Date.now()+450;busy=true;
  try{await switchGame(next);if(!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches)root.animate?.([{opacity:.7,transform:`translateX(${dx<0?16:-16}px)`},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'ease-out'});}finally{busy=false;}
 };
 const cancel=()=>{gesture=null;};
 const click=e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}};
 root.addEventListener('touchstart',start,{passive:true});root.addEventListener('touchmove',move,{passive:false});root.addEventListener('touchend',end);root.addEventListener('touchcancel',cancel);root.addEventListener('click',click,true);
 return ()=>{root.removeEventListener('touchstart',start);root.removeEventListener('touchmove',move);root.removeEventListener('touchend',end);root.removeEventListener('touchcancel',cancel);root.removeEventListener('click',click,true);};
}
