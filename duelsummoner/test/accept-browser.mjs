import { launch, wait } from './cdp.mjs';
const out = process.argv[2], seeds = process.argv.slice(3).map(Number), res = [];
for (const seed of seeds) {
  const b = await launch({ out, query: '?debug&seed=' + seed });
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1800)); D.game.god = true; D.input.yaw = 0; D.input.pitch = 0; D.chase.reset(); await new Promise(r => setTimeout(r, 1000)); return 1; })()`);
  const png = (await b.send('Page.captureScreenshot', { format: 'png' })).result.data; await b.shot('accept_seed' + seed);
  const r = await b.evalIn(`(async()=>{ const img = new Image(); img.src = 'data:image/png;base64,${png}'; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const W = img.width, H = img.height, px = (x, y) => cx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const D = __ds, g = D.game, p = g.p, cam = D.camera, T = window.THREE; const P = (x, y, z) => new T.Vector3(x, y, z).project(cam), top = P(p.x, p.y + 1.8, p.z), foot = P(p.x, p.y, p.z), f = new T.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize(); const hz = P(cam.position.x + f.x * 5000, cam.position.y, cam.position.z + f.z * 5000);
    const Lab = (r0, g0, b0) => { const f1 = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, R = f1(r0), G = f1(g0), B = f1(b0), X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883, f2 = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; return [116 * f2(Y) - 16, 500 * (f2(X) - f2(Y)), 200 * (f2(Y) - f2(Z))]; };
    const avg = (x, y) => { let r0 = 0, g0 = 0, b0 = 0, n = 0; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const d = px(x + i, y + j); r0 += d[0]; g0 += d[1]; b0 += d[2]; n++; } return Lab(r0 / n, g0 / n, b0 / n); };
    const fy = (1 - foot.y) / 2 * H, fx = (foot.x + 1) / 2 * W, hy = (1 - hz.y) / 2 * H;
    // vegetation share of the frame outside the HUD: green-dominant pixels and the dark trunks next to them
    let veg = 0, tot = 0, sky = 0; const dd = cx.getImageData(0, 0, W, Math.round(H * 0.8)).data; for (let i = 0; i < dd.length; i += 16) { const r1 = dd[i], g1 = dd[i + 1], b1 = dd[i + 2]; tot++; if (g1 > r1 + 6 && g1 > b1 + 6) veg++; else if (b1 > r1 + 18 && b1 >= g1 - 4) sky++; }
    const ground = avg(fx, fy + 70), hor = avg(W / 2, hy - 4), skyTop = avg(W / 2, H * 0.05), skyHor = avg(W / 2, hy - 30);
    const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const info = D.renderer.info.render;
    return JSON.stringify({ seed: g.seed, heroPct: +((top.y - foot.y) / 2 * 100).toFixed(1), feetDownPct: +((1 - foot.y) / 2 * 100).toFixed(1), horizonDownPct: +((1 - hz.y) / 2 * 100).toFixed(1), eyeAboveFeetM: +(cam.position.y - p.y).toFixed(2), vegPct: +(100 * veg / tot).toFixed(1), skyPct: +(100 * sky / tot).toFixed(1), groundL: +ground[0].toFixed(1), horizonL: +hor[0].toFixed(1), horizonMinusGround: +(hor[0] - ground[0]).toFixed(1), skyTopVsHorizonDE: +dE(skyTop, skyHor).toFixed(1), calls: info.calls, triangles: info.triangles }); })()`);
  res.push(JSON.parse(r)); res.at(-1).errors = await b.evalIn('window.__errs.slice(0,2)'); b.close(); await wait(1200);
}
console.log(JSON.stringify(res, null, 1)); setTimeout(() => process.exit(0), 300);
