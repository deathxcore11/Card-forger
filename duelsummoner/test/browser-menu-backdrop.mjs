import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Menu backdrops: the main menu, the duelist screen, Choose a Map with the Oath panel open and Settings, at 1840x1000, 915x412 and 412x915; the frame cost on the menu. Optional env SEEDS="seed:arch,..." for the title only (to pick a seed).
//   node test/browser-menu-backdrop.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const seeds = process.env.SEEDS ? process.env.SEEDS.split(',') : [null];
for (const sd of seeds) for (const [W, H] of (process.env.SEEDS ? [[915, 412]] : [[1840, 1000], [915, 412], [412, 915]])) {
  const q = '?debug' + (sd ? '&menuseed=' + sd.split(':')[0] + '&menuarch=' + sd.split(':')[1] : ''); const b = await launch({ out, query: q }); await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(4500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  const shot = async n => { const r = await b.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, n + (sd ? '-' + sd.replace(':', '') : '') + '-' + W + 'x' + H + '.png'), Buffer.from(r.result.data, 'base64')); };
  const click = sel => b.evalIn(`(()=>{ const f = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim().toUpperCase().startsWith('${sel}') || x.id === '${sel}'); if (f) f.click(); return !!f; })()`);
  await shot('main'); if (!sd) { console.log(W + 'x' + H, 'open map:', await b.evalIn('__ds.game.map.open'), 'fps/view:', await b.evalIn(`document.getElementById('debug').textContent`));
    await click('PLAY'); await wait(800); await shot('duelist'); await click('selNext'); await wait(800); await shot('map'); await click('mapOaths'); await wait(600); await shot('oaths'); await click('mapBack'); await wait(500); await click('selBack'); await wait(500); await click('SETTINGS'); await wait(800); await shot('settings'); }
  b.close(); await wait(300); }
setTimeout(() => process.exit(0), 300);
