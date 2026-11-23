import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&dev=1&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.sc = 164; return 1; })()`);
await wait(7000); await b.shot('surge_dev');
console.log(await b.evalIn(`document.getElementById('dev') ? document.getElementById('dev').textContent : 'no overlay'`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
