import { launch, wait } from './cdp.mjs';
// The render budget: 300 enemies on screen, seeds 1, 4242, 31337, 48879; draws under 150 and triangles under 250,000.
let bad = 0;
for (const seed of [1, 4242, 31337, 48879]) {
  const b = await launch({ out: process.argv[2], query: '?seed=' + seed });
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
  const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'); const kinds = ['husk','runner','seer','bloat','golem','scarab'];
    for (let k = 0, n = 0; n < 300 && k < 4000; k++) { const a = k * 2.399, d = 6 + (k % 40) * 0.8; if (spawnEnemy(g, kinds[k % 6], { x: g.p.x + Math.cos(a) * d, z: g.p.z + Math.sin(a) * d })) n++; }
    await new Promise(r => setTimeout(r, 3000)); const R = D.renderer; return JSON.stringify({ enemies: g.enemyCount(), draws: R.info.render.calls, tris: R.info.render.triangles }); })()`));
  const ok = r.draws < 150 && r.tris < 250000; if (!ok) bad++; console.log('seed', seed, JSON.stringify(r), ok ? 'OK' : 'OVER'); b.close(); await wait(800);
}
console.log('over', bad); setTimeout(() => process.exit(0), 300);
