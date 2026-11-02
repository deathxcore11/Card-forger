// Getting and updating the Android app.
// - In the Android app: when the server publishes a newer APK, Home shows an Update card and Settings an
//   Update button. One tap downloads it inside the app (with progress), checks it against the release
//   record, and opens Android's own "Update this app?" prompt. The first time, Android asks to allow
//   installs from CardStashy; coming back with that switch on carries straight on.
// - On an Android phone's browser: Home offers the app once in a while, linking to the download page.
import {checkRelease,releaseState,useNativeUpdateAction} from './release-status.js';
import {esc} from './ui.js';

const KEY='cardstashy-app-update-v1';
const read=()=>{try{return JSON.parse(globalThis.localStorage?.getItem(KEY)||'{}')||{};}catch{return {};}};
const write=value=>{try{globalThis.localStorage?.setItem(KEY,JSON.stringify({...read(),...value}));}catch{}};
const listeners=new Set();
const updater=()=>globalThis.CARDSTASHY_UPDATER||null;
const native=()=>!!globalThis.CARDSTASHY_NATIVE;
const mb=bytes=>(bytes/1048576).toFixed(bytes>=1048576*10?0:1);
// idle · downloading · ready · installing · permission · error
let job={phase:'idle',received:0,total:0,error:'',versionCode:null};
let progressOff=null;
const set=next=>{job={...job,...next};listeners.forEach(fn=>{try{fn(job);}catch{}});};
export const onAppUpdate=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const appUpdateJob=()=>job;

export const isAndroidBrowser=(ua=globalThis.navigator?.userAgent||'')=>/Android/i.test(ua)&&!native();
// The published APK this app can update to, or null.
export function availableUpdate(state=releaseState()){
 if(!native()||state.update!==true)return null;
 const a=state.release.android;return Number.isInteger(a?.versionCode)&&a.sha256&&a.href?a:null;
}

// The first launch after an update says so once.
export function justUpdated({installed=updater()}={}){
 const code=installed?.versionCode;if(!Number.isInteger(code))return null;
 const before=read().lastRunCode;write({lastRunCode:code});
 return Number.isInteger(before)&&code>before?installed.versionName||String(code):null;
}

export async function startAppUpdate(){
 const plugin=updater();
 if(!plugin){globalThis.open?.('https://cardstashy.com/downloads/','_blank','noopener');return;}
 if(job.phase==='downloading'||job.phase==='installing')return;
 const state=await checkRelease().catch(()=>releaseState()),target=availableUpdate(state||releaseState());
 if(!target){set({phase:'error',error:'This app is already up to date.'});return;}
 if(job.phase==='ready'&&job.versionCode===target.versionCode)return installAppUpdate();
 set({phase:'downloading',received:0,total:target.bytes,error:'',versionCode:target.versionCode});
 try{
  progressOff??=await plugin.onProgress(event=>{if(job.phase==='downloading'&&event?.versionCode===job.versionCode)set({received:event.received,total:event.total||job.total});});
  const result=await plugin.download({url:'https://cardstashy.com'+target.href,bytes:target.bytes,sha256:target.sha256,versionCode:target.versionCode,package:target.package});
  if(result?.status==='cancelled'){set({phase:'idle',received:0});return;}
  set({phase:'ready',received:target.bytes});
  await installAppUpdate();
 }catch(error){set({phase:'error',error:error?.message||'The download stopped. Try again.'});}
}
export async function installAppUpdate(){
 const plugin=updater();if(!plugin||!job.versionCode)return;
 set({phase:'installing',error:''});
 try{
  const result=await plugin.install({versionCode:job.versionCode});
  // Android's prompt is up; if it is dismissed, the downloaded file stays ready for another tap.
  set({phase:result?.status==='permission-needed'?'permission':'ready'});
 }catch(error){set({phase:'error',error:error?.message||'Android’s installer could not open the update.'});}
}
export async function cancelAppUpdate(){try{await updater()?.cancel();}catch{}set({phase:'idle',received:0});}
export function dismissAppBanner(){
 const target=availableUpdate();
 write(target?{laterCode:target.versionCode}:{getAppLaterAt:Date.now()});
 listeners.forEach(fn=>{try{fn(job);}catch{}});
}

const bar=()=>{const pct=job.total?Math.min(100,Math.floor(job.received/job.total*100)):0;
 return `<div class="app-update-progress" role="progressbar" aria-label="Downloading the update" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div><p class="app-update-status small">${mb(job.received)} of ${mb(job.total)} MB · ${pct}%</p>`;};
// The action row for the current step, shared by the Home card and Settings.
function actions(target,options){return `<div class="app-update-step">${step(target,options)}</div>`;}
function step(target,{later=false}={}){
 switch(job.phase){
  case 'downloading':return `${bar()}<div class="actions"><button class="link small" data-act="appUpdateCancel">Cancel</button></div>`;
  case 'installing':return `<p class="app-update-status small" role="status">Opening Android’s installer…</p>`;
  case 'ready':return `<p class="app-update-status small" role="status">Downloaded and checked. Tap Install, then Update on Android’s prompt.</p><div class="actions"><button class="btn small" data-act="appUpdateInstall">Install</button></div>`;
  case 'permission':return `<p class="app-update-status small" role="status">Android asks once to allow installs from CardStashy. Tap below, turn on Allow from this source, then come back.</p><div class="actions"><button class="btn small" data-act="appUpdateInstall">Allow and install</button></div>`;
  case 'error':return `<p class="app-update-status small" role="alert">${esc(job.error)}</p><div class="actions"><button class="btn small" data-act="appUpdate">Try again</button></div>`;
  default:return `<div class="actions"><button class="btn small" data-act="appUpdate">Update now</button>${later?'<button class="link small" data-act="appUpdateLater">Later</button>':''}</div>`;
 }
}
const whatsNew=(release,count)=>release.changes.slice(0,count).map(c=>`<li>${esc(c)}</li>`).join('');

// Settings > Updates, inside the Android app.
export function appUpdatePanel(state=releaseState()){
 const target=availableUpdate(state);if(!target)return '';
 return `<div class="app-update-panel" data-app-update="panel"><p class="app-update-title"><b>Android ${esc(target.version)}</b> <span class="muted small">${mb(target.bytes)} MB</span></p>${actions(target)}</div>`;
}
useNativeUpdateAction(state=>updater()?appUpdatePanel(state):'<a class="btn" href="https://cardstashy.com/downloads/" target="_blank" rel="noopener">Update Android app</a>');

// Home: the update in the app, or the app itself on an Android phone's browser.
export function appUpdateBanner({state=releaseState(),saved=read(),now=Date.now(),ua}={}){
 const target=availableUpdate(state);
 if(target){
  if(job.phase==='idle'&&saved.laterCode===target.versionCode)return '';
  return `<section class="app-update-banner panel" data-app-update="banner" aria-label="App update"><img src="icon-192.png" alt="" width="44" height="44"><div><p class="eyebrow">UPDATE READY</p><h2>CardStashy ${esc(target.version)}</h2><p class="muted small">${mb(target.bytes)} MB · downloads in the app, then Android asks you to confirm.</p><details class="app-update-notes"><summary>What’s new</summary><ul>${whatsNew(state.release,6)}</ul></details>${actions(target,{later:true})}</div></section>`;
 }
 if(!isAndroidBrowser(ua))return '';
 if(saved.getAppLaterAt&&now-saved.getAppLaterAt<14*864e5)return '';
 const a=state.release.android;
 return `<section class="app-update-banner panel" data-app-update="banner" aria-label="Get the Android app"><img src="icon-192.png" alt="" width="44" height="44"><div><p class="eyebrow">ANDROID APP</p><h2>Get CardStashy for Android</h2><p class="muted small">Version ${esc(a.version)} · ${mb(a.bytes)} MB. Card art saved on your phone, the Forge engine built in, and updates from inside the app.</p><div class="actions"><a class="btn small" href="https://cardstashy.com/downloads/" target="_blank" rel="noopener">Get the app</a><button class="link small" data-act="appUpdateLater">Not now</button></div></div></section>`;
}

// Repaints the Home card and the Settings panel in place, so progress never re-renders the page.
export function paintAppUpdate(root=globalThis.document,{home=false}={}){
 const content=root?.querySelector?.('#content');
 const banner=root?.querySelector?.('[data-app-update="banner"]'),markup=home?appUpdateBanner():'';
 // Same card already showing: swap only its step row, so an open "What's new" stays open.
 const fresh=markup&&root.createElement?Object.assign(root.createElement('template'),{innerHTML:markup}).content.firstElementChild:null;
 const step=banner?.querySelector?.('.app-update-step'),nextStep=fresh?.querySelector?.('.app-update-step');
 if(banner&&fresh&&step&&nextStep&&banner.getAttribute('aria-label')===fresh.getAttribute('aria-label'))step.replaceWith(nextStep);
 else if(banner){if(markup)banner.outerHTML=markup;else banner.remove();}
 else if(markup&&content)content.insertAdjacentHTML('afterbegin',markup);
 for(const panel of root?.querySelectorAll?.('[data-app-update="panel"]')||[]){const next=appUpdatePanel();if(next)panel.outerHTML=next;else panel.remove();}
}
