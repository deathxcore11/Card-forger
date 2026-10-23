import {RELEASE} from './release-record.js';
import {APP_VERSION} from './config.js';
import {esc} from './ui.js';
const KEY='cardstashy-release-seen-v1';
let latest=RELEASE,error='',checked=false,flight=null;
const listeners=new Set();
const storage=()=>{try{return globalThis.localStorage;}catch{return null;}};
export function runtimeVersions({native=globalThis.CARDSTASHY_NATIVE,appVersion=APP_VERSION}={}){
 return {native:!!native,nativeVersion:native?.versionName||appVersion.match(/\bAndroid(?:\s+app)?\s+(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i)?.[1]||null,nativeBuild:Number.isInteger(native?.versionCode)?native.versionCode:null,interfaceVersion:appVersion.split(/\s+[·|]/)[0]};
}
const compare=(a,b)=>{const aa=String(a).match(/\d+/g)||[],bb=String(b).match(/\d+/g)||[];for(let i=0;i<Math.max(aa.length,bb.length);i++){const delta=Number(aa[i]||0)-Number(bb[i]||0);if(delta)return delta;}return 0;};
export function releaseState({release=latest,runtime=runtimeVersions(),store=storage()}={}){
 let seen=false;try{seen=store?.getItem(KEY)===release.id;}catch{}
 const update=runtime.native?(runtime.nativeBuild!==null?runtime.nativeBuild<release.android.versionCode:runtime.nativeVersion?compare(runtime.nativeVersion,release.android.versionName)<0:null):compare(runtime.interfaceVersion,release.webVersion)<0;
 return {release,runtime,update,unread:!seen,error,checked};
}
export const onReleaseChange=fn=>listeners.add(fn);
const changed=()=>listeners.forEach(fn=>fn());
export function acknowledgeRelease(id){if(id!==latest.id)return false;try{storage()?.setItem(KEY,id);}catch{}changed();return true;}
export async function checkRelease(fetcher=fetch){
 if(flight)return flight;
 flight=(async()=>{try{const url=globalThis.CARDSTASHY_NATIVE?'https://cardstashy.com/api/releases/current':'/api/releases/current';const response=await fetcher(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Update information could not load.');const r=await response.json();if(!r.id||!r.webVersion||!Array.isArray(r.changes)||!Number.isInteger(r.android?.versionCode)||!/^\/downloads\/cardstashy-android-beta-\d+\.\d+\.\d+\.apk$/.test(r.android.href)||!/^[a-f0-9]{64}$/i.test(r.android.sha256))throw Error('Update information could not be verified.');latest=r;error='';checked=true;}catch(e){error='Could not check for updates. Showing bundled release information.';}finally{flight=null;changed();}return releaseState();})();return flight;
}
export const releaseDot=()=>releaseState().unread?'<span class="release-dot" aria-hidden="true"></span><span class="sr-only" data-release-unread>Unread release notes</span>':'';
export function releaseDetailsMarkup(){const s=releaseState(),r=s.release;
 return `<section class="settings-release" aria-label="App updates"><div class="row between"><h3>Updates ${releaseDot()}</h3><button class="link small" data-act="checkRelease">Check for updates</button></div><p class="small" role="status">${s.update===true?'Update available':s.update===null?'Installed app version could not be detected':s.checked?'You’re up to date':'Latest release information'}${s.error?' · '+esc(s.error):''}</p>${s.runtime.native&&s.update===true?'<a class="btn" href="https://cardstashy.com/downloads/" target="_blank" rel="noopener">Update Android app</a>':''}<details data-release-item="${esc(r.id)}"><summary>${releaseDot()} ${esc(r.webVersion)} · ${esc(r.date)}</summary><ul>${r.changes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><p class="foot">Website ${esc(r.webVersion)} · Android ${esc(r.android.version)} · bundled interface ${esc(r.android.interfaceVersion)}.</p><a class="link" href="https://cardstashy.com/downloads/" target="_blank" rel="noopener">Android download &amp; verification</a></details></section>`;
}
export function versionsMarkup(){const r=runtimeVersions();return `<p class="settings-version">Interface ${esc(r.interfaceVersion)}${r.native?` · Android ${esc(r.nativeVersion||'version unavailable')}`:''}</p>${releaseDetailsMarkup()}`;}
