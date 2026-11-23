import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
console.log(await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); const g = D.game; g.god = true; const { spawnEnemy } = await import('/src/sim/enemies.js'); spawnEnemy(g, 'husk', { x: g.p.x + 4, z: g.p.z }); g.en.hp[g.lastSlot] = 1e6; g.en.spd[g.lastSlot] = 0; D.camHold = { x: g.p.x + 6.6, y: 2.4, z: g.p.z + 3.4, lx: g.p.x + 4, ly: 1, lz: g.p.z }; await new Promise(r => setTimeout(r, 1500));
  const k = D.actors.kinds[0], geo = k.body.geometry, pa = geo.attributes.position.array; let nan = 0; for (const v of pa) if (!isFinite(v)) nan++;
  const m = new (window.THREE.Matrix4)(); k.body.getMatrixAt(0, m); return JSON.stringify({ count: k.body.count, nan, n: pa.length / 3, bb: geo.boundingBox, mat: Array.from(m.elements).map(v => +v.toFixed(2)), vis: k.body.visible, mat0: k.body.material.type, enemies: g.enemyCount() }); })()`));
await b.shot('scratch_cr'); console.log(JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
