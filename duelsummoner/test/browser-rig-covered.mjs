import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Kael inside a pile: 20 husks hugging him, the normal camera behind, pictures at 915x412 and 412x915, and the debug frame cost.
//   node test/browser-rig-covered.mjs <outdir> [label]
const [out, label = 'run'] = process.argv.slice(2); mkdirSync(out, { recursive: true }); const res = {};
for (const [W, H] of [[915, 412], [412, 915]]) {
  const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.p.hp = g.p.maxHp = 1e9; g.spawnAcc = -1e9; const { spawnEnemy } = await import('/src/sim/enemies.js'); for (let k = 0; k < 20; k++) { const a = k / 20 * 6.283, r = 1.5 + (k % 2) * 0.8; spawnEnemy(g, 'husk', { x: g.p.x + Math.cos(a) * r, z: g.p.z + Math.sin(a) * r }); } for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) g.en.hp[i] = 1e12; await new Promise(r => setTimeout(r, 1800)); return 1; })()`);
  const s = []; for (let i = 0; i < 8; i++) { await wait(400); const t = await b.evalIn(`(()=>{ const m = /sim ([0-9.]+) ms +view ([0-9.]+) ms/.exec(document.getElementById('debug').textContent); return m ? m[1] + ',' + m[2] : ''; })()`); if (t) s.push(+t.split(',')[1]); }
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 }); writeFileSync(join(out, label + '-' + W + 'x' + H + '.jpg'), Buffer.from(r.result.data, 'base64'));
  res[W + 'x' + H] = { view: +(s.reduce((a, c) => a + c, 0) / (s.length || 1)).toFixed(2) }; b.close(); await wait(300); }
console.log(label, JSON.stringify(res)); setTimeout(() => process.exit(0), 300);
