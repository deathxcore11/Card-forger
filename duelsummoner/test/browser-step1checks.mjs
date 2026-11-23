// Spectacle step 1, checks 3 and 5. Check 3: for each occluder kind, put it beside the duelist and orbit a camera round the duelist in 120 steps of 3 degrees (10 m out, 3.5 m up);
// the duelist's visible pixels must be 60% or more of unoccluded on every step. Check 5: the keep of every tree and boulder between two frames of a 60 s walk with shake, from the shader's own formula.
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=' + (process.argv[3] || 1) });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; D.game.opts.offers = false; return 1; })()`);
const kinds = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, m = g.map, W = g.world, sc = D.scene.children.find(c => c.userData && c.userData.scatter).userData.scatter, { heightAt } = await import('/src/sim/terrain.js'); const out = {};
  const prim = f => { const p = m.prims.find(f); return p ? { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, y: heightAt((p.x0 + p.x1) / 2 + 12, (p.z0 + p.z1) / 2) } : null; };
  const lone = (list, minD) => list.find(t => heightAt(t[0], t[2]) < 0.05 && list.every(o => o === t || Math.hypot(o[0] - t[0], o[2] - t[2]) > minD));
  const tr = lone(sc.trees[0], 14); if (tr) { out.canopy = { x: tr[0], z: tr[2], y: tr[1], d: 5.5, cy: 16, r: 8 }; out.trunk = { x: tr[0], z: tr[2], y: tr[1], d: 3.2 }; }
  const rocks = [].concat(sc.rocks[0], sc.rocks[1], sc.rocks[2]).sort((a, b) => b[3] - a[3]); const rk = rocks.find(t => heightAt(t[0], t[2]) < 0.05); if (rk) out.boulder = { x: rk[0], z: rk[2], y: rk[1], d: 3.5 + rk[3] };
  const pil = prim(q => q.t === 'cyl' && !q.deco && q.h >= 5 && q.h <= 7); if (pil) out.pillar = { ...pil, d: 4.5 };
  const wall = prim(q => q.t === 'box' && !q.deco && q.h >= 6 && q.h <= 8); if (wall) out.wall = { ...wall, d: 7 };
  const cliff = prim(q => q.t === 'ring' && !q.deco && q.h >= 4); if (cliff) out.cliff = { ...cliff, d: 9 };
  const stat = prim(q => q.landmark && q.h >= 18 && q.h <= 25 && q.deco); if (stat) out.statue = { ...stat, d: 6 };
  if (W.stones[0]) out.stone = { x: W.stones[0].x, z: W.stones[0].z, y: W.stones[0].y, d: 3 };
  if (W.broker) out.broker = { x: W.broker.x, z: W.broker.z, y: W.broker.y, d: 4 };
  const ch = W.cchests.find(c => c.y < 0.1); if (ch) out.chest = { x: ch.x, z: ch.z, y: ch.y, d: 2.6 };
  return JSON.stringify(out); })()`);
const K = JSON.parse(kinds); let fails = 0;
for (const [name, o] of Object.entries(K)) {
  const r = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, O = ${JSON.stringify(o)}, { heightAt } = await import('/src/sim/terrain.js'); let ok = 0, worst = 101, worstA = 0, aloneMin = 1e9, n = 0;
    // the duelist stands d metres from the object (on the side with open ground), the camera circles the duelist
    let dx = 1, dz = 0; for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) { const x = O.x + ax * O.d, z = O.z + az * O.d, h = heightAt(x, z); if (h < 50 && Math.abs(h - O.y) < 0.8) { dx = ax; dz = az; break; } }
    p.x = O.x + dx * O.d; p.z = O.z + dz * O.d; p.y = Math.max(0, heightAt(p.x, p.z)); p.vx = p.vz = 0;
    for (let k = 0; k < 120; k++) { const a = k * 3 * Math.PI / 180, cx = p.x + Math.cos(a) * (O.r || 10), cz = p.z + Math.sin(a) * (O.r || 10), cy = p.y + (O.cy || 3.5);
      D.camHold = { x: cx, y: cy, z: cz, lx: p.x, ly: p.y + 1, lz: p.z }; for (let f = 0; f < 3; f++) await new Promise(r => requestAnimationFrame(r)); const px = D.duelistPixels(); if (!px || px.alone < 30) continue; n++; const pct = px.visible / px.alone * 100; aloneMin = Math.min(aloneMin, px.alone); if (pct >= 60) ok++; if (pct < worst) { worst = pct; worstA = k * 3; } }
    D.camHold = null; return JSON.stringify({ steps: n, ok, worstPct: +worst.toFixed(1), worstAngle: worstA }); })()`));
  const pass = r.steps >= 100 && r.ok === r.steps; if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name.padEnd(8) + JSON.stringify(r) + (r.steps < 120 ? '  (steps where the duelist was fully off screen or under 30 px are skipped)' : ''));
}
// check 5: the keep of every tree (canopy and trunk) and boulder between two frames of a 60 s walk, the shader's formula in JS
const R5 = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, sc = D.scene.children.find(c => c.userData && c.userData.scatter).userData.scatter, V = D.see;
  const dsKeep = (k0, gap) => Math.floor((k0 + (1 - k0) * Math.min(1, Math.max(0, gap / 3))) * 8 + 0.5) / 8;
  const keepAt = (c, d, t) => { const px = c.x, py = c.y, pz = c.z, dx = d.x - px, dy = d.y - py, dz = d.z - pz; return [px, py, pz, dx, dy, dz]; };
  const items = []; sc.trees.forEach((list, v) => list.forEach(t => items.push({ k: 'tree', v, t }))); [].concat(sc.rocks[0], sc.rocks[1], sc.rocks[2]).forEach(t => items.push({ k: 'rock', t }));
  const keeps = it => { const cam = V.cam.value, du = V.duelist.value, d = { x: du.x - cam.x, y: du.y - cam.y, z: du.z - cam.z }, dd = d.x * d.x + d.y * d.y + d.z * d.z, s = it.t[3];
    const bc = it.k === 'tree' ? [it.t[0], it.t[1] + 7.5 * s, it.t[2]] : [it.t[0], it.t[1] + 0.5 * s, it.t[2]], br = (it.k === 'tree' ? (it.v < 2 ? 4.8 : 3.7) : 1.2) * s;
    const t = Math.min(0.92, Math.max(0, ((bc[0] - cam.x) * d.x + (bc[1] - cam.y) * d.y + (bc[2] - cam.z) * d.z) / dd)); const gap = Math.hypot(bc[0] - (cam.x + d.x * t), bc[1] - (cam.y + d.y * t), bc[2] - (cam.z + d.z * t)) - br - 0.9;
    const out = [dsKeep(0.25, gap)]; if (it.k === 'tree') { const b = it.t, tt = Math.min(0.92, Math.max(0, ((b[0] - cam.x) * d.x + (b[2] - cam.z) * d.z) / Math.max(d.x * d.x + d.z * d.z, 1e-4))), gapT = Math.hypot(b[0] - (cam.x + d.x * tt), b[2] - (cam.z + d.z * tt)) - (0.55 * s + 0.35) - 0.9, lineY = cam.y + d.y * tt, top = it.v < 2 ? 6.4 : 5.6, span = Math.min(1, Math.max(0, (b[1] + top * s - lineY) / 1.5)) * Math.min(1, Math.max(0, (lineY - (b[1] - 0.5)) / 1.5)); out.push(Math.floor((1 + (0.5 + 0.5 * Math.min(1, Math.max(0, gapT / 3)) - 1) * span) * 8 + 0.5) / 8); } return out; };
  const near = () => { const du = V.duelist.value; return items.filter(it => Math.hypot(it.t[0] - du.x, it.t[2] - du.z) < 40); };
  let prev = null, worst = 0, frames = 0, yaw = 0, maxCam = 0, lastCam = null, bigJumps = 0, popsWithoutJump = 0; D.input.keys.KeyW = true; const t0 = performance.now(); let lastY = performance.now();
  while (performance.now() - t0 < 60000) { await new Promise(r => requestAnimationFrame(r)); if (performance.now() - lastY > 400) { yaw += 0.4; D.input.yaw = yaw; lastY = performance.now(); } const cv = V.cam.value, camMove = lastCam ? Math.hypot(cv.x - lastCam[0], cv.y - lastCam[1], cv.z - lastCam[2]) : 0; lastCam = [cv.x, cv.y, cv.z]; maxCam = Math.max(maxCam, camMove); const list = near(), cur = new Map(); for (const it of list) cur.set(it, keeps(it)); let stepMax = 0;
    if (prev) for (const [it, k] of cur) { const p = prev.get(it); if (!p) continue; for (let j = 0; j < k.length; j++) stepMax = Math.max(stepMax, Math.abs(k[j] - p[j])); } worst = Math.max(worst, stepMax); if (stepMax > 0.126) { if (camMove > 0.6) bigJumps++; else popsWithoutJump++; } prev = cur; frames++; }
  D.input.keys.KeyW = false; return JSON.stringify({ frames, worstKeepStep: worst, maxCameraMoveBetweenFrames_m: +maxCam.toFixed(2), framesOverBarWithCameraJumpOver0_6m: bigJumps, framesOverBarWithSmoothCamera: popsWithoutJump }); })()`);
console.log('check 5 walk (60 s, shake on):', R5, JSON.parse(R5).worstKeepStep <= 0.126 ? 'PASS' : 'FAIL');
console.log('check 3 failing rows:', fails, JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
