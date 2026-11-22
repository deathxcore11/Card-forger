// Browser checks of the layout for a phone held sideways.
//   node tools/crucible/phone-checks.cjs <built index.html> <saves dir from make-saves.mjs> [width height]
// What a player must read to choose (the hand, the attack forecast, a reward) has a least size on the glass, every
// button is tall enough for a finger, nothing a screen shows lies outside the stage, and the duel table does not move
// when cards are picked. The sizes are CSS px after the stage is scaled, measured on a 915 x 412 screen unless told otherwise.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, dir, W = 915, H = 412] = process.argv.slice(2);
  if (!html || !dir) { console.error('usage: phone-checks.cjs <index.html> <saves dir> [w h]'); process.exit(2); }
  const url = 'file://' + path.resolve(html); const pick = re => fs.readdirSync(dir).filter(f => re.test(f)).sort()[0];
  const f = +W / 915; // the least sizes shrink with a narrower screen; they are stated for 915
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let passed = 0, failed = 0;
  const check = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log('FAIL', name, detail !== undefined ? JSON.stringify(detail) : ''); } };
  const tap = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ force: true, timeout: 2500 }).catch(() => {}); await page.waitForTimeout(300); return true; };
  const load = async (file, profile) => { const o = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); Object.assign(o.profile, { runs: 7 }, profile || {});
    await page.goto(url);
    await page.evaluate(o => { localStorage.clear(); localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, o);
    await page.reload(); await page.waitForTimeout(400); await tap('[data-a="resume"]'); await page.waitForTimeout(400);
    for (let i = 0; i < 4; i++) if (!(await tap('[data-a="storyskip"]'))) break; await tap('[data-a="closeov"]'); };
  // the least text size among the elements a selector finds, the least button height, and anything outside the stage
  const look = sel => page.evaluate(sel => { const app = document.querySelector('#app'), A = app.getBoundingClientRect(), k = A.width / app.offsetWidth;
    const shown = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const els = sel ? [...document.querySelectorAll(sel)].filter(shown) : [];
    const px = els.map(e => +(parseFloat(getComputedStyle(e).fontSize) * k).toFixed(1));
    const btn = [...app.querySelectorAll('button')].filter(shown).filter(b => !b.closest('.door') && !b.classList.contains('door') && !b.classList.contains('lab')).map(b => +b.getBoundingClientRect().height.toFixed(1));
    const out = [...app.querySelectorAll('button, .c, .pick, .panel, .who, .rules, .logbox, .board, .tray, .dtxt, .hud')].filter(shown).filter(e => { const p = e.closest('.panel, .hall'); const r = e.getBoundingClientRect(); if (e.closest('.hall') && !e.matches('.hud')) { const h = e.closest('.hall').getBoundingClientRect(); if (r.bottom > h.bottom + 1 || r.top < h.top - 1) return false; } return r.left < A.left - 1 || r.right > A.right + 1 || r.top < A.top - 1 || r.bottom > A.bottom + 1; }).map(e => e.className.toString().slice(0, 30));
    return { phone: app.classList.contains('phone'), n: els.length, least: px.length ? Math.min(...px) : null, button: btn.length ? Math.min(...btn) : null, out, scale: +k.toFixed(3) }; }, sel);
  const show = !!process.env.SHOW; // SHOW=1 prints every measure, for the report
  const atLeast = (name, r, px) => { if (show) console.log(`  ${name}: ${r.least} px (least allowed ${(px * f).toFixed(1)}), buttons from ${r.button} px`); return atLeastCheck(name, r, px); };
  const atLeastCheck = (name, r, px) => check(`${name}: at least ${px} px (${(px * f).toFixed(1)} here)`, r.n > 0 && r.least >= px * f - 0.05, { found: r.n, least: r.least });
  const fits = (name, r) => { check(`${name}: nothing outside the stage`, r.out.length === 0, r.out.slice(0, 5)); check(`${name}: every button at least 30 px tall (${(30 * f).toFixed(1)} here)`, r.button === null || r.button >= 30 * f - 0.05, r.button); };

  // 1. the duel: the hand, the numbers on the table, the panel, and that the table does not move
  await load('duel-regular-f1-h0.json');
  let r = await look('.hs .c .nm'); check('a sideways phone gets the phone stage', r.phone === true, r);
  atLeast('names of hand cards', r, 9.5); atLeast('numbers on hand cards', await look('.hs .c .st'), 12); atLeast('numbers on table cards', await look('.slot .c .st'), 11);
  atLeast('the line above the duel buttons', await look('.trayline'), 11); atLeast('Life Points', await look('.lp'), 22); atLeast('the duel rules box', await look('.rules span'), 10.5);
  fits('duel', await look(''));
  const boxes = () => page.evaluate(() => ['.board', '.tray', '.hand', '.actions', '.top .who', '.bot .who', '.rules', '.logbox'].map(s => { const e = document.querySelector(s); if (!e) return s + ' missing'; const b = e.getBoundingClientRect(); return [s, Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(' '); }).join(' | '));
  const before = await boxes(); await tap('.hs .c'); await page.locator('.hs .c').nth(1).click({ force: true }).catch(() => {}); await page.waitForTimeout(300);
  const picked = await boxes(); check('picking hand cards moves no box of the table', before === picked, { before, picked });
  fits('duel with cards picked', await look(''));

  // 2. choosing a target: the forecast is readable and does not cover either Life Points box
  await load(pick(/^duel-boss-f2/) || pick(/^duel-boss/)); await tap('.slot.ready');
  r = await look('.fc'); atLeast('the attack forecast', r, 10.5);
  check('the forecast covers no Life Points box', await page.evaluate(() => { const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; const who = [...document.querySelectorAll('.who')].map(e => e.getBoundingClientRect()); return [...document.querySelectorAll('.fc')].every(e => { const b = e.getBoundingClientRect(); return !who.some(w => hit(b, w)); }); }));
  check('a defender shows its numbers upright', await page.evaluate(() => { const s = document.querySelector('.slot .c.def .st'); if (!s) return true; const b = s.getBoundingClientRect(); return b.width > b.height; }));

  // 3. rewards and the rooms between duels
  for (const [name, re, sel, px] of [['Gift choice', /^reward-gift/, '.pick .relic', 11.5], ['card reward', /^reward-card/, '.pick > .c .nm', 9.5], ['guardian reward', /^reward-guardian/, '.pick .relic, .pick > .c .nm', 9.5], ['treasure', /^reward-treasure/, '.pick .relic, .pick > .c .nm', 9.5], ['bazaar', /^bazaar/, '.pick > .c .nm', 9.5], ['charm choice', /^charm/, '.pick .relic', 11.5], ['starter kits', /^kit/, '.kit p', 11], ['chamber', /^chamber-f1/, '.dtxt', 11], ['guardian door', /^chamber-boss-door-f1-h0/, '.dtxt', 11], ['anvil', /^anvil/, '.grid .c .nm', 8]]) {
    const file = pick(re); if (!file) { check(name + ': a save to look at', false); continue; }
    await load(file); r = await look(sel); atLeast(name, r, px); fits(name, r);
  }
  await load(pick(/^reward-card/));
  check('the three cards on offer stand side by side', await page.evaluate(() => { const p = [...document.querySelectorAll('.picks > .pick')].map(e => e.getBoundingClientRect()); return p.length >= 2 && p.every(b => Math.abs(b.top - p[0].top) < 2) && p[p.length - 1].bottom <= document.querySelector('#app').getBoundingClientRect().bottom; }));

  // 4. the home screen: no Lab switch is squeezed shorter than its words
  await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); // a first visit: the tab remembers nothing either await page.reload(); await page.waitForTimeout(400);
  // With the Era look on the switches fold behind one "Lab switches" button on the title screen (22 November): the
  // title screen must fit as it is, and the switches are measured once that button opens them.
  if (await page.locator('[data-a="labsopen"]').count()) { r = await look('.home button'); fits('title screen', r); await tap('[data-a="labsopen"]'); }
  r = await look('.lab'); atLeast('Lab switches', r, 9.5); fits('home', r);
  check('no Lab switch is shorter than its words', await page.evaluate(() => [...document.querySelectorAll('.lab')].every(e => e.scrollHeight <= e.clientHeight + 1)));

  // 5. a duel rules box with more text than it can show says so, keeps its place when the screen is drawn again, and
  //    a tap puts away the last message so it cannot lie over the screen the tap opens
  const long = pick(/^duel-cursed-f2-h10/) || pick(/^duel-.*h10/);
  if (!long) check('rules box: a Heat 10 duel to look at', false); else { await load(long);
    const rules = () => page.evaluate(() => { const e = document.querySelector('.rules'); return { over: e.scrollHeight > e.clientHeight + 2, more: e.classList.contains('more'), at: Math.round(e.scrollTop), cue: getComputedStyle(e, '::after').content }; });
    r = await rules(); check('a rules box that needs scrolling says more is below', r.over && r.more && /more below/.test(r.cue), r);
    await page.evaluate(() => { document.querySelector('.rules').scrollTop = 20; }); await page.waitForTimeout(150);
    await page.evaluate(() => { window.LM.G.toast = 'A message'; window.LM.render(); }); await tap('.hs .c');
    r = await rules(); check('the rules box keeps its place when a card is picked', r.at === 20, r);
    check('a tap puts away the last message', await page.evaluate(() => document.querySelector('#toast').textContent === ''));
    await page.evaluate(() => { const e = document.querySelector('.rules'); e.scrollTop = e.scrollHeight; }); await page.waitForTimeout(150);
    r = await rules(); check('scrolled to its end the rules box stops saying so', !r.more, r); }

  // 6. a wide screen keeps the wide stage
  const wide = await browser.newPage({ viewport: { width: 1280, height: 720 } }); await wide.goto(url); await wide.waitForTimeout(300);
  check('a 1280 x 720 screen keeps the wide stage', await wide.evaluate(() => !document.querySelector('#app').classList.contains('phone') && document.querySelector('#app').offsetWidth === 1600)); await wide.close();

  check('no page errors', errors.length === 0, errors);
  console.log(`phone checks at ${W}x${H}: ${passed} passed, ${failed} failed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error('phone checks stopped before the end: ' + (e && e.message)); process.exit(3); });
