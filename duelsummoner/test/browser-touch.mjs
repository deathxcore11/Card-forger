// Real-touch check: sends real touch events (CDP Input.dispatchTouchEvent) to the stick, the jump and slide buttons, and a tap on a chest.
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true });
await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const touchEv = (type, pts) => b.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1 })) });
const R = {};
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
await touchEv('touchStart', [[420, 80]]); await wait(50); await touchEv('touchEnd', []); await wait(200);   // the first touch reveals the controls
await b.evalIn('window.__p0 = {x: __ds.game.p.x, z: __ds.game.p.z}; 1'); await touchEv('touchStart', [[300, 300]]); await wait(60); await touchEv('touchMove', [[300, 250]]); await wait(900);   // upward drag on the left: walk forward
R.moved = await b.evalIn('Math.round(Math.hypot(__ds.game.p.x - __p0.x, __ds.game.p.z - __p0.z) * 10) / 10');
await touchEv('touchEnd', []); await wait(300);
R.visible = await b.evalIn(`!document.getElementById('tc').classList.contains('off')`);
await b.shot('touch-hud');
const rect = await b.evalIn(`(()=>{ const r = n => { const e = document.querySelectorAll('#tc .tcb'); return null; }; return [...document.querySelectorAll('#tc .tcb')].map(e => { const q = e.getBoundingClientRect(); return [e.textContent, Math.round(q.x + q.width / 2), Math.round(q.y + q.height / 2), Math.round(q.width)]; }); })()`);
R.buttons = rect;
const at = n => { const r = rect.find(x => x[0] === n); return [r[1], r[2]]; };
await b.evalIn(`window.__zmax = 0; setInterval(() => { const p = __ds.game.p; window.__zmax = Math.max(window.__zmax, p.y); }, 16); window.__y0 = __ds.game.p.y; 1`);
await touchEv('touchStart', [at('JUMP')]); await wait(250); await touchEv('touchEnd', []); await wait(600);
R.jumpedBy = await b.evalIn(`Math.round((window.__zmax - window.__y0) * 100) / 100`);
await touchEv('touchStart', [[300, 300]]); await wait(60); await touchEv('touchMove', [[300, 240]]); await wait(500); await touchEv('touchStart', [[300, 240], at('SLIDE')]); await wait(250);
R.sliding = await b.evalIn(`!!(__ds.game.p.sliding || __ds.game.p.slide || __ds.game.p.slideT > 0)`); await touchEv('touchEnd', []);
// tap-to-use: put a chest in front of the camera, tap where it projects
const tap = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const p = g.p; g.coins = 9999; const c = g.chests[0] || (g.world.cchests || [])[0]; if (!c) return null; c.open = false; c.free = true; const yaw = D.input.yaw; c.x = p.x - Math.sin(yaw) * 2; c.z = p.z - Math.cos(yaw) * 2; c.y = p.y; await new Promise(r => setTimeout(r, 200)); const v = new (D.camera.position.constructor)(c.x, c.y + 1, c.z).project(D.camera); return [Math.round((v.x * .5 + .5) * innerWidth), Math.round((-v.y * .5 + .5) * innerHeight)]; })()`);
R.chestTap = tap;
if (tap) { await touchEv('touchEnd', []); await wait(200); await touchEv('touchStart', [tap]); await wait(60); await touchEv('touchEnd', []); await wait(700); R.promptDom = await b.evalIn("document.getElementById('prompt').textContent"); R.offerAfterTap = await b.evalIn(`__ds.game.offer ? __ds.game.offer.type : (__ds.mode())`); }
// far tap: chest 9 m away, the duelist should walk there and open it
const far = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; if (g.offer) { g.choose(0); D.setMode('play'); } g.coins = 9999; const c = g.chests[0] || (g.world.cchests || [])[0]; if (!c) return null; c.open = false; c.free = true; const p = g.p, yaw = D.input.yaw; c.x = p.x - Math.sin(yaw) * 9; c.z = p.z - Math.cos(yaw) * 9; c.y = p.y; await new Promise(r => setTimeout(r, 300)); const v = new (D.camera.position.constructor)(c.x, c.y + 1, c.z).project(D.camera); return [Math.round((v.x * .5 + .5) * innerWidth), Math.round((-v.y * .5 + .5) * innerHeight)]; })()`);
R.farTap = far;
if (far) { await touchEv('touchStart', [far]); await wait(60); await touchEv('touchEnd', []); await wait(4500); R.offerAfterFarTap = await b.evalIn(`__ds.game.offer ? __ds.game.offer.type : 'none'`); }
await b.shot('touch-after');
R.errors = await b.evalIn('window.__errs'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);




