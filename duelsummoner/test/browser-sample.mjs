import { launch, wait } from './cdp.mjs';
// Game-camera pictures of the Sunken Court sample (?sample=1): at the spawn, halfway down the stair, in the Court with 150 enemies, at the foot of Gate Steps, and the 45 degree bird's-eye.
//   node test/browser-sample.mjs <outdir> <prefix> [WxH] [touch]
const [out, prefix, size, flags] = process.argv.slice(2), [W, H] = (size || '1280x720').split('x').map(Number), mob = flags === 'touch';
const b = await launch({ out, query: '?debug&play=1&sample=1&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: mob }); await wait(2500);
if (mob) await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
console.log('start', await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; g.field.monsters.fill(null); await new Promise(r => setTimeout(r, 800)); return JSON.stringify({ sample: !!g.map.sample, key: g.map.key, spawn: g.map.spawn, y: g.p.y, tris: D.mapMesh ? 0 : 0 }); })()`));
const at = (x, z, yaw, wait_) => b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; p.x = ${x}; p.z = ${z}; p.y = (await import('/src/sim/terrain.js')).heightAt(p.x, p.z) + 0.1; p.vx = p.vz = 0; p.vy = 0; D.input.yaw = ${yaw}; await new Promise(r => setTimeout(r, ${wait_ || 1500})); return p.y; })()`);
console.log('spawn y', await at(0.5, 94.5, 0)); await b.shot(prefix + '-spawn');
console.log('stair y', await at(0.5, 56, 0)); await b.shot(prefix + '-stair');
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'); g.god = true; g.spawnAcc = -1e9; let n = 0; for (let k = 0; k < 150; k++) { const a = k * 2.399, r = 8 + (k % 10) * 2.6, x = 14 + Math.cos(a) * r, z = 8 + Math.sin(a) * r; if (Math.abs(x) < 43 && Math.abs(z) < 43) { spawnEnemy(g, 'husk', { x, z }); const i = g.lastSlot; g.en.spd[i] = 0; g.en.hp[i] = 1e7; n++; } } return n; })()`);
console.log('court y', await at(14, 8, Math.atan2(14, 8), 1800)); await b.shot(prefix + '-court');
await b.evalIn(`(()=>{ const g = __ds.game; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return 1; })()`);
console.log('gate foot y', await at(0.5, -44, 0)); await b.shot(prefix + '-gatefoot');
console.log('ring y', await at(70, 134, 0)); await b.shot(prefix + '-ring');
console.log('court door y', await at(28, 18, Math.PI)); await b.shot(prefix + '-courtdoor');
await b.evalIn(`(()=>{ const D = __ds; const s = D.scene; if (s && s.fog) { s.fog.near = 5000; s.fog.far = 9000; } D.camHold = { x: 0, y: 250, z: 235, lx: 0, ly: 0, lz: 5 }; return 1; })()`); await wait(1500); await b.shot(prefix + '-bird');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
