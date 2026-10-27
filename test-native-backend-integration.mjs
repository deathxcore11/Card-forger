import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { lensUpload } from './worker.js';
import { aiAskRoute } from './ai-ask-route.js';
import { isNativeAdmitted } from './native-backend-contract.js';
import { conditionOwner } from './condition-feed-route.js';
import { resolveServiceURL } from './native-service-policy.js';
import { createNativeFetch } from './android-app/runtime/native-transport.js';
import { createForgeHostClient, exactDigest, FORGE_REVISION } from './play-forge-host-client.js';
import { routeHostRequest } from './deploy/forge-host/src/service-core.mjs';
import { verifyHostUser } from './deploy/forge-host/src/policy.mjs';
const WEB='https://cardstashy.com', NATIVE='https://android-integration.cardstashy.invalid';
const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:false};
let identity=user, authCalls=0, providerCalls=0, reservations=0, quota=true, authError=false;
const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 if(String(url)==='https://noxfmbwuytnbvfgukpiv.supabase.co/auth/v1/user') { authCalls++; if(init.redirect==='error')throw TypeError('Invalid redirect value (Cloudflare Workers)'); assert.equal(init.redirect,'manual'); assert.equal(init.credentials,'omit'); assert.match(init.headers.Authorization,/^Bearer /); if(authError)throw Error('offline');return identity===null?new Response('',{status:401}):Response.json(identity); }
 if(String(url)==='https://api.openai.com/v1/responses') {providerCalls++;assert.equal(init.headers.Authorization,'Bearer synthetic-provider-key','client session never becomes provider credential');const payload=JSON.parse(init.body);assert.equal(payload.store,false);const name=payload.text?.format?.name;
 if(name==='scan_hints')return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({name:'Island',number:'1',set:'Test',game:'mtg',readable:true})}]}]});
 if(!name)return Response.json({output:[{type:'function_call',call_id:'call1',name:'card_details',arguments:'{"game":"mtg","name":"Island"}'}]});
 return new Response('',{status:429}); }
 throw Error('Unexpected external call blocked: '+url);
};
const bytes=readFileSync(new URL('./rulebooks/mtg-rules-v1.json.gz',import.meta.url));
const env={OPENAI_API_KEY:'synthetic-provider-key',AI_REVIEW_LIMITS:{idFromName:n=>n,get:()=>({fetch:async()=>{reservations++;return new Response(null,{status:quota?200:429});}})},ASSETS:{fetch:async()=>new Response(bytes)}};
const card={id:'p0',name:'Test creature',qty:4,zone:'main',type:'Creature',text:'Haste',manaCost:'{R}',colors:['R'],legalities:{standard:'legal'},known:true};
const payloads={
 '/api/ai/ask':{game:'mtg',items:[{type:'message',role:'user',content:'What does Island do?'}]},
 '/api/ai/deck-review':{game:'mtg',format:'Modern',cards:[card],power:{areas:[],priority:[]},checks:{engine:72,issues:[]}},
 '/api/ai/matchup':{version:1,game:'mtg',format:'Standard',mode:'bo1',question:'How about red?',player:{name:'Player',cards:[card]},opponent:{name:'Opponent',cards:[{...card,id:'o0'}],provenance:{kind:'import'}},candidates:[]},
 '/api/ai/identify-card':{game:'mtg',image:'data:image/jpeg;base64,'+'A'.repeat(200)},
};
const request=(path, {origin=NATIVE,token='valid.jwt',method='POST',body=payloads[path],headers={}}={})=>new Request(WEB+path,{method,headers:{...(origin?{Origin:origin}:{}),...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...headers},...(['GET','OPTIONS'].includes(method)?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
try {
 for (const path of ['/api/%64aily-card','/%61pi/daily-card','/api/ai/%61sk','/img/%62ack/mtg.jpg','/img/ygo/%31.jpg','/img/ptcg/l/%41.jpg','/img/ptcg/l/id%3f.jpg','/api%2Fdaily-card','/api/%252e%252e/daily-card']) {
  assert.throws(() => resolveServiceURL(path), /path|namespace/, path);
  assert.equal((await worker.fetch(request(path,{method:'GET',token:null}),env,{})).status,404,path);
 }
 for (const path of ['/api/x/../daily-card','/api/%2e%2e/api/daily-card','/img/ptcg/l/..%2Fsecret.jpg']) assert.throws(()=>resolveServiceURL(path), /path/);
 const oldCaches=globalThis.caches;
 try {
  globalThis.caches={default:{match:async()=>new Response('cached exact artwork',{headers:{'Content-Type':'image/jpeg'}})}};
  for (const path of ['/img/ptcg/l/id%3F.jpg','/img/ptcg/l/id!.jpg','/img/ptcg/l/id._-.jpg']) {
   assert.equal(resolveServiceURL(path).kind,'service',path);
   const response=await worker.fetch(request(path,{method:'GET',token:null}),env,{});
   assert.equal(response.status,200,path);assert.equal(await response.text(),'cached exact artwork');
  }
 } finally {globalThis.caches=oldCaches;}
 for(const path of Object.keys(payloads)){
  for(const origin of [NATIVE,WEB]){
   const start=providerCalls;
   assert.equal((await worker.fetch(request(path,{origin,token:null}),env,{})).status,401);
   for(const bad of [null,{id:'forged',is_anonymous:false},{...user,is_anonymous:true},{id:user.id}]) {identity=bad;assert.equal((await worker.fetch(request(path,{origin}),env,{})).status,401);}
   authError=true;assert.equal((await worker.fetch(request(path,{origin}),env,{})).status,401);authError=false;identity=user;
   assert.equal(providerCalls,start,'invalid/absent identities never reach provider');
   const req=request(path,{origin,headers:{'Sec-Fetch-Site':origin===NATIVE?'cross-site':'same-origin'}});
   const res=await worker.fetch(req,env,{});assert.equal(res.status,path.endsWith('ask')||path.endsWith('identify-card')?200:503,await res.clone().text());
   assert.equal(providerCalls,start+1,'actual original route reaches mocked provider once');
   assert.equal(isNativeAdmitted(req),false,'admission removed after handler completes');
   assert.equal(res.headers.get('Access-Control-Allow-Origin'),origin===NATIVE?NATIVE:null);
  }
  quota=false;const before=providerCalls;const rate=await worker.fetch(request(path),env,{});assert.equal(rate.status,429);assert.equal(providerCalls,before);quota=true;
  assert.equal((await worker.fetch(request(path,{headers:{'Content-Type':'text/plain'}}),env,{})).status,415);
  assert.equal((await worker.fetch(request(path,{body:'x'.repeat(1_800_100)}),env,{})).status,413,'stream body bound retained');
  assert.equal((await worker.fetch(request(path,{headers:{'Content-Length':'2000000'}}),env,{})).status,413,'declared size bound retained');
  assert.equal((await worker.fetch(request(path,{body:'{bad'}),env,{})).status,400);
  assert.equal((await worker.fetch(request(path,{origin:'https://evil.test'}),env,{})).status,403);
  assert.equal((await worker.fetch(request(path,{origin:WEB,headers:{'Sec-Fetch-Site':'cross-site'}}),env,{})).status,403);
 }
 assert.equal((await aiAskRoute(request('/api/ai/ask',{headers:{'X-Native-Admitted':'true'}}),env)).status,403,'headers cannot forge internal native admission');
 const before=authCalls;
 const pre=await worker.fetch(request('/api/ai/ask',{method:'OPTIONS',token:null,headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type, Authorization'}}),env,{});
 assert.equal(pre.status,204);assert.equal(authCalls,before);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),NATIVE);assert.equal(pre.headers.get('Access-Control-Allow-Credentials'),null);
 for(const headers of [{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'X-Admin'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Cookie'}])assert.ok((await worker.fetch(request('/api/ai/ask',{method:'OPTIONS',token:null,headers}),env,{})).status>=400);
 assert.equal((await worker.fetch(new Request('https://evil.test/api/ai/ask',{method:'OPTIONS',headers:{Origin:NATIVE,'Access-Control-Request-Method':'POST'}}),env,{})).status,403);
 assert.equal((await worker.fetch(request('/api/uninventoried',{method:'GET',token:null}),env,{})).status,404);
 assert.equal((await worker.fetch(request('/api/ai/ask',{method:'GET',token:null}),env,{})).status,200,'native availability read');
 assert.equal((await worker.fetch(request('/api/ai/ask',{method:'GET',origin:WEB,token:null}),env,{})).status,200,'legacy web availability read');
 assert.equal((await worker.fetch(request('/api/ai/ask',{headers:{Cookie:'session=forged'}}),env,{})).status,403);
 // Existing web Lens no-Origin acceptance and body bounds unchanged. Native admission
 // permits only origin exception, not MIME or size exceptions.
 const lens=new Request(WEB+'/api/lens',{method:'POST',headers:{Origin:NATIVE,'Content-Type':'image/jpeg'},body:new Uint8Array(6*1024*1024+1)});
 assert.equal((await worker.fetch(lens,env,{})).status,413);
 assert.equal((await lensUpload(new Request(WEB+'/api/lens',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:new Uint8Array(0)}),new URL(WEB))).status,413);
 assert.equal(await conditionOwner(request('/api/prices/conditions'),{CONDITION_OWNER_ID:user.id},async()=>Response.json({...user,email_confirmed_at:'2026-01-01'})),true);
 assert.equal(await conditionOwner(request('/api/prices/conditions'),{CONDITION_OWNER_ID:'other'},async()=>Response.json({...user,email_confirmed_at:'2026-01-01'})),false,'native admission never grants condition-owner authority');

 // Hosted Play from the app: real Forge host client -> native transport -> website Worker ->
 // the Forge host's own entry and account check (fixture match services, no engine).
 const matchId='0123abcd-0000-4000-8000-00000000beef',generation='0123abcd-0000-4000-8000-00000000cafe',hostSeen=[],hostVerify=async a=>a==='Bearer valid.jwt'?user:null;
 const matchService=async(request,reply)=>{hostSeen.push({method:request.method,path:new URL(request.url).pathname,origin:request.headers.get('Origin'),site:request.headers.get('Sec-Fetch-Site'),key:request.headers.get('Idempotency-Key'),cookie:request.headers.get('Cookie')});
  return await verifyHostUser(request,{verifyBearer:hostVerify,origin:WEB})?reply(request):Response.json({error:'authentication_required'},{status:401});};
 const hostEnv={FORGE_ADMISSION:{getByName:()=>({fetch:request=>matchService(request,async request=>{const input=await request.json();return Response.json({matchId,generation,expiresAt:Date.now()+3600000,deckDigests:{human:await exactDigest(input.humanDeck),opponent:await exactDigest(input.opponentDeck)},forgeRevision:FORGE_REVISION,schema:'cardstashy.forge-proof.v1',status:'initializing',replay:false},{status:202});})})},
  FORGE_MATCHES:{getByName:id=>{assert.equal(id,matchId);return {fetch:request=>matchService(request,async request=>request.method==='DELETE'?new Response(null,{status:204}):request.method==='GET'?Response.json({matchId,generation,status:'initializing'},{status:202}):Response.json({commandId:(await request.json()).commandId,state:'accepted'},{status:202}))};}}};
 const playEnv={...env,FORGE_HOST:{fetch:request=>routeHostRequest(request,hostEnv,hostVerify)}};
 const webviewSent=[];
 // The WebView adds its own Origin and cross-site Fetch Metadata to the planned request.
 const transport=createNativeFetch({enabled:true,fetcher:async request=>{webviewSent.push(request);const sent=new Request(request,{headers:{...Object.fromEntries(request.headers),Origin:NATIVE,'Sec-Fetch-Site':'cross-site'}});const response=await worker.fetch(sent,playEnv,{});assert.equal(isNativeAdmitted(sent),false);assert.equal(response.headers.get('Access-Control-Allow-Origin'),NATIVE);return response;}});
 const deck={format:'Standard',cards:[{name:'Island',qty:60}],side:[]},authBefore=authCalls;
 const client=createForgeHostClient({readAccount:()=>({user:{id:user.id}}),getAccessToken:async()=>'valid.jwt',fetchImpl:transport});
 assert.equal((await client.create({format:'Standard',humanDeck:deck,opponentDeck:deck,difficultyPolicyVersion:'forge-default-v1'})).matchId,matchId);
 assert.deepEqual(await client.read(),{status:'initializing'});
 assert.equal((await client.submit({revision:1,op:'ok'})).state,'accepted');
 await client.close();
 const leaving=createForgeHostClient({readAccount:()=>({user:{id:user.id}}),getAccessToken:async()=>'valid.jwt',fetchImpl:transport});
 await leaving.create({format:'Standard',humanDeck:deck,opponentDeck:deck,difficultyPolicyVersion:'forge-default-v1'});
 assert.equal(leaving.release(),true);await new Promise(r=>setTimeout(r,50));
 assert.deepEqual(hostSeen.map(x=>[x.method,x.path]),[['POST','/api/play/matches'],['GET','/api/play/matches/'+matchId],['POST','/api/play/matches/'+matchId+'/actions'],['DELETE','/api/play/matches/'+matchId],['POST','/api/play/matches'],['DELETE','/api/play/matches/'+matchId]]);
 for(const seen of hostSeen){assert.equal(seen.origin,WEB,'admitted app requests reach the host as same-origin');assert.equal(seen.site,null);assert.equal(seen.cookie,null);assert.equal(seen.key===null,!(seen.method==='POST'&&seen.path==='/api/play/matches'));}
 assert.deepEqual(webviewSent.map(r=>r.keepalive),[false,false,false,false,false,true],'only the page-exit close outlives the page');
 assert.equal(authCalls,authBefore,'the host, not the website, verifies the Play account');
 // Translation is only for admitted app requests; the website and other origins are forwarded as sent.
 const play=(path,{origin=NATIVE,method='GET',headers={}}={})=>new Request(WEB+path,{method,headers:{...(origin?{Origin:origin}:{}),Authorization:'Bearer valid.jwt',...headers}});
 hostSeen.length=0;
 assert.equal((await worker.fetch(play('/api/play/matches/'+matchId,{origin:WEB,headers:{'Sec-Fetch-Site':'same-origin'}}),playEnv,{})).status,202);
 for(const [origin,site] of [['https://evil.test','cross-site'],[WEB,'cross-site'],[null,'cross-site']]){const response=await worker.fetch(play('/api/play/matches/'+matchId,{origin,headers:{'Sec-Fetch-Site':site}}),playEnv,{});assert.equal(response.status,401,origin);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);}
 assert.deepEqual(hostSeen.map(x=>[x.origin,x.site]),[[WEB,'same-origin']],'other origins never become same-origin; the host refuses them itself');
 hostSeen.length=0;
 for(const [request,status] of [
  [new Request(WEB+'/api/play/matches/'+matchId,{headers:{Origin:NATIVE}}),401],
  [play('/api/play/matches/'+matchId,{headers:{Cookie:'session=forged'}}),403],
  [play('/api/play/matches/'+matchId,{headers:{'Idempotency-Key':'0d1c7f5e-1b9c-4b55-9f1e-3c2a5d6e7f80'}}),403],
  [play('/api/play/matches/'+matchId.toUpperCase()),404],[play('/api/play/matches/'+matchId+'/state'),404],[play('/api/play/matches?x=1',{method:'POST'}),404],
  [play('/api/play/matches',{method:'GET'}),405],[play('/api/play/matches/'+matchId,{method:'PUT'}),405],
  [new Request('https://evil.test/api/play/matches/'+matchId,{headers:{Origin:NATIVE,Authorization:'Bearer valid.jwt'}}),403],
 ])assert.equal((await worker.fetch(request,playEnv,{})).status,status);
 for(const [path,method,requested,status] of [['/api/play/matches','POST','content-type, authorization, idempotency-key',204],['/api/play/matches/'+matchId,'DELETE','authorization',204],['/api/play/matches/'+matchId,'GET','authorization',204],['/api/play/matches/'+matchId+'/actions','POST','content-type, authorization',204],['/api/play/matches/'+matchId,'GET','authorization, idempotency-key',403],['/api/play/matches/'+matchId,'POST','authorization',405]]){
  const response=await worker.fetch(new Request(WEB+path,{method:'OPTIONS',headers:{Origin:NATIVE,'Access-Control-Request-Method':method,'Access-Control-Request-Headers':requested}}),playEnv,{});
  assert.equal(response.status,status,path+' '+method);if(status===204){assert.equal(response.headers.get('Access-Control-Allow-Methods'),method);assert.equal(response.headers.get('Access-Control-Allow-Headers'),requested);}
 }
 assert.equal(hostSeen.length,0,'refused and preflight requests never reach the Forge host');
 const offline=await worker.fetch(play('/api/play/matches/'+matchId),env,{});
 assert.equal(offline.status,503);assert.equal(offline.headers.get('Access-Control-Allow-Origin'),NATIVE);assert.equal(offline.headers.get('Access-Control-Expose-Headers'),'Retry-After');assert.equal(offline.headers.get('Retry-After'),'30');
 console.log(JSON.stringify({passed:true,aiRoutes:4,playRoutes:4,authCalls,providerCalls,reservations,realProviderCalls:0}));
} finally {globalThis.fetch=oldFetch;}
