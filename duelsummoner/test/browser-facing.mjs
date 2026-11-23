import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
const r = await b.evalIn(`(async()=>{ const D = __ds, A = D.actors, k = D.input.keys; let maxStep = 0, last = null, maxTw = 0, throws = 0, lastCt = D.game.cardT, snaps = 0;
  const seq = ['KeyW','KeyD','KeyS','KeyA','KeyW']; 
  for (let q = 0; q < seq.length; q++) { for (const n of seq) k[n] = false; k[seq[q]] = true;
    for (let i = 0; i < 40; i++) { await new Promise(r => requestAnimationFrame(r)); const y = A.player.rotation.y; if (last !== null) { let d = y - last; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); maxStep = Math.max(maxStep, Math.abs(d)); } last = y; maxTw = Math.max(maxTw, Math.abs(A._tw || 0)); if (D.game.cardT > lastCt + 0.01) throws++; lastCt = D.game.cardT; } }
  for (const n of seq) k[n] = false; return JSON.stringify({ maxBodyStepRadPerFrame: +maxStep.toFixed(3), maxTwistDeg: +(maxTw * 57.3).toFixed(0), throws, enemies: D.game.en.alive.reduce((a, v) => a + v, 0) }); })()`);
console.log(r); await b.shot('facing'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
