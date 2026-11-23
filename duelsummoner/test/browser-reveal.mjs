import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
const R = {};
for (const tier of ['rare', 'legendary']) {
  R[tier] = await b.evalIn(`(async()=>{ const D = __ds, g = D.game; g.forceChest = '${tier}'; const p = g.p; g.world.cchests.push({ x: p.x + 0.5, y: p.y, z: p.z, open: false, rarity: 'common', free: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
    await new Promise(r => setTimeout(r, 100)); const t0 = performance.now(); const on = !!document.getElementById('reveal'); const rv = g.offer && g.offer.reveal; return JSON.stringify({ revealShown: on, offerReveal: rv, offerType: g.offer && g.offer.type }); })()`);
  await new Promise(r => setTimeout(r, 1000)); await b.shot(tier + '_build');
  await new Promise(r => setTimeout(r, 1300)); await b.shot(tier + '_stop');
  R[tier + '_end'] = await b.evalIn(`(async()=>{ await new Promise(r => setTimeout(r, 900)); return JSON.stringify({ revealGone: !document.getElementById('reveal'), cards: document.querySelectorAll('#offerCards .card').length, chestRarityOnTag: [...document.querySelectorAll('.wtag')].map(e => e.textContent).filter(t => /Chest/.test(t)) }); })()`);
  await b.shot(tier + '_cards');
  await b.evalIn(`(()=>{ const bt = document.querySelector('#offerCards [data-pick]'); if (bt) bt.click(); return 1; })()`); await new Promise(r => setTimeout(r, 900));
}
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);
