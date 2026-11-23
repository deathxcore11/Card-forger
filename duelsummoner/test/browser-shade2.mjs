import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
console.log(await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; const E = await import('/src/view/engine.js'); const { scatterStage } = await import('/src/gen/scatter.js'); const S = scatterStage(g.map, 0, false), p = g.p; let best = null, bd = 1e9; for (const v of S.trees) for (const t of v) { const d = Math.hypot(t[0] - p.x, t[2] - p.z); if (d > 10 && d < bd) { bd = d; best = t; } }
 const t = best; p.x = t[0] - 4.7 + 5; p.z = t[2] - 2.8 + 3; p.px = p.x; p.pz = p.z; await new Promise(r => setTimeout(r, 1800)); return JSON.stringify({ k: E.MASK.k.value, ck: E.MASK.ck.value, tex: !!E.MASK.tex.value.image && E.MASK.tex.value.image.width }); })()`));
await wait(200); await b.shot('shade_debug'); b.close(); setTimeout(() => process.exit(0), 300);
