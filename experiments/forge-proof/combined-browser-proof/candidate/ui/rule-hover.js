// Lightweight previews reuse curated rule definitions; no fetch or generated rules.
export function ruleHoverPosition(rect, size, viewport, pointer){
 const gap=12,pad=8,width=Math.min(size.width,Math.max(0,viewport.width-pad*2));
 const x=pointer?.x??rect.left,y=Math.max(rect.bottom,pointer?.y??rect.bottom);
 const below=y+gap,above=Math.min(rect.top,pointer?.y??rect.top)-size.height-gap;
 return {left:Math.max(pad,Math.min(x,viewport.width-width-pad)),top:Math.max(pad,Math.min(below+size.height<=viewport.height-pad?below:above,viewport.height-size.height-pad))};
}
export function installRuleHover(root,resolve){
 const win=root.defaultView;if(!win)return ()=>{};
 let tip=null,anchor=null,timer=null,keyboard=false,keyboardTip=false;
 const selector='[data-act="ruleHint"][data-game][data-rule]';
 const fine=()=>win.matchMedia?.('(any-hover: hover) and (any-pointer: fine)').matches;
 const button=target=>target?.closest?.(selector);
 const clearTimer=()=>{win.clearTimeout(timer);timer=null;};
 const close=()=>{clearTimer();if(anchor){const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='rule-hover-tip');if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');}tip?.remove();tip=null;anchor=null;keyboardTip=false;};
 const position=pointer=>{if(!tip||!anchor)return;const p=ruleHoverPosition(anchor.getBoundingClientRect(),{width:tip.offsetWidth,height:tip.offsetHeight},{width:win.innerWidth,height:win.innerHeight},pointer);tip.style.left=p.left+'px';tip.style.top=p.top+'px';};
 const show=(target,pointer)=>{
  clearTimer();if(!target||root.querySelector('.rule-glass'))return;
  const rule=resolve(target.dataset.game,target.dataset.rule);if(!rule)return;
  if(anchor!==target){close();anchor=target;tip=root.createElement('aside');tip.id='rule-hover-tip';tip.className='rule-hover-tip';tip.setAttribute('role','tooltip');tip.setAttribute('popover','manual');
   for(const [tag,text] of [['strong',rule.label],['p',rule.definition],['small',rule.tip]]){const node=root.createElement(tag);node.textContent=text;tip.append(node);}
   (target.closest('dialog')||root.body).append(tip);
   const ids=(target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);target.setAttribute('aria-describedby',[...ids,tip.id].join(' '));
   try{tip.showPopover?.();}catch{} // Fixed portal remains usable in older browsers.
  }keyboardTip=!pointer&&keyboard&&root.activeElement===target;position(pointer);
 };
 const leave=()=>{clearTimer();timer=win.setTimeout(close,140);};
 root.addEventListener('pointerover',e=>{if(e.pointerType==='touch'||!fine())return;if(tip?.contains(e.target)){clearTimer();return;}const target=button(e.target);if(target)show(target,{x:e.clientX,y:e.clientY});});
 root.addEventListener('pointerout',e=>{if(e.pointerType==='touch')return;if(anchor?.contains(e.target)||tip?.contains(e.target)){if(anchor?.contains(e.relatedTarget)||tip?.contains(e.relatedTarget))return;leave();}});
 root.addEventListener('pointerdown',()=>{keyboard=false;close();},true);
 root.addEventListener('click',close,true);
 root.addEventListener('keydown',e=>{if(e.key==='Tab')keyboard=true;if(e.key==='Escape'&&tip){close();e.preventDefault();e.stopImmediatePropagation();}},true);
 root.addEventListener('focusin',e=>{const target=button(e.target);if(keyboard&&target)show(target);});
 root.addEventListener('focusout',e=>{if(anchor===e.target)close();});
 root.addEventListener('scroll',e=>{
  if(tip?.contains(e.target))return;
  // Native Tab focus can queue a scroll after focusin already opened the preview.
  // Keep only that still-focused keyboard preview anchored to its current position.
  // Pointer previews still dismiss; Escape never reopens a removed preview.
  if(tip&&keyboardTip&&anchor?.isConnected&&root.activeElement===anchor&&!anchor.closest('[hidden]')&&!anchor.closest('dialog:not([open])')){
   const rect=anchor.getBoundingClientRect();
   if(rect.bottom>0&&rect.top<win.innerHeight&&rect.right>0&&rect.left<win.innerWidth){position();return;}
  }
  close();
 },true);
 root.addEventListener('close',close,true);root.addEventListener('cancel',close,true);
 win.addEventListener('resize',close);win.addEventListener('blur',close);
 root.addEventListener('visibilitychange',()=>{if(root.hidden)close();});
 const observer=new win.MutationObserver(()=>{if(anchor&&(!anchor.isConnected||anchor.closest('[hidden]')||anchor.closest('dialog:not([open])')))close();});
 observer.observe(root.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden']});
 return close;
}
