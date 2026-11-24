import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// One close-up of a single husk (walking toward Kael), from the front-left at 3 m. node test/browser-husk-look.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.p.hp = g.p.maxHp = 1e9; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; const { spawnEnemy } = await import('/src/sim/enemies.js'); for (const [dx, dz] of [[9, 3], [11, -2], [13, 4]]) { spawnEnemy(g, 'husk', { x: g.p.x + dx, z: g.p.z + dz }); g.en.hp[g.lastSlot] = 1e12; } setInterval(() => { for (let i = 0; i < g.en.max; i++) g.en.burn[i] = 0; const e = g.en; let k = -1, bd = 1e9; for (let i = 0; i < e.max; i++) if (e.alive[i]) { const d = Math.hypot(e.x[i] - g.p.x, e.z[i] - g.p.z); if (d < bd) { bd = d; k = i; } } if (k < 0) return; const x = e.x[k], z = e.y ? e.z[k] : 0, y = e.y[k], dx = g.p.x - x, dz = g.p.z - e.z[k], l = Math.hypot(dx, dz) || 1, sx = -dz / l, sz = dx / l; D.camHold = { x: x + dx / l * 3.4 + sx * 1.4, y: y + 1.4, z: e.z[k] + dz / l * 3.4 + sz * 1.4, lx: x, ly: y + 1.0, lz: e.z[k] }; }, 16); return 1; })()`);
for (const [n, wt] of [['a', 1500], ['b', 700]]) { await wait(wt); await wait(100);
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 }); writeFileSync(join(out, 'husk-close-' + n + '.jpg'), Buffer.from(r.result.data, 'base64')); }
b.close(); setTimeout(() => process.exit(0), 300);
