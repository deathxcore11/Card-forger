// Real-browser check: launches Chrome (GPU on), plays the game with real keyboard events through the real
// render loop, and prints what it measured. Usage: node test/browser-check.mjs [outDir]
// Needs Chrome at the default Windows path (or set CHROME). Starts its own static server on port 8766.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.argv[2] || join(tmpdir(), 'ds-shots');
mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, ['serve.mjs'], { cwd: root, env: { ...process.env, PORT: '8766' }, stdio: 'ignore' });
const uncapped = process.argv.includes('--uncapped');
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=9333', '--window-size=1280,720', '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'ds-chrome-')),
  '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  ...(uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : []), 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
process.on('exit', cleanup);

let ws, id = 0; const pending = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
      const tab = tabs.find(t => t.type === 'page');
      if (tab) { ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); break; }
    } catch {}
    await wait(200);
  }
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
}
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
async function evalIn(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
  return r.result.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, name + '.png'), Buffer.from(r.result.data, 'base64'));
}

await connect();
await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__errs=[];window.addEventListener("error",e=>__errs.push(String(e.message)));const ce=console.error;console.error=function(){__errs.push([].join.call(arguments," "));ce.apply(console,arguments)}' });
await send('Page.navigate', { url: 'http://127.0.0.1:8766/?debug' });
for (let i = 0; i < 50 && !(await evalIn('!!window.__ds')); i++) await wait(200);

const H = `
const D = window.__ds, g = D.game, I = D.input, wait = ms => new Promise(r => setTimeout(r, ms));
const key = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c }));
const fresh = keep => { D.start(); g.god = true; g.spawnAcc = -1e9; g.en.alive.fill(0); g.p.x = 0; g.p.z = 0; if (!keep) { g.field.monsters.fill(null); g.cardT = 1e9; } };
const place = (x, y, z) => { g.p.x = x; g.p.y = y; g.p.z = z; g.p.vx = g.p.vz = g.p.vy = 0; g.p.grounded = true; };
`;
const results = {};
const run = async (name, body, shots) => { try { results[name] = await evalIn('(async()=>{' + H + body + '})()'); } catch (e) { results[name] = { ERROR: String(e.message).slice(0, 300) }; console.log('scenario failed:', name, String(e.message).slice(0, 200)); } };
const errors = [];

// 1. frame rate with 300 enemies while running
await run('fps_300_enemies', `
  fresh(true); D.fillSwarm(300); g.god = true; I.yaw = 0.8; key('KeyW', true); await wait(1500);
  D.perfReset(); await wait(8000); const p = D.perfRead(); key('KeyW', false);
  return { liveEnemies: g.enemyCount(), frames: p.frames, seconds: +(p.ms / 1000).toFixed(2), fps: +(p.frames * 1000 / p.ms).toFixed(1), worstFrameMs: +p.worstFrameMs.toFixed(1), kills: g.kills,
    simMsPerTick: (()=>{const t=performance.now(); for(let i=0;i<120;i++) g.step(1/60,{f:0,r:0,yaw:0}); return +((performance.now()-t)/120).toFixed(3)})() };`);
await shot('01-swarm-300');

// 2. W direction after turns (real key events; camera direction vs actual movement)
await run('w_direction', `
  fresh(); const o = {};
  const dir = () => { const v = new THREE.Vector3(); D.camera.getWorldDirection(v); return [+v.x.toFixed(2), +v.z.toFixed(2)]; };
  async function t(label) { const x0 = g.p.x, z0 = g.p.z, cd = dir(); key('KeyW', true); await wait(400); key('KeyW', false); await wait(150);
    const dx = g.p.x - x0, dz = g.p.z - z0, l = Math.hypot(dx, dz) || 1; o[label] = { cameraForward: cd, moved: [+(dx / l).toFixed(2), +(dz / l).toFixed(2)] }; }
  await wait(300); await t('start'); I.look(Math.PI / 0.0025, 0); await wait(300); await t('after_180_turn'); I.look(Math.PI / 2 / 0.0025, 0); await wait(300); await t('after_90_more');
  return o;`);

// 3. climb a ramp onto the stands, then jump onto a roof
await run('ramp_and_roof', `
  fresh(); place(10, 0, 0); I.yaw = -Math.PI / 2; await wait(200);
  key('KeyW', true); let t0 = performance.now(); while (performance.now() - t0 < 6000 && g.p.x < 40) await wait(30); key('KeyW', false);
  const onStands = { x: +g.p.x.toFixed(1), y: +g.p.y.toFixed(2) };
  I.yaw = Math.atan2(-(51.7 - g.p.x), -(21.4 - g.p.z)); await wait(200);
  key('KeyW', true); t0 = performance.now(); let jumped = false;
  while (performance.now() - t0 < 7000) { const r = Math.hypot(g.p.x, g.p.z); if (!jumped && r >= 49.3) { key('Space', true); jumped = true; } if (g.p.y > 5.7 && r > 52) break; await wait(16); }
  key('Space', false); key('KeyW', false); await wait(400);
  return { onStands, onRoof: { r: +Math.hypot(g.p.x, g.p.z).toFixed(1), y: +g.p.y.toFixed(2), grounded: g.p.grounded } };`);
await shot('02-on-roof');

// 4. enemies follow up a ramp: duelist on the stands, enemies start on the arena floor
await run('enemies_climb_ramp', `
  fresh(); place(46, 4, 0); g.cardT = 1e9; g.fireT = 1e9;
  const E = g.en; for (let i = 0; i < 6; i++) { E.alive[i] = 1; E.x[i] = 4 + i * 2; E.z[i] = 8 - i * 3; E.y[i] = 0; E.hp[i] = 4; E.spd[i] = 4.2; E.atk[i] = 0; }
  const t0 = performance.now(); let first = null;
  while (performance.now() - t0 < 30000) { let up = 0; for (let i = 0; i < 6; i++) if (E.y[i] > 3.5) up++; if (up === 6) { first = (performance.now() - t0) / 1000; break; } await wait(100); }
  const ys = []; for (let i = 0; i < 6; i++) ys.push(+E.y[i].toFixed(2));
  return { allSixOnStandsAfterSeconds: first && +first.toFixed(1), enemyHeights: ys };`);
await shot('03-enemies-on-stands');

// 5. slide gains speed downhill, dash is 4 m and harmless
await run('slide_and_dash', `
  fresh(); place(31.8, 4, 0); I.yaw = Math.PI / 2; key('KeyW', true); await wait(500);
  key('ControlLeft', true); let peak = 0; const t0 = performance.now(); while (performance.now() - t0 < 1500) { peak = Math.max(peak, g.p.slideSpeed || 0); await wait(16); }
  key('ControlLeft', false); key('KeyW', false); const slide = { peakSlideSpeed: +peak.toFixed(1), runSpeed: 9, xAfter: +g.p.x.toFixed(1), y: +g.p.y.toFixed(2) };
  await wait(600); fresh(); g.god = false; I.yaw = -Math.PI / 2; const hp0 = g.p.hp;
  const E = g.en; E.alive[0] = 1; E.x[0] = 2.5; E.z[0] = 0; E.y[0] = 0; E.hp[0] = 4; E.spd[0] = 0; E.atk[0] = 0; g.cardT = 1e9; g.fireT = 1e9;
  const x0 = g.p.x; let minDist = 99, hpMid = hp0; key('ShiftLeft', true); await wait(80); key('ShiftLeft', false);
  const t1 = performance.now(); while (performance.now() - t1 < 600) { minDist = Math.min(minDist, Math.hypot(E.x[0] - g.p.x, E.z[0] - g.p.z)); if (g.p.dashT > 0) hpMid = g.p.hp; await wait(2); }
  return { slide, dash: { distance: +(g.p.x - x0).toFixed(2), closestApproachToEnemy: +minDist.toFixed(2), enemyReach: 1.45, hpLostDuringDash: hp0 - hpMid, hpLostTotal: hp0 - g.p.hp } };`);

// 6. camera: pulls in near walls, never under the floor, full 360 yaw
await run('camera', `
  const T = await import('/src/sim/terrain.js'); fresh(); const spots = [[30.5, 0, 12], [20, 0, 20], [47, 4, 10], [100, 5, 0], [0, 0, 0], [-129, 28.8, 0], [26, 2, 0]];
  let minGap = 1e9, minDist = 1e9, maxDist = 0, n = 0;
  for (const s of spots) { place(s[0], s[1], s[2]); D.chase.reset(); for (let k = 0; k < 36; k++) { I.yaw = k * Math.PI / 18; I.pitch = (k % 3 - 1) * 0.5; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = D.camera.position, d = Math.hypot(c.x - g.p.x, c.y - g.p.y, c.z - g.p.z); const gap = c.y - T.heightAt(c.x, c.z);
    minGap = Math.min(minGap, gap); minDist = Math.min(minDist, d); maxDist = Math.max(maxDist, d); n++; } }
  I.pitch = 0; place(0, 0, 0); D.chase.reset(); I.yaw = 0; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = D.camera.position; const open = { back: +(c.z - g.p.z).toFixed(2), up: +(c.y - g.p.y).toFixed(2) };
  return { samples: n, minCameraAboveGround: +minGap.toFixed(2), closestToPlayer: +minDist.toFixed(2), farthestFromPlayer: +maxDist.toFixed(2), openGroundOffset_atYaw0: open };`);

// 7. screenshots of each district (teleport only for the picture)
for (const [name, x, y, z, yaw] of [['04-colosseum-floor', 0, 0, 10, 0.4], ['05-market', 0, 0, -88, 0], ['06-temple', 80, 0, 0, -Math.PI / 2], ['07-spine', 0, 0, 100, Math.PI], ['08-pyramid', -120, 0, 80, 0], ['09-royal-gate', 0, 4, -40, 0]]) {
  await evalIn(`(async()=>{${H} fresh(); place(${x}, ${y}, ${z}); I.yaw = ${yaw}; await wait(700); })()`);
  await shot(name);
}

// 8. die, then restart twice with everything reset
await run('death_and_restarts', `
  const wait2 = wait; const o = { deaths: [] };
  for (let run = 0; run < 3; run++) {
    if (run === 0) { D.start(); } else { document.getElementById('restartBtn').click(); }
    await wait(100);
    const fresh1 = { t: +g.t.toFixed(2), hp: g.p.hp, kills: g.kills, xp: g.xp, enemies: g.enemyCount(), gems: g.pick.alive.reduce((a, b) => a + b, 0), shots: g.shots.alive.reduce((a, b) => a + b, 0), over: g.over, mode: D.mode(), pos: [g.p.x, g.p.y, g.p.z], deadScreenVisible: document.getElementById('deadScreen').classList.contains('on') };
    // die for real: surround the duelist
    g.god = false; g.cardT = 1e9; g.field.monsters.fill(null); g.spawnAcc = -1e9;
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.en.alive[i] = 1; g.en.x[i] = Math.cos(a) * 1.1; g.en.z[i] = Math.sin(a) * 1.1; g.en.y[i] = 0; g.en.hp[i] = 4; g.en.spd[i] = 0; g.en.atk[i] = 0; }
    const t0 = performance.now(); while (D.mode() === 'play' && performance.now() - t0 < 20000) await wait(100);
    o.deaths.push({ startState: fresh1, died: D.mode() === 'dead', deadScreenVisible: document.getElementById('deadScreen').classList.contains('on'), survivedSeconds: +g.t.toFixed(2), hitsTaken: g.hitsTaken });
  }
  return o;`);
await shot('10-defeat-screen');

const logs = await evalIn('JSON.stringify(window.__errs||[])');
console.log(JSON.stringify(results, null, 1));
console.log('page errors:', logs);
cleanup();
process.exit(0);






