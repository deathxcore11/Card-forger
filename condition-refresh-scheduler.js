// Client backpressure, not a provider quota. Explicit work still uses the server's
// unchanged shared budgets; only passive Collection work has a page-session cap.
import {conditionRetryMs} from './condition-feed.js';
export const CONDITION_REFRESH_LIMITS=Object.freeze({automatic:8,pending:32,concurrent:2,intervalMs:8000,collectionBatch:4,retryMs:3600000,cacheEntries:128});
export const conditionCursorKey=game=>'cardstashy-condition-cursor:'+game;
const deferred=reason=>({changed:false,status:'deferred',reason});
export function createConditionRefreshScheduler({automatic=CONDITION_REFRESH_LIMITS.automatic,maxPending=CONDITION_REFRESH_LIMITS.pending,concurrent=CONDITION_REFRESH_LIMITS.concurrent,intervalMs=CONDITION_REFRESH_LIMITS.intervalMs,retryMs=CONDITION_REFRESH_LIMITS.retryMs,cacheEntries=CONDITION_REFRESH_LIMITS.cacheEntries,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const jobs=new Map(),queue=[];
 let active=0,started=0,automaticStarted=0,nextStart=0,timer=null,stopped='',stoppedUntil=0,stopResult=null;
 const trim=()=>{
  for(const [key,job] of jobs)if(job.done&&job.expires<=now())jobs.delete(key);
  const completed=[...jobs.values()].filter(job=>job.done);
  for(const job of completed.slice(0,Math.max(0,completed.length-cacheEntries)))jobs.delete(job.key);
 };
 const finish=(job,result)=>{job.done=true;job.result=result;job.expires=now()+conditionRetryMs(result,retryMs);job.resolve(result);trim();};
 const discard=(job,reason)=>{jobs.delete(job.key);finish(job,deferred(reason));};
 const paused=()=>({...stopResult,changed:false,status:'deferred',reason:stopped,limitReason:stopResult?.reason||'',retryAfterMs:Math.max(0,stoppedUntil-now())});
 const wake=()=>{if(timer!==null)clearTimer(timer);timer=null;if(!queue.length||stopped||active>=concurrent)return;timer=setTimer(pump,Math.max(0,nextStart-now()));};
 function pump(){
  timer=null;
  if(stopped||active>=concurrent||!queue.length)return;
  if(now()<nextStart){wake();return;}
  queue.sort((a,b)=>Number(a.background)-Number(b.background));
  const job=queue.shift();
  if(!job.current.some(check=>check())){discard(job,'context-changed');wake();return;}
  if(job.background&&automaticStarted>=automatic){discard(job,'automatic-budget');wake();return;}
  active++;started++;if(job.background)automaticStarted++;
  nextStart=now()+intervalMs;
  Promise.resolve().then(job.run).then(result=>{
   result ||= deferred('recent-attempt');
   if(['not_configured','rate_limited'].includes(result.status)){
    stopped=result.status;stopResult=result;stoppedUntil=now()+conditionRetryMs(result,retryMs);
    for(const pending of queue.splice(0)){jobs.delete(pending.key);finish(pending,paused());}
   }
   finish(job,result);
  },()=>finish(job,{changed:false,status:'unavailable'})).finally(()=>{active--;wake();});
  if(queue.length)wake();
 }
 return {
  request(key,run,{source='explicit',current=()=>true,retry=false}={}){
   if(!key)return Promise.resolve(deferred('unmapped'));
   trim();
   // Recovery is explicit only, never a timed background retry.
   if(stopped&&source!=='collection'&&(retry||now()>=stoppedUntil)){stopped='';stopResult=null;}
   // A deliberate retry may recheck the server cache; server provider backoff
   // and owner verification still apply. Never repeat an in-flight request.
   if(retry&&jobs.get(key)?.done&&!['available','manual'].includes(jobs.get(key).result?.status))jobs.delete(key);
   const old=jobs.get(key);
   if(old){
    if(!old.done){old.current.push(current);if(source!=='collection')old.background=false;}
    return old.promise.then(result=>({...result,changed:false,reused:true}));
   }
   if(stopped)return Promise.resolve(paused());
   const background=source==='collection';
   if(background&&automaticStarted+queue.filter(j=>j.background).length>=automatic)return Promise.resolve(deferred('automatic-budget'));
   if(queue.length>=maxPending){
    const index=background?-1:queue.findLastIndex(j=>j.background);
    if(index<0)return Promise.resolve(deferred('queue-full'));
    discard(queue.splice(index,1)[0],'explicit-priority');
   }
   let resolve;const promise=new Promise(r=>resolve=r),job={key,run,background,current:[current],promise,resolve,done:false};
   jobs.set(key,job);queue.push(job);wake();return promise;
  },
  has:key=>{trim();return jobs.has(key);},
  state:()=>({active,queued:queue.length,started,automaticStarted,stopped}),
  canScheduleCollection:()=>!stopped&&automaticStarted+queue.filter(j=>j.background).length<automatic
 };
}

// One visible candidate then rotating candidates. Persist the last rotating lot,
// including attempted/unavailable ones, so a reload never restarts at first100.
export function selectConditionLots(lots,{cursor='',visibleIds=new Set(),limit=CONDITION_REFRESH_LIMITS.collectionBatch,eligible=()=>true}={}){
 const entries=[],seen=new Set();
 const take=entry=>{if(!entry||seen.has(entry.id)||!eligible(entry))return false;seen.add(entry.id);entries.push(entry);return true;};
 for(const entry of lots)if(visibleIds.has(entry.id)&&take(entry))break;
 let nextCursor=cursor;
 const start=Math.max(0,lots.findIndex(entry=>entry.id===cursor)+1)%Math.max(1,lots.length);
 for(let i=0;i<lots.length&&entries.length<limit;i++){
  const entry=lots[(start+i)%lots.length];nextCursor=entry.id;take(entry);
 }
 return {entries,cursor:nextCursor};
}

const lotFields=['name','cardId','printingId','printingVerified','printing','rarity','variant','edition','finish','language','condition','setReleaseId','setReleaseUnverified'];
export const conditionLotIdentity=entry=>JSON.stringify(lotFields.map(k=>entry?.[k]??''));
export function changedConditionLots(before,after){
 const changed=[];
 for(const game of ['mtg','ptcg','ygo']){
  const rows=state=>game==='mtg'?state?.collection||[]:state?.tcg?.[game]?.collection||[];
  const previous=new Map(rows(before).map(entry=>[entry.id,conditionLotIdentity(entry)]));
  for(const entry of rows(after))if(previous.get(entry.id)!==conditionLotIdentity(entry))changed.push({game,entry});
 }
 return changed;
}
