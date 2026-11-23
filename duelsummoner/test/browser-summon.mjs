import { launch, wait } from './cdp.mjs';
const out = process.argv[2], b = await launch({ out, query: '?debug&seed=4242' }); await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; const g = D.game, p = g.p; p.x = 60; p.z = 110; p.y = 0; D.chase.reset(); await new Promise(r => setTimeout(r, 600)); return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, fx = D.fx, calls = [], orig = fx.ring.bind(fx); fx.ring = (x, y, z, r, c, l) => { calls.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1), r]); return orig(x, y, z, r, c, l); };
  g.field.monsters[1] = { id: 'cinder-hatchling', level: 1, cd: 0.3, ang: 0, x: g.p.x + 2, y: g.p.y, z: g.p.z + 2, px: g.p.x + 2, py: g.p.y, pz: g.p.z + 2, init: true }; await new Promise(r => setTimeout(r, 300)); fx.ring = orig;
  return JSON.stringify({ player: [Math.round(g.p.x), Math.round(g.p.z)], ringCalls: calls.slice(0, 3) }); })()`));
await b.shot('summon_ring_check'); b.close(); setTimeout(() => process.exit(0), 300);
