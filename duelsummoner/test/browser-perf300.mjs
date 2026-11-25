import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Frame cost with 120 enemies on screen, and a mid-fight picture. The debug line "sim x ms view y ms" is sampled 12 times over 6 s; the picture is taken at 412x915 and 915x412.
//   node test/browser-hitfeel-perf.mjs <outdir> [label]
const [out, label = 'run'] = process.argv.slice(2), N = +process.argv[4] || 300; mkdirSync(out, { recursive: true }); const res = {};
for (const [W, H] of [[412, 915], [915, 412]]) {
  const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.god = true; g.opts.offers = false; g.offer = null; g.spawnAcc = -1e9; const { spawnEnemy } = await import('/src/sim/enemies.js'); const kinds = ['husk', 'scarab', 'bloat', 'bat', 'mummy']; for (let k = 0; k < ${N}; k++) { const a = k * 2.399, r = 5 + (k % 12) * 1.6; try { spawnEnemy(g, kinds[k % 3 === 0 ? 0 : k % 5 === 1 ? 1 : 0], { x: g.p.x + Math.cos(a) * r, z: g.p.z + Math.sin(a) * r }); } catch (e) {} } return 1; })()`);
  const s = []; for (let i = 0; i < 12; i++) { await wait(500); const t = await b.evalIn(`(()=>{ const m = /sim ([0-9.]+) ms +view ([0-9.]+) ms/.exec(document.getElementById('debug').textContent); return m ? m[1] + ',' + m[2] : ''; })()`); if (t) s.push(t.split(',').map(Number)); }
  const n = await b.evalIn('__ds.game.en ? Array.from(__ds.game.en.alive).reduce((a, c) => a + (c ? 1 : 0), 0) : -1');
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(out, label + '-' + W + 'x' + H + '.jpg'), Buffer.from(r.result.data, 'base64'));
  const avg = i => s.length ? +(s.reduce((a, c) => a + c[i], 0) / s.length).toFixed(2) : null; res[W + 'x' + H] = { enemies: n, sim: avg(0), view: avg(1), samples: s.length }; b.close(); await wait(300); }
console.log(label, JSON.stringify(res)); setTimeout(() => process.exit(0), 300);
