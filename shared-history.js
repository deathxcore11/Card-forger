import {SUPABASE} from './config.js';
export const sharedHistory = new Map();
const pending=new Map();let refresh=()=>{};
const CACHE='cardstashy-public-market-history-v1';
function cached(k){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')[k];}catch{return null;}}
function remember(k,d){try{const all=JSON.parse(localStorage.getItem(CACHE)||'{}');all[k]=d;const keys=Object.keys(all).sort((a,b)=>(all[b].checked||0)-(all[a].checked||0));for(const key of keys.slice(60))delete all[key];localStorage.setItem(CACHE,JSON.stringify(all));}catch{}}

export const historyKey=q=>[q.game,q.cardId,q.finish].join('|');
export const setHistoryRefresh=fn=>{refresh=fn;};
export function validateHistory(data,q){
 if(data?.game!==q.game || data.cardId!==q.cardId || data.finish!==q.finish)throw Error('History printing mismatch');
 return {...data,series:(data.series || []).filter(s=>s.currency==='USD'&&s.finish===q.finish&&typeof s.source==='string').map(s=>({...s,points:[...new Map((s.points || []).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.value)&&p.value>=0&&p.value<=10000000&&Date.parse(p.date)<=Date.now()).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-366)}))};
}
export async function loadSharedHistory(q){
 if(!q||!SUPABASE.url)return;
 const k=historyKey(q),old=sharedHistory.get(k)||cached(k);if(old)sharedHistory.set(k,old);
 if(old&&Date.now()-old.checked<3600000)return old;
 if(pending.has(k))return pending.get(k);
 const job=(async()=>{try{const u=SUPABASE.url+'/functions/v1/market-history?'+new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish});const r=await fetch(u,{headers:{apikey:SUPABASE.key},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('History unavailable');const d=validateHistory(await r.json(),q);const entry={...d,checked:Date.now()};sharedHistory.set(k,entry);remember(k,entry);}catch{sharedHistory.set(k,{...old,series:old?.series || [],notice:'Shared history unavailable. Your device observations remain available.',checked:Date.now()});}finally{pending.delete(k);refresh(k);}return sharedHistory.get(k);})();
 pending.set(k,job);return job;
}
export function requestHistory(q){if(typeof window!=='undefined')void loadSharedHistory(q);return sharedHistory.get(historyKey(q))||cached(historyKey(q));}
