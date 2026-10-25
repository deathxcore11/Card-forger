// A Practice worker belongs to one account generation. Never retry a move after
// a timeout. Durable mode may resume a new worker and read its receipt; the
// explicit session-only beta discards the retired worker instead.
export function connectPractice({ownerId,match,input,resume=false,sessionOnly=false,isCurrent=()=>true,onProgress=()=>{},timeout=30000,bootTimeout=180000,workerFactory=()=>new Worker(new URL('./practice-authority.mjs',import.meta.url),{type:'module'})}={}){
 if(typeof sessionOnly!=='boolean'||typeof resume!=='boolean')throw Error('INVALID_MATCH_OPTIONS');
 if(sessionOnly&&resume)throw Error('SESSION_RESUME_UNAVAILABLE');
 if(typeof isCurrent!=='function'||typeof onProgress!=='function'||!isCurrent())throw Error('ACCOUNT_CHANGED');
 const epoch=crypto.randomUUID(),worker=workerFactory(),pending=new Map();let closed=false;
 function close(reason='WORKER_CLOSED'){
  if(closed)return;closed=true;worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(p.mutates?'OUTCOME_UNKNOWN':reason));}pending.clear();
 }
 worker.onmessage=({data})=>{
  if(closed)return;if(!isCurrent()){close('ACCOUNT_CHANGED');return;}if(data?.epoch!==epoch)return;
  if(data.id==='loading'){if(data.v===1&&['download','rules','ready'].includes(data.progress?.stage)&&Number.isFinite(data.progress.completed)&&Number.isFinite(data.progress.total)&&data.progress.completed>=0&&data.progress.total>0&&data.progress.completed<=data.progress.total)onProgress(structuredClone(data.progress));return;}
  const p=pending.get(data.id);if(!p)return;
  if(data.v!==1||typeof data.ok!=='boolean'||!data.ok&&(typeof data.error!=='string'||!/^[-A-Z_]{1,80}$/.test(data.error))){close();return;}
  if(data.id==='bind'&&data.ok&&sessionOnly&&data.result?.sessionOnly!==true){pending.delete(data.id);clearTimeout(p.timer);p.reject(Error('SESSION_MODE_MISMATCH'));close();return;}
  pending.delete(data.id);clearTimeout(p.timer);data.ok?p.resolve(data.result):p.reject(Error(data.error));if(data.id==='bind'&&!data.ok)close();
 };
 worker.onerror=()=>close();worker.onmessageerror=()=>close();
 function send(message){return new Promise((resolve,reject)=>{
  if(!isCurrent()){close('ACCOUNT_CHANGED');return reject(Error('ACCOUNT_CHANGED'));}if(closed)return reject(Error('WORKER_CLOSED'));if(pending.has(message.id))return reject(Error('REQUEST_PENDING'));
  const mutates=['create','step','respond','tick','act'].includes(message.op),timer=setTimeout(()=>{pending.delete(message.id);reject(Error(mutates?'OUTCOME_UNKNOWN':'WORKER_TIMEOUT'));close();},message.op==='bind'?bootTimeout:timeout);
  pending.set(message.id,{resolve,reject,timer,mutates});try{worker.postMessage({...message,v:1,epoch});}catch{clearTimeout(timer);pending.delete(message.id);reject(Error('REQUEST_NOT_SENT'));}
 });}
 const ready=send({id:'bind',op:'bind',ownerId,match,operation:resume?'resume':'create',sessionOnly,...(!resume?{input}:{})});
 return {ready,close,request:async(op,fields={})=>{if(sessionOnly&&op==='resume')throw Error('SESSION_RESUME_UNAVAILABLE');await ready;return send({...fields,op,id:fields.id||crypto.randomUUID()});},reconcile(){if(!isCurrent())close('ACCOUNT_CHANGED');return !closed;}};
}
