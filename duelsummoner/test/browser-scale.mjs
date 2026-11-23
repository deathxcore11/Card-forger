import { launch, wait } from './cdp.mjs';
const out = process.argv[2];
const b = await launch({ out, query: '?debug&seed=1' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
const measure = async (name, w, h, sprint) => {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(500);
  const r = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, gt = g.map.gate; D.input.yaw = Math.atan2(-(gt.x - p.x), -(gt.z - p.z)); D.input.pitch = 0; D.chase.reset(); D.input.keys = {};
    ${sprint ? "D.input.keys.KeyW = true; await new Promise(r => setTimeout(r, 2500));" : "await new Promise(r => setTimeout(r, 1200));"}
    const cam = D.camera, T = window.THREE; cam.updateMatrixWorld(); const P = (x, y, z) => new T.Vector3(x, y, z).project(cam), top = P(p.x, p.y + 1.8, p.z), foot = P(p.x, p.y, p.z);
    const f = new T.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize(); const hz = P(cam.position.x + f.x * 5000, cam.position.y, cam.position.z + f.z * 5000);
    const pct = n => +((1 - n) / 2 * 100).toFixed(1); D.input.keys = {};
    return JSON.stringify({ seed: g.seed, stage: g.stage, w: innerWidth, h: innerHeight, vfov: +cam.fov.toFixed(1), heroHeightPct: +((top.y - foot.y) / 2 * 100).toFixed(1), heroCentreXPct: +((foot.x + 1) / 2 * 100).toFixed(1), feetDownPct: pct(foot.y), horizonDownPct: pct(hz.y) }); })()`);
  await b.shot(name); console.log(name, r);
};
await measure('rest_1920x1080', 1920, 1080, false);
await measure('sprint_1920x1080', 1920, 1080, true);
await measure('rest_2400x1080', 2400, 1080, false);
await measure('rest_4x3_1440x1080', 1440, 1080, false);
b.close(); setTimeout(() => process.exit(0), 300);
