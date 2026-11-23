import { launch, wait } from './cdp.mjs';
// Damage numbers in a fight: every sampled frame, number sprites visible: count, tallest as a share of screen height, any off-screen or over HUD.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const R = await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); g.god = true; g.opts.offers = false; const { spawnEnemy } = await import('/src/sim/enemies.js');
  g.field.monsters[1] = { id: 'rune-apprentice', level: 6, cd: 0 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 6, cd: 0 };
  setInterval(() => { let n = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) n++; for (let k = n; k < 60; k++) { const a = Math.random() * 6.28; spawnEnemy(g, 'runner', { x: g.p.x + Math.cos(a) * 9, z: g.p.z + Math.sin(a) * 9 }); } for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) g.en.hp[i] = Math.max(g.en.hp[i], 40); }, 120);
  const out = { frames: 0, maxLive: 0, tallestPct: 0, offscreen: 0, overHero: 0 }; const cam = D.camera, V = new cam.position.constructor(); const fxs = D.fx; 
  for (let f = 0; f < 600; f++) { await new Promise(r => requestAnimationFrame(r)); let live = 0; for (let i = 0; i < fxs.M; i++) { const sp = fxs.nsp[i]; if (!sp.visible || fxs.nage[i] < 0) continue; live++; V.copy(sp.position).project(cam); if (Math.abs(V.x) > 1 || Math.abs(V.y) > 1) out.offscreen++; const hpx = sp.scale.y / (2 * cam.position.distanceTo(sp.position) * Math.tan(cam.fov * Math.PI / 360)) * 100; out.tallestPct = Math.max(out.tallestPct, hpx); }
    out.maxLive = Math.max(out.maxLive, live); out.frames++; }
  out.tallestPct = +out.tallestPct.toFixed(2); return JSON.stringify(out); })()`);
console.log(R); await b.shot('numbers_fight'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
