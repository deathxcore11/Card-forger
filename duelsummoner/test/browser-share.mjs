import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); const g = D.game; g.god = true; const { spawnEnemy } = await import('/src/sim/enemies.js');
  for (let i = 0; i < 14; i++) spawnEnemy(g, 'runner', { x: g.p.x + 6 + (i % 5), z: g.p.z + (i / 5 | 0) }); await new Promise(r => setTimeout(r, 6000)); document.getElementById('endBtn').click(); await new Promise(r => setTimeout(r, 900)); return 1; })()`);
console.log(await b.evalIn(`document.getElementById('dShare').innerText`)); await b.shot('results_share'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
