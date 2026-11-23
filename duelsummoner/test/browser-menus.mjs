import { launch, wait } from './cdp.mjs';
// The in-run windows and the Settings Detail row at desktop, handheld and phone sizes: the level-up offer, the pause panel (with Detail), the main-menu Settings.   node test/browser-menus.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=3&debug' });
const SIZES = [['desktop', 1920, 1080, false], ['handheld', 1280, 720, false], ['phone', 390, 844, true]];
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2500)); return 1; })()`);
for (const [name, w, h, mob] of SIZES) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); await wait(600);
  await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 1; })()`); await wait(700);
  console.log(name, 'pause open', await b.evalIn(`!!document.querySelector('.pausePanel') && getComputedStyle(document.querySelector('.pausePanel').parentElement).display`)); await b.shot('menus_pause_' + name);
  await b.evalIn(`(()=>{ document.getElementById('resumeBtn').click(); return 1; })()`); await wait(800);
}
for (const [name, w, h, mob] of SIZES) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); await wait(600);
  await b.evalIn(`(async()=>{ const g = __ds.game; g.god = true; g.addXp(1e5); await new Promise(r => setTimeout(r, 1200)); return 1; })()`);
  console.log(name, 'offer open', await b.evalIn(`document.getElementById('offerScreen').classList.contains('on')`)); await wait(900); await b.shot('menus_offer_' + name);
  await b.evalIn(`(()=>{ const c = document.querySelector('#offerCards .card button, #offerCards .card'); if (c) c.click(); return 1; })()`); await wait(600);}
console.log('(old pause Detail row removed: Settings is reached from the Settings action)'); if (false) console.log('click Low ->', await b.evalIn(`(()=>{ document.querySelector('.setDetail button[data-v=low]').click(); return JSON.stringify({ saved: window.__dsDetail, on: [...document.querySelectorAll('.setDetail button.on')].map(x => x.dataset.v) }); })()`));
console.log('detail buttons', await b.evalIn(`JSON.stringify([...document.querySelectorAll('.setDetail button')].map(x => x.dataset.v + (x.classList.contains('on') ? '*' : '')))`));
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
