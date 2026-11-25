import { launch, wait } from './cdp.mjs';
// The big desert's minimap and map screen: walk a long loop so the fog opens, then take the HUD picture and the map screen picture.
//   node test/browser-bigmap.mjs <outdir> <seed> [WxH]
const [out, seedArg, size] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 4711;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }); await wait(2000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { heightAt } = await import('/src/sim/terrain.js'); const pts = [[0, 0], [600, 0], [600, 500], [-200, 700], [-500, 100], [0, 0]]; let x = g.map.spawn.x, z = g.map.spawn.z;
  for (const [tx, tz] of pts) { const n = Math.ceil(Math.hypot(tx + g.map.spawn.x - x, tz + g.map.spawn.z - z) / 12); const sx = x, sz = z, ex = tx + g.map.spawn.x, ez = tz + g.map.spawn.z; for (let k = 1; k <= n; k++) { g.p.x = sx + (ex - sx) * k / n; g.p.z = sz + (ez - sz) * k / n; g.p.y = heightAt(g.p.x, g.p.z) + 0.1; await new Promise(r => requestAnimationFrame(r)); } x = ex; z = ez; }
  return JSON.stringify({ cells: g.fog.count, tiles: g.fog.tiles.size, bb: g.fog.bb.map(Math.round), p: [Math.round(g.p.x), Math.round(g.p.z)] }); })()`));
await wait(500); await b.shot('bigmap-hud');
await b.evalIn(`__ds.toggleMap(true)`); await wait(800); await b.shot('bigmap-full');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
b.close(); setTimeout(() => process.exit(0), 300);
