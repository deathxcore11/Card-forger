// Research transport only. No UI, card coverage or opponent-strength certification.
export class Fault extends Error { constructor(code) { super(code); this.code=code; } }
export const fail = code => { throw new Fault(code); };
export function packet(m) {
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['v','epoch','id','op','revision','seed','first'].includes(k)))fail('BAD_REQUEST');
 if(typeof m.id!=='string'||typeof m.epoch!=='string'||m.v!==1||!['create','resume','status','step'].includes(m.op)||!/^[-\w]{1,80}$/.test(m.id||'')||!/^[-\w]{1,80}$/.test(m.epoch||''))fail('BAD_REQUEST');
 if(m.op==='create'&&(!Number.isInteger(m.seed)||m.seed<0||m.seed>0xffffffff||![0,1].includes(m.first)))fail('BAD_REQUEST');
 if(m.op==='step'&&(!Number.isSafeInteger(m.revision)||m.revision<0))fail('BAD_REQUEST');
 return m;
}
// Durable receipts and engine state are one atomic record. Unknown engine errors
// never cross the boundary. Serialization prevents overlapping WASM mutations.
export function createJournal({engine,storage,choose,version,epoch}) {
 let current=null,queue=Promise.resolve(),poisoned=false;
 const fingerprint=m=>JSON.stringify([m.op,m.revision??null,m.seed??null,m.first??null]);
 const summary=()=>({revision:current.revision,...engine.summary()});
 async function execute(raw) {
  const m=packet(raw);if(m.epoch!==epoch)fail('STALE_SESSION');
  if(poisoned)fail('RECOVERY_REQUIRED');
  if(m.op==='create'||m.op==='resume') {
   if(current)fail('ALREADY_OPEN');
   const saved=await storage.read();
   if(m.op==='resume') {
    if(!saved)fail('NO_SAVE');
    if(saved.version!==version||saved.schema!==1)fail('INCOMPATIBLE_SAVE');
    engine.restore(saved.engine);current=saved;return summary();
   }
   if(saved)fail('ALREADY_EXISTS');
   engine.start(m.seed,m.first);
   const next={schema:1,version,seed:m.seed,first:m.first,revision:0,policyRng:0x63d34a91,history:[],receipts:{},engine:engine.save()};
   await storage.write(next,null);current=next;return summary();
  }
  if(!current)fail('NOT_OPEN');
  if(m.op==='status')return summary();
  const prior=Object.hasOwn(current.receipts,m.id)?current.receipts[m.id]:null,fp=fingerprint(m);
  if(prior){if(prior.fingerprint!==fp)fail('ID_COLLISION');return structuredClone(prior.response);}
  if(m.revision!==current.revision)fail('STALE_REVISION');
  if(current.revision>=20000)fail('ACTION_LIMIT');
  if(engine.summary().terminal)fail('GAME_OVER');
  const legal=engine.legal();
  if(!legal.actions?.length)fail('NO_LEGAL_ACTOR');
  // The decision worker sees summaries, never an engine save, events, object
  // handles, unknown card identities or ordered libraries.
  const proposal=await choose(legal.actions,current.policyRng);
  if(!Number.isInteger(proposal.index)||proposal.index<0||proposal.index>=legal.actions.length||!Number.isInteger(proposal.rng)||proposal.rng<0||proposal.rng>0xffffffff)fail('BAD_PROPOSAL');
  const action=legal.actions[proposal.index],now=engine.legal();
  if(now.actor!==legal.actor||!now.actions.some(a=>JSON.stringify(a)===JSON.stringify(action)))fail('STALE_ACTION');
  try {
   engine.apply(legal.actor,action);
   const next={...current,revision:current.revision+1,policyRng:proposal.rng,
    history:[...current.history,{actor:legal.actor,action}],engine:engine.save(),receipts:{...current.receipts}};
   const response={revision:next.revision,...engine.summary()};
   Object.defineProperty(next.receipts,m.id,{value:{fingerprint:fp,response},enumerable:true,writable:true,configurable:true});
   // Compare-and-write prevents a second tab/worker overwriting this match.
   await storage.write(next,current.revision);
   current=next;return structuredClone(response);
  } catch(error) {
   try{engine.restore(current.engine);}catch{poisoned=true;}
   // A failed transaction or conflicting writer requires reloading the durable
   // record. No automatic resend and no claim that a timeout rolled back.
   poisoned=true;throw error;
  }
 }
 return raw=>{
  const task=queue.then(()=>execute(raw)).then(result=>({v:1,epoch,id:raw.id,ok:true,result}),
   error=>({v:1,epoch,id:typeof raw?.id==='string'?raw.id.slice(0,80):null,ok:false,error:error instanceof Fault?error.code:'RECOVERY_REQUIRED'}));
  queue=task.then(()=>undefined);return task;
 };
}
