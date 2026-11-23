import { launch, wait } from './cdp.mjs';
// Pause as the duel mat: the mat (header, monster zones, spell/trap zones, items), the Ledger tabs, Settings over the frozen run and back, holds on Restart and End run.   node test/browser-pause.mjs <outdir>
const out = process.argv[2], b = await launch({ out, query: '?seed=3&debug' });
const SIZES = [['1920', 1920, 1080, false], ['1280', 1280, 720, false], ['960', 960, 540, false], ['844', 844, 390, true]];
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }); await wait(3000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.field.monsters[1] = { id: 'cinder-hatchling', level: 4 }; g.field.spells[0] = { id: 'swift-draw', level: 2, cd: 0 }; g.items.push('worn-duel-glove', 'lucky-coin', 'lucky-coin'); g.coins = 112; g.kills = 247; g.mods.dmgMult = 0.2; g.mods.move = 0.1; return 1; })()`);
for (const [n, w, h, mob] of SIZES) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); await wait(400);
  await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 1; })()`); await wait(800);
  const r = await b.evalIn(`(()=>{ const bad = []; for (const e of document.querySelectorAll('#pauseScreen button, #pauseScreen h1')) { const q = e.getBoundingClientRect(); if (!q.width) continue; let p = e.parentElement, clip = false; while (p && p.id !== 'pauseScreen') { if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) { clip = true; break; } p = p.parentElement; } if (!clip && (q.right > innerWidth + 1 || q.bottom > innerHeight + 1 || q.left < -1 || q.top < -1)) bad.push(e.id || e.textContent.slice(0, 16)); } return JSON.stringify({ on: document.getElementById('pauseScreen').classList.contains('on'), monsters: document.querySelectorAll('.ptile.mon').length, spells: document.querySelectorAll('.ptile.st').length, items: document.querySelectorAll('.pitem').length, clipped: bad }); })()`);
  console.log(n, r); await b.shot('pause_' + n);
  if (n === '1280') {
    await b.evalIn(`(()=>{ document.querySelector('[data-pt=stats]').click(); return 1; })()`); await wait(300); await b.shot('pause_stats_1280');
    await b.evalIn(`(()=>{ document.querySelector('[data-pt=actions]').click(); document.getElementById('pmSettings').click(); return 1; })()`); await wait(500);
    console.log('settings over pause:', await b.evalIn(`JSON.stringify({ menu: document.getElementById('menuScreen').classList.contains('on'), pauseHidden: getComputedStyle(document.getElementById('pauseScreen')).display === 'none' })`)); await b.shot('pause_settings_1280');
    await b.evalIn(`(()=>{ document.getElementById('setBack').click(); return 1; })()`); await wait(300);
    console.log('back to pause:', await b.evalIn(`JSON.stringify({ menu: document.getElementById('menuScreen').classList.contains('on'), pause: getComputedStyle(document.getElementById('pauseScreen')).display })`));
    console.log('end run needs a hold:', await b.evalIn(`(()=>{ const g = __ds.game, e = document.getElementById('endBtn'); e.click(); return JSON.stringify({ afterOneClick: g.over === true || !!g.ended, label: e.textContent }); })()`));
  }
  await b.evalIn(`(()=>{ document.getElementById('resumeBtn').click(); return 1; })()`); await wait(400);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
