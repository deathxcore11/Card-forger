import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const g = __ds.game; const a = [g.level, g.xpCur, g.xpNeed, __ds.mode]; g.addXp(g.xpNeed - g.xpCur + 0.01); await new Promise(r => setTimeout(r, 800)); return JSON.stringify([a, g.level, g.xpCur, g.pendingLevels, !!g.offer, __ds.mode, document.getElementById('offerScreen').className]); })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
