// DOM presentation for a private, engine-backed research match. No card rules.
import {cardStatView} from './card-stats.mjs';
const labels={MulliganDecision:'Opening hand',Priority:'Priority',DeclareAttackers:'Declare attackers',DeclareBlockers:'Declare blockers',GameOver:'Match finished'};
const actionNames={tapLandForMana:'Tap for mana',cancelCast:'Cancel casting',passPriority:'Pass priority',castSpell:'Cast spell',activateAbility:'Activate ability',mulliganDecision:'Opening hand'};
const actionText=(c,kind)=>c.surfaces.map(s=>s.type==='player'?`Player ${s.seat+1}`:s.type==='action'?(kind==='ManaPayment'&&s.code==='passPriority'?'Pay selected mana':actionNames[s.code]||s.code.replace(/([a-z])([A-Z])/g,'$1 $2')):s.type==='value'&&s.role==='abilityIndex'?`Ability ${Number(s.value)+1}`:s.type==='value'&&s.role==='paymentMode'?(s.value==='manual'?'Manual mana':'Automatic mana'):s.name||s.value||'').filter(Boolean).join(' · ')||'Choose';
export function mountMatchTable(root,{session,profile={displayName:'You'},resolveCard=()=>null,decorateCard=()=>{},decorateInspector=()=>{},renderOracleText=null,renderMatchContext=()=>null,allowConcede=false,title='CardStashy · Private rules test',mountEffects=()=>()=>{},onExit=()=>{}}){
 const disposeEffects=mountEffects(root),cardNodes=new Map();let inspectorContent=null;let menu=null,exitOpen=false,advancedOpen=false,lastRevision=-1;const log=[];let lastRenderKey=null;
 function updateClock(clock){const out=root.querySelector('[aria-label="Response time"]');if(out){out.textContent=clock?.remainingSeconds!==null&&clock?.remainingSeconds!==undefined?`${clock.remainingSeconds}s to respond`:clock?.needsChoice?'Your choice is required':'';out.className=clock?.warning?'play-match-warning':'';}}
 function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
 function button(text,action,{disabled=false,key,pressed,blockWhileBusy=false}={}){const b=element('button',text);b.type='button';b.disabled=disabled;if(key)b.dataset.focusKey=key;if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));const failed=e=>{if(['MATCH_NOT_READY','STALE_CHOICE','CHOICE_INCOMPLETE'].includes(e.message)){render(session.snapshot());return;}queueMicrotask(()=>{throw e;});};b.addEventListener('click',()=>{if(blockWhileBusy&&session.snapshot().busy)return;try{const result=action();if(result?.catch)result.catch(failed);}catch(e){failed(e);}});return b;}
 const creatureState=c=>[c.tapped?'Tapped':'',c.power!==null&&c.power!==undefined?`${c.power}/${c.toughness}`:'',c.damage?`${c.damage} damage`:'',...Object.entries(c.counters||{}).map(([k,v])=>`${v} ${k}`)].filter(Boolean).join(' · ');
 const identity=c=>JSON.stringify([c.known,c.name,c.face,c.isToken,c.displaySource,c.tokenImageRef,c.printing||null]);
 function renderStats(c){const box=element('span',undefined,'play-match-state'),v=cardStatView(c);if(!v)return box;
  if(v.token)box.append(element('span','Token','play-state-chip'));if(v.emblem)box.append(element('span','Emblem','play-state-chip'));
  if(v.power!==null&&v.toughness!==null){const line=element('span',undefined,'play-current-stats');line.setAttribute('aria-label',`Current power ${v.power}, toughness ${v.toughness}`);line.append(element('b',String(v.power),'play-stat-'+v.powerTone),element('span','/'),element('b',String(v.toughness),'play-stat-'+v.toughnessTone));box.append(line);if(v.basePower!==null&&v.baseToughness!==null)box.append(element('small',`Base ${v.basePower}/${v.baseToughness}`,'play-stat-base'));}
  if(v.tapped)box.append(element('span','Tapped','play-state-chip'));
  if(v.damage)box.append(element('span',`${v.damage} damage`,'play-state-chip play-marked-damage'));
  for(const counter of v.counters)box.append(element('span',`${counter.count} × ${counter.label}`,'play-state-chip play-counter play-stat-'+counter.tone));
  return box;
 }
 function inspect(id){menu=null;session.inspect(id);}
 function cardNode(c,selected,used){
  const id=c.id,key=identity(c);used.add(id);let cached=cardNodes.get(id);
  if(!cached||cached.key!==key){
   const b=button(c.known?c.name:'Face down',()=>inspect(id),{key:`card-${id}`});b.className='play-match-card';b.dataset.instance=String(id);
   if(c.known){const data=resolveCard(c);if(data?.imageUrl){const img=element('img');img.src=data.imageUrl;img.alt='';img.loading='lazy';b.prepend(img);}}
   const state=element('span',undefined,'play-match-state-slot');b.append(state);if(c.known)decorateCard(b,c);
   const openMenu=e=>{e.preventDefault();session.inspect(id);menu=id;render(session.snapshot());root.querySelector('[role="menu"] button')?.focus();};
   b.addEventListener('contextmenu',openMenu);b.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')openMenu(e);});cached={key,node:b,state};cardNodes.set(id,cached);
  }
  cached.node.setAttribute('aria-pressed',String(id===selected));const text=JSON.stringify(cardStatView(c));if(cached.statKey!==text){cached.state.replaceChildren(renderStats(c));cached.statKey=text;}return cached.node;
 }
 function render(snapshot){
  const {status,selected,pending,busy,error,clock}=snapshot;
  const renderKey=JSON.stringify([status?.revision,status?.surface,selected,pending,busy,error,menu,exitOpen,advancedOpen]);
  if(renderKey===lastRenderKey){updateClock(clock);return;}lastRenderKey=renderKey;
  const focused=root.contains(document.activeElement)?document.activeElement.dataset.focusKey:null;
  const disclosures=[...root.querySelectorAll('details[data-keep-open]')].map(n=>[n.dataset.keepOpen,n.open]);
  const scrolls=[...root.querySelectorAll('[data-keep-scroll]')].map(n=>[n.dataset.keepScroll,n.scrollTop]);
  root.replaceChildren();root.className='play-match-table';
  if(!status){root.append(element('p',error?'Match recovery is required.':'Opening match…'));return;}
  const view=status.surface,cardById=new Map(view.cards.map(c=>[c.id,c]));
  if(status.revision!==lastRevision){log.push(`Turn ${view.turn} · ${labels[view.decision.kind]||view.decision.kind}`);lastRevision=status.revision;}
  const header=element('header',undefined,'play-match-header');
  header.append(element('strong',title),element('span',`Turn ${view.turn} · ${view.phase||''}`),button(allowConcede?(status.terminal?'Return to Play':'Exit match'):'Close research table',()=>{if(!allowConcede||status.terminal)return onExit();exitOpen=true;render(session.snapshot());},{key:'exit-match'}));root.append(header);
  const main=element('div',undefined,'play-match-main'),table=element('div',undefined,'play-match-mat'),rail=element('aside',undefined,'play-match-inspector');
  table.dataset.keepScroll='table';rail.dataset.keepScroll='inspector';
  const usedCardIds=new Set();
  const card=c=>cardNode(c,selected,usedCardIds);
  function zone(title,cards){const section=element('section',undefined,'play-match-zone');section.append(element('h2',title));const row=element('div',undefined,'play-match-card-row');for(const c of cards)row.append(card(c));if(!cards.length)row.append(element('p','Empty','muted'));section.append(row);return section;}
  const opponent=view.players.find(p=>p.seat!==view.seat),you=view.players.find(p=>p.seat===view.seat);
  table.append(element('div',`CPU · ${opponent.life} life · ${opponent.handCount} cards · ${opponent.libraryCount} in library`,'play-match-seat'));
  table.append(zone('CPU battlefield',view.cards.filter(c=>c.zone==='Battlefield'&&c.controller!==view.seat)));
  table.append(zone('Your battlefield',view.cards.filter(c=>c.zone==='Battlefield'&&c.controller===view.seat)));
  table.append(element('div',`${profile.displayName}${profile.username?' · @'+profile.username:''} · ${you.life} life · ${you.libraryCount} in library`,'play-match-seat'));
  table.append(zone('Your hand',view.hand.map(id=>cardById.get(id)).filter(Boolean)));
  const stack=element('section');stack.append(element('h2',`Stack · ${view.stack.length}`));for(const entry of view.stack)stack.append(element('p',cardById.get(entry.source)?.name||'Ability or spell'));rail.append(stack);
  const matchContext=renderMatchContext();if(matchContext)rail.append(matchContext);
  const history=element('details');history.dataset.keepOpen='game-progress';history.append(element('summary','Game progress'));const entries=element('ol');for(const row of log.slice(-20))entries.append(element('li',row));history.append(entries);rail.append(history);
  const selectedCard=cardById.get(selected)?.known?cardById.get(selected):null,inspectPanel=element('section');inspectPanel.append(element('h2',selectedCard?.name||'Inspect a card'));
  if(selectedCard){const data=resolveCard(selectedCard),key=selectedCard.id+':'+identity(selectedCard);if(!inspectorContent||inspectorContent.key!==key){let art=null,oracle=null;if(data?.imageUrl){art=element('figure');const img=element('img');img.src=data.imageUrl;img.alt=selectedCard.name;art.append(img);decorateCard(art,selectedCard);}if(data?.oracleText)oracle=renderOracleText?renderOracleText(data.oracleText,selectedCard):element('p',data.oracleText);inspectorContent={key,art,oracle};}if(inspectorContent.art)inspectPanel.append(inspectorContent.art);inspectPanel.append(renderStats(selectedCard),element('p',(selectedCard.keywords||[]).join(' · ')));if(inspectorContent.oracle)inspectPanel.append(inspectorContent.oracle);decorateInspector(inspectPanel,selectedCard);}else inspectorContent=null;
  if(selectedCard?.zone==='Hand'&&selectedCard.controller===view.seat&&!selectedCard.types?.includes('Land')&&view.decision.kind==='Priority'&&view.prioritySeat===view.seat){for(const payment of ['auto','manual'])inspectPanel.append(button(payment==='auto'?'Cast · automatic mana':'Cast · manual mana',()=>session.cast(selectedCard.id,payment),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:`cast-${payment}-${selectedCard.id}`}));}
  if(!selectedCard)inspectPanel.append(element('p','Click a visible card to pin its details here.'));rail.append(inspectPanel);
  if(menu!==null){const pop=element('div',undefined,'play-match-context');pop.setAttribute('role','menu');pop.append(button('Inspect card',()=>{menu=null;render(session.snapshot());},{key:'menu-inspect'}));for(const c of view.choices.filter(c=>c.sourceId===menu))pop.append(button(c.label,()=>session.choose(c.token),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED'}));pop.append(button('Close menu',()=>{menu=null;render(session.snapshot());root.querySelector(`[data-instance="${selected}"]`)?.focus();},{key:'menu-close'}));rail.append(pop);}
  main.append(table,rail);root.append(main);
  const footer=element('footer',undefined,'play-match-decisions');footer.setAttribute('aria-label','Match decisions');footer.dataset.keepScroll='decisions';
  const decisionTitle=element('strong',status.terminal?'Match finished':labels[view.decision.kind]||'Choose an action');footer.append(decisionTitle);
  const timer=element('output',clock?.remainingSeconds!==null&&clock?.remainingSeconds!==undefined?`${clock.remainingSeconds}s to respond`:clock?.needsChoice?'Your choice is required':'');timer.className=clock?.warning?'play-match-warning':'';timer.setAttribute('aria-label','Response time');footer.append(timer);
  if(error)footer.append(element('p',error==='CHOICE_REJECTED'?'That choice was rejected. Review your selection.':'Match paused. Reload and recover the saved match before continuing.','play-match-error'));
  if(status.terminal)footer.append(element('p',status.terminal.winner===null?'Draw':status.terminal.winner===view.seat?'You won':'CPU won'));
  const controls=element('div',undefined,'play-match-actions');
  if(!status.terminal){
   for(const choice of view.choices)controls.append(button(choice.label,()=>session.choose(choice.token),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:choice.token}));
   let interactionControls=controls;
   if(view.canAct&&view.interaction?.opportunities?.length){const more=element('details',undefined,'play-match-other-actions');more.open=advancedOpen;const summary=element('summary','Abilities & other actions');summary.dataset.focusKey='other-actions-summary';more.append(summary);more.addEventListener('toggle',()=>{advancedOpen=more.open;});controls.append(more);interactionControls=more;}
   for(const o of view.interaction?.opportunities||[]){
    if(o.type==='number'){
     const group=element('fieldset');group.append(element('legend',`Choose a number · ${o.min}–${o.max}`));
     const input=element('input');input.type='number';input.min=String(o.min);input.max=String(o.max);input.step='1';input.setAttribute('aria-label','Chosen number');input.dataset.focusKey=`number-${o.interactionId}`;
     const blocked=busy||!!error&&error!=='CHOICE_REJECTED';input.disabled=blocked;
     input.value=pending?.interactionId===o.interactionId?String(pending.value):'';
     const confirm=button('Confirm number',()=>{session.setNumber(o.interactionId,input.valueAsNumber);return session.confirm();},{blockWhileBusy:true,disabled:blocked||input.value==='',key:`confirm-${o.interactionId}`});
     // Keep typing local so a render cannot steal the caret. Never default to zero.
     input.addEventListener('input',()=>{const n=input.valueAsNumber;confirm.disabled=blocked||input.value===''||!Number.isInteger(n)||n<o.min||n>o.max;});
     group.append(input,confirm);interactionControls.append(group);continue;
    }
    const group=element('fieldset');group.append(element('legend',o.type!=='choose'?`${o.type==='sequence'?'Choose in order':'Select'} ${o.min===o.max?o.min:o.min+'–'+o.max}`:'Choose one'));
    for(const c of o.choices)group.append(button(actionText(c,view.decision.kind),()=>session.select(o.interactionId,c.id),{key:c.id,blockWhileBusy:true,disabled:busy||!c.available||!!error&&error!=='CHOICE_REJECTED',pressed:pending?.interactionId===o.interactionId&&pending.choiceIds.includes(c.id)}));
    if(o.type==='sequence'&&pending?.interactionId===o.interactionId)group.append(element('p','Order: '+pending.choiceIds.map(id=>actionText(o.choices.find(c=>c.id===id))).join(' → ')));
    const count=pending?.interactionId===o.interactionId?pending.choiceIds.length:0;
    group.append(button('Confirm choice',()=>session.confirm(),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED'||count<o.min||count>o.max||pending?.interactionId!==o.interactionId,key:`confirm-${o.interactionId}`}));
    if(o.min===0)group.append(button('Select none',()=>session.selectNone(o.interactionId),{blockWhileBusy:true,disabled:busy,key:`none-${o.interactionId}`}));
    group.append(button('Clear selection',()=>session.clearSelection(),{blockWhileBusy:true,disabled:busy,key:`clear-${o.interactionId}`}));interactionControls.append(group);
   }
   if(view.awaitingHuman&&!view.canAct&&!view.interaction?.canSubmit)controls.append(element('p','This decision is not available in the research controls yet. The game remains saved.'));
   else if(!view.canAct&&!view.interaction?.canSubmit)controls.append(element('p',busy?'CPU is choosing…':'Waiting for the next decision.'));
  }
  footer.append(controls);root.append(footer);for(const id of cardNodes.keys())if(!usedCardIds.has(id))cardNodes.delete(id);
  if(exitOpen){const dialog=element('dialog',undefined,'play-match-exit');dialog.setAttribute('aria-labelledby','practiceExitTitle');dialog.append(element('h2','Concede this Practice match?'));dialog.firstChild.id='practiceExitTitle';dialog.append(element('p','Confirming records one loss. Keeping the table open changes nothing.'));dialog.append(button('Keep playing',()=>{exitOpen=false;render(session.snapshot());root.querySelector('[data-focus-key="exit-match"]')?.focus();},{key:'cancel-exit'}));dialog.append(button('Concede and return',async()=>{await session.concede();const s=session.snapshot();if(s.status?.terminal){exitOpen=false;onExit();}},{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:'confirm-exit'}));dialog.addEventListener('cancel',e=>{e.preventDefault();exitOpen=false;render(session.snapshot());root.querySelector('[data-focus-key="exit-match"]')?.focus();});root.append(dialog);queueMicrotask(()=>{if(dialog.isConnected){dialog.showModal();dialog.querySelector('button')?.focus();}});}
  for(const [key,open]of disclosures){const n=[...root.querySelectorAll('details[data-keep-open]')].find(n=>n.dataset.keepOpen===key);if(n)n.open=open;}
  for(const [key,top]of scrolls){const n=[...root.querySelectorAll('[data-keep-scroll]')].find(n=>n.dataset.keepScroll===key);if(n)n.scrollTop=top;}
  if(focused)root.querySelectorAll('[data-focus-key]').forEach(n=>{if(n.dataset.focusKey===focused&&!n.disabled)n.focus({preventScroll:true});});
 }
 const keydown=e=>{if(e.key==='Escape'&&menu!==null){e.preventDefault();menu=null;render(session.snapshot());root.querySelector(`[data-instance="${session.snapshot().selected}"]`)?.focus();}};
 root.addEventListener('keydown',keydown);
 return {render,destroy(){disposeEffects();cardNodes.clear();inspectorContent=null;root.removeEventListener('keydown',keydown);root.replaceChildren();}};
}
