import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// Pictures of the lying beams (dress.logs) at 412x915: three of them, the longest first, seen from 9 m at a low angle, HUD hidden.
//   node test/browser-open-beam.mjs <outdir> <arch> <seed> [WxH]
const [out, arch, seedArg, size] = process.argv.slice(2), [W, H] = (size || '412x915').split('x').map(Number), seed = +seedArg || 1; mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=' + arch + '&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
const jpg = async name => { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); writeFileSync(join(out, name + '.jpg'), Buffer.from(r.result.data, 'base64')); };
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3000)); const g = D.game; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return 1; })()`);
await b.evalIn(`(()=>{ for (const el of document.querySelectorAll('body *')) { if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue; const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute') el.style.visibility = 'hidden'; } return 1; })()`);
const logs = JSON.parse(await b.evalIn(`JSON.stringify(__ds.game.map.dress.logs.filter(q => Math.hypot(q[0], q[2]) < 150 && Math.hypot(q[3] - q[0], q[5] - q[2]) > 5.9).slice(0, 3).map(q => [q[0], q[2], q[3], q[5], q[6], q[7], Math.hypot(q[3] - q[0], q[5] - q[2])]))`));
console.log(JSON.stringify(logs.map(l => l.map(v => +v.toFixed(1)))));
let n = 0; for (const [x0, z0, x1, z1, rad, kind, len] of logs) { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, ax = -(z1 - z0) / len, az = (x1 - x0) / len, px = mx + ax * 11, pz = mz + az * 11;
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, T = await import('/src/sim/terrain.js'); g.p.x = ${px}; g.p.z = ${pz}; g.p.y = T.heightAt(${px}, ${pz}) + 0.1; g.p.vx = g.p.vz = g.p.vy = 0; await new Promise(r => setTimeout(r, 1800)); D.camHold = { x: ${px}, y: T.heightAt(${px}, ${pz}) + 3.2, z: ${pz}, lx: ${mx}, ly: T.heightAt(${mx}, ${mz}) + 0.5, lz: ${mz} }; await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
  await jpg('beam' + n++); }
b.close(); setTimeout(() => process.exit(0), 300);
