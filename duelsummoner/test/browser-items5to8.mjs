import { launch, wait } from './cdp.mjs';
const out = process.argv[2], b = await launch({ out, query: '?debug&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
// item 6: a paid chest label, unaffordable then affordable
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; const c = g.world.cchests.find(c => !c.free && !c.trophy); p.x = c.x - 6; p.z = c.z; p.y = c.y; g.coins = 5; D.chase.reset(); D.input.yaw = Math.PI / 2; await new Promise(r => setTimeout(r, 600));
  const read = () => [...document.querySelectorAll('.wtag')].filter(e => e.style.display !== 'none' && /Card Chest/.test(e.textContent)).map(e => e.textContent + ' | ' + e.className + ' | ' + getComputedStyle(e).color);
  const a = read(); g.coins = 200; await new Promise(r => setTimeout(r, 300)); const b2 = read(); return JSON.stringify({ poor: a, afford: b2 }); })()`));
await b.shot('chest_label');
// item 7: guard and pill
console.log(await b.evalIn(`(async()=>{ const D = __ds, g = D.game; g.pendingLevels = 0; g.addXp(g.xpNeed * 6); await new Promise(r => setTimeout(r, 60)); const t0 = performance.now();
  const btn = () => document.querySelector('#offerCards [data-pick]'); const early = btn(); early.click(); await new Promise(r => setTimeout(r, 150)); const stillOpen = !!g.offer;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true })); await new Promise(r => setTimeout(r, 100)); const stillOpen2 = !!g.offer;
  const pill = document.getElementById('offerPill'); const pillTxt = pill ? pill.textContent + '|' + pill.style.display : 'none';
  await new Promise(r => setTimeout(r, 400)); btn().click(); await new Promise(r => setTimeout(r, 800)); return JSON.stringify({ clickAt150msIgnored: stillOpen, keyAt250msIgnored: stillOpen2, pill: pillTxt, afterLateClick: !!g.offer, level: g.level }); })()`));
await b.shot('offer_pill');
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
