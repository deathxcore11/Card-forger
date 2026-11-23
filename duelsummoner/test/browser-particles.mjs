import { launch, wait } from './cdp.mjs';
// Particle update cost with 1,200 live particles (spec 6.4 pass: under 0.1 ms a frame in effect update) and the draw count of the particle mesh.
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); D.game.god = true; D.game.spawnAcc = -1e9; D.game.cardT = 1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, fx = D.fx, p = D.game.p; for (let k = 0; k < 1200; k++) fx.spark(p.x + (k % 30) * 0.3, 1 + (k % 7) * 0.4, p.z + 2 + Math.floor(k / 30) * 0.3, 0, 0.5, 0, 0xc8d0e0, 0.12, 30);
  fx.update(0.016, D.camera); const live = fx.pm.count; const t0 = performance.now(); for (let i = 0; i < 2000; i++) { fx.update(0.0001, D.camera); } const ms = (performance.now() - t0) / 2000;
  await new Promise(r => setTimeout(r, 500)); const R = D.renderer; return JSON.stringify({ live, updateMsPerFrame: +ms.toFixed(4), particleMeshVisible: fx.pm.visible }); })()`));
await wait(200); await b.shot('particles_1200'); b.close(); setTimeout(() => process.exit(0), 300);
