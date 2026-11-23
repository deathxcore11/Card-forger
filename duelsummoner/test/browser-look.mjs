import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug', });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1722, height: 960, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
await b.evalIn('(()=>{const g=__ds.game, p=g.p; for(let k=0;k<6;k++) __ds.game.pick.alive[k]=1, __ds.game.pick.kind[k]=k%3, __ds.game.pick.x[k]=p.x+(k-3)*1.3, __ds.game.pick.y[k]=p.y+0.5, __ds.game.pick.z[k]=p.z-9+k*0.2, __ds.game.pick.val[k]=k===0?25:k===3?6:1; return 1;})()'); await new Promise(r => setTimeout(r, 300)); await b.shot('look');
console.log(await b.evalIn(`(()=>{ const sizes = {}; document.querySelectorAll('.hud, .zone, .wtag, #stats, #itemsList').forEach(e => { if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return; sizes[e.id || e.className] = getComputedStyle(e).fontSize; }); return JSON.stringify({ w: innerWidth, sizes }); })()`));
await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); return 1; })()`); await new Promise(r => setTimeout(r, 500)); await b.shot('pause_1722');
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);



