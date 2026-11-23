import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const R = {};
for (const mode of ['before_no_colliders', 'after_colliders']) {
  R[mode] = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (!window.__saved) window.__saved = g.colliders; g.colliders = ${mode === 'after_colliders' ? 'window.__saved' : 'null'};
    const c = window.__saved.list.find(k => k.r < 0.7 && k.top - k.y > 2 && Math.abs(k.x) < 140 && Math.abs(k.z) < 140); const p = g.p; p.x = c.x - 4; p.z = c.z; p.y = c.y; p.vx = p.vz = 0; p.grounded = true; D.input.yaw = -Math.PI / 2; D.chase.reset(); D.input.keys.KeyW = true;
    let minD = 1e9; for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 60)); minD = Math.min(minD, Math.hypot(p.x - c.x, p.z - c.z)); } const d = Math.hypot(p.x - c.x, p.z - c.z); D.input.keys.KeyW = false; return JSON.stringify({ treeRadius: +c.r.toFixed(2), closest: +minD.toFixed(2), now: +d.toFixed(2) }); })()`);
  await b.shot(mode);
}
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R)); b.close(); setTimeout(() => process.exit(0), 300);
