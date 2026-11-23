import { launch, wait } from './cdp.mjs';
// Touch layering: with a touch screen, nothing from the touch overlay (stick, look zone, JUMP, DASH, pause button) may sit above the pause screen, an offer or the run-ended screen.
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
let bad = 0;
for (const [name, w, h] of [['960x540', 960, 540], ['1280x720', 1280, 720], ['1920x1080', 1920, 1080]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true }); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await b.evalIn(`(async()=>{ const D = window.__ds; if (!window.__started) { D.pickDuelist('kael'); D.start(); window.__started = 1; } window.dispatchEvent(new Event('touchstart')); await new Promise(r => setTimeout(r, 600)); return 1; })()`);
  const res = {};
  const probe = `(()=>{ const pts = [[0.05,0.9],[0.3,0.8],[0.95,0.9],[0.85,0.75],[0.93,0.06],[0.5,0.5],[0.2,0.3]]; const tc = document.getElementById('tc'); let over = 0; for (const [fx, fy] of pts) { const el = document.elementFromPoint(fx * innerWidth, fy * innerHeight); if (el && tc.contains(el)) over++; } return { over, screen: !!document.querySelector('.screen.on'), tcVisible: !tc.classList.contains('off') }; })()`;
  res.play = await b.evalIn(probe);
  await b.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); 1`); await wait(300); res.pause = await b.evalIn(probe);
  await b.evalIn(`document.getElementById('resumeBtn').click(); 1`); await wait(300);
  await b.evalIn(`(async()=>{ const g = __ds.game; g.god = true; g.addXp(60); return 1; })()`); await wait(800); res.offer = await b.evalIn(probe);
  console.log(name, JSON.stringify(res)); bad += (res.pause.screen ? res.pause.over : 0) + (res.offer.screen ? res.offer.over : 0); if (!res.pause.screen || !res.offer.screen) console.log('  (a screen was not up for one probe)');
  await b.evalIn(`(()=>{ const g = __ds.game; for (let i = 0; i < 5 && g.offer; i++) { const bt = document.querySelector('#offerCards [data-pick]'); if (bt) bt.click(); } return 1; })()`); await wait(900);
  await b.evalIn(`(()=>{ document.querySelectorAll('#offerBtns [data-act=pass]').forEach(x => x.click()); return 1; })()`); await wait(500);
}
console.log('touch overlay above a screen at', bad, 'probe points'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
