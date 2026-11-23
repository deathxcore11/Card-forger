import { launch, wait } from './cdp.mjs';
// Proof pictures of the designed maps on foot: for each seed and stage, the spawn view (the game's own start heading), a view from the middle of the route, a view of the gate from the approach, and the big map with the fog cleared.   node test/browser-proof.mjs <outdir> [seed:stage ...]
const sets = process.argv.length > 3 ? process.argv.slice(3).map(s => s.split(':').map(Number)) : [[1, 1], [2, 1], [3, 1], [777, 1], [4242, 1], [1, 2], [1, 3]];
const b = await launch({ out: process.argv[2], query: '?debug&play=1&seed=' + sets[0][0] });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
let cur = -1;
for (const [seed, stage] of sets) {
  if (seed !== cur) { await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=' + seed }); await wait(2500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
    await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); window.__S = await import('/src/sim/stages.js'); window.__T = await import('/src/sim/terrain.js'); D.game.god = true; D.game.opts.offers = false; return 1; })()`); cur = seed; }
  const tag = 's' + seed + '_st' + stage;
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; D.camHold = null; D.freeze(false); g.stage = ${stage - 1}; __S.loadStageMap(g, ${stage - 1}); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); g.spawnAcc = -1e9; await new Promise(r => setTimeout(r, 2200)); return 1; })()`);
  await b.shot('proof_' + tag + '_spawn');
  const view = async (name, expr) => { await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, M = g.map; ${expr}; D.freeze(true); await new Promise(r => setTimeout(r, 1200)); return 1; })()`); await b.shot('proof_' + tag + '_' + name); };
  await view('mid', `const r = M._road.main, k = r.length >> 1, a = r[k], c = r[Math.min(r.length - 1, k + 4)], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l; p.x = a[0]; p.z = a[1]; p.y = __T.heightAt(a[0], a[1]); D.camHold = { x: a[0] - fx * 9, y: p.y + 5.5, z: a[1] - fz * 9, lx: a[0] + fx * 12, ly: p.y + 1.5, lz: a[1] + fz * 12 }`);
  await view('gate', `const r = M._road.main, e = r[r.length - 1], q = r[Math.max(0, r.length - 6)], dx = e[0] - q[0], dz = e[1] - q[1], l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l, px = e[0] - fx * 14, pz = e[1] - fz * 14; p.x = px; p.z = pz; p.y = __T.heightAt(px, pz); D.camHold = { x: px - fx * 8, y: p.y + 6.5, z: pz - fz * 8, lx: M.gate.x, ly: p.y + 4, lz: M.gate.z }`);
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; D.camHold = null; D.freeze(false); if (g.fog) { g.fog.cells.fill(1); g.fog.version = (g.fog.version || 0) + 1; } window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm' })); await new Promise(r => setTimeout(r, 900)); return 1; })()`);
  await b.shot('proof_' + tag + '_bigmap');
  await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm' })); return 1; })()`);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
