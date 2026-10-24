// Real public client -> native request planner -> backend admission/CORS ->
// Worker Wiki route, with only the external Wiki response mocked. No accounts,
// model calls, private data, device access or live requests are used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from './worker.js';
import {readMtgWikiReference,readGameWikiReference,readGameWikiDaily} from './mtg-wiki-client.js';
import {createNativeFetch} from './android-app/runtime/native-transport.js';
import {resolveServiceURL,planServiceRequest,NATIVE_ORIGIN,SERVICE_ORIGIN} from './native-service-policy.js';
import {checkNativeBackendRequest,isNativeAdmitted} from './native-backend-contract.js';
assert.equal(readFileSync('native-service-policy.js','utf8'),readFileSync('android-app/runtime/native-service-policy.js','utf8'),'The bundled and backend route inventories must stay byte-identical');
const path='/api/reference/mtg-wiki';
const preflight=(method='POST',headers='Content-Type',origin=NATIVE_ORIGIN)=>new Request(SERVICE_ORIGIN+path,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':method,'Access-Control-Request-Headers':headers}});
let response=await worker.fetch(preflight(),{},{});
assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),NATIVE_ORIGIN);assert.equal(response.headers.get('Access-Control-Allow-Methods'),'POST');assert.equal(response.headers.get('Access-Control-Allow-Headers'),'content-type');assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
for(const [request,status] of [[preflight('GET'),405],[preflight('DELETE'),405],[preflight('POST','Content-Type, Authorization'),403],[preflight('POST','Cookie'),403]])assert.equal((await worker.fetch(request,{},{})).status,status);
assert.equal((await checkNativeBackendRequest(preflight('POST','Content-Type','https://evil.invalid'))).response.status,403);
assert.throws(()=>resolveServiceURL('/api/reference/mtg-wiki-extra'));
assert.throws(()=>planServiceRequest(path,{method:'POST',headers:{Authorization:'Bearer synthetic.profile','Content-Type':'application/json'},body:'{"title":"Bloodlust"}'}));

const oldFetch=globalThis.fetch;let wikiCalls=0,backendRequest;
globalThis.fetch=async(url,init)=>{
 const target=new URL(url);assert.equal(target.origin,'https://mtg.wiki');assert.equal(target.pathname,'/api.php');assert.equal(init.method,'GET');
 assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(new Headers(init.headers).get('Authorization'),null);assert.equal(new Headers(init.headers).get('Cookie'),null);
 assert.equal(target.searchParams.get('titles'),'Bloodlust');assert.equal(target.searchParams.get('explaintext'),'1');wikiCalls++;
 return Response.json({batchcomplete:true,query:{pages:[{pageid:731,ns:0,title:'Bloodlust',lastrevid:12,extract:'Synthetic public community explanation for native transport testing. This fixture is not an official ruling or a live article.'}]}});
};
try{
 const transport=createNativeFetch({enabled:true,fetcher:async request=>{
  assert(request instanceof Request);assert.equal(request.url,SERVICE_ORIGIN+path);assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);
  const sent=await request.clone().json();assert.deepEqual(sent,{title:'Bloodlust'},'The public lookup body contains no profile, history, collection or saved deck');
  backendRequest=new Request(request,{headers:{...Object.fromEntries(request.headers),Origin:NATIVE_ORIGIN}});
  return worker.fetch(backendRequest,{},{});
 }});
 const result=await readMtgWikiReference('Bloodlust',{fetcher:transport});
 assert.equal(result.status,'available');assert.equal(result.source.authority,'community-reference');assert.equal(result.source.title,'Bloodlust');assert.equal(wikiCalls,1);
 assert.equal(isNativeAdmitted(backendRequest),false,'The Worker retires native admission after the handler finishes');
 // Repeat the actual Worker call with a new native Request: response CORS stays
 // scoped to the admitted app origin, while the Wiki receives no credentials.
 const nativeRequest=(body,headers={},method='POST')=>new Request(SERVICE_ORIGIN+path,{method,headers:{Origin:NATIVE_ORIGIN,'Content-Type':'application/json',...headers},...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify(body)})});
 response=await worker.fetch(nativeRequest({title:'Bloodlust'}),{},{});
 assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),NATIVE_ORIGIN);assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);assert.match(response.headers.get('Vary'),/Origin/);
 assert.equal(wikiCalls,1,'The public source cache avoids a repeated external fetch');
 for(const [request,status] of [
  [nativeRequest({title:'Bloodlust'},{Authorization:'Bearer synthetic.profile'}),403],
  [nativeRequest({title:'Bloodlust'},{Cookie:'synthetic=session'}),403],
  [nativeRequest({title:'Bloodlust',collection:['private card']}),400],
  [nativeRequest({title:'Bloodlust',token:'synthetic.profile'}),400],
  [nativeRequest({title:'Bloodlust'},{'Content-Type':'text/plain'}),415],
  [nativeRequest(null,{},'GET'),405],
  [new Request(SERVICE_ORIGIN+'/api/reference/other',{method:'POST',headers:{Origin:NATIVE_ORIGIN,'Content-Type':'application/json'},body:'{}'}),404],
 ])assert.equal((await worker.fetch(request,{},{})).status,status);
 assert.equal(wikiCalls,1,'Invalid native inputs reach neither the Wiki, authentication nor a model');

 // The same public/native boundary supports one selected game per request.
 // Exact provider fixtures prove that Magic, Pokémon TCG and Yu-Gi-Oh! cannot
 // share a response cache or follow article-provided destinations.
 const genericPath='/api/reference/wiki';
 const providers={
  mtg:{origin:'https://mtg.wiki',api:'/api.php',article:'/page/'},
  ptcg:{origin:'https://bulbapedia.bulbagarden.net',api:'/w/api.php',article:'/wiki/'},
  ygo:{origin:'https://yugioh.fandom.com',api:'/api.php',article:'/wiki/'},
 };
 const genericRequest=(body,headers={},method='POST')=>new Request(SERVICE_ORIGIN+genericPath,{method,headers:{Origin:NATIVE_ORIGIN,'Content-Type':'application/json',...headers},...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify(body)})});
 const genericPreflight=(method='POST',headers='Content-Type',origin=NATIVE_ORIGIN)=>new Request(SERVICE_ORIGIN+genericPath,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':method,'Access-Control-Request-Headers':headers}});
 response=await worker.fetch(genericPreflight(),{},{});
 assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),NATIVE_ORIGIN);assert.equal(response.headers.get('Access-Control-Allow-Methods'),'POST');assert.equal(response.headers.get('Access-Control-Allow-Headers'),'content-type');assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
 for(const [request,status] of [[genericPreflight('GET'),405],[genericPreflight('PUT'),405],[genericPreflight('POST','Content-Type, Authorization'),403],[genericPreflight('POST','Cookie'),403]])assert.equal((await worker.fetch(request,{},{})).status,status);
 assert.equal((await checkNativeBackendRequest(genericPreflight('POST','Content-Type','https://evil.invalid'))).response.status,403);
 // The Worker routes non-native public requests directly to their method
 // handler; that path must reject OPTIONS without granting foreign CORS.
 const foreignPreflight=await worker.fetch(genericPreflight('POST','Content-Type','https://evil.invalid'),{},{});
 assert.equal(foreignPreflight.status,405);assert.equal(foreignPreflight.headers.get('Access-Control-Allow-Origin'),null);assert.equal(foreignPreflight.headers.get('Access-Control-Allow-Credentials'),null);
 let expectedBody,expectedProvider,genericCalls=0,lastRequest;
 globalThis.fetch=async(url,init)=>{
  const target=new URL(url);assert.equal(target.origin,expectedProvider.origin);assert.equal(target.pathname,expectedProvider.api);
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');
  assert.equal(new Headers(init.headers).get('Authorization'),null);assert.equal(new Headers(init.headers).get('Cookie'),null);
  assert.equal(target.searchParams.get('action'),'query');assert.equal(target.searchParams.get('explaintext'),'1');
  if(expectedBody.daily){assert.equal(target.searchParams.get('generator'),'random');assert.equal(target.searchParams.get('grnnamespace'),'0');assert.equal(target.searchParams.has('titles'),false);}
  else if(expectedBody.query){assert.equal(target.searchParams.get('generator'),'search');assert.equal(target.searchParams.get('gsrnamespace'),'0');assert.equal(target.searchParams.get('gsrsearch'),expectedBody.query+(expectedBody.game==='ptcg'?' TCG':''));}
  else {assert.equal(target.searchParams.get('titles'),expectedBody.title);assert.equal(target.searchParams.has('generator'),false);}
  genericCalls++;
  return Response.json({batchcomplete:true,query:{pages:[{pageid:900+genericCalls,ns:0,title:expectedBody.title||expectedBody.query||'Daily Public Topic',lastrevid:21,extract:'Synthetic public community article for the selected game only. It does not establish official card text or trading card rules.'}]}});
 };
 const gameTransport=createNativeFetch({enabled:true,fetcher:async request=>{
  assert.equal(request.url,SERVICE_ORIGIN+genericPath);assert.equal(request.method,'POST');assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');
  assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);
  assert.deepEqual(await request.clone().json(),expectedBody,'Only the selected game and one public topic selector cross the native boundary');
  lastRequest=new Request(request,{headers:{...Object.fromEntries(request.headers),Origin:NATIVE_ORIGIN}});
  const result=await worker.fetch(lastRequest,{},{});
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),NATIVE_ORIGIN);assert.equal(result.headers.get('Access-Control-Allow-Credentials'),null);
  return result;
 }});
 for(const game of ['mtg','ptcg','ygo']){
  expectedProvider=providers[game];
  for(const selection of [{title:'Shared Public Topic'},{query:'Native Public Query'},{daily:true}]){
   expectedBody={game,...selection};
   const result=selection.daily?await readGameWikiDaily(game,{fetcher:gameTransport}):await readGameWikiReference(game,selection.title||selection.query,{query:!!selection.query,fetcher:gameTransport});
   assert.equal(result.status,'available');assert.equal(result.game,game);assert.equal(result.source.game,game);assert.equal(result.source.authority,'community-reference');
   assert.equal(new URL(result.source.url).origin,expectedProvider.origin);assert(new URL(result.source.url).pathname.startsWith(expectedProvider.article));
   assert.equal(isNativeAdmitted(lastRequest),false,'Generic Wiki requests also retire their native admission after completion');
   if(selection.daily)assert.match(result.dailyDateUTC,/^\d{4}-\d{2}-\d{2}$/);
  }
 }
 assert.equal(genericCalls,9,'Each game and topic selection has an independent public cache key');
 expectedBody={game:'ygo',title:'Shared Public Topic'};expectedProvider=providers.ygo;
 const cached=await readGameWikiReference('ygo',expectedBody.title,{fetcher:gameTransport});
 assert.equal(cached.cache.hit,true);assert.equal(cached.source.game,'ygo');assert.equal(genericCalls,9);
 for(const [request,status] of [
  [genericRequest({game:'other',title:'Shared Public Topic'}),400],
  [genericRequest({title:'Shared Public Topic'}),400],
  [genericRequest({game:'mtg',title:'Shared Public Topic',query:'overlap'}),400],
  [genericRequest({game:'ptcg',daily:true,title:'overlap'}),400],
  [genericRequest({game:'ygo',title:'Shared Public Topic',history:['private message']}),400],
  [genericRequest({game:'mtg',title:'Shared Public Topic',collection:['private card']}),400],
  [genericRequest({game:'ptcg',title:'Shared Public Topic'},{Authorization:'Bearer synthetic.profile'}),403],
  [genericRequest({game:'ygo',title:'Shared Public Topic'},{Cookie:'synthetic=session'}),403],
  [genericRequest({game:'mtg',title:'Shared Public Topic'},{'Content-Type':'text/plain'}),415],
  [genericRequest(null,{},'GET'),405],
  [nativeRequest({game:'ptcg',title:'Shared Public Topic'}),400],
 ])assert.equal((await worker.fetch(request,{},{})).status,status);
 assert.throws(()=>readGameWikiReference('other','Public Topic',{fetcher:gameTransport}),/supported/);
 assert.throws(()=>readGameWikiDaily('other',{fetcher:gameTransport}),/supported/);
 assert.equal(genericCalls,9,'Unsupported games, overlapping selectors, private fields, credentials and methods never reach a Wiki or account service');
 console.log('PASS: Legacy and per-game Wiki clients/native planner/backend admission/Worker integration; three isolated providers and title/query/daily requests, exact credentialless JSON POST, scoped CORS, upstream/cache isolation and rejected private inputs, auth/cookies, methods and unknown routes.');
}finally{globalThis.fetch=oldFetch;}
