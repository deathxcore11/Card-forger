import {SUPABASE} from './config.js';
import {canRequestExactYgoHistory,exactYgoHistoryIdentity,sameExactYgoHistoryIdentity,ygoHistorySubtype,YGO_HISTORY_SCHEMA} from './ygo-history-identity.js';
export {canRequestExactYgoHistory} from './ygo-history-identity.js';
export const sharedHistory = new Map();
const pending=new Map();let refresh=()=>{};
const CACHE='cardstashy-public-market-history-v4';
function cached(k){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')[k];}catch{return null;}}
function remember(k,d){try{const all=JSON.parse(localStorage.getItem(CACHE)||'{}');all[k]=d;const keys=Object.keys(all).sort((a,b)=>(all[b].checked||0)-(all[a].checked||0));for(const key of keys.slice(60))delete all[key];localStorage.setItem(CACHE,JSON.stringify(all));}catch{}}

const contextualYgo=q=>q?.game==='ygo'&&!!q.releaseId;
export const historyKey=q=>contextualYgo(q)?JSON.stringify([YGO_HISTORY_SCHEMA,q.game,q.cardId,q.finish,q.releaseId,q.edition||'',q.rarity||'',q.selectedEdition||'',q.currency||'']):[q.game,q.cardId,q.finish,...(q.productId?['product',String(q.productId)]:[]),...(q.edition?[q.edition,q.rarity || '']:[])].join('|');
export const setHistoryRefresh=fn=>{refresh=fn;};
export function validateHistory(data,q){
 if(data?.game!==q.game || data.cardId!==q.cardId || data.finish!==q.finish)throw Error('History printing mismatch');
 if(q.productId&&data.productId&&String(q.productId)!==String(data.productId))throw Error('History product mismatch');
 if(q.productId&&(data.series||[]).some(s=>s.productId&&String(s.productId)!==String(q.productId)))throw Error('History series product mismatch');
 if(contextualYgo(q)){
  if(!sameExactYgoHistoryIdentity(data,q)||!Array.isArray(data.series)||!['ready','empty','unsupported','unavailable'].includes(data.status))throw Error('Exact history identity mismatch');
  if(data.series.some(s=>!sameExactYgoHistoryIdentity(s,q)||ygoHistorySubtype(s.subtype)!==q.selectedEdition||!Number.isSafeInteger(s.productId)||s.productId<=0||typeof s.source!=='string'||!Array.isArray(s.points)))throw Error('Exact history series mismatch');
 }
 return {...data,series:(data.series || []).filter(s=>s.currency==='USD'&&s.finish===q.finish&&typeof s.source==='string').map(s=>({...s,...(q.productId&&!s.productId&&!data.productId?{bindingStatus:'unbound-reference',source:s.source+' · product unverified reference'}:{}),points:[...new Map((s.points || []).filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.value)&&p.value>=0&&p.value<=10000000&&Date.parse(p.date)<=Date.now()&&(!contextualYgo(q)||p.value>0&&new Date(p.date).toISOString().slice(0,10)===p.date)).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-366)}))};
}
function savedHistory(q){
 const key=historyKey(q),old=sharedHistory.get(key)||cached(key);
 if(!old||!contextualYgo(q)&&!q.productId)return old;
 try{const verified=validateHistory(old,q);return contextualYgo(q)?verified:old;}catch{return null;}
}
// Older routes can report a provider/mapping failure in a successful HTTP
// response. Empty history is verified only when that response really completed.
export function historyResponseStatus(data){
 if(data?.series?.some(s=>s.points?.length))return 'ready';
 if(['empty','unsupported','unavailable'].includes(data?.status))return data.status;
 const notice=String(data?.notice||'');
 if(/unavailable|returned [45]\d\d|time[ -]?out|timed out|network|fetch failed|capacity reached|tracking is busy/i.test(notice))return 'unavailable';
 if(/choose|mismatch|unambiguous|ambiguous|no exact rarity|no archived set|no separate archived series|not supported/i.test(notice))return 'unsupported';
 if(!notice||/no recorded|no dated|no current USD quote/i.test(notice))return 'empty';
 return 'unavailable';
}
// Request origin is persisted with exact series, never inferred from price/date.
// The limited migration recognises the adapter's own established source labels.
function exactHistoryProvider(series){
 if(['archive','recent'].includes(series.historyProvider))return series.historyProvider;
 if(series.archived===true||series.source==='archive'||series.source.startsWith('TCGplayer archived market/mid prices via Rarebox · '))return 'archive';
 if(series.source==='recent'||series.source.startsWith('TCGplayer market via TickerMint · '))return 'recent';
 return '';
}
export async function loadSharedHistory(q){
 if(!q)return;
 const exact=contextualYgo(q);
 if(exact&&!canRequestExactYgoHistory(q))return;
 if(!exact&&!SUPABASE.url)return;
 const k=historyKey(q),old=savedHistory(q);if(old)sharedHistory.set(k,old);
 const complete=old?.series?.some(s=>s.points?.length>2 && Date.now()-Date.parse(s.points.at(-1).date)<3*864e5);
 if(old&&Date.now()-old.checked<(complete?3600000:30000))return old;
 if(pending.has(k))return pending.get(k);
 const job=(async()=>{
  const params=new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish,edition:q.edition || '',rarity:q.rarity || '',...(exact?{releaseId:q.releaseId,selectedEdition:q.selectedEdition,currency:q.currency}: {})});
  // Supabase is card/finish scoped, never release/printing/physical-edition
  // scoped. A selected release must not query or fall back to that dataset.
  const jobs=exact?[]:[fetch(SUPABASE.url+'/functions/v1/market-history?'+new URLSearchParams({game:q.game,id:q.cardId,finish:q.finish}),{headers:{apikey:SUPABASE.key},signal:AbortSignal.timeout(20000)})];
  jobs.push(fetch('api/prices/archive?'+params,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)}));
  if(q.game!=='mtg')jobs.push(fetch('api/prices/recent?'+params,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)}));
  const results=await Promise.allSettled(jobs.map(async job=>{const r=await job;if(!r.ok)throw Error('History unavailable');return validateHistory(await r.json(),q);}));
  const valid=results.filter(r=>r.status==='fulfilled').map(r=>r.value),series=valid.flatMap(d=>d.series || []).filter(s=>s.points.length);
  const notices=valid.filter(d=>!d.series?.length&&d.notice).map(d=>d.notice);
  const states=valid.map(historyResponseStatus),status=series.length?'ready':results.some(r=>r.status==='rejected')||states.includes('unavailable')?'unavailable':states.includes('unsupported')?'unsupported':'empty';
  let entry={game:q.game,cardId:q.cardId,finish:q.finish,...(q.productId?{productId:q.productId}:{}),...(exact?exactYgoHistoryIdentity(q):{}),status,series:series.length?series:old?.series || [],notice:series.length?'':notices.join(' ')||(status==='unavailable'?'Historical sources unavailable; your saved checks remain available.':''),checked:Date.now()};
  if(exact){
   const providerStates={},separate=[];
   for(const [index,provider] of ['archive','recent'].entries()){
    const result=results[index],data=result.status==='fulfilled'?result.value:null;
    const state=!data||data.status==='unavailable'?'unavailable':historyResponseStatus(data);providerStates[provider]=state;
    if(state==='unavailable'){
     // savedHistory already revalidated every retained identity and observation.
     separate.push(...(old?.series||[]).filter(s=>exactHistoryProvider(s)===provider));
    }else separate.push(...(data.series||[]).filter(s=>s.points.length).map(s=>({...s,historyProvider:provider})));
   }
   const failed=Object.values(providerStates).filter(s=>s==='unavailable').length;
   entry={...entry,series:separate,providerStates,partialFailure:failed===1,status:failed?'unavailable':separate.length?'ready':Object.values(providerStates).includes('unsupported')?'unsupported':'empty',notice:failed?(failed===1?'Some history sources could not refresh. Any saved observations are shown separately.':'Historical sources unavailable; your saved checks remain available.'):notices.join(' ')};
  }
  sharedHistory.set(k,entry);remember(k,entry);pending.delete(k);refresh(k,q);return entry;
 })();
 pending.set(k,job);return job;
}
export function requestHistory(q){if(typeof window!=='undefined')void loadSharedHistory(q);return savedHistory(q);}
