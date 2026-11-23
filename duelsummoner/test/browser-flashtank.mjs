import { launch, wait } from './cdp.mjs';
// Hit flash under sustained fire: a 10x HP enemy inside a crowd of 100; how much of the time it is flashing, and how long each flash lasts in frames.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const r = await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); g.god = true; g.opts.offers = false; const { spawnEnemy } = await import('/src/sim/enemies.js');
  g.field.monsters[1] = { id: 'rune-apprentice', level: 6, cd: 0 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 6, cd: 0 };
  const keep = setInterval(() => { let n = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) n++; for (let k = n; k < 100; k++) spawnEnemy(g, 'runner', { x: g.p.x + 7 + (k % 9), z: g.p.z + (k % 7) - 3 }); }, 150);
  await new Promise(r => setTimeout(r, 2500));
  let tank = -1, best = 1e9; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) { const d = Math.hypot(g.en.x[i] - g.p.x, g.en.z[i] - g.p.z); if (d < best) { best = d; tank = i; } } 
  const tick = () => { g.en.hp[tank] = Math.max(g.en.hp[tank], 100); }; const iv = setInterval(tick, 5);
  let frames = 0, flashFrames = 0, runs = [], run = 0, hits = 0, prev = 0, last = 0;
  for (let f = 0; f < 1800; f++) { await new Promise(r => requestAnimationFrame(r)); if (!g.en.alive[tank]) break; frames++; const fl = g.en.flash[tank] > 0; if (fl) { flashFrames++; run++; } else if (run) { runs.push(run); run = 0; } }
  clearInterval(iv); clearInterval(keep); return { frames, flashShare: +(flashFrames / frames).toFixed(2), flashes: runs.length, avgFlashFrames: runs.length ? +(runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(1) : 0 }; })()`);
console.log(JSON.stringify(r)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
