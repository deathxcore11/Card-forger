import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// The FOV setting at 80, 100 and 115 from one spot on three screen shapes: camera.fov and a picture each. Every step must change the view.
//   node test/browser-fov.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true }); const res = {};
for (const [W, H] of [[1840, 1000], [915, 412], [412, 915]]) {
  const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.p.hp = g.p.maxHp = 1e9; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return 1; })()`);
  for (const f of [80, 100, 115]) {
    const v = await b.evalIn(`(async()=>{ __ds.setFov(${f}); await new Promise(r => setTimeout(r, 900)); return __ds.camera.fov + ' ' + __ds.camera.position.distanceTo(__ds.game.p ? new __ds.camera.position.constructor(__ds.game.p.x, __ds.game.p.y, __ds.game.p.z) : __ds.camera.position); })()`);
    const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); writeFileSync(join(out, 'fov' + f + '-' + W + 'x' + H + '.jpg'), Buffer.from(r.result.data, 'base64')); (res[W + 'x' + H] = res[W + 'x' + H] || {})[f] = v; }
  b.close(); await wait(300); }
console.log(JSON.stringify(res, null, 1)); setTimeout(() => process.exit(0), 300);
