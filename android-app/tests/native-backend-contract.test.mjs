import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNativeBackendRequest as check, withNativeResponseHeaders as wrap, createSupabaseBearerVerifier } from '../staging/native-backend-contract.js';
import { NATIVE_ORIGIN, SERVICE_ORIGIN } from '../runtime/native-service-policy.js';
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
    const admitted=await check(req(undefined,'POST',{Origin:origin,Authorization:'Bearer valid.token'}),{verifyBearer:async()=>({id:'synthetic-user'})}); assert.equal(admitted.allowed,true);
  }
  assert.equal((await check(req(undefined,'POST',{Origin:SERVICE_ORIGIN,'Sec-Fetch-Site':'cross-site',Authorization:'Bearer valid.token'}),{verifyBearer:async()=>({id:'u'})})).response.status,403);
});
test('preserves body and delegates rate/body/owner checks after authentication',async()=>{
  const input=req(undefined,'POST',{Authorization:'Bearer valid.token'});const admitted=await check(input,{verifyBearer:async()=>({id:'u'})});
  assert.equal(admitted.request,input);assert.equal(await input.text(),'{}');
  const response=wrap(new Response('quota',{status:429,headers:{'Retry-After':'60',Vary:'Accept-Encoding'}}),admitted);
  assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');assert.match(response.headers.get('Vary'),/Origin/);
  const original=new Response('web');assert.equal(wrap(original,{allowed:true,native:false}),original);
  assert.equal((await check(req('/api/prices/conditions','GET',{Authorization:'Bearer valid.token'}))).user,null,'owner-only check remains in condition route');
});
test('rejects native cookies, unknown routes, unapproved host and bearer destination',async()=>{
  for(const input of [req(undefined,'POST',{Cookie:'session=x'}),req('/api/unknown','GET'),new Request('https://evil.test/api/daily-card'),req('/api/daily-card','GET',{Authorization:'Bearer token'})]) assert.equal((await check(input)).allowed,false);
});
test('Supabase verifier uses only existing public config and rejects failures/anonymous sessions',async()=>{
  let seen;const verify=createSupabaseBearerVerifier({url:'https://example.supabase.co',key:'existing-public-key',fetcher:async(...args)=>{seen=args;return Response.json({id:'user',is_anonymous:false});}});
  assert.deepEqual(await verify('Bearer test.jwt'),{id:'user',is_anonymous:false});assert.equal(seen[0],'https://example.supabase.co/auth/v1/user');assert.equal(seen[1].redirect,'error');assert.equal(seen[1].headers.apikey,'existing-public-key');
  for(const fetcher of [async()=>new Response('',{status:401}),async()=>Response.json({id:'anon',is_anonymous:true}),async()=>{throw Error('network');}])assert.equal(await createSupabaseBearerVerifier({url:'https://example.supabase.co',key:'existing-public-key',fetcher})('Bearer test.jwt'),null);
  assert.throws(()=>createSupabaseBearerVerifier({url:'http://example.supabase.co',key:'key',fetcher:()=>{}}));
});
