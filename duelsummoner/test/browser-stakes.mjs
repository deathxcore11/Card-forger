import { launch, wait } from './cdp.mjs';
// The Stakes HUD (percent under the clock) and a Wager Shrine, at 412x915 and 915x412.
//   node test/browser-stakes.mjs <outdir>
const [out] = process.argv.slice(2);
for (const [W, H] of [[412, 915], [915, 412]]) {
  const b = await launch({ out, query: '?debug&play=1&seed=4711' });
  await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H }); await wait(2000);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.stakesAdd = 85; const { placeObject } = await import('/src/sim/world.js'), { heightAt } = await import('/src/sim/terrain.js'); const yaw = D.input.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), x = g.p.x + fx * 7, z = g.p.z + fz * 7; placeObject(g, 'wager', { x, y: heightAt(x, z), z }); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
  await wait(500); await b.shot('stakes-' + W + 'x' + H);
  b.close(); await wait(300);
}
setTimeout(() => process.exit(0), 300);
