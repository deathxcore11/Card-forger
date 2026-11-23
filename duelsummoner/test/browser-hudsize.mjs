import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug', });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1722, height: 960, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
await b.shot('hud_1722');
console.log(await b.evalIn(`(()=>{ const sizes = {}; document.querySelectorAll('.hud, .zone, .wtag, #stats, #itemsList').forEach(e => { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return; sizes[e.id || e.className] = getComputedStyle(e).fontSize; }); return JSON.stringify({ w: innerWidth, sizes }); })()`));
await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); return 1; })()`); await new Promise(r => setTimeout(r, 500)); await b.shot('pause_1722');
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);

