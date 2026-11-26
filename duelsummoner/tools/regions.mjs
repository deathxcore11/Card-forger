// Region contact sheet: for each seed, the opening view and one view in each region type (the nearest ground of that type to the start), from the game camera.
// Pictures go to <outdir>, never into the repo.   node tools/regions.mjs <outdir> [seeds=12] [width=915] [height=412]
import { launch, wait } from '../test/cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [out, nArg, wArg, hArg] = process.argv.slice(2), N = +nArg || 12, W = +wArg || 915, H = +hArg || 412, SEEDS = process.env.SEEDS ? process.env.SEEDS.split(',').map(Number) : Array.from({ length: N }, (_, i) => 101 + i * 977);
const NAMES = ['Dune Sea', 'Mesa Field', 'Dry Lake', 'Canyon Run', 'Ruin Field', 'Dead Forest', 'Ridge Spine'];
const b = await launch({ out, query: '?debug&play=1&seed=' + SEEDS[0] }); const shots = [];
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H });
for (const seed of SEEDS) {
  await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=' + seed }); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; const h = document.getElementById('rideHint'); if (h) h.style.visibility = 'hidden'; for (const id of ['devbar']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } return 1; })()`);
  await b.shot(`r-${seed}-start`); shots.push([`r-${seed}-start`, seed + ' start']);
  for (let T = 0; T < 7; T++) {
    const ok = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, m = g.map, sp = m.world.spawn, { streamTo, heightAt } = await import('/src/sim/terrain.js'); let at = null;
      for (let R = 300; R < 9000 && !at; R += 150) for (let a = 0; a < 6.28 && !at; a += 0.25) { const x = sp.x + Math.cos(a) * R, z = sp.z + Math.sin(a) * R; const A = m.regionAt(x, z); if (A.type === ${T} && Math.hypot(x - A.cx, z - A.cz) < 500 && (${T} !== 3 || m.world.valleyAt(x, z) > 0.8)) { at = [x, z, A.cx, A.cz]; if (${T} === 3) { let bd = -1; for (let k = 0; k < 16; k++) { const b2 = k * Math.PI / 8, q = m.world.valleyAt(x + Math.cos(b2) * 40, z + Math.sin(b2) * 40); if (q > bd) { bd = q; at[2] = x + Math.cos(b2) * 40; at[3] = z + Math.sin(b2) * 40; } } } } }
      if (!at) return 0; D.freeze(true); streamTo(at[0], at[1], 120, 6); g.p.ride = undefined; g.p.x = at[0]; g.p.z = at[1]; g.p.y = heightAt(at[0], at[1]); g.p.vx = 0; g.p.vz = 0; const dx = at[2] - at[0], dz = at[3] - at[1]; D.input.yaw = Math.atan2(-dx, -dz); D.input.pitch = 0;
      for (let i = 0; i < 12; i++) { D.drive(1 / 60, { f: 0, yaw: D.input.yaw }); await new Promise(r => requestAnimationFrame(r)); } D.freeze(false); await new Promise(r => setTimeout(r, 1600)); D.freeze(true); return 1; })()`);
    if (ok) { await b.shot(`r-${seed}-${T}`); shots.push([`r-${seed}-${T}`, seed + ' ' + NAMES[T]]); await b.evalIn('(async()=>{ __ds.freeze(false); await new Promise(r => setTimeout(r, 1200)); __ds.freeze(true); return 1; })()'); await b.shot(`r-${seed}-${T}b`); shots.push([`r-${seed}-${T}b`, seed + ' ' + NAMES[T] + ' again']); }       // every spot twice in a row, so a leftover from the last spot shows
  }
  const errs = await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,3))'); if (errs !== '[]') console.log(seed, 'errors', errs);
}
const tw = Math.round(W / 3), th = Math.round(H / 3), cols = 8;
let h = '<body style="margin:0;background:#15121a;display:flex;flex-wrap:wrap;width:' + (cols * tw) + 'px;font:10px monospace;color:#ffe08a">';
for (const [n, label] of shots) h += '<div style="position:relative;width:' + tw + 'px;height:' + th + 'px"><img src="' + n + '.png" style="width:' + tw + 'px;height:' + th + 'px"><span style="position:absolute;left:2px;top:2px;background:#000a">' + label + '</span></div>';
writeFileSync(join(out, 'regions.html'), h);
await b.send('Emulation.setDeviceMetricsOverride', { width: cols * tw, height: Math.ceil(shots.length / cols) * th, deviceScaleFactor: 1, mobile: false });
await b.send('Page.navigate', { url: 'file:///' + join(out, 'regions.html').split(String.fromCharCode(92)).join('/') }); await wait(3000); await b.shot('regions-sheet');
console.log(shots.length, 'pictures'); setTimeout(() => process.exit(0), 300);
