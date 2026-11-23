import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn('new Promise(r => { const t = setInterval(() => { if (window.__fxlab) { clearInterval(t); r(1); } }, 200); setTimeout(() => r(0), 20000); })'); await wait(500);
await b.evalIn(`(async()=>{ __ds.game.field.monsters.fill(null); return 1; })()`);
for (const n of ['ice', 'poison']) { await b.evalIn(`window.__fxlab.elementStrip('${n}')`); await wait(2500); await b.evalIn('window.__fxlab.reset()'); await wait(4000); const r = JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.read())')); console.log(n, 'draws', r.draws, 'uploadsPerFrame', JSON.stringify(r.uploadsPerFrame), 'frame avg', r.frameMsAvg, 'worst', r.frameMsWorst); }
b.close(); setTimeout(() => process.exit(0), 300);
