// A look-at pass for judging on screen: items 12 (seal fade 30 m to 10 m), 13 (whole-number scaling at dpr 1 and 1.25), 16 (fireball glow), 17 (hit vignette in a fight), 18 (shrine ring mid-hold).
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=3' });
const size = (w, h, dpr) => b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
await size(1280, 720, 1);
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.opts.offers = false; g.spawnAcc = -1e9; return 1; })()`);
// 13: the same view at dpr 1 and 1.25
for (const [n, w, h, d] of [['dpr1', 1280, 720, 1], ['dpr125', 1373, 1045, 1.25]]) { await size(w, h, d); await wait(900); await b.shot('look13_' + n); }
await size(1280, 720, 1); await wait(500);
// 12: the seal from 30 m and 10 m away
for (const d of [30, 10]) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, G = g.map.gate; let ang = 0; for (let k = 0; k < 40; k++) { const a = k * 0.157, x = G.x + Math.cos(a) * 30, z = G.z + Math.sin(a) * 30; if (g.colliders.list.every(c => (c.x - x) ** 2 + (c.z - z) ** 2 > 225)) { ang = a; break; } }
    const ux = -Math.cos(ang), uz = -Math.sin(ang); g.p.x = G.x - ux * ${d}; g.p.z = G.z - uz * ${d}; g.p.vx = g.p.vz = 0; g.p.y = 0; D.camHold = { x: g.p.x - ux * 7, y: 3.4, z: g.p.z - uz * 7, lx: g.p.x + ux * 20, ly: 2, lz: g.p.z + uz * 20 }; await new Promise(r => setTimeout(r, 900)); return 1; })()`);
  await b.shot('look12_seal_' + d + 'm');
}
// 18: a shrine at 50% hold, seen from above
await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const S = g.world.shrines, s = S[0]; g.p.x = s.x + 5; g.p.z = s.z; g.p.y = s.y; s.charge = 2.5; s.idle = 0; clearInterval(window.__hold); window.__hold = setInterval(() => { s.charge = 2.5; s.idle = 0; }, 30); D.camHold = { x: s.x, y: 22, z: s.z - 11, lx: s.x, ly: 0, lz: s.z }; await new Promise(r => setTimeout(r, 900)); return 1; })()`);
await wait(300); await b.shot('look18_shrine_hold'); await b.evalIn(`clearInterval(window.__hold); __ds.camHold = null; 1`);
// 17: a 60-enemy fight with the hit vignette at its peak
await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const { spawnEnemy } = await import('/src/sim/enemies.js'); g.spawnAcc = 0; g.field.monsters[1] = { id: 'rune-apprentice', level: 6, cd: 0 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 6, cd: 0 }; g.p.x = g.map.spawn.x; g.p.z = g.map.spawn.z; g.p.y = 0;
  window.__keep = setInterval(() => { let n = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) n++; for (let k = n; k < 60; k++) { const a = Math.random() * 6.28; spawnEnemy(g, 'runner', { x: g.p.x + Math.cos(a) * 6, z: g.p.z + Math.sin(a) * 6 }); } }, 150); await new Promise(r => setTimeout(r, 3000)); document.getElementById('flash').style.opacity = 0.8; return 1; })()`);
await b.shot('look17_hit_vignette');
// 16: a fireball in flight
const found = await b.evalIn(`(async()=>{ const g = __ds.game; for (let f = 0; f < 600; f++) { await new Promise(r => requestAnimationFrame(r)); for (let i = 0; i < g.shots.max; i++) if (g.shots.alive[i] && g.shots.kind[i] === 2) return 'lob in flight at frame ' + f; } return 'none'; })()`);
await b.shot('look16_fireball'); console.log(found);
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
