import { launch, wait } from './cdp.mjs';
// The own-effect material in the lab: Own stress (a 24 m fan, rings, a 30 m disc, two domes) at the game camera; reports the governor readout and writes pictures.
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3500);
await b.shot('own_before');
await b.evalIn('window.__fxlab.ownStress(true)'); await wait(2500);
console.log('own', JSON.stringify(await b.evalIn('JSON.stringify(window.__fxlab.own())')));
await b.shot('own_stress'); await wait(1500); console.log('own later', JSON.stringify(await b.evalIn('JSON.stringify(window.__fxlab.own())')));
console.log('read', JSON.stringify(await b.evalIn('JSON.stringify(window.__fxlab.read())')));
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
