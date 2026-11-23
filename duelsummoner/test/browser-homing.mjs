import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const r = await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); g.god = true; g.opts.offers = false; const { spawnEnemy } = await import('/src/sim/enemies.js');
  g.field.monsters[1] = { id: 'sigil-familiar', level: 5, cd: 0 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 5, cd: 0 };
  for (let i = 0; i < 40; i++) spawnEnemy(g, 'runner', { x: g.p.x + 8 + i % 8, z: g.p.z - 4 + (i / 8 | 0) * 2 });
  let maxBolts = 0, homing = 0; for (let f = 0; f < 240; f++) { await new Promise(r => requestAnimationFrame(r)); maxBolts = Math.max(maxBolts, D.actors.bolts.count); for (let i = 0; i < g.shots.max; i++) if (g.shots.alive[i] && g.shots.kind[i] === 3) homing++; } return { maxBolts, homingShotFrames: homing }; })()`);
console.log(JSON.stringify(r)); await b.shot('homing'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
