import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); const g = D.game; g.god = true; const { spawnEnemy } = await import('/src/sim/enemies.js');
  for (let i = 0; i < 4; i++) spawnEnemy(g, 'scarab', { x: g.p.x + 5 + i * 2.2, z: g.p.z + 3 - i }); for (let i = 0; i < 3; i++) spawnEnemy(g, 'husk', { x: g.p.x + 6 + i * 2, z: g.p.z - 4 }); await new Promise(r => setTimeout(r, 400)); return 1; })()`);
await b.shot('shadows_flyers'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
