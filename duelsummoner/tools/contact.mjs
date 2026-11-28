// Contact sheet (design/ui-polish-v1.md): every screen a player can reach, at 1920x1080, 412x915 and 915x412, saved as PNGs and laid out on one sheet per size.
//   node tools/contact.mjs [outDir]
import { launch, wait } from '../test/cdp.mjs';
import { readFileSync } from 'node:fs';
const out = process.argv[2] || (process.env.TEMP || '.') + '/contact';
const b = await launch({ out, query: '?seed=21' });
const SIZES = [[1920, 1080, false], [412, 915, true], [915, 412, true]];
const shots = [];
const go = async (url) => { await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/' + url }); await wait(1500); for (let i = 0; i < 80 && !(await b.evalIn('!!window.__ds')); i++) await wait(200); await wait(800); };
const E = s => b.evalIn('(async()=>{ ' + s + '; await new Promise(r => setTimeout(r, 700)); return 1; })()');
for (const [w, h, mob] of SIZES) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); const tag = w + 'x' + h, snap = async name => { await b.shot(tag + '-' + name); shots.push([tag, name]); };
  await go('?seed=21'); await snap('menu');
  await E("__ds.pickDuelist('kael'); __ds.start()"); await wait(2500); await E('__ds.game.god = true'); await snap('run-calm');
  await E('const g = __ds.game; __ds.fillSwarm && __ds.fillSwarm(200)'); await wait(1200); await snap('run-horde');
  await E('const g = __ds.game; g.pendingLevels = (g.pendingLevels || 0) + 1; g.xp = 1e9'); await wait(1200); await snap('levelup');
  await E('const g = __ds.game; g.offer = null; g.opts.offers = false; __ds.setMode && __ds.setMode("play")'); await wait(600);
  await E('const g = __ds.game; g.sc = g.stageSpec.clock - 0.5'); await wait(2200); await snap('run-boss');
  await E('const g = __ds.game, bs = g.sp.find(s => s.alive && s.role === "gate"); if (bs) g.damageSpecial(bs, 1e9, bs.x, bs.z, {})'); await wait(2500); await snap('run-overtime');
  await E('__ds.setMode && __ds.setMode("pause")'); await snap('pause');
  await E('__ds.setMode && __ds.setMode("play")'); await E('const g = __ds.game; g.god = false; g.p.hp = 1; g.hurtPlayer(999, true, "test")'); await wait(2500); await snap('death');
}
// one sheet per size
for (const [w, h] of SIZES) { const tag = w + 'x' + h, mine = shots.filter(s => s[0] === tag), cw = w > h ? 480 : 206, ch = Math.round(cw * h / w);
  await b.send('Emulation.setDeviceMetricsOverride', { width: cw * 4, height: (ch + 22) * Math.ceil(mine.length / 4), deviceScaleFactor: 1, mobile: false });
  const imgs = mine.map(s => 'data:image/png;base64,' + readFileSync(out + '/' + s[0] + '-' + s[1] + '.png').toString('base64'));
  await b.evalIn(`(async()=>{ document.open(); document.write('<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,${cw}px)">' + ${JSON.stringify(imgs)}.map((s, i) => '<div><div style="color:#ddd;font:12px sans-serif;height:22px;line-height:22px;padding-left:4px">' + ${JSON.stringify(mine.map(s => s[1]))}[i] + '</div><img src="' + s + '" style="width:${cw}px;height:${ch}px;display:block"></div>').join('') + '</body>'); document.close(); await new Promise(r => setTimeout(r, 900)); return 1; })()`);
  await b.shot('sheet-' + tag); }
console.log('sheets in', out); process.exit(0);
