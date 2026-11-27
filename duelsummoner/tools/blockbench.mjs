// Block look speed check: 300 husks near the camera at 1920 x 1080, the current look and the block look (?blocks=1), fps over 4 s and draw calls and triangles per frame.
// Also pictures of the block look from the real play camera. Pictures go to <outdir>, never into the repo.   node tools/blockbench.mjs <outdir>
import { launch, wait } from '../test/cdp.mjs';
const [out] = process.argv.slice(2);
const b = await launch({ out, query: '?debug&play=1&seed=21', uncapped: true });
const res = {};
for (const [name, q] of [['current', ''], ['blocks', '&blocks=1']]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=21' + q }); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  res[name] = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false;
    const { spawnEnemy } = await import('/src/sim/enemies.js'); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0;
    const cy = g.camYaw || 0, fx = -Math.sin(cy), fz = -Math.cos(cy); let n = 0; for (let k = 0; k < 600 && n < 300; k++) { const d = 6 + (k % 20) * 1.3, s = ((k * 7) % 31 - 15) * 0.9; if (spawnEnemy(g, 'husk', { x: g.p.x + fx * d + fz * s, z: g.p.z + fz * d - fx * s })) n++; }
    await new Promise(r => setTimeout(r, 1500)); D.perfReset(); await new Promise(r => setTimeout(r, 4000)); const P = D.perfRead(), R = D.renderRead(); let alive = 0; for (let i = 0; i < g.en.max; i++) alive += g.en.alive[i];
    return JSON.stringify({ husks: alive, fps: +(P.frames / P.ms * 1000).toFixed(1), worstMs: +P.worstFrameMs.toFixed(1), calls: R.calls, tris: R.tris }); })()`));
  await b.shot('crowd-' + name);
}
console.log(JSON.stringify(res, null, 1));
setTimeout(() => process.exit(0), 300);
