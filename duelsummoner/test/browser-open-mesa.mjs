import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// Pictures of mesas on slopes: the blocks whose footprint spans the biggest drop, seen from the downhill side at a low angle and again from the side, HUD hidden.
//   node test/browser-open-mesa.mjs <outdir> <arch a-f> <seed> [WxH] [count]
const [out, arch, seedArg, size, cnt] = process.argv.slice(2), [W, H] = (size || '412x915').split('x').map(Number), seed = +seedArg || 1; mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=' + arch + '&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
const jpg = async name => { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); writeFileSync(join(out, name + '.jpg'), Buffer.from(r.result.data, 'base64')); };
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3000)); const g = D.game; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); return 1; })()`);
await b.evalIn(`(()=>{ for (const el of document.querySelectorAll('body *')) { if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue; const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute') el.style.visibility = 'hidden'; } return 1; })()`);
const list = JSON.parse(await b.evalIn(`(async()=>{ const m = __ds.game.map, T = await import('/src/gen/open/terrain.js'); const o = m.blocks.map((q, i) => { let lo = 1e9, hi = -1e9, sx = 0, sz = 0; for (let k = 0; k < 24; k++) { const t = k / 24 * 6.283, x = q.cx + Math.cos(t) * q.rx * 0.9, z = q.cz + Math.sin(t) * q.rz * 0.9, h = T.duneH(m.dune, x, z); if (h < lo) { lo = h; sx = x; sz = z; } hi = Math.max(hi, h); } return { i, drop: hi - lo, cx: q.cx, cz: q.cz, lx: sx, lz: sz, T: q.T, rx: q.rx, h: q.h, tone: q.tone, lo }; }).filter(q => Math.hypot(q.cx, q.cz) < 330).sort((a, b) => b.drop - a.drop).slice(0, ${+cnt || 3}); return JSON.stringify(o); })()`));
console.log(JSON.stringify(list.map(q => [q.i, q.drop.toFixed(1), q.cx.toFixed(0), q.cz.toFixed(0)])));
let n = 0; for (const q of list) { const dx = q.lx - q.cx, dz = q.lz - q.cz, dl = Math.hypot(dx, dz) || 1, far = Math.max(q.rx, 8) * 1.6 + 14;
  for (const [tag, ox, oz] of (process.env.SIDES4 ? [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]] : [['low', dx / dl, dz / dl], ['side', -dz / dl, dx / dl]])) { const px = q.cx + ox * ((process.env.SIDES4 ? 0 : dl) + far * (+process.env.NEAR || 0.7) + (process.env.SIDES4 ? q.rx : 0)), pz = q.cz + oz * ((process.env.SIDES4 ? 0 : dl) + far * (+process.env.NEAR || 0.7) + (process.env.SIDES4 ? q.rx : 0));
    await b.evalIn(`(async()=>{ const D = __ds, g = D.game, T = await import('/src/sim/terrain.js'); g.p.x = ${px}; g.p.z = ${pz}; g.p.y = T.heightAt(${px}, ${pz}) + 0.1; g.p.vx = g.p.vz = g.p.vy = 0; await new Promise(r => setTimeout(r, 1800)); const gy = T.heightAt(${px}, ${pz}); D.camHold = { x: ${px}, y: gy + 3.2, z: ${pz}, lx: ${process.env.SIDES4 ? q.cx : q.cx + dx * 0.6}, ly: ${q.lo + (process.env.SIDES4 ? q.h * 0.5 : 3)}, lz: ${process.env.SIDES4 ? q.cz : q.cz + dz * 0.6} }; await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
    await jpg('mesa' + n + '-' + tag); } n++; }
b.close(); setTimeout(() => process.exit(0), 300);
