import { launch, wait } from './cdp.mjs';
// The big desert's door: bring the clock to just before it rises, let it rise, then take pictures of it coming out of the sand and the banner, and one from the player's own place.
//   node test/browser-door.mjs <outdir> <seed> [WxH]
const [out, seedArg, size] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 4711;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }); await wait(2000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const info = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game; g.sc = g.door.at - 1; await new Promise(r => setTimeout(r, 2200)); return JSON.stringify({ state: g.door.state, x: g.door.x, z: g.door.z, dist: g.door.dist, hidden: g.door.hidden, banner: (g.events || []).length }); })()`));
console.log('door', JSON.stringify(info)); await wait(300); await b.shot('door-banner');
for (const [name, secs] of [['rise1', 0.4], ['rise2', 1.6], ['rise3', 3.5]]) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, d = g.door, dx = g.p.x - d.x, dz = g.p.z - d.z, L = Math.hypot(dx, dz), cx = d.x + dx / L * 38, cz = d.z + dz / L * 38; D.camHold = { x: cx, y: (await import('/src/sim/terrain.js')).heightAt(cx, cz) + 5, z: cz, lx: d.x, ly: (await import('/src/sim/terrain.js')).heightAt(d.x, d.z) + 4, lz: d.z }; g.door.t = ${secs}; return 1; })()`);
  await wait(500); await b.shot('door-' + name);
}
await b.evalIn(`(async()=>{ const D = __ds, g = D.game; g.door.t = 9; D.camHold = null; return 1; })()`); await wait(600); await b.shot('door-player');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
b.close(); setTimeout(() => process.exit(0), 300);
