import { launch, wait } from './cdp.mjs';
const out = process.argv[2], b = await launch({ out, query: '?debug&seed=1' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
for (const [n, w, h] of [['16x9', 1920, 1080], ['20x9', 2400, 1080]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(400);
  console.log(n, await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p, { heightAt } = await import('./src/sim/terrain.js'); const c = g.world.cchests[0]; let inside = 0, frames = 0;
    p.x = c.x - 2.2; p.z = c.z; p.y = c.y; p.vx = p.vz = 0; p.grounded = true; D.input.yaw = Math.PI / 2; D.input.pitch = 0.05; D.chase.reset(); await new Promise(r => setTimeout(r, 500));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); D.input.keys.KeyW = true;
    for (let i = 0; i < 70; i++) { await new Promise(r => requestAnimationFrame(r)); const cp = D.chase.pos; frames++; if (heightAt(cp.x, cp.z) > cp.y - 0.05) inside++; if (i === 18) window.__mid = 1; }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); D.input.keys.KeyW = false; return JSON.stringify({ frames, cameraInsideTerrainSolid: inside }); })()`));
  await b.evalIn(`(async()=>{ const D = __ds, p = D.game.p, c = D.game.world.cchests[0]; p.x = c.x - 2.2; p.z = c.z; p.y = c.y; p.vx = p.vz = 0; D.input.yaw = Math.PI / 2; D.chase.reset(); await new Promise(r => setTimeout(r, 400)); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); D.input.keys.KeyW = true; await new Promise(r => setTimeout(r, 330)); return 1; })()`);
  await b.shot('chest_jump_' + n); await b.evalIn(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); __ds.input.keys.KeyW = false; 1`);
}
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
