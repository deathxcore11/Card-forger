import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// The old stand-in duelist body must never draw while a rig is loaded: 10 s with 20 enemies on Kael and hits landing, the stand-in's visible flag and every child mesh are read on each frame. Exit code 1 on any visible frame. Also takes a mid-fight picture at 915x412.
//   node test/browser-rig-standin.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.p.hp = g.p.maxHp = 1e9; return 1; })()`);
const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, A = D.actors, P = A.player; if (!A.rig) return JSON.stringify({ error: 'no rig' }); let frames = 0, bad = 0, first = ''; const t0 = performance.now(); let last = 0;
  await new Promise(res => { const step = now => { if (now - last > 600) { last = now; D.fillSwarm(6); } let vis = P.visible; P.traverse(o => { if (o !== P && o.isMesh && o.visible && P.visible) vis = true; }); if (P.visible) { bad++; if (!first) first = 'frame ' + frames; } frames++; if (now - t0 < 10000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  return JSON.stringify({ frames, bad, first, hitsTaken: g.hitsTaken, enemies: g.enemyCount(), rigVisible: A.rig.group.visible }); })()`));
const shot = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); writeFileSync(join(out, 'midfight-915x412.jpg'), Buffer.from(shot.result.data, 'base64'));
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, e = g.en; for (let i = 0; i < e.max; i++) e.alive[i] = 0; g.spawnAcc = -1e9; const { spawnEnemy } = await import('/src/sim/enemies.js'); for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.3; if (Math.cos(a) < -0.2 && Math.sin(a) < 0.5) continue; spawnEnemy(g, 'husk', { x: g.p.x + Math.cos(a) * 3.2, z: g.p.z + Math.sin(a) * 3.2 }); } D.camHold = { x: g.p.x + 5.5, y: g.p.y + 3, z: g.p.z + 4, lx: g.p.x, ly: g.p.y + 1, lz: g.p.z }; await new Promise(r => setTimeout(r, 1300)); return 1; })()`);
const shot2 = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); writeFileSync(join(out, 'kael-clear-915x412.jpg'), Buffer.from(shot2.result.data, 'base64'));
console.log(JSON.stringify(r)); const ok = !r.error && r.bad === 0 && r.hitsTaken > 0 && r.rigVisible; console.log(ok ? 'PASS' : 'FAIL'); b.close(); setTimeout(() => process.exit(ok ? 0 : 1), 300);
