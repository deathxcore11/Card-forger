// Explicit Practice setup only. The rules engine still owns shuffle, mulligans
// and format-specific first-turn behavior. No fabricated coin or die face.
export function resolvePracticePregame(choice,randomValues=bytes=>crypto.getRandomValues(bytes)){
 if(!['player','cpu','random'].includes(choice))throw Error('CHOOSE_STARTING_PLAYER');
 const bytes=new Uint32Array(2);if(randomValues(bytes)!==bytes)throw Error('PREGAME_RANDOM_UNAVAILABLE');
 return {seed:bytes[0],first:choice==='player'?0:choice==='cpu'?1:bytes[1]&1};
}
export function mountPracticePregame({root,readAccount,readSetup,onConfirm,onCancel,randomValues,sessionOnly=true,renderDeckArtwork=()=>null}={}){
 if(!root||typeof readAccount!=='function'||typeof readSetup!=='function'||typeof onConfirm!=='function'||typeof onCancel!=='function')throw Error('PREGAME_HOST_REQUIRED');
 const scope=()=>{const a=readAccount()||{},s=readSetup();if(!a.user?.id||a.locked||a.switching||s?.profile?.ownerId!==a.user.id||s.profile.signedIn!==true||!s.selected||!s.opponent||s.match?.mode!=='cpu')throw Error('PREGAME_SELECTION_CHANGED');return JSON.stringify([a.user.id,a.accountGeneration??a.generation??null,s.selected,s.opponent,s.match,s.profile]);};
 const captured=scope(),setup=readSetup(),doc=root.ownerDocument;let phase='ready';
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;},form=el('form'),title=el('h1','Your matchup'),details=el('p',setup.selected.name+' vs '+setup.opponent.name),group=el('label','Who goes first? '),select=el('select'),status=el('p'),actions=el('div'),begin=el('button','Begin Practice'),cancel=el('button','Return to setup');
 root.classList.add('play-mat-message');form.className='panel play-pregame';
 const steps=el('p','Setup → Starting player → Opening hand');steps.className='play-journey-steps';
 const versus=el('div');versus.className='play-pregame-versus';
 for(const [deck,label]of [[setup.selected,'YOU'],[setup.opponent,'CPU']]){const seat=el('section');seat.className='play-pregame-seat';const art=renderDeckArtwork(deck);if(art)seat.append(art);seat.append(el('small',label),el('strong',deck.name),el('span',setup.match.format+' · '+setup.match.difficulty+' CPU'));versus.append(seat);}
 details.hidden=true;
title.tabIndex=-1;select.setAttribute('aria-label','Who goes first?');for(const [value,label]of [['random','Choose randomly'],['player','You'],['cpu','CPU']]){const option=el('option',label);option.value=value;select.append(option);}group.append(select);status.setAttribute('role','status');begin.type='submit';cancel.type='button';begin.className='btn';cancel.className='btn ghost';actions.className='actions wrap';actions.append(begin,cancel);form.append(steps,title,details,versus,group,el('p','Random chooses once when you begin. Your opening hand comes next.'),...(sessionOnly?[el('p','Keep this page open: refreshing or leaving ends the match; it cannot be resumed. In-game Exit asks before conceding. Limits: 30 seconds for a response, 90 seconds inactive and 5 minutes per turn.')]:[]),el('p','Review your opening hand next. You can keep it or take a mulligan.'),status,actions);root.replaceChildren(form);
 const cancelOnce=()=>{if(!['ready','failed'].includes(phase))return;phase='cancelled';begin.disabled=cancel.disabled=select.disabled=true;onCancel();};cancel.addEventListener('click',cancelOnce);form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelOnce();}});
 form.addEventListener('submit',async event=>{event.preventDefault();if(phase!=='ready')return;
  try{if(scope()!==captured)throw Error('PREGAME_SELECTION_CHANGED');const options=resolvePracticePregame(select.value,randomValues);phase='starting';begin.disabled=cancel.disabled=select.disabled=true;await onConfirm(options);if(phase==='starting')phase='started';}
  catch(error){if(phase==='destroyed')return;phase='failed';status.textContent=error.message==='PREGAME_SELECTION_CHANGED'?'Your account or deck selection changed. Return to setup and review both decks.':'Practice could not start. Return to setup and review both decks before trying again.';begin.disabled=true;cancel.disabled=false;select.disabled=true;}
 });
 queueMicrotask(()=>{if(form.isConnected&&phase==='ready')select.focus();});
 return {destroy(){phase='destroyed';form.remove();}};
}
