import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, p = D.game.p, fx = D.fx; 
  for (let k = 0; k < 14; k++) { fx.number(p.x + 6, p.y + 1.7, p.z - 4, 10 + k, 0); await new Promise(r => setTimeout(r, 40)); }
  fx.number(p.x + 80, p.y + 1.7, p.z - 3, 999, 1); fx.number(p.x + 3, p.y - 4, p.z + 3, 777, 1);
  await new Promise(r => setTimeout(r, 150)); const T = window.THREE, cam = D.camera, out = []; for (let i = 0; i < fx.M; i++) if (fx.nage[i] >= 0) { const sp = fx.nsp[i], v = sp.position.clone().project(cam); out.push([+v.x.toFixed(2), +v.y.toFixed(2)]); }
  return JSON.stringify({ live: out.length, offscreen: out.filter(q => Math.abs(q[0]) > 0.91 || q[1] < -0.51 || q[1] > 0.87).length, ndc: out.slice(0, 8) }); })()`));
await b.shot('numbers'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
