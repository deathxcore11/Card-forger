import { launch, wait } from './cdp.mjs';
// The rule that must never fail: an enemy warning is never dimmed, thinned or hidden by an own effect. A danger-red telegraph circle and line lie under a 30 m own disc and inside an own dome, at the game camera, with the sim frozen and the grass off;
// the warning's pixels (found in the frame WITHOUT own effects) must be identical in the frame WITH them.   node test/browser-warning.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3500);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'); g.god = true; g.spawnAcc = -1e9; g.field.monsters.fill(null); if (D.grass) D.grass.visible = false; const p = g.p;
  window.__w = { x: p.x + 1.5, z: p.z - 6 };
  C.addTele(g.tele, { type: 1, x: __w.x, y: p.y, z: __w.z, r: 5, dur: 1e6, t: 0.7e6 }); C.addTele(g.tele, { type: 0, x: p.x - 6, y: p.y, z: p.z - 3, dx: 1, dz: 0, len: 9, w: 2, dur: 1e6, t: 0.7e6 });
  D.camHold = { x: p.x + 0.5, y: p.y + 6, z: p.z + 9, lx: p.x, ly: p.y, lz: p.z - 5 }; D.freeze(true); await new Promise(r => setTimeout(r, 1500)); return 'set'; })()`));
const snap = `(async()=>{ const D = __ds; await new Promise(r => setTimeout(r, 400)); D.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; window.__f = window.__f || []; window.__f.push(d); return d.length / 4; })()`;
await b.evalIn('(()=>{ for (const t of __ds.game.tele) if (t.on) { t.on = false; t._was = true; } return 1; })()'); await b.evalIn(snap);
await b.evalIn('(()=>{ for (const t of __ds.game.tele) if (t._was) { t.on = true; } return 1; })()');
await b.evalIn(snap); await b.shot('warning_off'); await b.evalIn(snap);
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'), p = g.p; C.addFx(g, { type: 'fan', owner: 0, el: 'fire', x: p.x, y: p.y, z: p.z, r: 24, arc: 140, dx: 0, dz: -1, dur: 1e6, color: 0 }); C.addFx(g, { type: 'ring', owner: 0, el: 'ice', x: __w.x, y: p.y, z: __w.z, r: 6, dur: 1e6, color: 0 });
  D.actors.ownExtra = own => { own.volume(__w.x, p.y, __w.z, 9, 0xff8a1f, 1); own.area(p.x, p.y + 0.1, p.z, 30, 0x2a5a3a, true, 0, 1, 0, 1); }; return 1; })()`);
await wait(1500); await b.evalIn(snap); await b.shot('warning_on');
console.log(await b.evalIn(`(()=>{ const [Z, A, A2, B] = window.__f; let red = 0, diff = 0, maxd = 0; for (let i = 0; i < A.length; i += 4) { if (Z[i + 1] - A[i + 1] > 25 && A[i] - Z[i] > -8 && A[i] === A2[i] && A[i + 1] === A2[i + 1] && A[i + 1] === A2[i + 1] && A[i + 2] === A2[i + 2]) { red++; const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (d > 0) { diff++; if (d > maxd) maxd = d; const q = i / 4, W_ = document.getElementById('view').width, px = q % W_, py = (q / W_) | 0, key = (px >> 5) + ',' + (py >> 5); (window.__h = window.__h || {})[key] = (window.__h[key] || 0) + 1; } } } return JSON.stringify({ warningPixels: red, changed: diff, maxChannelSum: maxd, where: Object.entries(window.__h || {}).sort((a, b) => b[1] - a[1]).slice(0, 5), own: __fxlab.own() }); })()`));
b.close(); setTimeout(() => process.exit(0), 300);


