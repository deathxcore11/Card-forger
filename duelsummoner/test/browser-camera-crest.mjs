import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
// Chase camera over dune crests: the player runs a line over 3 crests (found on the map: sample points along a path where the ground rises then falls behind the runner); every animation frame the camera's distance to Kael is logged, with the largest drop per 0.25 s and the closest. Pictures every 0.25 s around the worst moment at 915x412.
//   node test/browser-camera-crest.mjs <outdir> [label]
const [out, label = 'run'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&seed=3&arch=a' }); await b.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.opts.offers = false; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return 1; })()`);
if (process.env.OLD) await b.evalIn('window.__camOld = true; 1');
await b.evalIn(`window.__go = (async()=>{ const D = __ds, g = D.game, T = await import('/src/sim/terrain.js'), cam = D.camera; const heightAt = T.heightAt;
  // a straight line from the spawn region: pick the heading with the most crests (ground height rising by 2 m or more then falling again within 40 m) in the next 200 m
  let best = null; for (let a = 0; a < 36; a++) { const yaw = a / 36 * Math.PI * 2, dx = Math.sin(yaw), dz = Math.cos(yaw); let crests = 0, prev = heightAt(g.p.x, g.p.z), up = 0, last = 0; for (let d = 4; d <= 200; d += 4) { const h = heightAt(g.p.x + dx * d, g.p.z + dz * d); if (h > prev) up += h - prev; else if (up > 1.5 && h < prev - 0.2) { crests++; up = 0; } else if (h < prev) up = Math.max(0, up - (prev - h)); prev = h; } if (!best || crests > best.crests) best = { yaw, crests }; }
  D.input.yaw = best.yaw + Math.PI; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); const log = [], t0 = performance.now(); let lastKey = '';
  await new Promise(res => { const st = now => { const key = cam.position.x + ',' + cam.position.z + ',' + cam.position.y; if (key !== lastKey) { lastKey = key; const p = g.p; log.push([+((now - t0) / 1000).toFixed(3), +Math.hypot(cam.position.x - p.x, cam.position.y - (p.y + 1), cam.position.z - p.z).toFixed(2), +p.y.toFixed(1)]); } if (now - t0 < 9000) requestAnimationFrame(st); else res(); }; requestAnimationFrame(st); });
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); window.__res = JSON.stringify({ crests: best.crests, log }); return 1; })(); 1`);
for (let k = 0; k < 36; k++) { await wait(250); if (k >= 12) { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(out, label + '-f' + String(k).padStart(2, '0') + '.jpg'), Buffer.from(r.result.data, 'base64')); } }
let resS = ''; for (let i = 0; i < 40 && !resS; i++) { resS = await b.evalIn('window.__res || ""'); if (!resS) await wait(250); }
const res = JSON.parse(resS);
const L = res.log, dists = L.map(x => x[1]), med = dists.slice().sort((a, c) => a - c)[Math.floor(dists.length / 2)], mn = Math.min(...dists); let maxDrop = 0, wi = 0; for (let i = 0; i < L.length; i++) { const w = L.filter(x => x[0] >= L[i][0] && x[0] <= L[i][0] + 0.25); if (w.length > 1) { const d = Math.max(...w.map(x => x[1])) - Math.min(...w.map(x => x[1])); if (d > maxDrop) { maxDrop = d; wi = i; } } }
console.log(label, JSON.stringify({ crests: res.crests, samples: L.length, medianDist: med, closest: mn, closestPct: +(mn / med * 100).toFixed(0), maxChangeIn250ms: +maxDrop.toFixed(2), at: L[wi][0] }));
writeFileSync(join(out, label + '-camlog.json'), JSON.stringify(L)); b.close(); setTimeout(() => process.exit(0), 300);
