// Pictures of the main screens at one window size, to look at a layout. Not a test: it judges nothing.
//   node tools/crucible/phone-shots.cjs <built index.html> <saves dir> <out dir> [width height]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, dir, out, W = 915, H = 412] = process.argv.slice(2);
  if (!html || !dir || !out) { console.error('usage: phone-shots.cjs <index.html> <saves dir> <out dir> [w h]'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true }); const url = 'file://' + path.resolve(html);
  const pick = re => fs.readdirSync(dir).filter(f => re.test(f)).sort()[0];
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('page error:', e.message));
  const load = async f => { const o = f ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null; await page.goto(url);
    await page.evaluate(o => { localStorage.clear(); if (o) { localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); } }, o);
    await page.reload(); await page.waitForTimeout(500); };
  const tap = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ force: true, timeout: 2000 }).catch(() => {}); await page.waitForTimeout(350); return true; };
  const skip = async () => { for (let i = 0; i < 4; i++) if (!(await tap('[data-a="storyskip"]'))) break; };
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '.png') }); };
  const over = () => page.evaluate(() => { const a = document.querySelector('#app'), A = a.getBoundingClientRect(); const bad = []; for (const el of a.querySelectorAll('.glass, button, .c, .slot, .hs')) { const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.right > A.right + 1 || r.left < A.left - 1 || r.bottom > A.bottom + 1 || r.top < A.top - 1) { let sc = el.parentElement, inScroll = false; while (sc && sc !== a) { const o = getComputedStyle(sc).overflowY; if (o === 'auto' || o === 'scroll') { inScroll = true; break; } sc = sc.parentElement; } if (!inScroll) bad.push((el.className || el.tagName).toString().slice(0, 30)); } } return [...new Set(bad)]; });
  const note = async name => { const b = await over(); if (b.length) console.log(name, 'outside the stage:', b.join(', ')); };
  await load(null); await shot('01-home'); await note('home');
  await tap('[data-a="new"]'); await shot('02-forger'); await note('forger');
  await tap('[data-a="descend"]'); await shot('03-story'); await skip(); await shot('04-kit'); await note('kit');
  await load(pick(/^charm/)); await tap('[data-a="resume"]'); await skip(); await shot('05-charm'); await note('charm');
  await load(pick(/^chamber-boss-door-f1-h0/)); await tap('[data-a="resume"]'); await skip(); await shot('06-chamber'); await note('chamber');
  { const f = pick(/^chamber-f1/); if (f) { await load(f); await tap('[data-a="resume"]'); await skip(); await shot('06b-chamber-three-doors'); await note('chamber, three doors'); await load(pick(/^chamber-boss-door-f1-h0/)); await tap('[data-a="resume"]'); await skip(); } }
  await tap('[data-a="tab:deck"]'); await shot('07-deck'); await tap('[data-a="tab:"]'); await tap('[data-a="tab:relics"]'); await shot('08-relics'); await tap('[data-a="tab:"]'); await tap('[data-a="tab:help"]'); await shot('09-rules'); await tap('[data-a="tab:"]');
  await tap('[data-a="quit"]'); await shot('10-leave'); await tap('[data-a="closeov"]');
  await load(pick(/^duel-regular-f1-h0/)); await tap('[data-a="resume"]'); await skip(); await tap('[data-a="closeov"]'); await shot('11-duel'); await note('duel');
  await tap('.hs .c'); await shot('12-duel-picked'); await page.locator('.hs .c').nth(1).click({ force: true }).catch(() => {}); await page.waitForTimeout(300); await shot('13-duel-meld'); await note('duel meld');
  await load(pick(/^duel-boss-f2/) || pick(/^duel-boss/)); await tap('[data-a="resume"]'); await skip(); await tap('[data-a="closeov"]'); await shot('14-duel-boss'); await tap('.slot.ready'); await shot('15-duel-attack'); await note('duel attack');
  await tap('[data-a^="hit:"]'); for (let k = 0; k < 50 && await page.evaluate(() => window.LM.G.playing); k++) await page.waitForTimeout(120); await tap('[data-a^="inspectz:1"]'); await shot('16-inspect'); await tap('[data-a="closeinspect"]');
  for (const [n, re] of [['17-gift', /^reward-gift/], ['18-card', /^reward-card/], ['19-guardian', /^reward-guardian/], ['20-sanctum', /^reward-sanctum/], ['21-omen', /^reward-omen/], ['22-anvil', /^anvil/], ['23-bazaar', /^bazaar/], ['23b-treasure', /^reward-treasure/]]) { const f = pick(re); if (!f) continue; await load(f); await tap('[data-a="resume"]'); await skip(); await shot(n); await note(n); }
  await load(pick(/^last-move-loss/)); await tap('[data-a="resume"]'); await skip();
  for (let i = 0; i < 14; i++) { if (await page.evaluate(() => !window.LM.G.run || window.LM.G.run.phase === 'over')) break; if (await page.locator('[data-a="respond:-1"]').count()) await tap('[data-a="respond:-1"]'); else if (!(await tap('[data-a="end"]'))) await tap('[data-a="closeov"]'); for (let k = 0; k < 50 && await page.evaluate(() => window.LM.G.playing); k++) await page.waitForTimeout(120); }
  await shot('24-after-loss'); await tap('[data-a="closeov"]'); await skip(); await shot('25-run-over'); await note('run over');
  await load(pick(/^chamber-boss-door-f1-h0/)); await tap('[data-a="screen:codex"]'); await shot('26-codex'); await tap('[data-a="home"]'); await tap('[data-a="screen:vault"]'); await shot('27-vault'); await tap('[data-a="home"]'); await tap('[data-a="screen:feats"]'); await shot('28-feats'); await tap('[data-a="home"]'); await tap('[data-a="tab:sound"]'); await shot('29-sound');
  console.log('pictures in', out); await browser.close();
})().catch(e => { console.error('stopped: ' + e.message); process.exit(3); });
