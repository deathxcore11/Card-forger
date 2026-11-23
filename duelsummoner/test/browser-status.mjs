import { launch, wait } from './cdp.mjs';
// Status looks on the swarm: 150 enemies in front of the duelist, then fire (burn) on all of them and lightning chains among them. Reports draws and uploads per frame without and with status, writes pictures.
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3500);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'); g.god = true; g.spawnAcc = -1e9; g.field.monsters.fill(null); const p = g.p; if (D.grass) D.grass.visible = true;
  for (let k = 0; k < 150; k++) { const a = -1.57 + (k % 15 - 7) * 0.09, d = 5 + Math.floor(k / 15) * 1.1; spawnEnemy(g, ['husk','runner','seer'][k % 3], { x: p.x + Math.cos(a) * d * 1.0 + 0.0, z: p.z + Math.sin(a) * d }); g.en.hp[g.lastSlot] = 1e6; g.en.spd[g.lastSlot] = 0; }
  window.__fxlab.worstCase(false); await new Promise(r => setTimeout(r, 1500)); return g.enemyCount(); })()`));
await b.evalIn('window.__fxlab.reset()'); await wait(2500); const a = JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.read())')); console.log('no status ', JSON.stringify(a)); await b.shot('status_none');
await b.evalIn(`(async()=>{ const g = __ds.game, C = await import('/src/sim/combat.js'); for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) C.damageEnemy(g, i, 0.01, { elem: 1 }); return 1; })()`);
await wait(900); await b.shot('status_burn'); await b.evalIn('window.__fxlab.reset()'); await wait(1500); console.log('burning   ', JSON.stringify(JSON.parse(await b.evalIn('JSON.stringify(window.__fxlab.read())'))));
await b.evalIn(`(async()=>{ const g = __ds.game, C = await import('/src/sim/combat.js'); g.p.vx = 0; let n = 0; for (let i = 0; i < g.en.max && n < 12; i++) if (g.en.alive[i] && i % 9 === 0) { C.damageEnemy(g, i, 0.01, { elem: 2 }); n++; } return n; })()`);
await wait(100); await b.shot('status_arc'); console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
