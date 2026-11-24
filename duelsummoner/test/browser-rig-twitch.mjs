import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// Twitch check: 10 s at 915x412 running in circles with the auto-throws firing and enemies landing hits. Every frame the rotation of the torso and arm bones is read; the report is the biggest and the 99th percentile single-frame turn, and how many frames are a pop (over 20 degrees and 2.5 times their neighbours).
//   node test/browser-rig-twitch.mjs <outdir> [label]
const [out, label = 'run'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2000);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4500)); return 1; })()`);
const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, R = D.actors.rig; if (!R) return JSON.stringify({ error: 'no rig' }); g.god = false; g.p.maxHp = g.p.hp = 5000;
  const { spawnEnemy } = await import('/src/sim/enemies.js'); const bones = []; R.root.traverse(o => { if (o.isBone && /(spine|chest|shoulder|arm|forearm|hand|neck|head)/i.test(o.name) && !/finger|thumb|index|middle|ring|pinky/i.test(o.name)) bones.push(o); });
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); const prev = new Map(), deltas = [], names = []; let frames = 0, t0 = performance.now(), last = t0, yaw = 0, nextHit = 0;
  await new Promise(res => { const step = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; yaw += dt * 1.1; D.input.yaw = yaw; if (now > nextHit) { nextHit = now + 700; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28; spawnEnemy(g, 'husk', { x: g.p.x + Math.cos(a) * 3, z: g.p.z + Math.sin(a) * 3 }); } }
    let worst = 0, wn = ''; for (const o of bones) { const q = o.quaternion, p = prev.get(o); if (p) { const dot = Math.min(1, Math.abs(p.x * q.x + p.y * q.y + p.z * q.z + p.w * q.w)); const ang = 2 * Math.acos(dot) * 57.2958; if (ang > worst) { worst = ang; wn = o.name; } } prev.set(o, q.clone()); } if (frames > 5) { deltas.push(worst); names.push(wn + ' [' + (R._ovList || []).map(x => x.a.getClip().name.slice(0, 6)).join(',') + '|' + (R.cur || '') + ' tw' + (D.actors._tw || 0).toFixed(2) + ' gr' + (g.p.grounded ? 1 : 0) + ' sl' + (g.p.sliding ? 1 : 0) + ' dash' + (g.p.dashT > 0 ? 1 : 0) + ' hold' + (R.holdUntil && performance.now() < R.holdUntil ? 1 : 0) + ' lvl' + g.level + ']'); } frames++;
    if (now - t0 < 10000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); const s = deltas.slice().sort((a, b) => a - b); const med = a => { const c = a.slice().sort((x, y) => x - y); return c[Math.floor(c.length / 2)]; }; const big = deltas.map((d, i) => [d, names[i], i]).filter(x => { const i = x[2], w = deltas.slice(Math.max(0, i - 4), i + 5); return x[0] > 20 && x[0] > 2.5 * med(w); });       // a pop: a one-frame turn over 20 degrees and over 2.5 times the median of its neighbours
  return JSON.stringify({ frames, hurts: g.hitsTaken, max: +s[s.length - 1].toFixed(1), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1), pops: big.length, sample: big.slice(0, 6).map(x => x[1] + ' ' + x[0].toFixed(0) + ' deg at frame ' + x[2]) }); })()`));
console.log(label, JSON.stringify(r)); console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
