import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); 1`); await wait(500); await b.shot('pause_fov');
console.log(await b.evalIn(`(async()=>{ const s = document.querySelector('#pauseScreen .setFov'); s.value = 80; s.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200)); return JSON.stringify({ sliderFound: !!s, vfovAt80: +__ds.camera.fov.toFixed(1), label: document.querySelector('#pauseScreen .setFovV').textContent }); })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
