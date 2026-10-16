// Reference market prices are not condition-specific quotes. Never silently price
// a played/damaged copy as Near Mint or invent a fixed discount ladder.
const aliases={nm:'Near Mint',nearmint:'Near Mint',lp:'Lightly Played',lightlyplayed:'Lightly Played',mp:'Moderately Played',moderatelyplayed:'Moderately Played',hp:'Heavily Played',heavilyplayed:'Heavily Played',dmg:'Damaged',damaged:'Damaged'};
export const conditionName=v=>v==null||v===''?'Near Mint':aliases[String(v).toLowerCase().replace(/[^a-z]/g,'')]||'Unknown condition';
const amount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
export function conditionValue(reference,entry={},quotes=[]){
 const condition=conditionName(entry.condition),manual=amount(entry.manualValue);
 if(manual!==null&&entry.manualValueCondition&&conditionName(entry.manualValueCondition)===condition)return {price:manual,kind:'manual',condition};
 const quote=quotes.find(q=>conditionName(q.condition)===condition&&q.currency==='USD'&&amount(q.price)!==null&&['cardId','printingId','printing','rarity','variant','edition','finish','language'].every(k=>String(q[k]||'')===String(entry[k]||'')));
 if(quote)return {price:amount(quote.price),kind:'condition-quote',condition};
 return {price:condition==='Near Mint'?amount(reference):null,kind:condition==='Near Mint'?'reference':'unpriced-condition',condition};
}
export const conditionValueNote=e=>conditionName(e?.condition)==='Near Mint'?'Reference market price':conditionValue(null,e).kind==='manual'?'Your value for this condition':'Condition quote unavailable · excluded from value';
