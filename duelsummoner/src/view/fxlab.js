// The FX lab (?fxlab): a panel over the live game for building and judging effects (spectacle build order, step 5). It starts a run with Kael, and shows
//   - the effect ramp (a row per element, five tones) and the one noise texture,
//   - the ES 3.00 probe (does this browser compile a texelFetch shader on the ramp),
//   - live numbers: draws, triangles, frame time, enemies, effect pool use, and the buffer and texture uploads per frame,
//   - a Worst case button: god mode, 300 enemies of six kinds on screen, and every element burst, ring and spark fired every 100 ms at the pool caps, until Reset.
// Later steps add their strips to this page (tiers, hits, status, ground marks); this step ships the frame work they use. View only: it never touches sim rules, only spawns enemies as the budget script does.
import { RAMP, ELEMENTS } from '../data/fxramp.js';
import { fxProbe, FX } from './fxkit.js';
import { E } from './engine.js';

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
  const burstAll = () => { const p = g.p; ELEMENTS.forEach((el, i) => { const c = RAMP[el][2]; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, d = 2 + Math.random() * 14, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; fx.burst(x, 0.3, z, 18, c, 6, 4, 0.18, 0.7, 12); fx.ring(x, 0.1, z, 1.5 + Math.random() * 3, RAMP[el][1], 0.5); fx.spark(x, 0.5, z, (Math.random() - 0.5) * 6, 5 + Math.random() * 5, (Math.random() - 0.5) * 6, RAMP[el][0], 0.2, 0.6); } }); };
  const worstCase = on => { worst = on === undefined ? !worst : on; if (worst) { g.god = true; g.spawnAcc = -1e9; D.fillSwarm(300 - g.enemyCount(), 'husk'); for (let i = 0; i < 300 && g.enemyCount() < 300; i++) D.fillSwarm(1, kinds[i % 6]); timer = setInterval(burstAll, 100); wb.textContent = 'Worst case: ON (click to stop)'; } else { clearInterval(timer); wb.textContent = 'Worst case'; } };
  const wb = btn('Worst case', () => worstCase()); row.append(wb, btn('Reset', () => { worstCase(false); for (let k = 0; k < g.en.max; k++) if (g.en.alive[k]) g.en.alive[k] = 0; })); panel.append(row);
  document.body.append(panel);

  const read = () => { const r = R.info.render, pf = D.perfRead(), up = { bufferData: U.bufferData - upBase.bufferData, bufferSubData: U.bufferSubData - upBase.bufferSubData, texImage: U.texImage - upBase.texImage, texSubImage: U.texSubImage - upBase.texSubImage }, n = Math.max(1, frames - upFrames);
    return { draws: r.calls, tris: r.triangles, enemies: g.enemyCount(), frameMsAvg: +(pf.ms / Math.max(1, pf.frames)).toFixed(2), frameMsWorst: +pf.worstFrameMs.toFixed(1), framesSeen: frames, uploadsPerFrame: { bufferData: +(up.bufferData / n).toFixed(2), bufferSubData: +(up.bufferSubData / n).toFixed(2), texImage: +(up.texImage / n).toFixed(2), texSubImage: +(up.texSubImage / n).toFixed(2) } }; };
  const reset = () => { upBase = { ...U }; upFrames = frames; D.perfReset(); };
  setInterval(() => { const s = read(); out.textContent = 'draws ' + s.draws + '  tris ' + s.tris + '  enemies ' + s.enemies + '\nframe ' + s.frameMsAvg + ' ms avg, ' + s.frameMsWorst + ' worst\nuploads/frame buf ' + s.uploadsPerFrame.bufferData + '+' + s.uploadsPerFrame.bufferSubData + ' tex ' + s.uploadsPerFrame.texImage + '+' + s.uploadsPerFrame.texSubImage; }, 500);
  reset();
  window.__fxlab = { worstCase, read, reset, probe: probeTxt, probeOk: probe === RAMP.fire[0], ramp: FX.ramp, panel };
}
