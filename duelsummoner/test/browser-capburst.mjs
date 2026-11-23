import { launch, wait } from './cdp.mjs';
// The Cap Burst (the moment Reach first reaches the +150% cap: a ring of 12 cards bursting out to 6 m, a ring on the ground, a 40 ms stop, a banner) and a near-arc picture (a persistent own ring of 12 m round the duelist, camera pulled back).
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; D.game.opts.offers = false; g.field.monsters.fill(null); return 1; })()`);
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, F = await import('/src/sim/field.js'); g.items = []; for (let i = 0; i < 15; i++) g.items.push('surveyors-lens'); F.recompute(g); await new Promise(r => setTimeout(r, 380)); return g.mods.reach; })()`);
await b.shot('capburst'); console.log('capburst: reach', await b.evalIn('__ds.game.mods.reach'), 'stopLog', JSON.stringify(await b.evalIn('JSON.stringify(__ds.fx.stopLog)')));
await wait(2500);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'), p = g.p; const rec = C.addFx(g, { type: 'ring', owner: 0, el: 'ice', x: p.x, y: p.y, z: p.z, r: 12, dur: 1e6, color: 0 }); rec.t = 0.999e6; D.ownRForce = 12; await new Promise(r => setTimeout(r, 4500)); D.freeze(true); return JSON.stringify({ zoom: D.chaseZoom() }); })()`));
await wait(300); await b.shot('reach_neararc');
console.log(JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
