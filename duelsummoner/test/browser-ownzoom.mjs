import { launch, wait } from './cdp.mjs';
// Own-size pull-back at three screen shapes with the own radius forced to 8 m: the zoom reached, the cap, and the duelist's share of the screen height (never under 7.5%).   node test/browser-ownzoom.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1' });
for (const [w, h, name] of [[1920, 1080, '16x9'], [1440, 1080, '4x3'], [2400, 1080, '20x9']]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(500);
  if (name === '16x9') await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); D.game.god = true; D.game.spawnAcc = -1e9; D.game.cardT = 1e9; D.game.field.monsters.fill(null); return 1; })()`);
  await b.evalIn(`window.__ds.ownRForce = 0`); await wait(1500);
  const meas = `(() => { const D = __ds, p = D.game.p, T = window.THREE, cam = D.camera; const a = new T.Vector3(p.x, p.y, p.z).project(cam), c = new T.Vector3(p.x, p.y + 1.8, p.z).project(cam); return Math.abs(c.y - a.y) / 2; })()`;
  const s0 = await b.evalIn(meas); await b.evalIn(`window.__ds.ownRForce = 8`); await wait(4500);
  const info = JSON.parse(await b.evalIn(`JSON.stringify({ zoom: +__ds.chaseZoom().toFixed(2), cap: +__ds.chaseCap().toFixed(2), share: +(${meas}).toFixed(3) })`));
  console.log(name, 'duelist share before', +(+s0).toFixed(3), 'with R = 8 m', JSON.stringify(info), info.share >= 0.074 ? 'OK' : 'UNDER THE FLOOR'); await b.shot('ownzoom_' + name);
}
console.log(JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
