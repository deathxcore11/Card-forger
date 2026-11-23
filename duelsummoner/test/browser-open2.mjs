import { launch, wait } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
// Pictures of the open desert preview (?terrain=open), HUD hidden, JPEG: straight top-down, bird's-eye, on foot at the spawn, on foot beside a block and shrine, on foot at the boundary line looking out, and a bird's-eye over the line looking at the land beyond.
//   node test/browser-open2.mjs <outdir> <prefix> <arch a-f> <seed> [WxH]
const [out, prefix, arch, seedArg, size] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 1;
mkdirSync(out, { recursive: true });
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=' + arch + '&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
const jpg = async name => { const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); writeFileSync(join(out, name + '.jpg'), Buffer.from(r.result.data, 'base64')); };
console.log('start', await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3000)); const g = D.game; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); await new Promise(r => setTimeout(r, 800)); const m = g.map; return JSON.stringify({ open: !!m.open, arch: m.arch, key: m.key, spawn: m.spawn, gate: m.gate, report: m.report, tris: 0 }); })()`));
await b.evalIn(`(()=>{ for (const el of document.querySelectorAll('body *')) { if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue; const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute') el.style.visibility = 'hidden'; } return 1; })()`);
const at = (x, z, yaw, w) => b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; p.x = ${x}; p.z = ${z}; p.y = (await import('/src/sim/terrain.js')).heightAt(p.x, p.z) + 0.1; p.vx = p.vz = 0; p.vy = 0; D.input.yaw = ${yaw}; D.camHold = null; await new Promise(r => setTimeout(r, ${w || 1700})); return p.y; })()`);
const info = JSON.parse(await b.evalIn(`JSON.stringify((()=>{ const g = __ds.game, m = g.map, e = m.encounters.filter(q => q.type === 'shrine')[0] || m.encounters[0], bl = m.blocks.slice().sort((a, c) => Math.hypot(a.cx - e.x, a.cz - e.z) - Math.hypot(c.cx - e.x, c.cz - e.z))[0]; return { sx: m.spawn.x, sz: m.spawn.z, gx: m.gate.x, gz: m.gate.z, ex: e.x, ez: e.z, bx: bl.cx, bz: bl.cz }; })())`));
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
await at(info.sx, info.sz, yawTo(info.sx, info.sz, info.gx, info.gz)); await jpg(prefix + '-spawn');
// beside the shrine, looking at its block
{ const dx = info.bx - info.ex, dz = info.bz - info.ez, d = Math.hypot(dx, dz) || 1, px = info.ex - dx / d * 6, pz = info.ez - dz / d * 6; await at(px, pz, yawTo(px, pz, info.bx, info.bz), 1900); await jpg(prefix + '-mid'); }
// on foot at the line, looking out: walk into it so the stop is the real one
{ await at(0, 150, Math.PI, 600); const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; const t0 = performance.now(); D.input.yaw = Math.PI; const keys = ['KeyW']; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); await new Promise(r => setTimeout(r, 4500)); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); return JSON.stringify({ x: p.x, z: p.z }); })()`); console.log('edge stop', r); await wait(700); await jpg(prefix + '-edge'); }
await b.evalIn(`(()=>{ const D = __ds, s = D.scene; if (s && s.fog) { s.fog.near = 5000; s.fog.far = 9000; } D.camHold = { x: 0, y: 235, z: 235, lx: 0, ly: 0, lz: 0 }; return 1; })()`); await wait(1800); await jpg(prefix + '-bird');
await b.evalIn(`(()=>{ __ds.camHold = { x: 0, y: 42, z: 150, lx: 0, ly: 0, lz: 285 }; return 1; })()`); await wait(1500); await jpg(prefix + '-beyond');
await b.evalIn(`(()=>{ __ds.camHold = { x: 0, y: 290, z: 0.5, lx: 0, ly: 0, lz: 0 }; return 1; })()`); await wait(1500); await jpg(prefix + '-top');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
