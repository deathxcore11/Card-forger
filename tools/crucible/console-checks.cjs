// Checks the console look of the Lost Memories test page against its own rules, on many screen shapes.
//   node tools/crucible/console-checks.cjs <page url> <saves dir> [steps]
//   CC_ONLY=title checks only the title screen, every shape, no random taps (a quick look after a title change).
// The page must be served over http (a page opened from the disk may not read its own pictures).
// For every screen shape and every scene (the title, chambers, duels, every window that opens over them) it checks:
//   frame   the frame is 512 x 240 to 640 x 480 whole pixels, each a whole number of device pixels, and fills the
//           screen to within one frame pixel (or reaches 640 x 480); its corner is on a whole device pixel; it is turned
//           a quarter turn on a touch screen held upright, and only there (a desktop window is never turned);
//   law     no rounded corner, no blur, no soft shadow, no gradient (repeating ones too; a conic one only as a 2 or 4
//           pixel dot pattern), no blend mode, no transition, no see-through amount but none, half or all (the
//           console's own blend), no turned or scaled element inside the frame, no picture drawn at a size that is
//           not a whole multiple of its own, no canvas stretched, text only in the game's two pixel faces;
//   flat    on the title, at a scale above one, at most 0.2% of the frame's pixels are not one flat block of device
//           pixels (read from a screenshot: a soft or shifted pixel is not flat);
//   fit     no text cut off by its box (the text bar may be, when it shows its more marker; a plinth's name plate may
//           not), nothing outside the frame, nothing written in a pillar crossing out of it or lying on another word or
//           plaque there, no two plaques on top of each other;
//   names   a name set short on a plinth, the ledge or a pillar (its whole in data-name) is never cut inside a word: it
//           shows whole words of the name, or an initial and a full stop, the last perhaps followed by two dots;
//   scroll  a box of pages in a window or a book ends at least 2 pixels above the plaques under it, no line of words
//           is cut by its foot, and while lines lie below it its more marker shows;
//   hammer  one lit plaque on the screen, and one in each window or scene over it;
//   bar     a short message (the toast) lies exactly on the text bar (96, H - 40, W - 192 wide); the save bar is as wide;
//   door    a door of the chamber is drawn closed unless the words it led to are told over it (a chamber met again
//           after a lost guardian duel shows its door shut);
//   reach   every control that is not switched off can be tapped where it stands (nothing lies over its middle);
//   placed  every moving part drawn over a picture (data-art) sits on the point of the picture it was measured from,
//           through the picture's own place and size as the page laid it out; a torch flame also stands on the bright
//           core of the painted flame, found again in the picture's own pixels; a model drawn in a room (a canvas laid
//           on the room picture, its spots in data-foot) stands with its lowest pixel on its spot;
//   tagged  every part laid on a room's picture says where on it it stands (data-art): each canvas of models beside the
//           picture, and each part of the chamber's room (door leaves, fog, numbers, cursor, keepers), so the placed and
//           clear rules measure them all;
//   clear  no control, label or coin of the screen (outside a window, a scene, a dim or the toast) lies over such a
//           part while it moves (the fog, the cursor, the forge's hammer); a part marked still (data-still: a door's
//           leaves at rest, a number on the step, a model standing in its room) is scenery the choices may stand in
//           front of, and a tap area that draws nothing hides nothing; a part is measured where it shows, cut to the
//           view or any other box that hides what spills out of it;
//   grid    a 1-bit dither drawn for its place on the frame's grid (the doorway fog, data-grid) lies at that place and is
//           never moved, so a dimmed screen's mesh meets it in the same step on every shape (a doorway's fog that does not
//           say where its dots stand is a fault);
//   still   a part marked still runs no animation, and a canvas of models marked still draws the same pixels a moment
//           later;
//   table   on the duel's table each tap area is cut to its zone as the table's camera draws it and draws nothing; the
//           numbers lie inside the view, apart and off the trap rows; the hall's painting spans the view to its foot;
//   errors  no page error.
// Some shapes are checked inside a page that styles pictures the way a host page may (img { max-width: 100%;
// height: auto } and the like), and at the end a few scenes are pictured with and without those styles, with every
// animation stopped at its start, once every face is in and the screen has settled: the two pictures must be the same
// to the pixel.
// Then it taps about the page at random from each scene for [steps] taps (default 40), checking errors and the
// rules again on every console screen it reaches.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

// The first three shapes get every scene and the random taps; the others a short list of scenes.
// [name, width, height, pixel ratio, every scene, in a host page, a touch screen (a phone, a fold or a tablet)]
const SHAPES = [
  ['phone held sideways', 915, 412, 2.625, 1, 0, 1], ['phone held upright', 412, 915, 2.625, 1, 0, 1], ['fold, inner screen', 673, 841, 2.625, 1, 0, 1],
  ['wide desktop', 1024, 480, 1], ['fold, cover screen sideways', 882, 344, 2.625, 0, 0, 1], ['16:9 screen', 1920, 1080, 1],
  ['tablet', 1024, 768, 2, 0, 0, 1], ['small window', 800, 360, 1], ['tall desktop window', 800, 1000, 1],
  ['phone held sideways, in a host page', 915, 412, 2.625, 0, 1, 1], ['16:9 screen, in a host page', 1280, 720, 1, 0, 1], ['upright window, in a host page', 640, 900, 1, 0, 1],
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

  for (const [shape, W, H, dpr, full, host, touch] of SHAPES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
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
      const r = await page.evaluate(async touch => {
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
        if (up !== (touch && innerHeight > innerWidth * 1.15)) out.push(up ? 'frame turned, on a screen that is not a touch screen held upright' : 'frame not turned, on a touch screen held upright');
        if ([A.left, A.top].some(v => Math.abs(v * dpr - Math.round(v * dpr)) > .02)) out.push(`frame's corner at ${(A.left * dpr).toFixed(3)}, ${(A.top * dpr).toFixed(3)} device pixels, off the device grid`);
        const fr = e => { let x = 0, y = 0; for (let q = e; q && q !== app; q = q.offsetParent) { x += q.offsetLeft; y += q.offsetTop; } return [x, y, e.offsetWidth, e.offsetHeight]; }; // in frame pixels
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
            if (/(linear|radial)-gradient\(/.test(s.backgroundImage) || /conic-gradient\(/.test(s.backgroundImage) && !/2px 2px|4px 4px/.test(s.backgroundSize)) out.push(`${where}: gradient ${s.backgroundImage.slice(0, 60)}`); // repeating ones too; a conic pattern is a dot pattern only at 2 or 4 pixels
            if (s.mixBlendMode && s.mixBlendMode !== 'normal') out.push(`${where}: blend mode ${s.mixBlendMode}`);
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
        for (const e of app.querySelectorAll('.pq, .lb, .dt b, .dt p, .mw h2, .atk, .cd .n1, .cd .n2, .pln .pnm, [data-name]')) {
          if (!vis(e) || e.closest('.sc')) continue;
          if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflow !== 'visible') out.push(`${name(e)} "${e.textContent.slice(0, 30)}": text cut off (${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight})`);
        }
        const bar = app.querySelector('.fr > .bar'); if (bar) { const p = bar.firstElementChild; if (p.scrollHeight > p.clientHeight + 4 && !bar.classList.contains('more')) out.push('text bar holds more than it shows, with no more marker'); }
        for (const e of app.querySelectorAll('.lb, .pq, .cd, .pf, .sl, .ga, .mw')) if (vis(e) && !inside(e.getBoundingClientRect(), A) && !scrolledAway(e)) out.push(`${name(e)} "${e.textContent.slice(0, 20)}": outside the frame`);
        const pillars = [...app.querySelectorAll('.fr > .ab')].filter(p => p.style.width === '96px');
        for (const p of pillars) { const P = p.getBoundingClientRect(); for (const e of p.querySelectorAll('.lb, .pq, .ga, .pf, .sl, .spk, .seal, .pip, .backs')) if (vis(e) && !inside(e.getBoundingClientRect(), P)) out.push(`${name(e)} "${e.textContent.slice(0, 20)}": crosses out of its pillar`); }
        // in a pillar no word lies on another word or a plaque (a name on two lines, a readout over the plaque under it)
        for (const p of pillars) {
          const ws = [...p.querySelectorAll('.lb, .pq, .big2')].filter(vis).map(e => [e, fr(e)]);
          for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) { const [a, A2] = ws[i], [b, B2] = ws[j]; if (A2[0] < B2[0] + B2[2] && B2[0] < A2[0] + A2[2] && A2[1] < B2[1] + B2[3] && B2[1] < A2[1] + A2[3]) out.push(`${name(a)} "${a.textContent.trim().slice(0, 16)}" and ${name(b)} "${b.textContent.trim().slice(0, 16)}" lie on each other in a pillar`); }
        }
        // names: a name set short (data-name holds it whole) is never cut inside a word: each word shown is a whole word
        // of the name, or one word's initial and a full stop, and only the last may be followed by two dots
        for (const e of app.querySelectorAll('[data-name]')) {
          if (!vis(e)) continue;
          const full = e.dataset.name.toUpperCase().split(/\s+/).filter(Boolean), shown = e.innerText.toUpperCase().split(/\s+/).filter(Boolean);
          for (const w of shown) { const x = w.replace(/\.\.$/, ''); if (!full.includes(x) && !(/^[A-Z]\.$/.test(x) && full.some(f => f[0] === x[0]))) out.push(`${name(e)} "${e.innerText.replace(/\s+/g, ' ').slice(0, 24)}": the name "${e.dataset.name}" cut inside a word ("${w}")`); }
        }
        // (a plaque scrolled out of its box is not on the screen, so it overlaps nothing)
        const pqs = [...app.querySelectorAll('.pq')].filter(vis).map(e => [e, e.getBoundingClientRect()]);
        for (let i = 0; i < pqs.length; i++) for (let j = i + 1; j < pqs.length; j++) { const [a, ra] = pqs[i], [b, rb] = pqs[j]; if (a.closest('.mw') !== b.closest('.mw') || scrolledAway(a) || scrolledAway(b)) continue; if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1) out.push(`plaques "${a.textContent}" and "${b.textContent}" overlap`); }
        // scroll: each box of pages in a window or a book ends on a whole line, clear of the plaques under it, and marks more below
        for (const sc of app.querySelectorAll('.mw .sc, .book .sc')) {
          if (!vis(sc)) continue;
          const [sx, sy, sw, sh] = fr(sc), box = sc.closest('.mw, .book'), S = sc.getBoundingClientRect(), h = sc.clientHeight;
          for (const p of box.querySelectorAll('.pq')) { if (sc.contains(p) || !vis(p)) continue; const [px, py, pw] = fr(p); if (px < sx + sw && sx < px + pw && py >= sy && sy + sh > py - 2) out.push(`${name(sc)}: its foot at ${sy + sh} is less than 2 pixels above the plaque "${p.textContent.trim()}" at ${py}`); }
          let below = 0;
          const tw = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT);
          for (let t = tw.nextNode(); t; t = tw.nextNode()) {
            if (!t.textContent.trim() || !t.parentElement.offsetHeight) continue;
            let b = t.parentElement; while (b !== sc && getComputedStyle(b).display === 'inline') b = b.parentElement;
            const lh = parseFloat(getComputedStyle(b).lineHeight) || 16, rg = document.createRange(); rg.selectNodeContents(t);
            for (const q of rg.getClientRects()) {
              if (!q.width || !q.height) continue; // a line's box is its line height about the middle of its glyphs' box, in the box's own pixels
              const mid = (up ? S.right - (q.left + q.right) / 2 : (q.top + q.bottom) / 2 - S.top) / k - sc.clientTop, a = mid - lh / 2, z = mid + lh / 2;
              if (a < h - 1 && z > h + 1 && a > -1) out.push(`${name(sc)}: the line "${t.textContent.trim().slice(0, 24)}" is cut by its foot (${a.toFixed(1)} to ${z.toFixed(1)} in ${h})`);
              if (a >= h - 1) below++;
            }
          }
          const mk = sc.nextElementSibling && sc.nextElementSibling.classList.contains('scm') ? sc.nextElementSibling : null;
          if (below && (!mk || mk.hidden || !vis(mk))) out.push(`${name(sc)}: ${below} lines lie below it, with no more marker`);
        }
        // hammer: one lit plaque in each layer (the screen, and each window or scene over it)
        for (const L of [app, ...app.querySelectorAll('.mw, .story')]) {
          const lit = [...L.querySelectorAll('.pq.lit')].filter(e => vis(e) && (L === app ? !e.closest('.mw, .story') : e.closest('.mw, .story') === L));
          if (lit.length > 1) out.push(`${lit.length} plaques lit in ${L === app ? 'the screen' : name(L)} (${lit.map(e => e.textContent.trim().slice(0, 14)).join(', ')}): only the one the hammer is on may be`);
        }
        // bar: a short message lies on the text bar, and the save bar is as wide
        const W0 = app.offsetWidth, H0 = app.offsetHeight, toastEl = app.querySelector('#toast');
        if (toastEl && toastEl.textContent.trim() && vis(toastEl)) { const [tx, ty, tw2] = fr(toastEl); if (tx !== 96 || ty !== H0 - 40 || tw2 !== W0 - 192) out.push(`#toast at ${tx}, ${ty}, ${tw2} wide: not on the text bar (96, ${H0 - 40}, ${W0 - 192} wide)`); }
        const sbar = app.querySelector('.savebar'); if (sbar && vis(sbar) && sbar.offsetWidth !== W0 - 192) out.push(`.savebar ${sbar.offsetWidth} wide, not ${W0 - 192}`);
        // clear: no control, label or coin of the screen lies over a moving part drawn on a picture. A part marked still
        // (data-still: a door's leaves at rest, a model standing in its room) is scenery the choices may stand in front of,
        // as they stand in front of the painting; it is held to staying still below. A tap area that draws nothing (the
        // forge's "tap to go on") hides nothing.
        const drawsNothing = e => { const s = getComputedStyle(e); return s.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) && ['Top', 'Right', 'Bottom', 'Left'].every(k => !parseFloat(s['border' + k + 'Width'])) && s.boxShadow === 'none' && !(s.outlineStyle !== 'none' && parseFloat(s.outlineWidth)) && !e.textContent.trim() && !e.children.length; };
        // A part is measured where it shows: cut to every box round it that hides what spills out (the view crops a
        // room's canvas as it crops the painting, so the canvas never reaches the pillars).
        const shown = e => {
          const r = e.getBoundingClientRect(); let { left, top, right, bottom } = r;
          for (let q = e.parentElement; q && q !== document.documentElement; q = q.parentElement) {
            const s = getComputedStyle(q), c = q.getBoundingClientRect();
            if (s.overflowX !== 'visible') { left = Math.max(left, c.left); right = Math.min(right, c.right); }
            if (s.overflowY !== 'visible') { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
          }
          return { left, top, right, bottom };
        };
        const parts = [...app.querySelectorAll('[data-art]:not([data-still])')].filter(vis).map(e => [e, shown(e)]).filter(([, P]) => P.right > P.left && P.bottom > P.top);
        if (parts.length) for (const e of app.querySelectorAll('[data-a], .pq, .lb, .coin, #coin, .runslot')) {
          if (!vis(e) || e.closest('.mw, .story, .dim, .toast, [data-art]') || e.querySelector('[data-art]') || drawsNothing(e)) continue;
          const q = e.getBoundingClientRect();
          for (const [p, P] of parts) if (q.left < P.right - .5 && P.left < q.right - .5 && q.top < P.bottom - .5 && P.top < q.bottom - .5) out.push(`${name(e)} "${e.textContent.trim().slice(0, 20)}": lies over the moving part ${name(p)}`);
        }
        // door: a door is closed until the player goes through it; one stands open (its opened picture, made as it swung)
        // only under the words it led to
        if (!app.querySelector('.story')) for (const d of app.querySelectorAll('.dr.opn, .dr > img[src^="data:"]')) out.push(`${name(d.closest('.dr'))}: a door drawn open with no words over it`);
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
        // tagged: what is laid on a room's picture carries data-art, so the rules above measure it. A canvas of models
        // beside the picture, and every part inside the chamber's room, which holds nothing but its picture and what
        // stands on it.
        for (const pic of app.querySelectorAll('img[data-pic="room"]')) {
          const sib = [...pic.parentElement.children].filter(e => e !== pic && (e.tagName === 'CANVAS' || pic.parentElement.classList.contains('room')));
          for (const e of sib) if (!e.hasAttribute('data-art')) out.push(`${name(e)}: laid on the room's picture, but says nothing of where on it it stands`);
        }
        // grid: a 1-bit dither drawn for its place on the frame's grid (data-grid: where its corner falls, counted in fours)
        // is laid at that place, and nothing moves it, so it meets every other pattern on the frame in the same step
        for (const e of app.querySelectorAll('[data-grid], .dfog')) {
          if (!vis(e)) continue;
          if (!e.dataset.grid) { out.push(`${name(e)}: a doorway's fog says nothing of where its dots stand on the frame's grid`); continue; }
          const [gx, gy] = e.dataset.grid.split(',').map(Number), [x, y] = fr(e);
          if ((x & 3) !== gx || (y & 3) !== gy) out.push(`${name(e)}: its dots were drawn for ${gx}, ${gy} on the frame's grid of fours, and it lies at ${x & 3}, ${y & 3}`);
          if (getComputedStyle(e).transform !== 'none') out.push(`${name(e)}: a pattern pinned to the frame's grid is moved (${getComputedStyle(e).transform})`);
        }
        // still: a part marked still does not move. No animation runs on it, and a canvas of models draws the same pixels a
        // moment later (a room's models are drawn once, when the room is laid out).
        const stills = [...app.querySelectorAll('[data-still]')].filter(vis);
        for (const e of stills) if (e.getAnimations().some(a => a.playState === 'running')) out.push(`${name(e)}: marked still, but it moves`);
        const snap = c => { try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) >>> 0; return h; } catch { return null; } };
        const cvs = stills.filter(e => e.tagName === 'CANVAS').map(c => [c, snap(c)]);
        if (cvs.length) { await new Promise(ok => setTimeout(ok, 150)); for (const [c, h] of cvs) if (c.isConnected && h !== null && snap(c) !== h) out.push(`${name(c)}: marked still, but what it draws changes`); }
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
        // the duel's table, when no move is playing: each tap area is cut to its zone's four corners as the table's camera
        // draws them and draws nothing itself; the numbers' plates lie inside the view, apart, off the trap rows; the
        // hall's painting spans the view's width down to its foot, with at most an eighth of the view dark above it
        // (or it is the tallest cut); a relic's strip lies inside the window.
        const tbl = app.querySelector('canvas#tbl');
        if (tbl && tbl.dataset.cam && !(window.LM && LM.G && LM.G.playing)) {
          const c = JSON.parse(tbl.dataset.cam), co = Math.cos(c.pitch), si = Math.sin(c.pitch);
          const proj = p => { const dy = p[1] - c.y, dz = p[2] - c.z, d = -dy * si - dz * co, u = dy * co - dz * si; return [Math.round(c.cx + c.f * p[0] / d), Math.round(c.cy - c.f * u / d)]; };
          // the table's measures as app.mjs lays it out (TBL and zoneQuad): zones 62 apart, rows at 76, trap rows at 138
          const quad = (seat, zi, trap) => { const x = (zi - 2) * 62, z = (seat ? -1 : 1) * (trap ? 138 : 76), hw = trap ? 17 : 25, hd = trap ? 22 : 33; return [[x - hw, 0, z - hd], [x + hw, 0, z - hd], [x + hw, 0, z + hd], [x - hw, 0, z + hd]].map(proj); };
          for (const e of app.querySelectorAll('.zh[data-zone]')) {
            const [s, z] = e.dataset.zone.split(':'), q = s[0] === 't' ? quad(+s.slice(1), +z, true) : quad(+s, +z + (c.off || 0), false);
            const pts = (e.style.clipPath.match(/-?[\d.]+px -?[\d.]+px/g) || []).map(t => t.split(' ').map(parseFloat));
            if (pts.length !== 4) { out.push(`${name(e)} zone ${e.dataset.zone}: tap area not cut to four corners`); continue; }
            const off = pts.map(([x, y], i) => Math.hypot(e.offsetLeft + x - q[i][0], e.offsetTop + y - q[i][1]));
            if (Math.max(...off) > .5) out.push(`${name(e)} zone ${e.dataset.zone}: tap area ${Math.max(...off).toFixed(1)} frame pixels off the zone as drawn`);
            const st = getComputedStyle(e);
            if (st.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(st.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(st['border' + k + 'Width'])) || (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth)) || st.boxShadow !== 'none') out.push(`${name(e)} zone ${e.dataset.zone}: a tap area that draws something over the table`);
          }
          const plates = JSON.parse(tbl.dataset.plates || '[]'), traps = [0, 1].flatMap(s => [0, 1, 2, 3, 4].map(z => { const q = quad(s, z, true), xs = q.map(p => p[0]), ys = q.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }));
          const meet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
          plates.forEach(([s, z, x, y, w, h], i) => {
            if (x < 0 || y < 0 || x + w > tbl.width || y + h > tbl.height) out.push(`numbers of zone ${s}:${z} reach out of the view (${x}, ${y}, ${w} x ${h} in ${tbl.width} x ${tbl.height})`);
            const r = [x, y, x + w, y + h];
            if (traps.some(t => meet(r, t))) out.push(`numbers of zone ${s}:${z} lie over a trap zone`);
            for (const [s2, z2, x2, y2, w2, h2] of plates.slice(i + 1)) if (meet(r, [x2, y2, x2 + w2, y2 + h2])) out.push(`numbers of zones ${s}:${z} and ${s2}:${z2} overlap`);
          });
          const hall = app.querySelector('img[data-pic="hall"]');
          if (hall && hall.complete && hall.naturalWidth) {
            const vwW = tbl.width, vwH = tbl.height, l = hall.offsetLeft, t = hall.offsetTop;
            if (l > 0 || l + hall.offsetWidth < vwW) out.push(`the hall's painting does not span the view (${l} to ${l + hall.offsetWidth} of ${vwW})`);
            if (t + hall.offsetHeight < vwH) out.push(`the hall's painting stops ${vwH - t - hall.offsetHeight} frame pixels above the view's foot`);
            if (t > Math.ceil(vwH / 8) && hall.naturalHeight < 369) out.push(`the hall's painting leaves ${t} frame pixels dark above it, and a taller cut exists`);
          }
          const vwin = app.querySelector('.vw');
          for (const e of app.querySelectorAll('.rlcw')) if (vwin && !inside(e.getBoundingClientRect(), vwin.getBoundingClientRect())) out.push(`${name(e)}: a relic's strip reaches out of the window`);
        }
        // the card pictures: cut to console colour once the sheets are converted
        const unconverted = [...app.querySelectorAll('.cd .art, .big .art')].filter(e => e.style.backgroundImage && !/blob:/.test(e.style.backgroundImage)).length;
        if (unconverted) out.push(`${unconverted} card pictures still the full-colour sheet`);
        return { ps: true, out: [...new Set(out)], sig: app.dataset.phase + '|' + [...app.querySelectorAll('[data-a]')].map(e => e.dataset.a).join(',').slice(0, 400) };
      }, !!touch);
      if (r.ps) { screens++; for (const o of r.out) fail(where, o); }
      for (const e of errors) fail(where, 'page error: ' + e); errors = [];
      return r;
    };
    // flat: every frame pixel one flat block of device pixels, read back from a screenshot (at a scale above one)
    const flat = async where => {
      const g = await page.evaluate(() => {
        const a = document.getElementById('app'); if (!a.classList.contains('ps')) return null;
        const r = a.getBoundingClientRect(), m = new DOMMatrix(getComputedStyle(a).transform), d = devicePixelRatio;
        return { W: a.offsetWidth, H: a.offsetHeight, n: Math.round(Math.hypot(m.a, m.b) * d), up: Math.abs(m.b) > Math.abs(m.a), x: Math.round(r.left * d), y: Math.round(r.top * d), w: Math.round(r.width * d) };
      });
      if (!g || g.n < 2) return;
      await page.waitForFunction(() => [...document.fonts].filter(f => /LM Text/.test(f.family)).length > 1, null, { timeout: 5000 }).catch(() => {}); // the body face struck on whole pixels (pxtext.mjs) is in
      const png = (await page.screenshot()).toString('base64');
      const bad = await page.evaluate(async ([png, g]) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
        let bad = 0;
        for (let fy = 0; fy < g.H; fy++) for (let fx = 0; fx < g.W; fx++) {
          const bx = g.up ? g.x + g.w - (fy + 1) * g.n : g.x + fx * g.n, by = g.up ? g.y + fx * g.n : g.y + fy * g.n;
          const i0 = (by * c.width + bx) * 4; let worst = 0;
          for (let yy = 0; yy < g.n && !(worst > 3); yy++) for (let xx = 0; xx < g.n; xx++) { const i = i0 + (yy * c.width + xx) * 4; worst = Math.max(worst, Math.abs(d[i] - d[i0]), Math.abs(d[i + 1] - d[i0 + 1]), Math.abs(d[i + 2] - d[i0 + 2])); }
          if (worst > 3) bad++;
        }
        return bad;
      }, [png, g]);
      if (bad > g.W * g.H * .002) fail(where, `${bad} of ${g.W * g.H} frame pixels are not one flat block of device pixels (more than 0.2%)`);
    };
    for (const save of only ? [null] : full ? pick : SHORT.filter(x => !x || saves.includes(x))) {
      const base = `${shape} ${W}x${H}@${dpr} ${save || 'title'}`;
      await load(save); await page.waitForTimeout(500); scenes++;
      await audit(base);
      if (!save) await flat(base);
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
  for (const [W, H, dpr, touch] of [[915, 412, 2.625, 1], [1280, 720, 1, 0], [412, 915, 2.625, 1]]) {
    const shots = [];
    for (const host of [0, 1]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
      if (host) await ctx.addInitScript(hostScript, HOST_CSS);
      const page = await ctx.newPage(), got = [];
      for (const save of only ? [''] : SAME) {
        if (save && !saves.includes(save)) continue;
        await page.goto(url);
        await page.evaluate(o => { localStorage.clear(); sessionStorage.clear(); const labs = { five: true, lean: true, heat: true, kits: true, items: true }; if (o) { o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs || labs)); } localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o ? o.labs || labs : labs)); }, save ? JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')) : null);
        await page.reload(); await page.waitForTimeout(600);
        if (save) { await page.locator('[data-a="resume"]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(900); }
        await page.waitForFunction(() => [...document.fonts].filter(f => /LM Text/.test(f.family)).length > 1, null, { timeout: 5000 }).catch(() => {}); // the body face struck on whole pixels (pxtext.mjs) is in
        // every face in first: a face arriving late (the title's carved capitals) lays the screen out again, its torches
        // and cursor started afresh, so the two pages would be stopped at different steps
        await page.evaluate(() => document.fonts.ready.then(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)))));
        // Every animation stopped at its start (the turning crest, drawn by the clock, hidden), and each picture taken with
        // the endless loops set back to their start by the browser itself: a loop drawn by the compositor (the cursor's
        // bob) can go on showing the step it was at when the page stopped it. The screen is taken once it has settled: a
        // picture drawn when its skins arrive (a room's models) can land after the first shot, so shots are taken until
        // two in a row agree, stopping again each time.
        const still = () => page.evaluate(() => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }); for (const c of document.querySelectorAll('#coin')) c.style.visibility = 'hidden'; return new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))); });
        const snap = () => page.screenshot({ animations: 'disabled' });
        await still();
        let shot = await snap();
        for (let k = 0; k < 6; k++) { await page.waitForTimeout(250); await still(); const again = await snap(); if (again.equals(shot)) break; shot = again; }
        got.push([save || 'title', shot]);
      }
      shots.push(got); await ctx.close();
    }
    for (let i = 0; i < shots[0].length; i++) if (!shots[1][i] || !shots[0][i][1].equals(shots[1][i][1])) {
      fail(`${W}x${H}@${dpr} ${shots[0][i][0]}`, 'the screen differs inside a host page');
      // with CHECKS_SHOTS set to a folder, both pictures are kept there, to be looked at
      if (process.env.CHECKS_SHOTS && shots[1][i]) for (const h of [0, 1]) fs.writeFileSync(path.join(process.env.CHECKS_SHOTS, `host-${W}x${H}-${shots[0][i][0].replace(/\.json$/, '')}-${h}.png`), shots[h][i][1]);
    }
  }
  await browser.close();
  console.log(`${scenes} scenes on ${SHAPES.length} screen shapes, ${screens} console screens checked, ${taps} random taps`);
  console.log(fails.length ? `${fails.length} faults` : 'console checks: all pass');
  process.exit(fails.length ? 1 : 0);
})();
