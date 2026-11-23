import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
console.log(await b.evalIn(`(()=>{ let r = ''; __ds.scene.traverse(m => { if (m.isInstancedMesh && m.material.alphaTest) { const c = new THREE.Color(1, 0, 0); for (let i = 0; i < m.count; i++) m.setColorAt(i, c); m.instanceColor.needsUpdate = true; m.material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); r = 'basic ' + m.material.type + ' map=' + !!m.material.map + ' ' + (m.material.map && m.material.map.image && m.material.map.image.width); } }); return r; })()`));
await new Promise(r => setTimeout(r, 500)); await b.shot('decal_red'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);

