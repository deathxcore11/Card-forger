import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// The play HUD at phone sizes, nothing hidden: one picture per size after 6 s of play on the open desert.
//   node test/browser-hud-shot.mjs <outdir> [WxH,WxH,...] [query]
const [out, sizes = '412x915,390x844', q = '&terrain=open&arch=a&seed=1'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
for (const sz of sizes.split(',')) { const [W, H] = sz.split('x').map(Number);
  const b = await launch({ out, query: '?debug&play=1' + q }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true }); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 6000)); window.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [] })); await new Promise(r => setTimeout(r, 500)); return 1; })()`);
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(out, 'hud-' + sz + '.jpg'), Buffer.from(r.result.data, 'base64'));
  console.log(sz, await b.evalIn(`JSON.stringify(['#clock', '#hpbar', '#hp', '#zones', '#boss', '.tcb:nth-child(2)', '#minimap', '#topright'].map(s => { const e = document.querySelector(s); if (!e) return s + ' none'; const r = e.getBoundingClientRect(); return s + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','); }))`));
  b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
