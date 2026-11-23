import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = false; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, X = D.bars.xp, s = [], fillEl = document.querySelector('#xpbar i:not(.gh):not(.rs)'); const t0 = performance.now(); g.addXp(1); const gain = (g.xpCur / g.xpNeed);
  for (let k = 0; k < 9; k++) { await new Promise(r => setTimeout(r, 100)); s.push(+(X.shown / gain).toFixed(2)); }
  const dom = fillEl.style.transform; return JSON.stringify({ gain: +gain.toFixed(3), fractionOfGainAt100msSteps: s, dom, ghost: +X.ghost.toFixed(3) }); })()`));
await b.shot('xp_bar');
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, H = D.bars.hp, s = []; g.p.hp = 100; await new Promise(r => setTimeout(r, 300)); g.hurtPlayer(40, true, 'test');
  for (let k = 0; k < 10; k++) { await new Promise(r => setTimeout(r, 100)); s.push([+H.shown.toFixed(2), +H.ghost.toFixed(2)]); }
  g.p.hp = Math.min(g.p.maxHp, g.p.hp + 30); const h = []; for (let k = 0; k < 5; k++) { await new Promise(r => setTimeout(r, 100)); h.push([+H.shown.toFixed(2), +document.querySelector('#hpbar i.rs').style.transform.replace(/[^0-9.]/g, '').slice(0, 5)]); }
  return JSON.stringify({ damage_shown_ghost_per_100ms: s, heal_shown_rose: h }); })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
