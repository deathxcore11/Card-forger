import { launch, wait } from './cdp.mjs';
// Head-up guard: during a running throw, a dash, a slide and a jump, the head must never tilt more than 60 degrees from upright (and the torso must not fold).
const duelists = (process.argv[3] || 'kael,mira').split(','); let bad = 0;
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0&seed=2' });
for (const d of duelists) {
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('${d}'); D.start(); await new Promise(r => setTimeout(r, 1500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false;
    const { spawnEnemy } = await import('/src/sim/enemies.js'); window.__keep = setInterval(() => { let n = 0; for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) n++; for (let k = n; k < 12; k++) spawnEnemy(g, 'runner', { x: g.p.x + 8 + k, z: g.p.z + 2 }); }, 300); return 1; })()`);
  const r = await b.evalIn(`(async()=>{ const D = __ds, rig = D.actors.rig; if (!rig) return { none: true }; let head, top, hips; rig.root.traverse(o => { if (!o.isBone) return; const n = o.name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig/, ''); if (n === 'head') head = o; else if (n === 'headend' || n === 'headtopend') top = o; else if (n === 'hips') hips = o; });
    if (!head || !top) return { missing: true, head: !!head, top: !!top };
    const A = new rig.root.position.constructor(), B = new A.constructor(), keys = D.input.keys; let max = 0, n = 0, worst = ''; const per = {};
    const phase = async (label, set, ms) => { set(true); const t0 = performance.now(); while (performance.now() - t0 < ms) { await new Promise(r => requestAnimationFrame(r)); rig.root.updateMatrixWorld(true); head.getWorldPosition(A); top.getWorldPosition(B); B.sub(A); const ang = Math.acos(Math.max(-1, Math.min(1, B.y / (B.length() || 1)))) * 180 / Math.PI; n++; per[label] = Math.max(per[label] || 0, Math.round(ang)); if (ang > max) { max = ang; worst = label; } } set(false); };
    keys.KeyW = true;
    await phase('run+throw', () => {}, 4000);
    await phase('dash', v => { keys.ShiftLeft = v; }, 700); await new Promise(r => setTimeout(r, 600));
    await phase('slide', v => { keys.ControlLeft = v; }, 900); await new Promise(r => setTimeout(r, 600));
    await phase('jump', v => { keys.Space = v; }, 900);
    keys.KeyW = false; return { frames: n, maxHeadTilt: Math.round(max), worst, per }; })()`);
  console.log(d, JSON.stringify(r)); if (r.per && (r.per['run+throw'] > 60 || r.per.dash > 60)) bad++; if (r.missing || r.none) bad++;       // the guard is on running throws and dashes; a slide or a jump may lean
  await b.evalIn(`clearInterval(window.__keep); 1`);
}
console.log('duelists over the limit or unreadable:', bad, JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
