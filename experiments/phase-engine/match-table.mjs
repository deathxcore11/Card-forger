// DOM presentation for a private, engine-backed research match. No card rules.
const labels={MulliganDecision:'Opening hand',Priority:'Priority',DeclareAttackers:'Declare attackers',DeclareBlockers:'Declare blockers',GameOver:'Match finished'};
const actionText=c=>c.surfaces.map(s=>s.name||s.value||s.code||'').filter(Boolean).join(' · ')||'Choose';
export function mountMatchTable(root,{session,profile={displayName:'You'},resolveCard=()=>null,onExit=()=>{}}){
 let menu=null,lastRevision=-1;const log=[];let lastRenderKey=null;
 function updateClock(clock){const out=root.querySelector('[aria-label="Response time"]');if(out){out.textContent=clock?.remainingSeconds!==null&&clock?.remainingSeconds!==undefined?`${clock.remainingSeconds}s to respond`:clock?.needsChoice?'Your choice is required':'';out.className=clock?.warning?'play-match-warning':'';}}
 function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
 function button(text,action,{disabled=false,key,pressed}={}){const b=element('button',text);b.type='button';b.disabled=disabled;if(key)b.dataset.focusKey=key;if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));b.addEventListener('click',action);return b;}
 function render(snapshot){
  const {status,selected,pending,busy,error,clock}=snapshot;
  const renderKey=JSON.stringify([status?.revision,status?.surface,selected,pending,busy,error,menu]);
  if(renderKey===lastRenderKey){updateClock(clock);return;}lastRenderKey=renderKey;
  const focused=root.contains(document.activeElement)?document.activeElement.dataset.focusKey:null;
  const scrolls=[...root.querySelectorAll('[data-keep-scroll]')].map(n=>[n.dataset.keepScroll,n.scrollTop]);
  root.replaceChildren();root.className='play-match-table';
  if(!status){root.append(element('p',error?'Match recovery is required.':'Opening match…'));return;}
  const view=status.surface,cardById=new Map(view.cards.map(c=>[c.id,c]));
  if(status.revision!==lastRevision){log.push(`Turn ${view.turn} · ${labels[view.decision.kind]||view.decision.kind}`);lastRevision=status.revision;}
  const header=element('header',undefined,'play-match-header');
  header.append(element('strong','CardStashy · Private rules test'),element('span',`Turn ${view.turn} · ${view.phase||''}`),button('Close research table',onExit));root.append(header);
  const main=element('div',undefined,'play-match-main'),table=element('div',undefined,'play-match-mat'),rail=element('aside',undefined,'play-match-inspector');
  table.dataset.keepScroll='table';rail.dataset.keepScroll='inspector';
  const creatureState=c=>[c.tapped?'Tapped':'',c.power!==null&&c.power!==undefined?`${c.power}/${c.toughness}`:'',c.damage?`${c.damage} damage`:'',...Object.entries(c.counters||{}).map(([k,v])=>`${v} ${k}`)].filter(Boolean).join(' · ');
  function inspect(id){menu=null;session.inspect(id);}
  function card(c){
   const b=button(c.known?c.name:'Face down',()=>inspect(c.id),{key:`card-${c.id}`,pressed:c.id===selected});b.className='play-match-card';b.dataset.instance=String(c.id);
   if(c.known){const data=resolveCard(c);if(data?.imageUrl){const img=element('img');img.src=data.imageUrl;img.alt='';img.loading='lazy';b.prepend(img);}}
   const state=element('small',creatureState(c));b.append(state);
   const openMenu=e=>{e.preventDefault();session.inspect(c.id);menu=c.id;render(session.snapshot());root.querySelector('[role="menu"] button')?.focus();};
   b.addEventListener('contextmenu',openMenu);b.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')openMenu(e);});return b;
  }
  function zone(title,cards){const section=element('section',undefined,'play-match-zone');section.append(element('h2',title));const row=element('div',undefined,'play-match-card-row');for(const c of cards)row.append(card(c));if(!cards.length)row.append(element('p','Empty','muted'));section.append(row);return section;}
  const opponent=view.players.find(p=>p.seat!==view.seat),you=view.players.find(p=>p.seat===view.seat);
  table.append(element('div',`CPU · ${opponent.life} life · ${opponent.handCount} cards · ${opponent.libraryCount} in library`,'play-match-seat'));
  table.append(zone('CPU battlefield',view.cards.filter(c=>c.zone==='Battlefield'&&c.controller!==view.seat)));
  table.append(zone('Your battlefield',view.cards.filter(c=>c.zone==='Battlefield'&&c.controller===view.seat)));
  table.append(element('div',`${profile.displayName}${profile.username?' · @'+profile.username:''} · ${you.life} life · ${you.libraryCount} in library`,'play-match-seat'));
  table.append(zone('Your hand',view.hand.map(id=>cardById.get(id)).filter(Boolean)));
  const stack=element('section');stack.append(element('h2',`Stack · ${view.stack.length}`));for(const entry of view.stack)stack.append(element('p',cardById.get(entry.source)?.name||'Ability or spell'));rail.append(stack);
  const history=element('details');history.append(element('summary','Game progress'));const entries=element('ol');for(const row of log.slice(-20))entries.append(element('li',row));history.append(entries);rail.append(history);
  const selectedCard=cardById.get(selected),inspectPanel=element('section');inspectPanel.append(element('h2',selectedCard?.name||'Inspect a card'));
  if(selectedCard){const data=resolveCard(selectedCard);if(data?.imageUrl){const img=element('img');img.src=data.imageUrl;img.alt=selectedCard.name;inspectPanel.append(img);}inspectPanel.append(element('p',creatureState(selectedCard)),element('p',(selectedCard.keywords||[]).join(' · ')));if(data?.oracleText)inspectPanel.append(element('p',data.oracleText));}
  else inspectPanel.append(element('p','Click a visible card to pin its details here.'));rail.append(inspectPanel);
  if(menu!==null){const pop=element('div',undefined,'play-match-context');pop.setAttribute('role','menu');pop.append(button('Inspect card',()=>{menu=null;render(session.snapshot());},{key:'menu-inspect'}));for(const c of view.choices.filter(c=>c.sourceId===menu))pop.append(button(c.label,()=>session.choose(c.token),{disabled:busy||!!error&&error!=='CHOICE_REJECTED'}));pop.append(button('Close menu',()=>{menu=null;render(session.snapshot());root.querySelector(`[data-instance="${selected}"]`)?.focus();},{key:'menu-close'}));rail.append(pop);}
  main.append(table,rail);root.append(main);
  const footer=element('footer',undefined,'play-match-decisions');footer.setAttribute('aria-label','Match decisions');footer.dataset.keepScroll='decisions';
  const title=element('strong',status.terminal?'Match finished':labels[view.decision.kind]||'Choose an action');footer.append(title);
  const timer=element('output',clock?.remainingSeconds!==null&&clock?.remainingSeconds!==undefined?`${clock.remainingSeconds}s to respond`:clock?.needsChoice?'Your choice is required':'');timer.className=clock?.warning?'play-match-warning':'';timer.setAttribute('aria-label','Response time');footer.append(timer);
  if(error)footer.append(element('p',error==='CHOICE_REJECTED'?'That choice was rejected. Review your selection.':'Match paused. Reload and recover the saved match before continuing.','play-match-error'));
  if(status.terminal)footer.append(element('p',status.terminal.winner===null?'Draw':status.terminal.winner===view.seat?'You won':'CPU won'));
  const controls=element('div',undefined,'play-match-actions');
  if(!status.terminal){
   for(const choice of view.choices)controls.append(button(choice.label,()=>session.choose(choice.token),{disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:choice.token}));
   for(const o of (view.canAct?[]:view.interaction?.opportunities)||[]){
    const group=element('fieldset');group.append(element('legend',o.type==='select'?`Select ${o.min===o.max?o.min:o.min+'–'+o.max}`:'Choose one'));
    for(const c of o.choices)group.append(button(actionText(c),()=>session.select(o.interactionId,c.id),{key:c.id,disabled:busy||!c.available||!!error&&error!=='CHOICE_REJECTED',pressed:pending?.interactionId===o.interactionId&&pending.choiceIds.includes(c.id)}));
    const count=pending?.interactionId===o.interactionId?pending.choiceIds.length:0;
    group.append(button('Confirm choice',()=>session.confirm(),{disabled:busy||!!error&&error!=='CHOICE_REJECTED'||count<o.min||count>o.max||!pending,key:`confirm-${o.interactionId}`}));
    group.append(button('Clear selection',()=>session.clearSelection(),{disabled:busy,key:`clear-${o.interactionId}`}));controls.append(group);
   }
   if(view.awaitingHuman&&!view.canAct&&!view.interaction?.canSubmit)controls.append(element('p','This decision is not available in the research controls yet. The game remains saved.'));
   else if(!view.canAct&&!view.interaction?.canSubmit)controls.append(element('p',busy?'CPU is choosing…':'Waiting for the next decision.'));
  }
  footer.append(controls);root.append(footer);
  for(const [key,top]of scrolls){const n=[...root.querySelectorAll('[data-keep-scroll]')].find(n=>n.dataset.keepScroll===key);if(n)n.scrollTop=top;}
  if(focused)root.querySelectorAll('[data-focus-key]').forEach(n=>{if(n.dataset.focusKey===focused&&!n.disabled)n.focus({preventScroll:true});});
 }
 const keydown=e=>{if(e.key==='Escape'&&menu!==null){e.preventDefault();menu=null;render(session.snapshot());root.querySelector(`[data-instance="${session.snapshot().selected}"]`)?.focus();}};
 root.addEventListener('keydown',keydown);
 return {render,destroy(){root.removeEventListener('keydown',keydown);root.replaceChildren();}};
}
