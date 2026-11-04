import {esc} from '../ui.js';
// cardstashy.com/downloads: one download, the native Android app (Randall 4 Nov 2026). No classic app.
const root=document.querySelector('#release');
const android=/Android/i.test(navigator.userAgent||'');
const steps='<ol class="foot download-steps"><li>Tap Download, then open the file.</li><li>The first time, Android asks to allow installs from your browser: turn on Allow from this source.</li><li>Tap Install (or Update). Your account and decks stay.</li></ol>';
async function load(){
 root.innerHTML='<p role="status">Checking the latest download…</p>';
 try{
  const r=await fetch('/api/releases/current',{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Download information is unavailable.');
  const nt=(await r.json()).nativeTest;
  if(!nt||!/^\/downloads\/cardstashy-native-test-\d+\.\d+\.\d+\.apk$/.test(nt.href)||!/^\d+\.\d+\.\d+$/.test(nt.version||'')||!Number.isSafeInteger(nt.bytes)||nt.bytes<=0)throw Error('Download information could not be verified.');
  root.innerHTML=`${android?'':'<p class="note">Open <b>cardstashy.com/downloads</b> on your Android phone to install it there.</p>'}<a class="btn" href="${esc(nt.href)}" download>Download for Android</a><p class="muted small">Version ${esc(nt.version)} · ${(nt.bytes/1048576).toFixed(1)} MB · test build</p>${steps}`;
 }catch(e){root.innerHTML=`<p role="alert">${esc(e.message)}</p><button class="btn ghost" id="retry">Retry</button>`;root.querySelector('#retry').onclick=load;}
}
void load();
