import {mountMatchTable} from '../phase-engine/match-table.mjs';
import {practiceArtworkHooks,resolvePracticeArtwork} from '../../play-card-surface.js';
import {practicePlayerPortrait} from '../../play-player-mat.js';
import {mountNativePanel} from './native-panel.mjs';
import {optionCardId} from './forge-session.mjs';
export function mountForgeTable(root,{session,onExit=()=>{},profile={displayName:'You'},format='Commander',title='CardStashy · Local Forge proof',presentation={}}){
 const doc=root.ownerDocument,win=doc.defaultView,hooks=practiceArtworkHooks();let localError='',panelKey='',drag=null,ghost=null,suppressUntil=0,closed=false,nativeValueDraft=null;
 const table=mountMatchTable(root,{session,format,profile,title,allowConcede:false,onExit,...hooks,
  resolveCard(card){const artwork=resolvePracticeArtwork(card);return {...artwork,oracleText:card.text};},
  renderOracleText(text){const el=doc.createElement('p');el.textContent=text;el.className='play-match-rules';return el;},
  decorateInspector(panel,card){hooks.decorateInspector(panel,card);panel.querySelector('a[href^="#wiki/"]')?.remove();if(card.type){const type=doc.createElement('p');type.className='forge-current-type';type.setAttribute('aria-label','Current native type');type.textContent=card.type;panel.append(type);}const note=doc.createElement('p');note.className='forge-art-note';note.textContent=card.printing?(presentation.hosted?'Catalogue artwork; exact per-instance printing may be unavailable. Current text, types and state come from Forge.':'Artwork is a public reference printing. Rules text and current state above come from Forge.'):'Native Forge text; artwork is not available for this card.';panel.append(note);},
  renderPlayerPortrait(own){return practicePlayerPortrait(doc,own,profile);},
  renderMatchBackdrop(){const box=doc.createElement('div');for(const c of session.snapshot().status?.surface.cards.filter(c=>c.commander)||[]){const url=resolvePracticeArtwork(c)?.artImageUrl;if(url){const img=doc.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';box.append(img);}}return box.childNodes.length?box:null;}
 });
 const fail=e=>{localError=e.message||String(e);panelKey='';enhance();};
 const act=fn=>{try{const p=fn();if(p?.catch)p.catch(fail);}catch(e){fail(e);}};
 function enhance(){
  if(closed)return;const snap=session.snapshot(),n=snap.native;if(!snap.status||!n)return;
  if(presentation.hosted){const exit=root.querySelector('[data-focus-key=exit-match]');if(exit&&exit.textContent!=='Return to Play setup')exit.textContent='Return to Play setup';}
  const footer=root.querySelector('.play-match-decisions');if(!footer)return;
  const key=JSON.stringify([n.revision,snap.busy,snap.nativeDraft,snap.transportError,snap.selected,localError]);
  if(key!==panelKey||!footer.querySelector('[data-native-panel]')){
   // Preserve local typed input/focus if an unrelated inspection redraws the board.
   const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null,oldInput=footer.querySelector('[data-native-key=native-value]'),oldValue=oldInput?.value,oldRevision=footer.querySelector('[data-native-panel]')?.dataset.nativeRevision;
   mountNativePanel(footer,{session,snapshot:snap,onLocalError:message=>fail(Error(message)),presentation});panelKey=key;
   if(localError){const e=doc.createElement('p');e.className='forge-diagnostic';e.textContent=localError;e.setAttribute('role','alert');footer.querySelector('[data-native-panel]')?.append(e);}
   if(nativeValueDraft?.revision===n.revision&&nativeValueDraft?.promptId===n.prompt?.id){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=nativeValueDraft.value;}else if(oldRevision===String(n.revision)&&oldValue!==undefined){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=oldValue;}
   if(focused)footer.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus();
  }
  const hinted=new Set([...(n.selection?.cards||[]),...(n.selection?.targets||[]),...(n.selection?.actionable||[])].filter(r=>r.kind==='card').map(r=>r.id)),chosen=new Set((n.selection?.chosen||[]).filter(r=>r.kind==='card').map(r=>r.id));
  for(const index of snap.nativeDraft?.indexes||[]){const o=n.prompt?.options.find(o=>o.index===index);const cardId=optionCardId(o?.value);if(cardId!==null)chosen.add(cardId);}
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const cardId=Number(el.dataset.instance);el.dataset.forgeHint=String(hinted.has(cardId));el.dataset.forgeChosen=String(chosen.has(cardId));el.setAttribute('aria-description','Click sends this card to Forge; legality is checked by Forge. Magnifier or I inspects without acting.');}
  for(const el of root.querySelectorAll('[data-player-seat]')){el.title='Click to send this player to Forge';const seat=Number(el.dataset.playerSeat),player=n.players.find(p=>p.id===snap.status.surface.players.find(p=>p.seat===seat)?.nativeId);let mana=el.querySelector('.forge-native-mana');const text=player?.mana?Object.entries(player.mana).map(([color,amount])=>`${color} ${amount}`).join(' · '):'';if(text&&!mana){mana=doc.createElement('div');mana.className='forge-native-mana';mana.setAttribute('aria-label','Native mana pool');el.querySelector('.play-match-player')?.append(mana);}if(mana&&mana.textContent!==text)mana.textContent=text;}

 }
 const saveInput=e=>{if(e.target.dataset?.nativeKey==='native-value'){const n=session.snapshot().native;nativeValueDraft={revision:n.revision,promptId:n.prompt?.id,value:e.target.value};}};
 root.addEventListener('input',saveInput);root.addEventListener('change',saveInput);
 const observer=new MutationObserver(()=>enhance());observer.observe(root,{childList:true,subtree:true});
 const unsub=session.subscribe(s=>{localError='';table.render(s);enhance();});
 const click=e=>{
  if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  const card=e.target.closest?.('.play-match-card[data-instance]');if(card&&root.contains(card)){e.preventDefault();e.stopImmediatePropagation();if(session.snapshot().busy)return;act(()=>session.nativeSelect('card',Number(card.dataset.instance)));return;}
  const player=e.target.closest?.('[data-player-seat]');if(player&&root.contains(player)){e.preventDefault();e.stopImmediatePropagation();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(player.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));}
 };
 const cancel=()=>{drag=null;ghost?.remove();ghost=null;root.classList.remove('forge-dragging');};
 const down=e=>{if(e.button!==0||e.isPrimary===false)return;const card=e.target.closest?.('.play-match-card[data-instance]'),s=session.snapshot();if(!card||s.busy||s.native?.prompt||s.status?.terminal)return;drag={id:Number(card.dataset.instance),revision:s.status.revision,pointerId:e.pointerId,x:e.clientX,y:e.clientY,source:card,active:false};};
 const move=e=>{if(!drag||drag.pointerId!==e.pointerId)return;if(drag.revision!==session.snapshot().status?.revision){cancel();return;}if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.active=true;if(!drag.active)return;if(e.cancelable)e.preventDefault();if(!ghost){ghost=drag.source.cloneNode(true);ghost.removeAttribute('data-instance');ghost.classList.add('forge-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');ghost.style.width=drag.source.getBoundingClientRect().width+'px';root.append(ghost);root.classList.add('forge-dragging');}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';};
 const up=e=>{if(!drag||drag.pointerId!==e.pointerId)return;const pending=drag,target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-placement-zone=battlefield],.forge-native-panel');if(pending.active)suppressUntil=Date.now()+300;cancel();if(pending.active&&target&&root.contains(target))act(()=>session.nativeSelect('card',pending.id,pending.revision));};
 const key=e=>{if(e.key==='Escape')cancel();};
 root.addEventListener('click',click,true);root.addEventListener('pointerdown',down);doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancel);doc.addEventListener('keydown',key);win.addEventListener('blur',cancel);
 return {destroy(){closed=true;unsub();observer.disconnect();cancel();table.destroy();root.removeEventListener('input',saveInput);root.removeEventListener('change',saveInput);root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',down);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',cancel);doc.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);}};
}
