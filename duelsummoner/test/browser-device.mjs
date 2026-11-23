import { launch, wait } from './cdp.mjs';
// Device check: the run starts at a phone-size and a handheld-size landscape viewport with touch emulation, the duelist moves when a thumb drags on the left of the screen,
// the touch buttons are shown, and no two HUD boxes overlap. One picture each.   node test/browser-device.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?debug&play=1' });
const VIEWS = [['phone', 844, 390, 2], ['handheld', 960, 540, 2]];
for (const [name, w, h, dpr] of VIEWS) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
  await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await b.send('Page.reload'); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; return 1; })()`);
  const info = JSON.parse(await b.evalIn(`(async()=>JSON.stringify({ level: (await import('/src/view/grass.js')).detailLevel(), vw: innerWidth, vh: innerHeight, detail: new URLSearchParams(location.search).get('detail') || 'default', tcOff: document.getElementById('tc').classList.contains('off'), bodyTouch: document.body.classList.contains('touch'), build: document.getElementById('buildLabel').textContent, fsBtnShown: getComputedStyle(document.getElementById('fsBtn')).display !== 'none', composite: !!__ds.composite.on, grass: __ds.grass ? __ds.grass.visible : null }))()`));
  const p0 = JSON.parse(await b.evalIn('JSON.stringify({ x: __ds.game.p.x, z: __ds.game.p.z })'));
  const sx = Math.round(w * 0.18), sy = Math.round(h * 0.72);
  await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let k = 1; k <= 6; k++) { await b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + k * 9, y: sy - k * 9, id: 1 }] }); await wait(80); }
  await wait(900); await b.shot('device_' + name);
  await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300);
  const p1 = JSON.parse(await b.evalIn('JSON.stringify({ x: __ds.game.p.x, z: __ds.game.p.z })'));
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const over = JSON.parse(await b.evalIn(`(()=>{ const ids = ['topleft','topright','minimap','zones','devbar','stats','itemsList','boss','prompt']; const R = []; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; R.push([id, r]); }
    for (const e of document.querySelectorAll('#tc .tcb')) { const r = e.getBoundingClientRect(); if (getComputedStyle(e).display !== 'none') R.push(['btn:' + e.textContent, r]); }
    const out = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], c = R[j][1], ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ox > 1 && oy > 1) out.push(R[i][0] + ' x ' + R[j][0] + ' ' + Math.round(ox) + 'x' + Math.round(oy)); }
    return JSON.stringify({ boxes: R.map(x => x[0] + '@' + Math.round(x[1].left) + ',' + Math.round(x[1].top) + ',' + Math.round(x[1].width) + 'x' + Math.round(x[1].height)), overlaps: out }); })()`));
  console.log(name, JSON.stringify(info), 'moved', moved.toFixed(2), 'm');
  console.log(name, 'hud', JSON.stringify(over));
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);


