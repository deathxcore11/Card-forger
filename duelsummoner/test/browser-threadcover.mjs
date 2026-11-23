import { launch, wait } from './cdp.mjs';
// Ley Thread checks, standing 30 m from the Gate for 30 s, sampled at 10 Hz: screen coverage, widest ribbon in render pixels, the nearest visible thread to the camera,
// and whether a thread ever draws across the duelist.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; const G = g.map.gate;
  const clear = (x, z) => g.colliders.list.every(c => (c.x - x) ** 2 + (c.z - z) ** 2 > 15 * 15); let ang = 0; for (let k = 0; k < 40; k++) { const a = k * 0.157, x = G.x + Math.cos(a) * 30, z = G.z + Math.sin(a) * 30, ux0 = (G.x - x) / 30, uz0 = (G.z - z) / 30; if ([-7, 0, 8, 16].every(t => clear(x + ux0 * t, z + uz0 * t)) && Math.abs(window.__ds.game.map ? 0 : 0) === 0) { ang = a; break; } }
  g.p.x = G.x + Math.cos(ang) * 30; g.p.z = G.z + Math.sin(ang) * 30; g.p.vx = g.p.vz = 0; g.p.y = 0; D.input.yaw = Math.atan2(-(G.x - g.p.x), -(G.z - g.p.z)); const ux = (G.x - g.p.x) / 30, uz = (G.z - g.p.z) / 30; D.camHold = { x: g.p.x - ux * 7, y: 3.6, z: g.p.z - uz * 7, lx: g.p.x + ux * 22, ly: 1.2, lz: g.p.z + uz * 22 }; return 1; })()`);
let shots = 0;
const R = await b.evalIn(`(async()=>{ const D = __ds, cam = D.camera, W = innerWidth, H = innerHeight, V = new cam.position.constructor(), out = { frames: 0, maxCoverPct: 0, meanCoverPct: 0, maxWidthPx: 0, nearestM: 99, overHero: 0, tilt: 0 }; let sum = 0;
  const proj = (x, y, z) => { V.set(x, y, z); const d = V.distanceTo(cam.position); V.project(cam); return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * H, d, V.z]; };
  for (let f = 0; f < 300; f++) { await new Promise(r => setTimeout(r, 100)); const g = D.game; const hp = proj(g.p.x, g.p.y + 1, g.p.z); let cover = 0;
    for (const th of D.threads.list) { if (!th.alive || !th.mesh.visible) continue; const P = th.mesh.geometry.attributes.position, C = th.mesh.geometry.attributes.color; const SEG = 12;
      for (let s = 0; s < SEG - 1; s++) { const a = proj(P.getX(s * 2), P.getY(s * 2), P.getZ(s * 2)), b2 = proj(P.getX(s * 2 + 1), P.getY(s * 2 + 1), P.getZ(s * 2 + 1)), c = proj(P.getX(s * 2 + 2), P.getY(s * 2 + 2), P.getZ(s * 2 + 2)); const alpha = C.getW(s * 2);
        if (alpha < 0.02 || a[3] > 1 || a[3] < -1) continue; const w = Math.hypot(a[0] - b2[0], a[1] - b2[1]); out.maxWidthPx = Math.max(out.maxWidthPx, w); const len = Math.hypot(a[0] - c[0], a[1] - c[1]); cover += w * len; out.nearestM = Math.min(out.nearestM, a[2]);
        if (a[2] < hp[2] && Math.abs(a[0] - hp[0]) < 40 && a[1] > hp[1] - 80 && a[1] < hp[1] + 80) out.overHero++; } }
    const pct = cover / (W * H) * 100; sum += pct; out.maxCoverPct = Math.max(out.maxCoverPct, pct); out.frames++; }
  out.meanCoverPct = +(sum / out.frames).toFixed(3); out.maxCoverPct = +out.maxCoverPct.toFixed(3); out.maxWidthPx = +out.maxWidthPx.toFixed(1); out.nearestM = +out.nearestM.toFixed(1); return JSON.stringify(out); })()`);
console.log(R); await wait(200); await b.shot('threads_sand'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
