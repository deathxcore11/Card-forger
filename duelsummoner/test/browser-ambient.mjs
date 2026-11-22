import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const R = {};
R.count = await b.evalIn(`__ds.ambient.list.length`);
R.sample = await b.evalIn(`JSON.stringify(__ds.ambient.list.slice(0, 3).map(x => ({ state: x.state, pos: [x.x, x.y, x.z].map(v => +v.toFixed(1)), vis: x.rig.group.visible })))`);
// put the player next to the first butterfly and look at it
await b.evalIn(`(()=>{ const D = __ds, a = D.ambient.list[0]; if (!a) return 0; const p = D.game.p; p.x = a.x + 4; p.z = a.z + 4; p.y = 0; p.vx = p.vz = 0; D.freeze(true); D.camHold = { x: a.x + 1.6, y: a.y + 0.5, z: a.z + 1.8, lx: a.x, ly: a.y, lz: a.z }; return 1; })()`);
for (let i = 0; i < 3; i++) { await wait(180); await b.shot('butterfly-' + i); }
// the fight comes close: an enemy near the butterfly makes it drift away
const fl = await b.evalIn(`(async()=>{ const D = __ds, a = D.ambient.list[0], E = await import('/src/sim/enemies.js'); D.freeze(false); const before = [a.x, a.z]; E.spawnEnemy(D.game, 'husk', { x: a.x + 5, z: a.z }); await new Promise(r => setTimeout(r, 1500)); return JSON.stringify({ before: before.map(v => +v.toFixed(1)), after: [a.x, a.z].map(v => +v.toFixed(1)), away: +a.away.toFixed(2), state: a.state }); })()`);
R.flee = fl;
// cost of 10 butterflies
R.cost = await b.evalIn(`(()=>{ const D = __ds, t0 = performance.now(); for (let i = 0; i < 1000; i++) D.ambient.update(1 / 60, D.camera, D.game.en); return +((performance.now() - t0) / 1000).toFixed(4) + ' ms per frame for ' + D.ambient.list.length; })()`);
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);
