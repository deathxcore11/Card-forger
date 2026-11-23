import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const targets = await b.evalIn(`(()=>{ const g = __ds.game, P = g.map.prims, gt = g.map.gate; const py = P.find(p => p.t === 'box' && p.h === 24 && !p.deco && Math.abs((p.x0 + p.x1) / 2 - gt.x) < 20); const tr = g.colliders.list.find(c => c.top - c.y > 8 && c.r < 1.5); const rk = g.colliders.list.find(c => c.top - c.y >= 4.5 && c.r > 2.5); const ch = g.world.cchests[0];
  return JSON.stringify({ pylon: py ? [(py.x0 + py.x1) / 2, (py.z0 + py.z1) / 2, Math.max(py.x1 - py.x0, py.z1 - py.z0) / 2 + 1.5] : null, trunk: tr ? [tr.x, tr.z, tr.r + 1.5] : null, rock: rk ? [rk.x, rk.z, rk.r + 1.5] : null, chest: ch ? [ch.x, ch.z, 2.2] : null }); })()`);
const T = JSON.parse(targets), res = {};
for (const [name, c] of Object.entries(T)) { if (!c) { res[name] = 'none on this seed'; continue; }
  res[name] = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, { heightAt } = await import('./src/sim/terrain.js'); let frames = 0, inside = 0, hidden = 0, minD = 99;
    for (let a = 0; a < 360; a += 1.5) { const rad = ${c[2]} + 1.2, x = ${c[0]} + Math.cos(a * Math.PI / 180) * rad, z = ${c[1]} + Math.sin(a * Math.PI / 180) * rad; p.x = x; p.z = z; p.y = heightAt(x, z) < 50 ? heightAt(x, z) : 0; p.vx = p.vz = 0; p.grounded = true; D.input.yaw = Math.atan2(-(${c[0]} - x), -(${c[1]} - z)) + Math.PI; D.input.pitch = 0.1;
      await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r)); const cp = D.chase.pos; frames++; const ground = heightAt(cp.x, cp.z); if (ground > cp.y - 0.05 && ground < 50) inside++;
      for (const k of g.colliders.list) { const dx = cp.x - k.x, dz = cp.z - k.z; if (dx * dx + dz * dz < k.r * k.r && cp.y < k.top && cp.y > k.y - 0.5) { inside++; break; } }
      for (const q of [0.25, 0.5, 0.75]) { const x2 = cp.x + (p.x - cp.x) * q, y2 = cp.y + (p.y + 1 - cp.y) * q, z2 = cp.z + (p.z - cp.z) * q; if (heightAt(x2, z2) > y2) { hidden++; break; } } minD = Math.min(minD, Math.hypot(cp.x - p.x, cp.z - p.z)); }
    return JSON.stringify({ frames, cameraInsideSolid: inside, duelistBehindSolid: hidden, closestCameraM: +minD.toFixed(1) }); })()`); }
console.log(JSON.stringify(res, null, 1)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); await b.shot('camera_circle'); b.close(); setTimeout(() => process.exit(0), 300);
