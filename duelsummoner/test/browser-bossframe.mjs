import { launch, wait } from './cdp.mjs';
// Boss framing: an 18 m gate boss 14 m ahead; the camera zoom, its distance and height, and the duelist's pixel count once the zoom has settled, on open ground.
const b = await launch({ out: 'x', query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; const p = g.p, G = g.map.spawn; p.x = G.x; p.z = G.z; p.y = 0; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; const { heightAt } = await import('/src/sim/terrain.js'); const sp = { alive: true, dead: false, role: 'gate', kind: 'pharaoh', size: 18, k: 1, kr: 1, radius: 5, x: p.x, y: 0, z: p.z - 14, hp: 1e9, maxHp: 1e9, face: 0, px: p.x, pz: p.z - 14, py: 0, st: 0, stT: 0, cd: 99, atk: 9, flash: 0, vy: 0 }; D.input.yaw = 0; g.sp.push(sp);
  for (let f = 0; f < 240; f++) await new Promise(r => requestAnimationFrame(r)); const cp = D.chase.pos; const px = D.duelistPixels(); return JSON.stringify({ zoom: +D.chase.zoom.toFixed(2), camDist: +Math.hypot(cp.x - p.x, cp.z - p.z).toFixed(2), camY: +cp.y.toFixed(2), duelistAlone: px.alone, duelistVisible: px.visible }); })()`));
b.close(); setTimeout(() => process.exit(0), 300);
