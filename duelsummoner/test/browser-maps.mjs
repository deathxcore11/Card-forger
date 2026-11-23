import { launch, wait } from './cdp.mjs';
// The designed maps in the game camera: for each seed and stage, the generator's time in the browser, the triangles of the terrain mesh, and one picture from the spawn.   node test/browser-maps.mjs <outdir> [seeds...]
const seeds = process.argv.length > 3 ? process.argv.slice(3).map(Number) : [1, 2, 3, 777, 4242];
const b = await launch({ out: process.argv[2], query: '?debug&play=1&seed=' + seeds[0] });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
for (const seed of seeds) {
  await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=' + seed }); await wait(2500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); window.__S = await import('/src/sim/stages.js'); D.game.god = true; return 1; })()`);
  for (let st = 0; st < 3; st++) {
    const info = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const t0 = performance.now(); g.stage = ${st}; __S.loadStageMap(g, ${st}); const ms = performance.now() - t0; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); await new Promise(r => setTimeout(r, 1800)); return JSON.stringify({ ms: Math.round(ms), key: g.map.key, v2: !!g.map.v2, enc: g.map.encounters.length, rings: g.map.bossRings.length, fallback: g.map.fallback }); })()`);
    console.log('seed', seed, 'stage', st + 1, info); await b.shot('map_s' + seed + '_st' + (st + 1));
  }
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
