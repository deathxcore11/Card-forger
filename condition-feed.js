// Read-only condition lookup, shared by forms and collection valuation. Each exact
// version is requested once per hour, never once per camera frame.
export const CONDITION_IDENTITY=['cardId','printingId','printing','rarity','variant','edition','finish','language'];
const attempted=new Map();
let accessToken=async()=>'';
export function configureConditionAuth(readToken){accessToken=readToken;}
export const clearConditionAttempts=()=>attempted.clear();
export const forgetConditionAttempt=url=>attempted.delete(url);
export function conditionRetryMs(result,fallback=3600000){
 const advised=Number(result?.retryAfterMs);
 return advised>0&&Number.isFinite(advised)?advised:['unavailable'].includes(result?.status)?Math.min(fallback,15000):result?.status==='rate_limited'?Math.min(fallback,60000):fallback;
}
let active=0;const waiting=[];
async function limitedFetch(fetcher,...args){
 if(active>=2)await new Promise(resolve=>waiting.push(resolve));
 active++;
 try{const [url,options]=args;return await fetcher(url,{...options,signal:AbortSignal.timeout(15000)});}finally{active--;waiting.shift()?.();}
}
export function conditionRequest(card,entry,game){
 if(!card?.id)return null;
 if(game==='mtg' && entry.printingVerified && entry.printingId!==card.id)return null;
 const params=new URLSearchParams({game,id:String(card.id)});
 for(const key of ['variant','printing','rarity','edition','finish','language'])if(entry[key])params.set(key,entry[key]);
 return '/api/prices/conditions?'+params;
}
export function loadConditionQuotes(card,entry,game,fetcher=fetch){
 const url=conditionRequest(card,entry,game);if(!url)return null;
 const stamp=attempted.get(url);if(stamp!==undefined && Date.now()<stamp)return null;
 attempted.set(url,Date.now()+3600000);
 return (async()=>{
  const failed=result=>{attempted.set(url,Date.now()+conditionRetryMs(result));return result;};
  try{
   const token=await accessToken();
   const r=await limitedFetch(fetcher,url,{headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})}});
   if(!r.ok)return failed({changed:false,status:r.status===429?'rate_limited':'unavailable'});
   const data=await r.json();
   if(!['available','unpriced','unmapped'].includes(data.status))return failed({changed:false,status:data.status||'unavailable',notice:data.notice||'',reason:data.reason||'',providerCode:data.providerCode||'',retryAfterMs:data.retryAfterMs,ownerVerified:data.ownerVerified});
   const rawQuotes=(data.quotes||[]).filter(q=>compatibleConditionQuote(q,entry));
   return {...applyConditionQuotes(card,entry,rawQuotes),status:data.status||'unavailable',notice:data.notice||'',rawQuotes};
  }catch{return failed({changed:false,status:'unavailable'});}
 })();
}

// Endpoint identity fields may be absent, but conflicting fields must never be
// relabeled as the requested printing. Cached responses can then safely fan out.
function compatibleConditionQuote(q,entry){
 return q&&q.priceStatus==='current'&&q.currency==='USD'&&typeof q.price==='number'&&Number.isFinite(q.price)&&q.price>=0&&Date.parse(q.validUntil)>Date.now()&&
  CONDITION_IDENTITY.every(k=>q[k]==null||String(q[k])===String(entry[k]||''));
}
export function applyConditionQuotes(card,entry,rawQuotes=[]){
 const identity=Object.fromEntries(CONDITION_IDENTITY.map(k=>[k,entry[k]||'']));
 const quotes=rawQuotes.filter(q=>compatibleConditionQuote(q,entry)).map(q=>({...q,...identity}));
 const same=q=>CONDITION_IDENTITY.every(k=>String(q[k]||'')===String(identity[k]||''));
 const old=card.conditionQuotes||[],next=[...old.filter(q=>!same(q)&&(!q.validUntil||Date.parse(q.validUntil)>Date.now())),...quotes];
 const changed=JSON.stringify(old)!==JSON.stringify(next);card.conditionQuotes=next;
 return {changed,quotes};
}
