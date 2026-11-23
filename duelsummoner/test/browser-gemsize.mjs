import { launch, wait } from './cdp.mjs';
// An XP gem of each tier beside the duelist, seen from the real game camera.
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
console.log(await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; const C = await import('/src/sim/combat.js'); g.pick.alive.fill(0); g.curSrc = g.srcIndex('card-throw'); const p = g.p; [[7.2, 1.2, 1], [7.8, 0.2, 5], [7.4, -1.0, 22]].forEach(([dx, dz, v]) => C.dropPickup(g, 0, p.x + dx, 0, p.z + dz, v)); g.curSrc = 0; await new Promise(r => setTimeout(r, 1500)); return 1; })()`));
await wait(300); await b.shot('xp_gems_game_camera'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
