import { launch, wait } from './cdp.mjs';
// Enemy warnings at the game camera: one lane, one blast circle and one fan at half their timer, sim frozen, then the same with 12 overlapping lanes (a seer crowd).   node test/browser-tells.mjs <outdir> <label>
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; g.field.monsters.fill(null); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; if (D.grass) D.grass.visible = true; D.freeze(true); return 1; })()`);
const label = process.argv[3] || 'tells';
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'), p = g.p; for (const t of g.tele) t.on = false;
  C.addTele(g.tele, { type: 0, x: p.x - 7, y: p.y, z: p.z - 7, dx: 0.8, dz: 0.6, len: 12, w: 1.4, dur: 1e6, t: 0.5e6 }); C.addTele(g.tele, { type: 1, x: p.x + 5, y: p.y, z: p.z - 6, r: 4, dur: 1e6, t: 0.5e6 }); C.addTele(g.tele, { type: 2, x: p.x - 2, y: p.y, z: p.z - 12, dx: 0, dz: 1, r: 9, arc: 70, dur: 1e6, t: 0.5e6 });
  await new Promise(r => setTimeout(r, 1500)); return 'ok'; })()`));
await wait(200); await b.shot(label + '_single');
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'), p = g.p; for (let k = 0; k < 12; k++) { const a = -2.4 + k * 0.18; C.addTele(g.tele, { type: 0, x: p.x + Math.cos(a) * 9, y: p.y, z: p.z + Math.sin(a) * 9, dx: -Math.cos(a), dz: -Math.sin(a), len: 14, w: 0.9, dur: 1e6, t: (0.2 + 0.05 * k) * 1e6 }); }
  await new Promise(r => setTimeout(r, 1200)); return 'ok'; })()`));
await wait(200); await b.shot(label + '_crowd');
console.log(JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
