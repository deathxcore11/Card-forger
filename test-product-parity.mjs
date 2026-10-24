import assert from 'node:assert/strict';
import {passwordField,togglePassword} from './auth-form.js';
import {signedOutAccount,settings} from './views.js';
import {createCommunity,communityPage} from './community-profile.js';
import {releaseState,checkRelease,acknowledgeRelease,runtimeVersions} from './release-status.js';
import {planServiceRequest,NATIVE_ORIGIN} from './native-service-policy.js';
import {RELEASE} from './release-record.js';
import worker from './worker.js';
import {S,blank} from './store.js';
const field=passwordField('<input id="pw" type="password">');assert.match(field,/fill="none" stroke="currentColor"/);
const input={type:'password',selectionStart:1,selectionEnd:2,focus(){},setSelectionRange(a,b){assert.equal(a,1);assert.equal(b,2);}},button={dataset:{field:'pw'},setAttribute(k,v){this[k]=v;}};
togglePassword(button,{querySelector:()=>input});assert.equal(input.type,'text');assert.equal(button['aria-label'],'Hide password');togglePassword(button,{querySelector:()=>input});assert.equal(input.type,'password');assert.equal(button['aria-label'],'Show password');
const auth=signedOutAccount({providers:{google:true,email:true}},'login','<b>PROFILE_FIXTURE</b>');assert(auth.indexOf('id="signEmail"')<auth.indexOf('PROFILE_FIXTURE'));assert.doesNotMatch(auth,/Supabase|SMTP/);assert.match(auth,/At least 8 characters/);
S.state=blank();const html=settings(),appearance=html.slice(html.indexOf('id="settings-app"'),html.indexOf('id="settings-info"'));
assert.doesNotMatch(appearance,/installCard|Install CardStashy|Get the Android app/);assert.match(html.slice(html.indexOf('id="settings-recovery"'),html.indexOf('id="settings-app"')),/Install or update CardStashy/);
const empty={account:{user:{id:'A'},profile:{}},data:null,busy:true};assert.doesNotMatch(communityPage(empty),/They’ll appear|No pending requests/);assert.doesNotMatch(communityPage({...empty,busy:false,error:'Offline'}),/They’ll appear/);
const prior={document:globalThis.document,window:globalThis.window};globalThis.document={addEventListener(){}};globalThis.window={addEventListener(){}};
let who='A',finish,calls=0,changes=[];
const community=createCommunity({account:()=>({user:{id:who}}),request:()=>{calls++;return new Promise(r=>finish=r);},active:()=>false,localArt:()=>({}),showcaseChoices:()=>[],onChange:d=>changes.push(d)});
const a=community.refresh(),b=community.refresh();assert.equal(a,b,'requests await the existing overview load instead of returning early');await Promise.resolve();assert.equal(calls,1);finish({people:[{id:'B',relationship:'pending',incoming:true}],items:[]});await b;assert.equal(community.data.people.length,1);
const stale=community.refresh();await Promise.resolve();who='C';community.reset();finish({people:[{id:'PRIVATE_A'}]});await stale;assert.equal(community.data,null,'old-account completion cannot populate the new account');
globalThis.document=prior.document;globalThis.window=prior.window;
const memory=new Map(),store={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
for(const label of ['3.92.0 · Android app 0.4.0-beta','3.92.0 · Android 0.4.0-beta']){
 const runtime=runtimeVersions({native:{platform:'android'},appVersion:label});assert.equal(runtime.nativeVersion,'0.4.0-beta');assert.equal(runtime.interfaceVersion,'3.92.0');
 assert.equal(releaseState({store,runtime,release:{...RELEASE,android:{...RELEASE.android,versionName:'0.4.0-beta'}}}).update,false,'same installed APK must not claim an update');
}
// Website-only releases may advance the web interface while retaining the published APK.
// Exercise both native metadata paths used by the already-installed 0.5.3 app.
const webOnlyRelease={...RELEASE,id:'web-3.94.0-android-0.5.3',webVersion:'3.94.0',android:{...RELEASE.android,versionName:'0.5.3-beta',versionCode:12,interfaceVersion:'3.93.3'}};
for(const native of [{platform:'android',versionName:'0.5.3-beta',versionCode:12},{platform:'android'}]){
 const runtime=runtimeVersions({native,appVersion:'3.93.3 · Android app 0.5.3-beta'});
 const state=releaseState({store,runtime,release:webOnlyRelease});
 assert.equal(state.update,false,'a newer website is not an update to the unchanged installed APK');
 assert.equal(state.unread,true,'website release notes remain readable in the current native app');
 assert.equal(state.release.android.interfaceVersion,'3.93.3','the release identifies the actual bundled APK interface');
}
assert.equal(releaseState({store,release:webOnlyRelease,runtime:{native:true,nativeBuild:11,nativeVersion:'0.5.2-beta',interfaceVersion:'3.93.2'}}).update,true,'an older APK can still update to the published native version');
assert.equal(releaseState({store,release:webOnlyRelease,runtime:{native:true,nativeBuild:13,nativeVersion:'0.6.0-beta',interfaceVersion:'3.94.0'}}).update,false,'a newer local APK must not be offered a downgrade');
assert.equal(releaseState({store,release:webOnlyRelease,runtime:{native:false,interfaceVersion:'3.93.3'}}).update,true,'an older browser interface receives the website update');
assert.equal(releaseState({store,release:webOnlyRelease,runtime:{native:false,interfaceVersion:'3.94.0'}}).update,false,'the current browser interface is up to date');
assert.equal(runtimeVersions({native:{},appVersion:'3.92.0 · Android app unavailable'}).nativeVersion,null);
assert.equal(runtimeVersions({native:{versionName:'0.5.0-beta',versionCode:6},appVersion:'3.92.0 · Android app 0.4.0-beta'}).nativeVersion,'0.5.0-beta','native metadata takes precedence');
const nativeRuntime=globalThis.CARDSTASHY_NATIVE;globalThis.CARDSTASHY_NATIVE={platform:'android'};
await checkRelease(async(url,init)=>{
 const plan=planServiceRequest(url,init);assert.equal(plan.kind,'service');assert.equal(plan.request.credentials,'omit');assert(!plan.request.headers.has('Authorization'));
 const headers=new Headers(plan.request.headers);headers.set('Origin',NATIVE_ORIGIN);
 const response=await worker.fetch(new Request(plan.request,{headers}),{},{});assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*','public release metadata allows credential-free native reads');return response;
});assert.equal(releaseState({store}).error,'');assert.equal(releaseState({store}).checked,true);globalThis.CARDSTASHY_NATIVE=nativeRuntime;
assert.throws(()=>planServiceRequest('/api/releases/current',{method:'POST'}),/Method/);
assert.throws(()=>planServiceRequest('/api/releases/current',{headers:{Authorization:'Bearer fixture'}}),/Authorization/);
let state=releaseState({store,runtime:{native:true,nativeBuild:3,nativeVersion:'0.3.2-beta',interfaceVersion:'3.91.7'}});assert(state.update);assert(state.unread);
const previousStorage=globalThis.localStorage;globalThis.localStorage=store;assert(acknowledgeRelease(RELEASE.id));state=releaseState({store,runtime:{native:true,nativeBuild:3,nativeVersion:'0.3.2-beta',interfaceVersion:'3.91.7'}});assert(!state.unread);assert(state.update,'reading release notes does not install the app');
assert(releaseState({store,release:{...RELEASE,id:'next'},runtime:{native:false,interfaceVersion:'3.91.10'}}).unread);
assert.equal(releaseState({store,runtime:{native:true,nativeBuild:null,nativeVersion:null}}).update,null,'unknown installed version never claims up to date');
await checkRelease(async()=>{throw Error('Offline');});assert.match(releaseState({store}).error,/bundled release/);globalThis.localStorage=previousStorage;
for(const method of ['GET','HEAD']){const r=await worker.fetch(new Request('https://cardstashy.com/api/releases/current',{method}),{},{});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');if(method==='GET')assert.deepEqual(await r.json(),RELEASE);else assert.equal(await r.text(),'');}
console.log('PASS: password icon/accessibility, account-first signup, settings grouping, pending/failed Friends states, shared request race/account isolation, persistent per-release dots, installed-version uncertainty and release endpoint.');
