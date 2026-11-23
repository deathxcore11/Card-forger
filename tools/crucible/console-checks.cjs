// Checks the console look of the Lost Memories test page against its own rules, on many screen shapes.
//   node tools/crucible/console-checks.cjs <page url> <saves dir> [steps]
//   CC_ONLY=title checks only the title screen, every shape, no random taps (a quick look after a title change).
// The page must be served over http (a page opened from the disk may not read its own pictures).
// For every screen shape and every scene (the title, chambers, duels, every window that opens over them) it checks:
//   frame   the frame is 512 x 240 to 640 x 480 whole pixels, each a whole number of device pixels, and fills the
//           screen to within one frame pixel (or reaches 640 x 480);
//   law     no rounded corner, no blur, no soft shadow, no smooth gradient, no transition, no see-through amount but
//           none, half or all (the console's own blend), no turned or scaled element inside the frame, no picture drawn at a size that is
//           not a whole multiple of its own, no canvas stretched, text only in the game's two pixel faces;
//   fit     no text cut off by its box (the text bar may be, when it shows its more marker), nothing outside the frame,
//           nothing written in a pillar crossing out of it, no two plaques on top of each other;
//   reach   every control that is not switched off can be tapped where it stands (nothing lies over its middle);
//   placed  every moving part drawn over a picture (data-art) sits on the point of the picture it was measured from,
//           through the picture's own place and size as the page laid it out; a torch flame also stands on the bright
//           core of the painted flame, found again in the picture's own pixels; a model drawn in a room (a canvas laid
//           on the room picture, its spots in data-foot) stands with its lowest pixel on its spot;
//   errors  no page error.
// Some shapes are checked inside a page that styles pictures the way a host page may (img { max-width: 100%;
// height: auto } and the like), and at the end a few scenes are pictured with and without those styles, with every
// animation stopped at its start: the two pictures must be the same to the pixel.
// Then it taps about the page at random from each scene for [steps] taps (default 40), checking errors and the
// rules again on every console screen it reaches.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

// The first three shapes get every scene and the random taps; the others a short list of scenes.
const SHAPES = [
  ['phone held sideways', 915, 412, 2.625, 1], ['phone held upright', 412, 915, 2.625, 1], ['fold, inner screen', 673, 841, 2.625, 1],
  ['wide desktop', 1024, 480, 1], ['fold, cover screen sideways', 882, 344, 2.625], ['16:9 screen', 1920, 1080, 1],
  ['tablet', 1024, 768, 2], ['small window', 800, 360, 1],
  ['phone held sideways, in a host page', 915, 412, 2.625, 0, 1], ['16:9 screen, in a host page', 1280, 720, 1, 0, 1], ['upright window, in a host page', 640, 900, 1, 0, 1],
];
// styles a page that holds the game may set on everything in it (a common reset)
const HOST_CSS = `*,::before,::after{box-sizing:border-box;border:0 solid #e5e7eb}html{line-height:1.5;-webkit-text-size-adjust:100%}body{margin:0;line-height:inherit}
img,svg,video,canvas,audio,iframe,embed,object{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}
button,input,select,textarea{font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;color:inherit;margin:0;padding:0}
button{background-color:transparent;background-image:none;cursor:pointer}h1,h2,h3,h4,p,figure,blockquote{margin:0}ol,ul{list-style:none;margin:0;padding:0}`;
const hostScript = css => { const add = () => { const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).prepend(st); }; if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add); };
const SAME = ['', 'chamber-f1.json', 'duel-regular-f1-h0.json', 'anvil-f1.json', 'reward-card-f1.json'];
const SHORT = [null, 'chamber-f1.json', 'duel-regular-f1-h0.json', 'reward-card-f1.json', 'reward-gift-f1.json', 'anvil-f1.json', 'bazaar-f2.json', 'kit-f1.json'];
const SCREENS = ['screen:codex', 'screen:feats', 'screen:vault', 'new'];
const WINDOWS = ['tab:menu', 'tab:help', 'tab:options', 'tab:deck', 'tab:relics', 'tab:doors', 'tab:duel', 'barmore'];

(async () => {
  const [url, savesDir, stepsArg] = process.argv.slice(2);
  if (!url || !savesDir) { console.log('usage: console-checks.cjs <page url> <saves dir> [steps]'); process.exit(2); }
  const only = process.env.CC_ONLY === 'title', steps = only ? 0 : +(stepsArg || 40);
  const saves = fs.readdirSync(savesDir).filter(f => /^(chamber|duel|reward|anvil|bazaar|kit|charm)-/.test(f)).sort();
  const pick = [null, ...saves.filter(f => /^chamber-f\d\.json$|^chamber-boss-door-f[13]-h(0|10)\.json$/.test(f)),
    ...saves.filter(f => /^duel-(regular|boss|cursed)-f[123]-h0\.json$|trap-prompt-h5|narrow|fog|lesson/.test(f)).slice(0, 10),
    ...saves.filter(f => /^(reward|anvil|bazaar|kit|charm)-/.test(f))];
  const browser = await chromium.launch();
  const fails = []; let scenes = 0, taps = 0, screens = 0;
  const fail = (where, what) => { fails.push(`${where}: ${what}`); if (fails.length < 60) console.log('FAIL', where, what); };

  for (const [shape, W, H, dpr, full, host] of SHAPES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
    if (host) await ctx.addInitScript(hostScript, HOST_CSS);
    const page = await ctx.newPage();
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('requestfailed', r => { if (!/audio\//.test(r.url())) errors.push('request failed ' + r.url().slice(-60)); });
    const load = async save => {
      await page.goto(url);
      await page.evaluate(o => {
        localStorage.clear(); sessionStorage.clear();
        const labs = { five: true, lean: true, heat: true, kits: true, items: true };
        if (o) { o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs || labs)); }
        localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o ? o.labs || labs : labs));
      }, save ? JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')) : null);
      await page.reload(); await page.waitForTimeout(600);
      if (save) { await page.locator('[data-a="resume"]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(700); }
    };
    const audit = async where => {
      const r = await page.evaluate(async () => {
        const app = document.getElementById('app'), out = [];
        if (!app.classList.contains('ps')) return { ps: false, out };
        const dpr = devicePixelRatio, cs = getComputedStyle(app), W = parseFloat(cs.width), H = parseFloat(cs.height);
        const m = new DOMMatrix(cs.transform), k = Math.hypot(m.a, m.b), n = k * dpr, up = Math.abs(m.b) > Math.abs(m.a);
        const aw = Math.floor((up ? innerHeight : innerWidth) * dpr + .01), ah = Math.floor((up ? innerWidth : innerHeight) * dpr + .01);
        if (Math.abs(n - Math.round(n)) > .01) out.push(`frame pixel is ${n.toFixed(3)} device pixels, not a whole number`);
        if (W < 512 || W > 640 || H < 240 || H > 480 || W % 1 || H % 1) out.push(`frame is ${W} x ${H}`);
        const N = Math.round(n);
        if (W * N > aw || H * N > ah) out.push(`frame ${W} x ${H} at ${N} does not fit ${aw} x ${ah}`);
        if (W < 640 && aw - W * N >= N && Math.floor(ah / 240) >= Math.floor(aw / 512)) out.push(`frame leaves ${aw - W * N} device pixels unused across`);
        if (H < 480 && ah - H * N >= N && Math.floor(aw / 512) >= Math.floor(ah / 240)) out.push(`frame leaves ${ah - H * N} device pixels unused down`);
        const A = app.getBoundingClientRect();
        const name = e => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : e.tagName.toLowerCase()) + (e.dataset && e.dataset.a ? `[${e.dataset.a}]` : '');
        const okOpacity = v => [0, .5, 1].some(x => Math.abs(+v - x) < .001); // the console's half-and-half blend, or none
        const shadowBlur = s => s !== 'none' && s.split(/,(?![^(]*\))/).some(p => { const nums = p.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []; return nums.length >= 3 && parseFloat(nums[2]) !== 0; });
        const all = [app, ...app.querySelectorAll('*')];
        for (const e of all) {
          for (const pseudo of [null, '::before', '::after']) {
            const s = getComputedStyle(e, pseudo); if (pseudo && (s.content === 'none' || s.content === 'normal')) continue;
            if (s.display === 'none') continue;
            const where = name(e) + (pseudo || '');
            if (['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].some(p => parseFloat(s[p]) !== 0)) out.push(`${where}: rounded corner`);
            if (/blur|drop-shadow/.test(s.filter) || (s.backdropFilter && s.backdropFilter !== 'none')) out.push(`${where}: blur (${s.filter} ${s.backdropFilter || ''})`);
            if (shadowBlur(s.boxShadow)) out.push(`${where}: soft shadow ${s.boxShadow}`);
            if (shadowBlur(s.textShadow)) out.push(`${where}: soft text shadow`);
            if (s.transitionDuration.split(',').some(t => parseFloat(t) !== 0)) out.push(`${where}: transition ${s.transitionDuration}`);
            if (/(^|[^-])(linear|radial)-gradient\(/.test(s.backgroundImage) || /(^|[^-])conic-gradient\(/.test(s.backgroundImage) && !/2px 2px|4px 4px/.test(s.backgroundSize)) out.push(`${where}: smooth gradient`); // a conic pattern is a dot pattern only at 2 or 4 pixels
            if (!okOpacity(s.opacity)) out.push(`${where}: opacity ${s.opacity}`);
            if (e !== app && s.transform !== 'none') { const t = new DOMMatrix(s.transform); if (Math.abs(t.a - 1) > 1e-6 || Math.abs(t.d - 1) > 1e-6 || t.b || t.c) out.push(`${where}: turned or scaled (${s.transform})`); }
            if (s.imageRendering !== 'pixelated' && s.imageRendering !== 'crisp-edges' && pseudo == null && e.tagName === 'IMG' && e.naturalWidth && (e.width % e.naturalWidth || e.height % e.naturalHeight)) out.push(`${where}: picture drawn at ${e.width} x ${e.height} from ${e.naturalWidth} x ${e.naturalHeight}`);
          }
          if (e.tagName === 'IMG' && e.complete && e.naturalWidth && (e.width % e.naturalWidth || e.height % e.naturalHeight) && !e.closest('.cd')) out.push(`${name(e)}: picture drawn at ${e.width} x ${e.height} from ${e.naturalWidth} x ${e.naturalHeight}`);
          if (e.tagName === 'CANVAS') { const r = e.getBoundingClientRect(); const cw = r.width / k, ch = r.height / k, w2 = up ? ch : cw, h2 = up ? cw : ch; if (Math.abs(w2 - e.width) > .5 || Math.abs(h2 - e.height) > .5) out.push(`${name(e)}: canvas ${e.width} x ${e.height} drawn at ${w2.toFixed(1)} x ${h2.toFixed(1)}`); }
          const text = [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
          if (text) {
            const ff = getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim();
            if (!['LM Text', 'LM Label'].includes(ff)) out.push(`${name(e)}: text in ${ff}`);
          }
        }
        // fit: text cut off, things outside the frame, pillar text crossing out, plaques on plaques
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        const inside = (r, o, slack = 1) => r.left >= o.left - slack && r.top >= o.top - slack && r.right <= o.right + slack && r.bottom <= o.bottom + slack;
        // scrolled out of view inside a list that scrolls (the list itself is checked): not a fault, a scroll away
        const scrolledAway = e => { for (let p = e.parentElement; p && p !== app; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && !inside(e.getBoundingClientRect(), p.getBoundingClientRect())) return true; } return false; };
        for (const e of app.querySelectorAll('.pq, .lb, .dt b, .dt p, .mw h2, .atk, .cd .n1, .cd .n2')) {
          if (!vis(e) || e.closest('.sc')) continue;
          if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflow !== 'visible') out.push(`${name(e)} "${e.textContent.slice(0, 30)}": text cut off (${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight})`);
        }
        const bar = app.querySelector('.fr > .bar'); if (bar) { const p = bar.firstElementChild; if (p.scrollHeight > p.clientHeight + 4 && !bar.classList.contains('more')) out.push('text bar holds more than it shows, with no more marker'); }
        for (const e of app.querySelectorAll('.lb, .pq, .cd, .pf, .sl, .ga, .mw')) if (vis(e) && !inside(e.getBoundingClientRect(), A) && !scrolledAway(e)) out.push(`${name(e)} "${e.textContent.slice(0, 20)}": outside the frame`);
        const pillars = [...app.querySelectorAll('.fr > .ab')].filter(p => p.style.width === '96px');
        for (const p of pillars) { const P = p.getBoundingClientRect(); for (const e of p.querySelectorAll('.lb, .pq, .ga, .pf, .sl, .spk, .seal, .pip, .backs')) if (vis(e) && !inside(e.getBoundingClientRect(), P)) out.push(`${name(e)} "${e.textContent.slice(0, 20)}": crosses out of its pillar`); }
        const pqs = [...app.querySelectorAll('.pq')].filter(vis).map(e => [e, e.getBoundingClientRect()]);
        for (let i = 0; i < pqs.length; i++) for (let j = i + 1; j < pqs.length; j++) { const [a, ra] = pqs[i], [b, rb] = pqs[j]; if (a.closest('.mw') !== b.closest('.mw')) continue; if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1) out.push(`plaques "${a.textContent}" and "${b.textContent}" overlap`); }
        // reach: every live control can be tapped at its middle
        const top = app.querySelector('.mw, .story, .dim') ? [...app.querySelectorAll('.mw [data-a], .story[data-a], .story [data-a], .dim[data-a], .mw[data-a]')] : [...app.querySelectorAll('[data-a]')];
        for (const e of top) {
          if (e.disabled || !vis(e) || scrolledAway(e) || e.classList.contains('dim')) continue; // a dimmed backdrop is tapped round its window, not at its middle
          const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push(`${name(e)}: off the screen`); continue; }
          const hit = document.elementFromPoint(x, y);
          if (!hit || !(hit === e || e.contains(hit) || hit.closest('[data-a]') === e)) out.push(`${name(e)}: covered by ${hit ? name(hit) : 'nothing'}`);
        }
        // placed: the moving parts over a picture, against the picture as laid out (layout places: no animation moves them)
        for (const e of app.querySelectorAll('[data-art]')) {
          const pic = app.querySelector(`img[data-pic="${e.dataset.art}"]`); if (!pic) { out.push(`${name(e)}: its picture ${e.dataset.art} is missing`); continue; }
          if (!pic.complete || !pic.naturalWidth) continue;
          if (e.offsetParent !== pic.offsetParent) { out.push(`${name(e)}: not laid out beside its picture`); continue; }
          const [ax, ay] = e.dataset.at.split(',').map(Number), [px, py] = e.dataset.pin.split(',').map(Number);
          const sx = pic.offsetWidth / pic.naturalWidth, sy = pic.offsetHeight / pic.naturalHeight;
          const dx = e.offsetLeft + px - (pic.offsetLeft + ax * sx), dy = e.offsetTop + py - (pic.offsetTop + ay * sy);
          if (Math.abs(dx) > .5 || Math.abs(dy) > .5) out.push(`${name(e)}: ${dx.toFixed(1)}, ${dy.toFixed(1)} frame pixels off its place in the picture (picture drawn ${pic.offsetWidth} x ${pic.offsetHeight} from ${pic.naturalWidth} x ${pic.naturalHeight})`);
          if (e.classList.contains('flm')) {
            // a torch is a patch of the picture: its first frame must be the picture under it, nearly pixel for pixel
            // (a frame differs only where the flame moves; one pixel off and the dither no longer lines up)
            const w = e.offsetWidth, h = e.offsetHeight, n = +e.dataset.frames, url = (e.style.backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1];
            const strip = new Image(); strip.src = url; try { await strip.decode(); } catch { out.push(`${name(e)}: its frames do not load`); continue; }
            if (strip.naturalWidth !== w * n || strip.naturalHeight !== h) out.push(`${name(e)}: frames ${strip.naturalWidth} x ${strip.naturalHeight}, not ${n} of ${w} x ${h}`);
            const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
            g.drawImage(pic, -ax, -ay); const under = g.getImageData(0, 0, w, h).data; g.clearRect(0, 0, w, h); g.drawImage(strip, 0, 0); const f0 = g.getImageData(0, 0, w, h).data;
            let same = 0, edge = 0, edgeSame = 0;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, eq = under[i] === f0[i] && under[i + 1] === f0[i + 1] && under[i + 2] === f0[i + 2]; same += eq; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { edge++; edgeSame += eq; } }
            if (same / (w * h) < .6 || edgeSame / edge < .85) out.push(`${name(e)}: its first frame matches the picture under it at ${Math.round(same / (w * h) * 100)}% (edge ${Math.round(edgeSame / edge * 100)}%): not cut from this place`);
          }
        }
        // a model stands on its spot: in a canvas of models laid on its picture, the lowest pixel drawn within 48 pixels
        // of each spot's x (a model turned stands on a corner) is the row just above the spot's y (data-foot: "x,y" in the
        // picture, one for each model)
        for (const c of app.querySelectorAll('canvas[data-foot]')) {
          let px; try { px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; } catch { continue; }
          for (const f of c.dataset.foot.split(' ')) {
            const [fx, fy] = f.split(',').map(Number); let low = -1;
            for (let y = c.height - 1; y >= 0 && low < 0; y--) for (let x = Math.max(0, fx - 48); x <= Math.min(c.width - 1, fx + 48); x++) if (px[(y * c.width + x) * 4 + 3]) { low = y; break; }
            if (low < 0) out.push(`${name(c)}: no model drawn at its spot ${f}`);
            else if (Math.abs(low - (fy - 1)) > 2) out.push(`${name(c)}: a model's foot is at row ${low}, not on its spot ${f}`);
          }
        }
        // the card pictures: cut to console colour once the sheets are converted
        const unconverted = [...app.querySelectorAll('.cd .art, .big .art')].filter(e => e.style.backgroundImage && !/blob:/.test(e.style.backgroundImage)).length;
        if (unconverted) out.push(`${unconverted} card pictures still the full-colour sheet`);
        return { ps: true, out: [...new Set(out)], sig: app.dataset.phase + '|' + [...app.querySelectorAll('[data-a]')].map(e => e.dataset.a).join(',').slice(0, 400) };
      });
      if (r.ps) { screens++; for (const o of r.out) fail(where, o); }
      for (const e of errors) fail(where, 'page error: ' + e); errors = [];
      return r;
    };
    for (const save of only ? [null] : full ? pick : SHORT.filter(x => !x || saves.includes(x))) {
      const base = `${shape} ${W}x${H}@${dpr} ${save || 'title'}`;
      await load(save); await page.waitForTimeout(500); scenes++;
      await audit(base);
      // every window that can open over this screen
      for (const a of WINDOWS) {
        const l = page.locator(`[data-a="${a}"]`).first();
        if (!(await l.count()) || await l.isDisabled().catch(() => true)) continue;
        await l.click({ force: true }).catch(() => {}); await page.waitForTimeout(250);
        await audit(`${base} > ${a}`);
        const c = page.locator('.mw [data-a="tab:"], .mw [data-a="closeov"], .mw [data-a="closeinspect"]').first();
        if (await c.count()) await c.click({ force: true }).catch(() => {}); else await load(save);
        await page.waitForTimeout(200);
      }
      // a card page: tap a card in the hand when nothing can be played, or a table card
      const hc = page.locator('[data-a^="inspect"]').first();
      if (await hc.count()) { await hc.click({ force: true }).catch(() => {}); await page.waitForTimeout(300); await audit(`${base} > card page`); await load(save); }
      // the books and the Forger screen, from the title
      if (!save) for (const a of SCREENS) { await load(null); await page.locator(`[data-a="${a}"]`).first().click({ force: true }).catch(() => {}); await page.waitForTimeout(500); await audit(`${base} > ${a}`); }
      // then tap about at random
      let last = '';
      for (let i = 0; i < (full ? steps : 0); i++) {
        const els = await page.locator('[data-a]:not([disabled])').all();
        const live = [];
        for (const e of els) if (await e.isVisible().catch(() => false)) live.push(e);
        const safe = [];
        for (const e of live) { const a = await e.getAttribute('data-a').catch(() => ''); if (!/^(leavetab|loadagain|startempty|abandon|bankold|look)$/.test(a)) safe.push(e); }
        if (!safe.length) break;
        const e = safe[Math.floor(Math.random() * safe.length)];
        await e.click({ force: true, timeout: 2000 }).catch(() => {}); taps++;
        await page.waitForTimeout(120 + Math.random() * 200);
        const r = await audit(`${base} tap ${i + 1}`);
        if (r.sig && r.sig === last && Math.random() < .3) { await page.keyboard.press('Escape').catch(() => {}); }
        last = r.sig || '';
      }
    }
    await ctx.close();
  }
  // the same to the pixel with and without a host page's styles, every animation stopped at its start
  for (const [W, H, dpr] of [[915, 412, 2.625], [1280, 720, 1], [412, 915, 2.625]]) {
    const shots = [];
    for (const host of [0, 1]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
      if (host) await ctx.addInitScript(hostScript, HOST_CSS);
      const page = await ctx.newPage(), got = [];
      for (const save of only ? [''] : SAME) {
        if (save && !saves.includes(save)) continue;
        await page.goto(url);
        await page.evaluate(o => { localStorage.clear(); sessionStorage.clear(); const labs = { five: true, lean: true, heat: true, kits: true, items: true }; if (o) { o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs || labs)); } localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o ? o.labs || labs : labs)); }, save ? JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')) : null);
        await page.reload(); await page.waitForTimeout(600);
        if (save) { await page.locator('[data-a="resume"]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(900); }
        await page.evaluate(() => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }); for (const c of document.querySelectorAll('#coin')) c.style.visibility = 'hidden'; }); // the turning crest is drawn by the clock
        got.push([save || 'title', await page.screenshot()]);
      }
      shots.push(got); await ctx.close();
    }
    for (let i = 0; i < shots[0].length; i++) if (!shots[1][i] || !shots[0][i][1].equals(shots[1][i][1])) fail(`${W}x${H}@${dpr} ${shots[0][i][0]}`, 'the screen differs inside a host page');
  }
  await browser.close();
  console.log(`${scenes} scenes on ${SHAPES.length} screen shapes, ${screens} console screens checked, ${taps} random taps`);
  console.log(fails.length ? `${fails.length} faults` : 'console checks: all pass');
  process.exit(fails.length ? 1 : 0);
})();
