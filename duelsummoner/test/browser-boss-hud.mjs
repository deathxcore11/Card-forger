import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Touch screens at 412x915 and 915x412: the boss card and bar just after the gate wakes, the boss-falls banner, then the seal banner (about 4 s after the kill). node test/browser-boss-hud.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
for (const [W, H] of [[412, 915], [915, 412]]) {
  const b = await launch({ out, query: '?play=1&terrain=open&arch=a&seed=1&debug' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true }); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); window.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [] })); const g = D.game; g.opts.offers = false; g.god = true; const T = await import('/src/sim/terrain.js'); g.p.x = g.map.gate.x + 1; g.p.z = g.map.gate.z; g.p.y = T.heightAt(g.p.x, g.p.z); D.drive(2.2, { use: true }); return 1; })()`);
  const shot = async n => { const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, n + '-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64')); };
  await wait(600); await shot('boss');
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, S = await import('/src/sim/specials.js'); const boss = g.sp.find(s => s.role === 'gate'); S.damageSpecial(g, boss, 1e9, g.p.x, g.p.z, { area: true }); D.drive(0.3, {}); return 1; })()`);
  await wait(900); await shot('falls'); await wait(3500); await shot('seal'); b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
