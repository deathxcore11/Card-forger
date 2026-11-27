// Strip-back proof pictures, from the real play camera: for each seed and screen size, the spawn and three park lines (on foot, then riding), one level-up offer,
// and a 10 s run down one whole line (a frame every 0.5 s). Pictures go to <outdir>, never into the repo.
//   node tools/stripshots.mjs <outdir> [seeds=21,77]
import { launch, wait } from '../test/cdp.mjs';
const [out, sArg] = process.argv.slice(2), SEEDS = (sArg || '21,77').split(',').map(Number), SIZES = [[1920, 1080], [412, 915]];
const b = await launch({ out, query: '?debug&play=1&seed=' + SEEDS[0] });
const go = async (seed, W, H) => {
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H });
  await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=' + seed }); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; g.rideKicks = 1; const e = document.getElementById('devbar'); if (e) e.style.visibility = 'hidden'; return 1; })()`);
};
// put the duelist 22 m behind the k-th line start nearest the spawn (a kicker with no piece 30 m behind it), facing down the line; riding or on foot
const place = (k, ride, back = 22) => b.evalIn(`(async()=>{ const D = __ds, g = D.game, sp = g.map.world.spawn, { streamTo, heightAt } = await import('/src/sim/terrain.js'), { kickersNear, railsNear } = await import('/src/sim/rails.js');
  const K = kickersNear(g, sp.x, sp.z, 700).filter(q => !kickersNear(g, q[0] - q[3] * 26, q[2] - q[4] * 26, 6).length && !railsNear(g, q[0] - q[3] * 26, q[2] - q[4] * 26, 4).some(s => s[6] === 'ledge' || s[6] === 'pole')).map(q => [Math.hypot(q[0] - sp.x, q[2] - sp.z), q]).sort((a, c) => a[0] - c[0]).map(a => a[1]);
  const q = K[${k}]; if (!q) return 0; const [x, , z, ux, uz, len] = q, px = x - ux * (len / 2 + ${back}), pz = z - uz * (len / 2 + ${back});
  D.freeze(true); streamTo(px, pz, 120, 6); g.p.ride = undefined; g.p.x = px; g.p.z = pz; g.p.y = heightAt(px, pz); g.p.vx = 0; g.p.vz = 0; g.p.grounded = true; D.input.yaw = Math.atan2(-ux, -uz); D.input.pitch = 0; D.input.keys.KeyW = !!${ride};       // the stick held forward while riding
  for (let i = 0; i < 12; i++) { D.drive(1 / 60, { f: 0, yaw: D.input.yaw }); await new Promise(r => requestAnimationFrame(r)); }
  if (${ride}) { D.drive(1 / 60, { f: 1, yaw: D.input.yaw }); Object.assign(g.p.ride, { on: true, heading: Math.atan2(ux, uz), speed: 15 }); if (!g.p.ride.combo) g.p.ride.combo = { pts: 0, names: {}, list: [] }; }
  D.freeze(false); await new Promise(r => setTimeout(r, ${ride ? 700 : 1500})); D.freeze(true); return 1; })()`);
const resume = () => b.evalIn('(()=>{ __ds.freeze(false); return 1; })()');
for (const seed of SEEDS) for (const [W, H] of SIZES) {
  const tag = seed + '-' + W + 'x' + H; await go(seed, W, H);
  await b.shot('spawn-' + tag);
  for (let k = 0; k < 3; k++) { if (await place(k, false)) await b.shot('line' + k + '-foot-' + tag); await resume(); if (await place(k, true)) await b.shot('line' + k + '-ride-' + tag); await resume(); }
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { openLevelOffer } = await import('/src/sim/field.js'); g.opts.offers = true; g.pendingLevels = (g.pendingLevels || 0) + 1; openLevelOffer(g); await new Promise(r => setTimeout(r, 1200)); return 1; })()`);
  await b.shot('levelup-' + tag);
  const errs = await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,3))'); if (errs !== '[]') console.log(tag, 'errors', errs);
}
// 10 s down one whole line: the opening line of the first seed, riding at 15 m/s from 22 m back, stick forward, a frame every 0.5 s
await go(SEEDS[0], 1920, 1080); await place(0, true, 26);
const log = [];
for (let f = 0; f < 20; f++) { await b.evalIn('(()=>{ __ds.freeze(false); return 1; })()'); await wait(500); await b.evalIn('(()=>{ __ds.freeze(true); return 1; })()'); await b.shot('lineride-' + String(f).padStart(2, '0'));
  log.push(await b.evalIn('(()=>{ const r = __ds.game.p.ride; return JSON.stringify({ t: ' + (f + 1) * 0.5 + ', on: !!(r && r.on), air: !__ds.game.p.grounded, grind: !!(r && r.grind), tricks: r && r.combo ? r.combo.list.join("+") : "" }); })()')); }
console.log(log.join('\n'));
setTimeout(() => process.exit(0), 300);
