// Creature loop and cost check: the looping clips (idle, fly, walk) must close within 1 degree on every bone, and the cost of many creatures is measured.
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
console.log(await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 800));
  const C = await import('/src/view/creature.js'); const prep = await C.loadCreature('assets/models/mon-ember-wyvern-f1-rig.glb'); const out = { loops: {} };
  for (const name of ['idle', 'fly', 'walk']) { const c = prep.creatureClips.get(name); let worst = 0, bone = ''; for (const tr of c.tracks) { if (!tr.name.endsWith('.quaternion')) continue; const v = tr.values, n = v.length - 4, dot = Math.abs(v[0] * v[n] + v[1] * v[n + 1] + v[2] * v[n + 2] + v[3] * v[n + 3]), ang = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI; if (ang > worst) { worst = ang; bone = tr.name; } }
    const pos = c.tracks.find(t => t.name.endsWith('.position')); const dy = Math.abs(pos.values[1] - pos.values[pos.values.length - 2]); out.loops[name] = { maxGapDeg: +worst.toFixed(2), bone, rootGapM: +dy.toFixed(4) }; }
  const N = 30, rigs = []; const t0 = performance.now(); for (let i = 0; i < N; i++) rigs.push(C.makeCreature(prep, 0.9)); out.makeMsEach = +((performance.now() - t0) / N).toFixed(2);
  rigs.forEach((r, i) => { r.group.position.set(i * 0.5, 3, 0); D.scene.add(r.group); r.play('fly'); });
  const t1 = performance.now(); const M = 2000; for (let k = 0; k < M; k++) for (const r of rigs) r.update('fly', 1 / 60, null); out.updateMsPer30CreaturesPerFrame = +((performance.now() - t1) / M).toFixed(3);
  let frames = 0; const t2 = performance.now(); await new Promise(res => { const f = () => { frames++; for (const r of rigs) r.update('fly', 1 / 60, null); if (performance.now() - t2 > 2000) res(); else requestAnimationFrame(f); }; f(); }); out.fpsWith30Creatures = Math.round(frames / 2);
  return JSON.stringify(out); })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
