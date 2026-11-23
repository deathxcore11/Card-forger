import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=' + (process.argv[3] || 4242) });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1800)); return 1; })()`);
console.log(await b.evalIn(`(()=>{ const out = []; __ds.scene.children.forEach((c, i) => { let n = 0; c.traverse(m => { if ((m.isMesh || m.isLine || m.isPoints) && m.visible && (!m.isInstancedMesh || m.count > 0)) n++; }); if (n) out.push(i + ':' + (c.type) + ':' + n); }); return out.join(' ') + ' | calls ' + __ds.renderer.info.render.calls; })()`));
b.close(); setTimeout(() => process.exit(0), 300);
