// Contact sheets of the big desert from the game camera: for each seed, the opening view, then a ride along three lines (the wonder, the school beams, the nearest pocket line).
// Pictures go to <outdir> (never into the repo): one sheet per screen size.   node tools/contact.mjs <outdir> [seeds=12]
import { launch, wait } from '../test/cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [out, nArg] = process.argv.slice(2), N = +nArg || 12, SEEDS = Array.from({ length: N }, (_, i) => 101 + i * 977);
for (const [W, H] of [[412, 915], [915, 412]]) {
  const b = await launch({ out, query: '?debug&play=1&seed=' + SEEDS[0] }); const names = [];
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H });
  for (const seed of SEEDS) {
    await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=' + seed }); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
    await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; const h = document.getElementById('rideHint'); if (h) h.style.visibility = 'hidden'; return 1; })()`);
    const tag = W + 'x' + H + '-' + seed; await b.shot('c-' + tag + '-0'); names.push('c-' + tag + '-0');
    for (const [k, which] of [[1, 'wonder'], [2, 'school'], [3, 'pocket']]) {
      const ok = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, W = g.map.world, { streamTo, heightAt } = await import('/src/sim/terrain.js'); let L = null;
        if ('${which}' === 'wonder' && W.wonder) L = W.wonder.beams; else if ('${which}' === 'school') L = W.school; else { const sp = W.spawn; let best = null, bd = 1e9; for (let qz = -1; qz <= 1; qz++) for (let qx = -1; qx <= 1; qx++) { const cx = Math.floor(sp.x / 256) + qx, cz = Math.floor(sp.z / 256) + qz, lg = g.map.dressCell(cx, cz).logs.filter(q => q[7] === 3); if (lg.length >= 2) { const d = Math.hypot(lg[0][0] - sp.x, lg[0][2] - sp.z); if (d < bd && !W.school.some(s => Math.abs(s[0] - lg[0][0]) < 0.1)) { bd = d; best = lg.map(q => [q[0], q[2], q[3], q[5]]); } } } L = best; }
        if (!L || !L.length) return 0; const s = L[0], ux = s[2] - s[0], uz = s[3] - s[1], l = Math.hypot(ux, uz) || 1; D.freeze(true); streamTo(s[0], s[1], 60, 4);
        g.p.ride = undefined; g.p.x = s[0] - ux / l * 14; g.p.z = s[1] - uz / l * 14; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.vx = ux / l * 15; g.p.vz = uz / l * 15; D.input.yaw = Math.atan2(-ux / l, -uz / l);
        for (let i = 0; i < 70; i++) { D.drive(1 / 60, { f: 1, yaw: D.input.yaw }); await new Promise(r => requestAnimationFrame(r)); } return 1; })()`);
      if (ok) { await b.shot('c-' + tag + '-' + k); names.push('c-' + tag + '-' + k); }
    }
    const errs = await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,3))'); if (errs !== '[]') console.log(seed, 'errors', errs);
  }
  // the sheet: 4 pictures a seed in a row, a third of the size
  const tw = Math.round(W / 3), th = Math.round(H / 3), cols = 4 * (W < H ? 2 : 1);
  let h = '<body style="margin:0;background:#15121a;display:flex;flex-wrap:wrap;width:' + (cols * tw) + 'px;font:10px monospace;color:#ffe08a">';
  for (const n of names) h += '<div style="position:relative;width:' + tw + 'px;height:' + th + 'px"><img src="' + n + '.png" style="width:' + tw + 'px;height:' + th + 'px"><span style="position:absolute;left:2px;top:2px;background:#000a">' + n.slice(2) + '</span></div>';
  writeFileSync(join(out, 'sheet-' + W + 'x' + H + '.html'), h);
  const rows = Math.ceil(names.length / cols); await b.send('Emulation.setDeviceMetricsOverride', { width: cols * tw, height: rows * th, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url: 'file:///' + join(out, 'sheet-' + W + 'x' + H + '.html').split(String.fromCharCode(92)).join('/') }); await wait(2500); await b.shot('sheet-' + W + 'x' + H);
  console.log(W + 'x' + H, names.length, 'pictures'); b.close(); await wait(500);
}
setTimeout(() => process.exit(0), 300);
