import { launch, wait } from './cdp.mjs';
// The big streamed desert: drive to far spots (10 km and more from the start), measure frame times while moving at 9 m/s (the chunks load behind the eyes), take a picture at each place.
//   node test/browser-big.mjs <outdir> <seed> [WxH] [secsPerLeg]
const [out, seedArg, size, secsArg] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 4711, secs = +secsArg || 6;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await wait(2000);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const spots = [[0, 0, 9, 3], [3000, 1500, 9, 0], [-6000, 4000, 0, -9], [8000, -6000, -9, 0], [-12000, -9000, 9, 5], [11000, 11000, -5, -9], [14000, 0, -9, 0], [-14000, 6000, 9, 0]];
const res = [];
for (let k = 0; k < spots.length; k++) {
  const [x0, z0, dx, dz] = spots[k]; const start = k === 0 ? 'spawn' : 'tp';
  const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { heightAt } = await import('/src/sim/terrain.js'); const sx = ${x0} || g.map.spawn.x, sz = ${z0} || g.map.spawn.z; g.p.x = sx; g.p.z = sz; g.p.y = heightAt(sx, sz) + 0.3; g.p.vx = g.p.vz = g.p.vy = 0; D.input.yaw = Math.atan2(-(${dx}), -(${dz}));
    return await new Promise(res => { const ts = [], t0 = performance.now(); let last = t0, skip = 40; const f = () => { const n = performance.now(), dt = n - last; last = n; if (skip-- > 0) { requestAnimationFrame(f); return; } ts.push(dt); g.p.x += ${dx} * dt / 1000; g.p.z += ${dz} * dt / 1000; g.p.y = heightAt(g.p.x, g.p.z) + 0.05; g.p.vy = 0; g.p.vx = g.p.vz = 0; if (n - t0 < (${secs} + 1) * 1000) requestAnimationFrame(f); else { const s = ts.slice().sort((a, b) => a - b); res(JSON.stringify({ n: ts.length, avg: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1), over33: ts.filter(v => v > 33.4).length, at: [Math.round(g.p.x), Math.round(g.p.z)], region: g.map.regionName(g.p.x, g.p.z), h: +g.p.y.toFixed(1), chunks: __ds.scene.children.length })); } }; requestAnimationFrame(f); }); })()`));
  console.log(k, JSON.stringify(r)); res.push(r); await wait(400); await b.shot('big-' + k);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
b.close(); setTimeout(() => process.exit(0), 300);
