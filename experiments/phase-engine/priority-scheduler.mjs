// Research scheduler for createTimedPriorityJournal, not a mounted Play UI.
// The authority alone owns deadlines and applies/revalidates timeout passes.
// Call refresh after an accepted external command or foreground/recovery event.
export function createPriorityScheduler({request,onStatus=()=>{},onError=()=>{},
 setTimer=setTimeout,clearTimer=clearTimeout,intervalMs=250}={}) {
 if(typeof request!=='function'||typeof onStatus!=='function'||typeof onError!=='function'||
    typeof setTimer!=='function'||typeof clearTimer!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<50||intervalMs>1000)throw Error('BAD_SCHEDULER_OPTIONS');
 let stopped=true,generation=0,timer=null,running=null,dirty=false;
 const clear=()=>{if(timer!==null){clearTimer(timer);timer=null;}};
 function publish(result){
  const c=result?.clock;
  if(!Number.isSafeInteger(result?.revision)||result.revision<0||!c||typeof c.state!=='string')throw Error('BAD_TIMER_STATUS');
  const counting=c.state==='waiting'||c.state==='expired';
  if(counting&&(!Number.isSafeInteger(c.remainingMs)||c.remainingMs<0||!Number.isSafeInteger(c.deadlineAt)||c.deadlineAt<0))throw Error('BAD_TIMER_STATUS');
  // Explicit projection: never forward engine saves or accidental extra fields.
  onStatus({revision:result.revision,state:c.state,
   remainingSeconds:counting?Math.ceil(c.remainingMs/1000):null,
   warning:counting&&c.remainingMs>0&&c.remainingMs<=5000,
   needsChoice:c.state==='timeout-needs-choice'});
  return c;
 }
 async function cycle(){
  const epoch=generation;
  try{
   let result=await request({op:'status'});
   if(stopped||epoch!==generation)return;
   let c=publish(result);
   if(c.state==='expired'){
    // At most one mutation per cycle; the journal rechecks actor/revision/choice.
    result=await request({op:'tick'});
    if(stopped||epoch!==generation)return;
    c=publish(result);
   }
   if(c.state==='waiting')timer=setTimer(()=>{timer=null;void refresh();},Math.max(1,Math.min(intervalMs,c.remainingMs)));
   // Other actor, mandatory choice, suspension and unknown states never spin.
  }catch(error){
   if(!stopped&&epoch===generation){stopped=true;clear();onError({state:'recovery-required'});}
   // Unknown mutation outcomes must be recovered by a fresh durable authority,
   // not automatically retried or converted into a result by this scheduler.
  }
 }
 function refresh(){
  if(stopped)return Promise.resolve();
  clear();
  if(running){dirty=true;return running;}
  running=cycle().finally(()=>{running=null;if(dirty){dirty=false;if(!stopped)void refresh();}});
  return running;
 }
 return {
  start(){if(stopped){stopped=false;generation++;}return refresh();},
  refresh,
  stop(){stopped=true;generation++;dirty=false;clear();}
 };
}
