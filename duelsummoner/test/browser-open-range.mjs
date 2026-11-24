import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// The far mountain range from the spawn in the four directions (fog left as it is). node test/browser-open-range.mjs <outdir> <prefix> <arch> <seed>
const [out, prefix, arch, seedArg] = process.argv.slice(2), seed = +seedArg || 1; mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=' + arch + '&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); D.game.god = true; return 1; })()`);
await b.evalIn(`(()=>{ for (const el of document.querySelectorAll('body *')) { if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue; const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute') el.style.visibility = 'hidden'; } return 1; })()`);
const sp = JSON.parse(await b.evalIn('JSON.stringify(__ds.game.map.spawn)')); const far = await b.evalIn('__ds.camera ? __ds.camera.far : -1');
console.log('camera far', far);
for (const [name, dx, dz] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
  await b.evalIn(`(()=>{ const D = __ds, y = (await0 => 0)(); return 1; })()`).catch(() => {});
  await b.evalIn(`(async()=>{ const D = __ds, { heightAt } = await import('/src/sim/terrain.js'), y = heightAt(${sp.x}, ${sp.z}) + 7; D.camHold = { x: ${sp.x}, y, z: ${sp.z}, lx: ${sp.x} + ${dx} * 400, ly: y + 8, lz: ${sp.z} + ${dz} * 400 }; await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(out, prefix + '-' + name + '.jpg'), Buffer.from(r.result.data, 'base64'));
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
