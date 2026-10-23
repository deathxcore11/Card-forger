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
