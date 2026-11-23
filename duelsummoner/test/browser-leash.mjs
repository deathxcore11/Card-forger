import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, k = D.input.keys; let mx = 0, sum = 0, n = 0, maxM = 0; k.KeyW = true; let tp = 0;
  for (let i = 0; i < 1200; i++) { await new Promise(r => requestAnimationFrame(r)); if (i % 200 === 0) D.input.yaw += 0.8; if (i === 600) { g.p.x += 120; g.p.z += 90; tp = 1; } const m = g.field.monsters[0]; if (!m) continue; const d = Math.hypot(m.x - g.p.x, m.z - g.p.z); mx = Math.max(mx, d); sum += d; n++; }
  k.KeyW = false; const A = D.actors, m = g.field.monsters[0], mesh = A.monsters.get(m); const vd = mesh ? Math.hypot(mesh.position.x - g.p.x, mesh.position.z - g.p.z) : -1; return JSON.stringify({ maxSimDist: +mx.toFixed(1), avg: +(sum / n).toFixed(1), viewDistNow: +vd.toFixed(1), monsters: g.field.monsters.length }); })()`));
await b.shot('leash'); b.close(); setTimeout(() => process.exit(0), 300);

