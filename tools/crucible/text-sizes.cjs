// Effective text sizes (CSS px after the stage scale) per screen and viewport.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, dir, ...vps] = process.argv.slice(2); const url = 'file://' + path.resolve(html);
  const saves = { chamber: 'chamber-boss-door-f1-h0.json', duel: 'duel-regular-f1-h0.json', gift: fs.readdirSync(dir).find(f => /^reward-gift/.test(f)), anvil: fs.readdirSync(dir).find(f => /^anvil/.test(f)), bazaar: fs.readdirSync(dir).find(f => /^bazaar/.test(f)) };
  const browser = await chromium.launch(); const out = [];
  for (const vp of vps) { const [W, H] = vp.split('x').map(Number);
    for (const [name, f] of [['home', null], ...Object.entries(saves)]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H } }); const page = await ctx.newPage(); await page.goto(url);
      if (f) { const o = JSON.parse(fs.readFileSync(path.join(dir, f))); await page.evaluate(o => { localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, o); await page.reload(); await page.waitForTimeout(300); const t = page.locator('#turnok'); if (await t.count()) await t.click(); await page.locator('[data-a="resume"]').first().click(); await page.waitForTimeout(600); for (let i = 0; i < 3; i++) { const b = page.locator('[data-a="closeov"], [data-a="storyskip"]').first(); if (await b.count()) { await b.click(); await page.waitForTimeout(200); } } }
      else { const t = page.locator('#turnok'); if (await t.count()) await t.click(); }
      const r = await page.evaluate(() => { const app = document.querySelector('#app'); const k = app.getBoundingClientRect().width / app.offsetWidth; const sizes = []; const w = document.createTreeWalker(app, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { const s = n.textContent.trim(); if (!s) continue; const el = n.parentElement; if (el.classList.contains('ph') && el.parentElement.querySelector('.pic')) continue; /* the word under a card's picture is covered by the picture */ const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue; sizes.push([parseFloat(cs.fontSize) * k, s.length, s.slice(0, 30), el.className || el.tagName]); }
        const btn = [...app.querySelectorAll('button,[data-a]')].map(b => b.getBoundingClientRect()).filter(r => r.width && r.height).map(r => Math.min(r.width, r.height));
        return { k, sizes, btnMin: Math.min(...btn), btnSmall: btn.filter(x => x < 32).length, btnN: btn.length }; });
      const chars = r.sizes.reduce((a, s) => a + s[1], 0), under = lim => Math.round(100 * r.sizes.filter(s => s[0] < lim).reduce((a, s) => a + s[1], 0) / chars);
      const sm = r.sizes.slice().sort((a, b) => a[0] - b[0])[0];
      out.push(`${vp.padEnd(9)} ${name.padEnd(8)} scale ${r.k.toFixed(2)}  smallest ${sm[0].toFixed(1)}px (${sm[3]}: "${sm[2]}")  text under 9px ${under(9)}%  under 11px ${under(11)}%  under 13px ${under(13)}%  controls under 32px: ${r.btnSmall}/${r.btnN} (min ${r.btnMin.toFixed(0)})`);
      await ctx.close(); } }
  console.log(out.join('\n')); await browser.close();
})();
