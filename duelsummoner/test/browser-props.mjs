import { launch } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=4242' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1800)); return 1; })()`);
console.log(await b.evalIn(`(()=>{ const c = __ds.scene.children[122], out = {}; const walk = (o, path) => { o.children.forEach(ch => { if (ch.isMesh) { const k = path + ':' + ch.geometry.type + (ch.material.transparent ? ':T' : '') + (ch.isInstancedMesh ? ':I' : ''); out[k] = (out[k] || 0) + 1; } else walk(ch, path + '/g'); }); }; walk(c, ''); return JSON.stringify(out); })()`));
b.close(); setTimeout(() => process.exit(0), 300);
