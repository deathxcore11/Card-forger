import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// CHOOSE A MAP with the OATHS panel open: all sealed (a fresh save), then with Glass and Pace unsealed ("fresh"), at 915x412, 412x915, 1840x1000. node test/browser-oath-screen.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
for (const [W, H] of [[915, 412], [412, 915], [1840, 1000]]) {
  const b = await launch({ out, query: '?debug' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(3500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  const click = sel => b.evalIn(`(()=>{ const f = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim().toUpperCase().startsWith('${sel}') || x.id === '${sel}'); if (f) f.click(); return !!f; })()`);
  await click('PLAY'); await wait(600); await click('selNext'); await wait(700); await click('mapOaths'); await wait(700);
  let r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, 'sealed-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64'));
  await b.evalIn(`__ds.unseal(['glass', 'peace']); 1`); await click('oathDone'); await wait(400); await click('mapOaths'); await wait(500);
  r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, 'unsealed-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64'));
  console.log(W + 'x' + H, await b.evalIn(`JSON.stringify({ sealed: document.querySelectorAll('.oathRow.sealed').length, open: document.querySelectorAll('.oathRow:not(.sealed)').length, fresh: document.querySelectorAll('.oathRow.fresh').length })`));
  b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
