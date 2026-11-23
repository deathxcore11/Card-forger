import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const m = await import('./src/view/reveal.js'); const t0 = performance.now(); let tot = 0; window.__rv = m.playReveal('legendary', { noNearMiss: true }, () => { window.__rvEnd = performance.now() - t0; }); tot = window.__rv.total; return JSON.stringify({ planned: tot }); })()`));
for (const [n, ms] of [['freeze', 1650], ['burst', 400], ['end_text', 500]]) { await new Promise(r => setTimeout(r, ms)); await b.shot('legendary_' + n); }
await new Promise(r => setTimeout(r, 900)); console.log(await b.evalIn('JSON.stringify({ endedAfterMs: Math.round(window.__rvEnd || -1) })'));
for (const tier of ['rare', 'epic']) console.log(tier, await b.evalIn(`(async()=>{ const m = await import('./src/view/reveal.js'); const r = m.playReveal('${tier}', { noNearMiss: true }, () => {}); const t = r.total; r.skip(); return t; })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
