import assert from 'node:assert/strict';
const store={};globalThis.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}};
const m=await import('./app-update.js');
const ua='Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile';
const show=()=>m.appUpdateBanner({ua,saved:JSON.parse(store['cardstashy-app-update-v1']||'{}'),now:Date.now()});
assert.match(show(),/Get CardStashy for Android/);assert.match(show(),/I already have it/);
assert.equal(m.appUpdateBanner({ua:'Mozilla/5.0 (X11; Linux x86_64) Chrome/130'}),'');       // desktop site: not an Android phone
m.dismissAppBanner();assert.equal(show(),'');                                              // Not now hides it
m.reminderNewSignIn();assert.match(show(),/Get CardStashy/);                                // a new sign-in brings it back
m.markAppInstalled();assert.equal(show(),'');m.reminderNewSignIn();assert.equal(show(),''); // I already have it stays hidden
store['cardstashy-app-update-v1']='{}';
assert.equal(await m.detectInstalledApp({getInstalledRelatedApps:async()=>[{platform:'play',id:'com.cardstashy.app'}]}),true);assert.equal(show(),'');
store['cardstashy-app-update-v1']='{}';
assert.equal(await m.detectInstalledApp({getInstalledRelatedApps:async()=>[]}),false);assert.equal(await m.detectInstalledApp({}),false);assert.match(show(),/Get CardStashy/);
console.log('PASS: Android app reminder shows on Android browsers, hides on Not now until next sign-in, hides for good when the app is installed.');
