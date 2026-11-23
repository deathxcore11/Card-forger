import { launch, wait } from './cdp.mjs';
// The rule that must never fail: an enemy warning is never dimmed, thinned or hidden by an own effect. A danger-red telegraph circle and line lie under a 30 m own disc and inside an own dome, at the game camera, with the sim frozen and the grass off.
// The warning pixels are the ones inside the warning mask (a true mask, not a colour guess) that differ between the frame without telegraphs and the frame with them. They must be identical in the frame WITH own effects.
// The duelist is SHOWN: it is the top-priority protected actor and draws over everything, warnings included, so its own silhouette and outline (found by drawing each frame again with the duelist hidden, grown by 2 pixels) are not counted.   node test/browser-warning.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3500); await b.evalIn('window.__maskAlways = true; 1'); await b.evalIn("(async()=>{ const m = await import('/src/view/engine.js'); m.E.hold = true; return 1; })()");
await b.evalIn(`window.__hideDuel = on => { const D = __ds; D.actors.player.visible = !on; for (const k in D.actors.rigs) D.actors.rigs[k].group.visible = !on; D.actors._hideDuel = on; return 1; }; 1`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'); g.god = true; g.mods.reach = ${+(process.env.REACH || 0)}; if (g.mods.reach >= 1.5) D.tier5Force = 'quiet'; g.spawnAcc = -1e9; g.field.monsters.fill(null); if (D.grass) D.grass.visible = false; const p = g.p;
  window.__w = { x: p.x + 1.5, z: p.z - 6 };
  C.addTele(g.tele, { type: 1, x: __w.x, y: p.y, z: __w.z, r: 5, dur: 1e6, t: 0.7e6 }); C.addTele(g.tele, { type: 0, x: p.x - 6, y: p.y, z: p.z - 3, dx: 1, dz: 0, len: 9, w: 2, dur: 1e6, t: 0.7e6 });
  D.camHold = { x: p.x + 0.5, y: p.y + 6, z: p.z + 9, lx: p.x, ly: p.y, lz: p.z - 5 }; D.freeze(true); await new Promise(r => setTimeout(r, 1500)); return 'set'; })()`));
const snap = `(async()=>{ const D = __ds; await new Promise(r => setTimeout(r, 400)); D.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; window.__f = window.__f || []; window.__f.push(d); return d.length / 4; })()`;
await b.evalIn('(()=>{ for (const t of __ds.game.tele) if (t.on) { t.on = false; t._was = true; } return 1; })()'); await b.evalIn(snap);            // 0: Z, no telegraphs
await b.evalIn('(()=>{ for (const t of __ds.game.tele) if (t._was) { t.on = true; } return 1; })()');
await b.evalIn(snap); await b.shot('warning_off'); await b.evalIn(snap);                                                                           // 1: A, 2: A2, telegraphs on, no own effects
await b.evalIn('__hideDuel(true)'); await b.evalIn(snap); await b.evalIn('__hideDuel(false)');                                                     // 3: Ah, the same without the duelist
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'), p = g.p; C.addFx(g, { type: 'fan', owner: 0, el: 'fire', x: p.x, y: p.y, z: p.z, r: 24, arc: 140, dx: 0, dz: -1, dur: 1e6, color: 0 }); C.addFx(g, { type: 'ring', owner: 0, el: 'ice', x: __w.x, y: p.y, z: __w.z, r: 6, dur: 1e6, color: 0 });
  D.actors.ownExtra = own => { own.volume(__w.x, p.y, __w.z, 9, 0xff8a1f, 1); own.area(p.x, p.y + 0.1, p.z, 30, 0x2a5a3a, true, 0, 1, 0, 1); }; return 1; })()`);
await wait(1500); await b.evalIn(snap); await b.shot('warning_on');                                                                              // 4: B, own effects on
await b.evalIn('__hideDuel(true)'); await b.evalIn(snap); await b.evalIn('__hideDuel(false)');                                                     // 5: Bh
console.log(await b.evalIn(`(()=>{ const [Z, A, A2, Ah, B, Bh] = window.__f; const M = __ds.maskRead(), cv_ = document.getElementById('view'), sb = +cv_.dataset.block, cw = cv_.width, ch = cv_.height; const inMask = q => { const X = q % cw, Y = (q / cw) | 0, ix = Math.floor(X / sb), iy = M.h - 1 - Math.floor(Y / sb); return ix < M.w && iy >= 0 && M.b[iy * M.w + ix] > 127; };
  const dm = new Uint8Array(cw * ch); for (let q = 0; q < cw * ch; q++) { const i = q * 4; if (A[i] !== Ah[i] || A[i + 1] !== Ah[i + 1] || A[i + 2] !== Ah[i + 2] || B[i] !== Bh[i] || B[i + 1] !== Bh[i + 1] || B[i + 2] !== Bh[i + 2]) dm[q] = 1; }
  const dg = new Uint8Array(cw * ch); let dn = 0; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { if (!dm[y * cw + x]) continue; for (let yy = Math.max(0, y - 2); yy <= Math.min(ch - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(cw - 1, x + 2); xx++) dg[yy * cw + xx] = 1; }
  for (let q = 0; q < cw * ch; q++) if (dg[q]) dn++;
  let red = 0, diff = 0, maxd = 0, inDuel = 0; for (let i = 0; i < A.length; i += 4) { const q = i / 4; if (inMask(q) && Z[i + 1] - A[i + 1] > 25 && A[i] - Z[i] > -8 && A[i] === A2[i] && A[i + 1] === A2[i + 1] && A[i + 2] === A2[i + 2]) { const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (dg[q]) { if (d > 0) inDuel++; continue; } red++; if (d > 0) { diff++; if (d > maxd) maxd = d; (window.__lst = window.__lst || []).push((q % cw) + ',' + ((q / cw) | 0)); } } }
  return JSON.stringify({ warningPixelsOutsideDuelist: red, changed: diff, maxChannelSum: maxd, changedInsideDuelistMask: inDuel, duelistMaskPixels: dn, list: (window.__lst || []).join(' '), own: __fxlab.own() }); })()`));
b.close(); setTimeout(() => process.exit(0), 300);

