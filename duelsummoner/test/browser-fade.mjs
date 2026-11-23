import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; return 1; })()`);
const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const c = g.colliders.list.filter(k => k.top - k.y > 8 && Math.abs(k.x) < 150 && Math.abs(k.z) < 150)[3]; const p = g.p;
  p.x = c.x + 1; p.z = c.z + 1; p.y = c.y; p.vx = p.vz = 0; D.input.yaw = 0; D.input.pitch = 0.75; D.chase.reset(); await new Promise(r => setTimeout(r, 1200));
  const cp = D.chase.pos; return JSON.stringify({ cam: [cp.x, cp.y, cp.z].map(v => +v.toFixed(1)), p: [p.x, p.y, p.z].map(v => +v.toFixed(1)), treeTop: c.top }); })()`);
console.log(r); console.log(await b.evalIn('(()=>{ const o=[]; __ds.scene.traverse(m=>{ if(m.isInstancedMesh&&m.geometry.attributes.aFade){ const a=m.geometry.attributes.aFade.array; let mx=0; for(const v of a) mx=Math.max(mx,v); o.push([a.length,+mx.toFixed(2)]); } }); return JSON.stringify(o); })()')); await b.shot('high_pitch_canopy'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);


