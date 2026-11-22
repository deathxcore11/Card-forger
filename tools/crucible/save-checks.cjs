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
  // Until 21 November 2026 Descend ended and banked the waiting run without asking. With two tabs that ends a run the
  // other tab is playing, so it asks the same question as New run, and changes nothing until it is answered.
  check('Descend never drops or ends a waiting run: it asks first', (await has('[data-a="bankold"]')) && (await has('.leave [data-a="resume"]')) && p.memories === P0.memories && p.runs === P0.runs && JSON.stringify(r) === JSON.stringify(chamber.run), [p.memories, p.runs, r && r.phase]);
  await tap('[data-a="bankold"]'); await story(); p = await ls(K.profile);
  check('and the answer "Bank it and start a new run" banks it once', p.memories > P0.memories && p.runs === P0.runs + 1 && !(await ls(K.run)), [p.memories, p.runs]);

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
  const UID0 = chamber.run.uid || 'r' + chamber.run.seed; // a run saved before runs had names is named after its seed
  const two = async o => { await open(o); const a = page, b = await a.context().newPage(); b.on('pageerror', e => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(350); return [a, b]; };
  const on = async (pg, f) => { const keep = page; page = pg; try { return await f(); } finally { page = keep; } };
  const moved = () => text('.leave, .notice');
  {
    const [a, b] = await two(chamber);
    await on(a, resume); await on(b, resume);
    await on(a, async () => { await tap('[data-a="quit"]'); await tap('.leave [data-a="abandon"]'); await story(); await tap('[data-a="home"]'); await tap('[data-a="new"]'); await tap('[data-a="descend"]'); await story(); });
    const fresh = await ls(K.run), pA = await ls(K.profile);
    check('tab 1 banked the old run and began a new one', fresh && fresh.phase === 'kit' && fresh.uid !== UID0 && pA.runs === P0.runs + 1, [fresh && fresh.phase, pA.runs]);
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

  // 9. Reported 21 November 2026 (review of the updated build): two more ways an older tab could end or write over a
  // newer run. (a) The question "You have a run in progress" stays open in tab 1 while tab 2 banks that run and begins
  // a new one; "Bank it and start a new run" in tab 1 then ended the new run. (b) A write fails in tab 1, tab 2 begins a
  // new run, and Try again (or the next move) in tab 1 wrote the old run over the new one.
  const startNew = async () => { await tap('[data-a="new"]'); await tap('[data-a="bankold"]'); await story(); await tap('[data-a="home"]'); await tap('[data-a="new"]'); await tap('[data-a="descend"]'); await story(); };
  {
    const [a, b] = await two(chamber);
    await on(a, async () => { await tap('[data-a="new"]'); });
    check('tab 1 is asked about the run in progress', await on(a, () => has('[data-a="bankold"]')));
    await on(b, startNew);
    const fresh = await ls(K.run), p1 = await ls(K.profile);
    check('tab 2 banked that run and began a new one', fresh && fresh.phase === 'kit' && fresh.uid !== UID0 && p1.runs === P0.runs + 1, [fresh && fresh.phase, p1.runs]);
    await on(a, async () => { await tap('[data-a="bankold"]'); await story(); });
    let now = await ls(K.run), p2 = await ls(K.profile);
    check('the old question in tab 1 does not end the new run', !!now && now.uid === fresh.uid && now.phase === 'kit', now && [now.uid, now.phase]);
    check('and banks nothing', p2.runs === P0.runs + 1 && p2.memories === p1.memories && p2.banked.length === 1, [p2.runs, p2.memories, p1.memories]);
    check('tab 1 says the run moved on', /moved on/i.test(await on(a, moved)), await on(a, moved));
  }
  { // the same question, and the same run carried on in the other tab: the numbers the question showed are old
    const [a, b] = await two(chamber);
    await on(a, async () => { await tap('[data-a="new"]'); });
    await on(b, async () => { await resume(); await page.evaluate(() => window.LM.act({ t: 'door', i: [...document.querySelectorAll('.doors [data-a^="door:"]')].findIndex(x => !x.disabled) })); await page.waitForTimeout(500); });
    const carried = await ls(K.run);
    await on(a, async () => { await tap('[data-a="bankold"]'); await story(); });
    const now = await ls(K.run), p2 = await ls(K.profile);
    check('a question about a run that was carried on elsewhere ends nothing', !!now && (now.uid || 'r' + now.seed) === UID0 && now.phase === carried.phase && now.phase !== 'over' && p2.runs === P0.runs && (p2.banked || []).length === (P0.banked || []).length, [now && now.phase, carried.phase, p2.runs]);
    check('and tab 1 says the run moved on', /moved on/i.test(await on(a, moved)), await on(a, moved));
  }
  for (const how of ['Try again', 'the next move']) {
    const [a, b] = await two(chamber);
    await on(a, async () => { await resume(); await breakStore(); await page.evaluate(() => window.LM.act({ t: 'door', i: [...document.querySelectorAll('.doors [data-a^="door:"]')].findIndex(x => !x.disabled) })); await page.waitForTimeout(500);
      if (how !== 'Try again') await page.evaluate(() => window.addEventListener('storage', e => e.stopImmediatePropagation(), true)); }); // a tab that never hears of the other tab's writes (asleep in the background)
    const mine = await on(a, () => page.evaluate(() => JSON.stringify(window.LM.G.run)));
    check('tab 1 could not save and says so (' + how + ')', await on(a, () => has('.savebar')));
    await on(b, startNew);
    const fresh = await ls(K.run), p1 = await ls(K.profile);
    check('tab 2 began a new run meanwhile', fresh && fresh.phase === 'kit' && fresh.uid !== UID0, fresh && fresh.phase);
    await on(a, async () => { await mendStore(); if (how === 'Try again') await tap('[data-a="resave"]'); else { await page.evaluate(() => { try { const d = [...document.querySelectorAll('[data-a]')].find(x => /^(door|pick|kit|skip|end)/.test(x.dataset.a) && !x.disabled); if (d) d.click(); } catch (e) { } }); await page.waitForTimeout(500); } });
    const now = await ls(K.run), p2 = await ls(K.profile);
    check(how + ' in tab 1 does not write the old run over the new one', !!now && now.uid === fresh.uid && now.phase === 'kit', now && [now.uid, now.phase]);
    check('and the profile is as tab 2 left it', p2.runs === p1.runs && p2.memories === p1.memories && p2.banked.length === p1.banked.length, [p2.runs, p1.runs]);
    check('tab 1 says the run moved on and no longer offers to save it', /moved on/i.test(await on(a, moved)) && /could not save its last moves/.test(await on(a, moved)) && !(await on(a, () => has('.savebar'))), [await on(a, moved), await on(a, () => page.evaluate(() => window.LM.unsaved && window.LM.unsaved()))]);
    check('and a copy of what tab 1 could not save is kept on the device', /A copy of it was kept/.test(await on(a, moved)) && JSON.stringify(await ls(K.run + '.unsaved')) === mine, Object.keys((await ls(K.run + '.unsaved')) || {}).length);
  }
  { // the same with a run that tab 1 finished but could not bank: tab 2 banks the stored run and begins a new one
    const [a, b] = await two(chamber);
    await on(a, async () => { await resume(); await breakStore(); await tap('[data-a="quit"]'); await tap('.leave [data-a="abandon"]'); await story(); });
    check('tab 1 ended its run and could not store that', await on(a, () => has('.savebar')) && (await ls(K.run)).phase === 'chamber' && (await ls(K.profile)).runs === P0.runs);
    await on(b, startNew);
    const fresh = await ls(K.run), p1 = await ls(K.profile);
    await on(a, async () => { await mendStore(); await tap('[data-a="resave"]'); });
    const now = await ls(K.run), p2 = await ls(K.profile);
    check('Try again on a finished run does not write it over the new run', !!now && now.uid === fresh.uid && now.phase === 'kit', now && [now.uid, now.phase]);
    check('and the old run is banked once, with nothing tab 2 stored undone', p2.runs === P0.runs + 1 && p2.banked.filter(u => u === UID0).length === 1 && p2.memories >= p1.memories && !(await on(a, () => has('.savebar'))), [p2.runs, p2.memories, p1.memories, p2.banked, await on(a, () => page.evaluate(() => window.LM.unsaved && window.LM.unsaved()))]);
  }
  { // one tab only: a failed write followed by Try again still stores the run, as before
    await open(chamber); await resume(); await breakStore();
    await page.evaluate(() => window.LM.act({ t: 'door', i: [...document.querySelectorAll('.doors [data-a^="door:"]')].findIndex(x => !x.disabled) })); await page.waitForTimeout(500);
    const inMem = await page.evaluate(() => JSON.stringify(window.LM.G.run));
    await mendStore(); await tap('[data-a="resave"]');
    check('with no other tab, Try again stores the run this tab holds', JSON.stringify(await ls(K.run)) === inMem && !(await has('.savebar')) && !/moved on/i.test(await moved()));
  }

  // The Lab switches (regression log, 21 November 2026): Versions 30 and 31 had the rules of Equips that differ and Two
  // builds a run but no switch for them on the home screen, because the screen drew a list of its own.
  { await open(null);
    const words = await page.evaluate(() => window.LM.labWords ? window.LM.labWords() : []), missing = [];
    for (const k of words) if (!(await has(`[data-a="lab:${k}"]`))) missing.push(k);
    check('every Lab switch the page has words for is on the home screen', words.length >= 19 && !missing.length, { words: words.length, missing });
    await tap('[data-a="lab:builds"]');
    check('a tap turns Two builds a run on, and it is kept', (await has('[data-a="lab:builds"].on')) && (await ls(K.labs)).builds === true);
    await page.reload(); await page.waitForTimeout(350);
    check('and it is still on after a reload', await has('[data-a="lab:builds"].on'));
    await tap('[data-a="new"]'); await tap('[data-a="descend"]'); await story();
    check('a run started with it on names its two builds on the kit screen', /This descent carries/.test(await text('.veins')) && (await page.evaluate(() => (window.LM.G.run.builds || []).length)) === 2, await text('.veins'));
    await open(null); await tap('[data-a="lab:depth"]');
    const c = await page.evaluate(() => { const c = window.LM.db.config; return { eq: !!c.equipKinds, builds: c.runBuilds, free: c.freeCast, traps: c.kitTraps }; });
    check('the depth set turns on Equips that differ, Two builds a run and Free Trap', c.eq && c.builds === 2 && c.free === 'trap' && c.traps === 2, c);
    check('and shows those three switches as on', (await has('[data-a="lab:equips"].on')) && (await has('[data-a="lab:builds"].on')) && (await has('[data-a="lab:trap"].on')));
    await tap('[data-a="lab:depth"]');
    const d = await page.evaluate(() => { const c = window.LM.db.config; return { eq: !!c.equipKinds, builds: c.runBuilds, free: c.freeCast, traps: c.kitTraps }; });
    check('turning the depth set off turns them off again', !d.eq && !d.builds && !d.free && !d.traps && !(await has('[data-a="lab:equips"].on')), d); }

  // Odd Gift at the Bazaar (Lab switch "odd", 21 November 2026). The switch is tapped on the home screen; the stall is
  // checked on saved games the engine made with the switch on (ODDSAVES=<dir from make-saves.mjs <dir> ...,builds,odd>).
  { await open(null); await tap('[data-a="lab:odd"]');
    check('the Odd Gift switch is on the home screen and sets its price', (await has('[data-a="lab:odd"].on')) && (await page.evaluate(() => window.LM.db.config.bazaarOdd)) === 70);
    await tap('[data-a="lab:odd"]'); check('and off again', (await page.evaluate(() => window.LM.db.config.bazaarOdd)) === 0);
    const od = process.env.ODDSAVES, all = od ? fs.readdirSync(od).filter(n => /^bazaar-/.test(n)).map(n => JSON.parse(fs.readFileSync(path.join(od, n), 'utf8'))).filter(o => o.run.offer.items.some(it => it.kind === 'gift')) : [];
    const rich = all.find(o => o.run.embers >= o.run.offer.items.find(it => it.kind === 'gift').price), poor = all.find(o => o.run.embers < o.run.offer.items.find(it => it.kind === 'gift').price);
    check('saved Bazaars with the odd Gift were given to the checks (ODDSAVES), one that can pay and one that cannot', !!rich && !!poor, { given: all.length });
    if (rich) { const it = rich.run.offer.items.find(x => x.kind === 'gift'), i = rich.run.offer.items.indexOf(it); await open(rich); await resume();
      check('the stall shows the odd Gift, marked as from outside this descent', (await has('.k-gift')) && /From outside this descent/.test(await text('.k-gift')) && /does not count toward your Gifts/.test(await text('.k-gift')), await text('.k-gift'));
      await tap(`[data-a="buy:${i}"]`); const r = await ls(K.run);
      check('a tap buys it: the Gift is held, the Embers are paid, the stall says Sold', r.gifts.includes(it.id) && r.embers === rich.run.embers - it.price && /Sold/.test(await text('.k-gift button')), [r.gifts, r.embers]);
      await page.reload(); await page.waitForTimeout(350); await resume();
      check('and it is still held after a reload, listed with the relics', (await ls(K.run)).gifts.includes(it.id) && (await page.evaluate(id => window.LM.G.run.gifts.includes(id), it.id))); }
    if (poor) { const it = poor.run.offer.items.find(x => x.kind === 'gift'), i = poor.run.offer.items.indexOf(it); await open(poor); await resume();
      check('with too few Embers the button is off and a tap buys nothing', (await page.evaluate(i => document.querySelector(`[data-a="buy:${i}"]`).disabled, i)) && !(await ls(K.run)).gifts.includes(it.id)); } }

  // New table look (Lab switch "table", a preview of 21 November 2026): display only, applies at once to a run in progress.
  { const duel = read(pickFile(/^duel-regular-f1-h0/)); await open(duel);
    const lay = () => page.evaluate(() => { const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }, vis = s => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; };
      const who = r('.top .who'), rules = r('.rules'), tray = r('.hand'), slots = [...document.querySelectorAll('.board .slot')].map(e => e.getBoundingClientRect());
      return { look: !!document.querySelector('.duel.look2'), bar: vis('.who .lpbar'), backs: vis('.who .backs') ? document.querySelectorAll('.top .who .backs u').length : -1, hand: +((document.querySelector('.top .who small') || {}).textContent || '').replace(/^Hand (\d+).*/, '$1'),
        clear: slots.length >= 6 && slots.every(b => b.left >= who.right - 1 && b.right <= rules.left + 1 && b.top >= -1 && b.bottom <= tray.top + 1), n: slots.length }; });
    await resume(); const off = await lay();
    check('without the switch the duel table is drawn as before', !off.look && !off.bar && off.backs === -1 && off.clear, off);
    await tap('[data-a="quit"]'); await page.reload(); await page.waitForTimeout(350);
    await tap('[data-a="lab:table"]'); check('the New table look switch is on the home screen and turns on', (await has('[data-a="lab:table"].on')) && (await ls(K.labs)).table === true);
    await resume(); const on1 = await lay();
    check('with it on, a run already in progress shows the tilted board, life bars and the rival hand as card backs', on1.look && on1.bar && on1.backs === Math.min(on1.hand, 7), on1);
    check('and every zone of the tilted board stays clear of the side panels and the hand', on1.clear, on1);
    const before = JSON.stringify(await ls(K.run)); await page.reload(); await page.waitForTimeout(350);
    check('the switch changes nothing in the saved run', JSON.stringify(await ls(K.run)) === before && (await page.evaluate(() => JSON.stringify(window.LM.db.config))) === (await page.evaluate(() => { const c = window.LM.db.config; return JSON.stringify(c); }))); }

  // Rooms by floor (21 November 2026): floors two and three show their own room behind the doors and the duel when the
  // build holds the pictures, floor one and the home screen stay as they were, and a build without the pictures changes nothing.
  { const src = fs.readFileSync(html, 'utf8'), room = () => page.evaluate(() => { const a = document.querySelector('#app'); return { room: a.dataset.room || '', bg: getComputedStyle(a).backgroundImage }; });
    for (const fl of [1, 2, 3]) for (const [kind, re] of [['doors', new RegExp('^chamber-f' + fl)], ['duel', new RegExp('^duel-regular-f' + fl + '-h0')]]) {
      await open(read(pickFile(re))); await resume(); const got = await room(), file = 'hall-' + kind + '-' + fl, held = fl > 1 && src.includes('"' + file + '"');
      check(`floor ${fl}, ${kind}: ${held ? 'its own room is shown' : 'the first room is shown'}`, held ? got.room === String(fl) && got.bg.includes(file + '.webp') : got.room === '' && got.bg.includes(kind === 'duel' ? 'hall-duel.webp' : 'hall-doors.webp'), got); }
    await tap('[data-a="quit"]'); await page.reload(); await page.waitForTimeout(350); const home = await room();
    check('the home screen keeps the first room', home.room === '' && home.bg.includes('hall-doors.webp'), home); }

  // The first secret (Lab switch "secret", 21 November 2026): the switch, the locked fifth Forger, the chamber of two doors,
  // the hidden duel, the way on, the Rumours box and a guardian's memory, on saved games the engine made with the switch on
  // (SECRETSAVES=<dir from make-saves.mjs <dir> ...,depth,secret>). Every one is reached by taps a person can make.
  { await open(null);
    const cfg = () => page.evaluate(() => ({ s: window.LM.db.config.secretLast, w: window.LM.db.config.loneWatch }));
    await tap('[data-a="new"]');
    check('with the switch off the fifth Forger slot is locked and says it is not in this build', /Not in this build yet/.test(await text('.ch.locked:has-text("The Last One")')), await text('.ch.locked:has-text("The Last One")'));
    await open(null); await tap('[data-a="lab:secret"]'); let c = await cfg();
    check('the Rumours switch is on the home screen and turns the secret and its watch on', (await has('[data-a="lab:secret"].on')) && c.s === 1 && c.w === 1, c);
    await tap('[data-a="new"]');
    check('with it on the locked slot gives the hint and no name of the condition', /Nobody says how/.test(await text('.ch.locked:has-text("The Last One")')) && !/one monster/i.test(await text('.ch.locked:has-text("The Last One")')), await text('.ch.locked:has-text("The Last One")'));
    await open(null); await tap('[data-a="lab:secret"]'); await tap('[data-a="lab:secret"]'); c = await cfg();
    check('and off again', c.s === 0 && c.w === 0 && !(await has('[data-a="lab:secret"].on')), c);
    const sd = process.env.SECRETSAVES, sv = f => sd && fs.existsSync(path.join(sd, f)) ? JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8')) : null;
    const door = sv('chamber-secret-door-f1.json'), win = sv('boss-win-move-f1.json');
    check('saved games with the secret were given to the checks (SECRETSAVES): the chamber of two doors and a guardian one move from falling', !!door && !!win, { sd });
    if (door) {
      await open(door); await resume();
      const doors = await page.locator('.doors .door').allInnerTexts();
      check('the chamber shows exactly two doors, the hidden one first, and no guardian line', doors.length === 2 && /A door that was not there/.test(doors[0]) && /The way on|The way out/.test(doors[1]) && (await has('.doors.pair')) && !(await has('.bossline')), doors);
      await tap('[data-a="door:0"]');
      check('the hidden door: The Last One speaks first', /The Last One/.test(await text('.story h3')) && /door that was not there/.test(await text('.story p')), await text('.story'));
      await story(); await page.waitForTimeout(300);
      const rv = await page.evaluate(() => { const r = window.LM.G.run; return { phase: r.phase, tier: r.rival && r.rival.tier, name: r.rival && r.rival.name }; });
      check('then the hidden duel starts against The Last One', rv.phase === 'duel' && rv.tier === 'secret' && rv.name === 'The Last One', rv);
      check('and the rules box shows its Law', /Alone:/.test(await text('.rules')), await text('.rules'));
      check('the stored run is the hidden duel', (await ls(K.run)).phase === 'duel' && (await ls(K.run)).rival.tier === 'secret');
      await open(door); await resume(); const fl0 = door.run.floor;
      await tap('[data-a="door:1"]'); await story();
      const on = await page.evaluate(() => { const r = window.LM.G.run; return { phase: r.phase, floor: r.floor, secret: (r.doors || []).some(d => d.type === 'secret'), gate: !!r.secondGate }; });
      check('the way on goes on as the run would have, and the hidden door is gone', !on.secret && (on.floor > fl0 || on.gate || on.phase === 'over' || on.phase === 'reward'), on);
      await open(door); await tap('[data-a="screen:codex"]');
      check('the Codex opens with the Rumours box and says what the player came close to', (await has('.rumours')) && /memories heard/.test(await text('.rumours')), await text('.rumours'));
    }
    if (win) {
      await open(win); await resume();
      const name = win.run.rival.name.replace(/^The /, '');
      await page.evaluate(m => window.LM.act(m), win.move);
      for (let i = 0; i < 40 && !(await has('[data-a="closeov"]')); i++) await page.waitForTimeout(250);
      check('the guardian duel ends with the result panel first', await has('[data-a="closeov"]'));
      await tap('[data-a="closeov"]'); for (let i = 0; i < 8 && !(await has('.story')); i++) await page.waitForTimeout(250);
      check('when a guardian falls with the switch on, it leaves a memory', new RegExp('memory, as the ' + name + ' falls', 'i').test(await text('.story h3')), await text('.story'));
      const seen = (await ls(K.profile)).seen || [];
      check('the memory is kept in the profile', seen.some(s => /^memory:/.test(s)), seen);
      await story(); await tap('[data-a="quit"]'); await page.reload(); await page.waitForTimeout(350); await tap('[data-a="screen:codex"]');
      check('and the Codex Rumours box lists it after a reload', new RegExp(name).test(await text('.rumours')) && /1 of \d+ memories heard/.test(await text('.rumours')), await text('.rumours'));
      const off = JSON.parse(JSON.stringify(win)); off.labs.secret = false; await open(off); await resume();
      await page.evaluate(m => window.LM.act(m), win.move); for (let i = 0; i < 12; i++) await page.waitForTimeout(250);
      check('with the switch off the same win leaves no memory', !((await ls(K.profile)).seen || []).some(s => /^memory:/.test(s)) && !/memory, as/i.test(await text('.story h3')), await text('.story h3'));
    } }

  // Counsel in the guardian duel (21 November 2026): the line a guardian's door gives is also shown in the duel tray while
  // the player has nothing picked, until that guardian has been beaten once; the hidden duel always shows it.
  { const boss = read(pickFile(/^duel-boss-f1-h0/)), id = boss.run.door && boss.run.door.boss;
    const fresh = JSON.parse(JSON.stringify(boss)); fresh.profile.beaten = []; await open(fresh); await resume();
    check('a guardian not yet beaten: the duel tray gives its counsel under its own words, which stay (review, 21 November)', /Counsel\./.test(await text('.trayline')) && /Tap hand cards in order/.test(await text('.trayline')), await text('.trayline'));
    await tap('.hs .c'); check('picking a card puts the play in its place', !/Counsel\./.test(await text('.trayline')), await text('.trayline'));
    const done = JSON.parse(JSON.stringify(boss)); done.profile.beaten = [id]; await open(done); await resume();
    check('once that guardian has been beaten, no counsel', !!id && !/Counsel\./.test(await text('.trayline')), { id, tray: await text('.trayline') });
    const sd = process.env.SECRETSAVES, hid = sd && fs.existsSync(path.join(sd, 'duel-secret-f1-h0.json')) ? JSON.parse(fs.readFileSync(path.join(sd, 'duel-secret-f1-h0.json'), 'utf8')) : null;
    if (hid) { await open(hid); await resume(); check('the hidden duel gives counsel on its Law', /Counsel\..*defense/.test(await text('.trayline')), await text('.trayline')); } }

  // Era look (Lab switch "era", 21 November 2026, display only): the studio direction drawn over every screen. Its fog,
  // grain and vignette sit under the page's own elements, so they can never take a tap or cover a number.
  { const duel = read(pickFile(/^duel-regular-f1-h0/)); await open(duel);
    const fx0 = () => page.evaluate(() => [...document.querySelectorAll('#app button')].filter(b => { const r = b.getBoundingClientRect(); if (r.width < 5 || r.height < 5) return false; const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === b || b.contains(e)); }).length);
    const offReach = await fx0();
    await tap('[data-a="lab:era"]'); check('the Era look switch is on the home screen and turns on', (await has('[data-a="lab:era"].on')) && (await ls(K.labs)).era === true && (await page.evaluate(() => document.querySelector('#app').classList.contains('era'))));
    const fx = () => page.evaluate(() => { const app = document.querySelector('#app'), z = s => { const e = document.querySelector(s); return e ? +getComputedStyle(e).zIndex : null; };
      const btns = [...document.querySelectorAll('#app button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(b).visibility !== 'hidden'; });
      const hit = btns.filter(b => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e === b || b.contains(e) || e.closest('.modal, .story, .savebar')); }).length;
      return { layers: ['.eraBg', '.eraFog', '.eraGrain'].map(z), buttons: btns.length, reached: hit, fonts: ['LM Cinzel', 'LM Spectral', 'LM Barlow'].map(f => document.fonts.check('16px "' + f + '"')) }; });
    let f = await fx(); check('on the home screen the fog, grain and vignette lie under everything and every button a tap reaches without it still takes one', f.layers.every(z => z < 0) && f.buttons > 5 && f.reached === offReach, { ...f, offReach });
    await resume(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300); f = await fx();
    check('in a run already in progress the duel is drawn with it, and every button still takes a tap', (await page.evaluate(() => document.querySelector('#app').classList.contains('era'))) && f.reached === f.buttons && f.buttons > 2, f);
    check('its three typefaces come with the game and load', f.fonts.every(Boolean), f.fonts);
    const before = JSON.stringify(await ls(K.run)); await page.reload(); await page.waitForTimeout(350);
    check('the switch changes nothing in the saved run', JSON.stringify(await ls(K.run)) === before);
    const known = read(pickFile(/^chamber-f1/)); known.labs.era = true; await open(known); await resume();
    const kinds = await page.evaluate(() => [...document.querySelectorAll('.door')].map(d => [...d.classList].find(c => /^k-/.test(c))));
    check('each door is marked by how much is known, for its fog', kinds.length >= 2 && kinds.every(Boolean), kinds);
    const held = read(pickFile(/^chamber-f2/)); held.labs.era = true; await open(held); await resume(); await tap('[data-a="tab:relics"]');
    const coins = await page.evaluate(() => [...document.querySelectorAll('.ri')].map(e => e.tagName === 'IMG' ? 'picture' : (/^[A-Z]$/.test(e.dataset.l || '') && getComputedStyle(e, '::after').content === '"' + e.dataset.l + '"' && getComputedStyle(e).borderRadius === '50%' ? 'coin' : 'bare ' + (e.dataset.l || '?'))));
    check('every medallion in the relics list is a picture or, with no picture yet, a worn coin stamped with its first letter', coins.length >= 2 && coins.every(c => c === 'picture' || c === 'coin'), coins);
    const rm = await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: 'reduce' }), pg = await rm.newPage(); pg.on('pageerror', e => errors.push(e.message));
    await pg.goto(url); await pg.evaluate(([o, K]) => { localStorage.clear(); const l = { ...o.labs, era: true }; localStorage.setItem(K.profile, JSON.stringify(o.profile)); localStorage.setItem(K.labs, JSON.stringify(l)); }, [duel, K]); await pg.reload(); await pg.waitForTimeout(350);
    const still = await pg.evaluate(() => ['.eraFog i', '.eraGrain'].map(s => { const e = document.querySelector(s); return e ? getComputedStyle(e).animationName : 'missing'; }));
    check('a device set to less motion gets still fog and still grain', still.every(n => n === 'none'), still); await rm.close(); }

  // A duel's twist is a class on the table (fog, narrow, storm, locked). The Era layers first took the name "fog", so in a Fog
  // duel the whole table went under the page and no card or zone took a tap (found by the click bot on 22 November, before any
  // publish). Every control that takes a tap with the look off must take one with it on, in a duel of every twist.
  { const reach = () => page.evaluate(() => [...document.querySelectorAll('#app [data-a]')].filter(b => { const r = b.getBoundingClientRect(); if (r.width < 5 || r.height < 5 || b.disabled) return false; const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.closest('[data-a]') === b; }).map(b => b.dataset.a));
    for (const tw of ['fog', 'narrow', 'storm', 'locked']) {
      const f = fs.readdirSync(dir).filter(x => /^duel-/.test(x) && !/trap-prompt/.test(x)).sort().find(x => { const r = read(x).run; return r.phase === 'duel' && ((r.rival && r.rival.twist) || (r.duel && r.duel.twist)) === tw; });
      if (!f) { check(`a saved ${tw} duel to try the Era look on`, false); continue; }
      const s = read(f); s.labs.era = false; await open(s); await resume(); const off = await reach();
      s.labs.era = true; await open(s); await resume(); const on = await reach(), lost = off.filter(a => !on.includes(a));
      check(`in a ${tw} duel with the Era look on, every card, zone and button that takes a tap without it still takes one`, (await page.evaluate(() => document.querySelector('#app').classList.contains('era'))) && off.length > 3 && lost.length === 0, { save: f, lost, off: off.length, on: on.length });
      if (tw === 'fog') { await tap('[data-a="hand:0"]'); check('in a Fog duel with the Era look on, tapping a hand card picks it', await page.evaluate(() => window.LM.G.sel.length === 1), { save: f }); }
    } }

  check('no page errors anywhere', errors.length === 0, errors);
  console.log(`save checks at ${W}x${H}: ${passed} passed, ${failed} failed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})();
