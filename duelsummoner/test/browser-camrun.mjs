import { launch, wait } from './cdp.mjs';
// Spectacle check 4: a 60 s autorun along the terraces and cliffs with shake on: frames with the camera inside ground or a wall, the largest height change and camera move between two frames, the largest pitch change.
const b = await launch({ out: process.argv[2], query: '?debug&seed=' + (process.argv[3] || 1) });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, cam = D.camera, g = D.game, { heightAt } = await import('/src/sim/terrain.js'); let inside = 0, frames = 0, maxDy = 0, maxMove = 0, maxPitch = 0, last = null, lastPitch = null, yaw = 0, jumpsOver = 0;
  D.input.keys.KeyW = true; const t0 = performance.now(); let lastTurn = t0; const dir = new cam.position.constructor();
  while (performance.now() - t0 < 60000) { await new Promise(r => requestAnimationFrame(r)); yaw += 0.012; D.input.yaw = Math.sin(yaw * 0.6) * 2.2; if (Math.random() < 0.03) D.fx.shake(0.5);
    const p = D.chase.pos, h = heightAt(p.x, p.z); if (h > p.y - 0.05 && h < 50) inside++;       // the unshaken eye
    cam.getWorldDirection(dir); const pitch = Math.asin(dir.y) * 180 / Math.PI; if (last) { const dy = Math.abs(p.y - last.y), mv = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z); maxDy = Math.max(maxDy, dy); maxMove = Math.max(maxMove, mv); if (dy > 0.1) { jumpsOver++; const q = g.p; if (dy > 1) window.__jump = { dbg: JSON.stringify(D.chase.dbg), dy, plMove: Math.hypot(q.x - (window.__lq || q).x, q.z - (window.__lq || q).z), plDy: q.y - (window.__lq || q).y }; } maxPitch = Math.max(maxPitch, Math.abs(pitch - lastPitch)); } window.__lq = { x: g.p.x, y: g.p.y, z: g.p.z }; last = { x: p.x, y: p.y, z: p.z }; lastPitch = pitch; frames++; }
  D.input.keys.KeyW = false; return JSON.stringify({ frames, framesCameraInsideGround: inside, maxHeightChangePerFrame_m: +maxDy.toFixed(2), framesOver0_10m: jumpsOver, maxCameraMovePerFrame_m: +maxMove.toFixed(2), maxPitchChangePerFrame_deg: +maxPitch.toFixed(2), bigJump: window.__jump || null }); })()`));
b.close(); setTimeout(() => process.exit(0), 300);
