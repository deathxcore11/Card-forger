import { launch, wait } from './cdp.mjs';
// Shadow mask, cloud shadows and fog at the game camera: the duelist beside a tree on each stage (two frames 0.6 s apart on Stage 1 so the sway shows), and the far fog.
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; return 1; })()`);
for (const st of [0, 1, 2]) {
  console.log(st + 1, await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; await new Promise(r => setTimeout(r, 2200)); }
    const { scatterStage } = await import('/src/gen/scatter.js'); const S = scatterStage(g.map, ${st}, false), p = g.p; let best = null, bd = 1e9; for (const v of S.trees.concat(S.rocks)) for (const t of v) { const d = Math.hypot(t[0] - p.x, t[2] - p.z); if (d > 10 && d < bd) { bd = d; best = t; } }
    if (!best) return JSON.stringify({ none: S.trees.map(v => v.length), p: [p.x, p.z] }); const t = best; p.x = t[0] + 5; p.z = t[2] + 2; p.px = p.x; p.pz = p.z; D.camHold = null; await new Promise(r => setTimeout(r, 1800)); const R = D.renderer; return JSON.stringify({ draws: R.info.render.calls, tris: R.info.render.triangles }); })()`));
  await wait(200); await b.shot('shade_stage' + (st + 1)); if (st === 0) { await wait(700); await b.shot('shade_stage1_b'); }
}
console.log(JSON.stringify((await b.evalIn('window.__errs.slice(0,2)')))); b.close(); setTimeout(() => process.exit(0), 300);
