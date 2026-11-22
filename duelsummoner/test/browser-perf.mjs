import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.input.keys.KeyW = true; return 1; })()`);
await wait(1500);
const R = await b.evalIn(`(async()=>{ const D = __ds, r = D.actors.rig, g = D.game, p = g.p; const t0 = performance.now(); const N = 2000; for (let i = 0; i < N; i++) r.update(p, g, 1 / 60, false); const per = (performance.now() - t0) / N;
  const s = { sim: 0, view: 0, n: 0 }; for (let i = 0; i < 120; i++) { await new Promise(res => requestAnimationFrame(res)); s.sim += D.prof.sim || 0; s.view += D.prof.view || 0; s.n++; }
  const t1 = performance.now(); let frames = 0; await new Promise(res => { const f = () => { frames++; if (performance.now() - t1 > 2000) res(); else requestAnimationFrame(f); }; f(); });
  let tris = 0, draw = 0; D.scene.traverse(o => { if (o.isMesh) draw++; });
  return JSON.stringify({ rigUpdateMsPerCall: +per.toFixed(4), simMsAvg: +(s.sim / s.n).toFixed(3), viewMsAvg: +(s.view / s.n).toFixed(3), fps: Math.round(frames / 2), meshes: draw, actions: r.mixer._nActiveActions, bindings: r.mixer._nActiveBindings }); })()`);
console.log(R); b.close(); setTimeout(() => process.exit(0), 300);
