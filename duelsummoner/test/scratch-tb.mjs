import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); D.game.god = true; return 1; })()`);
await b.evalIn('__ds.tablebreak(true)'); await wait(800);
console.log(await b.evalIn(`(()=>{ const u = __ds.blitU; return JSON.stringify({ h: u.uTBh.value, tb: u.uTB.value, ang: u.uTBang.value, info: u.uTBinfo.value, duel: u.uDuel.value }); })()`));
await b.shot('tb_debug');
b.close(); setTimeout(() => process.exit(0), 300);
