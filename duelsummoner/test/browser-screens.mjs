import { launch, wait } from './cdp.mjs';
// Menu screens at four sizes (1920x1080, 1280x720, 960x540 handheld, 844x390 phone landscape). Reports clipping (anything past the viewport edge) and whether a focus ring exists.   node test/browser-screens.mjs <outdir> [screen...]
const out = process.argv[2], only = process.argv.slice(3);
const b = await launch({ out, query: '?seed=3&debug' });
const SIZES = [['1920', 1920, 1080, false], ['1280', 1280, 720, false], ['960', 960, 540, false], ['844', 844, 390, true]];
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }); await wait(3000);
const SCREENS = { main: `__ds.menus.showMain()`, duelists: `__ds.menus.showDuelists()`, maps: `__ds.menus.showMaps()`, library: `__ds.menus.showLibrary()`, quests: `__ds.menus.showQuests()`, settings: `__ds.menus.showSettings()`, deckbox: `(__ds.menus.showMain(), document.getElementById('mShop').click())`, results: `(()=>{ document.getElementById('metaScreen').classList.remove('on'); document.body.dataset.mode = 'play'; __ds.game.endRun(); document.getElementById('endBtn').click(); })()` };
for (const [name, js] of Object.entries(SCREENS)) {
  if (only.length && !only.includes(name)) continue;
  if (name === 'results') { await b.evalIn(`(async()=>{ __ds.pickDuelist('kael'); __ds.start(); await new Promise(r => setTimeout(r, 2200)); return 1; })()`); }
  for (const [sn, w, h, mob] of SIZES) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); await wait(300);
    await b.evalIn(`(()=>{ document.body.dataset.mode = 'start'; if (${JSON.stringify(name)} === 'main') document.getElementById('startScreen').classList.add('on'); ${js}; return 1; })()`); await wait(900);
    const r = await b.evalIn(`(()=>{ const bad = []; const root = document.querySelector('.screen.on') || document.body; for (const e of root.querySelectorAll('button, h1, h2, h3, .panel, .portrait, select, input, label')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; const s = getComputedStyle(e); if (s.visibility === 'hidden') continue; let p = e.parentElement, clipped = false; while (p && p !== root) { const ps = getComputedStyle(p); if (/(auto|scroll)/.test(ps.overflowY) && p.scrollHeight > p.clientHeight) { clipped = true; break; } p = p.parentElement; } if (!clipped && (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1)) bad.push((e.id || e.className || e.tagName) + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom)); } const sc = document.querySelector('.screen.on'); return JSON.stringify({ clipped: bad.slice(0, 4), scrolls: sc ? sc.scrollHeight > sc.clientHeight + 2 : null, ring: !!document.querySelector('.padfocus, #focusRing') }); })()`);
    console.log(name, sn, r); await b.shot(name + '_' + sn);
  }
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
