import { launch, wait } from './cdp.mjs';
// The claimed share over a run: the same real run (Kael, a god-mode player, the game's own spawner and attacks) at 1:00, 3:00, 5:00, 7:30 and Overtime +2:00, with the Reach a build would plausibly have by then
// (0, +30%, +70%, +100%, +150% from Surveyor's Lens stacks, +10% each). At each stop: how many screen pixels differ with the own effects drawn and with them hidden (the claimed share), the own-effect readout, one picture.   node test/browser-share.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=9&debug&moments=full' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); const g = D.game; g.god = true; g.opts.offers = false; if (D.grass) D.grass.visible = false; window.__F = await import('/src/sim/field.js'); return 1; })()`);
// the scripted pick order of a build on pace: the starter pair, then the fusion and a second line, levelled over the run, with the Reach items a player would have picked by then (Widening Rite levels and Surveyor's Lenses; Reach +10% per lens, +20% per rite level)
const STOPS = [['1m00', 60, 0, 0, 1, 'ember-wyvern', 'cinder-hatchling'], ['3m00', 180, 3, 0, 3, 'twinflare-tyrant', 'astral-magus'], ['5m00', 300, 5, 2, 6, 'twinflare-tyrant', 'astral-magus'], ['7m30', 450, 6, 4, 10, 'twinflare-tyrant', 'astral-magus'], ['ot2m00', 600, 10, 5, 10, 'twinflare-tyrant', 'astral-magus']];
for (const [name, t, lenses, rite, lv, m1, m2] of STOPS) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, F = __F; g.items = []; for (let i = 0; i < ${lenses}; i++) g.items.push('surveyors-lens'); g.field.spells.fill(null); if (${rite} > 0) g.field.spells[0] = { id: 'widening-rite', level: ${rite} }; g.field.monsters.fill(null); g.field.monsters[0] = { id: '${m1}', level: ${lv}, cd: 0.1, ang: 0, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }; g.field.monsters[1] = { id: '${m2}', level: ${lv}, cd: 0.1, ang: 2, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }; if (${t} >= 480) { g.t = ${t}; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.cardT = 1e9; g.duelOn = true; g.otT = ${t - 480}; g.otAcc = 0; g.huntT = 0; g.flags.overtime = true; } else { g.t = ${t}; g.sc = ${t}; } F.recompute(g); D.camHold = null; await new Promise(r => setTimeout(r, 6000)); for (let w = 0; w < 300; w++) { if (g.fx.some(q => q.on && q.owner === 0 && q.r > 0 && q.t > 0.05)) break; await new Promise(r => setTimeout(r, 20)); } return 1; })()`);
  const m = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, A = D.actors, g = D.game; D.freeze(true); const snap = () => { D.blitNow(); const c = document.getElementById('view'), cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; const x = cv.getContext('2d'); x.drawImage(c, 0, 0); return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
    await new Promise(r => setTimeout(r, 300)); const own = JSON.stringify(A.own.readout), a = snap(); A.own.hideAll = true; await new Promise(r => setTimeout(r, 300)); const bb = snap(); A.own.hideAll = false; let n = 0; for (let i = 0; i < a.d.length; i += 4) if (Math.abs(a.d[i] - bb.d[i]) + Math.abs(a.d[i + 1] - bb.d[i + 1]) + Math.abs(a.d[i + 2] - bb.d[i + 2]) > 30) n++;
    D.freeze(false); return JSON.stringify({ reach: +g.mods.reach.toFixed(2), tier5: A.tier5, otStep: g.otStep, enemies: g.enemyCount ? g.enemyCount() : -1, fx: g.fx.filter(o => o.on && o.owner === 0).length, maxR: +Math.max(0, ...g.fx.filter(o => o.on && o.owner === 0).map(o => o.r || 0)).toFixed(1), kills: g.kills, claimedPct: +(n / (a.w * a.h) * 100).toFixed(1), own: JSON.parse(own) }); })()`));
  const tg = { '1m00': 5, '3m00': 10, '5m00': 18, '7m30': 28, 'ot2m00': 35 }[name]; console.log(name, JSON.stringify(m), 'target ' + tg + '%: ' + (Math.abs(m.claimedPct - tg) <= Math.max(3, tg * 0.25) ? 'PASS' : 'FAIL (' + m.claimedPct + '%)')); await b.shot('share_' + name);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);







