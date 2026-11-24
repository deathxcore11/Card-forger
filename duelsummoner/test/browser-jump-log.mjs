import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// A standing jump and a running jump at 915x412: every frame logs the sim state (height, vy, grounded), the clip the rig chose, the run-blend weights and each live action's weight; 10 pictures per jump.
//   node test/browser-jump-log.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; const { spawnEnemy } = await import('/src/sim/enemies.js'); return 1; })()`);
await b.evalIn(`(()=>{ const D = __ds, R = D.actors.rig, g = D.game; window.__log = []; const o = R.update.bind(R); R.update = function (p, gg, dt, th) { const r = o(p, gg, dt, th); window.__log.push([+(performance.now() / 1000).toFixed(2), +p.y.toFixed(2), +p.vy.toFixed(1), p.grounded ? 1 : 0, this.cur, this.lw ? ['idle', 'walk', 'run'].map(k => +this.lw[k].toFixed(2)).join('/') : '', this.mixer._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0.01).map(a => a.getClip().name.slice(0, 12) + ':' + a.getEffectiveWeight().toFixed(2)).join(' ')]); return r; }; return 1; })()`);
if (process.env.CLOSE) await b.evalIn(`(()=>{ const D = __ds, g = D.game; setInterval(() => { const p = g.p; D.camHold = { x: p.x + 4.2, y: p.y + 1.6, z: p.z + 1.5, lx: p.x, ly: p.y + 0.8, lz: p.z }; }, 8); return 1; })()`);

for (const mode of ['stand', 'run']) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; window.__log.length = 0; ${mode === 'run' ? "window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); await new Promise(r => setTimeout(r, 1500));" : "await new Promise(r => setTimeout(r, 800));"} window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })), 120); return 1; })()`);
  for (let k = 0; k < 10; k++) { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(join(out, mode + '-' + String(k).padStart(2, '0') + '.jpg'), Buffer.from(r.result.data, 'base64')); await wait(60); }
  await wait(900); await b.evalIn(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); 1`);
  const log = JSON.parse(await b.evalIn('JSON.stringify(window.__log)')); writeFileSync(join(out, mode + '-log.json'), JSON.stringify(log));
  const air = log.filter(l => l[3] === 0); console.log(mode, 'frames', log.length, 'air frames', air.length); for (let i = 0; i < air.length; i += Math.max(1, Math.floor(air.length / 14))) console.log(air[i].join(' '));
}
b.close(); setTimeout(() => process.exit(0), 300);
