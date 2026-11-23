import { launch, wait } from './cdp.mjs';
// Shrine hold at about 60%: the progress band must be visible on the ring from a game-like camera.
const b = await launch({ out: process.argv[2], query: '?debug&seed=3' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.opts.offers = false; g.spawnAcc = -1e9;
  const S = g.world.shrines, cnt = a => S.filter(s => Math.hypot(s.x - a.x, s.z - a.z) < 26).length, s = S.slice().sort((a, b) => cnt(b) - cnt(a))[0];
  g.p.x = s.x + 3; g.p.z = s.z; g.p.y = s.y; s.charge = 3.2; s.idle = 0; D.camHold = { x: s.x, y: 24, z: s.z - 9, lx: s.x, ly: 0, lz: s.z }; window.__hold = setInterval(() => { s.charge = 3.2; s.idle = 0; }, 50); await new Promise(r => setTimeout(r, 900)); return 1; })()`);
await wait(500); await b.shot('shrine_hold'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);

