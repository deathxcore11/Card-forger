import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
console.log(await b.evalIn(`(async()=>{ const D = __ds, fx = D.fx, p = D.game.p; fx.number(p.x + 3, p.y + 1.7, p.z - 4, 42, 0); let i0 = -1; for (let i = 0; i < fx.M; i++) if (fx.nage[i] >= 0) i0 = i; const s = []; for (let k = 0; k < 8; k++) { await new Promise(r => setTimeout(r, 100)); const u = fx.nage[i0] / (fx.nbig[i0] ? 0.95 : 0.7); s.push([+u.toFixed(2), +fx.nsp[i0].material.opacity.toFixed(2)]); } return JSON.stringify(s); })()`));
await b.shot('numbers_fade'); b.close(); setTimeout(() => process.exit(0), 300);
