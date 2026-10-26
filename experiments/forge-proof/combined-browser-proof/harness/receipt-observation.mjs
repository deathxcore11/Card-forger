// LOCAL_TEST_NOT_DEPLOYABLE. Retain only completed response bytes already sent
// by the fixture. No host/native calls, commands, replay or outcome inference.
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const COMMAND='[A-Za-z0-9_-]{16,128}';
const ACTION=new RegExp('^/api/play/matches/('+UUID+')/actions$');
const OBSERVE=new RegExp('^/__fixture/receipts/('+UUID+')/('+COMMAND+')$');
const UUID_RE=new RegExp('^'+UUID+'$'),COMMAND_RE=new RegExp('^'+COMMAND+'$');
const NO_CAPTURE=Object.freeze({chunk(){},complete(){}});
const reply=(status,body)=>({status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body});

export class FixtureReceiptCache {
 #records=new Map();
 constructor({bearer,viewerObservations,maximumRecords=8}){
  if(typeof bearer!=='string'||!bearer||!viewerObservations||!Number.isInteger(maximumRecords)||maximumRecords<1||maximumRecords>8)throw TypeError('bounded receipt observation required');
  this.authorization='Bearer '+bearer;this.viewerObservations=viewerObservations;this.maximumRecords=maximumRecords;
 }
 capture({method,url,headers,httpStatus,response}){
  const target=new URL(url),route=ACTION.exec(target.pathname),incoming=new Headers(headers);
  if(method!=='POST'||!route||target.search||target.hash||incoming.get('Authorization')!==this.authorization)return NO_CAPTURE;
  const matchId=route[1];
  // Bind to the generation already delivered on this exact viewer route.
  const previous=this.viewerObservations.observe({method:'GET',url:new URL('/__fixture/observe/'+matchId,target),headers:incoming});
  if(previous.status!==200||!UUID_RE.test(previous.body.generation))return NO_CAPTURE;
  const generation=previous.body.generation;
  let chunks=[],length=0,finished=false,complete=false,invalid=false,pending=null;
  const commit=()=>{
   if(!finished||!complete||invalid||!pending)return;
   const key=matchId+'/'+pending.commandId;
   // Never overwrite the receipt for a command; a replay cannot manufacture a
   // different observed outcome. Product requests themselves are unchanged.
   if(!this.#records.has(key))this.#records.set(key,{fixtureOnly:true,matchId,generation,httpStatus,body:pending});
   pending=null;
   while(this.#records.size>this.maximumRecords)this.#records.delete(this.#records.keys().next().value);
  };
  const invalidate=()=>{if(!finished){invalid=true;chunks=[];pending=null;}};
  response.once('finish',()=>{finished=true;commit();});response.once('close',invalidate);response.once('error',invalidate);
  return {
   chunk(bytes){if(invalid||complete)return;length+=bytes.byteLength;if(length>4096){invalid=true;chunks=[];return;}chunks.push(Buffer.from(bytes));},
   complete(){
    if(invalid||complete)return;complete=true;
    try{
     const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,length)));chunks=[];
     if(!body||typeof body!=='object'||Array.isArray(body)||!COMMAND_RE.test(body.commandId||''))return;
     pending=body;commit();
    }catch{invalid=true;chunks=[];}
   },
  };
 }
 observe({method,url,headers}){
  const incoming=new Headers(headers);
  if(incoming.get('Authorization')!==this.authorization)return reply(401,{error:'fixture_authorization_required'});
  if(method!=='GET')return reply(405,{error:'fixture_observation_get_only'});
  const target=new URL(url),route=OBSERVE.exec(target.pathname),generation=incoming.get('X-Fixture-Generation');
  if(target.search||target.hash||!route||!UUID_RE.test(generation||''))return reply(400,{error:'fixture_receipt_binding_required'});
  const record=this.#records.get(route[1]+'/'+route[2]);
  if(!record)return reply(202,{fixtureOnly:true,status:'waiting'});
  if(record.generation!==generation)return reply(404,{error:'fixture_generation_mismatch'});
  return reply(200,structuredClone(record));
 }
}

export async function deliveredActionReceipt({base,token,matchId,request,httpStatus,fetchImpl=fetch,timeoutMs=1000}){
 if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)||!UUID_RE.test(matchId||'')||!UUID_RE.test(request?.generation||'')||!COMMAND_RE.test(request?.commandId||''))return null;
 const signal=AbortSignal.timeout(timeoutMs),url=base+'/__fixture/receipts/'+matchId+'/'+request.commandId;
 try{
  for(;;){
   const response=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token,'X-Fixture-Generation':request.generation},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal});
   if(response.status===202){await response.body?.cancel();await new Promise(r=>setTimeout(r,25));signal.throwIfAborted();continue;}
   if(response.status!==200){void response.body?.cancel().catch(()=>{});return null;}
   const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>8192)return null;
   const record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(record.fixtureOnly!==true||record.matchId!==matchId||record.generation!==request.generation||record.httpStatus!==httpStatus||record.body?.commandId!==request.commandId)return null;
   return record.body;
  }
 }catch{return null;}
}
