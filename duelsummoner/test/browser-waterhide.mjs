import { launch, wait } from './cdp.mjs';
// Water never hides things: a pickup, an enemy warning ring and the duelist standing in the pool, photographed.
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { poolSpots } = await import('/src/gen/road.js'), C = await import('/src/sim/combat.js'); const q = poolSpots(g.map)[0];
  g.p.x = q.x; g.p.z = q.z + 1.5; g.p.y = 0; g.p.px = g.p.x; g.p.pz = g.p.z; C.dropPickup(g, 1, q.x - 2.5, 0, q.z - 0.5, 5); C.dropPickup(g, 2, q.x + 2.5, 0, q.z - 1.5, 3); C.addTele(g.tele, { type: 1, x: q.x + 1.0, y: 0.1, z: q.z - 3, r: 2.6, dur: 600, color: 0xff3020 });
  D.camHold = { x: q.x + 1, y: 4.2, z: q.z + 8, lx: q.x, ly: 0.3, lz: q.z }; await new Promise(r => setTimeout(r, 2500)); return 'ok'; })()`));
await wait(300); await b.shot('water_in_pool'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
