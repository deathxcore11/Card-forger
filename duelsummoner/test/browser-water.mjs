import { launch, wait } from './cdp.mjs';
const out = process.argv[2];
const b = await launch({ out, query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
for (const st of [0, 1, 2]) {
  console.log(st + 1, await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; await new Promise(r => setTimeout(r, 2500)); }
    const { poolSpots } = await import('/src/gen/road.js'); const pl = poolSpots(g.map); if (!pl.length) return 'no pool'; const q = pl[0]; g.p.x = q.x + q.r + 3; g.p.z = q.z; g.p.y = 0; D.camHold = { x: q.x + q.r + 9, y: 5, z: q.z + 3, lx: q.x, ly: 0, lz: q.z }; await new Promise(r => setTimeout(r, 2500));
    const f = n => new Promise(async r => { for (let i = 0; i < n; i++) await new Promise(q => requestAnimationFrame(q)); r(); }); const R = D.renderer; await f(3); const a = { d: R.info.render.calls, t: R.info.render.triangles }; D.water.visible = false; await f(3); const b0 = { d: R.info.render.calls, t: R.info.render.triangles }; D.water.visible = true; await f(3);
    return JSON.stringify({ withWater: a, without: b0 }); })()`));
  await wait(300); await b.shot('game_water_stage' + (st + 1));
}
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
