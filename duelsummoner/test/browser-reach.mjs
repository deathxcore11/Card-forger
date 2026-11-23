import { launch, wait } from './cdp.mjs';
// The Reach proof (step 12b): the same fire breath (Twinflare Tyrant cone, 14 m) over a 150-creature crowd on Stage 1 at Reach 0, +50%, +100% and +150%, camera pull-back on, an enemy warning lane and circle on top.
// Reports the footprint radius from the sim, the camera zoom, the duelist's share of the screen height and the share of the screen the effect covers (pixels that differ with the fan on and off).
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; D.game.opts.offers = false; return 1; })()`);
const levels = [[0, 0, 0], [0.5, 0, 5], [1.0, 5, 0], [1.5, 5, 5]];
for (const [want, spellLv, lenses] of levels) {
  const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), F = await import('/src/sim/field.js'), C = await import('/src/sim/combat.js'); D.freeze(false); for (const t of g.tele) t.on = false; for (const o of g.fx) o.on = false;
    for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.spells[0] = ${spellLv} ? { id: 'widening-rite', level: ${spellLv}, cd: 0, rootFx: 0 } : null; g.items = []; for (let i = 0; i < ${lenses}; i++) g.items.push('surveyors-lens'); F.recompute(g);
    g.field.monsters.fill(null); g.field.monsters[0] = { id: 'twinflare-tyrant', level: 1, cd: 0 }; const p = g.p;
    for (let k = 0; k < 150; k++) { const a = -1.57 + ((k * 7) % 25 - 12) * 0.06, d = 5 + Math.floor(k / 12) * 1.7 + ((k * 3) % 5) * 0.25; spawnEnemy(g, ['husk','runner','seer','golem','bloat','hunter','scarab'][(k * 5) % 7], { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }); g.en.hp[g.lastSlot] = 1e9; g.en.spd[g.lastSlot] = 0; }
    D.ownRForce = 14 * g.reachK; await new Promise(r => setTimeout(r, 4500));
    let rec = null; for (let tries = 0; tries < 400 && !rec; tries++) { rec = g.fx.find(o => o.on && o.type === 'fan' && o.owner === 0 && o.t < 0.12); if (!rec) await new Promise(r => requestAnimationFrame(r)); }
    if (!rec) return JSON.stringify({ err: 'no fan seen' });
    D.freeze(true); C.addTele(g.tele, { type: 0, x: p.x - 9, y: p.y, z: p.z - 5, dx: 1, dz: 0, len: 14, w: 1.2, dur: 1e6, t: 0.6e6 }); C.addTele(g.tele, { type: 1, x: p.x + 8, y: p.y, z: p.z - 5, r: 3, dur: 1e6, t: 0.6e6 });
    await new Promise(r => setTimeout(r, 900));
    return JSON.stringify({ reach: g.mods.reach, reachK: +g.reachK.toFixed(3), fanR: +rec.r.toFixed(2), simRange: 14, own: D.actors.own.readout, zoom: +D.chaseZoom().toFixed(2) }); })()`));
  console.log('reach', want, JSON.stringify(r));
  await wait(200); const tag = 'reach_' + Math.round(want * 100); await b.shot(tag);
  // the share of the screen the effect covers: pixels that differ with the fan on and with it switched off (sim frozen, grass off)
  console.log(' share', await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (D.grass) D.grass.visible = false; const snap = () => { D.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    await new Promise(r => setTimeout(r, 300)); const A = snap(); const rec = g.fx.find(o => o.on && o.type === 'fan' && o.owner === 0); if (rec) rec.on = false; await new Promise(r => setTimeout(r, 300)); const B = snap(); let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n++;
    const pl = g.p, T = window.THREE, cam = D.camera, a = new T.Vector3(pl.x, pl.y, pl.z).project(cam), h = new T.Vector3(pl.x, pl.y + 1.8, pl.z).project(cam); if (D.grass) D.grass.visible = true;
    return JSON.stringify({ coveredPct: +(n / (A.length / 4) * 100).toFixed(1), duelistShare: +(Math.abs(h.y - a.y) / 2).toFixed(3) }); })()`));
}
console.log(JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
