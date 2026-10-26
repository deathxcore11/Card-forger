import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceWorker,PREFIX} from './deploy/forge-acceptance/worker.mjs';
const origin='https://cardstashy.com';
test('acceptance mount serves only reviewed overrides and strips credentials from static fallback',async()=>{
 let seen;const worker=acceptanceWorker({'app.js':'reviewed candidate'}),env={PRODUCTION_ASSETS:{fetch:async r=>{seen=r;return new Response('<body>Existing app</body>',{headers:{'Content-Type':'text/html','ETag':'old','Cache-Control':'max-age=86400'}});}}};
 const patched=await worker.fetch(new Request(origin+PREFIX+'app.js'),env);assert.equal(await patched.text(),'reviewed candidate');assert.equal(patched.headers.get('Cache-Control'),'no-store');
 const page=await worker.fetch(new Request(origin+PREFIX,{headers:{Authorization:'Bearer private',Cookie:'secret=1'}}),env);assert.equal(seen.url,origin+'/');assert.equal(seen.headers.get('Authorization'),null);assert.equal(seen.headers.get('Cookie'),null);assert.match(await page.text(),/Forge test/);assert.equal(page.headers.get('ETag'),null);
});
test('acceptance game route preserves exact body and account bearer through the private service binding',async()=>{
 let seen;const body='{"exact":"unchanged"}',worker=acceptanceWorker({});
 const response=await worker.fetch(new Request(origin+PREFIX+'api/play/matches',{method:'POST',headers:{Authorization:'Bearer account.token',Origin:origin,Cookie:'private=1','X-User-ID':'spoof','Content-Type':'application/json','Idempotency-Key':'one-request'},body}),{FORGE_HOST:{fetch:async r=>{seen=r;return Response.json({error:'authentication_required'},{status:401});}}});
 assert.equal(response.status,401);assert.equal(seen.url,origin+'/api/play/matches');assert.equal(await seen.text(),body);assert.equal(seen.headers.get('Authorization'),'Bearer account.token');assert.equal(seen.headers.get('Origin'),origin);assert.equal(seen.headers.get('Cookie'),null);assert.equal(seen.headers.get('X-User-ID'),null);
});
test('acceptance mount cannot expose source directories, unrelated APIs or change root routes',async()=>{
 const worker=acceptanceWorker({}),env={PRODUCTION_ASSETS:{fetch:async()=>{throw Error('unexpected static forwarding');}},FORGE_HOST:{fetch:async()=>{throw Error('unexpected game forwarding');}}};
 for(const url of [origin+'/',origin+'/api/play/matches','https://elsewhere.test'+PREFIX,origin+PREFIX+'sw.js',origin+PREFIX+'deploy/private.js',origin+PREFIX+'.env',origin+PREFIX+'api/ai/ask'])assert.equal((await worker.fetch(new Request(url),env)).status,404);
 assert.equal((await worker.fetch(new Request(origin+PREFIX+'app.js',{method:'POST',body:'no'}),env)).status,405);
});
