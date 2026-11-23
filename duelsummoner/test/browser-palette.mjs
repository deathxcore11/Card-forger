import { launch, wait } from './cdp.mjs';
// The palette lookup A/B: strength 0 and 1 on all three stage floors, with Kael and the pool in view.
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
for (const st of [0, 1, 2]) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; await new Promise(r => setTimeout(r, 2200)); }
    const { poolSpots } = await import('/src/gen/road.js'); const q = poolSpots(g.map)[0], p = g.p; p.x = q.x + q.r + 2.5; p.z = q.z + 3; p.y = 0; D.camHold = { x: q.x + q.r + 9, y: 3.6, z: q.z + 9, lx: q.x + 3, ly: 0.8, lz: q.z + 1 }; await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
  for (const s of [0, 1]) { await b.evalIn(`__ds.paletteStrength(${s}); new Promise(r => setTimeout(r, 500))`); await wait(300); await b.shot('palette_stage' + (st + 1) + '_s' + s); }
  await b.evalIn(`__ds.paletteStrength(0); 1`);
}
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
