// The FX lab (?fxlab): a panel over the live game for building and judging effects (spectacle build order, step 5). It starts a run with Kael, and shows
//   - the effect ramp (a row per element, five tones) and the one noise texture,
//   - the ES 3.00 probe (does this browser compile a texelFetch shader on the ramp),
//   - live numbers: draws, triangles, frame time, enemies, effect pool use, and the buffer and texture uploads per frame,
//   - a Worst case button: god mode, 300 enemies of six kinds on screen, and every element burst, ring and spark fired every 100 ms at the pool caps, until Reset.
// Later steps add their strips to this page (tiers, hits, status, ground marks); this step ships the frame work they use. View only: it never touches sim rules, only spawns enemies as the budget script does.
import { RAMP, ELEMENTS } from '../data/fxramp.js';
import { fxProbe, FX } from './fxkit.js';
import { E } from './engine.js';
import { ownColour } from './fxcolour.js';
import { makeElementShape } from './elshapes.js';

export function startLab(D) {
  const g = D.game, R = D.renderer, gl = R.getContext(), fx = D.fx, $ = (t, css, txt) => { const e = document.createElement(t); if (css) e.style.cssText = css; if (txt !== undefined) e.textContent = txt; return e; };
  D.pickDuelist('kael'); D.start(); g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; g.pendingLevels = 0;       // no level-up panel over the lab
  // upload counters: wrap the buffer and texture upload calls on this context instance
  const U = { bufferData: 0, bufferSubData: 0, texImage: 0, texSubImage: 0 }, wrap = (name, key) => { const o = gl[name]; if (!o) return; gl[name] = function () { U[key]++; return o.apply(this, arguments); }; };
  wrap('bufferData', 'bufferData'); wrap('bufferSubData', 'bufferSubData'); wrap('texImage2D', 'texImage'); wrap('texSubImage2D', 'texSubImage');
  let frames = 0, upBase = { ...U }, upFrames = 0; const tick = () => { frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);

  const panel = $('div', 'position:fixed;left:8px;bottom:8px;z-index:9999;background:rgba(14,12,20,0.88);border:1px solid #6b5a8c;color:#e8e0d0;font:11px/1.35 monospace;padding:8px;width:292px;pointer-events:auto;'); panel.id = 'fxlab';
  panel.append($('div', 'font-weight:bold;color:#e0b765;margin-bottom:4px', 'FX LAB'));
  const cv = $('canvas'); cv.width = 5 * 30; cv.height = 8 * 12; cv.style.cssText = 'display:block;image-rendering:pixelated;border:1px solid #333'; const cx = cv.getContext('2d');
  ELEMENTS.forEach((el, row) => RAMP[el].forEach((c, t) => { cx.fillStyle = '#' + c.toString(16).padStart(6, '0'); cx.fillRect(t * 30, row * 12, 30, 12); }));
  panel.append(cv, $('div', 'color:#9a917c;margin:2px 0 6px', 'rows: ' + ELEMENTS.join(' ') + '  columns: core bright body shade ink'));
  const nz = $('canvas'); nz.width = nz.height = 64; nz.style.cssText = 'display:inline-block;width:64px;height:64px;image-rendering:pixelated;border:1px solid #333;margin-right:6px;vertical-align:top'; { const tx = nz.getContext('2d'), im = tx.createImageData(64, 64), d = E.noise.value.image.data; for (let i = 0; i < 64 * 64; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = d[i * 4]; im.data[i * 4 + 3] = 255; } tx.putImageData(im, 0, 0); }
  const probe = fxProbe(R), probeTxt = probe === RAMP.fire[0] ? 'ES 3.00 texelFetch on the ramp: OK (fire core read back)' : 'ES 3.00 probe FAILED: ' + (probe === null ? 'did not compile' : probe.toString(16));
  const info = $('div', 'display:inline-block;width:210px;vertical-align:top;color:#9a917c', 'the one noise texture (64 x 64, shared with sky, water, wind and grass). ' + probeTxt);
  panel.append(nz, info);
  const out = $('pre', 'margin:6px 0 4px;white-space:pre-wrap;color:#cfe8d8'); panel.append(out);
  const row = $('div', 'display:flex;gap:6px'); const btn = (t, f) => { const b = $('button', 'font:11px monospace;padding:3px 6px;background:#2a2638;color:#e8e0d0;border:1px solid #6b5a8c;cursor:pointer', t); b.onclick = f; return b; };
  let worst = false, timer = 0, kinds = ['husk', 'runner', 'seer', 'bloat', 'golem', 'scarab'];
  const burstAll = () => { const p = g.p; ELEMENTS.forEach((el, i) => { const c = RAMP[el][2]; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, d = 2 + Math.random() * 14, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; fx.burstEl(x, 0.3, z, 18, i, 6, 4, 0.18, 0.7, 12); fx.ring(x, 0.1, z, 1.5 + Math.random() * 3, RAMP[el][1], 0.5); fx.sparkEl(x, 0.5, z, (Math.random() - 0.5) * 6, 5 + Math.random() * 5, (Math.random() - 0.5) * 6, i, 0.2, 0.6); } }); };
  const bolts = () => { const p = g.p, rb = D.actors.ribbon; for (let k = 0; k < 4; k++) { const a = Math.random() * 6.283, d = 3 + Math.random() * 12, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, wide = k === 0; rb.see({ x, y: 7 + Math.random() * 3, z, x2: x + (Math.random() - 0.5) * 5, y2: 0.3, z2: z + (Math.random() - 0.5) * 5, t: 0, dur: 0.3 + Math.random() * 0.3, seed: (Math.random() * 1e6) | 0, w: wide ? 0.4 : 0.14 }); } };
  // own-effect stress (spec 2.5): a 24 m fan, three player rings, a 30 m disc area and two 16 m domes, so the ink rule, the keyhole, the governor and the camera-side cap all have something to do
  const ownStress = on => { const p = g.p; if (!on) { D.actors.ownExtra = null; for (const o of g.fx) if (o.owner === 0 && o.dur >= 100) o.on = false; return; } import('/src/sim/combat.js').then(C => { C.addFx(g, { type: 'fan', owner: 0, el: 'fire', x: p.x, y: p.y, z: p.z, r: 24, arc: 140, dx: 0, dz: -1, dur: 1000, color: RAMP.fire[1] }); C.addFx(g, { type: 'fan', owner: 0, el: 'poison', x: p.x + 8, y: p.y, z: p.z - 6, r: 14, arc: 90, dx: -1, dz: 0, dur: 1000, color: RAMP.poison[1] }); for (let k = 0; k < 3; k++) C.addFx(g, { type: 'ring', owner: 0, el: 'ice', x: p.x, y: p.y, z: p.z, r: 6 + k * 7, dur: 1000, color: RAMP.ice[1] }); });
    D.actors.ownExtra = own => { own.volume(p.x, p.y, p.z - 22, 16, RAMP.fire[2], 1); own.volume(p.x - 16, p.y, p.z + 6, 12, RAMP.lightning[2], 1); own.area(p.x, p.y + 0.1, p.z, 30, RAMP.poison[3], true, 0, 1, 0, 1); }; };
  // the six unwired elements (step 13): ice, poison, wind, earth, light, dark. One strip each: 60 enemies carrying the element's body status, a row of hit flashes in its colour, and its five tier looks side by side
  // (a particle burst, a small area, a ring area, a dome, a hollow giant). The sim wires only fire and lightning today, so these are lab looks; the shapes are still squares, discs and domes (shape before colour is open).
  const ELS = ['ice', 'poison', 'wind', 'earth', 'light', 'dark'], CODE = { ice: 1, poison: 2, wind: 3, earth: 4, light: 5, dark: 6 }, ROWS = { ice: 1, poison: 3, wind: 4, earth: 5, light: 6, dark: 7 };
  let elTimer = 0;
  const elementStrip = async name => {
    clearInterval(elTimer); const p = g.p, E = await import('/src/sim/enemies.js'); for (let i = 0; i < g.en.max; i++) { g.en.alive[i] = 0; D.actors.labStatus[i] = 0; }
    const kinds = ['husk', 'runner', 'seer', 'golem', 'bloat', 'hunter', 'scarab']; for (let k = 0; k < 60; k++) { const a = -1.57 + ((k * 7) % 15 - 7) * 0.08, d = 5 + Math.floor(k / 10) * 1.6; E.spawnEnemy(g, kinds[(k * 5) % 7], { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }); g.en.hp[g.lastSlot] = 1e9; g.en.spd[g.lastSlot] = 0; D.actors.labStatus[g.lastSlot] = CODE[name]; }
    const row = ROWS[name], c1 = ownColour(name), c2 = RAMP[name][2] === c1 ? RAMP[name][3] : RAMP[name][2], c3 = RAMP[name][3], bx = p.x, bz = p.z - 18;
    D.actors.ownExtra = own => { own.area(bx - 16, p.y + 0.1, bz, 2, c1, true, 0, 1, 0, 1); own.area(bx - 8, p.y + 0.1, bz, 4, c2, true, 0, 1, 0, 1); own.volume(bx, p.y, bz, 6, c2, 1); own.volume(bx + 10, p.y, bz, 9, c1, 1); own.area(bx + 22, p.y + 0.1, bz, 14, c3, true, 0, 1, 0, 1); };
    elTimer = setInterval(() => { fx.burstEl(bx - 22, 0.4, bz, 6, row, 1.5, 2, 0.14, 0.9, 0); let n = 0; for (let i = 0; i < g.en.max && n < 10; i++) if (g.en.alive[i] && i % 6 === 0) { g.en.flash[i] = 0.07; D.actors.hitRow[i] = row; n++; } }, 90);
  };  // Tier 5 (step 14): the screen-breaking state in one scene. The big own attacks are stamped into the ground (stain map), each gets a hollow giant at its TRUE rule radius, the sky tints and runs a flame band. window.__fxlab.tier5Measure() reports the claimed share
  // (pixels that differ with Tier 5 on and off, same frame, sim frozen) and whether the effect touches all four screen edges and crosses the horizon in at least 3 places.
  const tier5 = async on => {
    const C = await import('/src/sim/combat.js'), p = g.p; D.tier5Force = !!on; for (const o of g.fx) if (o.owner === 0 && o.dur >= 100) o.on = false;
    if (!on) return; const mk = (r, el, arc) => { const rec = C.addFx(g, arc ? { type: 'fan', owner: 0, el, x: p.x, y: p.y, z: p.z, r, arc, dx: 0, dz: -1, dur: 1e6, color: 0 } : { type: 'ring', owner: 0, el, x: p.x, y: p.y, z: p.z, r, dur: 1e6, color: 0 }); if (rec) rec.t = 0.9999e6; };
    mk(32, 'fire', 150); mk(24, 'fire', 0); mk(16, 'fire', 0); D.ownRForce = 32 * 1.58 / 2;
  };
  const measure = async () => {
    const snap = () => { D.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
    await new Promise(r => setTimeout(r, 400)); const A = snap(); D.tier5Force = false; const saved = g.fx.filter(o => o.on && o.owner === 0 && o.dur >= 100); saved.forEach(o => { o.on = false; }); await new Promise(r => setTimeout(r, 400)); const B = snap(); D.tier5Force = true; saved.forEach(o => { o.on = true; });
    const diff = (i) => Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]) > 30; let n = 0; const w = A.w, h = A.h, edge = { top: 0, bottom: 0, left: 0, right: 0 };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (diff((y * w + x) * 4)) { n++; if (y < 3) edge.top++; if (y >= h - 3) edge.bottom++; if (x < 3) edge.left++; if (x >= w - 3) edge.right++; } }
    let cross = 0, inRun = false; const hy = Math.floor(h * 0.47); for (let x = 0; x < w; x += 2) { let hit = false; for (let y = hy - 4; y <= hy + 4; y++) if (diff((y * w + x) * 4)) { hit = true; break; } if (hit && !inRun) cross++; inRun = hit; }
    return { claimedPct: +(n / (w * h) * 100).toFixed(1), edge, horizonCrossings: cross };
  };  // the six elements side by side by SHAPE and MOTION (view/elshapes.js), then the same frame in greyscale (the canvas filter): the lab check that each is recognisable without colour
  let shapes = [], shapeTimer = 0;
  const showShapes = async grey => {
    clearInterval(shapeTimer); for (const s of shapes) D.scene.remove(s.group); shapes = []; const p = g.p;
    if (grey === undefined) return; ELS.forEach((n, i) => { const s = makeElementShape(n); s.group.position.set(p.x + (i - 2.5) * 6.8, p.y, p.z - 14); D.scene.add(s.group); shapes.push(s); });
    D.camHold = { x: p.x, y: p.y + 8, z: p.z + 15, lx: p.x, ly: p.y + 2.5, lz: p.z - 14 }; const t0 = performance.now(); shapeTimer = setInterval(() => { const t = (performance.now() - t0) / 1000; for (const s of shapes) s.update(t); }, 16);
    document.getElementById('view').style.filter = grey ? 'grayscale(1)' : '';
  };  const worstCase = on => { worst = on === undefined ? !worst : on; if (worst) { g.god = true; g.spawnAcc = -1e9; D.fillSwarm(300 - g.enemyCount(), 'husk'); for (let i = 0; i < 300 && g.enemyCount() < 300; i++) D.fillSwarm(1, kinds[i % 6]); timer = setInterval(() => { burstAll(); bolts(); }, 100); wb.textContent = 'Worst case: ON (click to stop)'; } else { clearInterval(timer); wb.textContent = 'Worst case'; } };
  const wb = btn('Worst case', () => worstCase()); const row2 = $('div', 'display:flex;gap:4px;flex-wrap:wrap;margin-top:4px'); for (const n of ELS) row2.append(btn(n, () => elementStrip(n))); row2.append(btn('Shapes', () => showShapes(false)), btn('Grey', () => showShapes(true)), btn('Tier 5', () => tier5(true)), btn('Break', () => D.tablebreak()));
  row.append(wb, btn('Own stress', () => ownStress(true)), btn('Reset', () => { worstCase(false); ownStress(false); clearInterval(elTimer); D.actors.ownExtra = null; D.actors.labStatus.fill(0); for (let k = 0; k < g.en.max; k++) if (g.en.alive[k]) g.en.alive[k] = 0; })); panel.append(row, row2);
  document.body.append(panel);

  const read = () => { const r = R.info.render, pf = D.perfRead(), up = { bufferData: U.bufferData - upBase.bufferData, bufferSubData: U.bufferSubData - upBase.bufferSubData, texImage: U.texImage - upBase.texImage, texSubImage: U.texSubImage - upBase.texSubImage }, n = Math.max(1, frames - upFrames);
    return { draws: r.calls, tris: r.triangles, enemies: g.enemyCount(), frameMsAvg: +(pf.ms / Math.max(1, pf.frames)).toFixed(2), frameMsWorst: +pf.worstFrameMs.toFixed(1), framesSeen: frames, uploadsPerFrame: { bufferData: +(up.bufferData / n).toFixed(2), bufferSubData: +(up.bufferSubData / n).toFixed(2), texImage: +(up.texImage / n).toFixed(2), texSubImage: +(up.texSubImage / n).toFixed(2) } }; };
  const reset = () => { upBase = { ...U }; upFrames = frames; D.perfReset(); };
  setInterval(() => { const s = read(), ow = D.actors.own.readout; out.textContent = 'own fx: areas ' + ow.areas + ' vols ' + ow.volumes + ' raster ' + ow.rasterSum + ' kept ' + ow.keptSum + ' gov ' + ow.governor + '\ndraws ' + s.draws + '  tris ' + s.tris + '  enemies ' + s.enemies + '\nframe ' + s.frameMsAvg + ' ms avg, ' + s.frameMsWorst + ' worst\nuploads/frame buf ' + s.uploadsPerFrame.bufferData + '+' + s.uploadsPerFrame.bufferSubData + ' tex ' + s.uploadsPerFrame.texImage + '+' + s.uploadsPerFrame.texSubImage; }, 500);
  reset();
  window.__fxlab = { showShapes, tier5, tier5Measure: measure, elementStrip, worstCase, ownStress, own: () => D.actors.own.readout, read, reset, probe: probeTxt, probeOk: probe === RAMP.fire[0], ramp: FX.ramp, panel };
}
