// Isolated research authority. Not mounted in Play or the browser smoke worker.
// Trusted adapter: save/restore, context(revision), legal(), apply(actor, action).
// storage.write(record, expectedRevision) MUST atomically compare-and-write.
import {createPriorityClock} from './priority-clock.mjs';
const clone=structuredClone;
const id=s=>typeof s==='string'&&/^[-\w]{1,80}$/.test(s);
const fail=message=>{throw Error(message);};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function createTimedPriorityJournal({engine,storage,matchId,version,humanActor=0,now,newId}) {
 if(!id(matchId)||typeof version!=='string'||!version.length)fail('BAD_OPTIONS');
 let current=null,clock=null,poisoned=false,queue=Promise.resolve();
 const options=saved=>({matchId,humanActor,now,newId,saved});
 const context=revision=>({...engine.context(revision),matchId,revision});
 const summary=()=>({revision:current.revision,clock:clock.inspect(context(current.revision))});
 function arm(revision,saved=null){const c=createPriorityClock(options(saved));if(c.arm(context(revision)).state==='stale-clock')fail('CLOCK_CONTEXT_MISMATCH');return c;}
 async function execute(command){
  if(poisoned)fail('RECOVERY_REQUIRED');
  if(!command||!['create','resume','status','tick','pass'].includes(command.op))fail('BAD_REQUEST');
  if(command.op==='create'||command.op==='resume'){
   if(current)fail('ALREADY_OPEN');
   const saved=await storage.read();
   if(command.op==='resume'){
    if(!saved)fail('NO_SAVE');
    if(saved.schema!==1||saved.version!==version||saved.matchId!==matchId)fail('INCOMPATIBLE_SAVE');
    if(!Number.isSafeInteger(saved.revision)||saved.revision<0||typeof saved.engine!=='string'||!saved.receipts||Array.isArray(saved.receipts)||typeof saved.receipts!=='object')fail('CORRUPT_SAVE');
    for(const [key,r] of Object.entries(saved.receipts))if(!id(key)||typeof r.fingerprint!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>saved.revision)fail('CORRUPT_SAVE');
    try{
     engine.restore(saved.engine);
     clock=createPriorityClock(options(saved.clock));
     // A save may never lazily re-arm: it must describe this exact pending choice.
     const status=clock.inspect(context(saved.revision));
     if(['unarmed','stale-clock','committed'].includes(status.state))fail('CLOCK_CONTEXT_MISMATCH');
     current=clone(saved);return summary();
    }catch(error){poisoned=true;throw error;}
   }
   if(saved)fail('ALREADY_EXISTS');
   try{
    clock=arm(0);const record={schema:1,version,matchId,revision:0,engine:engine.save(),clock:clock.snapshot(),receipts:{}};
    await storage.write(record,null);current=record;return summary();
   }catch(error){poisoned=true;throw error;}
  }
  if(!current)fail('NOT_OPEN');
  if(command.op==='status')return summary();
  let requestId,expectedRevision,actor,action,fp;
  if(command.op==='pass'){
   if(!id(command.id)||!Number.isSafeInteger(command.revision)||command.revision<0||command.actor!==humanActor)fail('BAD_REQUEST');
   requestId=command.id;expectedRevision=command.revision;actor=command.actor;action={type:'PassPriority'};
   fp=canonical({op:'pass',revision:expectedRevision,actor,action});
   const prior=Object.hasOwn(current.receipts,requestId)?current.receipts[requestId]:null;
   if(prior){if(prior.fingerprint!==fp)fail('ID_COLLISION');return {revision:prior.revision,replayed:true};}
   if(expectedRevision!==current.revision)fail('STALE_REVISION');
   const ctx=context(current.revision);
   if(ctx.actor!==actor||ctx.kind!=='Priority')fail('WRONG_DECISION');
  }else{
   const ctx=context(current.revision),proposal=clock.propose(ctx,engine.legal());
   if(proposal.state!=='timeout-proposal')return {...summary(),clock:proposal};
   const validation=clock.validate(proposal,context(current.revision),engine.legal());
   if(!validation.ok)fail('STALE_TIMEOUT');
   ({requestId,expectedRevision,actor,action}=validation);
   fp=canonical({op:'timeout',revision:expectedRevision,actor,action});
   // IDs are authority-issued, but a faulty generator must never overwrite a receipt.
   if(Object.hasOwn(current.receipts,requestId))fail('ID_COLLISION');
  }
  const ctx=context(current.revision),legal=engine.legal();
  if(ctx.actor!==actor||ctx.kind!=='Priority'||!legal.some(a=>canonical(a)===canonical(action)))fail('NO_LEGAL_PASS');
  if(!Number.isSafeInteger(current.revision+1))fail('REVISION_LIMIT');
  try{
   engine.apply(actor,clone(action));
   const revision=current.revision+1,nextClock=arm(revision,current.clock);
   const receipts=clone(current.receipts);
   Object.defineProperty(receipts,requestId,{value:{fingerprint:fp,revision},enumerable:true});
   const next={...current,revision,engine:engine.save(),clock:nextClock.snapshot(),receipts};
   await storage.write(next,expectedRevision);
   current=next;clock=nextClock;return {...summary(),accepted:true,requestId};
  }catch(error){
   // Storage may have committed before its acknowledgement was lost. Only a
   // fresh authority can read the durable receipt and decide what happened.
   try{engine.restore(current.engine);}catch{}
   poisoned=true;throw error;
  }
 }
 return command=>{const task=queue.then(()=>execute(clone(command)));queue=task.catch(()=>undefined);return task;};
}
