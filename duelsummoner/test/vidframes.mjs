import { launch, wait } from './cdp.mjs';
const b = await launch({ out: 'C:/Users/masai/AppData/Local/Temp/vid', query: '' });
await b.send('Page.navigate', { url: 'file:///C:/Users/masai/AppData/Local/Temp/vid/v.mp4' });
await wait(2500);
const info = await b.evalIn(`(async()=>{ const v=document.querySelector('video'); v.muted=true; await new Promise(r=>{ if(v.readyState>=1) r(); else v.onloadedmetadata=r;}); return JSON.stringify({d:v.duration,w:v.videoWidth,h:v.videoHeight}); })()`);
console.log(info);
const d = JSON.parse(info).d, n = Math.min(24, Math.floor(d / 2));
for (let i = 0; i < n; i++) { const t = (i + 0.5) * d / n; await b.evalIn(`(async()=>{ const v=document.querySelector('video'); v.pause(); await new Promise(r=>{ v.onseeked=r; v.currentTime=${t}; }); return 1; })()`); await wait(250); await b.shot('f' + String(i).padStart(2, '0')); }
b.close(); setTimeout(() => process.exit(0), 300);
