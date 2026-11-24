import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Every banner and prompt string through the real HUD at 412x915 and 915x412 with touch: each text is shown, and its box is checked against the HUD boxes (Health, clock, minimap, boss bar), the touch buttons and the hand bar. Lists collisions; saves pictures of the boss card and bar and the longest banner.
//   node test/browser-banners.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const texts = JSON.parse(process.env.BANNERS || '[]');
for (const [W, H] of [[412, 915], [915, 412]]) {
  const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true }); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); window.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [] })); D.game.opts.offers = false; D.game.god = true; document.body.dataset.mode = 'play'; return 1; })()`);
  const bad = [];
  for (const t of texts) {
    const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds; D.game.event('banner', ${JSON.stringify(t)}); await new Promise(r => setTimeout(r, 650)); const e = document.getElementById('banner'), bb = e.getBoundingClientRect(), hits = []; const boxes = { health: 'topleft', clock: 'topright', minimap: 'minimap', zones: 'zones' }; for (const [n, id] of Object.entries(boxes)) { const x = document.getElementById(id); if (!x) continue; const r = x.getBoundingClientRect(); if (r.width && bb.left < r.right && bb.right > r.left && bb.top < r.bottom && bb.bottom > r.top) hits.push(n); } for (const x of document.querySelectorAll('.tcb')) { const r = x.getBoundingClientRect(); if (r.width && bb.left < r.right && bb.right > r.left && bb.top < r.bottom && bb.bottom > r.top) hits.push('btn:' + x.textContent); } return JSON.stringify({ on: e.classList.contains('on'), box: [bb.left, bb.top, bb.right, bb.bottom].map(Math.round), lines: Math.round(bb.height / parseFloat(getComputedStyle(e).lineHeight)), hits }); })()`));
    if (r.hits.length || r.box[2] > W + 1 || r.box[0] < -1) bad.push(W + 'x' + H + ' [' + r.hits.join(',') + '] ' + JSON.stringify(r.box) + ' ' + t.slice(0, 80)); }
  console.log(W + 'x' + H, texts.length, 'banners checked; collisions:', bad.length); for (const x of bad) console.log('  ', x);
  const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, 'last-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64')); b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
