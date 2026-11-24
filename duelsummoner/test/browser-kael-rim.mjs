import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Kael has no white rim: the title screen (camp), play with no enemies, and play in a pile of 20 husks, at 915x412 and 412x915, cropped around him at 2x.
//   node test/browser-kael-rim.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const shot = async (b, name, clip) => { const r = await b.send('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 2 }, clip) } : {})); writeFileSync(join(out, name + '.png'), Buffer.from(r.result.data, 'base64')); };
for (const [W, H] of [[915, 412], [412, 915]]) {
  let b = await launch({ out, query: '?debug' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(3500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await shot(b, 'title-' + W + 'x' + H); b.close(); await wait(300);
  b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 4000)); const g = D.game; g.opts.offers = false; g.p.hp = g.p.maxHp = 1e9; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; await new Promise(r => setTimeout(r, 600)); return 1; })()`);
  const box = JSON.parse(await b.evalIn(`(()=>{ const D = __ds, p = D.game.p, c = D.camera, v = new c.position.constructor(p.x, p.y + 0.9, p.z).project(c); return JSON.stringify({ x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }); })()`));
  const clip = { x: Math.max(0, box.x - 70), y: Math.max(0, box.y - 70), width: 140, height: 140 };
  await shot(b, 'alone-' + W + 'x' + H, clip);
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const { spawnEnemy } = await import('/src/sim/enemies.js'); for (let k = 0; k < 20; k++) { const a = k / 20 * 6.283, r = 1.5 + (k % 2) * 0.8; spawnEnemy(g, 'husk', { x: g.p.x + Math.cos(a) * r, z: g.p.z + Math.sin(a) * r }); } for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) g.en.hp[i] = 1e12; await new Promise(r => setTimeout(r, 1800)); return 1; })()`);
  await shot(b, 'pile-' + W + 'x' + H, clip); b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
