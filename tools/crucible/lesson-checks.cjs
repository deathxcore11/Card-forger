// Browser checks of the first lessons and the "What happened" list after a lost duel.
//   node tools/crucible/lesson-checks.cjs <built index.html> <a duel save from make-saves.mjs> [width height]
// A lesson must name cards that are in the hand, the taps it names must do what it says, a learned lesson must
// not come back, and a profile that has played before must not see lessons unless it asks for them again.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, saveFile, W = 1280, H = 720] = process.argv.slice(2);
  if (!html || !saveFile) { console.error('usage: lesson-checks.cjs <index.html> <duel-save.json> [w h]'); process.exit(2); }
  const eng = p => import(path.resolve(__dirname, '../../crucible/engine', p));
  const { loadDb, roleOf } = await eng('cards.mjs'); const { planChain } = await eng('duel.mjs'); const db = loadDb();
  // cards for the three lessons, found in the pool, never typed: a pair that melds into more than either, a fuel card,
  // and two monsters that fizzle together
  const mons = db.pool.cards.filter(c => c.kind === 'monster' && c.atk >= 800 && c.atk <= 1500).slice(0, 220);
  let pair = null, dud = null;
  for (const a of mons) { for (const b of mons) { if (a.id === b.id) continue; const p = planChain(db, [{ id: a.id }, { id: b.id }], null);
    if (!pair && !p.fizzles && p.melded && db.byId.get(p.final.id).atk > Math.max(a.atk, b.atk)) pair = [a, b, db.byId.get(p.final.id)];
    if (!dud && p.fizzles && planChain(db, [{ id: b.id }, { id: a.id }], null).fizzles) dud = [a, b]; if (pair && dud) break; } if (pair && dud) break; }
  const fuel = db.pool.cards.find(c => roleOf(db, c.id) === 'fuel');
  const base = JSON.parse(fs.readFileSync(saveFile, 'utf8')); const url = 'file://' + path.resolve(html);
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let uid = 9000, passed = 0, failed = 0;
  const check = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log('FAIL', name, detail ? JSON.stringify(detail) : ''); } };
  const start = async (hand, profile, tweak) => {
    const o = JSON.parse(JSON.stringify(base)), d = o.run.duel; d.mon[0] = d.mon[0].map(() => null); d.mon[1] = d.mon[1].map(() => null);
    d.hand[0] = hand.map(c => ({ u: uid++, id: c.id })); d.played = false; d.attacked = false; d.pending = null; d.active = 0; if (tweak) tweak(d, o);
    Object.assign(o.profile, profile);
    await page.goto(url);
    await page.evaluate(o => { localStorage.clear(); localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, o);
    await page.reload(); await page.waitForTimeout(400); await page.locator('[data-a="resume"]').first().click(); await page.waitForTimeout(700);
    for (let i = 0; i < 3; i++) { const b = page.locator('[data-a="closeov"], [data-a="storyskip"]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(250); } }
  };
  const tap = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ force: true, timeout: 2500 }); await page.waitForTimeout(300); return true; };
  const lesson = () => page.evaluate(() => { const l = document.querySelector('.lesson'); return { text: l ? l.textContent : null, pips: [...document.querySelectorAll('.hs .pip')].map(p => [+p.textContent, p.closest('.c').querySelector('.nm').textContent]).sort((a, b) => a[0] - b[0]), tips: window.LM.P.tips || null }; });
  const settle = async () => { for (let i = 0; i < 40; i++) { if (!(await page.evaluate(() => window.LM.G.playing))) break; await page.waitForTimeout(150); } };
  const fresh = { runs: 0, tips: undefined };

  // 1. the meld lesson: names the two cards, pips on them in order, hides the result, and the taps it names meld
  await start([pair[0], pair[1], fuel], fresh);
  let L = await lesson();
  check('a fresh profile sees the meld lesson', L.text && L.text.includes('First lesson') && L.text.includes(pair[0].name) && L.text.includes(pair[1].name), L);
  check('the lesson does not say what the meld makes', L.text && !L.text.includes(pair[2].name), L.text);
  check('pips 1 and 2 sit on the two cards named, in tap order', L.pips.length === 2 && L.text.indexOf(L.pips[0][1]) < L.text.indexOf(L.pips[1][1]), L.pips);
  for (const [, name] of L.pips) await page.locator('.hs .c', { has: page.locator('.nm', { hasText: name }) }).first().click({ force: true });
  await page.waitForTimeout(300);
  check('with cards picked the tray shows the usual meld line, result unknown', await page.evaluate(() => { const c = document.querySelector('.chain'); return !!c && c.textContent.includes('unknown meld') && !document.querySelector('.lesson'); }));
  await tap('[data-a^="play:"]'); await settle();
  const after = await page.evaluate(() => ({ tips: window.LM.P.tips, mine: window.LM.G.run.duel.mon[0].filter(Boolean).map(m => m.id), stored: JSON.parse(localStorage.getItem('lostmemories.profile.v1')).tips }));
  check('the taps the lesson named made the meld', after.mine.length === 1 && after.mine[0] === pair[2].id, after);
  check('the meld lesson is learned and stored', after.tips && after.tips.meld === 1 && after.stored && after.stored.meld === 1, after);

  // 2. the fuel lesson comes next and its taps add +300
  await start([pair[0], fuel], { runs: 0, tips: { meld: 1 } });
  L = await lesson();
  check('the fuel lesson follows', L.text && L.text.includes('Second lesson') && L.text.includes(fuel.name) && L.pips.length === 2 && L.pips[0][1] === pair[0].name && L.pips[1][1] === fuel.name, L);
  for (const [, name] of L.pips) await page.locator('.hs .c', { has: page.locator('.nm', { hasText: name }) }).first().click({ force: true });
  await page.waitForTimeout(300); await tap('[data-a^="play:"]'); await settle();
  const f = await page.evaluate(() => { const d = window.LM.G.run.duel, m = d.mon[0].find(Boolean), v = document.querySelector('.side:not(.top) .slot .st') || document.querySelector('.slot .st'); return { id: m && m.id, st: [...document.querySelectorAll('[data-zone^="0:"] .st')].map(x => x.textContent), tips: window.LM.P.tips }; });
  check('fuel added +300 ATK and DEF, as the lesson said', f.id === pair[0].id && f.st.includes(`${pair[0].atk + 300}/${pair[0].def + 300}`), f);
  check('the fuel lesson is learned', f.tips && f.tips.fuel === 1, f.tips);

  // 3. the single lesson: one card that already beats every monster the rival shows. (Until 21 November 2026 it said
  //    nothing in the hand could make more than the strongest monster, which an Equip or fuel in the hand made false.)
  const strong = dud[0].atk >= dud[1].atk ? dud[0] : dud[1];
  const prey = [...db.byId.values()].filter(c => db.isMonster(c.id) && c.attr === strong.attr && c.atk <= strong.atk - 400 && c.atk >= 100).sort((x, y) => y.atk - x.atk)[0];
  const equip = [...db.byId.values()].find(c => !db.isMonster(c.id) && c.name === 'Dragon Treasure') || null;
  await start([dud[0], dud[1]], { runs: 0, tips: { meld: 1, fuel: 1 } });
  check('with no rival monster on the table there is no third lesson to give', (await lesson()).text === null, await lesson());
  await start([dud[0], dud[1]].concat(equip ? [equip] : []), { runs: 0, tips: { meld: 1, fuel: 1 } }, d => { d.mon[1][0] = { u: uid++, id: prey.id, pos: 'a', veil: false, att: 0, moved: false }; });
  L = await lesson();
  check('against a weaker monster, the lesson is to play the strongest alone', L.text && L.text.includes('Third lesson') && L.pips.length === 1 && db.byName.get(L.pips[0][1]).atk === Math.max(dud[0].atk, dud[1].atk), L);
  check('and it says only what is true: this card beats what the rival shows', L.text && /already beats every monster the rival has on the table/.test(L.text) && !/Nothing in this hand/.test(L.text) && strong.atk > prey.atk, L.text);
  await page.locator('.hs .c', { has: page.locator('.nm', { hasText: L.pips[0][1] }) }).first().click({ force: true }); await page.waitForTimeout(300); await tap('[data-a^="play:"]'); await settle();
  check('the single lesson is learned by doing it', await page.evaluate(() => (window.LM.P.tips || {}).single === 1));
  check('with all three learned no lesson shows', (await lesson()).text === null && (await lesson()).pips.length === 0);

  // 4. "No more lessons", and asking for them again from the Rules page
  await start([pair[0], pair[1]], fresh);
  await tap('[data-a="tipsoff"]'); L = await lesson();
  check('No more lessons hides them for good', L.text === null && L.tips && L.tips.meld && L.tips.fuel && L.tips.single, L);
  await page.evaluate(() => { window.LM.G.tab = 'help'; window.LM.render(); }); await page.waitForTimeout(200);
  check('the Rules page offers the lessons again', await tap('[data-a="relearn"]'));
  L = await lesson(); check('and they come back', L.text && L.text.includes('First lesson'), L);

  // 5. a profile that has played before is not lectured
  await start([pair[0], pair[1]], { runs: 7, tips: undefined });
  check('a profile with runs behind it sees no lesson', (await lesson()).text === null);

  // 6. a lost duel says what happened: a guardian duel entered through its door, so the page saw all of it
  const cham = JSON.parse(fs.readFileSync(path.join(path.dirname(saveFile), 'chamber-boss-door-f1-h0.json'), 'utf8')); Object.assign(cham.profile, { runs: 7 });
  await page.goto(url);
  await page.evaluate(o => { localStorage.clear(); localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, cham);
  await page.reload(); await page.waitForTimeout(400); await tap('[data-a="resume"]'); await page.waitForTimeout(500);
  const counsel = () => page.evaluate(() => { const c = document.querySelector('.door.t-boss .counsel'); return c ? c.textContent : null; });
  const c1 = await counsel(); check("a guardian not yet beaten shows counsel on its door", !!c1 && /Counsel/.test(c1), c1);
  await page.evaluate(() => { const L = window.LM; L.P.beaten = [L.G.run.doors.find(d => d.type === 'boss').boss]; L.render(); });
  check('a guardian already beaten shows none', (await counsel()) === null);
  await page.evaluate(() => { window.LM.P.beaten = []; window.LM.render(); });
  await tap('.door.t-boss'); await settle(); for (let i = 0; i < 4; i++) { if (!(await tap('[data-a="storyskip"]'))) break; } await settle();
  const law = await page.evaluate(id => { const L = window.LM, d = L.G.run.duel; if (!d) return null; d.lp[0] = 100; d.hand[0] = [{ u: 99999, id }]; d.mon[0] = d.mon[0].map(() => null); L.render(); return L.G.run.rival.law; }, dud[0].id);
  check('the guardian duel began through its door', !!law, law);
  for (let i = 0; i < 16; i++) { if (await page.evaluate(() => !window.LM.G.run.duel)) break; if (await page.locator('[data-a="respond:-1"]').count()) await tap('[data-a="respond:-1"]'); else await tap('[data-a="end"]'); await settle(); }
  await page.waitForTimeout(500);
  const why = await page.evaluate(() => ({ over: !window.LM.G.run.duel, title: (document.querySelector('.modal h2') || {}).textContent, lines: [...document.querySelectorAll('.why li')].map(l => l.textContent) }));
  check('the lost duel ends with a What happened list', why.over && why.title === 'Defeat' && why.lines.length >= 2 && why.lines.length <= 3, why);
  check('it says the player did not meld', why.lines.some(l => /did not meld/.test(l)), why.lines);
  check("its last line is about this guardian's Law", /ground|ties/.test(why.lines[why.lines.length - 1] || ''), why.lines);

  check('no page errors', errors.length === 0, errors);
  console.log(`lesson checks at ${W}x${H}: ${passed} passed, ${failed} failed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error('lesson checks stopped before the end: ' + (e && e.message)); process.exit(3); }); // twice seen while the click bot was loading the same machine; this names the step next time
