import {SUPABASE} from './config.js';
export const sharedHistory = new Map();
const pending=new Map();let refresh=()=>{};
const CACHE='cardstashy-public-market-history-v4';
function cached(k){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')[k];}catch{return null;}}
function remember(k,d){try{const all=JSON.parse(localStorage.getItem(CACHE)||'{}');all[k]=d;const keys=Object.keys(all).sort((a,b)=>(all[b].checked||0)-(all[a].checked||0));for(const key of keys.slice(60))delete all[key];localStorage.setItem(CACHE,JSON.stringify(all));}catch{}}

export const historyKey=q=>[q.game,q.cardId,q.finish,...(q.edition?[q.edition,q.rarity || '']:[])].join('|');
export const setHistoryRefresh=fn=>{refresh=fn;};
export function validateHistory(data,q){
 if(data?.game!==q.game || data.cardId!==q.cardId || data.finish!==q.finish)throw Error('History printing mismatch');
 return {...data,series:(data.series || []).filter(s=>s.currency==='USD'&&s.finish===q.finish&&typeof s.source==='string').map(s=>({...s,points:[...new Map((s.points || []).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.value)&&p.value>=0&&p.value<=10000000&&Date.parse(p.date)<=Date.now()).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-366)}))};
}
// Older routes can report a provider/mapping failure in a successful HTTP
// response. Empty history is verified only when that response really completed.
export function historyResponseStatus(data){
 if(data?.series?.some(s=>s.points?.length))return 'ready';
 const notice=String(data?.notice||'');
 if(/unavailable|returned [45]\d\d|time[ -]?out|timed out|network|fetch failed|capacity reached|tracking is busy/i.test(notice))return 'unavailable';
 if(/choose|mismatch|unambiguous|ambiguous|no exact rarity|no archived set|no separate archived series|not supported/i.test(notice))return 'unsupported';
 if(!notice||/no recorded|no dated|no current USD quote/i.test(notice))return 'empty';
 return 'unavailable';
}
export async function loadSharedHistory(q){
 if(!q||!SUPABASE.url)return;
 const k=historyKey(q),old=sharedHistory.get(k)||cached(k);if(old)sharedHistory.set(k,old);
 const complete=old?.series?.some(s=>s.points?.length>2 && Date.now()-Date.parse(s.points.at(-1).date)<3*864e5);
 if(old&&Date.now()-old.checked<(complete?3600000:30000))return old;
 if(pending.has(k))return pending.get(k);
 const job=(async()=>{
  const jobs=[fetch(SUPABASE.url+'/functions/v1/market-history?'+new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish}),{headers:{apikey:SUPABASE.key},signal:AbortSignal.timeout(20000)}),fetch('api/prices/archive?'+new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish,edition:q.edition || '',rarity:q.rarity || ''}),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)})];
  if(q.game!=='mtg')jobs.push(fetch('api/prices/recent?'+new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish,edition:q.edition || '',rarity:q.rarity || ''}),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)}));
  const results=await Promise.allSettled(jobs.map(async job=>{const r=await job;if(!r.ok)throw Error('History unavailable');return validateHistory(await r.json(),q);}));
  const valid=results.filter(r=>r.status==='fulfilled').map(r=>r.value),series=valid.flatMap(d=>d.series || []).filter(s=>s.points.length);
  const notices=valid.filter(d=>!d.series?.length&&d.notice).map(d=>d.notice);
  const states=valid.map(historyResponseStatus),status=series.length?'ready':results.some(r=>r.status==='rejected')||states.includes('unavailable')?'unavailable':states.includes('unsupported')?'unsupported':'empty';
  const entry={game:q.game,cardId:q.cardId,finish:q.finish,status,series:series.length?series:old?.series || [],notice:series.length?'':notices.join(' ')||(status==='unavailable'?'Historical sources unavailable; your saved checks remain available.':''),checked:Date.now()};
  sharedHistory.set(k,entry);remember(k,entry);pending.delete(k);refresh(k);return entry;
 })();
 pending.set(k,job);return job;
}
export function requestHistory(q){if(typeof window!=='undefined')void loadSharedHistory(q);return sharedHistory.get(historyKey(q))||cached(historyKey(q));}
