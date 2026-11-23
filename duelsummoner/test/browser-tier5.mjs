import { launch, wait } from './cdp.mjs';
// Tier 5 (Tablebreak) at the game camera on Stage 1: a 120-creature crowd, warnings on top, the three big own attacks stamped into the ground with hollow giants, the sky tinted. Measures the claimed share (pixels that differ with Tier 5 on and off),
// the four screen edges and the horizon crossings, takes the picture, then the Tablebreak picture (the three pieces shifted 4, 6 and 8 art pixels).   node test/browser-tier5.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&fxlab' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn('new Promise(r => { const t = setInterval(() => { if (window.__fxlab) { clearInterval(t); r(1); } }, 200); setTimeout(() => r(0), 20000); })'); await wait(500);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), C = await import('/src/sim/combat.js'), p = g.p; g.field.monsters.fill(null); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; if (D.grass) D.grass.visible = false;
  for (let k = 0; k < 120; k++) { const a = -1.57 + ((k * 7) % 21 - 10) * 0.075, d = 10 + Math.floor(k / 14) * 1.6; spawnEnemy(g, ['husk','runner','bloat','hunter'][(k * 5) % 4], { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }); g.en.hp[g.lastSlot] = 1e9; g.en.spd[g.lastSlot] = 0; }
  await window.__fxlab.tier5(true); D.camHold = { x: p.x, y: p.y + 6.5, z: p.z + 15, lx: p.x, ly: p.y + 1.2, lz: p.z - 7 }; await new Promise(r => setTimeout(r, 4500)); D.freeze(true); C.addTele(g.tele, { type: 0, x: p.x - 9, y: p.y, z: p.z - 5, dx: 1, dz: 0, len: 14, w: 1.2, dur: 1e6, t: 0.6e6 }); C.addTele(g.tele, { type: 1, x: p.x + 8, y: p.y, z: p.z - 4, r: 3, dur: 1e6, t: 0.6e6 }); await new Promise(r => setTimeout(r, 800)); return 'ok'; })()`));
await wait(300); await b.shot('tier5');
console.log('claimed', await b.evalIn('(async()=>JSON.stringify(await window.__fxlab.tier5Measure()))()'));
console.log('duelistPixels', JSON.stringify(await b.evalIn('JSON.stringify(__ds.duelistPixels())'))); console.log('own', await b.evalIn('JSON.stringify(window.__fxlab.own())'));
await b.evalIn('__ds.tablebreak(true)'); await wait(500); await b.shot('tablebreak');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
