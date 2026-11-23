// The Carved Cards re-bake pictures: Kael, Mira and the Ember Wyvern close up in the real game on Stage 1 at 1920x1080, plus draws, triangles and texture memory.  node test/browser-rebake.mjs <outdir> <label>
import { launch, wait } from './cdp.mjs';
const out = process.argv[2], label = process.argv[3] || 'after';
const b = await launch({ out, query: '?seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const stats = {};
for (const who of ['kael', 'mira', 'wyvern']) {
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('${who === 'mira' ? 'mira' : 'kael'}'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
  stats[who] = JSON.parse(await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; const f = n => new Promise(async r => { for (let i = 0; i < n; i++) await new Promise(q => requestAnimationFrame(q)); r(); });
    let tx = p.x, ty = p.y + 1.0, tz = p.z; if ('${who}' === 'wyvern') { const m = g.field.monsters[0]; tx = m.x; ty = m.y; tz = m.z; }
    const k = '${who}' === 'wyvern' ? 0.45 : 1; D.camHold = { x: tx + 2.4 * k, y: ty + 0.7 * k, z: tz + 3.2 * k, lx: tx, ly: ty + 0.1, lz: tz }; await f(40); const R = D.renderer;
    return JSON.stringify({ draws: R.info.render.calls, tris: R.info.render.triangles, textures: R.info.memory.textures, geometries: R.info.memory.geometries }); })()`));
  await wait(300); await b.shot(label + '_' + who);
}
console.log(JSON.stringify(stats)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
