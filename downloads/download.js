import {esc} from '../ui.js';
const root=document.querySelector('#release');
let release,blobUrl;
async function load(){
 root.innerHTML='<p role="status">Checking the latest download…</p>';
 try{
  const r=await fetch('/api/releases/current',{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Release information is unavailable.');
  release=(await r.json()).android;
  if(!/^\/downloads\/cardstashy-android-beta-\d+\.\d+\.\d+\.apk$/.test(release?.href)||!Number.isSafeInteger(release.bytes)||release.bytes<=0||!/^[a-f0-9]{64}$/i.test(release.sha256))throw Error('Release information could not be verified.');
  root.innerHTML=`<h2>Android ${esc(release.version)}</h2><p class="muted">Interface ${esc(release.interfaceVersion)} · ${(release.bytes/1048576).toFixed(1)} MB</p><button class="btn" id="download">Download verified APK</button><p id="status" role="status"></p><details class="settings-disclosure"><summary>Verify this file</summary><p class="foot">${esc(release.href.split('/').pop())}</p><p class="foot" style="overflow-wrap:anywhere">SHA-256 <code>${esc(release.sha256)}</code></p></details>`;
  root.querySelector('#download').onclick=download;
 }catch(e){root.innerHTML=`<p role="alert">${esc(e.message)}</p><button class="btn ghost" id="retry">Retry</button>`;root.querySelector('#retry').onclick=load;}
}
async function download(){
 const button=root.querySelector('#download'),status=root.querySelector('#status'),record=release;button.disabled=true;status.textContent='Downloading and checking the file…';
 try{
  const response=await fetch(record.href,{cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('The download is unavailable. Check again for the latest release.');
  const bytes=await response.arrayBuffer();if(bytes.byteLength!==record.bytes)throw Error('The download was incomplete. Please retry.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==record.sha256)throw Error('The file did not match this release. It was not offered for installation. Check again.');
  if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.android.package-archive'}));
  const link=document.createElement('a');link.href=blobUrl;link.download=record.href.split('/').pop();link.className='btn';link.textContent='Save verified APK';button.replaceWith(link);status.textContent=`Verified Android ${record.version}. Save the file, then open it to install.`;link.click();
 }catch(e){status.textContent=e.name==='AbortError'||e.name==='TimeoutError'?'Download took too long. Please retry.':e.message;button.disabled=false;}
}
void load();
