import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
console.log(await b.evalIn(`JSON.stringify({ propShadows: __ds.scene.children.map(c => c.userData && c.userData.propShadows).filter(Boolean), draws: __ds.renderer.info.render.calls, tris: __ds.renderer.info.render.triangles })`));
await wait(400); await b.shot('prop_shadows'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
