import { launch, wait } from './cdp.mjs';
// Movement on the big desert at 412x915: a run across a dry lake flat (fast lane), a dune climb (soft sand) and a downhill slide; a picture each plus the speed.
//   node test/browser-lanes.mjs <outdir> <seed>
const [out, seedArg] = process.argv.slice(2), seed = +seedArg || 4711;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true }); await wait(2000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const spots = JSON.parse(await b.evalIn(`(async()=>{ const g = __ds.game, W = g.map, { heightAt } = await import('/src/sim/terrain.js'); const sl = (x, z) => (heightAt(x + 2, z) - heightAt(x, z)) / 2, o = {};
  for (let r = 0; r < 14000 && !(o.lake && o.dune && o.down); r += 97) for (let a = 0; a < 6.28; a += 0.4) { const x = Math.cos(a) * r, z = Math.sin(a) * r, t = W.regionAt(x, z).type; if (t === 2 && !o.lake && Math.abs(sl(x, z)) < 0.02 && Math.abs(sl(x + 20, z)) < 0.02) o.lake = [x, z]; if (t === 0 && !o.dune && sl(x, z) > 0.2 && sl(x + 6, z) > 0.2 && sl(x + 12, z) > 0.2) o.dune = [x, z]; if (t === 0 && !o.down && sl(x, z) < -0.18 && sl(x + 8, z) < -0.18 && sl(x + 16, z) < -0.18) o.down = [x, z]; } return JSON.stringify(o); })()`));
for (const [name, p] of Object.entries(spots)) {
  await b.evalIn(`(async()=>{ const D = __ds, g = D.game, { heightAt, streamTo } = await import('/src/sim/terrain.js'); g.p.x = ${p[0]}; g.p.z = ${p[1]}; streamTo(g.p.x, g.p.z, 80, 4); g.p.y = heightAt(g.p.x, g.p.z) + 0.2; g.p.vx = g.p.vz = 0; D.input.yaw = Math.atan2(-1, 0); return 1; })()`); await wait(1200);
  console.log(name, JSON.stringify(p)); await b.shot('lane-' + name);
}
b.close(); setTimeout(() => process.exit(0), 300);
