import { launch, wait } from './cdp.mjs';
// The FX lab and the worst case budget: opens ?fxlab, reads the ES 3.00 probe, the idle numbers, then switches Worst case on (300 enemies and every element's bursts at the pool caps) and reads draws, triangles, frame time and the
// uploads per frame again. Pass: probe OK, draws under 150, triangles under 250,000, no page errors.   node test/browser-fxlab.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3500);
const probe = await b.evalIn('JSON.stringify({ probe: window.__fxlab.probe, ok: window.__fxlab.probeOk })'); console.log(probe);
await b.evalIn('window.__fxlab.reset()'); await wait(3000); const idle = JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.read())')); console.log('idle ', JSON.stringify(idle));
await b.shot('fxlab_idle');
await b.evalIn('window.__fxlab.worstCase(true)'); await wait(2500); await b.evalIn('window.__fxlab.reset()'); await wait(5000); const w = JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.read())')); console.log('worst', JSON.stringify(w));
await b.shot('fxlab_worst');
const errs = JSON.parse(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')); console.log('errors', JSON.stringify(errs));
const ok = JSON.parse(probe).ok && w.draws < 150 && w.tris < 250000 && errs.length === 0; console.log(ok ? 'PASS' : 'FAIL'); b.close(); setTimeout(() => process.exit(ok ? 0 : 1), 300);
