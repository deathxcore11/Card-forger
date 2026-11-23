import { launch, wait } from './cdp.mjs';
// On-foot pictures from the real game camera: at the spawn, in the middle of a room, at a passage looking through, and at the gate; also the 45 degree bird's-eye view of the whole map with fog off.
//   node test/browser-foot.mjs <outdir> <prefix> <stage1-3> <seed> [WxH] [touch]
const [out, prefix, stArg, seedArg, size, flags] = process.argv.slice(2), stage = (+stArg || 1) - 1, seed = +seedArg || 1, [W, H] = (size || '1600x900').split('x').map(Number), mob = flags === 'touch';
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mob }); await wait(2500);
if (mob) await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2000)); window.__S = await import('/src/sim/stages.js'); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.stage = ${stage}; __S.loadStageMap(g, ${stage}); for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); await new Promise(r => setTimeout(r, 2200)); return 1; })()`);
console.log('grass in the page:', await b.evalIn(`(async()=>{ const D = __ds, G = D.grass; if (!G) return 'no grass'; const H = (await import('/src/sim/terrain.js')).heightAt, T = await import('/src/gen/tufts.js'); const a = G.userData.baked; let worst = 0, bad = 0; for (let k = 0; k < a.length; k += 4) { worst = Math.max(worst, Math.abs(a[k + 1] - H(a[k], a[k + 2]))); if (T.tuftOk(H, a[k], a[k + 2]) === null) bad++; } return JSON.stringify({ tufts: a.length / 4, chunks: G.children.length, worstBaseOffset: +worst.toFixed(4), failingRule: bad, radius: G.userData.radius }); })()`));
const poses = JSON.parse(await b.evalIn(`(async()=>{ const g = __ds.game, m = g.map, road = (await import('/src/gen/road.js')).roadPath(m).main, P = f => road[Math.min(road.length - 1, Math.max(0, Math.floor(road.length * f)))], dir = (a, c) => Math.atan2(-(c[0] - a[0]), -(c[1] - a[1]));
  const sp = [m.spawn.x, m.spawn.z], gt = [m.gate.x, m.gate.z], rooms = (m.districts || []).filter(d => !d.gate && Math.hypot(d.cx - sp[0], d.cz - sp[1]) > 20), room = rooms.length ? [rooms[0].cx, rooms[0].cz] : P(0.5), pa = P(0.38);
  return JSON.stringify({ spawn: { x: sp[0], z: sp[1], yaw: dir(sp, P(0.1)) }, room: { x: room[0], z: room[1], yaw: dir(room, P(0.7)) }, passage: { x: pa[0], z: pa[1], yaw: dir(pa, P(0.46)) }, gate: { x: P(0.93)[0], z: P(0.93)[1], yaw: dir(P(0.93), gt) } }); })()`));
for (const k of ['spawn', 'room', 'passage', 'gate']) {
  const p = poses[k];
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; p.x = ${p.x}; p.z = ${p.z}; p.y = (await import('/src/sim/terrain.js')).heightAt(p.x, p.z) + 0.1; p.vx = p.vz = 0; p.vy = 0; D.input.yaw = ${p.yaw}; await new Promise(r => setTimeout(r, 1600)); return 1; })()`);
  await b.shot(prefix + '-' + k);
}
// bird's eye at 45 degrees, fog off
await b.evalIn(`(()=>{ const D = __ds; const s = D.scene; if (s && s.fog) { s.fog.near = 5000; s.fog.far = 9000; } D.camHold = { x: 0, y: 190, z: 175, lx: 0, ly: 0, lz: 10 }; return 1; })()`); await wait(1500); await b.shot(prefix + '-bird');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
