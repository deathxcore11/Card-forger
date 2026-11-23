import { launch, wait } from './cdp.mjs';
// The prompt plate beside a chest, at three sizes, with a Fusion ready: every line whole and at least 8 px above the slot bar.
import { readFileSync } from 'node:fs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); const g = D.game; g.god = true; g.spawnAcc = -1e9; const c = g.world.cchests.find(c => c.free) || g.world.cchests[0]; g.p.x = c.x - 1.6; g.p.z = c.z; g.p.y = c.y; g.field.monsters[1] = { id: 'rune-apprentice', level: 10, cd: 0 }; g.field.monsters[2] = { id: 'sigil-familiar', level: 10, cd: 0 }; return 1; })()`);
let bad = 0;
for (const [n, w, h] of [['1373x1045', 1373, 1045], ['1920x1080', 1920, 1080], ['1280x720', 1280, 720]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await wait(700);
  const r = await b.evalIn(`(()=>{ const q = id => document.getElementById(id), P = q('prompt').getBoundingClientRect(), F = q('fusion').getBoundingClientRect(), Z = q('zones').getBoundingClientRect(); return { prompt: q('prompt').textContent, pBottomGap: Math.round(Z.top - P.bottom), fusionShown: getComputedStyle(q('fusion')).display !== 'none', fBottomGap: Math.round(P.top - F.bottom), inside: P.left >= 0 && P.right <= innerWidth && P.top >= 0 }; })()`);
  console.log(n, JSON.stringify(r)); if (r.pBottomGap < 8 || !r.inside || !r.prompt) bad++; await b.shot('prompt_' + n);
}
console.log('bad', bad, JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
