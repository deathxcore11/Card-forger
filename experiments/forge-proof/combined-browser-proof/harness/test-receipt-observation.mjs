import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {FixtureObservationCache} from './observation.mjs';
import {FixtureReceiptCache,deliveredActionReceipt} from './receipt-observation.mjs';
import {readActionMetadata} from './action-diagnostics.mjs';
const base='http://127.0.0.1:8765',token='SYNTHETIC_ONLY',matchId='11111111-1111-4111-8111-111111111111',generation='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const request={commandId:'fixture-command-0001',generation,action:{op:'reply',revision:1,promptId:3}};
const headers={Authorization:'Bearer '+token};
const receipt={commandId:request.commandId,state:'accepted'};
function fixture(){
 const viewerObservations=new FixtureObservationCache({bearer:token});
 const cache=new FixtureReceiptCache({bearer:token,viewerObservations});
 const response=new EventEmitter(),capture=viewerObservations.capture({method:'GET',url:base+'/api/play/matches/'+matchId,headers,httpStatus:200,response});
 capture.chunk(Buffer.from(JSON.stringify({matchId,generation,status:'running'})));capture.complete();response.emit('finish');
 return cache;
}
function deliver(cache,{body=receipt,finish=true,event=null,httpStatus=202,method='POST',authorization=headers.Authorization,match=matchId}={}){
 const response=new EventEmitter(),capture=cache.capture({method,url:base+'/api/play/matches/'+match+'/actions',headers:{Authorization:authorization},httpStatus,response});
 capture.chunk(typeof body==='string'?Buffer.from(body):Buffer.from(JSON.stringify(body)));capture.complete();if(event)response.emit(event);if(finish)response.emit('finish');return response;
}
function observe(cache,{method='GET',gen=generation,authorization=headers.Authorization,id=request.commandId,match=matchId}={}){
 return cache.observe({method,url:base+'/__fixture/receipts/'+match+'/'+id,headers:{Authorization:authorization,'X-Fixture-Generation':gen}});
}
test('receipt records only a completely delivered original response, including finish ordering',()=>{
 const cache=fixture();const res=deliver(cache,{finish:false});assert.equal(observe(cache).status,202);
 res.emit('finish');assert.deepEqual(observe(cache).body,{fixtureOnly:true,matchId,generation,httpStatus:202,body:receipt});
 observe(cache).body.body.state='rejected';assert.equal(observe(cache).body.body.state,'accepted');
 deliver(cache,{body:{...receipt,state:'pending_outcome_unknown'}});assert.equal(observe(cache).body.body.state,'accepted');
});
test('partial, malformed, oversized, unauthorized and wrong-route responses cannot establish a receipt',()=>{
 for(const args of [{event:'close'},{event:'error'},{body:'{'},{body:'x'.repeat(4097)},{authorization:'Bearer wrong'},{method:'GET'},{match:other},{body:{state:'accepted'}},{body:{...receipt,commandId:'bad/identifier'}}]){
  const cache=fixture();deliver(cache,args);assert.equal(observe(cache).status,202,JSON.stringify(args).slice(0,120));
 }
 const cache=fixture();deliver(cache);assert.equal(observe(cache,{authorization:'Bearer wrong'}).status,401);assert.equal(observe(cache,{gen:other}).status,404);assert.equal(observe(cache,{gen:'bad'}).status,400);assert.equal(observe(cache,{method:'POST'}).status,405);
});
test('receipt cache has a hard eight-command bound',()=>{
 const cache=fixture();for(let i=0;i<9;i++)deliver(cache,{body:{commandId:'fixture-command-000'+i,state:'accepted'}});
 assert.equal(observe(cache,{id:'fixture-command-0000'}).status,202);assert.equal(observe(cache,{id:'fixture-command-0008'}).status,200);
});
test('browser observer uses only authenticated passive GETs and binds every receipt identity',async()=>{
 const cache=fixture();deliver(cache);let reads=0;
 const fetchImpl=async(url,options)=>{reads++;assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,headers.Authorization);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');const r=cache.observe({method:options.method,url,headers:options.headers});return Response.json(r.body,{status:r.status});};
 assert.deepEqual(await deliveredActionReceipt({base,token,matchId,request,httpStatus:202,fetchImpl}),receipt);assert.equal(reads,1);
 for(const change of [{matchId:other},{generation:other},{httpStatus:409},{fixtureOnly:false},{body:{...receipt,commandId:'different-command-001'}}]){
  const fetchWrong=async()=>Response.json({...observe(cache).body,...change});
  assert.equal(await deliveredActionReceipt({base,token,matchId,request,httpStatus:202,fetchImpl:fetchWrong}),null);
 }
});
test('missing receipt remains unknown within a fixed read budget and never posts',async()=>{
 let reads=0;
 const result=await deliveredActionReceipt({base,token,matchId,request,httpStatus:202,timeoutMs:30,fetchImpl:async(url,options)=>{assert.equal(options.method,'GET');reads++;return Response.json({status:'waiting'},{status:202});}});
 assert.equal(result,null);assert(reads>=1&&reads<=3);
});
test('unavailable browser body recovers only a completed command-bound receipt; unknown outcomes remain unknown',async()=>{
 for(const state of ['accepted','pending_outcome_unknown']){
  const cache=fixture();deliver(cache,{body:{...receipt,state}});let postReads=0;
  const response={status:()=>202,request:()=>({postDataJSON:()=>request}),body:async()=>{postReads++;throw Error('Body unavailable');}};
  const d=await readActionMetadata(response,{}, {readDeliveredReceipt:({request,httpStatus})=>deliveredActionReceipt({base,token,matchId,request,httpStatus,fetchImpl:async(url,options)=>{const r=cache.observe({method:options.method,url,headers:options.headers});return Response.json(r.body,{status:r.status});}})});
  assert.equal(d.state,state);assert.equal(d.bodyRead,'unavailable');assert.equal(d.receiptSource,'fixture-forwarded-response');assert.equal(postReads,1);
 }
});
test('fallback cannot override readable rejection, mismatched, malformed or oversized browser receipts',async()=>{
 for(const [status,body]of [[409,JSON.stringify({...receipt,state:'rejected',error:'stale_prompt'})],[202,JSON.stringify({...receipt,commandId:'different-command-001'})],[202,'null'],[202,'{'],[202,'x'.repeat(4097)]]){
  let fallback=0;const d=await readActionMetadata({status:()=>status,request:()=>({postDataJSON:()=>request}),body:async()=>Buffer.from(body)}, {}, {readDeliveredReceipt:async()=>{fallback++;return receipt;}});
  assert.equal(fallback,0);assert.notEqual(d.state,'accepted');
 }
});
