// Group D: view cost at 300 enemies. Wraps minimap.draw, fx.update and props.update with timers and reports per-frame averages.
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&dev=1&seed=3', uncapped: true });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.input.keys.KeyW = true; return 1; })()`);
const R = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const { spawnEnemy } = await import('/src/sim/enemies.js');
  const T = { mini: 0, fx: 0, props: 0, n: 0 }; const wrap = (o, k, key) => { const f = o[k].bind(o); o[k] = (...a) => { const t = performance.now(); const r = f(...a); T[key] += performance.now() - t; return r; }; };
  wrap(D.minimap, 'draw', 'mini'); wrap(D.fx, 'update', 'fx'); wrap(D.props, 'update', 'props');
  for (let i = 0; i < 300; i++) spawnEnemy(g, 0, g.p.x + 12 + (i % 20), g.p.z + (i / 20 | 0) - 8);
  for (let i = 0; i < 120; i++) await new Promise(r => requestAnimationFrame(r));
  T.mini = T.fx = T.props = 0; let view = 0, sim = 0, n = 0, tris = 0, calls = 0; const t0 = performance.now();
  for (let i = 0; i < 300; i++) { await new Promise(r => requestAnimationFrame(r)); view += D.prof.view; sim += D.prof.sim; n++; T.n++; }
  const secs = (performance.now() - t0) / 1000, info = D.renderer.info.render; 
  return JSON.stringify({ enemies: g.enemyCount(), frames: n, fps: +(n / secs).toFixed(0), viewMs: +(view / n).toFixed(3), simMs: +(sim / n).toFixed(3), miniMs: +(T.mini / n).toFixed(4), fxMs: +(T.fx / n).toFixed(4), propsMs: +(T.props / n).toFixed(4), draws: info.calls, tris: info.triangles }); })()`);
console.log(R); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
