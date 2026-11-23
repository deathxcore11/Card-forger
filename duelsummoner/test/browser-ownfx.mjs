import { launch, wait } from './cdp.mjs';
// 1. The governor: hold the Own stress scene for 6 s and print the kept sum, the raw kept sum and the governor each second (it must settle at or under the Auto limit of 0.35 and stay there).
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab&moments=full' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3500);
await b.evalIn('window.__fxlab.ownStress(true)');
const rows = []; for (let i = 0; i < 7; i++) { await wait(1000); const o = JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.own())')); rows.push(o); console.log('t=' + (i + 1) + 's', JSON.stringify(o)); }
const last = rows[rows.length - 1], ok = rows.slice(3).every(r => r.keptSum <= 0.352); console.log(ok ? 'PASS governor settles at or under 0.35' : 'FAIL governor above the limit');
await b.shot('own_stress'); console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(ok ? 0 : 1), 300);
