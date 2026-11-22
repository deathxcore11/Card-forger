// Contact sheet: every hand-made clip posed at five moments, front 3/4 view, stitched into one picture. Usage: node test/browser-clips.mjs [outDir] [clipNames comma list]
import { launch, wait } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
const DUEL = process.env.DUELIST || 'kael';
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('${DUEL}'); D.start(); await new Promise(r => setTimeout(r, 1000)); D.freeze(true); D.game.god = true; for (const e of document.querySelectorAll('.hud, #tc')) e.style.display = 'none'; const r = D.actors.rig; r.debugHold = true; const p = D.game.p; r.group.updateMatrixWorld(true); const f = r.forward(); window.__view = (side) => { const rx = f.z, rz = -f.x, k = side ? 1 : 0.55; D.camHold = { x: p.x + f.x * 3.4 * (side ? 0 : 1) + rx * 3.4 * k * (side ? 1 : 0.8), y: p.y + 1.2, z: p.z + f.z * 3.4 * (side ? 0 : 1) + rz * 3.4 * k * (side ? 1 : 0.8), lx: p.x, ly: p.y + 0.85, lz: p.z }; }; window.__view(false); return [...r.clips.keys()].length; })()`);
const names = (process.argv[3] ? process.argv[3].split(',') : await b.evalIn(`[...__ds.actors.rig.clips.keys()].filter(k => /^[a-z_]+$/.test(k))`));
const cells = [];
for (const name of names) {
  const dur = await b.evalIn(`__ds.actors.rig.clips.get(${JSON.stringify(name)}).duration`);
  for (let i = 0; i < 5; i++) {
    const t = dur * i / 4 * 0.999;
    await b.evalIn(`(()=>{ const r = __ds.actors.rig; r.mixer.stopAllAction(); const a = r.mixer.clipAction(r.clips.get(${JSON.stringify(name)})); a.reset(); a.play(); r.mixer.setTime(${t}); return 1; })()`);
    await wait(60);
    const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 360, y: 60, width: 340, height: 440, scale: 0.6 } });
    cells.push({ name, i, data: r.result.data });
  }
}
const sheet = await b.evalIn(`(async()=>{ const cells = ${JSON.stringify(cells.map(c => ({ name: c.name, i: c.i })))}; return 1; })()`);
// stitch in the page
await b.evalIn(`window.__cells = ${JSON.stringify(cells.map(c => c.data))}; 1`);
const png = await b.evalIn(`(async()=>{ const W = 204, H = 264, per = 5, rows = ${names.length}; const c = document.createElement('canvas'); c.width = W * per; c.height = (H + 16) * rows; const x = c.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.font = '12px monospace'; const names = ${JSON.stringify(names)};
  for (let r = 0; r < rows; r++) { x.fillText(names[r], 4, r * (H + 16) + 12); for (let i = 0; i < per; i++) { const img = new Image(); img.src = 'data:image/png;base64,' + __cells[r * per + i]; await new Promise(res => img.onload = res); x.drawImage(img, i * W, r * (H + 16) + 16, W, H); } }
  return c.toDataURL('image/png').split(',')[1]; })()`);
const out = join(process.argv[2] || '.', 'clip-sheet.png'); writeFileSync(out, Buffer.from(png, 'base64')); console.log('wrote', out, names.length, 'clips');
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);

