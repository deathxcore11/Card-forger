import { launch, wait } from './cdp.mjs';
// Deck Box tiles in the page: opens on the cheapest affordable upgrade, buying ticks the chips down, a refund returns the exact price, the sheet offers three choices.   node test/browser-deckbox.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=3&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await wait(3000);
console.log(await b.evalIn(`(async()=>{ const M = await import('/src/view/metaui.js'), C = await import('/src/core/meta.js'); document.body.dataset.mode = 'start'; const S = { starChips: 100, meta: C.defaultMeta() }; let wrote = 0; M.showDeckBox(S, () => { wrote++; }, () => {});
  const out = {}; out.selected = document.querySelector('.dtile.sel').dataset.k; out.buyBtn = (document.getElementById('dBuy') || {}).textContent;
  document.getElementById('dBuy').click(); out.afterBuy = { chips: S.starChips, rank: C.rankOf(S.meta, out.selected), wrote };
  document.getElementById('dRef').click(); out.sheetButtons = [...document.querySelectorAll('.rsheet [data-ref]')].map(x => x.textContent);
  document.querySelector('.rsheet [data-ref=one]').click(); out.afterRefund = { chips: S.starChips, rank: C.rankOf(S.meta, out.selected) };
  out.refundHiddenAtZero = !document.getElementById('dRef');
  return JSON.stringify(out); })()`));
await b.evalIn(`(()=>{ document.querySelectorAll('.dtile')[3].click(); return 1; })()`); await wait(300); await b.shot('deckbox_selected');
await b.evalIn(`(()=>{ document.getElementById('dTab').click(); return 1; })()`); await wait(300); await b.shot('deckbox_ranktable');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
