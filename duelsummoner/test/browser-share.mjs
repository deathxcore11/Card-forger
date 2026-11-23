import { launch, wait } from './cdp.mjs';
// The claimed share over a run: the same real run (Kael, a god-mode player, the game's own spawner and attacks) at 1:00, 3:00, 5:00, 7:30 and Overtime +2:00, with the Reach a build would plausibly have by then
// (0, +30%, +70%, +100%, +150% from Surveyor's Lens stacks, +10% each). At each stop: how many screen pixels differ with the own effects drawn and with them hidden (the claimed share), the own-effect readout, one picture.   node test/browser-share.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=9&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); const g = D.game; g.god = true; g.opts.offers = false; if (D.grass) D.grass.visible = false; window.__F = await import('/src/sim/field.js'); return 1; })()`);
const STOPS = [['1m00', 60, 0], ['3m00', 180, 3], ['5m00', 300, 7], ['7m30', 450, 10], ['ot2m00', 600, 15]];
for (const [name, t, lenses] of STOPS) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, F = __F; g.items = []; for (let i = 0; i < ${lenses}; i++) g.items.push('surveyors-lens'); if (${t} >= 480) { g.t = ${t}; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.cardT = 1e9; g.duelOn = true; g.otT = ${t - 480}; g.otAcc = 0; g.huntT = 0; g.flags.overtime = true; } else g.t = ${t}; F.recompute(g); D.camHold = null; await new Promise(r => setTimeout(r, 4000)); const C = await import('/src/sim/combat.js'), p = g.p; g.curSrc = g.srcIndex('graveyard-bell'); for (let k = 0; k < 3; k++) { C.explode(g, p.x, p.y, p.z - 3 - k * 2, 16, 0, 5, 0xff8a1f); } C.addFx(g, { type: 'fan', owner: 0, el: 'fire', x: p.x, y: p.y, z: p.z, r: 14 * g.reachK, arc: 120, dx: 0, dz: -1, dur: 0.6, color: 0 }); C.addFx(g, { type: 'fan', owner: 0, el: 'fire', x: p.x, y: p.y, z: p.z, r: 10 * g.reachK, arc: 80, dx: 1, dz: -1, dur: 0.6, color: 0 }); for (let w = 0; w < 100; w++) { await new Promise(r => setTimeout(r, 10)); const o = g.fx.find(q => q.on && q.owner === 0 && q.type === 'ring'); if (o && o.t >= 0.22) break; } return 1; })()`);
  const m = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, A = D.actors, g = D.game; D.freeze(true); const snap = () => { D.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
    await new Promise(r => setTimeout(r, 300)); const own = JSON.stringify(A.own.readout), a = snap(); A.own.hideAll = true; await new Promise(r => setTimeout(r, 300)); const bb = snap(); A.own.hideAll = false; let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - bb.d[i]) + Math.abs(a.d[i + 1] - bb.d[i + 1]) + Math.abs(a.d[i + 2] - bb.d[i + 2]) > 30) n++;
    D.freeze(false); return JSON.stringify({ reach: +g.mods.reach.toFixed(2), tier5: A.tier5, otStep: g.otStep, enemies: g.enemyCount ? g.enemyCount() : -1, fx: g.fx.filter(o => o.on && o.owner === 0).length, claimedPct: +(n / (a.w * a.h) * 100).toFixed(1), own: JSON.parse(own) }); })()`));
  console.log(name, JSON.stringify(m)); await b.shot('share_' + name);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);



