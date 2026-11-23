import { launch, wait } from './cdp.mjs';
// Tag ray test: stand at many spots near chests; a tag whose anchor has a wall, trunk or boulder on the camera line is hidden, an open one is shown.
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const R = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, { heightAt } = await import('/src/sim/terrain.js'); let blocked = 0, open = 0, shownWhileBlocked = 0, hiddenWhileOpen = 0, example = null;
  for (const c of g.world.cchests) { for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = c.x + Math.cos(a) * 12, z = c.z + Math.sin(a) * 12; if (heightAt(x, z) > 50) continue; p.x = x; p.z = z; p.y = Math.max(0, heightAt(x, z)); p.vx = p.vz = 0; D.input.yaw = Math.atan2(-(c.x - x), -(c.z - z)) + Math.PI;
      for (let f = 0; f < 3; f++) await new Promise(r => requestAnimationFrame(r)); const t = { x: c.x, y: c.y + 1.9, z: c.z }, bl = D.tagBlocked(t); const els = [...document.querySelectorAll('#tags .wtag')].filter(e => e.style.display === 'block' && /Chest/.test(e.textContent)); const near = els.length;
      if (bl) { blocked++; } else open++; if (bl && !example) example = [x, z, c.x, c.z]; } }
  return JSON.stringify({ blocked, open, example }); })()`));
console.log(JSON.stringify(R));
if (R.example) { await b.evalIn(`(async()=>{ const D = __ds, p = D.game.p, [x, z, cx, cz] = ${JSON.stringify(R.example)}; p.x = x; p.z = z; D.input.yaw = Math.atan2(-(cx - x), -(cz - z)) + Math.PI; await new Promise(r => setTimeout(r, 700)); return 1; })()`); await b.shot('tags_blocked'); }
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
