// Spectacle check 1: walk a full circle round a gate pylon (half its long side plus 2.7 m from its centre), 120 steps. At each step the duelist's own pixels are counted
// alone and in the full frame (off-screen id render at the buffer size); the check passes when 60% or more are visible on every step. Run once with the porthole on and once off.
import { launch, wait } from './cdp.mjs';
const out = process.argv[2], seed = process.argv[3] || '1', b = await launch({ out, query: '?debug&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const runCircle = async on => b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; D.see.on = ${on}; const gt = g.map.gate; const py = g.map.prims.find(q => q.t === 'box' && q.h === 24 && !q.deco && Math.abs((q.x0 + q.x1) / 2 - gt.x) < 20);
  const cx = (py.x0 + py.x1) / 2, cz = (py.z0 + py.z1) / 2, r0 = Math.max(py.x1 - py.x0, py.z1 - py.z0) / 2 + 2.7, rows = [];
  for (let k = 0; k < 120; k++) { const a = k * 3, x = cx + Math.cos(a * Math.PI / 180) * r0, z = cz + Math.sin(a * Math.PI / 180) * r0; p.x = x; p.z = z; p.y = 0; p.vx = p.vz = 0; D.input.yaw = Math.atan2(-(cx - x), -(cz - z)) + Math.PI; D.input.pitch = 0.1;
    for (let f = 0; f < 4; f++) await new Promise(r => requestAnimationFrame(r)); const px = D.duelistPixels(); rows.push([a, px.alone, px.visible]); }
  D.see.on = true; let ok = 0, worst = 101, worstA = 0; for (const [a, al, vi] of rows) { const pct = al ? vi / al * 100 : 100; if (pct >= 60) ok++; if (pct < worst) { worst = pct; worstA = a; } }
  return JSON.stringify({ steps: rows.length, ok, worstPct: +worst.toFixed(1), worstAngle: worstA, aloneMedian: rows.map(r => r[1]).sort((x, y) => x - y)[60] }); })()`);
console.log('porthole OFF', await runCircle(false)); console.log('porthole ON ', await runCircle(true));
console.log(await b.evalIn(`JSON.stringify({ webgl2: __ds.renderer.capabilities.isWebGL2, draws: __ds.renderer.info.render.calls, tris: __ds.renderer.info.render.triangles })`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
