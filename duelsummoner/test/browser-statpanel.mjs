import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.items.push('sand-sandals','clay-heart'); D.game.blessings.push('might'); (await import('/src/sim/field.js')).recompute(D.game); await new Promise(r => setTimeout(r, 300)); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' })); await new Promise(r => setTimeout(r, 600)); return 1; })()`);
const R = await b.evalIn(`(()=>{ const e = document.getElementById('statPanel'); return { shown: e.style.display, text: e.innerText.slice(0, 700) }; })()`);
await b.shot('stat-panel'); R.errors = await b.evalIn('window.__errs'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);


