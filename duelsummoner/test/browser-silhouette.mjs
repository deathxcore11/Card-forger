// Spectacle check (2.8): the duelist behind a pylon with the porthole switched off. Silhouette pixels (the 50% checker) must be 45% to 55% of the duelist's unoccluded pixels,
// and in the open the body must still be fully drawn. Also reports the rig mesh count and the draw/triangle cost of the extras.
import { launch, wait } from './cdp.mjs';
const out = process.argv[2], seed = process.argv[3] || '1', b = await launch({ out, query: '?debug&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, gt = g.map.gate; const py = g.map.prims.find(q => q.t === 'box' && q.h === 24 && !q.deco && Math.abs((q.x0 + q.x1) / 2 - gt.x) < 20);
  const cz = (py.z0 + py.z1) / 2, x = py.x0 - 3.5; p.x = x; p.z = cz; p.y = 0; p.vx = p.vz = 0; D.see.on = false;
  const frames = n => new Promise(async r => { for (let i = 0; i < n; i++) await new Promise(q => requestAnimationFrame(q)); r(); });
  const res = {}; await frames(20);
  D.camHold = { x: py.x1 + 3.5, y: 20, z: cz, lx: x, ly: 1.2, lz: cz }; await frames(10);
  const a = D.duelistPixels(); res.behind = { alone: a.alone, visible: a.visible, silhouette: a.silhouette, silhouetteShare: +(a.silhouette / a.alone * 100).toFixed(1) };
  D.camHold = { x: x + 8, y: 20, z: cz, lx: x, ly: 1.2, lz: cz }; await frames(10); const o = D.duelistPixels(); res.open = { alone: o.alone, visible: o.visible, silhouette: o.silhouette, visiblePct: +(o.visible / o.alone * 100).toFixed(1) };
  D.camHold = { x: py.x1 + 3.5, y: 20, z: cz, lx: x, ly: 1.2, lz: cz }; await frames(10);
  res.rigMeshes = D.rigMeshCount(); res.stats = { draws: D.renderer.info.render.calls, tris: D.renderer.info.render.triangles }; return JSON.stringify(res); })()`));
await wait(200); await b.shot('sil_behind');
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);

