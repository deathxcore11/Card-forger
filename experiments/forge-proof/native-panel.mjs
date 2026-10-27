import {optionLabel,optionCardId} from './forge-session.mjs';
const OPTION_METHODS=new Set(['getChoices','getAbilityToPlay','chooseSingleEntityForEffect','chooseEntitiesForEffect','showOptionDialog','order']);
export const isDescribedOption=value=>typeof value==='string'||typeof value==='number'||typeof value==='boolean'||!!(value&&value.hidden!==true&&value.card?.hidden!==true&&(value.name||value.description||value.text));
// Player-facing names for Forge's generic OK/Cancel/Auto buttons. Presentation only:
// the same native button operation is sent, and unfamiliar labels stay verbatim.
const NEXT_STEP={UPKEEP:'Next: Draw',DRAW:'Next: Main phase',MAIN1:'Next: Combat',COMBAT_BEGIN:'Next: Attackers',COMBAT_DECLARE_ATTACKERS:'Next: Blockers',COMBAT_DECLARE_BLOCKERS:'Next: Damage',COMBAT_FIRST_STRIKE_DAMAGE:'Next: Damage',COMBAT_DAMAGE:'Next: End of combat',COMBAT_END:'Next: Second main',MAIN2:'Next: End step',END_OF_TURN:'Next: Cleanup'};
export function nativeActionLabel(n,op,raw){
 const label=String(raw??'').trim();
 if(!/^(ok|auto|cancel|end turn)$/i.test(label))return label;
 const mine=n?.players?.find(p=>p.id===n.viewer)?.zones?.Battlefield?.cards||[],count=key=>mine.filter(c=>c?.[key]===true).length,input=String(n?.inputType||'');
 if(input==='InputPassPriority'){
  if(op==='cancel')return /^end turn$/i.test(label)?'End turn':label;
  if(n.stack?.length)return 'Pass · let it resolve';
  return n.activePlayer===n.viewer?NEXT_STEP[n.phase]||'Pass priority':'Pass';
 }
 if(input==='InputAttack'&&op==='ok'){const k=count('attacking');return k?`Attack with ${k}`:'No attacks';}
 if(input==='InputBlock'&&op==='ok'){const k=count('blocking');return k?`Confirm ${k} block${k===1?'':'s'}`:'No blocks';}
 if(input.startsWith('InputPayMana')&&op==='ok'&&/^auto$/i.test(label))return 'Pay automatically';
 if(input==='InputSelectTargets'&&op==='ok')return 'Confirm targets';
 return label;
}
export function mountNativePanel(container,{session,snapshot,onLocalError=()=>{},presentation={}}){
 const doc=container.ownerDocument,s=snapshot,n=s.native;if(!n)return;
 const copy=(player,proof)=>presentation.hosted?player:proof;
 const phaseNames={UNTAP:'Untap',UPKEEP:'Upkeep',DRAW:'Draw',MAIN1:'Main phase',COMBAT_BEGIN:'Beginning of combat',COMBAT_DECLARE_ATTACKERS:'Choose attackers',COMBAT_DECLARE_BLOCKERS:'Choose blockers',COMBAT_FIRST_STRIKE_DAMAGE:'First strike damage',COMBAT_DAMAGE:'Combat damage',COMBAT_END:'End of combat',MAIN2:'Second main phase',END_OF_TURN:'End step',CLEANUP:'Cleanup'};
 const node=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const run=fn=>()=>{try{const out=fn();if(out?.catch)out.catch(e=>onLocalError(e.message));}catch(e){onLocalError(e.message);}};
 const button=(label,fn,disabled=false,key='')=>{const b=node('button',label);b.type='button';b.disabled=s.busy||disabled;if(key)b.dataset.nativeKey=key;b.addEventListener('click',run(fn));return b;};
 const panel=node('section',undefined,'forge-native-panel');panel.dataset.nativePanel='true';panel.dataset.nativeRevision=String(n.revision);panel.setAttribute('aria-label',copy('Your match decision','Native Forge decision'));
 if(!presentation.hosted)panel.append(node('small',`${presentation.label||'LOCAL FORGE PROOF'} · revision ${n.revision}`,'forge-proof-label'));
 const deckLabel=alias=>({'keen-engineering':'Keen Engineering','reign-of-dragons':'Reign of Dragons','calling-all-angels':'Calling All Angels'}[alias]||alias);
 const context=node('div',undefined,'forge-native-context'),nativeMessage=n.prompt?.message||n.message||'Waiting for Forge';
 // Compact only the known passive status format. Any actual instruction or
 // unfamiliar native message remains verbatim and immediately visible.
 const statusLines=!n.prompt&&n.inputType==='InputPassPriority'&&typeof n.message==='string'?n.message.match(/^Priority: ([^\n]+)\nTurn: (\d+ \([^\n]+\))\nPhase: ([^\n]+)\nStack: ([^\n]+)$/):null;
 const compactStatus=!!statusLines&&!n.failure&&n.status!=='finished';panel.dataset.compactStatus=String(compactStatus);
 const yourTurn=n.activePlayer===n.viewer,opening=n.inputType==='InputConfirmMulligan',payment=String(n.inputType||'').startsWith('InputPayMana');
 const waitLabel=s.transportError?'Match update needs attention':n.busy===true?'Resolving game actions…':'Waiting for the table…';
 const lines=String(nativeMessage).split('\n').map(line=>line.trim()).filter(Boolean),selectionTitle={InputAttack:'Choose attackers',InputBlock:'Choose blockers',InputSelectTargets:'Choose targets'}[n.inputType];
 // Cleanup discard arrives as a card selection with no prompt; name it plainly.
 const discard=presentation.hosted&&!n.prompt&&n.selection?.cards?.length>0&&/\bdiscard\b/i.test(String(n.message||'')),discardCount=Number.isSafeInteger(n.selection?.max)&&n.selection.max>0?n.selection.max:1;
 // Engine bookkeeping between decisions is a status, not an instruction to the player.
 const passive=!compactStatus&&!n.prompt&&!opening&&!payment&&!n.failure&&n.status!=='finished'&&(n.busy===true||n.inputType==='InputLockUI'||/^Priority: /.test(lines[0]||''));
 const playerTitle=compactStatus?`${yourTurn?'Your turn':'CPU turn'} · ${s.busy||s.transportError?waitLabel:n.priorityPlayer===n.viewer?(yourTurn?'You can act':'Your response'):'Waiting for CPU response'}`:opening?'Your opening hand':payment?'Pay mana':passive?`${yourTurn?'Your turn':'CPU turn'} · ${s.transportError?waitLabel:yourTurn?'Resolving…':'CPU is playing'}`:discard?`Choose ${discardCount} card${discardCount===1?'':'s'} to discard`:selectionTitle||lines[0]||waitLabel;
 const playerDetail=compactStatus||passive||discard?[]:opening||payment?[nativeMessage]:selectionTitle?lines:lines.slice(1);
 const title=node('h2',presentation.hosted?playerTitle:compactStatus?(n.priorityPlayer===n.viewer?'Your priority':`Priority: ${statusLines[1]}`):nativeMessage);
 // The table shows whose turn it is large and who may act on its own line; the
 // heading's text (and what a screen reader hears) is unchanged.
 if(presentation.hosted&&playerTitle.includes(' · ')){const [turn,...rest]=playerTitle.split(' · ');title.replaceChildren(node('span',turn),node('span',' · ','forge-native-sep'),node('span',rest.join(' · '),'forge-native-response'));}
 title.tabIndex=-1;title.dataset.nativeKey='decision-title';context.setAttribute('aria-live','polite');context.setAttribute('aria-atomic','true');context.append(title);
 if(compactStatus||presentation.hosted&&!opening&&Number.isSafeInteger(n.turn)&&n.turn>0){const status=node('div',undefined,'forge-native-status');status.setAttribute('aria-label','Turn, phase and stack');const stack=n.stack?.length?`${n.stack.length} item${n.stack.length===1?'':'s'}`:'Empty';for(const [label,text]of [['Turn',presentation.hosted?String(n.turn):statusLines[2]],['Phase',presentation.hosted?(phaseNames[n.phase]||statusLines?.[3]||n.phase||'—'):statusLines[3]],['Stack',presentation.hosted?stack:statusLines[4]]]){const value=node('span',`${label}: ${text}`);status.append(value);}context.append(status);}
 if(presentation.hosted)for(const line of playerDetail)context.append(node('p',line));
 panel.append(context);
 if(n.failure){panel.append(node('p',`Forge stopped: ${n.failure}`,'forge-diagnostic'));container.replaceChildren(panel);return;}
 if(n.status==='finished'){panel.append(node('p',n.draw===true?'Forge result: draw':n.winner?`Forge result: ${n.winner}`:'Forge reports that the game has finished.'));container.replaceChildren(panel);return;}
 if(presentation.allowControlMode===true&&['smart','full'].includes(n.controlMode)){
  const group=node('div',undefined,'forge-native-mode');group.setAttribute('role','group');group.setAttribute('aria-label',copy('Response controls','Native response mode'));
  for(const [value,label]of [['smart','Smart'],['full','Full Control']]){const b=button(label,()=>session.setControlMode(value),!!n.prompt||n.inputType==='InputLockUI',`mode-${value}`);b.setAttribute('aria-pressed',String(n.controlMode===value));group.append(b);}
  group.title=n.controlMode==='smart'?'Automatic mana and passing empty response windows. Targets and required choices remain yours.':'Choose each response and mana payment yourself.';panel.append(group);
 }
 if(n.notification?.message){const notice=node('p',`${n.notification.title||n.notification.method||'Forge'}: ${n.notification.message}`,'forge-diagnostic');notice.setAttribute('role','status');panel.append(notice);}
 if(n.lastActionError)panel.append(node('p',`Native action diagnostic: ${n.lastActionError}`,'forge-diagnostic'));
 if(s.transportError){const error=node('p',`Connection/action diagnostic: ${s.transportError}`,'forge-diagnostic');error.setAttribute('role','alert');panel.append(error,button('Refresh state (does not replay action)',()=>session.refresh(),false,'refresh'));}
 if(presentation.hosted&&passive&&!yourTurn&&!s.transportError)panel.append(node('p','Nothing to answer right now. The game moves on by itself.','forge-native-help'));
 else if(s.busy)panel.append(node('p',copy(waitLabel,'Waiting for Forge to resolve…'),'forge-native-wait'));
 else if(presentation.hosted&&compactStatus&&n.controlMode==='smart'&&yourTurn)panel.append(node('p','Click or drag a card to play it. Mana is paid automatically; tap lands first to choose your mana.','forge-native-help'));
 if(presentation.hosted&&payment&&!s.busy)panel.append(node('p','Tap your mana sources, or use the offered payment button. Full Control keeps payment in your hands.','forge-native-help'));
 const p=n.prompt;
 if(p){
  if(p.supported!==true||p.method==='order'&&p.ordered!==true){panel.append(node('p','This native prompt is not yet adapted. No response has been invented or sent.','forge-diagnostic'));}
  else if(['confirm','showConfirmDialog'].includes(p.method)){
   const options=p.options||[];panel.append(button(optionLabel(options[0]?.value??'Confirm'),()=>session.replyValue(true),false,'reply-true'),button(optionLabel(options[1]?.value??'Decline'),()=>session.replyValue(false),false,'reply-false'));
  }else if(p.method==='showInputDialog'){
   const form=node('form'),label=node('label','Value requested by Forge');let input;
   if(p.options?.length){input=node('select');input.append(node('option','Select an offered value'));input.firstChild.value='';for(const o of p.options){const option=node('option',optionLabel(o.value));option.value=String(o.value);input.append(option);}}
   else{input=node('input');input.type=p.numeric?'number':'text';input.maxLength=200;input.autocomplete='off';if(p.numeric)input.step='1';}
   input.required=true;input.disabled=s.busy;input.dataset.nativeKey='native-value';input.setAttribute('aria-label',p.message||'Forge input');label.append(input);form.append(label);
   const submit=node('button',copy('Confirm','Submit native value'));submit.type='submit';submit.disabled=s.busy;submit.dataset.nativeKey='submit-value';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())run(()=>session.replyValue(input.value))();});panel.append(form);
  }else if(p.acknowledgeOnly===true&&p.method==='getChoices'){
   const revealed=node('ul');for(const option of p.options||[])revealed.append(node('li',optionLabel(option.value)));panel.append(revealed,button(copy('Continue','Acknowledge native reveal'),()=>session.confirmPrompt(),false,'acknowledge-prompt'));
  }else if(OPTION_METHODS.has(p.method)){
   const indexes=s.nativeDraft?.revision===n.revision&&s.nativeDraft?.promptId===p.id?s.nativeDraft.indexes:[],options=p.options||[];
   panel.append(node('p',p.method==='order'?`Choose the destination order. Leave ${p.remainingMin===p.remainingMax?p.remainingMin:p.remainingMin+'–'+p.remainingMax} in the source.`:`Choose ${p.min===p.max?p.min:`${p.min}–${p.max}`} ${presentation.hosted?'':'native '}option${p.max===1?'':'s'}.`));
   const list=node('div',undefined,'forge-native-options');
   for(const o of options.filter(o=>p.method!=='order'||!indexes.includes(o.index))){const described=isDescribedOption(o.value),b=button(optionLabel(o.value),()=>session.selectPrompt(o.index),!described,`option-${o.index}`);b.setAttribute('aria-pressed',String(indexes.includes(o.index)));b.dataset.optionIndex=String(o.index);const cardId=optionCardId(o.value);if(cardId!==null)b.dataset.optionCard=String(cardId);if(!described)b.title='Native option details are unavailable; refusing an arbitrary reply.';list.append(b);}
   if(p.method==='order')panel.append(node('strong',`Source · ${options.length-indexes.length}`));panel.append(list);
   if(options.some(o=>!isDescribedOption(o.value)))panel.append(node('p','Some native options have no safe presentation. Those options remain disabled.','forge-diagnostic'));
   if(p.method==='order'&&indexes.length){panel.append(node('strong',p.topLabel||'Destination order'));const order=node('ol');order.setAttribute('aria-label','Native selected order');for(const [at,index]of indexes.entries()){const row=node('li',optionLabel(options.find(o=>o.index===index)?.value));row.append(button('↑',()=>session.reorderPrompt(index,-1),at===0,`earlier-${index}`),button('↓',()=>session.reorderPrompt(index,1),at===indexes.length-1,`later-${index}`),button('Remove',()=>session.selectPrompt(index),false,`remove-${index}`));order.append(row);}panel.append(order);}
   if(p.method==='order'&&p.rememberAllowed===true){const rememberLabel=node('label','Remember this order'),remember=node('input');remember.type='checkbox';remember.checked=s.nativeDraft?.remember===true;remember.disabled=s.busy;remember.dataset.nativeKey='remember-order';remember.addEventListener('change',run(()=>session.rememberPrompt(remember.checked)));rememberLabel.prepend(remember);panel.append(rememberLabel);}
   const summary=node('p',indexes.length?`Selected: ${indexes.map(index=>optionLabel(options.find(o=>o.index===index)?.value)).join(' · ')}`:'Nothing selected');summary.className='forge-native-draft';panel.append(summary);
   panel.append(button(indexes.length===0&&p.min===0?(p.cancelable?copy('Cancel','Cancel native dialog'):copy('Choose none','Submit no selections')):copy('Confirm choice','Confirm native choice'),()=>session.confirmPrompt(),indexes.length<p.min||indexes.length>p.max,'confirm-prompt'),button(copy('Clear selection','Clear draft'),()=>session.clearPrompt(),false,'clear-prompt'));
  }else panel.append(node('p',`Unsupported native dialog: ${p.method}. No reply sent.`,'forge-diagnostic'));
 }else{
  const buttons=n.buttons||{},actions=node('div',undefined,'forge-native-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label',copy('Match actions','Native actions'));
  for(const op of ['ok','cancel'])if(buttons[op]!==undefined){
   const label=presentation.hosted?nativeActionLabel(n,op,buttons[op]):String(buttons[op]||op),enabled=buttons[op+'Enabled']===true;
   // An unavailable Cancel/End turn is noise in the dock; an unavailable confirmation still shows what is pending.
   if(presentation.hosted&&!enabled&&(op==='cancel'||!label))continue;
   actions.append(button(label||op,()=>session.nativeButton(op,n.revision),!enabled,op));
  }
  if(actions.childNodes.length)panel.append(actions);
  const refs=[...(n.selection?.cards||[]),...(n.selection?.targets||[]),...(n.selection?.actionable||[])],unique=new Map(refs.map(r=>[r.kind+':'+r.id,r]));
  if(unique.size){const selection=node('details',undefined,'forge-native-hints'),summary=node('summary',`${presentation.hosted?'Highlighted choices':'Native selection guidance'} · ${unique.size}`);selection.append(summary,node('p',copy('You can select these cards or players here, or directly on the table.','These are Forge’s UI hints, not a complete legal-action list. The engine validates each click.')));
   for(const r of unique.values()){const c=s.status.surface.cards.find(c=>c.id===r.id),player=n.players.find(p=>p.id===r.id),stack=n.stack.find(x=>x.id===r.id);const label=r.kind==='card'?(c?.known?c.name:c?'Face-down card':null):r.kind==='player'?player?.name:r.kind==='stack'?stack?.text:null;if(label)selection.append(button(label,()=>session.nativeSelect(r.kind,r.id,n.revision),false,`ref-${r.kind}-${r.id}`));}panel.append(selection);}
  if(n.stack?.length){const stack=node('details');stack.append(node('summary',`${presentation.hosted?'Stack':'Native stack'} · ${n.stack.length}`));for(const item of n.stack)stack.append(button(item.text||`Stack item ${item.id}`,()=>session.nativeSelect('stack',item.id,n.revision),false,`stack-${item.id}`));panel.append(stack);}
  const selected=s.status.surface.cards.find(c=>c.id===s.selected);if(selected)panel.append(button(copy(`Select ${selected.known?selected.name:'card'}`,`Send ${selected.known?selected.name:'card'} click to Forge`),()=>session.nativeSelect('card',selected.id,n.revision),false,'click-inspected'));
 }
 const details=node('details',undefined,'forge-native-diagnostics'),table=container.closest('.play-match-table'),detailsSummary=node('summary',presentation.hosted?'Match details':'Proof details');detailsSummary.dataset.nativeKey='native-details';details.dataset.keepOpen='native-details';details.open=table?.dataset.forgeDetailsOpen==='true';details.addEventListener('toggle',()=>{if(table)table.dataset.forgeDetailsOpen=String(details.open);});details.append(detailsSummary);
 if(n.players.every(p=>p.deckAlias))details.append(node('p',n.players.map(p=>`${p.isViewer?'You':'Forge AI'}: ${deckLabel(p.deckAlias)}`).join(' vs ')));
 if(presentation.policyLabel)details.append(node('p',presentation.policyLabel));
 if(['smart','full'].includes(n.controlMode))details.append(node('p',n.controlMode==='smart'?'Native Smart assistance is active; required choices remain yours.':'Native Full Control is active; respond and pay through Forge prompts.'));
 if(compactStatus)details.append(node('p',n.message));
 if(p)details.append(node('p',`Native dialog: ${p.method} · ${p.id}`));
 details.append(node('p',copy('Click a card to play or select it, or drag it up onto the table. Use the magnifier or press I to read its rules. Smart handles ordinary mana payment and empty response windows; Full Control lets you handle them yourself.','Click a card to send its native ID to Forge. Use its magnifier or I key to inspect. Drag a card onto your battlefield or this panel to send the same click. Player and stack choices use their native IDs. Unsupported dialogs stop visibly. Nothing here interprets card rules.')),node('p',`Native revision ${n.revision} · Engine input: ${n.inputType||'none'} · phase ${n.phase||'none'} · selected ${(n.selection?.chosen||[]).map(r=>r.kind+' '+r.id).join(', ')||'none'}`),node('p',presentation.hosted?'Keep this page open during your match. Refreshing or closing the page ends this session. Use the match menu to concede.':'Temporary proof only — not the production Play backend. No automatic passing, auto-win, hidden-state policy, account changes, or reconnect guarantee.'));panel.append(details);
 container.replaceChildren(panel);
}
