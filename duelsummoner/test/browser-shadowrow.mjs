import { launch, wait } from './cdp.mjs'; import { readPng } from './png.mjs'; import { join } from 'node:path';
// Shadow check from the game camera: a ground enemy, a flyer at 1.2 m and a flyer at 3 m side by side. Shadow centre darkness against the sand 2.5 m beside it.
const out = process.argv[2]; const b = await launch({ out, query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const info = await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.p.hp = 1e9;
  const { spawnEnemy } = await import('/src/sim/enemies.js'); const { heightAt } = await import('/src/sim/terrain.js');
  const px = g.p.x, pz = g.p.z; let fx = px + 6, fz = pz + 8; for (let k = 0; k < 60 && heightAt(fx, fz) > 0.05; k++) { fx += 2; }
  const base = [[fx - 4, fz, 'runner', 0], [fx, fz, 'scarab', 1.2], [fx + 4, fz, 'scarab', 3]];
  for (const [x, z, k] of base) spawnEnemy(g, k, { x, z });
  const live = []; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) live.push(i); live.sort((a, b) => g.en.x[a] - g.en.x[b]);
  const pin = () => live.forEach((i, k) => { const [x, z, , h] = base[k]; const gy = heightAt(x, z); g.en.x[i] = g.en.px[i] = x; g.en.z[i] = g.en.pz[i] = z; g.en.y[i] = g.en.py[i] = gy + h; g.en.hp[i] = 1e9; }); setInterval(pin, 4); pin();
  const gy = heightAt(fx, fz); D.camHold = { x: fx, y: gy + 4.2, z: fz - 9, lx: fx, ly: gy + 0.5, lz: fz };
  await new Promise(r => setTimeout(r, 700));
  const cam = D.camera, W = innerWidth, H = innerHeight, proj = (x, y, z) => { const v = cam.position.clone(); v.set(x, y, z).project(cam); return [Math.round((v.x + 1) / 2 * W), Math.round((1 - v.y) / 2 * H)]; };
  return base.map(([x, z, , h]) => ({ h, centre: proj(x, heightAt(x, z) + 0.07, z), side: proj(x + 3, heightAt(x + 3, z) + 0.07, z) })); })()`);
await b.shot('shadow_row'); const png = readPng(join(out, 'shadow_row.png')); const lum = p => (p[0] + p[1] + p[2]) / 3;
const avg = (c) => { let s = 0, n = 0; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { s += lum(png.px(c[0] + dx, c[1] + dy)); n++; } return s / n; };
for (const r of info) { const c = avg(r.centre), s = avg(r.side); console.log('flyer height ' + r.h + ' m: shadow centre ' + c.toFixed(0) + ', sand beside ' + s.toFixed(0) + ' -> ' + Math.round((1 - c / s) * 100) + '% darker, at ' + r.centre.join(',')); }
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);

