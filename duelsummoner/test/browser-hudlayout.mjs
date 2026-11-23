// HUD overlap check at fine and coarse pointers: the two-row zone bar against the prompt, fusion line and items list (and the text size actually used).
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); return 1; })()`);
const SIZES = [['fine 1024x768', 1024, 768, false], ['fine 1280x720', 1280, 720, false], ['fine 1920x1080', 1920, 1080, false], ['fine 2400x1080', 2400, 1080, false],
  ['coarse 960x540 (Thor-size)', 960, 540, true], ['coarse 1280x720', 1280, 720, true], ['coarse 1920x1080', 1920, 1080, true]];
let bad = 0;
for (const [name, w, h, coarse] of SIZES) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: coarse });
  await b.send('Emulation.setTouchEmulationEnabled', { enabled: coarse, maxTouchPoints: coarse ? 5 : 0 });
  await wait(500);
  const r = await b.evalIn(`(()=>{
    const q = id => document.getElementById(id), rc = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const pr = q('prompt'), fu = q('fusion'); pr.textContent = 'E: open the Card Chest'; fu.textContent = 'Fusion ready: Ember Wyvern + Hatchling'; fu.style.display = 'block'; window.__ds.fitHud();
    const z = rc(q('zones')), items = rc(q('itemsList')), P = rc(pr), F = rc(fu), mm = rc(q('minimap')), tl = rc(q('topleft'));
    const hit = (a, c) => a.w > 0 && c.w > 0 && a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
    const fs = e => parseFloat(getComputedStyle(e).fontSize);
    return { coarse: matchMedia('(pointer:coarse)').matches, zones: z, promptHitsZones: hit(P, z), fusionHitsZones: hit(F, z), itemsHitZones: hit(items, z), promptHitsFusion: hit(P, F), zoneH: Math.round(z.h), zoneBottom: Math.round(h - z.t), promptBottomEdge: Math.round(P.b), fusionTop: Math.round(F.t), zoneFont: fs(document.querySelector('.zone')), hudFont: fs(q('prompt')) };
  })()`.replace('h - z.t', h + ' - z.t'));
  const flags = ['promptHitsZones', 'fusionHitsZones', 'itemsHitZones', 'promptHitsFusion'].filter(k => r[k]); bad += flags.length;
  console.log(name, JSON.stringify({ coarse: r.coarse, zoneH: r.zoneH, zoneFont: r.zoneFont, promptFont: r.hudFont, overlaps: flags }));
  await b.shot('hud_' + name.replace(/[^a-z0-9]+/gi, '_'));
}
console.log('overlaps', bad, JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
