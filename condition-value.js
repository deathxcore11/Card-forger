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
export function conditionPriceHtml(price,entry={},quotes=[],lookup={}){
 const status=lookup.status==='deferred'&&['not_configured','rate_limited'].includes(lookup.reason)?lookup.reason:lookup.status;
 const states={loading:['Checking condition price…','Looking up this exact version and condition. You can continue filling out the card.'],not_configured:['Condition feed not connected','This deployment has no condition provider connected. You can record a per-copy value.'],unmapped:['Version not matched','The provider could not match this exact printing. Check the version or record a per-copy value.'],unpriced:['No quote for this condition','The provider has no current quote for this exact condition and version. You can record a per-copy value.'],available:['No quote for this condition','Other conditions may have quotes, but this selected condition does not. You can record a per-copy value.'],rate_limited:['Condition lookup paused','The configured lookup allowance or provider rate limit has been reached. Saved valid quotes are retained; try later or record a per-copy value.'],unavailable:['Condition lookup unavailable','The price service could not complete this lookup. Try later or record a per-copy value.'],deferred:['Condition lookup deferred',lookup.reason==='offline'?'You are offline. Saved quotes remain available; reconnect to check this condition.':'This lookup is waiting for a verified selection or a later attempt. You can record a per-copy value.']};
 const message=states[status]||['Condition price unavailable','No verified quote is available for this condition and version. You can record a per-copy value.'];
 const reason=lookup.limitReason||lookup.reason;
 const titles={provider_rate:'Provider is slowing lookups',provider_daily:'Provider daily allowance reached',provider_monthly:'Provider monthly allowance reached',provider_shared_limit:'Provider shared-hosting restriction',provider_auth:'Provider connection needs attention',app_budget:'App lookup allowance reached'};
 const title=titles[reason]||message[0];

 const result=conditionValue(price,entry,quotes),condition=conditionName(entry.condition);
 const description=result.kind==='manual'?'Your recorded value for this version and condition.':result.kind==='condition-quote'?`Provider estimate for this exact condition and version · ${result.quote.source||'provider'} · checked ${String(result.quote.observedAt||'').slice(0,10)}.`:price==null?(lookup.notice||message[1])+' This copy is excluded from your total until it has a value.':condition==='Near Mint'?'Reference price for this version; it may be a market price or listing estimate, not a verified Near Mint quote.':'Provider estimate for this condition and version.';
 const reference=amount(lookup.reference),showReference=price==null&&reference!==null;
 const referenceHtml=showReference?`<small class="condition-reference"><b>${usd(reference)} · ${esc(lookup.referenceLabel||'Reference price')}</b><br>This is a general market reference, not a verified ${esc(condition)} price for this copy.</small>`:'';
 const timing=lookup.retryAfterMs>0?` Try again in about ${Math.ceil(lookup.retryAfterMs/60000)} minute${lookup.retryAfterMs>60000?'s':''}.`:'';
 const retry=price==null&&lookup.retryAction&&['unavailable','rate_limited','deferred','unpriced','unmapped'].includes(status)?`<button type="button" class="btn ghost small condition-retry" data-act="${esc(lookup.retryAction)}">Retry condition price</button>`:'';
 return `<small>${esc(condition)} · per copy</small><strong>${price==null?esc(title):usd(price)}</strong><p class="muted small">${esc(description+(price==null?timing:''))}</p>${referenceHtml}${retry}`;
}
