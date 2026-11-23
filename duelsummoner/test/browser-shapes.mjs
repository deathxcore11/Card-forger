import { launch, wait } from './cdp.mjs';
// The six elements side by side by shape and motion, in colour and in greyscale (the lab check that each is recognisable in a black and white screenshot). Three frames 0.4 s apart show the motion.
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn('new Promise(r => { const t = setInterval(() => { if (window.__fxlab) { clearInterval(t); r(1); } }, 200); setTimeout(() => r(0), 20000); })'); await wait(500);
await b.evalIn(`(async()=>{ const g = __ds.game; g.field.monsters.fill(null); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.god = true; g.spawnAcc = -1e9; __ds.freeze(true); if (__ds.grass) __ds.grass.visible = false; return 1; })()`);
await b.evalIn('window.__fxlab.showShapes(false)'); await wait(1500); await b.shot('elements_colour');
await b.evalIn('window.__fxlab.showShapes(true)'); await wait(1200); await b.shot('elements_grey_a'); await wait(450); await b.shot('elements_grey_b');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
