import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=3' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.opts.offers = false; const R = g.world.relic;
  g.p.x = R.x - 12; g.p.z = R.z; g.p.y = R.y; await new Promise(r => setTimeout(r, 900)); D.toggleMap(true); await new Promise(r => setTimeout(r, 600)); return 1; })()`);
await wait(500); await b.shot('relic_map');
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, R = g.world.relic; D.toggleMap(false); g.p.x = R.x; g.p.z = R.z; await new Promise(r => setTimeout(r, 1200)); return 1; })()`); await wait(300); await b.shot('relic_coins');
console.log(await b.evalIn(`JSON.stringify({ frenzy: __ds.game.frenzyT.toFixed(1), orbit: __ds.actors.orbit.count })`)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
