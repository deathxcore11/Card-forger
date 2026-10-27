import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNativeBackendRequest as check, withNativeResponseHeaders as wrap, createSupabaseBearerVerifier } from '../staging/native-backend-contract.js';
import { NATIVE_ORIGIN, SERVICE_ORIGIN } from '../runtime/native-service-policy.js';
const verifiedUser={id:'12345678-1234-4234-8234-123456789abc',is_anonymous:false};
const req=(path='/api/ai/ask',method='POST',extra={})=>new Request(SERVICE_ORIGIN+path,{method,headers:{Origin:NATIVE_ORIGIN,...extra},...(['GET','OPTIONS'].includes(method)?{}:{body:'{}'})});
test('native preflight restricts origin, methods and route-specific headers',async()=>{
  const result=await check(req('/api/ai/ask','OPTIONS',{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type, Authorization'}));
  assert.equal(result.response.status,204);assert.equal(result.response.headers.get('Access-Control-Allow-Origin'),NATIVE_ORIGIN);assert.equal(result.response.headers.get('Access-Control-Allow-Credentials'),null);
  for(const headers of [{Origin:'null'},{Origin:'https://evil.test'},{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Headers':'Cookie'}]) assert.ok((await check(req('/api/ai/ask','OPTIONS',{'Access-Control-Request-Method':'POST',...headers}))).response.status>=400);
  assert.equal((await check(req('/api/daily-card','OPTIONS',{'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Authorization'}))).response.status,403);
});
test('no model admission without verified non-anonymous user; web remains origin protected',async()=>{
  for(const origin of [NATIVE_ORIGIN,SERVICE_ORIGIN]){
    assert.equal((await check(req(undefined,'POST',{Origin:origin}))).response.status,401);
    for(const verifyBearer of [undefined,async()=>null,async()=>{throw Error('offline');},async()=>({id:'anon',is_anonymous:true})]) assert.equal((await check(req(undefined,'POST',{Origin:origin,Authorization:'Bearer valid.token'}),{verifyBearer})).response.status,401);
    const admitted=await check(req(undefined,'POST',{Origin:origin,Authorization:'Bearer valid.token'}),{verifyBearer:async()=>verifiedUser}); assert.equal(admitted.allowed,true);
  }
  assert.equal((await check(req(undefined,'POST',{Origin:SERVICE_ORIGIN,'Sec-Fetch-Site':'cross-site',Authorization:'Bearer valid.token'}),{verifyBearer:async()=>verifiedUser})).response.status,403);
});
test('preserves body and delegates rate/body/owner checks after authentication',async()=>{
  const input=req(undefined,'POST',{Authorization:'Bearer valid.token'});const admitted=await check(input,{verifyBearer:async()=>verifiedUser});
  assert.equal(admitted.request,input);assert.equal(await input.text(),'{}');
  const response=wrap(new Response('quota',{status:429,headers:{'Retry-After':'60',Vary:'Accept-Encoding'}}),admitted);
  assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');assert.match(response.headers.get('Vary'),/Origin/);
  const original=new Response('web');assert.equal(wrap(original,{allowed:true,native:false}),original);
  assert.equal((await check(req('/api/prices/conditions','GET',{Authorization:'Bearer valid.token'}))).user,null,'owner-only check remains in condition route');
});
test('rejects native cookies, unknown routes, unapproved host and bearer destination',async()=>{
  for(const input of [req(undefined,'POST',{Cookie:'session=x'}),req('/api/unknown','GET'),new Request('https://evil.test/api/daily-card',{headers:{Origin:NATIVE_ORIGIN}}),req('/api/daily-card','GET',{Authorization:'Bearer token'})]) assert.equal((await check(input)).allowed,false);
});
test('hosted Play: exact preflight, signed-in admission, and the host keeps account verification',async()=>{
  const match='/api/play/matches/0123abcd-0000-4000-8000-00000000beef',pre=(path,method,headers)=>check(req(path,'OPTIONS',{'Access-Control-Request-Method':method,'Access-Control-Request-Headers':headers}));
  for(const [path,method,headers] of [['/api/play/matches','POST','Content-Type, Authorization, Idempotency-Key'],[match,'GET','Authorization'],[match,'DELETE','Authorization'],[match+'/actions','POST','Content-Type, Authorization']]){
    const response=(await pre(path,method,headers)).response;
    assert.equal(response.status,204,path+' '+method);assert.equal(response.headers.get('Access-Control-Allow-Origin'),NATIVE_ORIGIN);assert.equal(response.headers.get('Access-Control-Allow-Methods'),method);
    assert.equal(response.headers.get('Access-Control-Allow-Headers'),headers.toLowerCase());assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
  }
  for(const [path,method,headers,status] of [[match,'POST','Authorization',405],['/api/play/matches','GET','Authorization',405],[match+'/actions','DELETE','Authorization',405],[match,'GET','Authorization, Idempotency-Key',403],[match+'/actions','POST','Authorization, Idempotency-Key',403],['/api/play/matches','POST','Authorization, Cookie',403],['/api/play/matches','POST','X-User-ID',403],['/api/play/matches/'+'0123ABCD-0000-4000-8000-00000000BEEF','GET','Authorization',404]])
    assert.equal((await pre(path,method,headers)).response.status,status,path+' '+method+' '+headers);
  assert.equal((await check(new Request(SERVICE_ORIGIN+match,{method:'OPTIONS',headers:{Origin:'https://evil.test','Access-Control-Request-Method':'GET'}}))).response.status,403);
  let verified=0;const verifyBearer=async()=>{verified++;return verifiedUser;};
  for(const input of [req(match,'GET'),req(match,'DELETE'),req(match,'GET',{Authorization:'Basic x'}),req('/api/play/matches','POST',{'Content-Type':'application/json'})])assert.equal((await check(input,{verifyBearer})).response.status,input.headers.has('Authorization')?403:401);
  for(const input of [req(match,'GET',{Authorization:'Bearer t',Cookie:'s=1'}),req(match,'GET',{Authorization:'Bearer t','Idempotency-Key':'0d1c7f5e-1b9c-4b55-9f1e-3c2a5d6e7f80'}),req('/api/ai/ask','POST',{Authorization:'Bearer t','Idempotency-Key':'0d1c7f5e-1b9c-4b55-9f1e-3c2a5d6e7f80'})])assert.equal((await check(input,{verifyBearer})).response.status,403);
  for(const input of [req('/api/play/matches','POST',{Authorization:'Bearer t','Content-Type':'application/json','Idempotency-Key':'0d1c7f5e-1b9c-4b55-9f1e-3c2a5d6e7f80'}),req(match,'GET',{Authorization:'Bearer t'}),req(match,'DELETE',{Authorization:'Bearer t'}),req(match+'/actions','POST',{Authorization:'Bearer t','Content-Type':'application/json'})]){
    const admitted=await check(input,{verifyBearer});assert.deepEqual([admitted.allowed,admitted.native,admitted.route.play,admitted.user,admitted.request],[true,true,true,null,input]);
  }
  assert.equal(verified,0,'the website does not stand in for the host account check');
  const busy=wrap(new Response('{"error":"forge_host_unavailable"}',{status:503,headers:{'Retry-After':'30'}}),{allowed:true,native:true});
  assert.equal(busy.headers.get('Access-Control-Expose-Headers'),'Retry-After');assert.equal(busy.headers.get('Retry-After'),'30');
  assert.equal(wrap(new Response(null,{status:204}),{allowed:true,native:true}).headers.get('Access-Control-Expose-Headers'),null);
});
test('Supabase verifier uses only existing public config and rejects failures/anonymous sessions',async()=>{
  let seen;const verify=createSupabaseBearerVerifier({url:'https://example.supabase.co',key:'existing-public-key',fetcher:async(...args)=>{seen=args;return Response.json(verifiedUser);}});
  assert.deepEqual(await verify('Bearer test.jwt'),verifiedUser);assert.equal(seen[0],'https://example.supabase.co/auth/v1/user');assert.equal(seen[1].redirect,'manual');assert.equal(seen[1].headers.apikey,'existing-public-key');
  for(const fetcher of [async()=>new Response('',{status:401}),async()=>Response.json({id:'anon',is_anonymous:true}),async()=>{throw Error('network');}])assert.equal(await createSupabaseBearerVerifier({url:'https://example.supabase.co',key:'existing-public-key',fetcher})('Bearer test.jwt'),null);
  assert.throws(()=>createSupabaseBearerVerifier({url:'http://example.supabase.co',key:'key',fetcher:()=>{}}));
});
