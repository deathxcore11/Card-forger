import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
console.log(await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; const { scatterStage } = await import('/src/gen/scatter.js'); const S = scatterStage(g.map, 0, false);
  const p = g.p; p.x = -42.6; p.z = -111.5; p.px = p.x; p.pz = p.z; await new Promise(r => setTimeout(r, 2000)); const c = D.camera.position, out = [];
  const add = (k, l) => { for (const it of l) { const d = Math.hypot(it[0] - c.x, it[2] - c.z); if (d < 14) out.push([k, +d.toFixed(1), +it[0].toFixed(1), +it[2].toFixed(1), +(it[3] || 0).toFixed(2)]); } };
  S.trees.forEach((l, i) => add('tree' + i, l)); S.rocks.forEach((l, i) => add('rock' + i, l)); add('bush', S.bushes); add('grass', S.grass); add('flower', S.flowers);
  return JSON.stringify({ cam: [c.x, c.y, c.z].map(v => +v.toFixed(1)), near: out.sort((a, b) => a[1] - b[1]).slice(0, 8), props: g.map.prims.filter(q => Math.hypot(((q.x0 + q.x1) / 2 || q.x) - c.x, ((q.z0 + q.z1) / 2 || q.z) - c.z) < 14).map(q => [q.t, q.landmark ? 'lm' : '', q.c && q.c.toString(16)]) }); })()`));
b.close(); setTimeout(() => process.exit(0), 300);
