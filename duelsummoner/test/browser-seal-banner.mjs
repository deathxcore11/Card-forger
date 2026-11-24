import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// The real boss-kill path: walk to the gate, wake it by holding use, fell the stage boss, then a picture every 0.5 s for 7 s: the "A seal cracks..." banner must show after the boss-falls banner. node test/browser-seal-banner.mjs <outdir> [WxH]
const [out, size = '915x412'] = process.argv.slice(2), [W, H] = size.split('x').map(Number); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
console.log(await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.opts.offers = false; g.god = true; const T = await import('/src/sim/terrain.js'), S = await import('/src/sim/specials.js');
  g.p.x = g.map.gate.x + 1; g.p.z = g.map.gate.z; g.p.y = T.heightAt(g.p.x, g.p.z); D.drive(2.2, { use: true }); const boss = g.sp.find(s => s.role === 'gate'); if (!boss) return 'no boss, gate ' + g.gate.state;
  await new Promise(r => setTimeout(r, 1500)); S.damageSpecial(g, boss, 1e9, g.p.x, g.p.z, { area: true }); D.drive(0.3, {}); return 'boss felled, cracked ' + JSON.stringify(g.sealT.cracked); })()`));
for (let k = 0; k < 14; k++) { const t = await b.evalIn(`document.getElementById('banner').classList.contains('on') ? document.getElementById('banner').textContent : ''`); const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, 'banner-' + String(k).padStart(2, '0') + '.png'), Buffer.from(r.result.data, 'base64')); console.log(k, JSON.stringify(t)); await wait(500); }
b.close(); setTimeout(() => process.exit(0), 300);
