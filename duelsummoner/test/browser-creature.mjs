// Creature contact sheet: the wyvern rig, classified and posed through each clip at five moments, from the front and the side.
import { launch, wait } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
const url = process.env.CREATURE || 'assets/models/mon-ember-wyvern-f1-rig.glb';
const info = await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 800)); D.freeze(true); D.game.god = true; for (const e of document.querySelectorAll('.hud, #tc')) e.style.display = 'none'; if (D.actors.rig) D.actors.rig.group.visible = false; D.actors.player.visible = false;
  const R = await import('/src/view/rig.js'), C = await import('/src/view/creature.js'); const buf = await (await fetch(${JSON.stringify(url)})).arrayBuffer(); const built = await R.buildRig(buf, { creature: true });
  const parts = C.classifyCreature(built.root); const clips = C.creatureClips(built, parts); const rig = new C.CreatureRig(built, parts, clips, { height: 2.6 }); const p = D.game.p; rig.group.position.set(p.x, p.y + 1.2, p.z); D.scene.add(rig.group); window.__c = rig;
  const F = parts.axes.F; window.__cam = (k) => { const f = F, r = parts.axes.R; const d = k === 'front' ? [f.x, f.z] : k === 'side' ? [r.x, r.z] : [f.x * 0.7 + r.x * 0.7, f.z * 0.7 + r.z * 0.7]; D.camHold = { x: p.x + d[0] * 5.5, y: p.y + 2.4, z: p.z + d[1] * 5.5, lx: p.x, ly: p.y + 1.7, lz: p.z }; };
  window.__cam('front'); return JSON.stringify({ count: parts.count, F: F.toArray().map(v => +v.toFixed(2)), has: { head: !!parts.head, top: parts.top.name, hips: parts.hips.name, chest: parts.chest.name }, clips: [...clips.keys()] }); })()`);
console.log(info);
const names = process.argv[3] ? process.argv[3].split(',') : JSON.parse(info).clips; const views = (process.env.VIEWS || 'front,side').split(','); const cells = [];
for (const name of names) for (const view of views) {
  await b.evalIn(`window.__cam(${JSON.stringify(view)}); 1`); const dur = await b.evalIn(`__c.clips.get(${JSON.stringify(name)}).duration`);
  for (let i = 0; i < 5; i++) { await b.evalIn(`(()=>{ const r = __c; r.mixer.stopAllAction(); const a = r.mixer.clipAction(r.clips.get(${JSON.stringify(name)})); a.reset(); a.play(); r.mixer.setTime(${dur * i / 4 * 0.999}); return 1; })()`); await wait(70);
    const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 330, y: 40, width: 600, height: 420, scale: 0.4 } }); cells.push({ label: name + ' ' + view, i, data: r.result.data }); }
}
await b.evalIn(`window.__cells = ${JSON.stringify(cells.map(c => c.data))}; 1`);
const labels = []; for (let i = 0; i < cells.length; i += 5) labels.push(cells[i].label);
const png = await b.evalIn(`(async()=>{ const W = 240, H = 168, per = 5, rows = ${labels.length}; const c = document.createElement('canvas'); c.width = W * per; c.height = (H + 14) * rows; const x = c.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.font = '12px monospace'; const L = ${JSON.stringify(labels)};
  for (let r = 0; r < rows; r++) { x.fillText(L[r], 4, r * (H + 14) + 11); for (let i = 0; i < per; i++) { const img = new Image(); img.src = 'data:image/png;base64,' + __cells[r * per + i]; await new Promise(res => img.onload = res); x.drawImage(img, i * W, r * (H + 14) + 14, W, H); } } return c.toDataURL('image/png').split(',')[1]; })()`);
const out = join(process.argv[2] || '.', 'creature-sheet.png'); writeFileSync(out, Buffer.from(png, 'base64')); console.log('wrote', out, labels.length, 'rows'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
