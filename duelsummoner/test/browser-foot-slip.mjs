import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Foot slip: the planted foot's drift in world space per frame (a planted foot should not move). Each frame both foot bones are read after the rig update; a foot counts as planted in a frame when it is within 3 cm of its lowest height over the last 30 frames. Scenarios: run, run with Move upgrades (+60%), a downhill slide, and the first 0.7 s of accelerating from a stand. Reports median and 90th percentile drift in cm per planted frame and the mean ground speed.
//   node test/browser-foot-slip.mjs <outdir> [label]     (frames of the run scenario are saved close behind Kael, 915x412)
const [out, label = 'run'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&seed=1&arch=a' }); await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return 1; })()`);
const run = async (name, setup, secs, frames) => JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, R = D.actors.rig, T = window.THREE; ${setup}
  const feet = []; R.root.traverse(o => { if (o.isBone && /^(Left|Right)Foot$/.test(o.name)) feet.push(o); }); const P = [new T.Vector3(), new T.Vector3()], prev = [null, null], lowH = [[], []], drift = [], speeds = []; let lastP = null; const t0 = performance.now(); let pic = 0;
  await new Promise(res => { const step = now => { const key = g.p.x + ',' + g.p.z + ',' + (R.mixer.time || 0).toFixed(3); if (key === window.__lk) { if (now - t0 < ${secs * 1000}) requestAnimationFrame(step); else res(); return; } window.__lk = key; feet.forEach((f, i) => { f.getWorldPosition(P[i]); const y = P[i].y; lowH[i].push(y); if (lowH[i].length > 30) lowH[i].shift(); const mn = Math.min.apply(null, lowH[i]); if (prev[i] && y < mn + 0.03 && prev[i].planted) drift.push(Math.hypot(P[i].x - prev[i].x, P[i].z - prev[i].z) * 100); prev[i] = { x: P[i].x, z: P[i].z, planted: y < mn + 0.03 }; });
    if (lastP) speeds.push(Math.hypot(g.p.x - lastP.x, g.p.z - lastP.z) / Math.max(0.001, (now - lastP.t) / 1000)); lastP = { x: g.p.x, z: g.p.z, t: now };
    window.__frames = (window.__frames || 0) + 1; if (now - t0 < ${secs * 1000}) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  const s = drift.slice().sort((a, c) => a - c), q = p => s.length ? +s[Math.floor(s.length * p)].toFixed(1) : null, sp = speeds.slice(5);
  return JSON.stringify({ planted: s.length, median_cm: q(0.5), p90_cm: q(0.9), speed: +(sp.reduce((a, c) => a + c, 0) / Math.max(1, sp.length)).toFixed(1), rate: R.ph !== undefined ? +R.ph.toFixed(2) : null }); })()`));
if (process.env.TUNE) await b.evalIn('window.__rigTune = ' + process.env.TUNE + '; 1');
const out2 = {};
out2.run = await run('run', `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); await new Promise(r => setTimeout(r, 1200));`, 4);
await b.evalIn(`(()=>{ const D = __ds, g = D.game; window.__cam = setInterval(() => { const p = g.p, yaw = Math.atan2(p.vx, p.vz); D.camHold = { x: p.x - Math.sin(yaw) * 3.4 + Math.cos(yaw) * 1.2, y: p.y + 1.3, z: p.z - Math.cos(yaw) * 3.4 - Math.sin(yaw) * 1.2, lx: p.x, ly: p.y + 0.55, lz: p.z }; }, 4); return 1; })()`);
await wait(300); const frames = []; for (let k = 0; k < 8; k++) { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(join(out, label + '-run-' + k + '.jpg'), Buffer.from(r.result.data, 'base64')); await wait(33); }
await b.evalIn(`clearInterval(window.__cam); __ds.camHold = null; window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); 1`); await wait(800);
out2.runMove = await run('moveRun', `__ds.game.mods.move = 0.6; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); await new Promise(r => setTimeout(r, 1200));`, 4);
await b.evalIn(`__ds.game.mods.move = 0; window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); 1`); await wait(800);
out2.accel = await run('accel', `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));`, 0.7);
await b.evalIn(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); 1`); await wait(600);
out2.slide = await run('slide', `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); await new Promise(r => setTimeout(r, 1500)); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c' }));`, 1.5);
console.log(label, JSON.stringify(out2)); b.close(); setTimeout(() => process.exit(0), 300);
