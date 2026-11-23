import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.field.banishes = 2; g.addXp(60); await new Promise(r => setTimeout(r, 800)); return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const g = __ds.game; const btns = [...document.querySelectorAll('#offerBtns button')].map(x => x.textContent), perCard = document.querySelectorAll('#offerCards [data-ban]').length, heights = [...document.querySelectorAll('#offerCards .card')].map(c => Math.round(c.getBoundingClientRect().height));
  const bb = [...document.querySelectorAll('#offerBtns button')].find(x => /^BANISH/.test(x.textContent)); bb.click(); const mode = document.getElementById('offerScreen').classList.contains('banishing'); const n0 = g.field.banished.size; const first = document.querySelector('#offerCards .card'); first.click(); await new Promise(r => setTimeout(r, 900));
  return JSON.stringify({ btns, perCardBanishButtons: perCard, heights, mode, banishedBefore: n0, banishedAfter: g.field.banished.size, banishesLeft: g.field.banishes }); })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
