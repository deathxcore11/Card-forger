// Read-only condition lookup, shared by forms and collection valuation. Each exact
// version is requested once per session/day, never once per camera frame.
export const CONDITION_IDENTITY=['cardId','printingId','printing','rarity','variant','edition','finish','language'];
const attempted=new Map();
let active=0;const waiting=[];
async function limitedFetch(fetcher,...args){
 if(active>=2)await new Promise(resolve=>waiting.push(resolve));
 active++;
 try{return await fetcher(...args);}finally{active--;waiting.shift()?.();}
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
 const stamp=attempted.get(url);if(stamp && Date.now()-stamp<3600000)return null;
 attempted.set(url,Date.now());
 const identity=Object.fromEntries(CONDITION_IDENTITY.map(k=>[k,entry[k]||'']));
 return (async()=>{
  try{
   const r=await limitedFetch(fetcher,url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
   if(!r.ok)return {changed:false,status:'unavailable'};
   const data=await r.json();
   if(!['available','unpriced','unmapped'].includes(data.status))return {changed:false,status:data.status||'unavailable',notice:data.notice||''};
   const quotes=(data.quotes||[]).filter(q=>q.priceStatus==='current'&&q.currency==='USD'&&typeof q.price==='number'&&Number.isFinite(q.price)&&q.price>=0&&Date.parse(q.validUntil)>Date.now()).map(q=>({...q,...identity}));
   const same=q=>CONDITION_IDENTITY.every(k=>String(q[k]||'')===String(identity[k]||''));
   const old=card.conditionQuotes||[],next=[...old.filter(q=>!same(q)&&(!q.validUntil||Date.parse(q.validUntil)>Date.now())),...quotes];
   const changed=JSON.stringify(old)!==JSON.stringify(next);card.conditionQuotes=next;
   return {changed,status:data.status||'unavailable',notice:data.notice||'',quotes};
  }catch{return {changed:false,status:'unavailable'};}
 })();
}
