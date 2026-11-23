import { launch, wait } from './cdp.mjs';
// Banner queue: one at a time, two waiting at most, the same kind replaces, "in 5 seconds" counts down.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
const R = await b.evalIn(`(async()=>{ const g = __ds.game, el = document.getElementById('banner'), seen = []; const watch = setInterval(() => seen.push(el.classList.contains('on') ? el.textContent : ''), 100);
  g.event('banner', 'Alpha one'); g.event('banner', 'Beta two'); g.event('banner', 'Gamma three'); g.event('banner', 'Delta four'); g.event('banner', 'Grave Herald in 5 seconds.');
  await new Promise(r => setTimeout(r, 14000)); clearInterval(watch); return JSON.stringify(seen.filter((t, i) => t !== seen[i - 1])); })()`);
console.log(R); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
