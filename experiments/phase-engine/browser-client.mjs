// Internal diagnostic facade. A timeout has uncertain outcome. Explicit resume
// in a new worker reads the durable receipt; this client never retries a move.
export function connect(match,{timeout=30000,mode='auto'}={}) {
 const epoch=crypto.randomUUID(),worker=new Worker(new URL('./browser-authority.mjs',import.meta.url),{type:'module'});
 const pending=new Map();let closed=false;
 function close(){if(closed)return;closed=true;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(p.mutates?'OUTCOME_UNKNOWN':'WORKER_CLOSED'));}pending.clear();}
 worker.onmessage=({data})=>{
  if(closed||data?.epoch!==epoch)return;
  const p=pending.get(data.id);if(!p)return;
  if(data.v!==1||typeof data.ok!=='boolean'||(!data.ok&&(typeof data.error!=='string'||!/^[-A-Z_]{1,80}$/.test(data.error)))){close();return;}
  pending.delete(data.id);clearTimeout(p.timer);data.ok?p.resolve(data.result):p.reject(Error(data.error));
  if(data.id==='bind'&&!data.ok)close();
 };
 worker.onerror=()=>close();worker.onmessageerror=()=>close();
 function send(message){return new Promise((resolve,reject)=>{
  if(closed)return reject(Error('WORKER_CLOSED'));
  if(pending.has(message.id))return reject(Error('REQUEST_PENDING'));
  const timer=setTimeout(()=>{pending.delete(message.id);reject(Error('OUTCOME_UNKNOWN'));close();},timeout);
  pending.set(message.id,{resolve,reject,timer,mutates:message.op==='create'||message.op==='step'});
  try{worker.postMessage({...message,v:1,epoch});}
  catch{clearTimeout(timer);pending.delete(message.id);reject(Error('REQUEST_NOT_SENT'));}
 });}
 const ready=send({id:'bind',op:'bind',match,mode});
 return {ready,close,request:async(op,fields={})=>{await ready;return send({...fields,op,id:fields.id||crypto.randomUUID()});}};
}
