import { launch, wait } from './cdp.mjs';
// The sky on each stage at 1920x1080, camera pitched up so the dome, clouds and sun show.
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
for (const st of [0, 1, 2]) {
  console.log(st + 1, await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; await new Promise(r => setTimeout(r, 2200)); } const p = g.p; D.camHold = { x: p.x, y: p.y + 2.2, z: p.z, lx: p.x - 60, ly: p.y + 34, lz: p.z - 20 }; await new Promise(r => setTimeout(r, 1500)); const R = D.renderer; return JSON.stringify({ draws: R.info.render.calls, tris: R.info.render.triangles }); })()`));
  await wait(300); await b.shot('game_sky_stage' + (st + 1));
}
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
