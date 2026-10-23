import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNativeAuth, parseAuthCallback, AUTH_CALLBACK, AUTH_STORAGE_KEY } from '../runtime/native-auth.js';
import { transformNativeAuth } from '../scripts/transform-native-auth.mjs';
function fixture({enabled=true,launch=null,exchange=async()=>({error:null,data:{session:{access_token:'synthetic',refresh_token:'synthetic'}}})}={}) {
  const data=new Map(), storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  let listener,owner=null,version=0,calls=0,adoptions=0,disposed=0,now=1000; const reports=[];
  const plugin={addListener:async(n,f)=>{listener=f;},takeLaunchCallback:async()=>({url:launch}),openAuth:async()=>{}};
  const client={auth:{setSession:async()=>{adoptions++;return {error:null};}}};
  const exchangeFactory=()=>({auth:{exchangeCodeForSession:async code=>{calls++;return exchange(code);},dispose:async()=>{disposed++;}}});
  const auth=createNativeAuth({plugin,storage,enabled,now:()=>now,report:m=>reports.push(m)});
  return {auth,client,storage,reports,exchangeFactory,attach:()=>auth.attach(client,()=>owner,{exchangeFactory,accountVersion:()=>version}),warm:url=>listener({url}),owner:v=>{owner=v;version++;},time:v=>now=v,calls:()=>calls,adoptions:()=>adoptions,disposed:()=>disposed,verifier:()=>storage.setItem(AUTH_STORAGE_KEY+'-code-verifier',JSON.stringify('synthetic-verifier'))};
}
test('callback permits only exact HTTPS callback, one code, no implicit tokens or ambiguity',()=>{
 assert.deepEqual(parseAuthCallback(AUTH_CALLBACK+'?code=synthetic-code'),{code:'synthetic-code'});
 for(const url of [AUTH_CALLBACK,AUTH_CALLBACK+'/?code=x',AUTH_CALLBACK+'?code=x#access_token=z',AUTH_CALLBACK+'?code=x&code=y',AUTH_CALLBACK+'?access_token=z',AUTH_CALLBACK+'?code=x&next=evil',AUTH_CALLBACK.replace('https:','http:')+'?code=x',AUTH_CALLBACK.replace('cardstashy.com','evil.test')+'?code=x',AUTH_CALLBACK.replace('cardstashy.com','cardstashy.com:443')+'?code=x',AUTH_CALLBACK.replace('/auth/','/other/../auth/')+'?code=x']) assert.equal(parseAuthCallback(url),null,url);
});
test('network disabled does not initiate or exchange authentication',async()=>{const f=fixture({enabled:false});await f.attach();assert.throws(()=>f.auth.begin('oauth'));assert.equal(await f.auth.receive(AUTH_CALLBACK+'?code=x'),false);assert.equal(f.calls(),0);});
test('pending callback is one-shot across duplicate warm and cold delivery',async()=>{
 const f=fixture({launch:AUTH_CALLBACK+'?code=x'});f.auth.begin('email');f.verifier();await f.attach();assert.equal(f.calls(),1);await f.auth.receive(AUTH_CALLBACK+'?code=x');assert.equal(f.calls(),1);
});
test('pending flow survives recreated controller with SDK verifier storage retained',async()=>{
 const f=fixture();f.auth.begin('recovery');f.storage.setItem(AUTH_STORAGE_KEY+'-code-verifier','synthetic-verifier/recovery');
 const restarted=createNativeAuth({plugin:{addListener:async()=>{},takeLaunchCallback:async()=>({url:AUTH_CALLBACK+'?code=x'})},storage:f.storage,enabled:true,now:()=>1001});
 await restarted.attach(f.client,()=>null,{exchangeFactory:f.exchangeFactory});assert.equal(f.calls(),1);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY+'-code-verifier'),null);
});
test('rejects stale, unsolicited and changed-account callbacks without exchange',async()=>{
 for(const mode of ['unsolicited','expired','account']) {const f=fixture();await f.attach();if(mode!=='unsolicited')f.auth.begin('oauth');if(mode==='expired')f.time(1900000);if(mode==='account')f.owner('different');assert.equal(await f.auth.receive(AUTH_CALLBACK+'?code=x'),false);assert.equal(f.calls(),0);}
});
test('concurrent callbacks exchange once; cancellation and replacement blocked during exchange',async()=>{
 let resolve;const f=fixture({exchange:()=>new Promise(r=>resolve=r)});await f.attach();f.auth.begin('oauth');f.verifier();const a=f.auth.receive(AUTH_CALLBACK+'?code=x');assert.equal(await f.auth.receive(AUTH_CALLBACK+'?code=x'),false);assert.throws(()=>f.auth.cancel());assert.throws(()=>f.auth.begin('email'));resolve({error:null,data:{session:{access_token:'synthetic',refresh_token:'synthetic'}}});assert.equal(await a,true);assert.equal(f.calls(),1);
});
test('cancel, provider error and failed exchange clear verifier; never echo secrets',async()=>{
 for(const mode of ['cancel','provider','exchange']) {const f=fixture({exchange:async()=>({error:Error('SECRET')})});await f.attach();f.auth.begin('recovery');f.storage.setItem(AUTH_STORAGE_KEY+'-code-verifier','SECRET');if(mode==='cancel')f.auth.cancel();else await f.auth.receive(AUTH_CALLBACK+(mode==='provider'?'?error=denied&error_description=SECRET':'?code=SECRET'));assert.equal(f.storage.getItem(AUTH_STORAGE_KEY+'-code-verifier'),null);assert.ok(f.reports.every(m=>!m.includes('SECRET')));}
});
test('native transform keeps cloud account-isolation logic and fails closed on anchor drift',async()=>{
 const source=await readFile(new URL('../shared-source/cloud.js', import.meta.url),'utf8');const transformed=transformNativeAuth(source);
 assert.match(transformed,/detectSessionInUrl: false/);assert.match(transformed,/skipBrowserRedirect|NATIVE_AUTH.google/);assert.match(transformed,/switchWorkspace\?\.\(next\?\.id\|\|null,baseline\)/);assert.match(transformed,/epoch!==syncEpoch/);assert.throws(()=>transformNativeAuth(source.replace('detectSessionInUrl: true','detectSessionInUrl: changed')));
});
test('OAuth uses exact callback, skips WebView redirect and opens only PKCE provider endpoint',async()=>{
 const f=fixture();let options,opened;const plugin={addListener:async()=>{},takeLaunchCallback:async()=>({}),openAuth:async data=>opened=data};
 const client={auth:{signInWithOAuth:async input=>{options=input;return {data:{url:'https://noxfmbwuytnbvfgukpiv.supabase.co/auth/v1/authorize?redirect_to='+encodeURIComponent(AUTH_CALLBACK)+'&code_challenge_method=s256&code_challenge=synthetic'}};}}};
 const auth=createNativeAuth({plugin,storage:f.storage,enabled:true});await auth.attach(client,()=>null);await auth.google();
 assert.equal(options.options.skipBrowserRedirect,true);assert.equal(options.options.redirectTo,AUTH_CALLBACK);assert.ok(opened.url.startsWith('https://noxfmbwuytnbvfgukpiv.supabase.co/'));
 auth.cancel();client.auth.signInWithOAuth=async()=>({data:{url:'https://evil.test/authorize'}});await assert.rejects(auth.google());
});
test('resend requires original pending signup verifier; cancelled links never exchange',async()=>{
 const f=fixture();await f.attach();await assert.rejects(f.auth.resend(async()=>{}));f.auth.begin('signup');await assert.rejects(f.auth.resend(async()=>{}));f.storage.setItem(AUTH_STORAGE_KEY+'-code-verifier','synthetic');let sent=0;await f.auth.resend(async()=>sent++);assert.equal(sent,1);f.auth.cancel();assert.equal(await f.auth.receive(AUTH_CALLBACK+'?code=x'),false);assert.equal(f.calls(),0);
});
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; };
test('slow initiation cannot be cancelled/replaced or overlap password/resend writes',async()=>{
 const f=fixture();await f.attach();const d=deferred();const old=f.auth.run('email',async()=>{f.verifier();await d.promise;f.storage.setItem(AUTH_STORAGE_KEY+'-code-verifier','old-write');});
 assert.throws(()=>f.auth.cancel());assert.throws(()=>f.auth.begin('signup'));await assert.rejects(f.auth.transition(async()=>assert.fail('password must not start')));await assert.rejects(f.auth.resend(async()=>assert.fail('resend must not start')));
 d.reject(Error('delayed failure'));await assert.rejects(old);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY+'-code-verifier'),null);
 f.auth.begin('signup');f.storage.setItem(AUTH_STORAGE_KEY+'-code-verifier','new-write');await new Promise(r=>setImmediate(r));assert.equal(f.storage.getItem(AUTH_STORAGE_KEY+'-code-verifier'),'new-write');
});
test('owner change during isolated exchange never adopts or reports success, including A-B-A',async()=>{
 for(const roundTrip of [false,true]) {const d=deferred(),f=fixture({exchange:()=>d.promise});f.owner('A');await f.attach();f.auth.begin('email');f.verifier();const result=f.auth.receive(AUTH_CALLBACK+'?code=x');f.owner('B');if(roundTrip)f.owner('A');d.resolve({error:null,data:{session:{access_token:'isolated',refresh_token:'isolated'}}});assert.equal(await result,false);assert.equal(f.calls(),1);assert.equal(f.adoptions(),0);assert.equal(f.disposed(),1);assert.ok(!f.reports.includes('Sign-in completed.'));}
});
test('resend serializes regenerated verifier, rejects newer operations and invalidates changed owner',async()=>{
 const f=fixture();f.owner('A');await f.attach();f.auth.begin('signup');f.verifier();const d=deferred();const sending=f.auth.resend(async()=>{await d.promise;f.storage.setItem(AUTH_STORAGE_KEY+'-code-verifier','regenerated');});
 await assert.rejects(f.auth.resend(async()=>assert.fail('repeat resend')));assert.throws(()=>f.auth.cancel());await assert.rejects(f.auth.run('recovery',async()=>assert.fail('new reset')));f.owner('B');d.resolve();await assert.rejects(sending);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY+'-code-verifier'),null);assert.equal(f.adoptions(),0);
});
test('direct auth transition blocks initiation and callbacks until operation completes',async()=>{
 const f=fixture();await f.attach();const d=deferred();const login=f.auth.transition(()=>d.promise);await assert.rejects(f.auth.run('email',async()=>assert.fail('overlap')));assert.equal(await f.auth.receive(AUTH_CALLBACK+'?code=x'),false);d.resolve('logged-in');assert.equal(await login,'logged-in');assert.equal(f.calls(),0);
});
test('callback arriving during initiation is deferred until verifier write finishes',async()=>{
 const f=fixture();await f.attach();const d=deferred();const start=f.auth.run('email',async()=>{await d.promise;f.verifier();});await f.auth.receive(AUTH_CALLBACK+'?code=x');assert.equal(f.calls(),0);d.resolve();await start;await new Promise(r=>setImmediate(r));assert.equal(f.calls(),1);assert.equal(f.adoptions(),1);
});
test('actual pinned SDK exchanges into isolated memory only; stale owner never touches primary',async()=>{
 const {createClient}=await import(new URL('../shared-source/vendor/supabase-js-2.110.0.js',import.meta.url));
 const f=fixture(),network=deferred(),started=deferred();f.owner('A');
 const primary={auth:{setSession:async()=>assert.fail('stale session must not be adopted')}};
 let disposed=false,isolatedStorage;
 const factory=({storage,storageKey})=>{
   isolatedStorage=storage;
   const sdk=createClient('https://synthetic.supabase.co','sb_publishable_synthetic',{global:{fetch:async(url)=>{assert.equal(String(url),'https://synthetic.supabase.co/auth/v1/token?grant_type=pkce');started.resolve();return network.promise;}},auth:{flowType:'pkce',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage,storageKey}});
   const dispose=sdk.auth.dispose.bind(sdk.auth);sdk.auth.dispose=async()=>{disposed=true;await dispose();};return sdk;
 };
 const auth=createNativeAuth({plugin:{addListener:async()=>{},takeLaunchCallback:async()=>({})},storage:f.storage,enabled:true});
 let owner='A',epoch=1;await auth.attach(primary,()=>owner,{exchangeFactory:factory,accountVersion:()=>epoch});auth.begin('email');f.verifier();const result=auth.receive(AUTH_CALLBACK+'?code=synthetic');await started.promise;owner='B';epoch++;
 network.resolve(Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,user:{id:'returned-user'}}));
 assert.equal(await result,false);assert.equal(disposed,true);assert.ok(isolatedStorage);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY),null);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY+'-code-verifier'),null);
});
test('actual primary SDK rejects stale adoption at storage commit after lock or user-fetch waits',async()=>{
 const {createClient}=await import(new URL('../shared-source/vendor/supabase-js-2.110.0.js',import.meta.url));
 const jwt = 'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'C',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.c2lnbmF0dXJl';
 for(const waitAt of ['lock','user']) {
   const f=fixture(),entered=deferred(),release=deferred();let owner='A',epoch=1,block=false,signedIn=0;
   const auth=createNativeAuth({plugin:{addListener:async()=>{},takeLaunchCallback:async()=>({})},storage:f.storage,enabled:true});
   const primary=createClient('https://synthetic.supabase.co','sb_publishable_synthetic',{global:{fetch:async url=>{assert.equal(String(url),'https://synthetic.supabase.co/auth/v1/user');if(waitAt==='user'){entered.resolve();await release.promise;}return Response.json({id:'C'});}},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:AUTH_STORAGE_KEY,storage:auth.sessionStorage,lock:async(name,timeout,fn)=>{if(block&&waitAt==='lock'){block=false;entered.resolve();await release.promise;}return fn();}}});
   await primary.auth.initialize();await new Promise(resolve=>primary.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN')signedIn++;if(event==='INITIAL_SESSION')resolve();}));await new Promise(r=>setImmediate(r));
   const exchangeFactory=()=>({auth:{exchangeCodeForSession:async()=>({data:{session:{access_token:jwt,refresh_token:'synthetic-refresh'}},error:null}),dispose:async()=>{}}});
   await auth.attach(primary,()=>owner,{exchangeFactory,accountVersion:()=>epoch});auth.begin('email');f.verifier();block=true;
   const result=auth.receive(AUTH_CALLBACK+'?code=synthetic');await Promise.race([entered.promise,result.then(value=>{throw Error('finished before wait '+waitAt+': '+value);})]);
   owner='B';epoch++;const newer=JSON.stringify({user:{id:'B'},access_token:'newer',refresh_token:'newer'});f.storage.setItem(AUTH_STORAGE_KEY,newer);release.resolve();
   assert.equal(await result,false,waitAt);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY),newer,'must not overwrite or erase newer session');assert.equal(signedIn,0);await primary.auth.dispose();
 }
});
test('guarded primary storage permits successful own SIGNED_IN epoch and recovery admission',async()=>{
 const f=fixture();let owner='A',epoch=1,recovered=0;
 const auth=createNativeAuth({plugin:{addListener:async()=>{},takeLaunchCallback:async()=>({})},storage:f.storage,enabled:true});
 const client={auth:{setSession:async()=>{auth.sessionStorage.setItem(AUTH_STORAGE_KEY,'accepted');owner='C';epoch++;return {error:null};}}};
 await auth.attach(client,()=>owner,{accountVersion:()=>epoch,exchangeFactory:f.exchangeFactory,onRecovery:()=>recovered++});auth.begin('recovery');f.verifier();assert.equal(await auth.receive(AUTH_CALLBACK+'?code=x'),true);assert.equal(f.storage.getItem(AUTH_STORAGE_KEY),'accepted');assert.equal(recovered,1);
 // Admission is scoped: normal SDK removals and later storage writes are not blocked.
 auth.sessionStorage.removeItem(AUTH_STORAGE_KEY);auth.sessionStorage.setItem(AUTH_STORAGE_KEY,'later');assert.equal(f.storage.getItem(AUTH_STORAGE_KEY),'later');
});
