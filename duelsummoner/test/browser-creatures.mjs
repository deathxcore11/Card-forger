import { launch, wait } from './cdp.mjs';
// Stand-in creatures v2: one close picture per kind and a 150-enemy crowd per stage at the game camera.   node test/browser-creatures.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; g.field.monsters.fill(null); D.game.opts.offers = false; return 1; })()`);
const kinds = ['husk', 'runner', 'seer', 'golem', 'bloat', 'hunter', 'scarab'];
for (const k of kinds) {
  console.log(k, await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; const p = g.p; spawnEnemy(g, '${k}', { x: p.x + 4, z: p.z }); g.en.hp[g.lastSlot] = 1e6; g.en.spd[g.lastSlot] = 0; const ex = p.x + 4, ey = g.en.y[g.lastSlot], ez = p.z;
    g.en.face[g.lastSlot] = -1.0; g.en.pface[g.lastSlot] = -1.0; D.camHold = { x: ex - 1.4, y: ey + 1.5, z: ez + 4.2, lx: ex, ly: ey + 0.9, lz: ez }; await new Promise(r => setTimeout(r, 1500)); return JSON.stringify({ tris: D.actors.kinds.find(q => q.K.name && q.K.id === ${{husk:0,runner:1,seer:2,golem:3,bloat:4,hunter:6,scarab:5}[k]}).body.geometry.userData.tris }); })()`));
  await wait(150); await b.shot('creature_' + k);
}
for (const st of [0, 1, 2]) {
  console.log('crowd stage', st + 1, await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'); if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; g.field.monsters.fill(null); await new Promise(r => setTimeout(r, 2000)); }
    for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; D.camHold = null; const p = g.p; const kinds = ['husk','runner','seer','golem','bloat','hunter','scarab'];
    for (let k = 0; k < 150; k++) { const a = -1.57 + ((k * 7) % 21 - 10) * 0.075, d = 5 + Math.floor(k / 14) * 1.3 + ((k * 3) % 5) * 0.2; spawnEnemy(g, kinds[(k * 5) % 7], { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }); g.en.hp[g.lastSlot] = 1e6; g.en.spd[g.lastSlot] = 0; }
    await new Promise(r => setTimeout(r, 1800)); const R = D.renderer; return JSON.stringify({ n: g.enemyCount() }); })()`));
  await wait(150); await b.shot('crowd_stage' + (st + 1));
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
