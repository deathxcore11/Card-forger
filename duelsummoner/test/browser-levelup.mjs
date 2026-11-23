import { launch, wait } from './cdp.mjs';
const out = process.argv[2], res = [];
for (const seed of [1, 4242, 31337]) {
  const b = await launch({ out, query: '?debug&seed=' + seed }); await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
  const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; const t0 = performance.now(); let frames = 0, tOn = -1, tClick = -1; const lv0 = g.level; g.addXp(g.xpNeed * 1.6);
    const sc = document.getElementById('offerScreen'); const first = { x: 0, y: 0 };
    while (performance.now() - t0 < 1200) { await new Promise(r => requestAnimationFrame(r)); frames++; if (tOn < 0 && sc.classList.contains('on')) tOn = performance.now() - t0; const c = document.querySelector('#offerCards .card:last-child'); if (c && tClick < 0 && tOn >= 0) { const r = c.getBoundingClientRect(), a = c.getAnimations ? c.getAnimations() : []; const run = a.some(x => x.playState === 'running' && x.currentTime < 9999); if (!a.length || a.every(x => x.playState !== 'running')) tClick = performance.now() - t0; } }
    const pend = document.getElementById('xpbar').classList.contains('pending');
    return JSON.stringify({ offerOnAtMs: Math.round(tOn), lastCardSettledAtMs: Math.round(tClick), pendingLookOn: pend, levelRise: g.level - lv0 }); })()`);
  res.push({ seed, ...JSON.parse(r) }); console.log(r);
  if (seed === 1) { await b.evalIn(`(async()=>{ const g = __ds.game; const pb = document.querySelector('#offerCards [data-pick]'); if (pb) pb.click(); await new Promise(r => setTimeout(r, 700)); g.addXp(g.xpNeed * 1.6); await new Promise(r => setTimeout(r, 140)); return 1; })()`); await b.shot('levelup_cards_travelling'); }
  b.close(); await wait(1200);
}
console.log(JSON.stringify(res, null, 1)); setTimeout(() => process.exit(0), 300);


