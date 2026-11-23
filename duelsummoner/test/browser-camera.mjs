import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; return 1; })()`);
const R = {};
R.trees = await b.evalIn(`(()=>{ const c = __ds.game.colliders.list.filter(k => k.r < 3 && k.top - k.y > 8); return c.length; })()`);
for (const mode of ['under_canopy', 'behind_trunk']) {
  R[mode] = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const c = g.colliders.list.filter(k => k.top - k.y > 8 && Math.abs(k.x) < 150 && Math.abs(k.z) < 150)[3]; const p = g.p;
    ${mode === 'under_canopy' ? 'p.x = c.x + 5; p.z = c.z + 2;' : 'p.x = c.x; p.z = c.z + 3.2; '}
    p.y = c.y; p.vx = p.vz = 0; D.input.yaw = ${mode === 'under_canopy' ? 0 : 0}; D.chase.reset(); D.input.keys.KeyW = ${mode === 'under_canopy' ? 'false' : 'false'};
    await new Promise(r => setTimeout(r, 900)); const cp = D.chase.pos; return JSON.stringify({ treeH: +(c.top - c.y).toFixed(1), trunkR: +c.r.toFixed(2), cam: [cp.x, cp.y, cp.z].map(v => +v.toFixed(1)), p: [p.x, p.y, p.z].map(v => +v.toFixed(1)) }); })()`);
  await b.shot(mode);
}
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R)); b.close(); setTimeout(() => process.exit(0), 300);
