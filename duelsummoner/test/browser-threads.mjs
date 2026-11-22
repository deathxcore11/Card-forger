import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 800)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const R = {};
for (const [name, dist] of [['far', 130], ['mid', 70], ['near', 28]]) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, G = g.map.gate; const ang = Math.atan2(-G.z + 20, -G.x + 20); g.p.x = G.x + Math.cos(ang) * ${dist}; g.p.z = G.z + Math.sin(ang) * ${dist}; g.p.vx = g.p.vz = 0; g.p.y = 0; D.input.yaw = Math.atan2(-(G.x - g.p.x), -(G.z - g.p.z)) + 0.35; D.chase.reset(); await new Promise(r => setTimeout(r, 2600)); return 1; })()`);
  R[name] = await b.evalIn(`JSON.stringify({ live: __ds.threads.list.filter(t => t.alive).length })`); await b.shot('threads-' + name);
}
R.errors = await b.evalIn('window.__errs.slice(0, 2)'); console.log(JSON.stringify(R)); b.close(); setTimeout(() => process.exit(0), 300);



