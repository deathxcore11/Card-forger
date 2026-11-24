import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// The results screen after a run that broke two seals (the seal cracks, the Oath text burns in). node test/browser-seal-results.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
for (const [W, H] of [[915, 412], [412, 915], [1840, 1000]]) {
  const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); D.game.opts.offers = false; D.game.sealT.cracked.push('pauper', 'blind'); D.game.endRun(); return 1; })()`); await wait(1050); console.log(await b.evalIn('JSON.stringify(window.__errs.slice(0, 3))'));
  const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, 'results-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64'));
  console.log(W + 'x' + H, await b.evalIn(`JSON.stringify({ seals: document.getElementById('dSeals').children.length, mode: document.body.dataset.mode })`)); b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
