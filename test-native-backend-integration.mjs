import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { lensUpload } from './worker.js';
import { aiAskRoute } from './ai-ask-route.js';
import { isNativeAdmitted } from './native-backend-contract.js';
import { conditionOwner } from './condition-feed-route.js';
import { resolveServiceURL } from './native-service-policy.js';
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
 console.log(JSON.stringify({passed:true,aiRoutes:4,authCalls,providerCalls,reservations,realProviderCalls:0}));
} finally {globalThis.fetch=oldFetch;}
