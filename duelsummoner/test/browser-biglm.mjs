import { launch, wait } from './cdp.mjs';
// The big desert's landmarks and region looks: stand on the ground at spawn looking at the start landmark, then the same from two other regions.
//   node test/browser-biglm.mjs <outdir> <seed> [WxH]
const [out, seedArg, size] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 4711;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }); await wait(2000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
await b.evalIn(`document.body.classList.add('nohud'); for (const id of ['topleft','topright','minimap','hotbar']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }`);
const spots = [['spawn', 0, 0], ['r1', 3000, 1500], ['r2', -6000, 4000], ['r3', 8000, -6000], ['r4', -12000, -9000]];
for (const [name, x, z] of spots) {
  const info = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, m = g.map, W = m.world, { heightAt, streamTo } = await import('/src/sim/terrain.js'); const sx = ${x} || m.spawn.x, sz = ${z} || m.spawn.z; g.p.x = sx; g.p.z = sz; streamTo(sx, sz, 200, 6); g.p.y = heightAt(sx, sz) + 0.3; g.p.vx = g.p.vz = g.p.vy = 0;
    let best = null, bd = 1e9; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const l = W.landmark(Math.floor(sx / 1100) + i, Math.floor(sz / 1100) + j); if (l) { const d = Math.hypot(l.cx - sx, l.cz - sz); if (d > 150 && d < bd) { bd = d; best = l; } } }
    if (best) { D.input.yaw = Math.atan2(-(best.cx - sx), -(best.cz - sz)); D.camHold = { x: sx, y: g.p.y + 3, z: sz, lx: best.cx, ly: best.T * 0.5, lz: best.cz }; } await new Promise(r => setTimeout(r, 1800)); return JSON.stringify({ region: m.regionName(sx, sz), lm: best ? { x: Math.round(best.cx), z: Math.round(best.cz), h: Math.round(best.T), d: Math.round(bd), kind: best.kind } : null }); })()`));
  console.log(name, JSON.stringify(info)); await wait(600); await b.shot('lm-' + name);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
b.close(); setTimeout(() => process.exit(0), 300);
