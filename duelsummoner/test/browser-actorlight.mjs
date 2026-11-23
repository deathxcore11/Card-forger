// The actor readability rule, measured on real frames: the median lit lightness (L*) of an actor's main body at least 12 L* away from the floor beside it, on all three stage floors,
// for Kael, Mira, the wyvern and the swarm. Writes close pictures of Kael on each floor.   node test/browser-actorlight.mjs <outdir> [label]
import { launch, wait } from './cdp.mjs';
const out = process.argv[2], label = process.argv[3] || 'lit';
const b = await launch({ out, query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const rows = [];
for (const who of ['kael', 'mira']) {
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('${who}'); D.start(); await new Promise(r => setTimeout(r, 2200)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
  for (const st of [0, 1, 2]) {
    const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (${st}) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${st}); g.god = true; g.spawnAcc = -1e9; await new Promise(r => setTimeout(r, 2200)); }
      const { spawnEnemy } = await import('/src/sim/enemies.js'); const p = g.p;
      const f = n => new Promise(async r => { for (let i = 0; i < n; i++) await new Promise(q => requestAnimationFrame(q)); r(); });
      D.camHold = { x: p.x + 2.4, y: p.y + 1.7, z: p.z + 3.2, lx: p.x, ly: p.y + 1.0, lz: p.z }; await f(40); const out = { duelist: D.measure('duelist') };
      if ('${who}' === 'kael') { const m = g.field.monsters[0], k = { x: m.x, y: m.y, z: m.z }; D.camHold = { x: k.x + 1.1, y: k.y + 0.5, z: k.z + 1.5, lx: k.x, ly: k.y + 0.1, lz: k.z }; await f(40); out.summon = D.measure('summon'); }
      const saved = g.field.monsters.slice(); g.field.monsters.fill(null); g.cardT = 1e9; for (let k = 0; k < 6; k++) { spawnEnemy(g, 'husk', { x: p.x + 4 + k * 0.5, z: p.z + 1.0 + k * 0.7 }); g.en.hp[g.lastSlot] = 1e6; g.en.spd[g.lastSlot] = 0; } await new Promise(r => setTimeout(r, 400)); let ei = -1; for (let k = 0; k < g.en.max; k++) if (g.en.alive[k]) { ei = k; break; } const ex = g.en.x[ei], ey = g.en.y[ei], ez = g.en.z[ei]; D.camHold = { x: ex + 2.4, y: ey + 1.5, z: ez + 3.5, lx: ex, ly: ey + 0.4, lz: ez }; await f(40); out.enemy = D.measure('enemy:' + g.en.kind[ei]); for (let k = 0; k < 4; k++) g.field.monsters[k] = saved[k]; g.cardT = 0; D.camHold = { x: p.x + 2.4, y: p.y + 1.7, z: p.z + 3.2, lx: p.x, ly: p.y + 1.0, lz: p.z }; await f(20);
      return JSON.stringify(out); })()`));
    rows.push({ who, stage: st + 1, ...r }); if (who === 'kael') { await wait(200); await b.shot(label + '_kael_stage' + (st + 1)); }
  }
}
for (const r of rows) console.log(r.who, 'stage', r.stage, 'duelist', JSON.stringify(r.duelist), r.summon ? 'summon ' + JSON.stringify(r.summon) : '', 'enemy', JSON.stringify(r.enemy));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
