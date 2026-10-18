import {esc,usd} from './ui.js';
// Reference market prices are not condition-specific quotes. Never silently price
// a played/damaged copy as Near Mint or invent a fixed discount ladder.
const aliases={nm:'Near Mint',nearmint:'Near Mint',lp:'Lightly Played',lightlyplayed:'Lightly Played',mp:'Moderately Played',moderatelyplayed:'Moderately Played',hp:'Heavily Played',heavilyplayed:'Heavily Played',dmg:'Damaged',damaged:'Damaged'};
export const conditionName=v=>v==null||v===''?'Near Mint':aliases[String(v).toLowerCase().replace(/[^a-z]/g,'')]||'Unknown condition';
const amount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export function conditionValue(reference,entry={},quotes=[]){
 const condition=conditionName(entry.condition),manual=amount(entry.manualValue);
 if(manual!==null&&entry.manualValueCondition&&conditionName(entry.manualValueCondition)===condition)return {price:manual,kind:'manual',condition};
 const quote=quotes.find(q=>(!q.validUntil||Date.parse(q.validUntil)>Date.now())&&(!q.priceStatus||q.priceStatus==='current')&&conditionName(q.condition)===condition&&q.currency==='USD'&&amount(q.price)!==null&&['cardId','printingId','printing','rarity','variant','edition','finish','language'].every(k=>String(q[k]||'')===String(entry[k]||'')));
 if(quote)return {price:amount(quote.price),kind:'condition-quote',condition,quote};
 return {price:condition==='Near Mint'?amount(reference):null,kind:condition==='Near Mint'?'reference':'unpriced-condition',condition};
}
export const conditionValueNote=(e,quotes=[])=>{
 const result=conditionValue(null,e,quotes);
 return result.kind==='manual'?'Your value for this condition':result.kind==='condition-quote'?'Condition estimate · '+(result.quote.source||'provider'):conditionName(e?.condition)==='Near Mint'?'Reference price':'Condition quote unavailable · excluded from value';
};
export function conditionBadge(entry,quotes=[]){
 const condition=conditionName(entry?.condition),code={'Near Mint':'NM','Lightly Played':'LP','Moderately Played':'MP','Heavily Played':'HP',Damaged:'DMG'}[condition]||'?';
 const note=conditionValueNote(entry,quotes);
 return `<button type="button" class="condition-badge" data-condition="${esc(condition)}" data-condition-info="${esc(condition+' · '+note)}" aria-label="${esc(condition+'. '+note+'. Show condition details')}">${code}</button>`;
}

// A single lightweight tooltip serves lists and galleries. Hover/focus previews
// it; tapping pins it until an outside tap or Escape. No hidden row-height cost.
export function attachConditionInfo(root=document){
 let tip=null,anchor=null,pinned=false;
 const close=()=>{anchor?.removeAttribute('aria-describedby');tip?.remove();tip=null;anchor=null;pinned=false;};
 const show=(button,pin=false)=>{
  if(anchor!==button){close();anchor=button;tip=root.createElement('div');tip.id='condition-info-tip';tip.className='condition-info-tip';tip.setAttribute('role','tooltip');tip.setAttribute('popover','manual');tip.textContent=button.dataset.conditionInfo;(button.closest('dialog')||root.body).append(tip);anchor.setAttribute('aria-describedby',tip.id);tip.showPopover?.();}
  pinned=pin||pinned;
  const r=button.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,vw=root.documentElement.clientWidth,vh=innerHeight;
  tip.style.left=Math.max(8,Math.min(vw-w-8,r.left+r.width/2-w/2))+'px';
  tip.style.top=Math.max(8,Math.min(vh-h-8,r.top>=h+14?r.top-h-8:r.bottom+8))+'px';
 };
 root.addEventListener('pointerover',e=>{const b=e.target.closest?.('[data-condition-info]');if(b?.dataset?.conditionInfo&&e.pointerType!=='touch')show(b);});
 root.addEventListener('pointerout',e=>{if(!pinned&&anchor&&root.activeElement!==anchor&&!anchor.contains(e.relatedTarget)&&!tip?.contains(e.relatedTarget))close();});
 root.addEventListener('focusin',e=>{const b=e.target.closest?.('[data-condition-info]');if(b?.dataset?.conditionInfo)show(b);else if(!pinned)close();});
 root.addEventListener('click',e=>{const b=e.target.closest?.('[data-condition-info]');if(b?.dataset?.conditionInfo){if(anchor===b&&pinned)close();else show(b,true);}else if(!tip?.contains(e.target))close();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&tip){e.preventDefault();e.stopPropagation();close();}},true);
 root.addEventListener('scroll',()=>{if(anchor?.isConnected&&root.activeElement===anchor)show(anchor);else close();},true);window.addEventListener('resize',close);
 return close;
}
// Shared by the card editor and scan review. An absolute deadline never restarts
// when a component rerenders, and expiry does not promise provider recovery.
export function conditionRetryFeedback(lookup={},now=Date.now()){
 const reason=lookup.limitReason||lookup.reason;
 const deadline=Number(lookup.nextRetryAt),hasDeadline=Number.isFinite(deadline)&&deadline>0;
 const remaining=hasDeadline?Math.max(0,deadline-now):Math.max(0,Number(lookup.retryAfterMs)||0);
 const providerPaused=['provider_rate','provider_daily','provider_monthly','provider_shared_limit'].includes(reason)&&remaining>0;
 const timing=hasDeadline?(remaining>0?` Next lookup attempt available: ${new Date(deadline).toLocaleString()}. Recovery is not guaranteed.`:' The wait has ended. You can check again.'):(remaining>0?` Next lookup attempt available in about ${conditionRetryTime(remaining)}. Recovery is not guaranteed.`:'');
 return {remaining,providerPaused,timing,retryLabel:providerPaused?'Check saved condition prices':'Retry condition price'};
}
export function conditionPriceHtml(price,entry={},quotes=[],lookup={}){
 const status=lookup.status==='deferred'&&['not_configured','rate_limited'].includes(lookup.reason)?lookup.reason:lookup.status;
 const states={loading:['Checking condition price…','Looking up this exact version and condition. You can continue filling out the card.'],not_configured:['Condition feed not connected','This deployment has no condition provider connected. You can record a per-copy value.'],unmapped:['Version not matched','The provider could not match this exact printing. Check the version or record a per-copy value.'],unpriced:['No quote for this condition','The provider has no current quote for this exact condition and version. You can record a per-copy value.'],available:['No quote for this condition','Other conditions may have quotes, but this selected condition does not. You can record a per-copy value.'],rate_limited:['Condition lookup paused','The configured lookup allowance or provider rate limit has been reached. Saved valid quotes are retained; try later or record a per-copy value.'],unavailable:['Condition lookup unavailable','The price service could not complete this lookup. Try later or record a per-copy value.'],deferred:['Condition lookup deferred',lookup.reason==='offline'?'You are offline. Saved quotes remain available; reconnect to check this condition.':'This lookup is waiting for a verified selection or a later attempt. You can record a per-copy value.']};
 const message=states[status]||['Condition price unavailable','No verified quote is available for this condition and version. You can record a per-copy value.'];
 const reason=lookup.limitReason||lookup.reason;
 const titles={provider_rate:'Provider is slowing lookups',provider_daily:'Provider daily allowance reached',provider_monthly:'Provider monthly allowance reached',provider_shared_limit:'Condition lookup paused',provider_auth:'Provider connection needs attention',app_budget:'App lookup allowance reached'};
 const title=titles[reason]||message[0];

 const result=conditionValue(price,entry,quotes),condition=conditionName(entry.condition);
 const description=result.kind==='manual'?'Your recorded value for this version and condition.':result.kind==='condition-quote'?`Provider estimate for this exact condition and version · ${result.quote.source||'provider'} · checked ${String(result.quote.observedAt||'').slice(0,10)}.`:price==null?(reason==='provider_shared_limit'?'JustTCG’s Free-tier hosting limit is active, even with requests left. Saved quotes remain available.':lookup.notice||message[1])+' This copy is excluded from your total until it has a value.':condition==='Near Mint'?'Reference price for this version; it may be a market price or listing estimate, not a verified Near Mint quote.':'Provider estimate for this condition and version.';
 const reference=amount(lookup.reference),showReference=price==null&&reference!==null;
 const referenceHtml=showReference?`<small class="condition-reference"><b>${usd(reference)} · ${esc(lookup.referenceLabel||'Reference price')}</b><br>This is a general market reference, not a verified ${esc(condition)} price for this copy.</small>`:'';
 const {timing,retryLabel}=conditionRetryFeedback(lookup);
 const retry=price==null&&lookup.retryAction&&['unavailable','rate_limited','deferred','unpriced','unmapped'].includes(status)?`<button type="button" class="btn ghost small condition-retry" data-act="${esc(lookup.retryAction)}">${retryLabel}</button>`:'';
 return `<small>${esc(condition)} · per copy</small><strong>${price==null?esc(title):usd(price)}</strong><p class="muted small">${esc(description+(price==null?timing:''))}</p>${referenceHtml}${retry}`;
}

export function conditionRetryTime(ms){const minutes=Math.max(1,Math.ceil(ms/60000));if(minutes<60)return `${minutes} minute${minutes===1?'':'s'}`;const hours=Math.ceil(minutes/60);if(hours<48)return `${hours} hour${hours===1?'':'s'}`;const days=Math.ceil(hours/24);return `${days} days`;}
