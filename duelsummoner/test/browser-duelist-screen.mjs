import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// The CHOOSE YOUR DUELIST screen with Kael and with Mira picked, at 915x412 and 412x915 (and 1840x1000). node test/browser-duelist-screen.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
for (const [W, H] of [[915, 412], [412, 915], [1840, 1000]]) {
  const b = await launch({ out, query: '?debug' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(3500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(()=>{ const btn = Array.from(document.querySelectorAll('button')).find(x => /^PLAY$/.test(x.textContent.trim())); btn.click(); return 1; })()`); await wait(800);
  for (const who of ['kael', 'mira']) {
    await b.evalIn(`(()=>{ const t = document.querySelector('.portrait[data-d="${who}"]'); if (t) t.click(); return 1; })()`); await wait(1200);
    const info = await b.evalIn(`JSON.stringify({ tiles: Array.from(document.querySelectorAll('.portrait')).map(x => x.dataset.d + ':' + !!x.querySelector('.faceImg')), preview: !!document.getElementById('duelPreview') })`);
    const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, who + '-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64')); console.log(who, W + 'x' + H, info); }
  b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
