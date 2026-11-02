import {esc} from '../ui.js';
const root=document.querySelector('#release');
let release,blobUrl;
const android=/Android/i.test(navigator.userAgent||'');
const steps='<ol class="foot download-steps"><li>Tap Download. The file is checked before it is saved.</li><li>Tap Save if your browser asks, then open the file.</li><li>The first time, Android asks to allow installs from your browser: turn on Allow from this source.</li><li>Tap Install (or Update). Your saved cards and decks stay.</li></ol><p class="foot">From then on, the app updates itself: Settings or Home shows Update now, and Android asks you to confirm.</p>';
async function load(){
 root.innerHTML='<p role="status">Checking the latest download…</p>';
 try{
  const r=await fetch('/api/releases/current',{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Release information is unavailable.');
  release=(await r.json()).android;
  if(!/^\/downloads\/cardstashy-android-beta-\d+\.\d+\.\d+\.apk$/.test(release?.href)||!Number.isSafeInteger(release.bytes)||release.bytes<=0||!/^[a-f0-9]{64}$/i.test(release.sha256))throw Error('Release information could not be verified.');
  root.innerHTML=`${android?'':'<p class="note">Open <b>cardstashy.com/downloads</b> on your Android phone to install the app there.</p>'}<h2>Android ${esc(release.version)}</h2><p class="muted">Interface ${esc(release.interfaceVersion)} · ${(release.bytes/1048576).toFixed(1)} MB</p><button class="btn" id="download">Download verified APK</button><div id="progress" hidden><div class="app-update-progress" role="progressbar" aria-label="Downloading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span style="width:0%"></span></div></div><p id="status" role="status"></p>${steps}<details class="settings-disclosure"><summary>Verify this file</summary><p class="foot">${esc(release.href.split('/').pop())}</p><p class="foot" style="overflow-wrap:anywhere">SHA-256 <code>${esc(release.sha256)}</code></p></details>`;
  root.querySelector('#download').onclick=download;
 }catch(e){root.innerHTML=`<p role="alert">${esc(e.message)}</p><button class="btn ghost" id="retry">Retry</button>`;root.querySelector('#retry').onclick=load;}
}
async function download(){
 const button=root.querySelector('#download'),status=root.querySelector('#status'),record=release;button.disabled=true;status.textContent='Downloading and checking the file…';
 try{
  const response=await fetch(record.href,{cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(900000)});
  if(!response.ok)throw Error('The download is unavailable. Check again for the latest release.');
  const progress=root.querySelector('#progress'),fill=progress.querySelector('span'),meter=progress.firstElementChild;progress.hidden=false;
  const chunks=[];let received=0;const reader=response.body.getReader();
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;if(received>record.bytes)throw Error('The download was larger than this release. Check again.');const pct=Math.floor(received/record.bytes*100);fill.style.width=pct+'%';meter.setAttribute('aria-valuenow',String(pct));status.textContent=`Downloading… ${(received/1048576).toFixed(0)} of ${(record.bytes/1048576).toFixed(0)} MB`;}
  const bytes=await new Blob(chunks).arrayBuffer();chunks.length=0;status.textContent='Checking the file…';if(bytes.byteLength!==record.bytes)throw Error('The download was incomplete. Please retry.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==record.sha256)throw Error('The file did not match this release. It was not offered for installation. Check again.');
  if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.android.package-archive'}));
  const link=document.createElement('a');link.href=blobUrl;link.download=record.href.split('/').pop();link.className='btn';link.textContent='Save verified APK';button.replaceWith(link);status.textContent=`Verified Android ${record.version}. Save the file, then open it to install.`;link.click();root.querySelector('#progress').hidden=true;
 }catch(e){status.textContent=e.name==='AbortError'||e.name==='TimeoutError'?'Download took too long. Please retry.':e.message;button.disabled=false;}
}
void load();
