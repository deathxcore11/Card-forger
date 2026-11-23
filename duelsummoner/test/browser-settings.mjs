import { launch, wait } from './cdp.mjs';
import { visibleRows, TABS, defaultFor } from '../src/ui/settings-schema.js';
// Settings drawn from the schema: for every device class and tab the rows on screen equal the schema's rows, a click writes the value, and the legacy rows still apply live.   node test/browser-settings.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=3&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await wait(3000);
let bad = 0; await b.evalIn('window.__showAllRows = true; 1');
for (const cls of ['phone', 'thor', 'portal', 'pc']) for (const tab of TABS) {
  const n = await b.evalIn(`(()=>{ window.__deviceClass = '${cls}'; document.body.dataset.mode = 'start'; __ds.menus.showSettings('${tab}'); return document.querySelectorAll('#menuBody .srow').length; })()`);
  const want = visibleRows(tab, { cls, pad: false, dual: true, gyro: false, keyboard: false, signedIn: false, values: { onScreenControls: defaultFor('onScreenControls', cls), gyroLook: false } }).length;
  if (n !== want) { bad++; console.log('MISMATCH', cls, tab, 'on screen', n, 'schema', want); }
}
console.log('dev view: row counts match the schema for 4 classes x 6 tabs:', bad === 0 ? 'Pass' : 'Fail ' + bad);
await b.evalIn('window.__showAllRows = false; 1');
const player = JSON.parse(await b.evalIn(`(()=>{ const out = {}; for (const cls of ['phone', 'thor', 'portal', 'pc']) { window.__deviceClass = cls; __ds.menus.showSettings('game'); out[cls] = { tabs: [...document.querySelectorAll('[data-stab]')].map(x => x.dataset.stab), rows: [...document.querySelectorAll('#menuBody .srow')].length, notConnected: /not connected/.test(document.body.innerText) }; } return JSON.stringify(out); })()`));
console.log('player view (no dev flag):', JSON.stringify(player), Object.values(player).every(p => !p.notConnected) ? 'Pass: no dead rows' : 'Fail');
await b.evalIn(`(()=>{ window.__deviceClass = 'pc'; __ds.menus.showSettings('display'); return 1; })()`);
console.log('click Detail Low ->', await b.evalIn(`(()=>{ document.querySelector('.seg[data-row=detail] button[data-v=low]').click(); return JSON.stringify({ detail: window.__dsDetail, saved: __ds.save ? __ds.save.settings.detail : 'n/a' }); })()`));
console.log('click Reduce motion On ->', await b.evalIn(`(()=>{ __ds.menus.showSettings('access'); document.querySelector('.seg[data-row=reduceMotion] button[data-v=true]').click(); return document.body.classList.contains('rm'); })()`));
await b.evalIn(`(async()=>{ document.body.dataset.mode = 'start'; __ds.pickDuelist('kael'); __ds.start(); await new Promise(r => setTimeout(r, 2000)); return 1; })()`);
console.log('connected rows act:', await b.evalIn(`(()=>{ window.__deviceClass = 'pc'; const D = __ds, out = {}; const click = (tab, row, v) => { D.menus.showSettings(tab); const e = document.querySelector('.seg[data-row=' + row + '] button[data-v=' + v + ']'); e.click(); };
  click('game', 'damageNumbers', 'off'); out.dmgOff = D.fx.dmgMode; click('game', 'damageNumbers', 'big'); out.dmgBig = D.fx.dmgMode;
  D.menus.showSettings('controls'); const sl = document.querySelector('input[data-row=mouseLook]'); sl.value = 10; sl.dispatchEvent(new Event('input')); out.mouseMult = D.input.mult.mouse;
  click('controls', 'invertMouse', 'true'); out.invMouseY = D.input.inv.mouse.y;
  D.input.enabled = true; D.input.pitch = 0.2; D.input.look(0, 4, 'mouse'); const inv = D.input.pitch - 0.2; click('controls', 'invertMouse', 'false'); D.input.pitch = 0.2; D.input.look(0, 4, 'mouse'); const norm = D.input.pitch - 0.2; out.pitchInverted = inv * norm < 0; out.inv = inv; out.norm = norm; out.mult = D.input.mult.mouse; D.input.mult.mouse = 1; D.input.pitch = 0.2; D.input.look(0, 4, 'mouse'); out.speed10vs5 = +(norm / (D.input.pitch - 0.2)).toFixed(2);
  return JSON.stringify(out); })()`));console.log('Big moments:', await b.evalIn(`(async()=>{ window.__deviceClass = 'pc'; const D = __ds; D.menus.showSettings('access'); document.querySelector('.seg[data-row=reduceMotion] button[data-v=false]').click(); const out = { defaultGentleIsOff: D.fx.gentle === false }; D.menus.showSettings('access'); document.querySelector('.seg[data-row=bigMoments] button[data-v=full]').click(); out.fullGentle = D.fx.gentle; D.menus.showSettings('access'); document.querySelector('.seg[data-row=bigMoments] button[data-v=gentle]').click(); out.gentleAgain = D.fx.gentle; D.menus.showSettings('access'); document.querySelector('.seg[data-row=bigMoments] button[data-v=full]').click(); D.menus.showSettings('access'); document.querySelector('.seg[data-row=reduceMotion] button[data-v=true]').click(); out.reduceForcesGentle = D.fx.gentle; document.querySelector('.seg[data-row=reduceMotion] button[data-v=false]').click(); const g1 = D.fx.moment('tablebreak', 'A', { hitstop: 0.1 }, {}); out.tablebreakScreenWhenFull = g1.screen; D.menus.showSettings('access'); const mk = document.querySelector('.seg[data-row=duelistMarker] button[data-v=false]'); mk.click(); out.markerOff = window.__dsMarker; return JSON.stringify(out); })()`));
for (const [cls, tab, w, h, mob, name] of [['pc', 'game', 1280, 720, false, 'game_pc'], ['phone', 'controls', 844, 390, true, 'controls_phone'], ['thor', 'controls', 1280, 720, false, 'controls_thor'], ['pc', 'display', 960, 540, false, 'display_pc'], ['phone', 'access', 844, 390, true, 'access_phone']]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); await wait(300);
  await b.evalIn(`(()=>{ window.__deviceClass = '${cls}'; document.body.dataset.mode = 'start'; __ds.menus.showSettings('${tab}'); return 1; })()`); await wait(700); await b.shot('settings_' + name);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(bad ? 1 : 0), 300);
