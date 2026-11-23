import { launch, wait } from './cdp.mjs';
const out = process.argv[2], R = [];
for (let run = 0; run < 3; run++) {
  const b = await launch({ out, query: '?debug' });
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
  const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, k = D.input.keys, col = g.colliders; const seed = g.seed;
    const hit = (x, y, z, margin) => { for (const c of col.list) { const dx = x - c.x, dz = z - c.z, rr = c.r + margin; if (dx * dx + dz * dz < rr * rr && y < c.top && y > c.y - 0.5) return true; } return false; };
    let frames = 0, hidden = 0, inside = 0, stuckSecs = 0, win = { t: performance.now(), x: g.p.x, z: g.p.z }, minGap = 9, distTot = 0, lx = g.p.x, lz = g.p.z, shotAt = 0;
    const t0 = performance.now(); k.KeyW = true;
    let tPlay = 0, last = performance.now();
    while (tPlay < 60000) { await new Promise(r => requestAnimationFrame(r)); const nowT = performance.now(), dtT = nowT - last; last = nowT; if (g.offer) { const bt = document.querySelector('#offerCards [data-pick]:not([disabled])'); if (bt) bt.click(); else { const l = document.querySelector('#offerBtns [data-act]'); if (l) l.click(); } continue; } tPlay += dtT; frames++; const p = g.p, cp = D.chase.pos, now = performance.now();
      if (Math.floor((now - t0) / 2000) !== Math.floor((now - t0 - 16) / 2000)) D.input.yaw += (Math.random() - 0.3) * 1.6;
      if (Math.floor((now - t0) / 3000) !== Math.floor((now - t0 - 16) / 3000)) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })), 80); }
      for (const q of [0.2, 0.4, 0.6, 0.8]) { if (hit(cp.x + (p.x - cp.x) * q, cp.y + (p.y + 1 - cp.y) * q, cp.z + (p.z - cp.z) * q, 0.0)) { hidden++; break; } }
      for (const c of col.list) { const dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue; const d = Math.hypot(dx, dz) - c.r; if (d < minGap && p.y < c.top - 0.15) minGap = d; if (d < 0.6 - 0.05 && p.y < c.top - 0.15) inside++; }
      distTot += Math.hypot(p.x - lx, p.z - lz); lx = p.x; lz = p.z;
      if (now - win.t >= 1000) { if (Math.hypot(p.x - win.x, p.z - win.z) < 1.5 && !g.offer) stuckSecs++; win = { t: now, x: p.x, z: p.z }; }
    }
    k.KeyW = false; return JSON.stringify({ seed, frames, hiddenFrames: hidden, insidePropFrames: inside, stuckSeconds: stuckSecs, closestGapToProp: +minGap.toFixed(2), metresWalked: Math.round(distTot), offer: !!g.offer }); })()`);
  R.push(JSON.parse(r)); await b.shot('walk_seed' + (run + 1)); R[run].errors = await b.evalIn('window.__errs.slice(0,2)'); b.close(); await wait(1500);
}
console.log(JSON.stringify(R, null, 1)); setTimeout(() => process.exit(0), 300);

