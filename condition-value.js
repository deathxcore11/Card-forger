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
export function conditionPriceHtml(price,entry={},quotes=[]){
 const result=conditionValue(price,entry,quotes),condition=conditionName(entry.condition);
 const description=result.kind==='manual'?'Your recorded value for this version and condition.':result.kind==='condition-quote'?`Provider estimate for this exact condition and version · ${result.quote.source||'provider'} · checked ${String(result.quote.observedAt||'').slice(0,10)}.`:price==null?'Connect a condition price provider or record your own per-copy value. This copy is excluded from your total until it has a value.':condition==='Near Mint'?'Reference price for this version; it may be a market price or listing estimate, not a verified Near Mint quote.':'Provider estimate for this condition and version.';
 return `<small>${esc(condition)} · per copy</small><strong>${price==null?'Condition price unavailable':usd(price)}</strong><p class="muted small">${esc(description)}</p>`;
}
