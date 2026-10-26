// Diagnostic contract tests only. These do not run a browser or native game.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {actionMetadata,readActionMetadata,safeActionStage} from './action-diagnostics.mjs';
const allowed=JSON.parse(await readFile(new URL('./action-diagnostics.json',import.meta.url),'utf8'));
const canary='PRIVATE_CANARY_NEVER_UPLOAD';
const request={commandId:'command-fixture-00001',generation:'00000000-0000-4000-8000-000000000001',action:{revision:32,op:'ok',promptId:3,cardName:canary,id:canary}};
const context={stage:'native InputPayManaOfCostPayment',inputType:'InputPayManaOfCostPayment',decisionId:4,observedRevision:31};
const mock=(body,status=409)=>({status:()=>status,request:()=>({postDataJSON:()=>request}),body:async()=>Buffer.from(JSON.stringify(body))});
test('exact rejection enum, revisions and correlation survive without raw identifiers',async()=>{
 for(const reason of allowed.reasons){
  const d=await readActionMetadata(mock({state:'rejected',error:reason,commandId:request.commandId,private:canary}),context);
  assert.equal(d.reason,reason);assert.equal(d.stage,context.stage);assert.equal(d.inputType,context.inputType);
  assert.equal(d.httpStatus,409);assert.equal(d.state,'rejected');assert.equal(d.requestRevision,32);assert.equal(d.observedRevision,31);assert.equal(d.decisionId,4);assert.equal(d.requestDecisionId,3);assert.equal(d.operation,'ok');
  assert.equal(d.receiptCommandHash,d.commandHash);
  assert.equal(d.commandHash,createHash('sha256').update(request.commandId).digest('hex'));
  assert.equal(d.generationHash,createHash('sha256').update(request.generation).digest('hex'));
  assert(!JSON.stringify(d).includes(canary));assert(!JSON.stringify(d).includes(request.commandId));assert(!JSON.stringify(d).includes(request.generation));
 }
});
test('unknown, compound and injected labels or native prose reduce to fixed fallback',()=>{
 for(const text of [canary,'native InputPayMana '+canary,'native InputPayManaOfCostPayment;stale_prompt','ok_disabled '+canary,{},['stale_revision'],null]){
  const d=actionMetadata({stage:text,inputType:text,httpStatus:400,receipt:{error:text},request:{commandId:text,generation:text,action:{op:text,revision:-1}},observedRevision:NaN,decisionId:Infinity});
  assert.equal(d.stage,'unknown');assert.equal(d.inputType,'unknown');assert.equal(d.reason,null);assert.equal(d.state,'unknown');assert.equal(d.operation,'unknown');assert.equal(d.requestRevision,null);assert.equal(d.observedRevision,null);assert.equal(d.decisionId,null);assert(!JSON.stringify(d).includes(canary));
 }
 assert.equal(safeActionStage('native InputPayMana'),'native InputPayMana');
 assert.equal(safeActionStage('native getAbilityToPlay'),'native getAbilityToPlay');
});
test('accepted and uncertain receipts retain status without false rejection cause',async()=>{
 for(const state of ['accepted','pending_outcome_unknown',canary]){
  const d=await readActionMetadata(mock({state,error:'stale_revision',commandId:request.commandId},202),context);
  assert.equal(d.httpStatus,202);assert.equal(d.reason,null);assert.equal(d.state,state===canary?'unknown':state);
 }
});
test('unreadable, oversized and stalled response bodies do not lose status or retry',async()=>{
 const readers=[async()=>{throw Error(canary);},async()=>Buffer.from('{'),async()=>Buffer.alloc(4097),()=>new Promise(()=>{})];
 for(const reader of readers){
  let calls=0;const response={...mock(null),body:()=>{calls++;return reader();}};
  const d=await readActionMetadata(response,context,{timeoutMs:10});
  assert.equal(calls,1);assert.equal(d.httpStatus,409);assert.equal(d.reason,null);assert.equal(d.state,'unknown');assert(!JSON.stringify(d).includes(canary));
 }
});
test('transport and unbound receipts stay unknown instead of claiming a native rejection',async()=>{
 for(const status of [200,401,403,410,429,500,503]){
  const d=await readActionMetadata(mock({state:'rejected',error:'stale_revision',commandId:request.commandId},status),context);
  assert.equal(d.state,'unknown');assert.equal(d.reason,null);assert.equal(d.httpStatus,status);
 }
 for(const status of [202,400,409])for(const commandId of [undefined,'different-command-0001',canary]){
  const d=await readActionMetadata(mock({state:status===202?'accepted':'rejected',error:'stale_revision',commandId},status),context);
  assert.equal(d.state,'unknown');assert.equal(d.reason,null);
 }
 const d=await readActionMetadata(mock({state:'rejected',error:canary,commandId:request.commandId}),context);
 assert.equal(d.state,'rejected');assert.equal(d.reason,'native_action_rejected');
});
test('browser captures original decision before submission and records rejection before asserting',async()=>{
 const source=await readFile(new URL('./browser-journey.mjs',import.meta.url),'utf8');
 assert(source.includes('const before=latest?.snapshot,old=before?.revision'));
 assert(source.includes('inputType:before?.inputType,decisionId:before?.prompt?.id,observedRevision:old'));
 assert(source.indexOf('report.actionRejection=diagnostic')<source.indexOf("assert.equal(response.value.status(),202,'Host rejected rendered action')"));
 assert(source.includes('if(report.actionDiagnostics.length<64)'));
 assert(!source.includes('hitCardId'));
});
