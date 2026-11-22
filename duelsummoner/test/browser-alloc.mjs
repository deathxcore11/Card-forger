// Where does the view allocate per frame? Samples the heap allocation profile in real Chrome over 3 s of steady state with 300 enemies.
import { launch, wait } from './cdp.mjs';
const b = await launch({ query: '?debug', uncapped: true });
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; const EN = await import('/src/sim/enemies.js'); D.freeze(false); D.start(); g.god = true; g.p.hp = 1e9; g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; for (let i = 0; i < 300; i++) EN.spawnEnemy(g, 'husk'); await new Promise(r => setTimeout(r, 1500)); })()`);
await b.send('HeapProfiler.enable'); await b.send('HeapProfiler.startSampling', { samplingInterval: 128, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await wait(3000);
const r = await b.send('HeapProfiler.stopSampling'); const acc = {};
(function w(n) { const f = n.callFrame, k = (f.functionName || '(anon)') + ' ' + f.url.replace(/.*\//, '') + ':' + (f.lineNumber + 1); acc[k] = (acc[k] || 0) + n.selfSize; n.children.forEach(w); })(r.result.profile.head);
Object.entries(acc).sort((a, c) => c[1] - a[1]).slice(0, 16).forEach(([k, v]) => console.log(String(v).padStart(9), k));
b.close();

