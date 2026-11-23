import { launch, wait } from './cdp.mjs';
// The six unwired elements in the lab: one strip each (status on 60 bodies, hit flashes, five tier looks). Writes element_<name>.png and reports draws and errors.
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn('new Promise(r => { const t = setInterval(() => { if (window.__fxlab) { clearInterval(t); r(1); } }, 200); setTimeout(() => r(0), 20000); })'); await wait(500); await b.evalIn(`(async()=>{ const g = __ds.game; g.field.monsters.fill(null); return 1; })()`);
for (const n of ['ice', 'poison', 'wind', 'earth', 'light', 'dark']) { await b.evalIn(`window.__fxlab.elementStrip('${n}')`); await wait(2200); const r = JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.read())')); console.log(n, 'draws', r.draws, 'tris', r.tris); await b.shot('element_' + n); }
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
