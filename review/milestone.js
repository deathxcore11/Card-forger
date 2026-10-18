import {FINISH_MASKS} from '../finish-effects.js';
const $=s=>document.querySelector(s),data=await (await fetch('cases.json')).json();
const cases=data.cases,media=matchMedia('(prefers-reduced-motion: reduce)');
let game='ptcg',selected=cases[0],playing=false,tiltOn=false,origin=null,frame=0;
let light={x:35,y:40},target={...light};
function updateLight(x,y,{animate=true}={}){
 target={x:Math.max(5,Math.min(95,x)),y:Math.max(5,Math.min(95,y))};
 if(!animate||media.matches){light={...target};paint();return;}
 if(!frame)frame=requestAnimationFrame(tick);
}
function paint(){for(const n of document.querySelectorAll('.review-card')){n.style.setProperty('--mx',light.x+'%');n.style.setProperty('--my',light.y+'%');n.style.setProperty('--rx',(50-light.y)*.09+'deg');n.style.setProperty('--ry',(light.x-50)*.1+'deg');}}
function tick(){frame=0;light.x+=(target.x-light.x)*.24;light.y+=(target.y-light.y)*.24;paint();if(Math.abs(target.x-light.x)+Math.abs(target.y-light.y)>.08)frame=requestAnimationFrame(tick);}
function setPlaying(value){playing=!!value&&!media.matches;$('#motion').setAttribute('aria-pressed',String(playing));$('#motion').textContent=playing?'Pause light sweep':'Play light sweep';for(const n of document.querySelectorAll('.review-card'))n.classList.toggle('is-playing',playing);}
function part(material,mask){const n=document.createElement('span');n.className='finish-layer finish-'+material+(mask==='ygo-name'?' finish-name-region':'');n.style.clipPath=FINISH_MASKS[mask]||FINISH_MASKS.card;return n;}
function surface(c,proposed){
 const model=proposed?c.after:c.before,node=document.createElement('div');node.className='review-card';node.dataset.finishSurface='detail';node.dataset.finishEffect=model.effect;node.dataset.profile=c.profile;node.tabIndex=0;node.setAttribute('role','img');node.setAttribute('aria-label',c.name+' — '+c.finish+' — '+(proposed?'proposed':'current')+' finish');
 const img=new Image();img.src=c.image;img.alt='';img.draggable=false;node.append(img);
 const overlay=document.createElement('span');overlay.className='finish-overlay';overlay.setAttribute('aria-hidden','true');
 // Match the existing neutral detail spotlight in the baseline. The proposed
 // plain control intentionally has no material overlay.
 if(!proposed||c.profile!=='plain'){const lamp=document.createElement('span');lamp.className='finish-spotlight';overlay.append(lamp);}
 const layers=model.layers?.length?model.layers:(proposed&&c.key==='pk-zapdos-base2-holo'?[{mask:'card',material:'holo'}]:[]);
 for(const l of layers){const n=part(l.material,l.mask);if(proposed&&l.mask==='ygo-name'&&c.titleMask){n.style.clipPath='none';n.style.maskImage=`url('${c.titleMask}')`;n.classList.add('title-glyphs');}if(proposed&&c.foilMask){n.style.clipPath='none';n.style.maskImage=`url('${c.foilMask}')`;}overlay.append(n);}
 if(proposed&&c.profile!=='plain'&&!['ygo-rare','traditional'].includes(c.profile)){
  const pattern=document.createElement('span');pattern.className='review-pattern';
  pattern.style.clipPath=FINISH_MASKS[layers[0]?.mask]||FINISH_MASKS.card;
  if(c.foilMask){pattern.style.clipPath='none';pattern.style.maskImage=`url('${c.foilMask}')`;}
  overlay.append(pattern);
 }
 if(overlay.children.length)node.append(overlay);
 const move=e=>{if(e.pointerType==='touch')return;setPlaying(false);const r=node.getBoundingClientRect();updateLight((e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100);};
 node.addEventListener('pointermove',move,{passive:true});
 node.addEventListener('keydown',e=>{const d={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}[e.key];if(d){e.preventDefault();setPlaying(false);updateLight(target.x+d[0],target.y+d[1]);}});
 return node;
}
function render(){
 $('#name').textContent=selected.name;$('#printing').textContent=selected.printing;$('#finish').textContent=selected.finish;
 $('#counter').textContent=String(cases.indexOf(selected)+1).padStart(2,'0')+' / 14';
 $('#beforeStage').replaceChildren(surface(selected,false));$('#afterStage').replaceChildren(surface(selected,true));
 $('#beforeNote').textContent=selected.before.status==='unknown'?'No supported finish preview in the baseline.':'Current masks and material styling.';
 $('#afterNote').textContent=selected.profile==='plain'?'Plain control. No simulated foil.':selected.titleMask?'Foil art and individually masked title lettering.':'Proposed material · approximate simulation.';
 $('#sourceNote').textContent=selected.note;$('#source').href=selected.source;
 paint();setPlaying(playing);origin=null;
 const hash=new URLSearchParams(location.hash.slice(1));hash.set('case',selected.key);history.replaceState(null,'','#'+hash);
 document.documentElement.dataset.ready='true';document.documentElement.dataset.case=selected.key;
}
function selectGame(g,key){game=g;const group=cases.filter(c=>c.game===game);$('#case').replaceChildren(...group.map(c=>{const o=document.createElement('option');o.value=c.key;o.textContent=c.name+' · '+c.printing+' · '+c.finish;return o;}));selected=group.find(c=>c.key===key)||group[0];$('#case').value=selected.key;for(const b of document.querySelectorAll('[data-game]'))b.setAttribute('aria-pressed',String(b.dataset.game===game));render();}
for(const b of document.querySelectorAll('[data-game]'))b.addEventListener('click',()=>selectGame(b.dataset.game));
$('#case').addEventListener('change',()=>{selected=cases.find(c=>c.key===$('#case').value);render();});
$('#motion').addEventListener('click',()=>{setPlaying(!playing);$('#inputStatus').textContent=media.matches?'Reduced motion is on. Use the sliders for a still comparison.':playing?'Both cards share the same moving light.':'Light sweep paused.';});
for(const [id,axis] of [['lightX','x'],['lightY','y']])$('#'+id).addEventListener('input',e=>{setPlaying(false);updateLight(axis==='x'?+e.target.value:target.x,axis==='y'?+e.target.value:target.y);});
$('#reset').addEventListener('click',()=>{setPlaying(false);origin=null;$('#lightX').value=50;$('#lightY').value=50;updateLight(50,50);});
const orientation=e=>{if(!tiltOn||media.matches||document.hidden||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;if(!origin)origin={beta:e.beta,gamma:e.gamma};setPlaying(false);updateLight(50+(e.gamma-origin.gamma)*1.5,50+(e.beta-origin.beta)*1.5);$('#inputStatus').textContent='Phone tilt active. Center light recalibrates your holding angle.';};
$('#tilt').addEventListener('click',async()=>{
 if(tiltOn){tiltOn=false;window.removeEventListener('deviceorientation',orientation);$('#tilt').setAttribute('aria-pressed','false');$('#tilt').textContent='Enable phone tilt';$('#inputStatus').textContent='Phone tilt off.';return;}
 if(!globalThis.DeviceOrientationEvent){$('#inputStatus').textContent='Phone tilt is unavailable here. Use the light sliders.';return;}
 try{if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted'){$('#inputStatus').textContent='Tilt permission was not granted. The sliders still work.';return;}}catch{$('#inputStatus').textContent='Tilt could not start. The sliders still work.';return;}
 tiltOn=true;origin=null;window.addEventListener('deviceorientation',orientation,{passive:true});$('#tilt').setAttribute('aria-pressed','true');$('#tilt').textContent='Disable phone tilt';$('#inputStatus').textContent='Tilt enabled. Move your phone gently; sliders remain available.';
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){setPlaying(false);cancelAnimationFrame(frame);frame=0;}origin=null;});
media.addEventListener('change',()=>{if(media.matches){setPlaying(false);cancelAnimationFrame(frame);frame=0;light={...target};paint();}});
window.addEventListener('pagehide',()=>{window.removeEventListener('deviceorientation',orientation);cancelAnimationFrame(frame);});
$('#playBox').addEventListener('click',()=>{const open=$('#sampleBox').classList.toggle('open');$('#playBox').setAttribute('aria-pressed',String(open));$('#playBox').textContent=open?'Close sample box':'Play box opening';});
$('#openDeck').addEventListener('click',()=>{$('#sampleCards').hidden=false;$('#deckStatus').textContent='Sample cards are open.';});
function selectFromHash(){const initial=cases.find(c=>c.key===new URLSearchParams(location.hash.slice(1)).get('case'))||cases[0];selectGame(initial.game,initial.key);}
window.addEventListener('hashchange',selectFromHash);selectFromHash();
