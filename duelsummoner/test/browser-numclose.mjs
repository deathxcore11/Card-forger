import { launch, wait } from './cdp.mjs';
const out = process.argv[2]; const b = await launch({ out, query: '?debug&seed=1' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
const res = {};
for (const [name, w, h] of [['16x9', 1920, 1080], ['20x9', 2400, 1080], ['4x3', 1440, 1080]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(500);
  res[name] = await b.evalIn(`(async()=>{ const D = __ds, fx = D.fx, cam = D.camera, T = window.THREE; cam.updateMatrixWorld(); const f = new T.Vector3(); cam.getWorldDirection(f);
    const put = (d, off, crit, val) => fx.number(cam.position.x + f.x * d + off, cam.position.y - 0.3, cam.position.z + f.z * d, val, crit ? 1 : 0);
    put(2.4, 0.6, false, 2); put(3, -0.8, true, 99); put(8, 0, false, 12); put(-3, 0, false, 5); put(1.0, 0.3, false, 7);
    await new Promise(r => setTimeout(r, 120)); const out = [];
    for (let i = 0; i < fx.M; i++) if (fx.nage[i] >= 0) { const sp = fx.nsp[i]; const top = sp.position.clone().add(new T.Vector3(0, sp.scale.y / 2, 0)).project(cam), bot = sp.position.clone().sub(new T.Vector3(0, sp.scale.y / 2, 0)).project(cam), c = sp.position.clone().project(cam); out.push({ vis: sp.visible, behindOrNear: c.z >= 1, heightPctOfScreen: +(Math.abs(top.y - bot.y) / 2 * 100).toFixed(1) }); }
    return JSON.stringify(out); })()`);
  if (name === '16x9') await b.shot('numbers_close_16x9');
}
console.log(JSON.stringify(res, null, 1)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
