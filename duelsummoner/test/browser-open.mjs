import { launch, wait } from './cdp.mjs';
// Pictures of the open terrain preview (?terrain=open), HUD hidden: straight top-down (fog off), 45 degree bird's-eye, at the spawn, on the highest reachable top, and with 300 enemies on open ground (with frame time).
//   node test/browser-open.mjs <outdir> <prefix> <arch a-f> <seed> [WxH] [extra: more]
const [out, prefix, arch, seedArg, size, more] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), seed = +seedArg || 1;
const b = await launch({ out, query: '?debug&play=1&terrain=open&arch=' + arch + '&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await wait(2500);
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
console.log('start', await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3000)); const g = D.game; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); await new Promise(r => setTimeout(r, 800)); const m = g.map; return JSON.stringify({ open: !!m.open, arch: m.arch, key: m.key, spawn: m.spawn, gate: m.gate, report: m.report, enc: m.encounters.map(e => e.type + '@' + Math.round(e.x) + ',' + Math.round(e.z) + ',y' + Math.round(e.y)).join(' ') }); })()`));
await b.evalIn(`(()=>{ for (const el of document.querySelectorAll('body *')) { if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue; const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute') el.style.visibility = 'hidden'; } return 1; })()`);
const at = (x, z, yaw, w) => b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; p.x = ${x}; p.z = ${z}; p.y = (await import('/src/sim/terrain.js')).heightAt(p.x, p.z) + 0.1; p.vx = p.vz = 0; p.vy = 0; D.input.yaw = ${yaw}; D.camHold = null; await new Promise(r => setTimeout(r, ${w || 1600})); return p.y; })()`);
const info = JSON.parse(await b.evalIn(`JSON.stringify((()=>{ const g = __ds.game, m = g.map, e = m.encounters.filter(q => q.type !== 'cchest' || !q.free).sort((a, c) => c.y - a.y)[0]; return { sx: m.spawn.x, sz: m.spawn.z, gx: m.gate.x, gz: m.gate.z, ex: e.x, ez: e.z }; })())`));
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
await at(info.sx, info.sz, yawTo(info.sx, info.sz, info.gx, info.gz)); await b.shot(prefix + '-spawn');
// the highest reachable top: stand on the highest reward and look across the map
await at(info.ex, info.ez, yawTo(info.ex, info.ez, 0, 0), 1800); await b.shot(prefix + '-summit');
await b.evalIn(`(()=>{ const D = __ds, s = D.scene; if (s && s.fog) { s.fog.near = 5000; s.fog.far = 9000; } D.camHold = { x: 0, y: 235, z: 235, lx: 0, ly: 0, lz: 0 }; return 1; })()`); await wait(1800); await b.shot(prefix + '-bird');
await b.evalIn(`(()=>{ __ds.camHold = { x: 0, y: 290, z: 0.5, lx: 0, ly: 0, lz: 0 }; return 1; })()`); await wait(1500); await b.shot(prefix + '-top');
if (more) {
  await at(info.sx, info.sz, yawTo(info.sx, info.sz, info.gx, info.gz), 800);
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), p = g.p; g.god = true; g.spawnAcc = -1e9; let n = 0; for (let k = 0; k < 300; k++) { const a = k * 2.399, r = 8 + (k % 15) * 2.4, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; spawnEnemy(g, 'husk', { x, z }); n++; } return n; })()`); await wait(2500);
  console.log('frames', await b.evalIn(`new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(JSON.stringify({ fps: +(n / 3).toFixed(1), msPerFrame: +(3000 / n).toFixed(2), enemies: __ds.game.en.alive.reduce((a, v) => a + (v ? 1 : 0), 0), simMs: __ds.prof ? 'see debug' : '' })); }; requestAnimationFrame(f); })`));
  await b.shot(prefix + '-horde');
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
