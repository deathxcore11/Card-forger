import { launch, wait } from './cdp.mjs';
// Death looks: a fire kill leaves a body that burns away bottom-up in 6 steps; a lightning kill leaves a 2 frame ink silhouette. Kills a few enemies with each element in front of the camera and shoots the steps.   node test/browser-death.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await wait(3000);
console.log(await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), C = await import('/src/sim/combat.js'), p = g.p; g.god = true; g.field.monsters.fill(null); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; if (D.grass) D.grass.visible = false;
  window.__slots = []; for (let k = 0; k < 6; k++) { spawnEnemy(g, ['husk','runner','bloat','hunter'][k % 4], { x: p.x + (k - 2.5) * 2.2, z: p.z - 7 }); g.en.spd[g.lastSlot] = 0; __slots.push(g.lastSlot); }
  D.camHold = { x: p.x, y: p.y + 4, z: p.z + 4, lx: p.x, ly: p.y + 1, lz: p.z - 7 }; await new Promise(r => setTimeout(r, 1200)); return __slots.length; })()`));
const kill = (el) => b.evalIn(`(async()=>{ const D = __ds, g = D.game, C = await import('/src/sim/combat.js'), E = await import('/src/data/elements.js'); for (const i of __slots.slice(${el === 'fire' ? 0 : 3}, ${el === 'fire' ? 3 : 6})) { g.curSrc = 0; C.damageEnemy(g, i, 1e9, { elem: E.ELEMENTS.${el}.bit }); } await new Promise(r => setTimeout(r, 60)); return D.actors.corpses ? D.actors.corpses.length : -1; })()`);
console.log('fire corpses', await kill('fire')); for (let i = 0; i < 4; i++) { await wait(120); await b.shot('death_fire_' + i); }
await b.evalIn('window.__hold = setInterval(() => { for (const c of (__ds.actors.corpses || [])) c.t = 0; }, 5); 1');
console.log('lightning corpses', await kill('lightning')); await wait(250); await b.shot('death_lightning_0');       // the lab holds the first of the 2 steps still so a screenshot can catch it
await b.evalIn('(()=>{ for (const c of __ds.actors.corpses) c.t = 0.04; clearInterval(window.__hold); return 1; })()'); await wait(10); await b.shot('death_lightning_1');
console.log('pool after', await b.evalIn('__ds.actors.corpses.length'), 'errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);



