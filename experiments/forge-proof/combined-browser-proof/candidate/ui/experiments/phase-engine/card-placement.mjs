// Placement is a gesture over a current offered command, never a rules engine.
export function placementIntent(snapshot,instanceId){
 const {status,busy,error,pending}=snapshot||{},v=status?.surface;
 if(!v||status.terminal||busy||pending||error&&error!=='CHOICE_REJECTED'||v.decision?.kind!=='Priority'||v.prioritySeat!==v.seat)return null;
 const card=v.cards?.find(c=>c.id===instanceId);
 if(!card?.known||card.zone!=='Hand'||card.controller!==v.seat||!v.hand?.includes(instanceId))return null;
 // General cards are offered through viewer interactions, not the legacy
 // Grizzly Bears-only choice list. Use the exact automatic-payment offer.
 const offers=[];
 if(v.interaction?.canSubmit)for(const o of v.interaction.opportunities||[]){
  if(o.type!=='choose')continue;
  for(const c of o.choices||[]){
   const objects=c.surfaces.filter(s=>s.type==='object');
   if(!c.available||objects.length!==1||objects[0].reference!==String(instanceId))continue;
   const action=c.surfaces.find(s=>s.type==='action')?.code;
   const cast=action==='castSpell'&&c.surfaces.some(s=>s.type==='value'&&s.role==='paymentMode'&&s.value==='auto');
   if(action!=='playLand'&&!cast)continue;
   offers.push({instanceId,revision:status.revision,token:JSON.stringify([o.interactionId,c.id]),interactionId:o.interactionId,choiceId:c.id,zone:cast?'stack':'battlefield',zones:cast?['stack','battlefield']:['battlefield'],label:cast?'Cast':'Play'});
  }
 }
 if(offers.length)return offers.length===1?offers[0]:null;
 const choices=(v.choices||[]).filter(c=>c.sourceId===instanceId&&['PlayLand','CastSpell'].includes(c.kind));
 // Different targets, faces or costs require the existing explicit controls.
 if(choices.length!==1)return null;
 const choice=choices[0];
 return {instanceId,revision:status.revision,token:choice.token,zone:choice.kind==='PlayLand'?'battlefield':'stack',zones:choice.kind==='PlayLand'?['battlefield']:['stack','battlefield'],label:choice.label};
}
export function submitPlacement(session,intent){
 const current=placementIntent(session.snapshot(),intent.instanceId);
 if(!current||current.revision!==intent.revision||current.token!==intent.token)throw Error('STALE_CHOICE');
 if(current.interactionId){session.select(current.interactionId,current.choiceId);return session.confirm();}
 return session.choose(current.token);
}
export function createPlacementGesture({read,onPreview=()=>{},onDrop=()=>{}}){
 let pending=null;
 const cancel=()=>{const active=pending?.active===true;pending=null;onPreview(null);return active;};
 const current=()=>{const n=pending&&placementIntent(read(),pending.instanceId);return n&&n.revision===pending.revision&&n.token===pending.token?n:null;};
 return {
  begin(instanceId,{pointerId,x,y}){cancel();const intent=placementIntent(read(),instanceId);if(!intent||![x,y].every(Number.isFinite))return false;pending={...intent,pointerId,x,y,active:false};return true;},
  move({pointerId,x,y}){if(!pending||pending.pointerId!==pointerId)return false;if(!current()||![x,y].every(Number.isFinite)){cancel();return false;}if(Math.hypot(x-pending.x,y-pending.y)>=8)pending.active=true;if(pending.active)onPreview({...pending,x,y});return pending.active;},
  end({pointerId,zone}){if(!pending||pending.pointerId!==pointerId)return false;const intent=current(),active=pending.active;cancel();if(active&&intent&&intent.zones.includes(zone))return onDrop(intent);return false;},
  reconcile(){if(pending&&!current())cancel();},cancel,
  active:()=>pending?.active===true
 };
}
export function bindCardPlacement(root,{session,onError=()=>{}}){
 const doc=root.ownerDocument,win=doc.defaultView;let ghost=null,suppressUntil=0;
 function preview(p){
  for(const n of root.querySelectorAll('[data-placement-zone]'))n.classList.toggle('play-placement-target',!!p&&p.zones.includes(n.dataset.placementZone));
  root.classList.toggle('play-placement-active',!!p);
  if(!p){ghost?.remove();ghost=null;return;}
  if(!ghost){const source=root.querySelector(`[data-instance="${p.instanceId}"]`);if(!source)return;ghost=source.cloneNode(true);ghost.removeAttribute('data-instance');ghost.removeAttribute('data-focus-key');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');ghost.classList.add('play-placement-ghost');ghost.style.width=source.getBoundingClientRect().width+'px';root.append(ghost);}
  ghost.style.left=p.x+'px';ghost.style.top=p.y+'px';
 }
 const gesture=createPlacementGesture({read:()=>session.snapshot(),onPreview:preview,onDrop:intent=>submitPlacement(session,intent)});
 const fail=e=>{if(!['MATCH_NOT_READY','STALE_CHOICE'].includes(e?.message))onError(e);};
 const down=e=>{if(e.isPrimary===false){gesture.cancel();return;}if(e.button!==0)return;const card=e.target.closest?.('[data-instance]');if(card&&root.contains(card))gesture.begin(Number(card.dataset.instance),{pointerId:e.pointerId,x:e.clientX,y:e.clientY});};
 const move=e=>{if(gesture.move({pointerId:e.pointerId,x:e.clientX,y:e.clientY})&&e.cancelable)e.preventDefault();};
 const up=e=>{const active=gesture.active();const target=doc.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-placement-zone]');if(active)suppressUntil=Date.now()+250;try{const result=gesture.end({pointerId:e.pointerId,zone:target&&root.contains(target)?target.dataset.placementZone:null});if(result?.catch)result.catch(fail);}catch(error){fail(error);}};
 const cancel=()=>{if(gesture.cancel())suppressUntil=Date.now()+250;};
 const click=e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}};
 const key=e=>{if(e.key==='Escape'&&gesture.active()){e.preventDefault();cancel();}};
 const nativeDrag=e=>{if(e.target.closest?.('[data-instance]'))e.preventDefault();};
 root.addEventListener('pointerdown',down);root.addEventListener('click',click,true);root.addEventListener('dragstart',nativeDrag);doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancel);doc.addEventListener('keydown',key);doc.addEventListener('visibilitychange',cancel);win.addEventListener('blur',cancel);
 return {reconcile:()=>gesture.reconcile(),cancel,destroy(){cancel();root.removeEventListener('pointerdown',down);root.removeEventListener('click',click,true);root.removeEventListener('dragstart',nativeDrag);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',cancel);doc.removeEventListener('keydown',key);doc.removeEventListener('visibilitychange',cancel);win.removeEventListener('blur',cancel);}};
}
