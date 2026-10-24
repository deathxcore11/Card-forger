// Internal diagnostic facade. A timeout has uncertain outcome. Explicit resume
// in a new worker reads the durable receipt; this client never retries a move.
export function connect(match,{timeout=30000}={}) {
 const epoch=crypto.randomUUID(),worker=new Worker(new URL('./browser-authority.mjs',import.meta.url),{type:'module'});
 const pending=new Map();let closed=false;
 function close(){if(closed)return;closed=true;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('WORKER_CLOSED'));}pending.clear();}
 worker.onmessage=({data})=>{if(closed||data?.epoch!==epoch)return;const p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.ok?p.resolve(data.result):p.reject(Error(data.error));};
 worker.onerror=()=>close();worker.onmessageerror=()=>close();
 function send(message){return new Promise((resolve,reject)=>{
  if(closed)return reject(Error('WORKER_CLOSED'));
  if(pending.has(message.id))return reject(Error('REQUEST_PENDING'));
  const timer=setTimeout(()=>{pending.delete(message.id);reject(Error('OUTCOME_UNKNOWN'));close();},timeout);
  pending.set(message.id,{resolve,reject,timer});worker.postMessage({...message,v:1,epoch});
 });}
 const ready=send({id:'bind',op:'bind',match});
 return {ready,close,request:async(op,fields={})=>{await ready;return send({...fields,op,id:fields.id||crypto.randomUUID()});}};
}
