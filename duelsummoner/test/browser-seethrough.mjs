// Spectacle step 1 reports: (a) scenery buffer uploads over a 60 s walk (must be 0), (b) 4x screenshots of a faded pylon and a faded canopy, (c) which WebGL path the browser took.
import { launch, wait } from './cdp.mjs'; import { writeFileSync } from 'node:fs'; import { join } from 'node:path';
const out = process.argv[2], b = await launch({ out, query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; D.game.opts.offers = false; return 1; })()`);
const zoomShot = async (name, cx, cy, w = 240, h = 135) => { const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, cx - w / 2), y: Math.max(0, cy - h / 2), width: w, height: h, scale: 4 } }); writeFileSync(join(out, name + '.png'), Buffer.from(r.result.data, 'base64')); };
const duelistXY = () => b.evalIn(`(()=>{ const D = __ds, s = D.see.hole.value, c = document.getElementById('view'), r = c.getBoundingClientRect(), bw = c.width, bh = c.height; return JSON.stringify({ x: r.left + s.x / bw * r.width, y: r.top + (1 - s.y / bh) * r.height }); })()`);
// (b) a faded pylon: the worst angle of the circle, then a 4x crop round the duelist
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, gt = g.map.gate, py = g.map.prims.find(q => q.t === 'box' && q.h === 24 && !q.deco && Math.abs((q.x0 + q.x1) / 2 - gt.x) < 20), cx = (py.x0 + py.x1) / 2, cz = (py.z0 + py.z1) / 2, r0 = Math.max(py.x1 - py.x0, py.z1 - py.z0) / 2 + 2.7, a = 342, x = cx + Math.cos(a * Math.PI / 180) * r0, z = cz + Math.sin(a * Math.PI / 180) * r0;
  p.x = x; p.z = z; p.y = 0; p.vx = p.vz = 0; D.input.yaw = Math.atan2(-(cx - x), -(cz - z)) + Math.PI; D.input.pitch = 0.1; await new Promise(r => setTimeout(r, 900)); return 1; })()`);
await b.shot('seethrough_pylon_full'); { const d = JSON.parse(await duelistXY()); await zoomShot('seethrough_pylon_4x', d.x, d.y); }
// a faded canopy: put the duelist 5 m behind a tree seen from a fixed camera on the tree's far side
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, S = D.scene.children.find(c => c.userData && c.userData.scatter).userData.scatter, { heightAt } = await import('/src/sim/terrain.js');
  const t = S.trees[0].find(t => heightAt(t[0], t[2]) < 0.05 && g.colliders.list.every(c => c === null || Math.hypot(c.x - t[0], c.z - t[2]) > 6 || (c.x === t[0] && c.z === t[2])) ) || S.trees[0][5];
  const dir = [0, 1]; p.x = t[0] + dir[0] * 0; p.z = t[2] + 9; p.y = t[1]; p.vx = p.vz = 0; D.camHold = { x: t[0], y: t[1] + 6.5, z: t[2] - 3, lx: p.x, ly: p.y + 1, lz: p.z }; await new Promise(r => setTimeout(r, 900)); return 1; })()`);
await b.shot('seethrough_canopy_full'); { const d = JSON.parse(await duelistXY()); await zoomShot('seethrough_canopy_4x', d.x, d.y); }
await b.evalIn(`__ds.camHold = null; 1`);
// (a) upload count over a 60 s walk: the version of every scenery attribute and instance matrix at the start and the end, and every bufferSubData / bufferData call in between
const R = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, S = D.scene.children.find(c => c.userData && c.userData.scatter); const ver = () => { let n = 0; S.traverse(m => { if (m.geometry) for (const k in m.geometry.attributes) n += m.geometry.attributes[k].version; if (m.instanceMatrix) n += m.instanceMatrix.version; if (m.instanceColor) n += m.instanceColor.version; }); return n; };
  const gl = D.renderer.getContext(), P = gl.__proto__; let calls = 0; const o1 = P.bufferSubData, o2 = P.bufferData; P.bufferSubData = function (...a) { calls++; return o1.apply(this, a); }; P.bufferData = function (...a) { calls++; return o2.apply(this, a); };
  const v0 = ver(); D.input.keys.KeyW = true; const t0 = performance.now(); let yaw = 0; while (performance.now() - t0 < 60000) { await new Promise(r => setTimeout(r, 250)); yaw += 0.35; D.input.yaw = yaw; }
  D.input.keys.KeyW = false; P.bufferSubData = o1; P.bufferData = o2; return JSON.stringify({ sceneryVersionChange: ver() - v0, allBufferUploadCalls: calls, webgl2: D.renderer.capabilities.isWebGL2 }); })()`);
console.log(R); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
