import { launch, wait } from './cdp.mjs';
// Close-up of the duelist against a boulder while throwing: frames across several throws.
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('${process.argv[3] || 'kael'}'); D.start(); await new Promise(r => setTimeout(r, 1500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false;
  const { spawnEnemy } = await import('/src/sim/enemies.js'); setInterval(() => { let n = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) n++; for (let k = n; k < 10; k++) spawnEnemy(g, 'runner', { x: g.p.x + 9 + k, z: g.p.z + 3 }); }, 300);
  g.p.vx = g.p.vz = 0; D.camHold = { x: g.p.x + 2.4, y: g.p.y + 1.7, z: g.p.z - 1.6, lx: g.p.x, ly: g.p.y + 1.3, lz: g.p.z }; return 1; })()`);
for (let i = 0; i < 6; i++) { await wait(330); await b.shot('closeup_' + (process.argv[3] || 'kael') + '_' + i); }
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
