import { launch, wait } from './cdp.mjs';
// Low-res target and upscale (engine plan 0b): at several screen sizes the canvas is drawn at device size from an internal target by a whole-number nearest scale s = max(2, round(height / 540)),
// internal size ceil(width / s) x ceil(height / s); every game pixel is s x s device pixels (checked on the real canvas pixels), so there are no uneven rows.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
let bad = 0;
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 800)); return 1; })()`);
for (const [w, h, dpr] of [[1920, 1080, 1], [1367, 771, 1], [1280, 720, 1], [1373, 1045, 1.25], [960, 540, 2.25]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false }); await wait(600);
  const r = await b.evalIn(`(()=>{ const D = __ds, c = document.getElementById('view'), dw = c.width, dh = c.height, s = +c.dataset.block; D.blitNow(); const g = document.createElement('canvas'); g.width = dw; g.height = dh; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const px = x.getImageData(0, 0, dw, dh).data; let uneven = 0, checked = 0;
    for (let k = 0; k < 4000; k++) { const X = (k * 7919) % dw, Y = (k * 104729) % dh, bx = X - X % s, by = Y - Y % s; if (bx + s > dw || by + s > dh) continue; const i = (Y * dw + X) * 4, j = (by * dw + bx) * 4; checked++; if (px[i] !== px[j] || px[i + 1] !== px[j + 1] || px[i + 2] !== px[j + 2]) uneven++; }
    return { buffer: dw + 'x' + dh, want: Math.round(innerWidth * devicePixelRatio) + 'x' + Math.round(innerHeight * devicePixelRatio), s, internal: c.dataset.internal, expectInternal: Math.ceil(dw / s) + 'x' + Math.ceil(dh / s), expectS: Math.max(2, Math.round(dh / 540)), checked, uneven }; })()`);
  const ok = r.buffer === r.want && r.internal === r.expectInternal && r.s === r.expectS && r.uneven === 0 && r.checked > 1000; if (!ok) bad++; console.log(w + 'x' + h + '@' + dpr, JSON.stringify(r), ok ? 'OK' : 'BAD');
}
await wait(200); await b.shot('lowres_last');
console.log('bad', bad, JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
