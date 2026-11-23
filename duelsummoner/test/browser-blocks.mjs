import { launch, wait } from './cdp.mjs';
// Even pixel blocks: at several device pixel ratios the canvas CSS size is a whole number of blocks and every block is a whole number of device pixels.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
let bad = 0;
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 800)); return 1; })()`);
for (const [w, h, dpr] of [[1280, 720, 1], [1373, 1045, 1.25], [1920, 1080, 1], [1280, 720, 2], [960, 540, 2.25]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false }); await wait(500);
  const r = await b.evalIn(`(()=>{ const c = document.getElementById('view'), d = window.devicePixelRatio, cssW = parseFloat(c.style.width), cssH = parseFloat(c.style.height); const B = +c.dataset.block; return { dpr: d, buffer: c.width + 'x' + c.height, block: B, devW: +(cssW * d).toFixed(3), devH: +(cssH * d).toFixed(3), scaleX: +((cssW * d) / c.width).toFixed(4), scaleY: +((cssH * d) / c.height).toFixed(4), marginX: Math.round(innerWidth * d - cssW * d), marginY: Math.round(innerHeight * d - cssH * d) }; })()`);
  const even = Number.isInteger(r.scaleX) && Number.isInteger(r.scaleY) && r.scaleX === r.scaleY; if (!even) bad++; console.log(w + 'x' + h + '@' + dpr, JSON.stringify(r), even ? 'EVEN' : 'UNEVEN');
}
console.log('uneven', bad, JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
