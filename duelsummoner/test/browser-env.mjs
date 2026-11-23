import { launch, wait } from './cdp.mjs';
const out = process.argv[2], tags = process.argv.slice(3);
const b = await launch({ out, query: '?debug&seed=' + (process.env.SEED || 1) });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const yaws = [['gate', null], ['east', 'a'], ['west', 'b'], ['back', 'c']];
for (const [n, k] of yaws) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, gt = g.map.gate, base = Math.atan2(-(gt.x - p.x), -(gt.z - p.z)); D.input.yaw = base + ${n === 'gate' ? 0 : n === 'east' ? 1.57 : n === 'west' ? -1.57 : 3.14}; D.input.pitch = 0; D.chase.reset(); D.input.keys = {}; await new Promise(r => setTimeout(r, 1000)); return 1; })()`);
  await b.shot((tags[0] || 'shot') + '_' + n);
}
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); console.log(await b.evalIn('JSON.stringify({ calls: __ds.renderer ? 0 : 0 })')); b.close(); setTimeout(() => process.exit(0), 300);
