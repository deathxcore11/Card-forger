// The ride gym's full combo from the play camera (?gym=1&blocks=1, seed 21, 1920 x 1080): a key schedule runs inside the page in real time
// (ollie, flip, spin, kicker, grab, grind, ollie off, kicker, flip, quarter pipe, revert, manual, bank) while a frame is taken every second for 20 s,
// with the open combo and the banked score logged per frame. Pictures go to <outdir>, never into the repo.   node tools/gymcombo.mjs <outdir>
import { launch, wait } from '../test/cdp.mjs';
const [out] = process.argv.slice(2), Q = process.env.Q === undefined ? '&blocks=1' : process.env.Q;
const b = await launch({ out, query: '?debug&play=1&gym=1&seed=21' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&gym=1&seed=21' + Q }); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.god = true; g.rideKicks = 1; const e = document.getElementById('devbar'); if (e) e.style.visibility = 'hidden'; return 1; })()`);
// a small autopilot inside the page, reacting to the ride state each frame (real time): the combo in order, each step when its moment comes
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { streamTo, heightAt } = await import('/src/sim/terrain.js'); D.freeze(true); streamTo(-34, -30, 120, 6); const p = g.p; p.ride = undefined; p.x = -40; p.z = -30; p.y = heightAt(-40, -30); p.vx = p.vz = 0; p.grounded = true; D.input.yaw = -Math.PI / 2; D.input.pitch = 0;
  for (let i = 0; i < 12; i++) { D.drive(1 / 60, { f: 0, yaw: D.input.yaw }); await new Promise(r => requestAnimationFrame(r)); } D.drive(1 / 60, { f: 1, yaw: D.input.yaw }); Object.assign(p.ride, { on: true, heading: Math.PI / 2, speed: 14 });
  const { spawnEnemy } = await import('/src/sim/enemies.js'); const K = D.input.keys, tap = (k, ms) => { K[k] = true; setTimeout(() => { K[k] = false; }, ms); }; let ph = 0, t0 = performance.now(), mark = 0; K.KeyW = true; window.__ph = [];
  const snap = n => { if (!window.__snapDone) window.__snapDone = {}; if (window.__snapDone[n]) return; window.__snapDone[n] = 1; window.__snap = n; D.freeze(true); };
  const step = () => { if (window.__snap) { requestAnimationFrame(step); return; } const r = p.ride, now = performance.now(), air = !p.grounded, el = (now - mark) / 1000, go = n => { ph = n; mark = now; window.__ph.push(n + '@' + ((now - t0) / 1000).toFixed(1)); };
    if (ph === 0 && p.x > -30) { tap('Space', 250); go(1); }
    else if (ph === 1 && air && el > 0.12) { tap('KeyJ', 90); K.KeyE = true; go(2); }
    else if (ph === 2 && el > 0.12 && r.flipT > 0 && !(window.__snapDone || {}).flip) { snap('flip'); }
    else if (ph === 2 && el > 0.34) { K.KeyE = false; if (!air) go(3); }
    else if (ph === 3 && air && r.combo && r.combo.list.includes('Kicker')) { K.KeyK = true; go(4); }
    else if (ph === 4 && el > 0.22 && r.grabbing && !(window.__snapDone || {}).grab) { snap('grab'); }
    else if (ph === 4 && el > 0.3) { K.KeyK = false; K.KeyL = true; go(5); }
    else if (ph === 5 && r.grind && !(window.__snapDone || {}).grind) { snap('grind'); }
    else if (ph === 5 && (r.grind || el > 1.2)) { K.KeyL = false; go(6); }
    else if (ph === 6 && r.grind && el > 0.15) snap('grind');
    else if (ph === 6 && el > 0.45) { tap('Space', 90); go(7); const h = r.heading; for (let q = 0; q < 6; q++) spawnEnemy(g, 'husk', { x: p.x + Math.sin(h) * (14 + q * 2) + (q % 2 ? 0.4 : -0.4), z: p.z + Math.cos(h) * (14 + q * 2) }); }
    else if (ph === 7 && air && p.x > 20 && el > 0.5 && p.vy > -2) { tap('KeyJ', 90); go(8); }
    else if (ph === 8 && r.vert) { go(9); }
    else if (ph === 9 && air && p.vy < 0 && p.y - heightAt(p.x, p.z) < 2.2) { tap('ShiftLeft', 160); go(10); }
    else if (ph === 10 && !air && el > 0.25) { const h = p.ride.heading; for (let q = 0; q < 6; q++) spawnEnemy(g, 'husk', { x: p.x + Math.sin(h) * (9 + q * 2.5), z: p.z + Math.cos(h) * (9 + q * 2.5) + (q % 2 ? 0.5 : -0.5) }); K.KeyW = false; K.KeyS = true; setTimeout(() => { K.KeyS = false; }, 80); setTimeout(() => { K.KeyW = true; }, 220); go(11); }
    else if (ph === 11 && el > 0.6 && r.manual && !(window.__snapDone || {}).manual) snap('manual');
    else if (ph === 11 && el > 1.6) { tap('Space', 200); go(12); }
    else if (ph === 12 && air && el > 0.3 && (g.rflow && g.rflow.meter >= 1)) { tap('KeyJ', 100); tap('KeyK', 100); go(13); }
    else if (ph === 13 && el > 0.3 && r.specialT > 0) snap('special');
    if (((window.__ds.actors || {})._thrown || []).some(o => o.on && o.vy < 2)) snap('thrown');
    if (now - t0 < 21000) requestAnimationFrame(step); };
  D.freeze(false); requestAnimationFrame(step); return 1; })()`);
const log = [], step = +(process.env.FRAME || 1), N = Math.round(20 / step);       // FRAME=0.25 for quarter-second frames (the game keeps running while a frame is taken)
const poses = async () => { const n = await b.evalIn('window.__snap || ""'); if (n) { await b.shot('pose-' + n); await b.evalIn('(()=>{ window.__snap = ""; __ds.freeze(false); return 1; })()'); } };
for (let f = 0; f < N; f++) { for (let w = 0; w < step * 1000; w += 50) { await wait(50); await poses(); } await b.shot('combo-' + String(f).padStart(2, '0'));
  log.push(await b.evalIn('(()=>{ const g = __ds.game, r = g.p.ride, F = g.rflow || {}; return JSON.stringify({ f: ' + f + ', x: +g.p.x.toFixed(1), air: !g.p.grounded, flip: !!(r && r.flipT > 0), grab: !!(r && r.grabbing), grind: r && r.grind ? r.grind.name : "", manual: !!(r && r.manual), special: r && r.specialT > 0 ? r.specialName : "", thrown: ((__ds.actors && __ds.actors._thrown) || []).filter(o => o.on).length, open: r && r.combo ? r.combo.list.join("+") : "", banked: F.banked || 0 }); })()')); }
console.log(log.join('\n'));
setTimeout(() => process.exit(0), 300);
