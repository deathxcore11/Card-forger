import { launch, wait } from './cdp.mjs';
// The big desert's world and feel: a ruin field of half-sunk cards, a cracked dry lake, power-up halos, a landmark reached (banner and sparks), sand dust on a fast run.
//   node test/browser-world-feel.mjs <outdir> <seed> [WxH]
const [out, seedArg, size] = process.argv.slice(2), [W, H] = (size || '412x915').split('x').map(Number), seed = +seedArg || 4711;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const spots = JSON.parse(await b.evalIn(`(()=>{ const g = __ds.game, W = g.map.world, o = {}; for (let r = 200; r < 14000 && !(o.ruins && o.lake); r += 160) for (let a = 0; a < 6.28; a += 0.5) { const x = Math.cos(a) * r, z = Math.sin(a) * r, t = W.regionAt(x, z).type; const C = W.dressCell(Math.floor(x / 256), Math.floor(z / 256)); if (t === 4 && !o.ruins && C.cards.length > 4) o.ruins = [C.cards[0][0] + 9, C.cards[0][2] + 9]; if (t === 2 && !o.lake && C.cracks.length > 20) o.lake = [C.cracks[0][0] + 3, C.cracks[0][1] + 3]; }
  let best = null, bd = 1e9; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const l = W.landmark(i, j); if (l) { const d = Math.hypot(l.cx - g.p.x, l.cz - g.p.z); if (d < bd) { bd = d; best = l; } } } o.lm = [best.cx + Math.max(best.rx, best.rz) + 25, best.cz]; return JSON.stringify(o); })()`));
const tp = (x, z, yawTo) => b.evalIn(`(async()=>{ const D = __ds, g = D.game, { heightAt, streamTo } = await import('/src/sim/terrain.js'); g.p.x = ${x}; g.p.z = ${z}; streamTo(g.p.x, g.p.z, 80, 4); g.p.y = heightAt(g.p.x, g.p.z) + 0.2; g.p.vx = g.p.vz = 0; ${yawTo ? 'D.input.yaw = Math.atan2(-(' + yawTo[0] + ' - g.p.x), -(' + yawTo[1] + ' - g.p.z));' : ''} await new Promise(r => setTimeout(r, 1600)); return 1; })()`);
await tp(spots.ruins[0], spots.ruins[1], [spots.ruins[0] - 9, spots.ruins[1] - 9]); await b.shot('feel-ruins');
await tp(spots.lake[0], spots.lake[1]); await b.shot('feel-lake');
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { dropPickup } = await import('/src/sim/combat.js'); const p = g.p, yaw = D.input.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx; for (let k = 0; k < 5; k++) dropPickup(g, 6 + k, p.x + fx * 7 + rx * (k - 2) * 2, p.y, p.z + fz * 7 + rz * (k - 2) * 2, 1); for (let i = 0; i < g.pick.max; i++) if (g.pick.alive[i]) g.pick.age[i] = -1e6; return 1; })()`); await wait(700); await b.shot('feel-halos');
await tp(spots.lm[0], spots.lm[1], [spots.lm[0] - 30, spots.lm[1]]); await wait(300); await b.shot('feel-landmark');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,5))')));
b.close(); setTimeout(() => process.exit(0), 300);
