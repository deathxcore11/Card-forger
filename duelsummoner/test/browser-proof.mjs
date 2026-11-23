import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const el = document.getElementById('proof'); const before = getComputedStyle(el).display; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9' })); await new Promise(r => setTimeout(r, 1200)); return JSON.stringify({ before, after: getComputedStyle(el).display, text: el.textContent }); })()`));
await wait(200); await b.shot('proof_on');
await b.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9' })); 1`);
console.log(await b.evalIn(`getComputedStyle(document.getElementById('proof')).display`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
