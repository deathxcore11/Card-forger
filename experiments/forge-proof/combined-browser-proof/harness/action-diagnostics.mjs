// Test-only, bounded receipt metadata. No raw bodies, card IDs, account IDs,
// command IDs, generations, messages or credentials enter the evidence record.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const allowed=JSON.parse(readFileSync(new URL('./action-diagnostics.json',import.meta.url),'utf8'));
const stages=new Set([...allowed.stages,...[...allowed.inputTypes,...allowed.promptMethods].map(v=>'native '+v)]);
const member=(values,value,fallback='unknown')=>typeof value==='string'&&values.includes(value)?value:fallback;
const integer=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const digest=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(value)?createHash('sha256').update(value).digest('hex'):null;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:null;
export const safeActionStage=value=>typeof value==='string'&&stages.has(value)?value:'unknown';
// Sequence is observation order in this browser driver, not a complete engine
// event log. Delivered-state observation is sampled and may omit transitions.
export function actionEvent(value){
 return {order:integer(value.order),event:member(['action-submitted','action-receipt-read','viewer-state-observed'],value.event),
  revision:integer(value.revision),observedRevision:integer(value.observedRevision),requestRevision:integer(value.requestRevision),decisionId:integer(value.decisionId),requestDecisionId:integer(value.requestDecisionId),
  inputType:member(allowed.inputTypes,value.inputType),operation:member(allowed.operations,value.operation),
  busy:typeof value.busy==='boolean'?value.busy:null,
  commandHash:hash(value.commandHash),
  generationHash:hash(value.generationHash),
  state:member(['accepted','rejected','pending_outcome_unknown'],value.state),
  httpStatus:Number.isInteger(value.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599?value.httpStatus:null};
}
export function actionMetadata({stage,inputType,decisionId,observedRevision,httpStatus,request,receipt}={}){
 const commandHash=digest(request?.commandId),receiptCommandHash=digest(receipt?.commandId);
 const bound=commandHash!==null&&receiptCommandHash===commandHash;
 const rejected=[400,409].includes(httpStatus)&&bound&&receipt?.state==='rejected';
 return {
  stage:safeActionStage(stage),inputType:member(allowed.inputTypes,inputType),
  decisionId:integer(decisionId),observedRevision:integer(observedRevision),
  requestRevision:integer(request?.action?.revision),requestDecisionId:integer(request?.action?.promptId),operation:member(allowed.operations,request?.action?.op),
  commandHash,receiptCommandHash,generationHash:digest(request?.generation),
  httpStatus:Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:null,
  state:rejected?'rejected':httpStatus===202&&bound?member(['accepted','pending_outcome_unknown'],receipt?.state):'unknown',
  reason:rejected?member(allowed.reasons,receipt?.error,'native_action_rejected'):null,
 };
}
export async function readActionMetadata(response,context,{timeoutMs=1000}={}){
 // This observes the response to the one rendered action. It never sends or
 // retries a request. response.body() is Playwright's buffered observation of
 // the existing host's bounded receipt, not a streaming memory-limit boundary.
 // Missing, malformed, oversized or stalled receipt bodies
 // retain a generic classification under a separate bounded observation wait.
 let timer,body;
 try{
  body=await Promise.race([
   Promise.resolve().then(()=>response.body()),
   new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);}),
  ]);
 }catch{}finally{clearTimeout(timer);}
 let receipt=null;
 if(body instanceof Uint8Array&&body.byteLength<=4096){
  try{receipt=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{}
 }
 let request=null;
 try{request=response.request().postDataJSON();}catch{}
 return actionMetadata({...context,httpStatus:response.status(),request,receipt});
}
