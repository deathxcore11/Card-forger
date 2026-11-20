// Plays the Lost Memories test page by clicking it, like a person would.
//   node tools/crucible/play-bot.cjs <path/to/index.html> [runs] [shots-dir] [width] [height]
// Env: LABS=key,key (switches to flip first), HEAT=n, SAVE=file.json ({run, labs, profile}: start the first run
// from a saved game through Continue), RELOAD=n (reload the page every n steps and Continue; the run must be unchanged).
// Also reports: any message the page showed (a refused click means the page offered something illegal), any
// control that lies off the screen or under another element, and any text cut off by its box.
// Checks: no page errors, no failed requests, and the hand slots and table zones never move during a duel.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [file, runsArg, shots, W, H] = process.argv.slice(2);
  const runs = +(runsArg || 1);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +(W || 1280), height: +(H || 720) } });
  const errors = [], seen = new Set(); let moved = 0, clicks = 0, duels = 0, wins = 0, stuck = 0, powers = 0, fresh = 0, rerolls = 0;
  page.on('pageerror', e => errors.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  page.on('requestfailed', r => errors.push('request ' + r.url().slice(-60)));
  await page.goto('file://' + path.resolve(file));
  const has = async sel => (await page.locator(sel).count()) > 0;
  const click = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ timeout: 4000, force: true }); clicks++; return true; };
  const shot = async name => { if (shots && !seen.has(name)) { seen.add(name); await page.screenshot({ path: path.join(shots, name + '.png') }); } };
  const rects = () => page.evaluate(() => { const o = document.querySelector('#app').getBoundingClientRect(); return [...document.querySelectorAll('.hs,.slot,.tslot,.who,.board,.tray,.actions')].map(e => { const r = e.getBoundingClientRect(); return [r.left - o.left, r.top - o.top, r.width, r.height].map(x => Math.round(x)).join(','); }).join('|'); });
  let base = null, lastPhase = '';
  const toasts = {}, layout = {}; let reloads = 0;
  // Layout faults on the screen as it stands: controls out of view or covered, and cut-off text.
  const audit = async where => {
    const found = await page.evaluate(() => {
      const W = innerWidth, H = innerHeight, bad = [], vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const scrolls = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return true; } return false; };
      const name = e => (e.dataset.a ? e.dataset.a.split(':')[0] : e.tagName.toLowerCase()) + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '');
      for (const e of document.querySelectorAll('[data-a]')) {
        if (!vis(e) || scrolls(e)) continue; const r = e.getBoundingClientRect();
        if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) { bad.push('off screen: ' + name(e)); continue; }
        if (e.disabled) continue;
        const c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (c && c !== e && !e.contains(c) && !c.contains(e) && c.closest('[data-a]') !== e) { const top = c.closest('.modal,.ov,.overlay,.insp,.inspect,.story,.tabp,.sheet,.toast,.ghost'); if (!top || top.contains(e)) bad.push('covered: ' + name(e) + ' by ' + name(c)); }
      }
      for (const e of document.querySelectorAll('button, h1, h2, h3, b, small, .fine, .nm, .lab span')) {
        if (!vis(e) || !e.textContent.trim()) continue; const cs = getComputedStyle(e);
        if (cs.textOverflow === 'ellipsis') continue;
        if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY) && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2)) bad.push('cut text: ' + name(e) + ' "' + e.textContent.trim().slice(0, 30) + '"');
      }
      // text pushed out of view: above the top of a list that is already scrolled to its top, or off the screen with nothing to scroll
      for (const e of document.querySelectorAll('h1, h2, h3, small, p, button, .fine')) {
        if (!vis(e) || !e.textContent.trim()) continue; const r = e.getBoundingClientRect(); let sc = null;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) { sc = p; break; } }
        if (sc) { const q = sc.getBoundingClientRect(); if (r.top < q.top - 2 && sc.scrollTop === 0) bad.push('unreachable above: ' + name(e) + ' "' + e.textContent.trim().slice(0, 24) + '"'); }
        else if (r.top < -2 || r.bottom > H + 2 || r.left < -2 || r.right > W + 2) bad.push('text off screen: ' + name(e) + ' "' + e.textContent.trim().slice(0, 24) + '"');
      }
      // boxes of text that are cut off with no way to scroll
      for (const e of document.querySelectorAll('.glass, .panel, .pick, .door, .say, .dtxt')) {
        if (!vis(e) || !e.textContent.trim()) continue; const cs = getComputedStyle(e);
        if (/(hidden|clip)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 3) bad.push('cut box: ' + name(e) + '.' + e.className.split(' ').slice(1).join('.') + ' by ' + (e.scrollHeight - e.clientHeight) + 'px "' + e.textContent.trim().slice(0, 24) + '"');
        if (/(hidden|clip)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 3) bad.push('cut box sideways: ' + name(e) + ' "' + e.textContent.trim().slice(0, 24) + '"');
      }
      if (document.documentElement.scrollWidth > W + 1 || document.documentElement.scrollHeight > H + 1) bad.push('page scrolls: ' + document.documentElement.scrollWidth + 'x' + document.documentElement.scrollHeight);
      return bad;
    });
    for (const f of found) { const k = where + ' / ' + f; layout[k] = (layout[k] || 0) + 1; }
  };
  let lastToast = '';
  const noteToast = async where => { const t = await page.evaluate(() => window.LM.G.toast); if (t && t !== lastToast) { const k = where + ': ' + t; toasts[k] = (toasts[k] || 0) + 1; } lastToast = t; };
  const saved = process.env.SAVE ? JSON.parse(require('fs').readFileSync(process.env.SAVE, 'utf8')) : null;
  for (let run = 0; run < runs; run++) {
    if (run === 0) { await page.evaluate(() => localStorage.clear()); await page.reload(); }
    await audit('home');
    if (run === 0 && saved) {
      await page.evaluate(v => { localStorage.setItem('lostmemories.run.v1', JSON.stringify(v.run)); if (v.labs) { localStorage.setItem('lostmemories.labs.v4', JSON.stringify(v.labs)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(v.labs)); } if (v.profile) localStorage.setItem('lostmemories.profile.v1', JSON.stringify(v.profile)); }, saved);
      await page.reload(); await shot('home-saved'); await audit('home with a saved run');
      if (!(await click('[data-a="resume"]'))) errors.push('no Continue button for the saved run');
    } else {
    if (run === 0 && process.env.LABS) { for (const k of process.env.LABS.split(',')) await click('[data-a="lab:' + k + '"]'); await shot('home-labs'); }
    await shot('home'); await click('[data-a="new"]'); await shot('forger');
    if (process.env.HEAT) { if (!(await click('[data-a="heat:' + process.env.HEAT + '"]:not([disabled])'))) errors.push('Heat ' + process.env.HEAT + ' is not open'); await shot('forger-heat'); if (await click('[data-a^="heatinfo:"]')) { await shot('heat-rules'); await click('[data-a="closeov"]'); } }
    const owned = await page.locator('.ch[data-a^="forger:"]').count(); if (owned > 1) { await page.locator('.ch[data-a^="forger:"]').nth(run % owned).click({ force: true }); clicks++; }
    await audit('forger');
    if (!(await click('[data-a="descend"]'))) errors.push('could not start run ' + run + ': ' + (await page.evaluate(() => JSON.stringify({ screen: window.LM.G.screen, phase: window.LM.G.run && window.LM.G.run.phase, story: !!window.LM.G.story, ov: !!window.LM.G.overlay, tab: window.LM.G.tab, insp: !!window.LM.G.inspect, btns: [...document.querySelectorAll('button')].map(b => b.dataset.a).join(' ') }))));
    }
    // MONKEY=n: n random clicks on anything that can be clicked, to reach the paths a scripted player never takes.
    if (process.env.MONKEY) {
      let seed = (+process.env.MSEED || 1) * 2654435761 >>> 0; const rnd = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
      let dead = 0;
      for (let k = 0; k < +process.env.MONKEY; k++) {
        const st = await page.evaluate(() => { const G = window.LM.G, r = G.run; return { phase: r ? r.phase : 'home', playing: G.playing, screen: G.screen, tab: G.tab, ov: !!G.overlay, kind: r && r.offer && r.offer.kind }; });
        if (st.playing) { await page.waitForTimeout(40); k--; if (++dead > 800) { errors.push('animation never ended in ' + st.phase); break; } continue; }
        const where = st.screen || (st.ov ? 'overlay in ' + st.phase : st.tab ? 'tab ' + st.tab : st.phase + (st.kind ? ' ' + st.kind : ''));
        await noteToast(where); await audit(where);
        const els = await page.evaluate(() => [...document.querySelectorAll('[data-a]')].map((e, i) => { const r = e.getBoundingClientRect(); return { i, a: e.dataset.a, ok: !e.disabled && r.width > 0 && r.height > 0 }; }).filter(x => x.ok && !/^(quit|lab|speed)/.test(x.a)));
        if (!els.length) { errors.push('dead end: nothing to click in ' + where); break; }
        // the topmost layer decides what a person could really press
        const pick = els[rnd(els.length)];
        const hit = await page.evaluate(i => { const e = document.querySelectorAll('[data-a]')[i]; if (!e) return null; const r = e.getBoundingClientRect(); const c = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); const t = c && c.closest('[data-a]'); if (!t) return null; t.click(); return t.dataset.a; }, pick.i);
        if (hit) { clicks++; dead = 0; } else if (++dead > 60) { errors.push('nothing clickable is reachable in ' + where); break; }
        if (st.phase === 'over' && hit === 'home') break;
      }
      await noteToast('end'); continue;
    }
    for (let step = 0; step < (+process.env.STEPS || 6000); step++) {
      const st = await page.evaluate(() => { const G = window.LM.G, r = G.run; return r ? { story: G.story && !G.overlay ? G.story.id : null, phase: r.phase, playing: G.playing, tab: G.tab, ov: !!G.overlay, insp: !!G.inspect, duel: !!r.duel, active: r.duel && r.duel.active, pending: r.duel && !!r.duel.pending, played: r.duel && r.duel.played, attacked: r.duel && r.duel.attacked, hand: r.duel ? r.duel.hand[0].length : 0, won: r.result && r.result.won, floor: r.floor, kind: r.offer && r.offer.kind } : null; });
      if (!st) break;
      await noteToast(st.phase);
      if (!st.playing) await audit(st.story ? 'story' : st.ov ? 'overlay in ' + st.phase : st.tab ? 'tab ' + st.tab : st.phase + (st.kind ? ' ' + st.kind : ''));
      if (process.env.RELOAD && !st.playing && !st.story && st.phase !== 'over' && step && step % +process.env.RELOAD === 0) {
        const before = await page.evaluate(() => JSON.stringify(window.LM.G.run)), disk = await page.evaluate(() => localStorage.getItem('lostmemories.run.v1'));
        if (disk) {
          if (disk !== before) errors.push('the saved game is behind the screen in ' + st.phase);
          await page.reload(); if (!(await click('[data-a="resume"]'))) { errors.push('no Continue after reload in ' + st.phase); break; }
          const after = await page.evaluate(() => JSON.stringify(window.LM.G.run)); if (after !== before) errors.push('the run changed across a reload in ' + st.phase);
          reloads++; lastPhase = ''; continue;
        }
      }
      if (st.playing) { await page.waitForTimeout(40); continue; }
      if (st.story) { await shot('story-' + st.story.replace(':', '-')); await click(step % 2 ? '[data-a="storyskip"]' : '[data-a="storynext"]'); continue; }
      const inDuel = st.phase === 'duel';
      if (inDuel) { const now = await rects(); if (lastPhase !== 'duel') { base = now; duels++; } else if (now !== base) { moved++; if (moved < 4) console.log('MOVED\n' + base + '\n' + now); base = now; } }
      lastPhase = st.phase;
      if (st.ov) { await shot(st.phase === 'over' ? 'duel-lost' : 'duel-end'); await click('[data-a="closeov"]'); continue; }
      if (st.phase === 'over') {
        await shot('over'); if (await has('.unlock.gift')) await shot('over-gift-unlocked'); if (st.won) wins++; console.log('run', run, st.won ? 'CLEARED' : 'ended on floor ' + (st.floor + 1), 'clicks', clicks);
        await click('[data-a="screen:vault"]'); await shot('vault'); await click('[data-a^="vbuy:"]:not([disabled])'); await click('[data-a="home"]');
        await click('[data-a="screen:codex"]'); await shot('codex'); if (await click('.cxt:not(.unk)')) { await shot('codex-page'); await click('[data-a="cxclose"]'); } await click('[data-a="cxview:all"]'); await shot('codex-all'); if (await click('.cxt.unk')) { await shot('codex-unfound'); await click('[data-a="cxclose"]'); } await click('[data-a^="cxtype:"]'); await shot('codex-type'); await click('[data-a="home"]');
        await click('[data-a="screen:feats"]'); await shot('feats-' + run); await click('[data-a="home"]'); await click('[data-a="home"]');
        break;
      }
      if (st.phase === 'kit') { await shot('kit'); await click('[data-a="kit:' + (run % 3) + '"]'); continue; }
      if (st.phase === 'charm') { await shot('charm'); await click('[data-a^="pick:"]'); continue; }
      if (st.phase === 'chamber') {
        if (step % 7 === 3) { await click('[data-a="tab:deck"]'); await shot('deck'); if (await has('[data-a^="trunkpick:"]')) { await click('[data-a^="deckpick:"]'); await click('[data-a^="trunkpick:"]'); } await click('[data-a="tab:"]'); await click('[data-a="tab:relics"]'); await shot('relics'); await click('[data-a="tab:"]'); }
        await shot('chamber-' + st.floor);
        if (!(await click('.door:not([disabled])'))) stuck++;
        continue;
      }
      if (st.phase === 'reward') { await shot('reward-' + st.kind); if (st.kind === 'gift' && await has('.pick.fresh')) { await shot('reward-gift-new'); fresh++; } if (st.kind === 'gift' && step % 2 && await click('[data-a="reroll"]')) { rerolls++; await shot('reward-gift-redeal'); continue; } if (!(await click('.pick button:not([disabled])'))) await click('[data-a="skip"]'); continue; }
      if (st.phase === 'anvil') { await shot('anvil'); if (step % 4 === 3) { await click('[data-a="leave"]'); continue; } await click('[data-a^="anvilpick:"]'); if (!(await click('[data-a^="mw:"]:not([disabled])')) && !(await click('[data-a="temper"]:not([disabled])'))) await click('[data-a="leave"]'); continue; }
      if (st.phase === 'bazaar') { await shot('bazaar'); if (!(await click('[data-a^="buy:"]:not([disabled])')) || step % 3 === 0) await click('[data-a="leave"]'); continue; }
      if (inDuel) {
        if (st.pending && st.active === 1) { await shot('trap-prompt'); await click(step % 2 ? '[data-a="respond:0"]' : '[data-a^="respond:"]'); continue; }
        if (st.active !== 0) { await page.waitForTimeout(40); continue; }
        if (!(await page.evaluate(() => window.LM.G.fast)) && duels > 2) await click('[data-a="speed"]');
        if (!st.played && !st.attacked && st.hand) {
          if (await click('[data-a^="power"]:not([disabled])')) { powers++; await shot('power'); continue; }
          if (step % 5 === 0 && await has('[data-a="power:hand"]')) { await click('[data-a="hand:0"]'); if (await click('[data-a^="power"]:not([disabled])')) { powers++; continue; } await click('[data-a="undo"]'); }
          let done = false;
          for (let n = Math.min(4, st.hand); n >= 1 && !done; n--) {
            for (let i = 0; i < n; i++) await click('[data-a="hand:' + i + '"]');
            if (n >= 2) await shot('meld-tray');
            if (await has('[data-a^="play:"]')) { await click('[data-a^="play:"]'); done = true; } else await click('[data-a="undo"]');
          }
          if (!done) { await click('[data-a="hand:0"]'); await click('[data-a="scrap"]'); }
          continue;
        }
        let attacked = false;
        const ready = await page.locator('.slot.ready').count();
        for (let k = 0; k < ready && !attacked; k++) {
          const l = page.locator('.slot.ready').nth(k); if (!(await l.count())) break; await l.click({ force: true }); clicks++;
          await shot('aim');
          if (await click('.slot.target')) attacked = true; else if (await click('[data-a="hit:-1"]')) attacked = true; else await click('[data-a="undo"]');
        }
        if (attacked) continue;
        await shot('duel'); await click('[data-a="end"]'); continue;
      }
      stuck++; if (stuck > 20) { errors.push('stuck in ' + st.phase); break; }
      if (step === 5999) errors.push('step limit: ' + JSON.stringify(st) + ' ' + (await page.evaluate(() => [...document.querySelectorAll('[data-a]')].filter(e => e.tagName === 'BUTTON').map(e => e.dataset.a + (e.disabled ? '(off)' : '')).join(' | ') + ' toast=' + window.LM.G.toast)));
    }
  }
  if (Object.keys(toasts).length) console.log('MESSAGES SHOWN\n  ' + Object.entries(toasts).map(([k, n]) => n + 'x ' + k).join('\n  '));
  if (Object.keys(layout).length) console.log('LAYOUT\n  ' + Object.entries(layout).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, n]) => n + 'x ' + k).join('\n  '));
  console.log(JSON.stringify({ runs, duels, wins, clicks, powers, fresh, rerolls, reloads, moved, stuck, errors: errors.length, profile: await page.evaluate(() => JSON.parse(localStorage.getItem('lostmemories.profile.v1') || 'null')) }).slice(0, 900));
  for (const e of errors.slice(0, 8)) console.log(e);
  await browser.close();
  process.exit(errors.length || moved ? 1 : 0);
})();
