import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
for (const st of [0, 1, 2]) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; await new Promise(r => setTimeout(r, 2200)); }
    const { spawnEnemy } = await import('/src/sim/enemies.js'); const p = g.p; g.field.monsters.fill(null); g.cardT = 1e9; const ks = ['husk','runner','seer','bloat','golem','scarab'];
    for (let k = 0; k < 12; k++) { spawnEnemy(g, ks[k % 6], { x: p.x + 5 + (k % 4) * 1.6, z: p.z - 1 + ((k / 4) | 0) * 1.8 }); g.en.hp[g.lastSlot] = 1e6; g.en.spd[g.lastSlot] = 0; }
    D.camHold = { x: p.x + 5, y: p.y + 2.6, z: p.z + 9, lx: p.x + 6.5, ly: p.y + 0.6, lz: p.z + 1 }; await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
  await wait(300); await b.shot('lit_enemies_stage' + (st + 1));
}
b.close(); setTimeout(() => process.exit(0), 300);
