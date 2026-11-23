import { launch, wait } from './cdp.mjs';
// Device check: the run starts at a phone-size and a handheld-size landscape viewport with touch emulation, the duelist moves when a thumb drags on the left of the screen,
// the touch buttons are shown, and no two HUD boxes overlap. One picture each.   node test/browser-device.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?debug&play=1' });
const VIEWS = [['desktop', 1920, 1080, 1, false], ['laptop', 1280, 720, 1, false], ['small', 800, 600, 1, false], ['phone', 844, 390, 2, true], ['handheld', 960, 540, 2, true], ['fold-square', 900, 840, 2, true], ['fold-tall', 840, 900, 2, true]];       // desktop sizes first: Chrome keeps the touch emulation of the previous view
const failed = [];
for (const [name, w, h, dpr, touchOn] of VIEWS) {
  const ts = (m, p) => touchOn ? b.send(m, p) : null;       // a touch on a desktop screen would (rightly) switch the touch controls on, so desktop views get no touches
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: touchOn, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
  await b.send('Emulation.setTouchEmulationEnabled', { enabled: touchOn, maxTouchPoints: touchOn ? 5 : 0 });
  await b.send('Page.reload'); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; return 1; })()`);
  const info = JSON.parse(await b.evalIn(`(async()=>JSON.stringify({ level: (await import('/src/view/grass.js')).detailLevel(), vw: innerWidth, vh: innerHeight, detail: new URLSearchParams(location.search).get('detail') || 'default', tcOff: document.getElementById('tc').classList.contains('off'), bodyTouch: document.body.classList.contains('touch'), build: document.getElementById('buildLabel').textContent, fsBtnShown: getComputedStyle(document.getElementById('fsBtn')).display !== 'none', composite: !!__ds.composite.on, grass: __ds.grass ? __ds.grass.visible : null }))()`));
  const p0 = JSON.parse(await b.evalIn('JSON.stringify({ x: __ds.game.p.x, z: __ds.game.p.z })'));
  const sx = Math.round(w * 0.18), sy = Math.round(h * 0.72);
  await ts('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let k = 1; k <= 6; k++) { await ts('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + k * 9, y: sy - k * 9, id: 1 }] }); await wait(80); }
  await wait(900); await b.shot('device_' + name);
  await ts('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300);
  const p1 = JSON.parse(await b.evalIn('JSON.stringify({ x: __ds.game.p.x, z: __ds.game.p.z })'));
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const over = JSON.parse(await b.evalIn(`(()=>{ const ids = ['topleft','topright','minimap','zones','devbar','stats','itemsList','boss','prompt','hint','fusion','proof']; const R = []; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; R.push([id, r]); }
    for (const e of document.querySelectorAll('#tc .tcb')) { const r = e.getBoundingClientRect(); if (e.offsetParent !== null) R.push(['btn:' + e.textContent, r]); }
    const out = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i][1], c = R[j][1], ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ox > 1 && oy > 1) out.push(R[i][0] + ' x ' + R[j][0] + ' ' + Math.round(ox) + 'x' + Math.round(oy)); }
    return JSON.stringify({ boxes: R.map(x => x[0] + '@' + Math.round(x[1].left) + ',' + Math.round(x[1].top) + ',' + Math.round(x[1].width) + 'x' + Math.round(x[1].height)), overlaps: out }); })()`));
  console.log(name, JSON.stringify(info), 'moved', moved.toFixed(2), 'm');
  if (/^fold/.test(name)) { const sq = JSON.parse(await b.evalIn(`(()=>{ const z = document.getElementById('zones').getBoundingClientRect(), d = document.getElementById('debug'), dr = d && getComputedStyle(d).display !== 'none' ? d.getBoundingClientRect() : null, cx0 = innerWidth * 0.3, cx1 = innerWidth * 0.7, cy0 = innerHeight * 0.3, cy1 = innerHeight * 0.7, hit = (a, c0, c1, d0, d1) => a.left < c1 && a.right > c0 && a.top < d1 && a.bottom > d0; return JSON.stringify({ zoneH: Math.round(z.height), vh: innerHeight, pct: +(z.height / innerHeight * 100).toFixed(1), overDebug: dr ? hit(z, dr.left, dr.right, dr.top, dr.bottom) : false, overCentre: hit(z, cx0, cx1, cy0, cy1) }); })()`)); console.log(name, 'slots', JSON.stringify(sq)); if (sq.pct > 9 || sq.overDebug || sq.overCentre) failed.push(name + ': slot block ' + JSON.stringify(sq)); }
  console.log(name, 'hud', JSON.stringify(over)); if (over.overlaps.length) { failed.push(name + ': ' + over.overlaps.join('; ')); }
  // the stage box is one line on a short touch screen; a tap opens it. Shoot it open and check overlaps again.
  const tb = JSON.parse(await b.evalIn(`JSON.stringify(document.getElementById('topright').getBoundingClientRect())`)); const tx = Math.round(tb.left + tb.width / 2), ty = Math.round(tb.top + tb.height / 2);
  await ts('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 2 }] }); await ts('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(600);
  const open = JSON.parse(await b.evalIn(`(()=>{ const t = document.getElementById('topright'), r = t.getBoundingClientRect(), m = document.getElementById('minimap').getBoundingClientRect(), p = document.querySelector('#tc .tcpause').getBoundingClientRect(); const ov = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1; return JSON.stringify({ open: t.classList.contains('open'), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], overMinimap: ov(r, m), overPause: ov(r, p) }); })()`));
  console.log(name, 'expanded', JSON.stringify(open)); await b.shot('device_' + name + '_open');
  await ts('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 3 }] }); await ts('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(300);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
console.log(failed.length ? 'FAIL: HUD overlaps ' + failed.join(' | ') : 'Pass: no HUD box overlaps another or a touch button in any view');
b.close(); setTimeout(() => process.exit(failed.length ? 1 : 0), 300);








