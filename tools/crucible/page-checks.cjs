// Checks of the built page that need a real browser: what a tap does, not what the engine can do.
// Each one is the exact input of a fault that reached the owner (crucible/reports/regression-log.md).
//   node tools/crucible/page-checks.cjs <built index.html> <a duel save from make-saves.mjs> [width height]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, saveFile, W = 1280, H = 720] = process.argv.slice(2);
  if (!html || !saveFile) { console.error('usage: page-checks.cjs <index.html> <duel-save.json> [w h]'); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(saveFile, 'utf8')); const url = 'file://' + path.resolve(html);
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(300);
  const ids = await page.evaluate(() => { const db = window.LM.db, fx = k => [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === k)[0], n = s => db.byName.get(s).id; return { destroy: fx('destroy'), pump: fx('pump'), heal: fx('heal'), equip: [...db.byId.values()].find(c => c.kind === 'equip').id, weak: n('Mystical Elf'), strong: n('Summoned Skull') }; });
  let uid = 9000, passed = 0, failed = 0; const mon = (id, pos = 'a') => ({ u: uid++, id, pos, veil: false, att: 0, moved: false });
  const start = async (mine, theirs, hand, tweak) => {
    const o = JSON.parse(JSON.stringify(base)), d = o.run.duel; d.mon[0] = [0, 1, 2, 3, 4].map(z => mine[z] || null).slice(0, d.mon[0].length); d.mon[1] = [0, 1, 2, 3, 4].map(z => theirs[z] || null).slice(0, d.mon[1].length);
    d.hand[0] = hand.map(id => ({ u: uid++, id })); d.played = false; d.attacked = false; d.pending = null; d.active = 0; if (tweak) tweak(d);
    await page.goto(url);
    await page.evaluate(o => { localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, o);
    await page.reload(); await page.waitForTimeout(400); await page.locator('[data-a="resume"]').first().click(); await page.waitForTimeout(700);
    for (let i = 0; i < 3; i++) { const b = page.locator('[data-a="closeov"], [data-a="storyskip"]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(250); } }
  };
  const tap = async sel => { await page.locator(sel).first().click({ force: true }); await page.waitForTimeout(250); };
  const table = () => page.evaluate(() => { const d = window.LM.G.run.duel; return { mine: d.mon[0].map(m => m && { id: m.id, ba: m.ba || 0, eq: m.eq || 0 }), theirs: d.mon[1].map(m => m && m.id), insp: !!window.LM.G.inspect }; });
  const check = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log('FAIL', name, detail ? JSON.stringify(detail) : ''); } };

  // Reported 21 November 2026: with a weak and a strong rival monster, picking a destroy Spell and tapping the weak one opened its details, and the Spell then destroyed the strong one.
  await start({}, { 0: mon(ids.weak), 1: mon(ids.strong) }, [ids.destroy]);
  await tap('[data-a="hand:0"]'); await tap('[data-zone="1:0"]');
  let t = await table(); check('tapping a rival monster with a destroy Spell picked chooses it, it does not open its details', !t.insp && await page.locator('[data-zone="1:0"].picked').count() === 1, t);
  check('the Play button names the target', /Mystical Elf/.test(await page.locator('[data-a^="play:"]').first().innerText()));
  await tap('[data-a^="play:"]'); await page.waitForTimeout(1600); t = await table();
  check('the destroy Spell destroyed the monster that was tapped', t.theirs[0] === null && t.theirs[1] === ids.strong, t);
  // with no choice it still takes the strongest face-up monster
  await start({}, { 0: mon(ids.weak), 1: mon(ids.strong) }, [ids.destroy]);
  await tap('[data-a="hand:0"]'); await tap('[data-a^="play:"]'); await page.waitForTimeout(1600); t = await table();
  check('with no target chosen the Spell takes the strongest face-up monster', t.theirs[1] === null && t.theirs[0] === ids.weak, t);
  // a boost Spell and an Equip go to the chosen monster of the player's own
  await start({ 0: mon(ids.strong), 1: mon(ids.weak, 'd') }, { 0: mon(ids.weak) }, [ids.pump]);
  await tap('[data-a="hand:0"]'); await tap('[data-zone="0:1"]'); await tap('[data-a^="play:"]'); await page.waitForTimeout(1600); t = await table();
  check('a boost Spell goes to the chosen monster', t.mine[1] && t.mine[1].ba > 0 && t.mine[0].ba === 0, t);
  await start({ 0: mon(ids.strong), 1: mon(ids.weak, 'd') }, { 0: mon(ids.weak) }, [ids.equip]);
  await tap('[data-a="hand:0"]'); await tap('[data-zone="0:1"]'); await tap('[data-a^="play:"]'); await page.waitForTimeout(1600); t = await table();
  check('an Equip played alone goes to the chosen monster', t.mine[1] && t.mine[1].eq === 1 && t.mine[0].eq === 0, t);
  // a card with no target leaves the table as it was: a tap on a rival monster still opens its details
  await start({}, { 0: mon(ids.weak) }, [ids.heal]);
  await tap('[data-a="hand:0"]'); await tap('[data-zone="1:0"]'); t = await table();
  check('a Spell with no target does not hijack taps on monsters', t.insp, t);
  // the attack forecast must not promise a kill that Bulwark will stop, and a used Enchant says so
  await start({ 0: mon(ids.strong) }, { 0: { ...mon(ids.weak, 'a'), e: 'bulwark' } }, [], d => { d.turn = Math.max(d.turn, 3); d.frozen = [0, 0]; d.noAttack = false; });
  await tap('[data-zone="0:0"]'); const fc = await page.locator('[data-zone="1:0"] .fc').count() ? await page.locator('[data-zone="1:0"] .fc').first().innerText() : '';
  check('the forecast on a monster with an unused Bulwark says it holds', /Bulwark holds/.test(fc) && !/destroys it/.test(fc), fc);
  await start({}, { 0: { ...mon(ids.weak, 'a'), e: 'bulwark', bulwarkUsed: 1 } }, []);
  await tap('[data-zone="1:0"]'); const ins = await page.locator('.insp').count() ? await page.locator('.insp').first().innerText() : '';
  check('a used Enchant is marked as used on the card page', /Used this duel/.test(ins), ins.slice(0, 200));
  check('no page errors', errors.length === 0, errors);
  console.log(`page checks at ${W}x${H}: ${passed} passed, ${failed} failed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})();
