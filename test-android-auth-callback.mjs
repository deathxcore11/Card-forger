import assert from 'node:assert/strict';
import worker from './worker.js';
const path='/auth/android/callback', base='https://cardstashy.com';
let assets=0,network=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>{network++;throw Error('Callback must not fetch/exchange anything');};
const env={ASSETS:{fetch:async()=>{assets++;return new Response('existing website app');}}};
try {
 const marker='PRIVATE_CALLBACK_CODE_DO_NOT_REFLECT';
 const get=await worker.fetch(new Request(base+path+'?code='+marker+'&error_description='+marker+'#access_token='+marker),env,{});
 assert.equal(get.status,200);const html=await get.text();
 assert.match(html,/Return to CardStashy on Android/);assert.match(html,/cannot complete Android sign-in/);assert.ok(!html.includes(marker));
 assert.ok(!/<script|<iframe|<form|<img|<link|<style|\b(?:src|href|action|onload)\s*=/i.test(html));
 assert.ok(!/app\.js|supabase|https?:|intent:|exchangeCodeForSession/i.test(html));
 assert.equal(get.headers.get('Cache-Control'),'no-store');assert.equal(get.headers.get('Referrer-Policy'),'no-referrer');
 assert.match(get.headers.get('Content-Security-Policy'),/default-src 'none'/);assert.match(get.headers.get('Content-Security-Policy'),/script-src 'none'/);assert.match(get.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 assert.equal(get.headers.get('Location'),null);assert.equal(get.headers.get('Set-Cookie'),null);
 assert.equal(await (await worker.fetch(new Request(base+path+'?code=DIFFERENT'),env,{})).text(),html,'landing independent of callback material');
 const head=await worker.fetch(new Request(base+path+'?code='+marker,{method:'HEAD'}),env,{});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Cache-Control'),'no-store');
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) {const r=await worker.fetch(new Request(base+path+'?code='+marker,{method}),env,{});assert.equal(r.status,405);assert.equal(r.headers.get('Allow'),'GET, HEAD');assert.ok(!(await r.text()).includes(marker));}
 for(const url of ['https://other.test'+path, 'http://cardstashy.com'+path,base+':8443'+path,base+'/auth/android/%63allback',base+'/%61uth/android/callback',base+'/auth/android/%2563allback',base+path+'/',base+path+'/extra']) {const r=await worker.fetch(new Request(url+'?code='+marker),env,{});assert.equal(r.status,404,url);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.ok(!(await r.text()).includes(marker));}
 assert.equal(assets,0,'native callbacks never fall through to web app assets');assert.equal(network,0,'no exchange or external request');
 const root=await worker.fetch(new Request(base+'/?code=EXISTING_WEB_FLOW'),env,{});assert.equal(await root.text(),'existing website app');assert.equal(assets,1,'existing web auth root unchanged');
 console.log('PASS: native callback static landing, code secrecy, no scripts/network/SPA, GET/HEAD only, canonical host/path and existing web root preserved.');
} finally {globalThis.fetch=oldFetch;}
