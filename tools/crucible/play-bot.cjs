// Plays the Lost Memories test page by clicking it, like a person would.
//   node tools/crucible/play-bot.cjs <path/to/index.html> [runs] [shots-dir] [width] [height]
// Checks: no page errors, no failed requests, and the hand slots and table zones never move during a duel.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [file, runsArg, shots, W, H] = process.argv.slice(2);
  const runs = +(runsArg || 1);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +(W || 1280), height: +(H || 720) } });
  const errors = [], seen = new Set(); let moved = 0, clicks = 0, duels = 0, wins = 0, stuck = 0;
  page.on('pageerror', e => errors.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  page.on('requestfailed', r => errors.push('request ' + r.url().slice(-60)));
  await page.goto('file://' + path.resolve(file));
  const has = async sel => (await page.locator(sel).count()) > 0;
  const click = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ timeout: 4000, force: true }); clicks++; return true; };
  const shot = async name => { if (shots && !seen.has(name)) { seen.add(name); await page.screenshot({ path: path.join(shots, name + '.png') }); } };
  const rects = () => page.evaluate(() => { const o = document.querySelector('#app').getBoundingClientRect(); return [...document.querySelectorAll('.hs,.slot,.tslot,.who,.board,.tray,.actions')].map(e => { const r = e.getBoundingClientRect(); return [r.left - o.left, r.top - o.top, r.width, r.height].map(x => Math.round(x)).join(','); }).join('|'); });
  let base = null, lastPhase = '';
  for (let run = 0; run < runs; run++) {
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await shot('home'); await click('[data-a="new"]');
    for (let step = 0; step < 6000; step++) {
      const st = await page.evaluate(() => { const G = window.LM.G, r = G.run; return r ? { phase: r.phase, playing: G.playing, tab: G.tab, ov: !!G.overlay, insp: !!G.inspect, duel: !!r.duel, active: r.duel && r.duel.active, pending: r.duel && !!r.duel.pending, played: r.duel && r.duel.played, attacked: r.duel && r.duel.attacked, hand: r.duel ? r.duel.hand[0].length : 0, won: r.result && r.result.won, floor: r.floor, kind: r.offer && r.offer.kind } : null; });
      if (!st) break;
      if (st.playing) { await page.waitForTimeout(40); continue; }
      const inDuel = st.phase === 'duel';
      if (inDuel) { const now = await rects(); if (lastPhase !== 'duel') { base = now; duels++; } else if (now !== base) { moved++; if (moved < 4) console.log('MOVED\n' + base + '\n' + now); base = now; } }
      lastPhase = st.phase;
      if (st.ov) { await shot(st.phase === 'over' ? 'duel-lost' : 'duel-end'); await click('[data-a="closeov"]'); continue; }
      if (st.phase === 'over') { await shot('over'); if (st.won) wins++; console.log('run', run, st.won ? 'CLEARED' : 'ended on floor ' + (st.floor + 1), 'clicks', clicks); break; }
      if (st.phase === 'kit') { await shot('kit'); await click('[data-a="kit:' + (run % 3) + '"]'); continue; }
      if (st.phase === 'charm') { await shot('charm'); await click('[data-a^="pick:"]'); continue; }
      if (st.phase === 'chamber') {
        if (step % 7 === 3) { await click('[data-a="tab:deck"]'); await shot('deck'); if (await has('[data-a^="trunkpick:"]')) { await click('[data-a^="deckpick:"]'); await click('[data-a^="trunkpick:"]'); } await click('[data-a="tab:"]'); await click('[data-a="tab:relics"]'); await shot('relics'); await click('[data-a="tab:"]'); }
        await shot('chamber-' + st.floor);
        if (!(await click('.door:not([disabled])'))) stuck++;
        continue;
      }
      if (st.phase === 'reward') { await shot('reward-' + st.kind); if (!(await click('.pick button:not([disabled])'))) await click('[data-a="skip"]'); continue; }
      if (st.phase === 'anvil') { await shot('anvil'); if (step % 4 === 3) { await click('[data-a="leave"]'); continue; } await click('[data-a^="anvilpick:"]'); if (!(await click('[data-a^="mw:"]:not([disabled])')) && !(await click('[data-a="temper"]:not([disabled])'))) await click('[data-a="leave"]'); continue; }
      if (st.phase === 'bazaar') { await shot('bazaar'); if (!(await click('[data-a^="buy:"]:not([disabled])')) || step % 3 === 0) await click('[data-a="leave"]'); continue; }
      if (inDuel) {
        if (st.pending && st.active === 1) { await shot('trap-prompt'); await click(step % 2 ? '[data-a="respond:0"]' : '[data-a^="respond:"]'); continue; }
        if (st.active !== 0) { await page.waitForTimeout(40); continue; }
        if (!(await page.evaluate(() => window.LM.G.fast)) && duels > 2) await click('[data-a="speed"]');
        if (!st.played && !st.attacked && st.hand) {
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
  console.log(JSON.stringify({ runs, duels, wins, clicks, moved, stuck, errors: errors.length }));
  for (const e of errors.slice(0, 8)) console.log(e);
  await browser.close();
  process.exit(errors.length || moved ? 1 : 0);
})();
