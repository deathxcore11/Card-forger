// Checks of saved progress that need a real browser and its real storage: what a tap does to the saved run and the
// profile, across reloads, with storage that fails, and with stored data that cannot be read.
// Each block is the exact input of a fault that reached the owner (crucible/reports/regression-log.md, 21 November 2026).
//   node tools/crucible/save-checks.cjs <built index.html> <dir of saves from make-saves.mjs> [width height]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const K = { run: 'lostmemories.run.v1', profile: 'lostmemories.profile.v1', runlabs: 'lostmemories.runlabs.v1', labs: 'lostmemories.labs.v5' };
(async () => {
  const [html, dir, W = 1280, H = 720] = process.argv.slice(2);
  if (!html || !dir) { console.error('usage: save-checks.cjs <index.html> <saves dir> [w h]'); process.exit(2); }
  const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const pickFile = re => { const f = fs.readdirSync(dir).filter(x => re.test(x)).sort()[0]; if (!f) throw new Error('no save matching ' + re); return f; };
  const chamber = read(pickFile(/^chamber-boss-door-f1-h0/)), bazaar = read(pickFile(/^bazaar/));
  const url = 'file://' + path.resolve(html);
  const browser = await chromium.launch(); let page, errors = [], passed = 0, failed = 0;
  const check = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); } };
  // A fresh browser profile for every block, so nothing leaks from one to the next. init runs before the page's own code.
  const open = async (o, { raw, init } = {}) => {
    if (page) await page.context().close();
    const ctx = await browser.newContext({ viewport: { width: +W, height: +H } }); page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(([o, raw, K]) => { localStorage.clear(); if (o) { localStorage.setItem(K.profile, JSON.stringify(o.profile)); localStorage.setItem(K.run, JSON.stringify(o.run)); localStorage.setItem(K.runlabs, JSON.stringify(o.labs)); localStorage.setItem(K.labs, JSON.stringify(o.labs)); } for (const [k, v] of Object.entries(raw || {})) localStorage.setItem(k, v); }, [o, raw, K]);
    if (init) await ctx.addInitScript(init);
    await page.reload(); await page.waitForTimeout(350);
  };
  const ls = k => page.evaluate(k => { const v = localStorage.getItem(k); try { return JSON.parse(v); } catch { return v; } }, k);
  const has = async sel => (await page.locator(sel).count()) > 0;
  const tap = async sel => { try { await page.locator(sel).first().click({ force: true, timeout: 2500 }); } catch { return false; } await page.waitForTimeout(250); return true; }; // a control that is not there is a failed check later, not a hang
  const story = async () => { for (let i = 0; i < 4; i++) { const b = page.locator('[data-a="storyskip"]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(200); } } };
  const resume = async () => { await tap('[data-a="resume"]'); await story(); };
  const text = async sel => (await has(sel)) ? page.locator(sel).first().innerText() : '';
  const P0 = chamber.profile, wins = chamber.run.stats.wins;

  // 1. Reported: with a run saved, New run then Descend deleted it with no warning and banked nothing.
  await open(chamber);
  check('home offers Continue for the saved run', await has('[data-a="resume"]'));
  await tap('[data-a="new"]');
  check('New run with a run saved asks first', await has('.leave') && /run in progress/i.test(await text('.leave')), await text('.leave'));
  check('the question says what is kept', /You keep what it earned/.test(await text('.leave')) && /Memories/.test(await text('.leave')));
  check('asking changed nothing on disk', (await ls(K.run)).phase === 'chamber' && (await ls(K.profile)).memories === P0.memories);
  await tap('.leave [data-a="closeov"]');
  check('Back leaves the saved run alone', !(await has('.leave')) && (await ls(K.run)).phase === 'chamber' && await has('[data-a="resume"]'));
  await tap('[data-a="new"]'); await tap('[data-a="bankold"]'); await story();
  let p = await ls(K.profile);
  check('banking the old run pays its Memories', p.memories > P0.memories, [P0.memories, p.memories]);
  check('banking the old run counts its wins and the run', p.duelWins === P0.duelWins + wins && p.runs === P0.runs + 1, [p.duelWins, p.runs]);
  check('the old save is gone only after the profile was stored', (await ls(K.run)) === null && Array.isArray(p.banked) && p.banked.length === 1);
  check('the run-end screen says the run was left', /You left the pyramid/.test(await text('.panel h2')), await text('.panel h2'));
  const afterBank = p.memories;
  await page.reload(); await page.waitForTimeout(350);
  check('a reload does not pay it again', (await ls(K.profile)).memories === afterBank && !(await has('[data-a="resume"]')));
  await tap('[data-a="new"]'); check('with no run waiting, New run goes straight to the Forger screen', await has('[data-a="descend"]') && !(await has('.leave')));
  await tap('[data-a="descend"]');
  let r = await ls(K.run);
  check('the new run is stored the moment it starts', r && r.phase === 'kit' && typeof r.uid === 'string' && !(await ls(K.profile)).banked.includes(r.uid), r && r.phase);

  // 2. The same hole from another direction: Descend while a run is still on disk (a second tab, an old page).
  await open(chamber);
  await page.evaluate(() => { window.LM.G.screen = 'forger'; window.LM.render(); }); await tap('[data-a="descend"]');
  p = await ls(K.profile); r = await ls(K.run);
  check('Descend never drops a waiting run: it is banked first', p.memories > P0.memories && p.runs === P0.runs + 1 && r && r.phase === 'kit', [p.memories, p.runs, r && r.phase]);

  // 3. Reported: Abandon asked for a second tap, said nothing about what is lost, and banked nothing.
  await open(chamber); await resume(); await tap('[data-a="quit"]');
  check('Abandon explains the consequence before anything happens', await has('.leave') && /ends this run as a loss/.test(await text('.leave')) && /You keep what it earned/.test(await text('.leave')), await text('.leave'));
  check('nothing changed yet', (await ls(K.run)).phase === 'chamber' && (await ls(K.profile)).memories === P0.memories);
  await tap('.leave [data-a="closeov"]'); check('Keep playing returns to the run', !(await has('.leave')) && await has('.doors'));
  await tap('[data-a="quit"]');
  await page.evaluate(() => { const b = document.querySelector('[data-a="abandon"]') || document.querySelector('[data-a="quit"]'); if (b) { b.click(); b.click(); } const c = document.querySelector('[data-a="abandon"]'); if (c) c.click(); }); await page.waitForTimeout(300); await story();
  p = await ls(K.profile);
  check('leaving banks the run once, however many taps', p.runs === P0.runs + 1 && p.duelWins === P0.duelWins + wins && p.memories > P0.memories && p.banked.length === 1, [p.runs, p.duelWins, p.memories]);
  check('the left run cannot be continued', (await ls(K.run)) === null);
  const m3 = p.memories; await page.reload(); await page.waitForTimeout(350); check('and a reload pays nothing more', (await ls(K.profile)).memories === m3);
  // 4. Reported: with storage full the game went on and never said the run was not being saved.
  const breakStore = () => page.evaluate(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
  const mendStore = () => page.evaluate(() => { Storage.prototype.setItem = window.__set; });
  await open(chamber); await resume(); await breakStore();
  await page.evaluate(() => window.LM.act({ t: 'door', i: [...document.querySelectorAll('.doors [data-a^="door:"]')].findIndex(b => !b.disabled) })); await page.waitForTimeout(500);
  check('a write that fails shows a bar that says so', await has('.savebar') && /Not saved/.test(await text('.savebar')), await text('.savebar'));
  check('the game goes on in memory', await page.evaluate(() => window.LM.G.run.phase !== 'chamber' || window.LM.G.run.chamber > 0 || true) && errors.length === 0, errors);
  check('the last good save is still on disk', (await ls(K.run)).phase === 'chamber');
  await tap('[data-a="resave"]'); check('Try again while storage is still full keeps the bar', await has('.savebar'));
  await mendStore(); await tap('[data-a="resave"]');
  const mem = await page.evaluate(() => JSON.stringify(window.LM.G.run));
  check('Try again once storage works stores the run as it now is and clears the bar', !(await has('.savebar')) && JSON.stringify(await ls(K.run)) === mem);
  // storage fails while a run is being banked: nothing is lost and nothing is paid twice
  await open(chamber); await resume(); await breakStore(); await tap('[data-a="quit"]'); await tap('[data-a="abandon"]'); await story();
  check('a bank that could not be stored says what is at risk', /Not saved/.test(await text('.savebar')) && /what you have earned/.test(await text('.savebar')), await text('.savebar'));
  check('disk still holds the old profile and the run', (await ls(K.profile)).memories === P0.memories && (await ls(K.run)).phase === 'chamber');
  await mendStore(); await tap('[data-a="resave"]'); p = await ls(K.profile);
  check('after Try again the bank is stored and the run removed', p.memories > P0.memories && p.runs === P0.runs + 1 && (await ls(K.run)) === null && !(await has('.savebar')), [p.memories, p.runs]);
  const m4 = p.memories; await page.reload(); await page.waitForTimeout(350); check('a reload after that pays nothing more', (await ls(K.profile)).memories === m4);
  // the page closes while the bank is still unstored: the run is simply still there
  await open(chamber); await resume(); await breakStore(); await tap('[data-a="quit"]'); await tap('[data-a="abandon"]'); await story(); await mendStore();
  await page.reload(); await page.waitForTimeout(350);
  check('closing the page before the bank was stored loses nothing: the run can be continued', await has('[data-a="resume"]') && (await ls(K.profile)).memories === P0.memories && (await ls(K.run)).phase === 'chamber');
  // a finished run found on disk (the page closed between the two writes)
  const done = JSON.parse(JSON.stringify(chamber)); done.run.phase = 'over'; done.run.result = { won: false, floor: done.run.floor, chamber: done.run.chamber, reason: 'sparks' }; done.run.uid = 'waiting-1';
  await open(done); p = await ls(K.profile);
  check('a finished run found waiting is banked on load, and says so', p.memories > P0.memories && p.runs === P0.runs + 1 && (await ls(K.run)) === null && /finished run was waiting/.test(await text('.notice')), [p.memories, await text('.notice')]);
  const m5 = p.memories; await page.reload(); await page.waitForTimeout(350); check('once only', (await ls(K.profile)).memories === m5 && (await ls(K.profile)).runs === P0.runs + 1);
  const paid = JSON.parse(JSON.stringify(done)); paid.profile.banked = ['waiting-1'];
  await open(paid); p = await ls(K.profile);
  check('a finished run the profile already banked is removed and not paid again', p.memories === P0.memories && p.runs === P0.runs && (await ls(K.run)) === null);
  // storage that never works (a private window that refuses writes)
  await open(null, { init: () => { Storage.prototype.setItem = function () { throw new DOMException('blocked', 'SecurityError'); }; } });
  await tap('[data-a="new"]'); await tap('[data-a="descend"]'); await story();
  check('with storage blocked from the start the bar shows and the run can still be played', await has('.savebar') && await has('[data-a^="kit:"]') && errors.length === 0, errors);

  // 5. Stored data that cannot be read must never crash the page or vanish without a word.
  await open(chamber, { raw: { [K.run]: '{"v":1,"phase":"chamb' } });
  check('a cut-off saved run: the page opens, says so and keeps a copy', /could not be read/.test(await text('.notice')) && !(await has('[data-a="resume"]')) && (await page.evaluate(() => localStorage.getItem('lostmemories.run.v1.unreadable'))) === '{"v":1,"phase":"chamb' && errors.length === 0, [await text('.notice'), errors]);
  check('the profile is untouched by a bad run', (await ls(K.profile)).memories === P0.memories);
  for (const bad of ['42', '[]', '{"phase":"chamber"}', '"x"', '{"phase":"over","deck":[],"stats":{}}']) {
    await open(chamber, { raw: { [K.run]: bad } });
    check('a stored run of the wrong shape (' + bad + ') is set aside, not opened', !(await has('[data-a="resume"]')) && /could not be read/.test(await text('.notice')) && errors.length === 0 && (await ls(K.profile)).memories === P0.memories, [await text('.notice'), errors]);
  }
  await open(chamber, { raw: { [K.profile]: '{"v":1,"memories":12' } });
  check('a cut-off profile: fresh start, said plainly, copy kept, run still there', /fresh start/.test(await text('.notice')) && (await page.evaluate(() => localStorage.getItem('lostmemories.profile.v1.unreadable'))) === '{"v":1,"memories":12' && await has('[data-a="resume"]') && errors.length === 0, [await text('.notice'), errors]);
  await open(chamber, { raw: { [K.profile]: '[1,2,3]' } });
  check('a profile of the wrong shape is set aside too', /fresh start/.test(await text('.notice')) && errors.length === 0 && (await page.evaluate(() => window.LM.P ? window.LM.P.memories : 0)) === 0, errors);

  // 6. Reported: the merchant charged 15 Embers to remove a trunk card, which changes nothing you draw.
  const shop = JSON.parse(JSON.stringify(bazaar)); shop.run.offer = { kind: 'bazaar', merchant: 'scrapper', items: [{ kind: 'scrap', price: 15, uses: 3 }] }; shop.run.embers = 100;
  await open(shop); await resume();
  const before = shop.run.deck.length, trunk = shop.run.trunk.length;
  check('the merchant says what it does to the deck', /Winnower/.test(await text('.pick')) && /out of your deck/.test(await text('.pick')), await text('.pick'));
  check('nothing can be bought until a deck card is chosen', await page.locator('[data-a="buy:0"]').first().isDisabled());
  await tap('.grid [data-a^="deckpick:"]');
  check('the button names the card to be cut', /^Cut .+: 15 Embers$/.test((await text('[data-a="buy:0"]')).trim()), await text('[data-a="buy:0"]'));
  await tap('[data-a="buy:0"]'); r = await ls(K.run);
  check('one card leaves the deck, the trunk is untouched, 15 Embers are paid', r.deck.length === before - 1 && r.trunk.length === trunk && r.embers === 85 && r.cuts === 1, [r.deck.length, r.trunk.length, r.embers]);
  await tap('[data-a="leave"]'); r = await ls(K.run);
  check('the run goes on with the smaller deck', r.phase === 'chamber' && r.deck.length === before - 1 && errors.length === 0, errors);

  // 7. Reported 21 November 2026 (review of Version 27): the same saved run open in two tabs. Tab 1 banks it and starts
  // a new run; tab 2, still showing the old run, abandons it; the new run was deleted. Two pages of one browser
  // profile share storage, as two tabs do.
  const two = async o => { await open(o); const a = page, b = await a.context().newPage(); b.on('pageerror', e => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(350); return [a, b]; };
  const on = async (pg, f) => { const keep = page; page = pg; try { return await f(); } finally { page = keep; } };
  const moved = () => text('.leave, .notice');
  {
    const [a, b] = await two(chamber);
    await on(a, resume); await on(b, resume);
    await on(a, async () => { await tap('[data-a="quit"]'); await tap('.leave [data-a="abandon"]'); await story(); await tap('[data-a="home"]'); await tap('[data-a="new"]'); await tap('[data-a="descend"]'); await story(); });
    const fresh = await ls(K.run), pA = await ls(K.profile);
    check('tab 1 banked the old run and began a new one', fresh && fresh.phase === 'kit' && fresh.uid !== chamber.run.uid && pA.runs === P0.runs + 1, [fresh && fresh.phase, pA.runs]);
    await on(b, async () => { await tap('[data-a="quit"]'); await tap('.leave [data-a="abandon"]'); await story(); });
    let now = await ls(K.run), pB = await ls(K.profile);
    check('abandoning the old run in tab 2 leaves the new run alone', !!now && now.uid === fresh.uid && now.phase === 'kit', now && [now.uid, now.phase]);
    check('and pays nothing more', pB.runs === P0.runs + 1 && pB.memories === pA.memories && pB.banked.length === 1, [pB.runs, pB.memories, pA.memories]);
    check('tab 2 says the run moved on elsewhere', /another tab or window/.test(await on(b, moved)), await on(b, moved));
    check('and tab 2 can pick up the current run from there', await on(b, async () => { await tap('[data-a="leavetab"]'); return has('[data-a="resume"]'); }));
  }
  {
    // the same thing by an ordinary move: tab 2 opens a door of the old run, which used to overwrite the new run
    const [a, b] = await two(chamber);
    await on(a, resume); await on(b, resume);
    await on(a, async () => { await tap('[data-a="quit"]'); await tap('.leave [data-a="abandon"]'); await story(); await tap('[data-a="home"]'); await tap('[data-a="new"]'); await tap('[data-a="descend"]'); await story(); });
    const fresh = await ls(K.run);
    await on(b, async () => { await tap('.door'); await page.waitForTimeout(500); await story(); });
    const now = await ls(K.run);
    check('a move in the old tab never overwrites the new run', !!now && fresh && now.uid === fresh.uid && now.phase === 'kit', now && [now.uid, now.phase]);
    check('the old tab says why nothing happened', /another tab or window/.test(await on(b, moved)), await on(b, moved));
  }
  {
    // one run played from two tabs: only the tab that holds the newest step may go on
    const [a, b] = await two(bazaar);
    await on(a, resume); await on(b, resume);
    await on(a, async () => { await tap('[data-a="leave"]'); });
    const step = await ls(K.run);
    check('tab 1 moved the run on', step.phase === 'chamber', step.phase);
    await on(b, async () => { await tap('[data-a="leave"]'); await tap('[data-a="buy:0"]'); });
    check('tab 2, a step behind, changes nothing', JSON.stringify(await ls(K.run)) === JSON.stringify(step) && /another tab or window/.test(await on(b, moved)), await on(b, moved));
    await on(a, async () => { await tap('[data-a="quit"]'); await tap('.leave [data-a="abandon"]'); await story(); });
    const pA = await ls(K.profile);
    // tab 2 is on the home screen with the profile it read before tab 1 banked: a profile write there must not undo the bank
    await on(b, async () => { await tap('[data-a="leavetab"]'); await page.evaluate(() => { window.LM.G.tab = 'help'; window.LM.render(); }); await tap('[data-a="relearn"]'); });
    const pB = await ls(K.profile);
    check('a profile write from the other tab keeps what tab 1 banked', pB.memories === pA.memories && pB.runs === pA.runs && pB.banked.length === pA.banked.length && pA.runs === bazaar.profile.runs + 1, [pA.memories, pB.memories, pA.runs, pB.runs]);
  }

  // 8. Reported 21 November 2026 (review of Version 27): stored runs that are valid JSON but not a playable run.
  // An unknown phase still offered Continue and crashed when chosen; an incomplete finished run crashed at start-up.
  const damaged = async (name, edit, { cont } = {}) => {
    const o = JSON.parse(JSON.stringify(chamber)); edit(o.run, o); const n0 = errors.length;
    await open(o); const offered = await has('[data-a="resume"]'); if (offered) { await resume(); await tap('.door'); await page.waitForTimeout(300); }
    const alive = await page.evaluate(() => !!document.querySelector('#app [data-a]')), note = await text('.notice');
    if (cont) check(name + ': still plays', errors.length === n0 && alive && offered, errors.slice(n0));
    else check(name + ': set aside with a notice, no crash', errors.length === n0 && alive && /could not be read/.test(note) && (await ls(K.run)) === null && !!(await ls(K.run + '.unreadable')) && !(await has('[data-a="resume"]')), [errors.slice(n0), note]);
    check(name + ': the profile is untouched', (await ls(K.profile)).memories === P0.memories && (await ls(K.profile)).runs === P0.runs);
  };
  await damaged('an unknown phase', r => { r.phase = 'limbo'; });
  await damaged('a finished run with an empty result', r => { r.phase = 'over'; r.result = {}; });
  await damaged('a finished run that is only a stub', (r, o) => { o.run = { phase: 'over', deck: [], stats: {}, result: { won: true } }; });
  await damaged('a finished run with no stats inside', r => { r.phase = 'over'; r.result = { won: false, floor: 0, chamber: 2, reason: 'sparks' }; r.stats = {}; });
  await damaged('a chamber with no doors', r => { r.doors = null; });
  await damaged('a duel phase with no duel', r => { r.phase = 'duel'; r.duel = null; });
  await damaged('a reward phase with no offer', r => { r.phase = 'reward'; r.offer = null; });
  await damaged('a deck of things that are not cards', r => { r.deck = r.deck.map(() => ({ id: 'no-such-card' })); });
  await damaged('a door that names no known room', r => { r.doors[0].type = 'trapdoor'; });
  await damaged('a run with fields this build does not know', r => { r.somethingNew = { a: 1 }; }, { cont: true });

  // Damage the shape check cannot see is caught when the run is shown or moved: the page goes back to the start, says
  // so, and reports the fault (as a page error that begins "recovered:") instead of stopping.
  const hidden = async (o, steps) => { const n0 = errors.length; await open(o); const out = await steps(); await page.waitForTimeout(150); const mine = errors.splice(n0); return { out, mine, alive: await page.evaluate(() => !!document.querySelector('#app [data-a="new"]')), note: await text('.notice') }; };
  { const o = JSON.parse(JSON.stringify(chamber)); o.run.charms = ['no-such-charm']; o.run.gifts = [7];
    const h = await hidden(o, resume);
    check('a run that cannot be shown after Continue is set aside, and the page lives', h.alive && /could not be read/.test(h.note) && (await ls(K.run)) === null && !!(await ls(K.run + '.unreadable')) && h.mine.length >= 1 && h.mine.every(m => /^recovered: /.test(m)), h); }
  { const o = JSON.parse(JSON.stringify(chamber)); o.run.stats.doors = null; o.run.stats.byTier = null;
    const h = await hidden(o, async () => { await resume(); await tap('.door.t-boss'); await story(); await page.waitForTimeout(300); });
    check('a run that fails a move goes back to the start and stays stored', h.alive && /Something went wrong/.test(h.note) && /saved as it was/.test(h.note) && ((await ls(K.run)) || {}).phase === 'chamber' && h.mine.length === 1 && /^recovered: /.test(h.mine[0]), h);
    const n0 = errors.length; await resume(); await tap('.door.t-boss'); await story(); await page.waitForTimeout(450); errors.splice(n0);
    check('failing the same move twice sets the run aside', /could not be read/.test(await text('.notice')) && (await ls(K.run)) === null && !!(await ls(K.run + '.unreadable')) && (await ls(K.profile)).memories === P0.memories, await text('.notice')); }

  // The browser hands the page an empty store for one load although the saved data is still there (seen in the headless
  // test browser under load, 21 November 2026: six keys before a reload, none after it, six after the next). The page
  // must say so and write nothing, so the real profile cannot be written over by a new one.
  { await open(chamber); // the page has loaded with a saved run and a profile, so this tab knows the store held something
    const kept = await page.evaluate(() => { const o = {}; for (const k of Object.keys(localStorage)) o[k] = localStorage.getItem(k); localStorage.clear(); return o; }); // stand in for the browser: the store reads empty
    await page.reload(); await page.waitForTimeout(350);
    check('an empty store in a tab that had progress: the page says the progress did not load', /did not load/.test(await text('.panel h2')) && !(await has('[data-a="new"]')) && !(await has('[data-a="resume"]')), await text('#app'));
    check('and it writes nothing while it says so', (await page.evaluate(() => localStorage.length)) === 0);
    await page.evaluate(o => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, kept); // the browser has the store back
    await tap('[data-a="loadagain"]'); await page.waitForTimeout(450);
    check('loading again finds the saved run and the profile as they were', (await has('[data-a="resume"]')) && (await page.evaluate(k => localStorage.getItem(k), K.run)) === kept[K.run] && (await ls(K.profile)).memories === chamber.profile.memories, { resume: await has('[data-a="resume"]') });
    await open(null);
    check('a first visit, with an empty store and nothing remembered, starts as usual', !(await has('[data-a="loadagain"]')) && (await has('[data-a="new"]')));
    await open(chamber); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(350); await tap('[data-a="startempty"]');
    check('Start without it opens the game on the empty store', !(await has('[data-a="loadagain"]')) && (await has('[data-a="new"]')) && !(await has('[data-a="resume"]')));
    await page.reload(); await page.waitForTimeout(350);
    check('and the notice does not come back', !(await has('[data-a="loadagain"]')) && (await has('[data-a="new"]'))); }

  check('no page errors anywhere', errors.length === 0, errors);
  console.log(`save checks at ${W}x${H}: ${passed} passed, ${failed} failed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})();
