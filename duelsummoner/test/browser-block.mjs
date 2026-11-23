import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; return 1; })()`);
const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; let n = 0; const fxb = D.fx.burst.bind(D.fx); D.fx.burst = (...a) => { n++; return fxb(...a); };
  g.event('block', { x: g.p.x + 3, y: g.p.y + 1.5, z: g.p.z }); await new Promise(r => setTimeout(r, 200)); return n; })()`);
console.log('burst calls after a block event:', r, JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
