import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeFetch, resolveNativeImage, resolveExternalURL } from '../runtime/native-transport.js';
import { NATIVE_ORIGIN } from '../runtime/native-service-policy.js';

test('network is disabled by default without calling any fetcher', async () => {
  let calls = 0; const fetcher = async () => { calls++; return new Response('ok'); };
  const transport = createNativeFetch({fetcher});
  for(const url of ['/api/daily-card', 'img/ygo/42.jpg', 'https://example.com/data', 'http://example.com/']) await assert.rejects(transport(url));
  assert.equal(calls, 0);
  await transport('./scanidx/mtg.bin'); assert.equal(calls, 1);
});
test('enabled service transport preserves body and sends only planned browser request', async () => {
  let seen; const transport = createNativeFetch({ enabled:true, fetcher:async (...args) => {seen=args;return new Response('ok');} });
  const input = new Request(NATIVE_ORIGIN + '/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic.jwt'},body:'{"question":"test"}'});
  await transport(input); const [request]=seen;
  assert.equal(request.url,'https://cardstashy.com/api/ai/ask'); assert.equal(request.credentials,'omit'); assert.equal(request.redirect,'error');
  assert.equal(request.headers.get('origin'),null); assert.equal(request.headers.get('cookie'),null);
  assert.equal(await request.text(),'{"question":"test"}'); assert.equal(await input.text(),'{"question":"test"}');
  await assert.rejects(transport('/api/daily-card',{headers:{Authorization:'Bearer nope'}}));
  await assert.rejects(transport('/api/ai/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
});
test('provider calls are untouched: no account token is injected',async()=>{
  let seen; const transport=createNativeFetch({enabled:true,fetcher:async(...args)=>{seen=args;return new Response();}});
  const input='https://api.scryfall.com/cards/search?q=test',init={headers:{Accept:'application/json'}};
  await transport(input,init);assert.equal(seen[0],input);assert.equal(seen[1],init);assert.equal(new Headers(init.headers).has('authorization'),false);
});
test('images route only known service images and preserve local and provider sources',()=>{
  // Website card art keeps its path at the app's own origin, served from the phone's art cache.
  assert.equal(resolveNativeImage('img/ygo/a/42.jpg',{enabled:true}),'https://android-integration.cardstashy.invalid/img/ygo/a/42.jpg');
  assert.equal(resolveNativeImage('https://cardstashy.com/img/ptcg/l/sv1-1.jpg?v=2',{enabled:true}),'https://android-integration.cardstashy.invalid/img/ptcg/l/sv1-1.jpg?v=2');
  assert.equal(resolveNativeImage('https://android-integration.cardstashy.invalid/img/ygo/s/42.jpg',{enabled:true}),'https://android-integration.cardstashy.invalid/img/ygo/s/42.jpg');
  assert.equal(resolveNativeImage('img/ygo/a/42.jpg'),'');
  assert.equal(resolveNativeImage('https://images.pokemontcg.io/base1/1.png'),'');
  assert.equal(resolveNativeImage('assets/cards/a.webp'),'assets/cards/a.webp');
  assert.equal(resolveNativeImage('https://images.pokemontcg.io/base1/1.png',{enabled:true}),'https://images.pokemontcg.io/base1/1.png');
  for(const bad of ['//evil.test/a.jpg','img/ygo/../private.jpg','/api/daily-card','https://user:pass@cardstashy.com/img/ygo/42.jpg','javascript:alert(1)','data:text/html,x']) assert.throws(()=>resolveNativeImage(bad,{enabled:true}));
});
test('external navigation is secure and cannot leak callback credentials',()=>{
  assert.equal(resolveExternalURL('https://www.tcgplayer.com/search?q=card'),'https://www.tcgplayer.com/search?q=card');
  for(const bad of ['javascript:alert(1)','file:///sdcard/x','intent://foo','http://example.com','//evil.test','https://a:b@example.com','https://cardstashy.com/auth/android/callback?code=secret','https://example.com/#access_token=secret',NATIVE_ORIGIN+'/index.html']) assert.throws(()=>resolveExternalURL(bad));
});
test('external query and fragment credentials reject encoded keys, duplicates and malformed syntax',()=>{
  const base='https://example.com/card';
  for(const key of ['access_token','refresh_token','id_token','authorization','apikey','api_key','token','code']) {
    for(const encoded of [key,key.toUpperCase(),key.replace(/./g,c=>'%'+c.charCodeAt(0).toString(16)),key.replace('_','%255f')]) {
      for(const tail of ['?'+encoded+'=synthetic','?q=ok&'+encoded+'=synthetic&q=again','#'+encoded+'=synthetic','#/route?'+encoded+'=synthetic','#q=ok;'+encoded+'=synthetic']) assert.throws(()=>resolveExternalURL(base+tail),tail);
    }
  }
  for(const tail of ['#id_token%ZZ=x','#%E0%A4%A=x','?bad%=x','#route?%00code=x','#q=ok%26id_token=synthetic','?q=ok%26id_token=synthetic']) assert.throws(()=>resolveExternalURL(base+tail),tail);
  for(const tail of ['#details','#/route?view=cards','?q=rare%20card&game=mtg','#condition=near-mint']) assert.equal(resolveExternalURL(base+tail),base+tail);
});
