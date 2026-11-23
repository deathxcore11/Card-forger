import { launch, wait } from './cdp.mjs';
// The area attacks that grow with Reach, seen at the game camera: the Ember Wake strip and end burst (Wyvern level 10), the Hatchling splash, the Familiar's Seal Ring. Reach 0 then +150%.   node test/browser-areas.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await wait(3000);
const setup = reach => b.evalIn(`(async()=>{ const D = __ds; if (!D.game.p.hp || !window.__started) { D.pickDuelist('kael'); D.start(); window.__started = 1; await new Promise(r => setTimeout(r, 2200)); } const g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), p = g.p; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; g.mods.reach = ${reach}; if (D.grass) D.grass.visible = false;
  for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); g.field.monsters[0] = { id: 'ember-wyvern', level: 10, cd: 0 }; g.field.monsters[1] = { id: 'cinder-hatchling', level: 10, cd: 0 }; g.field.monsters[2] = { id: 'sigil-familiar', level: 5, cd: 0 };
  window.__slots = []; for (let k = 0; k < 14; k++) { spawnEnemy(g, 'husk', { x: p.x + ((k % 5) - 2) * 1.6, z: p.z - 6 - (k / 5 | 0) * 6 }); const i = g.lastSlot; g.en.spd[i] = 0; g.en.hp[i] = 1e7; __slots.push(i); }
  D.camHold = { x: p.x + 0.5, y: p.y + 24, z: p.z + 12, lx: p.x, ly: p.y, lz: p.z - 12 }; await new Promise(r => setTimeout(r, 900)); return g.reachK; })()`);
console.log('reach 0, reachK', await setup(0)); await wait(500); await b.shot('areas_r0_a'); await wait(350); await b.shot('areas_r0_b');
console.log('reach +150%, reachK', await setup(1.5)); await wait(500); await b.shot('areas_r150_a'); await wait(350); await b.shot('areas_r150_b');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
