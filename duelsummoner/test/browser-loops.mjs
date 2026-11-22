// Loop check: for every clip that loops, the first and last pose of every bone must match within 1 degree (no pop at the loop point).
import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 800)); return 1; })()`);
const res = await b.evalIn(`(()=>{ const r = __ds.actors.rig, out = {}; for (const name of ['shrine_channel', 'Idle', 'Running', 'Walking', 'Fall1']) { const c = r.clips.get(name); if (!c) { out[name] = 'missing'; continue; } let worst = 0, bone = ''; for (const tr of c.tracks) { if (!tr.name.endsWith('.quaternion')) continue; const v = tr.values, n = v.length - 4; const dot = Math.abs(v[0] * v[n] + v[1] * v[n + 1] + v[2] * v[n + 2] + v[3] * v[n + 3]); const ang = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI; if (ang > worst) { worst = ang; bone = tr.name; } } out[name] = { maxGapDeg: +worst.toFixed(2), bone, seconds: +c.duration.toFixed(2) }; } return JSON.stringify(out); })()`);
console.log(res); b.close(); setTimeout(() => process.exit(0), 300);
