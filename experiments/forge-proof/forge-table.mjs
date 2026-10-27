import {mountMatchTable} from '../phase-engine/match-table.mjs';
import {practiceArtworkHooks,resolvePracticeArtwork} from '../../play-card-surface.js';
import {practicePlayerPortrait} from '../../play-player-mat.js';
import {mountNativePanel} from './native-panel.mjs';
import {optionCardId} from './forge-session.mjs';
import {drawnArtwork,frameTone,surfaceColors} from '../../play-token-art.js';
import {sym,symbolName} from '../../ui.js';
// Outline icons from the CardStashy UI packet (24-unit grid, currentColor).
const ZONE_ICONS={Library:'M6 3h14v16H6zM3 6v16h14M10 7h6M10 11h6',Graveyard:'M6 20V9a6 6 0 0 1 12 0v11M3 20h18M9 10h6M12 7v7',Exile:'m12 2 10 10-10 10L2 12zM8 12h14M17 7l5 5-5 5',Command:'M3 6l5 5 4-8 4 8 5-5-2 14H5zM5 16h14'};
const outlineIcon=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const MANA_ORDER=['W','U','B','R','G','C'];
export function mountForgeTable(root,{session,onExit=()=>{},profile={displayName:'You'},format='Commander',title='CardStashy · Local Forge proof',presentation={}}){
 const doc=root.ownerDocument,win=doc.defaultView,hooks=practiceArtworkHooks();let localError='',panelKey='',drag=null,ghost=null,suppressUntil=0,closed=false,nativeValueDraft=null,openingFocused=false;
 const reducedMotion=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const table=mountMatchTable(root,{session,format,profile,title,allowConcede:false,onExit,pileIdentical:presentation.hosted===true,...hooks,
  resolveCard(card){const artwork=resolvePracticeArtwork(card);return {...artwork,oracleText:card.text};},
  // Frame every piece in its own colors; tokens and cards without a printing get a drawn crest instead of an empty tile.
  decorateCard(node,card){hooks.decorateCard(node,card);const name=String(card.name);if(Math.max(...name.split(/\s+/).map(word=>word.length))>=10)node.dataset.nameLength='word';else if(name.length>13)node.dataset.nameLength='long';const colors=surfaceColors(card,resolvePracticeArtwork(card)?.card),tone=frameTone(colors);if(tone){node.dataset.colors=tone.key;node.style.setProperty('--frame-a',tone.a);node.style.setProperty('--frame-b',tone.b);}if(card.isToken)node.dataset.token='true';const blank=node.querySelector('.play-match-card-back');if(blank){const art=drawnArtwork(doc,card,colors);if(node.dataset.presentation!=='battlefield')art.classList.add('play-drawn-full');blank.replaceWith(art);}},
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
  const ids=list=>new Set((list||[]).filter(r=>r.kind==='card').map(r=>r.id));
  const actionable=ids(n.selection?.actionable),targets=ids(n.selection?.targets),choices=ids(n.selection?.cards),chosen=ids(n.selection?.chosen);
  for(const index of snap.nativeDraft?.indexes||[]){const o=n.prompt?.options.find(o=>o.index===index);const cardId=optionCardId(o?.value);if(cardId!==null)chosen.add(cardId);}
  // Forge's own hint lists, shown by meaning: something you can play or use now,
  // a target for the spell or ability being cast, a card this prompt asks about,
  // and what you have already picked. Forge still validates every click.
  const discarding=!n.prompt&&choices.size>0&&/\bdiscard\b/i.test(String(n.message||''));
  const role=id=>chosen.has(id)?'chosen':targets.has(id)?'target':choices.has(id)?(discarding?'discard':'choice'):actionable.has(id)?'playable':'';
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const cardId=Number(el.dataset.instance),r=role(cardId);el.dataset.forgeHint=String(actionable.has(cardId)||targets.has(cardId)||choices.has(cardId));el.dataset.forgeChosen=String(chosen.has(cardId));if(el.dataset.forgeRole!==r)el.dataset.forgeRole=r;el.setAttribute('aria-description',presentation.hosted?'Click to play or select this card. Drag it up onto the table to play. Use the magnifier or press I to inspect.':'Click sends this card to Forge; legality is checked by Forge. Magnifier or I inspects without acting.');}
  const surface=snap.status.surface,nativePlayer=seat=>n.players.find(p=>p.id===surface.players.find(p=>p.seat===seat)?.nativeId);
  // Floating mana is the native pool only, never untapped lands or potential production.
  const manaEntries=player=>Object.entries(player?.mana||{}).map(([color,amount])=>[String(color).toUpperCase(),Number(amount)||0]);
  const manaLabel=entries=>{const live=entries.filter(([,a])=>a>0);return live.length?'Floating mana: '+live.map(([c,a])=>`${a} ${MANA_ORDER.includes(c)?symbolName(c).toLowerCase():c}`).join(', '):'No floating mana';};
  const playerTargets=new Set((n.selection?.targets||[]).filter(r=>r.kind==='player').map(r=>r.id)),playerChosen=new Set((n.selection?.chosen||[]).filter(r=>r.kind==='player').map(r=>r.id));
  for(const el of root.querySelectorAll('[data-player-seat]')){el.title=presentation.hosted?'Select this player as a target when prompted':'Click to send this player to Forge';const seat=Number(el.dataset.playerSeat),player=nativePlayer(seat);
   const seatRole=!player?'':playerChosen.has(player.id)?'chosen':playerTargets.has(player.id)?'target':'';if(presentation.hosted&&(el.dataset.forgeRole||'')!==seatRole)el.dataset.forgeRole=seatRole;let mana=el.querySelector('.forge-native-mana');const entries=manaEntries(player),live=entries.filter(([,a])=>a>0);
   if(!presentation.hosted){const text=player?.mana?Object.entries(player.mana).map(([color,amount])=>`${color} ${amount}`).join(' · '):'';if(text&&!mana){mana=doc.createElement('div');mana.className='forge-native-mana';mana.setAttribute('aria-label','Native mana pool');el.querySelector('.play-match-player')?.append(mana);}if(mana&&mana.textContent!==text)mana.textContent=text;continue;}
   // Seats show only colors actually floating; the full pool lives in the dock.
   const key=live.map(([c,a])=>c+a).join(',');if(live.length&&!mana){mana=doc.createElement('div');mana.className='forge-native-mana';el.querySelector('.play-match-player')?.append(mana);}
   if(mana&&mana.dataset.pool!==key){mana.dataset.pool=key;mana.setAttribute('aria-label',manaLabel(entries));mana.hidden=!live.length;mana.innerHTML=live.map(([c,a])=>`<span class="forge-mana-chip">${MANA_ORDER.includes(c)?sym(c):c}<b>${a}</b></span>`).join('');}
  }
  if(presentation.hosted){
   const mat=root.querySelector('.play-match-mat');
   // Each player's public zone counts sit beside their portrait; a count opens that list in the Zones menu.
   for(const p of surface.players){
    const own=p.seat===surface.seat,count=zone=>surface.cards.filter(c=>c.zone===zone&&c.owner===p.seat).length;
    const counts=[['Library',p.libraryCount],['Graveyard',count('Graveyard')],['Exile',count('Exile')],['Command',count('Command')]],key=counts.map(c=>c[1]).join(',');
    let row=mat?.querySelector(`.forge-zone-row[data-seat="${own?'you':'cpu'}"]`);
    if(mat&&!row){row=doc.createElement('nav');row.className='forge-zone-row';row.dataset.seat=own?'you':'cpu';row.setAttribute('aria-label',own?'Your zones':'CPU zones');mat.append(row);}
    if(row&&row.dataset.counts!==key){row.dataset.counts=key;row.replaceChildren(...counts.map(([zone,value])=>{const b=doc.createElement('button');b.type='button';b.dataset.zone=zone;b.setAttribute('aria-label',`${own?'Your':'CPU'} ${zone.toLowerCase()}: ${value}`);b.innerHTML=`${outlineIcon(ZONE_ICONS[zone])}<span>${zone}</span><b>${value}</b>`;return b;}));}
   }
   // The CPU has no profile picture; its commander's art becomes its portrait.
   const cpuBadge=root.querySelector('.play-match-seat[data-seat=cpu] .play-match-profile-badge');
   const cpuCommander=surface.cards.find(c=>c.zone==='Command'&&c.owner!==surface.seat&&c.known),cpuArt=cpuCommander?resolvePracticeArtwork(cpuCommander)?.artImageUrl:null;
   if(cpuBadge&&cpuArt&&cpuBadge.dataset.portrait!==cpuArt){cpuBadge.dataset.portrait=cpuArt;let img=cpuBadge.querySelector('img.forge-seat-portrait');if(!img){img=doc.createElement('img');img.className='forge-seat-portrait';img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{img.hidden=true;};cpuBadge.append(img);}img.src=cpuArt;}
   // The turn-change notice gets its banner art: whose turn large, the turn number small.
   const banner=root.querySelector('.play-match-turn-banner');
   if(banner&&!banner.dataset.owner){const [who,...rest]=banner.textContent.split(' · ');banner.dataset.owner=who==='Your turn'?'you':'cpu';const big=doc.createElement('strong'),small=doc.createElement('span');big.textContent=who;small.textContent=rest.join(' · ');banner.replaceChildren(big,small);}
   // Your floating mana: all six colors, zeros dimmed, above the decision panel.
   const dock=root.querySelector('.play-match-decisions'),mine=manaEntries(nativePlayer(surface.seat)),poolKey=mine.map(([c,a])=>c+a).join(',');
   let pool=dock?.querySelector('.forge-mana-panel');
   if(dock&&!pool){pool=doc.createElement('section');pool.className='forge-mana-panel';dock.prepend(pool);}
   if(pool&&pool.dataset.pool!==poolKey){pool.dataset.pool=poolKey;pool.setAttribute('aria-label',manaLabel(mine));const amount=c=>mine.find(([k])=>k===c)?.[1]||0;pool.innerHTML=`<h3 aria-hidden="true">Floating mana</h3><div aria-hidden="true">${MANA_ORDER.map(c=>`<span data-zero="${amount(c)===0}">${sym(c)}<b>${amount(c)}</b></span>`).join('')}</div>`;}
   // Each battlefield sizes its pieces so its creature row and its row of other
   // permanents both fit across: widths in piece units plus fixed gaps in pixels.
   for(const zone of root.querySelectorAll('.play-match-battlefields .play-match-zone')){
    const rows={c:[0,0],o:[0,0]};let otherLanes=0;
    for(const lane of zone.querySelectorAll('.play-match-lane')){const creature=lane.dataset.cardGroup==='creatures',row=creature?rows.c:rows.o,w=creature?1.18:.98;if(!creature&&otherLanes++)row[1]+=22;let first=true;
     for(const wrap of lane.querySelectorAll('.play-match-card-wrap')){const pile=wrap.dataset.pileIndex&&wrap.dataset.pileIndex!=='0';if(pile)row[0]+=w-(wrap.dataset.pileTight==='true'?(creature?1.12:.92):(creature?.94:.76));else{row[0]+=w;if(!first)row[1]+=16;}first=false;}}
    const fit=`${Math.max(1,rows.c[0]).toFixed(2)},${rows.c[1]},${Math.max(1,rows.o[0]).toFixed(2)},${rows.o[1]}`;
    if(zone.dataset.fit!==fit){zone.dataset.fit=fit;const [cu,cg,ou,og]=fit.split(',');zone.style.setProperty('--fit-cu',cu);zone.style.setProperty('--fit-cg',cg+'px');zone.style.setProperty('--fit-ou',ou);zone.style.setProperty('--fit-og',og+'px');}
   }
   // A gentle arc: cards further from the middle of the hand sit a little lower.
   // The count lets the hand tighten its spacing only when it would not fit.
   const hand=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')],handRow=root.querySelector('.play-match-hand .play-match-card-row');if(handRow&&handRow.style.getPropertyValue('--hand-count')!==String(hand.length))handRow.style.setProperty('--hand-count',String(hand.length));hand.forEach((w,i)=>{const lift=Math.abs(i-(hand.length-1)/2);const v=`${Math.round(lift*lift*2.2)}px`;if(w.style.getPropertyValue('--arc-drop')!==v)w.style.setProperty('--arc-drop',v);});
  }

 }
 const saveInput=e=>{if(e.target.dataset?.nativeKey==='native-value'){const n=session.snapshot().native;nativeValueDraft={revision:n.revision,promptId:n.prompt?.id,value:e.target.value};}};
 root.addEventListener('input',saveInput);root.addEventListener('change',saveInput);
 const observer=new MutationObserver(()=>enhance());observer.observe(root,{childList:true,subtree:true});
 // Cards keep their engine identity between renders, so a card that moves (hand to
 // battlefield, a lane change) glides from where it was to where Forge put it, and a
 // permanent that appears from nowhere fades in. Purely visual; placement is Forge's.
 const positions=()=>{const m=new Map();for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const w=el.closest('.play-match-card-wrap')||el,r=w.getBoundingClientRect();if(r.width)m.set(el.dataset.instance,{r,hand:!!el.closest('.play-match-hand'),battlefield:el.dataset.presentation==='battlefield'});}return m;};
 const glide=before=>{
  if(!before.size||reducedMotion())return;let moved=0;
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){
   const w=el.closest('.play-match-card-wrap')||el,prev=before.get(el.dataset.instance),r=w.getBoundingClientRect();if(!r.width||moved>24)continue;
   if(prev){const dx=prev.r.left-r.left,dy=prev.r.top-r.top;if(Math.hypot(dx,dy)<6)continue;const s=Math.max(.4,Math.min(2.2,prev.r.width/r.width));moved++;w.animate([{transform:`translate(${dx}px,${dy}px) scale(${s})`,zIndex:50},{transform:'none',zIndex:50}],{duration:prev.hand&&el.dataset.presentation==='battlefield'?520:380,easing:'cubic-bezier(.2,.8,.2,1)'});}
   else if(el.dataset.presentation==='battlefield'){moved++;w.animate([{opacity:0,transform:'translateY(-14px) scale(.86)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});}
  }
 };
 const unsub=session.subscribe(s=>{
  const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null;
  const before=presentation.hosted?positions():null;
  localError='';table.render(s);enhance();if(before)glide(before);
  if(focused)root.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  else if(presentation.hosted&&!openingFocused&&s.native?.inputType==='InputConfirmMulligan'){
   openingFocused=true;root.querySelector('[data-native-key=decision-title]')?.focus({preventScroll:true});
  }
 });
 const click=e=>{
  if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  const card=e.target.closest?.('.play-match-card[data-instance]');if(card&&root.contains(card)){e.preventDefault();e.stopImmediatePropagation();const snapshot=session.snapshot();if(snapshot.busy)return;const cardId=Number(card.dataset.instance);if(snapshot.native?.inputType==='InputConfirmMulligan'&&!snapshot.native.prompt)act(()=>session.inspect(cardId));else act(()=>session.nativeSelect('card',cardId));return;}
  const player=e.target.closest?.('[data-player-seat]');if(player&&root.contains(player)){e.preventDefault();e.stopImmediatePropagation();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(player.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));return;}
  const zone=e.target.closest?.('.forge-zone-row button[data-zone]');if(zone&&root.contains(zone)){openZone(zone.closest('.forge-zone-row').dataset.seat,zone.dataset.zone);}
 };
 // Opens the existing Zones menu at that player's list; nothing new is revealed.
 function openZone(seat,zone){
  const menu=root.querySelector('.play-match-zones-menu');if(!menu)return;menu.open=true;
  const heading=[...menu.querySelectorAll('h3')].find(h=>h.textContent.startsWith(seat==='you'?'Your':'CPU'));
  for(let el=heading?.nextElementSibling;el&&el.tagName!=='H3';el=el.nextElementSibling)if(el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent.startsWith(zone==='Command'?'Command zone':zone)){el.open=true;el.querySelector('summary')?.focus();return;}
  menu.querySelector('summary')?.focus();
 }
 const cancel=()=>{drag=null;ghost?.remove();ghost=null;root.classList.remove('forge-dragging');};
 const down=e=>{if(e.button!==0||e.isPrimary===false)return;const card=e.target.closest?.('.play-match-card[data-instance]'),s=session.snapshot();if(!card||s.busy||s.native?.prompt||s.native?.inputType==='InputConfirmMulligan'||s.status?.terminal)return;drag={id:Number(card.dataset.instance),revision:s.status.revision,pointerId:e.pointerId,x:e.clientX,y:e.clientY,source:card,active:false};};
 const move=e=>{if(!drag||drag.pointerId!==e.pointerId)return;if(drag.revision!==session.snapshot().status?.revision){cancel();return;}if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.active=true;if(!drag.active)return;if(e.cancelable)e.preventDefault();if(!ghost){ghost=drag.source.cloneNode(true);ghost.removeAttribute('data-instance');ghost.classList.add('forge-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');ghost.style.width=drag.source.getBoundingClientRect().width+'px';root.append(ghost);root.classList.add('forge-dragging');}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';};
 // Like Arena, a card dragged out of your hand plays when released anywhere above
 // the hand; Forge decides where it goes. Other drags keep their drop targets.
 const up=e=>{if(!drag||drag.pointerId!==e.pointerId)return;const pending=drag,target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-placement-zone=battlefield],.forge-native-panel'),handTop=root.querySelector('.play-match-hand-area')?.getBoundingClientRect().top,fromHand=!!pending.source.closest('.play-match-hand'),aboveHand=presentation.hosted&&fromHand&&handTop!==undefined&&e.clientY<handTop;if(pending.active)suppressUntil=Date.now()+300;cancel();if(pending.active&&(target&&root.contains(target)||aboveHand))act(()=>session.nativeSelect('card',pending.id,pending.revision));};
 const key=e=>{if(e.key==='Escape')cancel();};
 root.addEventListener('click',click,true);root.addEventListener('pointerdown',down);doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancel);doc.addEventListener('keydown',key);win.addEventListener('blur',cancel);
 return {destroy(){closed=true;unsub();observer.disconnect();cancel();table.destroy();root.removeEventListener('input',saveInput);root.removeEventListener('change',saveInput);root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',down);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',cancel);doc.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);}};
}
