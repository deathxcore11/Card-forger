import { launch, wait } from './cdp.mjs';
// Card Riding picture strip: on the card, the crouch, the pop, a flip in the air, the landing slam with the Flow meter, and a grind with sparks and the balance bar. 412x915 and 915x412.
//   node test/browser-ride.mjs <outdir> <seed>
const [out, seedArg] = process.argv.slice(2), seed = +seedArg || 4711;
for (const [W, H] of [[412, 915], [915, 412]]) {
  const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2000);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; D.freeze(true); return 1; })()`);
  // a long gentle slope or flat run
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { heightAt, streamTo } = await import('/src/sim/terrain.js'); let best = null; for (let r = 20; r < 500 && !best; r += 6) for (let a = 0; a < 6.28 && !best; a += 0.4) { const x = g.p.x + Math.cos(a) * r, z = g.p.z + Math.sin(a) * r, h = heightAt(x, z); let ok = h < 50; for (let k = 2; k <= 40 && ok; k += 2) { const hh = heightAt(x, z - k); if (hh > h - k * 0.02 + 0.3 || hh < h - k * 0.25) ok = false; } if (ok) best = [x, z]; }
    if (!best) best = [g.p.x, g.p.z]; g.p.x = best[0]; g.p.z = best[1]; streamTo(g.p.x, g.p.z, 60, 4); g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.vx = 0; g.p.vz = 0; g.p.vy = 0; D.input.yaw = 0;
    for (let i = 0; i < 6; i++) (await import('/src/sim/enemies.js')).spawnEnemy(g, 'husk', { x: g.p.x + (i - 3) * 1.5, z: g.p.z - 22 }); return 1; })()`);
  const act = (cmd, n) => b.evalIn(`(async()=>{ const D = __ds; for (let i = 0; i < ${n}; i++) { D.drive(1 / 60, Object.assign({ f: 1, yaw: 0 }, ${JSON.stringify(cmd)})); await new Promise(r => requestAnimationFrame(r)); } return 1; })()`);
  await act({}, 40); await act({ slide: true }, 4); await act({}, 30);       // run, then SLIDE kicks the card out on the flat
  console.log(W + 'x' + H, 'riding', await b.evalIn('__ds.game.p.ride && __ds.game.p.ride.on ? 1 : 0')); await b.shot(`ride-1-card-${W}x${H}`);
  await act({ jump: true }, 24); await b.shot(`ride-2-crouch-${W}x${H}`);
  await act({}, 7); await b.shot(`ride-3-pop-${W}x${H}`);
  await act({ dash: true }, 1); await act({}, 11); await b.shot(`ride-4-flip-${W}x${H}`);
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game; for (let i = 0; i < 160 && !g.p.grounded; i++) { D.drive(1 / 60, { f: 1, yaw: 0 }); await new Promise(r => requestAnimationFrame(r)); } for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r)); return 1; })()`); await b.shot(`ride-5-slam-${W}x${H}`);
  // a grind: put the card just above a beam or card edge near here, moving along it
  const ok = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { railsNear } = await import('/src/sim/rails.js'), { heightAt, streamTo } = await import('/src/sim/terrain.js'); let s = null; for (let r = 0; r < 1500 && !s; r += 50) { const L = railsNear(g, g.p.x + r, g.p.z, 60); s = L.find(q => Math.hypot(q[3] - q[0], q[5] - q[2]) > 6 && Math.abs(q[4] - q[1]) < 1 && q[1] - heightAt(q[0], q[2]) < 4); }
    if (!s) return 0; const L = Math.hypot(s[3] - s[0], s[5] - s[2]), ux = (s[3] - s[0]) / L, uz = (s[5] - s[2]) / L; streamTo(s[0], s[2], 60, 4); g.p.x = s[0] + ux * 0.8; g.p.z = s[2] + uz * 0.8; g.p.y = s[1] + 0.6; g.p.vx = ux * 12; g.p.vz = uz * 12; g.p.vy = -1; g.p.grounded = false; g.p.ride.on = true; g.p.ride.speed = 12; g.p.ride.heading = Math.atan2(ux, uz); D.input.yaw = Math.atan2(-ux, -uz);
    for (let i = 0; i < 18; i++) { D.drive(1 / 60, { f: 0, yaw: D.input.yaw, use: i === 0 }); await new Promise(r => requestAnimationFrame(r)); } return g.p.ride.grind ? 1 : 0; })()`);
  console.log(W + 'x' + H, 'grind', ok); await b.shot(`ride-6-grind-${W}x${H}`);
  // a seal line: start before the first stone of a set, ride along the line, the stones light one by one
  const sl = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { sealsNear, sealSet } = await import('/src/sim/rails.js'), { heightAt, streamTo } = await import('/src/sim/terrain.js'); let S = null; for (let r = 0; r < 3000 && !S; r += 60) for (const a of [0, 1.57, 3.14, 4.71]) { const L = sealsNear(g, g.p.x + Math.cos(a) * r, g.p.z + Math.sin(a) * r, 90); if (L.length) { S = sealSet(g, L[0][3]); break; } }
    if (!S) return 0; const s0 = [(S[0][0] + S[1][0]) / 2, 0, (S[0][2] + S[1][2]) / 2], s4 = [(S[3][0] + S[4][0]) / 2, 0, (S[3][2] + S[4][2]) / 2], dx = s4[0] - s0[0], dz = s4[2] - s0[2], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l; streamTo(s0[0], s0[2], 60, 4); g.p.ride = undefined; g.p.x = s0[0] - ux * 8; g.p.z = s0[2] - uz * 8; g.p.y = heightAt(g.p.x, g.p.z); g.p.grounded = true; g.p.vx = ux * 14; g.p.vz = uz * 14; D.input.yaw = Math.atan2(-ux, -uz);
    let lit = 0; for (let i = 0; i < 200; i++) { const ax = (g.p.ride && g.p.ride.on) ? 0 : 0; const tx = s4[0] + ux * 6 - g.p.x, tz = s4[2] + uz * 6 - g.p.z, yy = D.input.yaw, f = -(Math.sin(yy) * tx + Math.cos(yy) * tz), rr = -(Math.cos(yy) * tx - Math.sin(yy) * tz) * -1, m = Math.hypot(f, rr) || 1; D.drive(1 / 60, { f: f / m, r: rr / m, yaw: yy }); await new Promise(r => requestAnimationFrame(r)); if (i === 40) window.__mid = 1; } const Lt = g.rideLit; return JSON.stringify({ stones: S.length, sets: Lt ? Object.keys(Lt.sealsDone).length : 0, chests: g.world.cchests.length }); })()`);
  console.log(W + 'x' + H, 'seal line', sl); await b.shot(`ride-7-seals-${W}x${H}`);
  console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
  b.close(); await wait(400);
}
setTimeout(() => process.exit(0), 300);
