import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.opts.offers = false; const { spawnEnemy } = await import('/src/sim/enemies.js');
  g.field.monsters[1] = { id: 'rune-apprentice', level: 6, cd: 0 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 6, cd: 0 };
  window.__spawn = setInterval(() => { let n = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) n++; for (let k = n; k < 110; k++) spawnEnemy(g, 'runner', { x: g.p.x + 7 + (k % 9), z: g.p.z + (k % 7) - 3 }); }, 200); return 1; })()`);
await wait(4000);
// sample: how many enemies are in the white flash state right now, over 40 frames
const r = await b.evalIn(`(async()=>{ const g = __ds.game; let tot = 0, white = 0, frames = 0, maxWhite = 0; for (let f = 0; f < 60; f++) { await new Promise(r => requestAnimationFrame(r)); let n = 0, w = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) { n++; if (g.en.flash[i] > 0) w++; } tot += n; white += w; frames++; maxWhite = Math.max(maxWhite, w); } return { avgEnemies: Math.round(tot / frames), avgFlashing: +(white / frames).toFixed(1), maxFlashing: maxWhite }; })()`);
console.log(JSON.stringify(r)); await b.shot('fight_flash'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);


