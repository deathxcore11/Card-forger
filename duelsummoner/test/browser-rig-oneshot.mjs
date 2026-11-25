import { launch, wait } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
// One-shot check: running (or standing) with no throws and no hits, play each one-shot and report the biggest one-frame bone turn in the 1.5 s after it starts.
//   node test/browser-rig-oneshot.mjs <outdir> [run|stand]
const [out, mode = 'run'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2000);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4500)); return 1; })()`);
const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, R = D.actors.rig; g.god = true; const bones = []; R.root.traverse(o => { if (o.isBone && !/finger|thumb|index|middle|ring|pinky|toe/i.test(o.name)) bones.push(o); });
  if ('${mode}' === 'run') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); const out = {};
  for (const name of ['level_up', 'summon', 'open_chest', 'fusion', 'victory', 'tribute', 'cast_spell', 'taunt']) {
    await new Promise(r => setTimeout(r, 1200)); const prev = new Map(); let fr = 0, worst = 0, wn = '', wf = 0, wp = '', legW = 0, legPost = 0; const t0 = performance.now(); let started = false;
    await new Promise(res => { let lastMt = -1; const step = now => { if (R.mixer.time === lastMt) { if (now - t0 < 1500) requestAnimationFrame(step); else res(); return; } lastMt = R.mixer.time; if (!started) { R.once(name); started = true; }
      let w = 0, n = '', wl = 0; for (const o of bones) { const q = o.quaternion, p = prev.get(o); if (p) { const ang = 2 * Math.acos(Math.min(1, Math.abs(p.x * q.x + p.y * q.y + p.z * q.z + p.w * q.w))) * 57.2958; if (/Leg|Foot/.test(o.name) && ang > wl) wl = ang; if (ang > w) { w = ang; n = o.name; } } prev.set(o, q.clone()); }
      if (fr > 0 && w > worst) { worst = w; wn = n; wf = (now - t0) / 1000; } if (fr > 0 && wl > legW) legW = wl; if (fr > 0 && R.clips.get(name) && (now - t0) / 1000 > R.clips.get(name).duration && wl > legPost) legPost = wl; fr++; if (now - t0 < 1500) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    out[name] = 'legs in clip ' + legW.toFixed(0) + ', after the clip ends ' + legPost.toFixed(0) + ' | ' + worst.toFixed(0) + ' deg ' + wn + ' at ' + wf.toFixed(2) + 's of ' + (R.clips.get(name) ? R.clips.get(name).duration.toFixed(2) : 'none'); R.holdUntil = 0; }
  return JSON.stringify(out); })()`);
console.log(mode, r); console.log('errors', await b.evalIn('JSON.stringify(window.__errs.slice(0,3))'));
b.close(); setTimeout(() => process.exit(0), 300);
