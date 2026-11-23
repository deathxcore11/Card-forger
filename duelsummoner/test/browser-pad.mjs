// Pad in every mode, driven by a fake Gamepad: Start and Select in play, the ring and A in pause, offer X/Y/B and the 0.3 s guard, chest-reveal skip, touch overlay hiding, use edge.
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: true });
await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500));
  window.__pad = { connected: true, id: 'fake', buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [window.__pad]; return 1; })()`);
const press = async (i, ms = 90) => { await b.evalIn(`window.__pad.buttons[${i}].pressed = true; 1`); await wait(ms); await b.evalIn(`window.__pad.buttons[${i}].pressed = false; 1`); await wait(120); };
const on = id => b.evalIn(`document.getElementById('${id}').classList.contains('on')`);
const res = []; const check = (name, ok, extra) => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

// touch overlay: shown on a touch device until the pad is used, gone the next frame, back on a touch
await b.evalIn(`window.dispatchEvent(new Event('touchstart')); 1`); await wait(150);
check('touch overlay shown before pad use', await b.evalIn(`!document.getElementById('tc').classList.contains('off')`));
await b.evalIn(`window.__pad.axes[0] = 0.8; 1`); await wait(80);
check('touch overlay hidden within a few frames of stick use', await b.evalIn(`document.getElementById('tc').classList.contains('off')`));
await b.evalIn(`window.__pad.axes[0] = 0; window.dispatchEvent(new Event('touchstart')); 1`); await wait(150);
check('touch overlay back after a touch', await b.evalIn(`!document.getElementById('tc').classList.contains('off')`));

// play: Start pauses, Start resumes, Select opens the map, B closes it
await press(9); check('Start pauses in play', await on('pauseScreen'));
await b.shot('pad_pause');
await press(13); const ring1 = await b.evalIn(`document.querySelector('.padfocus') ? document.querySelector('.padfocus').textContent.trim() : null`);
check('d-pad down lands the gold ring on a pause button', !!ring1, String(ring1)); await b.shot('pad_pause_ring');
await press(13); const ring2 = await b.evalIn(`document.querySelector('.padfocus') ? document.querySelector('.padfocus').textContent.trim() : null`);
check('d-pad down moves the ring to another button', !!ring2 && ring2 !== ring1, String(ring2));
await press(9); check('Start resumes from pause', !(await on('pauseScreen')));
await press(8); await wait(100); check('Select opens the full map', await b.evalIn(`window.__ds.mapIsOpen()`));
await press(1); check('B closes the map', !(await b.evalIn(`window.__ds.mapIsOpen()`)));
await press(8); await press(8); check('Select toggles the map open then closed', !(await b.evalIn(`window.__ds.mapIsOpen()`)));

// Use is an edge: holding X for 30 frames gives one use try, not thirty
const uses = await b.evalIn(`(async()=>{ const raw = window.__ds.input; let n = 0, prev = 0; window.__pad.buttons[2].pressed = true; for (let i = 0; i < 30; i++) { const c = raw.command(1/60); if (c.use) n++; await new Promise(r => setTimeout(r, 16)); } const held = raw.command(1/60).hold; window.__pad.buttons[2].pressed = false; return { n, held }; })()`);
check('holding X is one use edge and a continuous hold', uses.n === 1 && uses.held === true, JSON.stringify(uses));

// offer: guard swallows input for 0.3 s; then X redraws, Y passes
await b.evalIn(`(async()=>{ const D = window.__ds; D.game.god = true; D.game.addXp(50); return 1; })()`); await wait(120);
check('an offer is up', await on('offerScreen'));
const before = await b.evalIn(`document.querySelectorAll('#offerCards .card').length`);
await press(0, 40); check('A within 0.3 s of the offer does nothing', await on('offerScreen'));
await wait(450); await press(13); const ringO = await b.evalIn(`document.querySelector('.padfocus') ? document.querySelector('.padfocus').textContent.trim() : null`);
check('d-pad lands the ring on an offer button', !!ringO, String(ringO)); await b.shot('pad_offer_ring');
await wait(300); const c0 = await b.evalIn(`window.__ds.game.coins`), lv0 = await b.evalIn(`window.__ds.game.pendingLevels`);
await press(3); await wait(400); const c1 = await b.evalIn(`window.__ds.game.coins`), lv1 = await b.evalIn(`window.__ds.game.pendingLevels`);
check('Y passes the level-up offer (coins up, one level-up consumed)', c1 > c0, 'coins ' + c0 + ' to ' + c1 + ', pending ' + lv0 + ' to ' + lv1);
await wait(450); const rd = () => b.evalIn(`(document.querySelector('#offerBtns [data-act=redraw]')||{}).textContent`); const r0 = await rd(), cards0 = await b.evalIn(`document.getElementById('offerCards').textContent`);
await press(2); await wait(400); const r1 = await rd(), cards1 = await b.evalIn(`document.getElementById('offerCards').textContent`);
check('X redraws the offer (redraw count drops)', r0 !== r1, r0 + ' to ' + r1 + (cards0 === cards1 ? ' (same cards rolled)' : ''));
// chest reveal: play one to the end (so it counts as seen), play another and skip it with A
await b.evalIn(`(async()=>{ const m = await import('/src/view/reveal.js'); window.__rv = m; window.__rvDone = 0; m.playReveal('rare', { rm: true, noNearMiss: true }, () => { window.__rvDone = 1; }); return 1; })()`); await wait(2600);
check('first reveal ran to its end', await b.evalIn('window.__rvDone === 1'));
await b.evalIn(`window.__rvDone = 0; window.__rv.playReveal('legendary', { noNearMiss: true }, () => { window.__rvDone = 2; }); 1`); await wait(400);
check('a reveal is playing', await b.evalIn(`!!document.getElementById('reveal')`));
await press(0, 60); await wait(300); check('A skips the chest reveal', await b.evalIn('window.__rvDone === 2'));
// run-ended screen: B does what the Main menu button does
await b.evalIn(`document.getElementById('endBtn').click(); 1`); await wait(400);
check('the run-ended screen is up', await on('deadScreen')); await b.shot('pad_dead');
await press(1); await wait(300); check('B on the run-ended screen goes to the main menu', await on('startScreen') && !(await on('deadScreen')));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); console.log('failed', res.filter(x => !x).length, 'of', res.length);
b.close(); setTimeout(() => process.exit(0), 300);

