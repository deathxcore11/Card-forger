// Explicit Practice setup only. The rules engine still owns shuffle, mulligans
// and format-specific first-turn behavior. No fabricated coin or die face.
export function resolvePracticePregame(choice,randomValues=bytes=>crypto.getRandomValues(bytes)){
 if(!['player','cpu','random'].includes(choice))throw Error('CHOOSE_STARTING_PLAYER');
 const bytes=new Uint32Array(2);if(randomValues(bytes)!==bytes)throw Error('PREGAME_RANDOM_UNAVAILABLE');
 return {seed:bytes[0],first:choice==='player'?0:choice==='cpu'?1:bytes[1]&1};
}
export function mountPracticePregame({root,readAccount,readSetup,onConfirm,onCancel,randomValues}={}){
 if(!root||typeof readAccount!=='function'||typeof readSetup!=='function'||typeof onConfirm!=='function'||typeof onCancel!=='function')throw Error('PREGAME_HOST_REQUIRED');
 const scope=()=>{const a=readAccount()||{},s=readSetup();if(!a.user?.id||a.locked||a.switching||s?.profile?.ownerId!==a.user.id||s.profile.signedIn!==true||!s.selected||!s.opponent||s.match?.mode!=='cpu')throw Error('PREGAME_SELECTION_CHANGED');return JSON.stringify([a.user.id,a.accountGeneration??a.generation??null,s.selected,s.opponent,s.match]);};
 const captured=scope(),setup=readSetup(),doc=root.ownerDocument;let stopped=false;
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;},form=el('form'),title=el('h1','Ready for Practice?'),details=el('p',setup.selected.name+' vs '+setup.opponent.name),group=el('label','Who goes first? '),select=el('select'),status=el('p'),actions=el('div'),begin=el('button','Begin Practice'),cancel=el('button','Return to setup');
 root.classList.add('play-mat-message');form.className='panel play-pregame';title.tabIndex=-1;select.setAttribute('aria-label','Who goes first?');for(const [value,label]of [['random','Choose randomly'],['player','You'],['cpu','CPU']]){const option=el('option',label);option.value=value;select.append(option);}group.append(select);status.setAttribute('role','status');begin.type='submit';cancel.type='button';begin.className='btn';cancel.className='btn ghost';actions.className='actions wrap';actions.append(begin,cancel);form.append(title,details,group,el('p','Review your opening hand next. You can keep it or take a mulligan.'),status,actions);root.replaceChildren(form);
 const cancelOnce=()=>{if(stopped)return;stopped=true;onCancel();};cancel.addEventListener('click',cancelOnce);form.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelOnce();}});
 form.addEventListener('submit',async event=>{event.preventDefault();if(stopped)return;
  try{if(scope()!==captured)throw Error('PREGAME_SELECTION_CHANGED');const options=resolvePracticePregame(select.value,randomValues);stopped=true;begin.disabled=cancel.disabled=select.disabled=true;await onConfirm(options);}
  catch(error){status.textContent=error.message==='PREGAME_SELECTION_CHANGED'?'Your account or deck selection changed. Return to setup and review both decks.':'Practice could not start. Return to setup and try again.';begin.disabled=true;cancel.disabled=false;select.disabled=true;stopped=false;}
 });
 queueMicrotask(()=>{if(form.isConnected&&!stopped)select.focus();});
 return {destroy(){stopped=true;form.remove();}};
}
