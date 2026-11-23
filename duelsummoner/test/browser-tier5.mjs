import { launch, wait } from './cdp.mjs';
// Tier 5 (Tablebreak) at the game camera on Stage 1: a 120-creature crowd, warnings on top, the three big own attacks stamped into the ground with hollow giants, the sky tinted. Measures the claimed share (pixels that differ with Tier 5 on and off),
// the four screen edges and the horizon crossings, takes the picture, then the Tablebreak picture (the three pieces shifted 4, 6 and 8 art pixels).   node test/browser-tier5.mjs <outdir>
const EL = process.argv[3] || 'fire', b = await launch({ out: process.argv[2], query: '?seed=1&fxlab&moments=full' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn('new Promise(r => { const t = setInterval(() => { if (window.__fxlab) { clearInterval(t); r(1); } }, 200); setTimeout(() => r(0), 20000); })'); await wait(500);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), C = await import('/src/sim/combat.js'), p = g.p; g.field.monsters.fill(null); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; if (D.grass) D.grass.visible = false;
  for (let k = 0; k < 120; k++) { const a = -1.57 + ((k * 7) % 21 - 10) * 0.075, d = 10 + Math.floor(k / 14) * 1.6; spawnEnemy(g, ['husk','runner','bloat','hunter'][(k * 5) % 4], { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }); g.en.hp[g.lastSlot] = 1e9; g.en.spd[g.lastSlot] = 0; }
  await window.__fxlab.tier5(true, '${EL}'); D.camHold = { x: p.x, y: p.y + 6.5, z: p.z + 15, lx: p.x, ly: p.y + 1.2, lz: p.z - 7 }; await new Promise(r => setTimeout(r, 4500)); D.freeze(true); C.addTele(g.tele, { type: 0, x: p.x - 9, y: p.y, z: p.z - 5, dx: 1, dz: 0, len: 14, w: 1.2, dur: 1e6, t: 0.6e6 }); C.addTele(g.tele, { type: 1, x: p.x + 8, y: p.y, z: p.z - 4, r: 3, dur: 1e6, t: 0.6e6 }); await new Promise(r => setTimeout(r, 800)); return 'ok'; })()`));
await wait(300); await b.shot(EL === 'fire' ? 'tier5' : 'tier5_' + EL);
console.log('claimed', await b.evalIn('(async()=>JSON.stringify(await window.__fxlab.tier5Measure()))()'));
console.log('duelistPixels', JSON.stringify(await b.evalIn('JSON.stringify(__ds.duelistPixels())'))); console.log('own', await b.evalIn('JSON.stringify(window.__fxlab.own())'));
if (EL === 'fire') {
  // the warning check: the same frame drawn twice in ONE task (sim frozen, nothing else moving), once without and once with the break held; the pixels of the warning mask must be identical
  console.log('warning-check', await b.evalIn(`(()=>{ const D = __ds, c = document.getElementById('view'), grab = () => { D.blitNow(); const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const A = grab(); D.tablebreak(true); const B = grab(), m = D.maskRead(), s = +c.dataset.block; let n = 0, ch = 0, all = 0; for (let Y = 0; Y < c.height; Y++) for (let X = 0; X < c.width; X++) { const i = (Y * c.width + X) * 4, d = A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]; if (d) all++; const ix = Math.floor(X / s), iy = m.h - 1 - Math.floor(Y / s); if (ix < m.w && iy >= 0 && m.b[iy * m.w + ix] > 127) { n++; if (d) ch++; } } return JSON.stringify({ warningPixels: n, warningPixelsChanged: ch, allPixelsChanged: all }); })()`));
  await wait(500); await b.shot('tablebreak'); }
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);




