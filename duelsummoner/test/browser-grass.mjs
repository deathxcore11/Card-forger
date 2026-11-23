import { launch, wait } from './cdp.mjs';
// Grass: the duelist stands in the densest meadow near the start; two frames 0.4 s apart at the game camera, the changed-pixel count in the grass band every 0.3 s (a gust front shows as bursts), and the draw and triangle counts.
//   node test/browser-grass.mjs <outdir> [extra query, e.g. &detail=medium]
const b = await launch({ out: process.argv[2], query: '?seed=1' + (process.argv[3] || '') });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
console.log(await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; const G = await import('/src/view/grass.js'); const { scatterStage } = await import('/src/gen/scatter.js');
  const tex = G.bakeDensity(g.map, scatterStage(g.map, 0, false)), d = tex.image.data, sz = 464 / 256; let best = null, bs = -1, cnt = 0, tot = 0; for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const v = d[(j * 256 + i) * 4]; if (v > 0) { tot++; if (v > 150) cnt++; } const x = -232 + (i + 0.5) * sz, z = -232 + (j + 0.5) * sz; if (Math.hypot(x - g.p.x, z - g.p.z) > 90) continue; let s = 0; for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < 256 && jj < 256) s += d[(jj * 256 + ii) * 4]; } if (s > bs) { bs = s; best = [x, z]; } }
  const p = g.p; p.x = best[0]; p.z = best[1]; p.px = p.x; p.pz = p.z; await new Promise(r => setTimeout(r, 2000)); return JSON.stringify({ spot: best.map(v => +v.toFixed(1)), walkableCells: tot, denseCells: cnt }); })()`));
await wait(300); await b.shot('grass_a'); await wait(400); await b.shot('grass_b');
const diffs = [];
for (let i = 0; i < 12; i++) {
  await wait(300);
  diffs.push(await b.evalIn(`(()=>{ __ds.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); const y0 = Math.floor(c.height * 0.55), y1 = Math.floor(c.height * 0.78), d = x.getImageData(0, y0, c.width, y1 - y0).data, out = new Uint8Array(d.length / 4 | 0); for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 1]; const prev = window.__gf; window.__gf = out; if (!prev) return 0; let n = 0; for (let i = 0; i < out.length; i++) if (Math.abs(out[i] - prev[i]) > 10) n++; return n; })()`));
}
console.log('changed pixels per 0.3 s in the grass band', diffs.join(' '));
console.log(JSON.stringify(await b.evalIn('(()=>{ const R = __ds.renderer.info.render; return { draws: R.calls, tris: R.triangles, errs: window.__errs.slice(0,2) }; })()')));
b.close(); setTimeout(() => process.exit(0), 300);
