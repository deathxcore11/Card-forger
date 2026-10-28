import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveServiceURL as resolve, planServiceRequest as plan, NATIVE_ORIGIN, SERVICE_ORIGIN } from '../runtime/native-service-policy.js';
test('routes relative, root-relative, URL and Request service inputs with queries intact', () => {
  for (const input of ['api/prices/history?id=A%20B&finish=foil', '/api/prices/history?id=A%20B&finish=foil', new URL(NATIVE_ORIGIN+'/api/prices/history?id=A%20B&finish=foil'), new Request(NATIVE_ORIGIN+'/api/prices/history?id=A%20B&finish=foil')]) {
    assert.equal(resolve(input).url, SERVICE_ORIGIN+'/api/prices/history?id=A%20B&finish=foil');
  }
});
test('local resources and third-party URLs retain original input and init, without added tokens', () => {
  for (const input of ['./catalog.json','../local.json','catalog.json','scanidx/ptcg-catalog-v1.gzip','rulebooks/manifest.json','vendor/worker.min.js','https://api.scryfall.com/cards/search?q=foo','https://example.supabase.co/auth/v1/token']) {
    const init={signal:new AbortController().signal}; const result=plan(input,init);
    assert.equal(result.kind,'passthrough'); assert.equal(result.input,input); assert.equal(result.init,init);
  }
});
test('enumerated image shapes include encoded Pokémon punctuation and exclude unknown images', () => {
  for(const path of ['/img/pack/ptcg.jpg?code=base1','/img/back/mtg.jpg','/img/mtg-set/mh3.jpg','/img/ygo/a/123.jpg','/img/pks/s/base1.png','/img/ptcg/l/dp-1%3F.jpg']) assert.equal(resolve(path).image,true);
  for(const path of ['/img/foo.jpg','/img/ptcg/l/a/b.jpg','/img/ygo/abc.jpg','/api/new-endpoint']) assert.throws(()=>resolve(path));
});
test('rejects malicious raw URLs, traversal, query tokens, credentials and ambiguous encodings', () => {
  for(const input of ['//evil.test/api/ai/ask','\\evil.test',' /api/daily-card','/api/x/../daily-card','/api/%2e%2e/api/daily-card','/api%2fprices/history','/api/%252e%252e/history','https://user:pass@cardstashy.com/api/daily-card','/api/daily-card#x','/api/daily-card?access_token=secret','/api/%zz','/api/../catalog.json']) assert.throws(()=>resolve(input),input);
});
test('service transport forbids credential leakage and unauthorized methods/headers', () => {
  for(const [url,init] of [
    ['/api/daily-card',{headers:{Authorization:'Bearer secret'}}],
    ['/api/prices/history',{headers:{apikey:'secret'}}],
    ['/api/prices/conditions',{headers:{Cookie:'secret'}}],
    ['/api/prices/conditions',{headers:{Origin:SERVICE_ORIGIN}}],
    ['/api/prices/conditions',{headers:{Authorization:'Basic secret'}}],
    ['/api/daily-card',{method:'DELETE'}],
    ['/api/ai/ask',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}}],
  ]) assert.throws(()=>plan(url,init));
});
test('AI request preserves JSON bytes, caller Request and cancellation, forbids redirects/cookies', async () => {
  const controller=new AbortController(); const body='{"message":"é"}';
  const input=new Request(NATIVE_ORIGIN+'/api/ai/ask',{method:'POST',headers:{Authorization:'Bearer test.jwt.value','Content-Type':'application/json'},body,signal:controller.signal});
  const {request}=plan(input);
  assert.equal(request.url,SERVICE_ORIGIN+'/api/ai/ask'); assert.equal(request.redirect,'error'); assert.equal(request.credentials,'omit'); assert.equal(request.referrerPolicy,'no-referrer');
  assert.equal(await request.text(),body); assert.equal(await input.text(),body);
  controller.abort(); assert.equal(request.signal.aborted,true);
});
test('binary Lens bodies and condition authorization remain exact; overrides use Request semantics', async () => {
  const bytes=new Uint8Array([0,255,128,1]);
  const lens=plan('/api/lens',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:bytes}).request;
  assert.deepEqual(new Uint8Array(await lens.arrayBuffer()),bytes);
  const conditions=plan('/api/prices/conditions?game=ptcg',{headers:{Authorization:'Bearer test.jwt.value'}}).request;
  assert.equal(conditions.headers.get('Authorization'),'Bearer test.jwt.value');
  const request=new Request(NATIVE_ORIGIN+'/api/prices/watch',{method:'POST',headers:{'Content-Type':'application/json'},body:'old'});
  assert.equal(await plan(request,{body:'new'}).request.text(),'new'); assert.equal(await request.text(),'old');
});
test('policy is inactive: no fetch execution or global replacement', () => {
  const before=globalThis.fetch;
  plan('/api/daily-card');
  assert.equal(globalThis.fetch,before);
});
test('public Wiki topic POST uses the exact first-party route without account authority', async () => {
  for(const [path,body] of [
    ['/api/reference/mtg-wiki','{"title":"Jakub Šlemr"}'],
    ['/api/reference/wiki','{"game":"ptcg","query":"Pokémon TCG"}'],
    ['/api/reference/wiki','{"game":"ygo","daily":true}'],
  ]){
    const controller=new AbortController();
    const input=new Request(NATIVE_ORIGIN+path,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body,signal:controller.signal});
    const result=plan(input,{credentials:'include',redirect:'follow'}),request=result.request;
    assert.equal(result.route.ai,false);assert.equal(result.route.publicReference,true);assert.equal(result.route.authorizationAllowed,false);assert.deepEqual(result.route.methods,['POST']);
    assert.equal(request.url,SERVICE_ORIGIN+path);assert.equal(request.method,'POST');
    assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.referrerPolicy,'no-referrer');
    assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('Cookie'),null);assert.equal(request.headers.get('Origin'),null);
    assert.equal(await request.text(),body);assert.equal(await input.text(),body,'Planning leaves the caller Request readable');
    controller.abort();assert.equal(request.signal.aborted,true);
  }
});
test('public reference admission does not broaden API routes, methods or credential headers', () => {
  for(const path of ['/api/reference/mtg-wiki','/api/reference/wiki']){
    for(const method of ['GET','HEAD','PUT','DELETE'])assert.throws(()=>plan(path,{method,headers:{'Content-Type':'application/json'}}),/Method/);
    for(const headers of [{Authorization:'Bearer synthetic.profile'},{Cookie:'synthetic=session'},{apikey:'synthetic'},{'X-API-Key':'synthetic'}])assert.throws(()=>plan(path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{"game":"mtg","title":"Bloodlust"}'}));
    assert.throws(()=>plan(path,{method:'POST',headers:{'Content-Type':'text/plain'},body:'Bloodlust'}),/JSON/);
    assert.throws(()=>resolve(path+'?title=Bloodlust'));
    assert.throws(()=>resolve(path+'/extra'));
  }
  for(const input of ['/api/reference/other','/api/reference/mtg%2Dwiki','/api/reference/%77iki','/api/reference/wiki-extra'])assert.throws(()=>resolve(input));
});
// The app plays Forge through the host: each Play path takes only the methods the client sends, with the bearer.
test('the Forge host routes Play uses are native services that require sign-in', () => {
  const match = '00000000-0000-4000-8000-000000000000';
  const expected = { '/api/play/warm': ['POST'], '/api/play/matches': ['POST'], ['/api/play/matches/'+match]: ['GET','DELETE'], ['/api/play/matches/'+match+'/actions']: ['POST'] };
  for (const [path, methods] of Object.entries(expected)) {
    const route = resolve(path);
    assert.deepEqual([...route.methods], methods); assert.equal(route.play, true); assert.equal(route.authorizationAllowed, true);
  }
  for (const path of ['/api/play', '/api/play/matches/not-a-uuid', '/api/play/matches/'+match+'/actions/extra', '/api/play/warmup']) assert.throws(() => resolve(path), /Unknown service route/);
  assert.throws(() => resolve('/api/play/matches?x=1'), /no query/);
  assert.throws(() => plan('/api/play/warm', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }), /Sign in/);
  const planned = plan('/api/play/matches', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a.b.c', 'Idempotency-Key': match } });
  assert.equal(planned.request.headers.get('idempotency-key'), match);
  assert.throws(() => plan('/api/prices/recent', { headers: { 'Idempotency-Key': match } }), /not allowed/);
});
