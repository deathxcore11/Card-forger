import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// CHOOSE A MAP with locked difficulties (a fresh save) and with Easy cleared, at 915x412, 412x915 and 1840x1000. node test/browser-map-screen.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
for (const [W, H] of [[915, 412], [412, 915], [1840, 1000]]) {
  const b = await launch({ out, query: '?debug' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(3500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  const go = async () => { await b.evalIn(`(()=>{ const f = t => Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim().toUpperCase().startsWith(t)); const p = f('PLAY'); if (p) p.click(); return 1; })()`); await wait(700); await b.evalIn(`(()=>{ const n = document.getElementById('selNext'); if (n) n.click(); return 1; })()`); await wait(900); };
  await go(); let r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, 'fresh-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64'));
  console.log(W + 'x' + H, await b.evalIn(`JSON.stringify(Array.from(document.querySelectorAll('.diffRow')).map(r => r.className + ' disabled=' + r.querySelector('input').disabled + ' w=' + Math.round(r.getBoundingClientRect().right) + '/' + Math.round(r.closest('.panel').getBoundingClientRect().right)))`));
  b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
