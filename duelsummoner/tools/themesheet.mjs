// Themes check (design/themes-v1.md): for each map, 2 seeds by 3 times of day (stages 1, 2, 3 = morning, evening, night) from the play camera with the HUD off, on one sheet.
//   node tools/themesheet.mjs [outDir] [maps...]
import { launch, wait } from '../test/cdp.mjs';
import { readFileSync } from 'node:fs';
const out = process.argv[2] || (process.env.TEMP || '.') + '/themes', maps = process.argv.slice(3).length ? process.argv.slice(3) : ['desert', 'ash'];
const b = await launch({ out, query: '?seed=21' }); const shots = [];
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
for (const map of maps) for (const seed of [21, 77]) for (const stage of [0, 1, 2]) {
  await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?play=1&seed=' + seed + '&map=' + map }); await wait(1500); for (let i = 0; i < 80 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
  await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); const g = D.game; g.god = true; g.opts.offers = false; g.spawnAcc = -1e9;
    if (${stage} > 0) { const { jumpToStage } = await import('/src/sim/stages.js'); jumpToStage(g, ${stage}); }
    document.body.classList.add('noHud'); const st = document.createElement('style'); st.textContent = '.hud, #zones, #rideHud, #rideHint, #tags, #devbar, #minimap { display:none !important; }'; document.head.appendChild(st);
    D.input.keys.KeyW = true; await new Promise(r => setTimeout(r, 2600)); D.input.keys.KeyW = false; return 1; })()`);
  const name = map + '-' + seed + '-' + ['morning', 'evening', 'night'][stage]; await b.shot(name); shots.push(name);
}
const cw = 320, ch = 180; await b.send('Emulation.setDeviceMetricsOverride', { width: cw * 6, height: (ch + 20) * maps.length * 2 / 2 + 20, deviceScaleFactor: 1, mobile: false });
const imgs = shots.map(s => 'data:image/png;base64,' + readFileSync(out + '/' + s + '.png').toString('base64'));
await b.evalIn(`(async()=>{ document.open(); document.write('<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(6,${cw}px)">' + ${JSON.stringify(imgs)}.map((s, i) => '<div><div style="color:#ddd;font:12px sans-serif;height:20px;line-height:20px;padding-left:4px">' + ${JSON.stringify(shots)}[i] + '</div><img src="' + s + '" style="width:${cw}px;height:${ch}px;display:block"></div>').join('') + '</body>'); document.close(); await new Promise(r => setTimeout(r, 900)); return 1; })()`);
await b.shot('themes-sheet'); console.log('sheet in', out); process.exit(0);
