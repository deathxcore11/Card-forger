// Checks the console look of the Lost Memories test page against its own rules, on many screen shapes.
//   node tools/crucible/console-checks.cjs <page url> <saves dir> [steps]
//   CC_ONLY=title checks only the title screen, every shape, no random taps (a quick look after a title change).
//   CC_ONLY=beats steps only the duel's beats (a quick look after a change to the table).
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
//   fit     no text cut off by its box (the text bar may be, when it shows its more marker), nothing outside the frame,
//           nothing written in a pillar crossing out of it, no two plaques on top of each other;
//   scroll  a box of pages in a window or a book ends at least 2 pixels above the plaques under it, no line of words
//           is cut by its foot, and while lines lie below it its more marker shows;
//   hammer  one lit plaque on the screen, and one in each window or scene over it;
//   bar     a short message (the toast) lies exactly on the text bar (96, H - 40, W - 192 wide); the save bar is as wide;
//   reach   every control that is not switched off can be tapped where it stands (nothing lies over its middle);
//   placed  every moving part drawn over a picture (data-art) sits on the point of the picture it was measured from,
//           through the picture's own place and size as the page laid it out; a torch flame also stands on the bright
//           core of the painted flame, found again in the picture's own pixels; a model drawn in a room (a canvas laid
//           on the room picture, its spots in data-foot) stands with its lowest pixel on its spot;
//   clear   no control, label or coin of the screen (outside a window, a scene, a dim or the toast) lies over such a
//           moving part;
//   table   on the duel's table each tap area is cut to its zone as the table's camera draws it and draws nothing; the
//           numbers lie inside the view, apart and off the trap rows; the hall's painting spans the view to its foot;
//           the numbers keep the one notation the frame gives them (tight or full) whatever cards lie there;
//   beats   on the owner's eight screen shapes, a duel's moves are stepped a thirtieth of a second at a time on a stopped
//           clock (a rival's attack let through, your attack on a rival monster, then the rival's whole turn), and on
//           every drawing of the table the numbers lie inside the view, apart, each against its own card as drawn (never
//           left floating), keep one notation, and none lies over another card's picture (read from the canvas's own
//           pixels: where a card and a plate meet, the card shows);
//   first   the duel table's first drawing that has anything in it, kept the moment the page puts it on the screen, is
//           the finished table, the same to the pixel as once all is settled (until then the hall stands alone): never a
//           bare table drawn before its pictures or its ground are in;
//   errors  no page error.
// Some shapes are checked inside a page that styles pictures the way a host page may (img { max-width: 100%;
// height: auto } and the like), and at the end a few scenes are pictured with and without those styles, with every
// animation stopped at its start: the two pictures must be the same to the pixel.
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
// the shapes the owner plays on, for the duel's beats, and the duels stepped on them
const BEAT_SHAPES = [['phone held sideways', 915, 412, 2.625, 1], ['phone held upright', 412, 915, 2.625, 1], ['fold, inner screen', 673, 841, 2.625, 1], ['fold, cover screen sideways', 882, 344, 2.625, 1],
  ['16:9 screen', 1920, 1080, 1, 0], ['tablet', 1024, 768, 2, 1], ['tall desktop window', 800, 1000, 1, 0], ['small window', 800, 360, 1, 0]];
const BEAT_SAVES = ['duel-regular-f1-h0.json', 'duel-boss-f1-trap-prompt-h0.json'];
// The duel table's first drawing that has anything in it, kept the moment it is put on the screen (firstTable, run in
// the page before it loads), and held against the table as it stands once settled (tableFirst).
function firstTable() {
  const put = CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData = function (im, ...a) {
    put.call(this, im, ...a);
    if (!window.__tbl0 && this.canvas.id === 'tbl') for (let i = 3; i < im.data.length; i += 4) if (im.data[i]) { window.__tbl0 = this.canvas.toDataURL(); break; }
  };
}
async function tableFirst() {
  const c = document.getElementById('tbl'); if (!c || !window.__tbl0 || (window.LM && LM.G && LM.G.playing)) return null;
  const im = new Image(); im.src = window.__tbl0; await im.decode(); const k = document.createElement('canvas'); k.width = im.width; k.height = im.height; const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, k.width, k.height).data, same = () => { const n = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; return n.length === d.length && n.every((v, i) => v === d[i]); };
  // Something was drawn: it must be the table as it stands, seen twice 450 ms apart, so a blinking mark is caught in both
  // its colours.
  for (let i = 3; i < d.length; i += 4) if (d[i]) {
    if (same()) return null; await new Promise(r => setTimeout(r, 450)); if (same()) return null;
    return "the duel table's first drawing is not the finished table (drawn before its pictures or its numbers were in)"; }
  return null;
}
// The table as drawn at one moment of a beat (in the page): the numbers' plates (data-plates: seat, zone, x, y, w, h), each
// card's four corners on the screen (data-cards: its zone key, or none for a card shown or arriving) and the canvas's
// pixels. A plate's own colours are the frame's dark and the five letter colours, cut to 15 bits as the table cuts them.
function tableNow() {
  const t = document.getElementById('tbl'); if (!t || !t.dataset.plates) return null;
  const plates = JSON.parse(t.dataset.plates), cards = JSON.parse(t.dataset.cards || '[]'), out = [], W = t.width, H = t.height;
  const px = t.getContext('2d').getImageData(0, 0, W, H).data, cut = c => c.map(v => v & 0xf8).join();
  const own = new Set([[26, 15, 18], [243, 234, 216], [233, 196, 106], [240, 138, 114], [194, 180, 156], [159, 208, 192]].map(cut));
  const inQuad = (q, x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = [q[i * 2], q[i * 2 + 1]], [bx, by] = [q[(i + 1) % 4 * 2], q[(i + 1) % 4 * 2 + 1]], c = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (c) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; };
  const meet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  plates.forEach(([s, z, x, y, w, h], i) => {
    const r = [x, y, x + w, y + h], key = `m${s}.${z}`;
    if (x < 0 || y < 0 || x + w > W || y + h > H) out.push(`numbers of zone ${s}:${z} reach out of the view (${x}, ${y}, ${w} x ${h} in ${W} x ${H})`);
    for (const [s2, z2, x2, y2, w2, h2] of plates.slice(i + 1)) if (meet(r, [x2, y2, x2 + w2, y2 + h2])) out.push(`numbers of zones ${s}:${z} and ${s2}:${z2} overlap`);
    const mine = cards.find(c => c[0] === key);
    if (!mine) out.push(`numbers of zone ${s}:${z} drawn with no card of theirs on the table`);
    else { const xs = [1, 3, 5, 7].map(i => mine[i]), ys = [2, 4, 6, 8].map(i => mine[i]), mx = x + w / 2, gap = s === 0 ? Math.min(...ys) - (y + h) : y - Math.max(...ys);
      if (mx < Math.min(...xs) || mx > Math.max(...xs) || gap < 0 || gap > 3) out.push(`numbers of zone ${s}:${z} (${x}, ${y}) are not against their card's ${s === 0 ? 'far' : 'near'} edge (${gap} pixels off)`); }
    for (const c of cards) {
      if (c[0] === key || c.length < 9) continue;
      const q = c.slice(1); let n = 0, ownPx = 0;
      for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        if (!inQuad(q, xx + .5, yy + .5)) continue; n++; const i4 = (yy * W + xx) * 4; if (own.has([px[i4], px[i4 + 1], px[i4 + 2]].join())) ownPx++; }
      if (n >= 6 && ownPx > n * .4) out.push(`numbers of zone ${s}:${z} lie over the card ${c[0] || '(shown)'} (${ownPx} of the ${n} pixels where they meet are the plate's)`);
    }
  });
  return { tick: +t.dataset.tick, tight: t.dataset.tight, out };
}
const WINDOWS = ['tab:menu', 'tab:help', 'tab:options', 'tab:deck', 'tab:relics', 'tab:doors', 'tab:duel', 'barmore'];

(async () => {
  const [url, savesDir, stepsArg] = process.argv.slice(2);
  if (!url || !savesDir) { console.log('usage: console-checks.cjs <page url> <saves dir> [steps]'); process.exit(2); }
  const only = process.env.CC_ONLY === 'title', beatsOnly = process.env.CC_ONLY === 'beats', steps = only ? 0 : +(stepsArg || 40);
  const saves = fs.readdirSync(savesDir).filter(f => /^(chamber|duel|reward|anvil|bazaar|kit|charm)-/.test(f)).sort();
  const pick = [null, ...saves.filter(f => /^chamber-f\d\.json$|^chamber-boss-door-f[13]-h(0|10)\.json$/.test(f)),
    ...saves.filter(f => /^duel-(regular|boss|cursed)-f[123]-h0\.json$|trap-prompt-h5|narrow|fog|lesson/.test(f)).slice(0, 10),
    ...saves.filter(f => /^(reward|anvil|bazaar|kit|charm)-/.test(f))];
  const browser = await chromium.launch();
  const fails = []; let scenes = 0, taps = 0, screens = 0;
  const fail = (where, what) => { fails.push(`${where}: ${what}`); if (fails.length < 60) console.log('FAIL', where, what); };

  for (const [shape, W, H, dpr, full, host, touch] of beatsOnly ? [] : SHAPES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
    if (host) await ctx.addInitScript(hostScript, HOST_CSS);
    await ctx.addInitScript(firstTable);
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
        for (const e of app.querySelectorAll('.pq, .lb, .dt b, .dt p, .mw h2, .atk, .cd .n1, .cd .n2')) {
          if (!vis(e) || e.closest('.sc')) continue;
          if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflow !== 'visible') out.push(`${name(e)} "${e.textContent.slice(0, 30)}": text cut off (${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight})`);
        }
        const bar = app.querySelector('.fr > .bar'); if (bar) { const p = bar.firstElementChild; if (p.scrollHeight > p.clientHeight + 4 && !bar.classList.contains('more')) out.push('text bar holds more than it shows, with no more marker'); }
        for (const e of app.querySelectorAll('.lb, .pq, .cd, .pf, .sl, .ga, .mw')) if (vis(e) && !inside(e.getBoundingClientRect(), A) && !scrolledAway(e)) out.push(`${name(e)} "${e.textContent.slice(0, 20)}": outside the frame`);
        const pillars = [...app.querySelectorAll('.fr > .ab')].filter(p => p.style.width === '96px');
        for (const p of pillars) { const P = p.getBoundingClientRect(); for (const e of p.querySelectorAll('.lb, .pq, .ga, .pf, .sl, .spk, .seal, .pip, .backs')) if (vis(e) && !inside(e.getBoundingClientRect(), P)) out.push(`${name(e)} "${e.textContent.slice(0, 20)}": crosses out of its pillar`); }
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
        // clear: no control, label or coin of the screen lies over a moving part drawn on a picture
        const parts = [...app.querySelectorAll('[data-art]')].filter(vis).map(e => [e, e.getBoundingClientRect()]);
        if (parts.length) for (const e of app.querySelectorAll('[data-a], .pq, .lb, .coin, #coin, .runslot')) {
          if (!vis(e) || e.closest('.mw, .story, .dim, .toast, [data-art]') || e.querySelector('[data-art]')) continue;
          const q = e.getBoundingClientRect();
          for (const [p, P] of parts) if (q.left < P.right - .5 && P.left < q.right - .5 && q.top < P.bottom - .5 && P.top < q.bottom - .5) out.push(`${name(e)} "${e.textContent.trim().slice(0, 20)}": lies over the moving part ${name(p)}`);
        }
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
          // the notation the frame gives: one number a card (tight) exactly when two of your plates of the widest four-digit
          // numbers (ATK, three pixels, DEF, on the frame's dark) would leave under four pixels of stone between them at your
          // row's far edge, or three lines do not fit between the rows; and each plate has the lines its notation says
          const g = document.createElement('canvas'), gx = g.getContext('2d', { willReadFrequently: true }); g.width = g.height = 12; gx.font = '8px "LM Label"';
          const dw = Math.max(...[...'0123456789'].map(ch => Math.round(gx.measureText(ch).width))), fullW = 2 * (4 * dw - 1) + 5;
          gx.textBaseline = 'top'; gx.fillStyle = '#fff'; gx.fillText('0', 0, 1); const gd = gx.getImageData(0, 0, 12, 12).data, rows = [...Array(12).keys()].filter(y => [...Array(12).keys()].some(x => gd[(y * 12 + x) * 4 + 3] >= 128)), gh = rows.length ? rows[rows.length - 1] - rows[0] + 1 : 5;
          const tight = fullW + 4 > proj([-62, 0, 43])[0] - proj([-124, 0, 43])[0] || 3 * (gh + 1) + 5 > proj([0, 0, 43])[1] - proj([0, 0, -43])[1];
          if (tbl.dataset.tight != null && +tbl.dataset.tight !== +tight) out.push(`the numbers are drawn ${+tbl.dataset.tight ? 'one to a card' : 'in full'}, but the frame gives ${tight ? 'one to a card' : 'them in full'}`);
          for (const [s, z, , , , h] of plates) if (h !== (s === 1 && !tight ? 2 : 1) * (gh + 1) + 1) out.push(`numbers of zone ${s}:${z} are ${h} pixels tall, not the ${s === 1 && !tight ? 'two lines' : 'one line'} of their notation`);
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
      if (save) { const d = await page.evaluate(tableFirst); if (d) fail(base, d); }
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
  for (const [W, H, dpr, touch] of beatsOnly ? [] : [[915, 412, 2.625, 1], [1280, 720, 1, 0], [412, 915, 2.625, 1]]) {
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
        await page.evaluate(() => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }); for (const c of document.querySelectorAll('#coin')) c.style.visibility = 'hidden'; }); // the turning crest is drawn by the clock
        got.push([save || 'title', await page.screenshot()]);
      }
      shots.push(got); await ctx.close();
    }
    for (let i = 0; i < shots[0].length; i++) if (!shots[1][i] || !shots[0][i][1].equals(shots[1][i][1])) fail(`${W}x${H}@${dpr} ${shots[0][i][0]}`, 'the screen differs inside a host page');
  }
  // beats: a rival's attack waiting on your answer let through, your attack on a rival monster, then the rival's whole
  // turn, stepped a thirtieth of a second at a time on a stopped clock, the table checked at every drawing (tableNow)
  let beatTicks = 0;
  if (!only) for (const [shape, W, H, dpr, touch] of BEAT_SHAPES) for (const save of BEAT_SAVES) {
    if (!saves.includes(save)) continue;
    const where = `${shape} ${W}x${H}@${dpr} ${save} beats`, said = new Set(), notes = new Set();
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(o => { localStorage.clear(); sessionStorage.clear(); o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')));
    await page.reload(); await page.waitForTimeout(1500);
    await page.locator('[data-a="resume"]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(1500);
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 3000));
    const tap = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ force: true, noWaitAfter: true, timeout: 3000 }).catch(() => {}); return true; };
    let tight = null; const counts = {};
    const step = async (label, max) => {
      let rest = 0; counts[label] = 0;
      for (let i = 0; i < max && rest < 12; i++) {
        await page.clock.runFor(34);
        const r = await page.evaluate(tableNow);
        if (r && r.tick >= 0) { beatTicks++; counts[label]++; for (const o of r.out) if (!said.has(o)) { said.add(o); fail(`${where}, ${label} at tick ${r.tick}`, o); } }
        if (r && tight != null && r.tight !== tight && !notes.has('tight')) { notes.add('tight'); fail(`${where}, ${label}`, `the numbers' notation changed from ${tight} to ${r.tight} in the duel`); }
        if (r) tight = r.tight;
        rest = await page.evaluate(() => !!(window.LM && LM.G.playing)) ? 0 : rest + 1;
      }
    };
    if (await tap('[data-a="respond:-1"]')) await step("the rival's attack, let through", 120);
    if (await tap('.zh[data-hl="ready"]')) { await page.clock.runFor(600); if (await tap('[data-a^="hit:"]:not([data-a="hit:-1"])') || await tap('[data-a="hit:-1"]')) await step('your attack', 120); }
    if (await tap('[data-a="end"]')) await step("the rival's turn", 900);
    for (const e of errors) fail(where, 'page error: ' + e);
    console.log(where + ': ' + (Object.entries(counts).map(([k, n]) => `${k} ${n} drawings`).join(', ') || 'no move to step'));
    await ctx.close();
  }
  if (beatTicks) console.log(`${beatTicks} drawings of the table checked in the duel's beats`);
  await browser.close();
  console.log(`${scenes} scenes on ${SHAPES.length} screen shapes, ${screens} console screens checked, ${taps} random taps`);
  console.log(fails.length ? `${fails.length} faults` : 'console checks: all pass');
  process.exit(fails.length ? 1 : 0);
})();
