import { launch, wait } from './cdp.mjs';
// The big desert's pickups and chest: the nine new pickups in a row in front of the duelist, then a free chest opened (its reveal and the single item).
//   node test/browser-pickups.mjs <outdir> <seed> [WxH]
const [out, seedArg, size] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 4711;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }); await wait(2000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { dropPickup } = await import('/src/sim/combat.js'); const p = g.p, yaw = D.input.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx; D.freeze && D.freeze(true);
  for (let k = 0; k < 9; k++) { const o = (k - 4) * 1.6; dropPickup(g, k + 3, p.x + fx * 8 + rx * o, p.y, p.z + fz * 8 + rz * o, 1); } for (const m of [g.pick]) for (let i = 0; i < m.max; i++) if (m.alive[i]) m.age[i] = -1e6; return 1; })()`);
await wait(500); await b.shot('pk-row');
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { openCardChest } = await import('/src/sim/world.js'); const c = g.world.cchests.find(q => q.free); g.forceChest = 'rare'; g.p.x = c.x; g.p.z = c.z; openCardChest(g, c); return 1; })()`);
await wait(2500); await b.shot('pk-chest');
await wait(2500); await b.shot('pk-chest2');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
b.close(); setTimeout(() => process.exit(0), 300);
