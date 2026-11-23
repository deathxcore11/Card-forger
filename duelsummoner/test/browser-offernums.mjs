import { launch, wait } from './cdp.mjs';
const out = process.argv[2], res = [];
for (const seed of [1, 4242, 31337]) {
  const b = await launch({ out, query: '?debug&seed=' + seed }); await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; document.body.classList.add('rm'); return 1; })()`);
  const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; let cards = 0, noNums = 0, sample = []; for (let n = 0; n < 7; n++) { g.addXp(g.xpNeed - g.xpCur + 0.01); await new Promise(r => setTimeout(r, 450)); const cs = [...document.querySelectorAll('#offerCards .card')]; for (const c of cs) { cards++; const nl = c.querySelectorAll('.nl').length; if (!nl && !/FUSION/.test(c.textContent)) noNums++; if (sample.length < 6) sample.push(c.querySelector('h3').textContent + ' | ' + [...c.querySelectorAll('.nl')].map(e => e.textContent).join('; ')); }
    if (n === 3) window.__shot = 1; const bt = document.querySelector('#offerCards [data-pick]'); if (bt) bt.click(); await new Promise(r => setTimeout(r, 300)); }
    return JSON.stringify({ cards, cardsWithoutNumbers: noNums, sample }); })()`);
  res.push({ seed, ...JSON.parse(r) }); if (seed === 1) { await b.evalIn(`(async()=>{ const g = __ds.game; g.addXp(g.xpNeed - g.xpCur + 0.01); await new Promise(r => setTimeout(r, 500)); return 1; })()`); await b.shot('offer_numbers'); }
  res.at(-1).errors = await b.evalIn('window.__errs.slice(0,2)'); b.close(); await wait(1200);
}
console.log(JSON.stringify(res, null, 1)); setTimeout(() => process.exit(0), 300);
