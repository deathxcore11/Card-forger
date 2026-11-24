import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// The stage boss name card at a small landscape and a square fold, with the real HUD. node test/browser-open-card.mjs <outdir>
const [out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=a&seed=1' });
for (const [w, h] of [[915, 412], [900, 840]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(1500);
  for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; if (!D.game.openFlow) { D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); } const g = D.game; g.god = true; const gt = g.map.gate; g.p.x = gt.x + 1; g.p.z = gt.z; const { heightAt } = await import('/src/sim/terrain.js'); g.p.y = heightAt(g.p.x, g.p.z); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' })); await new Promise(r => setTimeout(r, 2200)); return 1; })()`).catch(e => console.log(String(e).slice(0, 200)));
  await wait(300); const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(out, 'card-' + w + 'x' + h + '.jpg'), Buffer.from(r.result.data, 'base64'));
  console.log(w + 'x' + h, await b.evalIn(`JSON.stringify({ card: document.getElementById('bosscard').textContent, on: document.getElementById('bosscard').classList.contains('on'), nameHidden: getComputedStyle(document.getElementById('bossname')).visibility, bar: document.getElementById('boss').getBoundingClientRect().top, cardBottom: document.getElementById('bosscard').getBoundingClientRect().bottom })`));
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
