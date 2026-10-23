// Pace request starts, not response completions: a slow /sets response must not
// hold a scanner lookup behind its entire network timeout. Three bounded slots,
// one shared rate gate (including retries), and a deadline that includes queuing.
// https://scryfall.com/docs/api/rate-limits
export function createScryfallClient({fetcher=(...args)=>fetch(...args),timeoutMs=16000,intervalMs=110,collectionIntervalMs=510,maxActive=3,networkBackoffMs=1000}={}) {
 const waiting=[];let active=0,nextStart=0,nextCollection=0,wake=0;
 const error=(signal)=>Error(signal?.aborted?'Card lookup cancelled.':'Card lookup timed out. Check your connection and try again.');
 const pump=()=>{
  clearTimeout(wake);wake=0;
  while(waiting[0]?.signal.aborted)waiting.shift().cancel();
  if(!waiting.length||active>=maxActive)return;
  // An endpoint-specific collection cooldown must not hold ordinary card reads.
  const now=Date.now(),index=waiting.findIndex(j=>!j.collection||nextCollection<=now);
  const delay=Math.max(0,nextStart-now,index<0?nextCollection-now:0);
  if(delay||index<0){wake=setTimeout(pump,Math.max(1,delay));return;}
  const job=waiting.splice(index,1)[0];job.signal.removeEventListener('abort',job.cancel);
  if(job.signal.aborted){job.cancel();pump();return;}
  active++;nextStart=Date.now()+intervalMs;if(job.collection)nextCollection=Date.now()+collectionIntervalMs;
  Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(()=>{active--;pump();});
  pump();
 };
 const schedule=(run,signal,collection)=>new Promise((resolve,reject)=>{
  const job={run,signal,collection,resolve,reject,cancel:()=>{const i=waiting.indexOf(job);if(i>=0)waiting.splice(i,1);reject(Object.assign(Error('aborted'),{name:'AbortError'}));pump();}};
  if(signal.aborted)return job.cancel();
  signal.addEventListener('abort',job.cancel,{once:true});waiting.push(job);pump();
 });
 return async function api(path,options={}) {
  if(options.signal?.aborted)throw error(options.signal);
  const ctl=new AbortController(),cancel=()=>ctl.abort(),deadline=Date.now()+timeoutMs,timer=setTimeout(cancel,timeoutMs);
  options.signal?.addEventListener('abort',cancel,{once:true});
  try {
   for(let attempt=0;;attempt++) {
    try {
     return await schedule(async()=>{
      if(ctl.signal.aborted||Date.now()>=deadline){ctl.abort();throw Object.assign(Error('aborted'),{name:'AbortError'});}
      const r=await fetcher('https://api.scryfall.com'+path,{...options,headers:{Accept:'application/json',...options.headers},signal:ctl.signal});
      if(r.status===429){
       const header=r.headers?.get('Retry-After'),seconds=Number(header),advised=header?(Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now()):1000;
       nextStart=Math.max(nextStart,Date.now()+Math.max(1000,Number.isFinite(advised)?advised:1000));
      }
      if(r.status===429||r.status>=500)throw Object.assign(Error(r.status===429?'The card database is busy. Try again in a moment.':'The card database is temporarily unavailable. Try again in a moment.'),{retry:true,status:r.status});
      const data=await r.json();
      if(!r.ok)throw Object.assign(Error(data.details||'Card database unavailable.'),{status:r.status});
      return data;
     },ctl.signal,/^\/cards\/collection(?:\?|$)/.test(path));
    }catch(e){
     if(ctl.signal.aborted||e.name==='AbortError')throw error(options.signal);
     // No readable response (TypeError "Failed to fetch") can be a connection,
     // CORS or provider failure. Back off together without guessing the cause.
     const network=!e.status&&e instanceof TypeError;
     if(e.status&&!e.retry||attempt>=2)throw network?Object.assign(Error('Couldn’t reach the card database (Scryfall). It may be busy for a moment; try again shortly.'),{network:true}):e;
     nextStart=Math.max(nextStart,Date.now()+(network?networkBackoffMs*2**attempt:attempt?1500:600));
    }
   }
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
 };
}
