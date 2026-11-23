import { launch, wait } from './cdp.mjs';
const V = 'C:/Users/masai/AppData/Local/Temp/vid2';
const b = await launch({ out: V, query: '' });
for (const k of ['a', 'b', 'c', 'd']) {
  await b.send('Page.navigate', { url: 'file:///' + V + '/' + k + '.mp4' }); await wait(3000);
  const info = JSON.parse(await b.evalIn(`(async()=>{ const v=document.querySelector('video'); v.muted=true; await new Promise(r=>{ if(v.readyState>=1) r(); else v.onloadedmetadata=r;}); return JSON.stringify({d:v.duration,w:v.videoWidth,h:v.videoHeight}); })()`));
  console.log(k, JSON.stringify(info)); const n = 10;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) * info.d / n; await b.evalIn(`(async()=>{ const v=document.querySelector('video'); v.pause(); await new Promise(r=>{ v.onseeked=r; v.currentTime=${t}; }); return 1; })()`); await wait(350); await b.shot(k + String(i).padStart(2, '0')); }
}
b.close(); setTimeout(() => process.exit(0), 300);
