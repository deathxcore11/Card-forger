// Part 5 NOW 11: an opened Card Chest stays on the map with its lid thrown back, and the minimap shows it as a grey square. Pictures of one chest closed and open.
import { launch, wait } from './cdp.mjs';
const out = process.argv[2], b = await launch({ out, query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, c = g.world.cchests[0]; if (!c) return 'no chest'; g.p.x = c.x - 4; g.p.z = c.z; g.p.y = c.y; const f = n => new Promise(async r => { for (let i = 0; i < n; i++) await new Promise(q => requestAnimationFrame(q)); r(); });
  D.camHold = { x: c.x - 3, y: c.y + 2.2, z: c.z + 3, lx: c.x, ly: c.y + 0.5, lz: c.z }; await f(20); return JSON.stringify({ x: c.x, y: c.y, z: c.z, open: !!c.open }); })()`));
await wait(200); await b.shot('chest_closed');
await b.evalIn(`(async()=>{ const g = __ds.game; g.world.cchests[0].open = true; await new Promise(r => setTimeout(r, 400)); return 1; })()`);
await wait(300); await b.shot('chest_open');
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
