// Checks the console look of the Lost Memories test page against its own rules, on many screen shapes.
//   node tools/crucible/console-checks.cjs <page url> <saves dir> [steps]
//   CC_ONLY=title checks only the title screen, every shape, no random taps (a quick look after a title change).
//   CC_ONLY=beats steps only the duel's beats (a quick look after a change to the table).
//   CC_ONLY=rings steps only the zones' marks through their states (a quick look after a change to the marks).
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
//           plaque there, no two plaques on top of each other, a plinth's name plate never on its card's picture or
//           numbers (a card's foot may stand behind it);
//   names   a name set short on a plinth, the ledge or a pillar (its whole in data-name) is never cut inside a word: it
//           shows whole words of the name, or an initial and a full stop, the last perhaps followed by two dots;
//   grid    every line of words starts on a whole frame pixel, across and down;
//   scroll  a box of pages in a window or a book ends at least 2 pixels above the plaques under it and at most 8 (its
//           window closes up under it), no line of words is cut by its foot or its top, while lines lie below it its
//           more marker shows, a row clear of the box and of the plaques under it as it bobs, and no empty band deeper
//           than a blank line is left above its foot; the same again once it is scrolled, and the frame rows just
//           above and under it are drawn whole (edges, read from a screenshot at a scale above one: a box that scrolls
//           is a layer of its own, whose edge may spill a device row of what it cuts off); it opens at its top and
//           comes back to it when scrolled there; on a book, a slow drag takes it no further than the finger went;
//   hammer  one lit plaque on the screen, and one in each window or scene over it; the lit one shows the hammer; every
//           plaque that can be lit has room for the hammer beside its words, and lighting it moves no plaque; the
//           plaques in a line of words that are not lit hold their words alike; on a book, the same after the mouse
//           has passed over its plaques;
//   room    a book's room shows none of its painting's black bands;
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
//   step    every animation running in the frame moves what it moves on whole frame pixels at every one of its steps
//           (read at the middle of each step, not only where it happens to be when the screen is looked at), and makes
//           a part only none, half or all see-through;
//   table   on the duel's table each tap area is cut to its zone as the table's camera draws it and draws nothing; the
//           numbers lie inside the view, apart and off the trap rows; the hall's painting spans the view to its foot;
//           the numbers keep the one notation the frame gives them (tight or full) whatever cards lie there; each
//           zone's mark lies inside the view and shows on all four sides (where no numbers lie over it), and any two
//           marks in a row leave stone between them (ringFaults); no monster's numbers are held back at rest because a
//           card lies over their place (heldFaults);
//   beats   on the owner's eight screen shapes, a duel's moves are stepped a thirtieth of a second at a time on a stopped
//           clock (a rival's attack let through, your attack on a rival monster, then the rival's whole turn), and on
//           every drawing of the table the numbers lie inside the view, apart, each against its own card as drawn (never
//           left floating), keep one notation, none lies over another card's picture (read from the canvas's own
//           pixels: where a card and a plate meet, the card shows), and no card or piece of a broken card lies over any
//           pixel of them (a number is shown whole or not at all);
//   rings   on the beats' shapes and the two smallest frames, the zones' marks of a few duels in every state (ready,
//           picked, targets in both blink colours, a card aiming), checked as in table;
//   first   the duel table's first drawing that has anything in it, kept the moment the page puts it on the screen, is
//           the finished table, the same to the pixel as once all is settled (until then the hall stands alone): never a
//           bare table drawn before its pictures or its ground are in;
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
  ['tablet', 1024, 768, 2, 0, 0, 1], ['small window', 800, 360, 1], ['tall desktop window', 800, 1000, 1], ['low window', 600, 270, 1],
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
const SCREENS = ['screen:codex', 'screen:codex>cxview:all', 'screen:feats', 'screen:vault', 'new']; // a>b: tap a, then b
// the shapes the owner plays on, for the duel's beats, and the duels stepped on them; the beat- saves (each one move
// set up: your attack lost, a defender broken, both falling, the rival's Spells), when the saves folder has them, are
// stepped on the shapes marked last (1)
const BEAT_SHAPES = [['phone held sideways', 915, 412, 2.625, 1, 1], ['phone held upright', 412, 915, 2.625, 1, 1], ['fold, inner screen', 673, 841, 2.625, 1, 0], ['fold, cover screen sideways', 882, 344, 2.625, 1, 0],
  ['16:9 screen', 1920, 1080, 1, 0, 1], ['tablet', 1024, 768, 2, 1, 0], ['tall desktop window', 800, 1000, 1, 0, 0], ['small window', 800, 360, 1, 0, 1]];
const BEAT_SAVES = ['duel-regular-f1-h0.json', 'duel-boss-f1-trap-prompt-h0.json'], BEAT_MORE = ['beat-lose.json', 'beat-defkill.json', 'beat-both.json', 'beat-spells.json'];
// the duels whose zones' marks are stepped through every state (rings), on the beats' shapes and the two smallest frames
const RING_SAVES = ['rings.json', 'last-move-loss-f1-h5.json', 'duel-boss-f1-trap-prompt-h10.json', 'duel-regular-f1-h0.json'];
const RING_SHAPES = [...BEAT_SHAPES, ['wide desktop', 1024, 480, 2, 0], ['low window', 600, 270, 1, 0]];
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
// card's four corners on the screen (data-cards: its zone key, none for a card shown or arriving, '*' for a piece of a
// broken card) and the canvas's pixels. A plate's own colours are the frame's dark and the five letter colours, cut to 15
// bits as the table cuts them. The plates are drawn before every card and piece, so any pixel of a plate that lies inside
// another card's or a piece's shape (its middle inside, as the table's rasteriser covers a pixel) is covered: a number
// cut, which must never be shown.
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
      else if (n) out.push(`numbers of zone ${s}:${z} are cut: ${c[0] === '*' ? 'a piece of a broken card' : c[0] ? 'the card ' + c[0] : 'a card shown or arriving'} lies over ${n} of their pixels`);
    }
  });
  return { tick: +t.dataset.tick, tight: t.dataset.tight, out };
}
// The zones' marks on the table as drawn while no move plays (in the page): data-rings gives each mark's seat, zone, kind,
// width t and the four corners of the shape it goes round (far left, far right, near right, near left); its pixels are
// those the table gives them (ringPixels in app.mjs): t rows and columns round what the rasteriser covers of that shape.
// Each mark lies inside the view; shows on all four sides, read from the canvas's own pixels in its own colours: along
// each side, the places where its own monster's numbers do not lie over it must mostly show it (those numbers, on the
// side of the mark between the rows, may cover that side as a tab on the frame: your numbers, on one line, are wider than
// a zone on the phone's screen); and any two marks in a row leave at least a pixel of stone between them on every row
// they share: marks that touch or overlap run into one band.
function ringFaults() {
  const t = document.getElementById('tbl'); if (!t || !t.dataset.rings || +t.dataset.tick >= 0) return [];
  const rings = JSON.parse(t.dataset.rings), plates = JSON.parse(t.dataset.plates || '[]'), W = t.width, H = t.height, out = [];
  const px = t.getContext('2d').getImageData(0, 0, W, H).data, cut = c => c.map(v => v & 0xf8).join();
  const COL = { ready: [[219, 164, 89]], picked: [[189, 116, 51], [243, 234, 216]], target: [[150, 64, 52], [240, 138, 114]], onto: [[76, 138, 124], [243, 234, 216]] };
  const mk = ([s, z, kind, w, ax, ay, bx, by, cx, cy, dx, dy]) => {
    const y0 = Math.ceil(ay - .5), y1 = Math.floor(dy - .5), span = y => { const k = (y + .5 - ay) / (dy - ay || 1); return [Math.ceil(ax + (dx - ax) * k - .5), Math.floor(bx + (cx - bx) * k - .5)]; };
    return { s, z, kind, w, y0, y1, span, cols: new Set((COL[kind] || []).map(cut)) };
  };
  const all = rings.map(mk), mine = (r, x, y) => x >= 0 && y >= 0 && x < W && y < H && r.cols.has(cut([...px.slice((y * W + x) * 4, (y * W + x) * 4 + 3)]));
  for (const r of all) {
    const at = `mark of zone ${r.s}:${r.z} (${r.kind})`, own = plates.find(p => p[0] === r.s && p[1] === r.z), tab = r.s ? 'near' : 'far';
    const under = (x, y) => !!own && x >= own[2] && x < own[2] + own[4] && y >= own[3] && y < own[3] + own[5];
    const [lt, rt] = r.span(r.y0 - r.w), [lb, rb] = r.span(r.y1 + r.w);
    if (r.y0 - r.w < 0 || r.y1 + r.w >= H || Math.min(lt, lb) - r.w < 0 || Math.max(rt, rb) + r.w >= W) out.push(`${at} reaches out of the view`);
    // each of its pixels by side (far, near, left, right) and place along that side; a place is free when some pixel of
    // the mark there lies under no numbers, and shows when one of those is in the mark's colours
    const sides = { far: new Map(), near: new Map(), left: new Map(), right: new Map() };
    for (let y = r.y0 - r.w; y <= r.y1 + r.w; y++) { const [l, rr] = r.span(y);
      for (let x = l - r.w; x <= rr + r.w; x++) {
        const side = y < r.y0 ? 'far' : y > r.y1 ? 'near' : x < l ? 'left' : x > rr ? 'right' : null; if (!side || under(x, y)) continue;
        const m = sides[side], k = side === 'far' || side === 'near' ? x : y; m.set(k, (m.get(k) || 0) | (mine(r, x, y) ? 1 : 0) | 2); } }
    for (const [side, m] of Object.entries(sides)) { const free = m.size, shown = [...m.values()].filter(v => v & 1).length;
      if ((!free && side !== tab) || shown < free * .6) out.push(`${at}: its ${side} side shows at ${shown} of the ${free} places its numbers do not lie over`); }
  }
  for (const a of all) for (const b of all) {
    if (a === b || a.s !== b.s || a.span(a.y0)[0] >= b.span(b.y0)[0]) continue;
    let least = Infinity;
    for (let y = Math.max(a.y0, b.y0) - Math.min(a.w, b.w); y <= Math.min(a.y1, b.y1) + Math.min(a.w, b.w); y++) least = Math.min(least, (b.span(y)[0] - b.w) - (a.span(y)[1] + a.w) - 1);
    if (least < 1) out.push(`marks of zones ${a.s}:${a.z} and ${b.s}:${b.z} ${least < 0 ? 'overlap' : 'touch'}: no stone between them`);
  }
  return out;
}
// The table at rest (in the page): no monster's numbers are held back (data-held) because a card lies over their place.
// In a move a number waits for what passes over it; at rest it must show, or it is lost.
function heldFaults() {
  const t = document.getElementById('tbl'); if (!t || !t.dataset.held || +t.dataset.tick >= 0) return [];
  return JSON.parse(t.dataset.held).map(([s, z]) => `numbers of zone ${s}:${z} not shown at rest: another card lies over their place`);
}
const WINDOWS = ['tab:menu', 'tab:help', 'tab:options', 'tab:deck', 'tab:relics', 'tab:doors', 'tab:duel', 'barmore'];
const DEEP = ['chamber-f1.json', 'duel-regular-f1-h0.json']; // the scenes whose windows are also read further and pictured at their edges

(async () => {
  const [url, savesDir, stepsArg] = process.argv.slice(2);
  if (!url || !savesDir) { console.log('usage: console-checks.cjs <page url> <saves dir> [steps]'); process.exit(2); }
  const only = process.env.CC_ONLY === 'title', beatsOnly = process.env.CC_ONLY === 'beats', ringsOnly = process.env.CC_ONLY === 'rings', steps = only ? 0 : +(stepsArg || 40);
  const saves = fs.readdirSync(savesDir).filter(f => /^(chamber|duel|reward|anvil|bazaar|kit|charm|beat)-/.test(f)).sort();
  const pick = [null, ...saves.filter(f => /^chamber-f\d\.json$|^chamber-boss-door-f[13]-h(0|10)\.json$/.test(f)),
    ...saves.filter(f => /^duel-(regular|boss|cursed)-f[123]-h0\.json$|trap-prompt-h5|narrow|fog|lesson/.test(f)).slice(0, 10),
    ...saves.filter(f => /^(reward|anvil|bazaar|kit|charm)-/.test(f))];
  const browser = await chromium.launch();
  const fails = []; let scenes = 0, taps = 0, screens = 0;
  // each fault is also counted by its kind: its words with the numbers and the quoted words taken out
  const kinds = new Map();
  const fail = (where, what) => {
    fails.push(`${where}: ${what}`); if (fails.length < 60) console.log('FAIL', where, what);
    const kind = what.replace(/"[^"]*"/g, '"…"').replace(/\d+(\.\d+)?/g, 'N'); kinds.set(kind, (kinds.get(kind) || 0) + 1);
  };

  for (const [shape, W, H, dpr, full, host, touch] of beatsOnly || ringsOnly ? [] : SHAPES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
    if (host) await ctx.addInitScript(hostScript, HOST_CSS);
    await ctx.addInitScript(firstTable);
    const page = await ctx.newPage();
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('requestfailed', r => { if (!/audio\//.test(r.url())) errors.push('request failed ' + r.url().slice(-60)); });
    // the loading screen (#boot) stays while the console pictures arrive, which takes longer on a busy machine
    const booted = () => page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 20000 }).catch(() => {});
    const load = async save => {
      await page.goto(url);
      await page.evaluate(o => {
        localStorage.clear(); sessionStorage.clear();
        const labs = { five: true, lean: true, heat: true, kits: true, items: true };
        if (o) { o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs || labs)); }
        localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o ? o.labs || labs : labs));
      }, save ? JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')) : null);
      await page.reload(); await page.waitForTimeout(600); await booted();
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
          // a picture starts on a whole frame pixel too (half a pixel off, each of its pixels is drawn soft across two)
          if ((e.tagName === 'IMG' || e.tagName === 'CANVAS') && e.offsetWidth && getComputedStyle(e).visibility !== 'hidden') {
            const q = e.getBoundingClientRect(), x = (up ? q.top - A.top : q.left - A.left) / k, y = (up ? A.right - q.right : q.top - A.top) / k;
            if (Math.abs(x - Math.round(x)) > .05 || Math.abs(y - Math.round(y)) > .05) out.push(`${name(e)}: picture at ${x.toFixed(2)}, ${y.toFixed(2)}, off the frame grid`);
          }
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
        // a card may stand with its foot behind its plinth's name plate, never with its numbers or its picture behind it;
        // what stands on a plinth stands inside its border, centred to within a pixel. The plinth's ring (the first pixel
        // inside its border, gold on the chosen one) shows whole on all four sides: what stands on the plinth, measured
        // with its own outline (a shadow spread round it), and the name plate keep at least one pixel of plinth between
        // them and the ring, at its left, its right, its top and its foot.
        const outline = e => Math.max(0, ...getComputedStyle(e).boxShadow.split(/,(?![^(]*\))/).filter(p => p.trim() !== 'none' && !/inset/.test(p)).map(p => { const v = (p.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat); return (v[3] || 0) + Math.max(Math.abs(v[0] || 0), Math.abs(v[1] || 0)); }));
        for (const pl of app.querySelectorAll('.pln')) {
          for (const e of pl.children) { if (e.classList.contains('pnm') || !vis(e)) continue; const l = e.offsetLeft, r = pl.clientWidth - l - e.offsetWidth; if (l < 0 || r < 0 || Math.abs(l - r) > 1) out.push(`${name(pl)}: ${name(e)} stands ${l} and ${r} pixels inside its border, left and right`); }
          for (const e of pl.children) {
            if (!vis(e)) continue; const o = outline(e), W = pl.clientWidth, H = pl.clientHeight, l = e.offsetLeft - o, t = e.offsetTop - o, r = W - e.offsetLeft - e.offsetWidth - o, b = H - e.offsetTop - e.offsetHeight - o;
            if (Math.min(l, t, r, b) < 2) out.push(`${name(pl)} "${(pl.querySelector('.pnm') || pl).innerText.replace(/\s+/g, ' ').trim()}": ${name(e)}${o ? ` with its ${o}-pixel outline` : ''} leaves ${l}, ${t}, ${r} and ${b} pixels at its left, top, right and foot, so it lies on the plinth's ring or touches it (2 at least)`);
          }
          const nm = pl.querySelector('.pnm'); if (!nm || !vis(nm)) continue;
          const [, ny] = fr(nm);
          for (const e of pl.querySelectorAll('.cd .art, .cd .n1, .cd .n2, .pf')) { const [, y, , h] = fr(e); if (vis(e) && y + h > ny) out.push(`${name(pl)} "${nm.textContent}": its name plate lies on ${name(e)} (${y + h - ny} rows)`); }
        }
        // (a plaque scrolled out of its box is not on the screen, so it overlaps nothing)
        const pqs = [...app.querySelectorAll('.pq')].filter(vis).map(e => [e, e.getBoundingClientRect()]);
        for (let i = 0; i < pqs.length; i++) for (let j = i + 1; j < pqs.length; j++) { const [a, ra] = pqs[i], [b, rb] = pqs[j]; if (a.closest('.mw') !== b.closest('.mw') || scrolledAway(a) || scrolledAway(b)) continue; if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1) out.push(`plaques "${a.textContent}" and "${b.textContent}" overlap`); }
        // grid: each line of words starts on a whole frame pixel, across and down (half a pixel off, a pixel face is drawn
        // soft or a pixel wide in places). Every line is measured where the browser set it, not only a box's first: a
        // range over the words gives one box to each line they take (a name plate's lines, a paragraph's). And a line
        // the browser centres in its box (text-align: center, a box holding only those words) stands in the middle of the
        // room it is centred in to within a pixel.
        const fx = q => up ? (q.top - A.top) / k : (q.left - A.left) / k, fy = q => up ? (A.right - q.right) / k : (q.top - A.top) / k;
        const words = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
        for (let t = words.nextNode(); t; t = words.nextNode()) {
          const el = t.parentElement; if (!t.textContent.trim() || !vis(el) || scrolledAway(el)) continue;
          const rg = document.createRange(), cs = getComputedStyle(el); rg.selectNodeContents(t);
          const mid =cs.textAlign === 'center' && cs.display !== 'inline' && el.childNodes.length === 1, E = el.getBoundingClientRect();
          const c0 = fx(E) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), c1 = fx(E) + el.offsetWidth - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
          [...rg.getClientRects()].filter(q => q.width && q.height).forEach((q, i, all) => {
            const x = fx(q), y = fy(q), w = (up ? q.height : q.width) / k, line = all.length > 1 ? ` (line ${i + 1})` : '';
            if (Math.abs(x - Math.round(x)) > .02 || Math.abs(y - Math.round(y)) > .02) out.push(`${name(el)} "${t.textContent.trim().slice(0, 20)}"${line}: its words start at ${x.toFixed(2)}, ${y.toFixed(2)}, off the frame's pixel grid`);
            else if (mid && w <= c1 - c0 + .5 && Math.abs((x - c0) - (c1 - x - w)) > 1.02) out.push(`${name(el)} "${t.textContent.trim().slice(0, 20)}"${line}: centred with ${(x - c0).toFixed(1)} pixels at its left and ${(c1 - x - w).toFixed(1)} at its right, not in the middle`);
          });
        }
        // scroll: each box of pages in a window or a book shows whole lines, its window closed up under it, and marks more below
        for (const sc of app.querySelectorAll('.mw .sc, .book .sc')) {
          if (!vis(sc)) continue;
          const [sx, sy, sw, sh] = fr(sc), box = sc.closest('.mw, .book'), S = sc.getBoundingClientRect(), h = sc.clientHeight;
          for (const p of box.querySelectorAll('.pq')) { if (sc.contains(p) || !vis(p)) continue; const [px, py, pw] = fr(p); if (px < sx + sw && sx < px + pw && py >= sy && sy + sh > py - 2) out.push(`${name(sc)}: its foot at ${sy + sh} is less than 2 pixels above the plaque "${p.textContent.trim()}" at ${py}`); }
          // the window closes up: the plaques and labels under the box stand at most 8 pixels under its foot, or under
          // whatever else of the window (placed on its own) reaches lower beside it
          const under = [...box.querySelectorAll('.pq, .lb, .ga')].filter(e => !sc.contains(e) && vis(e) && fr(e)[1] >= sy + sh);
          if (under.length) {
            const floor = Math.max(sy + sh, ...[...box.children].filter(e => e !== sc && vis(e) && !/\b(scm|scl)\b/.test(e.className) && getComputedStyle(e).position === 'absolute' && fr(e)[1] < sy + sh).map(e => fr(e)[1] + fr(e)[3]));
            const gap = Math.min(...under.map(e => fr(e)[1])) - floor, first = under.find(e => fr(e)[1] - floor === gap);
            if (gap > 8.5) out.push(`${name(sc)}: ${gap} pixels of empty window between it and "${first.textContent.trim().slice(0, 20)}" under it (8 at most: the window closes up under its box)`);
          }
          // each line in the box's own pixels: the line of its block that the middle of its glyphs' box falls in (a block's
          // lines are its line height apart from the top of its content; words in the label face sit low in a line of the
          // text face, and are still that line)
          let below = 0, low = 0;
          const inBox = R => { const a = (up ? S.right - R.right : R.top - S.top) / k - sc.clientTop; return [a, a + (up ? R.width : R.height) / k]; };
          const tw = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT);
          for (let t = tw.nextNode(); t; t = tw.nextNode()) {
            if (!t.textContent.trim() || !t.parentElement.offsetHeight) continue;
            let b = t.parentElement; while (b !== sc && getComputedStyle(b).display === 'inline') b = b.parentElement;
            const bs = getComputedStyle(b), lh = parseFloat(bs.lineHeight) || 16, rg = document.createRange(); rg.selectNodeContents(t);
            const top = b === sc ? (parseFloat(bs.paddingTop) || 0) - sc.scrollTop : inBox(b.getBoundingClientRect())[0] + (parseFloat(bs.borderTopWidth) || 0) + (parseFloat(bs.paddingTop) || 0);
            for (const q of rg.getClientRects()) {
              if (!q.width || !q.height) continue;
              const [qa, qz] = inBox(q), mid = (qa + qz) / 2, a = top + Math.round((mid - top - lh / 2) / lh) * lh, z = a + lh;
              if (a < h - 1 && z > h + 1 && a > -1) out.push(`${name(sc)}: the line "${t.textContent.trim().slice(0, 24)}" is cut by its foot (${a.toFixed(1)} to ${z.toFixed(1)} in ${h})`);
              if (a < -1 && z > 1 && z < h + 1) out.push(`${name(sc)}: the line "${t.textContent.trim().slice(0, 24)}" is cut by its top (${a.toFixed(1)} to ${z.toFixed(1)})`);
              if (a >= h - 1) below++; else if (a >= -1 && z <= h + 1) low = Math.max(low, z);
            }
          }
          for (const e of sc.querySelectorAll('img, canvas, button, .cd, .coin, .ga, .big')) {
            if (!vis(e)) continue; const [a, z] = inBox(e.getBoundingClientRect());
            if (a >= -1 && z <= h + 1) low = Math.max(low, z);
            else if (!e.closest('button.lab') && !e.classList.contains('lab') && a < h - 1 && z > 1) out.push(`${name(e)}: cut by the ${a < -1 ? 'top' : 'foot'} of its box of pages (${a.toFixed(1)} to ${z.toFixed(1)} in ${h})`); // a switch may be cut between its lines
          }
          // while more lies below, no empty band deeper than a blank line above the foot (a box cut short of a row it could show)
          if (below && h - low > 16.5) out.push(`${name(sc)}: an empty band ${Math.round(h - low)} pixels deep above its foot, while ${below} lines lie below`);
          const mk = sc.nextElementSibling && sc.nextElementSibling.classList.contains('scm') ? sc.nextElementSibling : null;
          if (below && (!mk || mk.hidden || !vis(mk))) out.push(`${name(sc)}: ${below} lines lie below it, with no more marker`);
          // the marker (4 rows, bobbing 2 down) keeps a row clear of the box over it and of any plaque under it
          if (mk && !mk.hidden && vis(mk)) {
            const [mx, my, mw] = fr(mk), lowest = my + mk.offsetHeight + 2;
            if (my < sy + sh + 1) out.push(`${name(sc)}: its more marker at ${my} touches the box's foot at ${sy + sh}`);
            for (const p of box.querySelectorAll('.pq, .lb')) { if (sc.contains(p) || !vis(p)) continue; const [px, py, pw] = fr(p); if (px < mx + mw && mx < px + pw && py >= my && py < lowest + 1) out.push(`${name(sc)}: its more marker reaches row ${lowest - 1} as it bobs, touching "${p.textContent.trim().slice(0, 20)}" at ${py}`); }
          }
          // a row of plaques in the pages keeps 4 pixels under the words over it
          for (const row of sc.querySelectorAll('.row2')) {
            if (!row.querySelector('.pq') || !row.offsetHeight) continue;
            let p = row.previousElementSibling; while (p && !p.offsetHeight) p = p.previousElementSibling;
            const gap = p && p.textContent.trim() ? row.offsetTop - (p.offsetTop + p.offsetHeight) : 99;
            if (gap < 4) out.push(`${name(sc)}: its plaques "${row.textContent.trim().slice(0, 20)}" stand ${gap} pixels under the words over them (4 at least)`);
          }
        }
        // hammer: one lit plaque in each layer (the screen, and each window or scene over it)
        for (const L of [app, ...app.querySelectorAll('.mw, .story')]) {
          const lit = [...L.querySelectorAll('.pq.lit')].filter(e => vis(e) && (L === app ? !e.closest('.mw, .story') : e.closest('.mw, .story') === L));
          if (lit.length > 1) out.push(`${lit.length} plaques lit in ${L === app ? 'the screen' : name(L)} (${lit.map(e => e.textContent.trim().slice(0, 14)).join(', ')}): only the one the hammer is on may be`);
          // the choice is always shown the same way: the lit plaque shows the hammer at its left; each plaque that can be lit
          // has room for it beside its words, and lighting it moves no plaque; the plaques in a line of words (.in) that are
          // not lit hold their words alike (the same room at their left and at their right)
          const live = [...L.querySelectorAll('.pq')].filter(e => vis(e) && !e.disabled && !scrolledAway(e) && (L === app ? !e.closest('.mw, .story') : e.closest('.mw, .story') === L));
          for (const b of live) {
            if (b.classList.contains('lit') && getComputedStyle(b, '::before').display === 'none') out.push(`${name(b)} "${b.textContent.trim()}": lit without the hammer`);
            const was = [b.classList.contains('lit'), b.classList.contains('nh')], r0 = b.getBoundingClientRect();
            b.classList.add('lit'); b.classList.remove('nh');
            const cut = b.scrollWidth > b.clientWidth + 1, room = `${b.scrollWidth} in ${b.clientWidth}`, r1 = b.getBoundingClientRect();
            b.classList.toggle('lit', was[0]); b.classList.toggle('nh', was[1]);
            if (cut) out.push(`${name(b)} "${b.textContent.trim()}": too narrow for the hammer beside its words (${room} pixels)`);
            else if (['left', 'top', 'width', 'height'].some(p => Math.abs(r1[p] - r0[p]) > .01)) out.push(`${name(b)} "${b.textContent.trim()}": lighting it moves or sizes it`);
          }
          const held = [...L.querySelectorAll('.pq.in:not(.lit)')].filter(e => vis(e) && !scrolledAway(e) && (L === app ? !e.closest('.mw, .story') : e.closest('.mw, .story') === L)).map(e => { const rg = document.createRange(); rg.selectNodeContents(e); const q = rg.getBoundingClientRect(), r = e.getBoundingClientRect(); return [e, Math.round(fx(q) - fx(r)), Math.round(up ? (r.bottom - q.bottom) / k : (r.right - q.right) / k)]; });
          const odd = held.find(([, a, z]) => a !== held[0][1] || z !== held[0][2]);
          if (odd) out.push(`the plaques in lines of words hold their words unalike: "${held[0][0].textContent.trim()}" with ${held[0][1]} and ${held[0][2]} pixels at its left and right, "${odd[0].textContent.trim()}" with ${odd[1]} and ${odd[2]}`);
        }
        // offered: on the Anvil every working the run's offer holds (read from the run the page stored) has its plaque on
        // the ledge, inside it and on no other plaque, so no choice the rules give is left out when the ledge is crowded
        let run = null; try { run = JSON.parse(localStorage.getItem('lostmemories.run.v1')); } catch { run = null; }
        const ledgeEl = app.querySelector('.fr > .ledge');
        if (app.dataset.phase === 'anvil' && run && run.phase === 'anvil' && run.offer && run.offer.kind === 'anvil' && ledgeEl) {
          const want = [...(run.offer.masterworks || []).map(id => 'mw:' + id), 'temper', ...(run.offer.enchants || []).map(x => 'enchant:' + x), 'bind'];
          const L = ledgeEl.getBoundingClientRect();
          for (const a of want) {
            const b = ledgeEl.querySelector(`.pq[data-a="${a}"]`);
            if (!b || !vis(b)) { out.push(`the Anvil offers the working ${a}, but the ledge shows no plaque for it`); continue; }
            const q = b.getBoundingClientRect(); if (q.left < L.left - .5 || q.right > L.right + .5 || q.top < L.top - .5 || q.bottom > L.bottom + .5) out.push(`${name(b)} "${b.textContent.trim()}": the working's plaque reaches out of the ledge`);
          }
        }
        // marker: the text bar's more marker lies on none of its letters (it has its own room at the lines' end)
        const barEl = app.querySelector('.fr > .bar.more'), barP = barEl && barEl.firstElementChild;
        if (barP) {
          const m = getComputedStyle(barEl, '::after'), B = barEl.getBoundingClientRect(), bl = parseFloat(getComputedStyle(barEl).borderLeftWidth) || 0, bt = parseFloat(getComputedStyle(barEl).borderTopWidth) || 0;
          const mw = parseFloat(m.width), mh = parseFloat(m.height), mx = barEl.clientWidth - parseFloat(m.right) - mw, my = barEl.clientHeight - parseFloat(m.bottom) - mh; // in frame pixels, from the bar's padding box
          const shown = barP.offsetTop + barP.clientHeight, words = document.createTreeWalker(barP, NodeFilter.SHOW_TEXT);
          for (let t = words.nextNode(); t; t = words.nextNode()) {
            const rg = document.createRange(); rg.selectNodeContents(t);
            for (const q of rg.getClientRects()) {
              const x0 = fx(q) - fx(B) - bl, w = (up ? q.height : q.width) / k, y0 = fy(q) - fy(B) - bt, h = (up ? q.width : q.height) / k;
              if (y0 >= shown - .5) continue;
              if (x0 < mx + mw && mx < x0 + w - 1 && y0 < my + mh + 2 && my < y0 + h) { out.push(`the text bar's more marker (${mx} to ${mx + mw}) lies on its words "${t.textContent.trim().slice(-14)}" (to ${(x0 + w - 1).toFixed(0)})`); break; }
            }
          }
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
        // step: an animation moves a part on whole frame pixels at every step of it, not only at the moment the screen is
        // looked at. Each animation running in the frame is stopped at the middle of each of its steps in turn (a stepped
        // timing runs its steps in each stretch between two keyframes; a smooth one is read at eight points of each), what
        // it moves is read there (a shift, a picture's place in its box, a place, how see-through it is), and it is then
        // set going again where it was.
        const pxs = v => (String(v).match(/-?[\d.]+px/g) || []).map(parseFloat), whole = v => Math.abs(v - Math.round(v)) < .01;
        for (const a of document.getAnimations()) {
          const ef = a.effect, el = ef && ef.target;
          if (!el || !app.contains(el) || a.playState !== 'running' || !ef.getKeyframes) continue;
          const kf = ef.getKeyframes(), tm = ef.getComputedTiming(), d = +tm.duration, delay = +tm.delay || 0;
          if (!(d > 0) || !kf.length) continue;
          const props = new Set(kf.flatMap(f => Object.keys(f)).filter(p => !['offset', 'computedOffset', 'easing', 'composite'].includes(p)));
          const offs = [...new Set([0, ...kf.map(f => f.computedOffset), 1])].sort((x, y) => x - y), at = [];
          for (let i = 0; i < offs.length - 1; i++) {
            const k0 = kf.find(f => Math.abs(f.computedOffset - offs[i]) < 1e-6), ease = (k0 && k0.easing) || ef.getTiming().easing || 'linear';
            const m = /steps\((\d+)/.exec(ease), n = m ? +m[1] : 8;
            for (let j = 0; j < n; j++) at.push(offs[i] + (j + .5) / n * (offs[i + 1] - offs[i]));
          }
          const was = a.currentTime, pseudo = ef.pseudoElement || null, where = name(el) + (pseudo || '') + ` (${a.animationName || 'animation'})`;
          a.pause();
          for (const p of at) {
            a.currentTime = delay + p * d;
            const s = getComputedStyle(el, pseudo), bad = [];
            if (props.has('transform') && s.transform !== 'none') { const t = new DOMMatrix(s.transform); if (!whole(t.e) || !whole(t.f)) bad.push(`shifted ${+t.e.toFixed(2)}, ${+t.f.toFixed(2)}`); }
            if ([...props].some(q => /^background(Position)?/.test(q))) { const v = pxs(s.backgroundPosition); if (v.some(x => !whole(x))) bad.push(`its picture at ${s.backgroundPosition}`); }
            for (const q of ['left', 'top', 'right', 'bottom', 'marginLeft', 'marginTop']) if (props.has(q) && pxs(s[q]).some(x => !whole(x))) bad.push(`${q} ${s[q]}`);
            if (props.has('opacity') && !okOpacity(s.opacity)) bad.push(`opacity ${s.opacity}`);
            if (bad.length) { out.push(`${where}: at ${Math.round(p * 100)}% of its turn ${bad.join(', ')}: off the frame's whole pixels`); break; }
          }
          a.currentTime = was; a.play();
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
        // room: a book's room shows none of its painting's black bands (a row of the frame with no pixel brighter than the
        // bands' dark dither across the whole of the painting shown in it, read from the picture's own pixels)
        const room = app.querySelector('.book') && app.querySelector('.ti > img.bg');
        if (room && room.complete && room.naturalWidth) {
          const pw = room.naturalWidth, ph = room.naturalHeight, c = document.createElement('canvas'); c.width = pw; c.height = ph;
          const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(room, 0, 0); const px = g.getImageData(0, 0, pw, ph).data;
          const s = room.offsetHeight / ph, x0 = Math.max(0, Math.floor(-room.offsetLeft / s)), x1 = Math.min(pw, Math.ceil((app.offsetWidth - room.offsetLeft) / s));
          let black = 0;
          for (let y = 0; y < app.offsetHeight; y++) {
            const py = Math.floor((y - room.offsetTop) / s); if (py < 0 || py >= ph) { black++; continue; }
            let lit = 0; for (let x = x0; x < x1 && !lit; x++) { const i = (py * pw + x) * 4; if (px[i] + px[i + 1] + px[i + 2] > 96) lit++; }
            if (!lit) black++;
          }
          if (black) out.push(`the book's room shows ${black} rows of the frame black across the painting (its bands, or no painting there)`);
        }
        // the card pictures: cut to console colour once the sheets are converted
        const unconverted = [...app.querySelectorAll('.cd .art, .big .art')].filter(e => e.style.backgroundImage && !/blob:/.test(e.style.backgroundImage)).length;
        if (unconverted) out.push(`${unconverted} card pictures still the full-colour sheet`);
        return { ps: true, out: [...new Set(out)], sig: app.dataset.phase + '|' + [...app.querySelectorAll('[data-a]')].map(e => e.dataset.a).join(',').slice(0, 400) };
      }, !!touch);
      if (r.ps) { screens++; for (const o of r.out) fail(where, o); for (const o of [...await page.evaluate(ringFaults), ...await page.evaluate(heldFaults)]) fail(where, o); }
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
    // edges: the frame rows just above and under each box of pages in a window or a book, read from a screenshot at a scale
    // above one, are each frame pixel one flat block of device pixels. A box that scrolls is drawn as a layer of its own,
    // and at some scales its edge lands a fraction of a device pixel outside the box: a device row of what it cuts off shows.
    // At every scale, the gold line of the box's window is whole on those rows (nothing laid along the box's edges may
    // cover the window's frame).
    const edges = async where => {
      const g = await page.evaluate(() => {
        const a = document.getElementById('app'); if (!a.classList.contains('ps')) return null;
        const r = a.getBoundingClientRect(), m = new DOMMatrix(getComputedStyle(a).transform), d = devicePixelRatio, k = Math.hypot(m.a, m.b), up = Math.abs(m.b) > Math.abs(m.a), rows = [], gold = [];
        const box = e => { const S = e.getBoundingClientRect(); return [Math.round(up ? (S.top - r.top) / k : (S.left - r.left) / k), Math.round(up ? (r.right - S.right) / k : (S.top - r.top) / k), Math.round((up ? S.height : S.width) / k), Math.round((up ? S.width : S.height) / k)]; };
        for (const sc of a.querySelectorAll('.mw .sc, .book .sc')) {
          const S = sc.getBoundingClientRect(); if (!S.width || !S.height) continue;
          const [x, y, w, h] = box(sc);
          rows.push([x, y - 1, w], [x, y + h, w]);
          const wn = sc.closest('.wn'); if (!wn || !/inset/.test(getComputedStyle(wn).boxShadow)) continue;
          const [wx, wy, ww, wh] = box(wn);
          for (const fy of [y - 1, y + h]) if (fy >= wy + 2 && fy <= wy + wh - 3) gold.push([wx + 1, fy], [wx + ww - 2, fy]);
        }
        return rows.length ? { rows, gold, n: Math.round(k * d), up, x: Math.round(r.left * d), y: Math.round(r.top * d), w: Math.round(r.width * d) } : null;
      });
      if (!g) return;
      const png = (await page.screenshot()).toString('base64');
      const [bad, broken] = await page.evaluate(async ([png, g]) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
        const at = (fx, fy) => { const bx = g.up ? g.x + g.w - (fy + 1) * g.n : g.x + fx * g.n, by = g.up ? g.y + fx * g.n : g.y + fy * g.n; return bx < 0 || by < 0 || bx + g.n > c.width || by + g.n > c.height ? -1 : (by * c.width + bx) * 4; };
        let bad = 0, broken = 0;
        if (g.n >= 2) for (const [fx0, fy, w] of g.rows) for (let fx = fx0; fx < fx0 + w; fx++) {
          const i0 = at(fx, fy); if (i0 < 0) continue; let worst = 0;
          for (let yy = 0; yy < g.n && !(worst > 3); yy++) for (let xx = 0; xx < g.n; xx++) { const i = i0 + (yy * c.width + xx) * 4; worst = Math.max(worst, Math.abs(d[i] - d[i0]), Math.abs(d[i + 1] - d[i0 + 1]), Math.abs(d[i + 2] - d[i0 + 2])); }
          if (worst > 3) bad++;
        }
        // the window's gold line (#dba459) at the box's edge rows
        for (const [fx, fy] of g.gold) { const i = at(fx, fy); if (i >= 0 && (Math.abs(d[i] - 219) > 3 || Math.abs(d[i + 1] - 164) > 3 || Math.abs(d[i + 2] - 89) > 3)) broken++; }
        return [bad, broken];
      }, [png, g]);
      if (bad) fail(where, `${bad} frame pixels along the edges of its boxes of pages are not one flat block of device pixels (the box spills what it cuts off)`);
      if (broken) fail(where, `the gold line of a window is broken in ${broken} places beside the edges of its box of pages`);
    };
    // a box of pages read further: each one that holds more than it shows is scrolled half its height, and checked again once
    // it has come to rest
    // Before that, each box must stand at its top (a box opened part-way down hides its first lines wholly above it, so no
    // line is cut and the scroll rule above cannot see them); after it, each is scrolled back to the top and must come to
    // rest there. On a book, a slow drag follows: 3 pixels every 200 ms, 6 times, and the box must come to rest no further
    // from where it stood than those 18 pixels and half the step between its two rests about them (a box that ran away from
    // the finger went a whole rest on at every pause).
    const boxes = () => page.evaluate(() => [...document.querySelectorAll('#app.ps .mw .sc, #app.ps .book .sc')].filter(sc => sc.offsetHeight).map(sc => Math.round(sc.scrollTop)));
    const scrolled = async (where, drag = false) => {
      for (const [i, st] of (await boxes()).entries()) if (st) fail(where, `box of pages ${i + 1} opens ${st} pixels down from its top: its first lines cannot be seen`);
      const moved = await page.evaluate(() => { let n = 0; for (const sc of document.querySelectorAll('#app.ps .mw .sc, #app.ps .book .sc')) if (sc.scrollHeight > sc.clientHeight + 1) { sc.scrollTop += Math.max(16, sc.clientHeight >> 1); n++; } return n; });
      if (!moved) return;
      await page.waitForTimeout(400); await audit(`${where} > scrolled`); await edges(`${where} > scrolled`);
      await page.evaluate(() => { for (const sc of document.querySelectorAll('#app.ps .mw .sc, #app.ps .book .sc')) sc.scrollTop = 0; }); await page.waitForTimeout(400);
      for (const [i, st] of (await boxes()).entries()) if (st) fail(`${where} > scrolled back`, `box of pages ${i + 1} comes to rest ${st} pixels down when scrolled to its top`);
      if (!drag) return;
      const far = await page.evaluate(async () => {
        const sc = [...document.querySelectorAll('#app.ps .book .sc')].find(s => s.scrollHeight > s.clientHeight + 1); if (!sc) return null;
        const t0 = sc.scrollTop; for (let i = 0; i < 6; i++) { sc.scrollTop += 3; await new Promise(ok => setTimeout(ok, 200)); }
        await new Promise(ok => setTimeout(ok, 400));
        const R = sc._plan && sc._plan.R, to = t0 + 18, nx = R ? R.find(s => s > to) : null, pv = R ? [...R].reverse().find(s => s <= to) : null, gap = nx != null && pv != null ? nx - pv : 64;
        return { at: sc.scrollTop, most: to + gap / 2, t0 };
      });
      if (far && far.at > far.most + .5) fail(`${where} > slow drag`, `a slow drag of 18 pixels from ${far.t0} took the box to ${far.at}, further than the finger went (${far.most} at most)`);
    };
    // the hammer follows the mouse and stays where it was left: the mouse passes over a few plaques and off the frame
    const mousePass = async where => {
      for (const p of (await page.locator('#app .pq:not([disabled])').all()).slice(0, 3)) await p.hover({ force: true, timeout: 1000 }).catch(() => {});
      await page.mouse.move(1, 1); await page.waitForTimeout(150); await audit(`${where} > mouse pass`);
    };
    for (const save of only ? [null] : full ? pick : SHORT.filter(x => !x || saves.includes(x))) {
      const base = `${shape} ${W}x${H}@${dpr} ${save || 'title'}`;
      await load(save); await page.waitForTimeout(500); scenes++;
      await audit(base); await edges(base); // a window open over the scene (the trap prompt, a duel's end) has its edges read too
      if (save) { const d = await page.evaluate(tableFirst); if (d) fail(base, d); }
      if (!save) await flat(base);
      // every window that can open over this screen (over the title, a chamber and a duel, read further too)
      const deep = !save || DEEP.includes(save);
      for (const a of WINDOWS) {
        const l = page.locator(`[data-a="${a}"]`).first();
        if (!(await l.count()) || await l.isDisabled().catch(() => true)) continue;
        await l.click({ force: true }).catch(() => {}); await page.waitForTimeout(250);
        await audit(`${base} > ${a}`);
        if (deep) { await edges(`${base} > ${a}`); await scrolled(`${base} > ${a}`); }
        const c = page.locator('.mw [data-a="tab:"], .mw [data-a="closeov"], .mw [data-a="closeinspect"]').first();
        if (await c.count()) await c.click({ force: true }).catch(() => {}); else await load(save);
        await page.waitForTimeout(200);
      }
      // a card page: tap a card in the hand when nothing can be played, or a table card
      const hc = page.locator('[data-a^="inspect"]').first();
      if (await hc.count()) { await hc.click({ force: true }).catch(() => {}); await page.waitForTimeout(300); await audit(`${base} > card page`); await load(save); }
      // the books and the Forger screen, from the title
      if (!save) for (const a of SCREENS) {
        await load(null); for (const s of a.split('>')) { await page.locator(`[data-a="${s}"]`).first().click({ force: true }).catch(() => {}); await page.waitForTimeout(500); }
        await audit(`${base} > ${a}`); await edges(`${base} > ${a}`); await scrolled(`${base} > ${a}`, true);
        if (!touch) await mousePass(`${base} > ${a}`);
      }
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
  for (const [W, H, dpr, touch] of beatsOnly || ringsOnly ? [] : [[915, 412, 2.625, 1], [1280, 720, 1, 0], [412, 915, 2.625, 1]]) {
    const shots = [];
    for (const host of [0, 1]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
      if (host) await ctx.addInitScript(hostScript, HOST_CSS);
      const page = await ctx.newPage(), got = [];
      for (const save of only ? [''] : SAME) {
        if (save && !saves.includes(save)) continue;
        await page.goto(url);
        await page.evaluate(o => { localStorage.clear(); sessionStorage.clear(); const labs = { five: true, lean: true, heat: true, kits: true, items: true }; if (o) { o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs || labs)); } localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o ? o.labs || labs : labs)); }, save ? JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')) : null);
        await page.reload(); await page.waitForTimeout(600); await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 20000 }).catch(() => {});
        if (save) { await page.locator('[data-a="resume"]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(900); }
        await page.waitForFunction(() => [...document.fonts].filter(f => /LM Text/.test(f.family)).length > 1, null, { timeout: 5000 }).catch(() => {}); // the body face struck on whole pixels (pxtext.mjs) is in
        // a screen is drawn again when a carved word it asked for is ready, with its crest and its animations new: wait
        // until nothing has been drawn again for 400 ms (5 s at most) before the animations are stopped
        await page.evaluate(() => new Promise(ok => { const done = () => { mo.disconnect(); ok(); }; let t = setTimeout(done, 400); const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 400); }); mo.observe(document.getElementById('app'), { childList: true }); setTimeout(done, 5000); }));
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
  // A finger's slow drags on the books' boxes, as a touch screen sends them (held sideways and upright): two drags the
  // same way of less than half a step, then one back, then a long one and a short one back. Once the finger is lifted and
  // the box has stopped, it must rest at the stop nearest to where the finger left the pages, never one an earlier
  // drag's leftover carried it to.
  for (const [W, H, dpr] of beatsOnly ? [] : [[915, 412, 2.625], [412, 915, 2.625]]) for (const book of ['screen:feats', 'screen:vault', 'screen:codex']) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(), where = `${W}x${H}@${dpr} ${book.slice(7)} drags`;
    await page.goto(url);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('lostmemories.labs.v5', JSON.stringify({ five: true, lean: true, heat: true, kits: true, items: true })); });
    await page.reload(); await page.waitForTimeout(600); await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(a => { const e = document.createElement('button'); e.dataset.a = a; document.getElementById('app').appendChild(e); e.click(); }, book); await page.waitForTimeout(900);
    const info = await page.evaluate(() => { const sc = [...document.querySelectorAll('#app .mw .sc, #app .book .sc')].pop(); if (!sc || !sc._plan || sc._plan.R.length < 3) return null; const r = sc.getBoundingClientRect(), a = document.getElementById('app'); return { c: [r.left + r.width / 2, r.top + r.height / 2], k: a.getBoundingClientRect().width / a.offsetWidth, R: sc._plan.R, up: a.style.transform.includes('rotate') }; });
    if (!info) { await ctx.close(); continue; }
    const cdp = await ctx.newCDPSession(page), top = () => page.evaluate(() => [...document.querySelectorAll('#app .mw .sc, #app .book .sc')].pop().scrollTop);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const step = 16; // a line of the text face
    // a finger moving f lines (more than the browser's slop, so the pages move by about a part of a step), slowly
    for (const [f, label] of [[0.4, 'down'], [0.4, 'down again'], [-0.4, 'back up'], [1.6, 'down further'], [-0.3, 'back a little']]) {
      const dy = (f * step + (f > 0 ? 12 : -12)) * info.k, n = 24; let [x, y] = info.c;
      if (info.up) x -= dy / 2; else y += dy / 2;
      await touch('touchStart', x, y);
      for (let i = 0; i < n; i++) { if (info.up) x += dy / n; else y -= dy / n; await touch('touchMove', x, y); await page.waitForTimeout(30); }
      await page.waitForTimeout(120); const lift = await top();
      await touch('touchEnd', x, y); await page.waitForTimeout(900);
      const rest = await top(), near = info.R.reduce((b, s) => Math.abs(s - lift) < Math.abs(b - lift) ? s : b, info.R[0]);
      if (Math.abs(rest - near) > .5 && Math.abs(Math.abs(rest - lift) - Math.abs(near - lift)) > .5) fail(where, `a slow drag ${label} left the pages at ${Math.round(lift)}, but the box came to rest at ${Math.round(rest)}, not at the nearest stop ${near}`);
    }
    await ctx.close();
  }
  // beats: a rival's attack waiting on your answer let through, your attack on a rival monster, then the rival's whole
  // turn, stepped a thirtieth of a second at a time on a stopped clock, the table checked at every drawing (tableNow)
  let beatTicks = 0;
  if (!only && !ringsOnly) for (const [shape, W, H, dpr, touch, more] of BEAT_SHAPES) for (const save of more ? [...BEAT_SAVES, ...BEAT_MORE] : BEAT_SAVES) {
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
  // rings: the zones' marks in every state a duel shows them (ringFaults): your attackers ready; each of your monsters
  // picked in turn (an attacker with the rival's monsters it can strike marked as targets, seen in both of their blinking
  // colours; a monster in defense picked to change its position); a hand card that aims picked with each zone it may aim
  // at, and then aimed at its first. A rival's attack waiting on your answer is let through first.
  let ringLooks = 0;
  if (!only && !beatsOnly) for (const [shape, W, H, dpr, touch] of RING_SHAPES) for (const save of RING_SAVES) {
    if (!fs.existsSync(path.join(savesDir, save))) continue;
    const where = `${shape} ${W}x${H}@${dpr} ${save} rings`, said = new Set();
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: !!touch, isMobile: !!touch });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(o => { localStorage.clear(); sessionStorage.clear(); o.profile.runs = 7; localStorage.setItem('lostmemories.profile.v1', JSON.stringify(o.profile)); localStorage.setItem('lostmemories.run.v1', JSON.stringify(o.run)); localStorage.setItem('lostmemories.runlabs.v1', JSON.stringify(o.labs)); localStorage.setItem('lostmemories.labs.v5', JSON.stringify(o.labs)); }, JSON.parse(fs.readFileSync(path.join(savesDir, save), 'utf8')));
    await page.reload(); await page.waitForTimeout(1500);
    await page.locator('[data-a="resume"]').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(1500);
    const tap = async sel => { const l = page.locator(sel).first(); if (!(await l.count())) return false; await l.click({ force: true, timeout: 3000 }).catch(() => {}); await page.waitForTimeout(250); return true; };
    const settle = () => page.waitForFunction(() => !(window.LM && LM.G.playing) && document.querySelector('[data-a="end"], [data-a="respond:-1"]'), null, { timeout: 20000 }).catch(() => {}); // until it is your turn again, or another attack waits on your answer
    const seen = []; const look = async state => { seen.push(state); for (const blink of [0, 1]) { if (blink) await page.waitForTimeout(420); ringLooks++;
      for (const o of [...await page.evaluate(ringFaults), ...await page.evaluate(heldFaults)]) if (!said.has(o)) { said.add(o); fail(`${where}, ${state}`, o); } } };
    for (let i = 0; i < 6 && await tap('[data-a="respond:-1"]'); i++) await settle();
    await look('ready');
    const zones = await page.locator('.zh[data-a^="mine:"]').evaluateAll(es => es.map(e => e.dataset.a));
    for (const a of zones) { await tap(`[data-a="${a}"]`); await look(`${a} picked`); await tap('[data-a="undo"]'); }
    const hand = await page.locator('[data-a^="hand:"]').evaluateAll(es => es.map(e => e.dataset.a));
    let aimed = 0;
    for (const a of hand) { if (aimed >= 2) break; await tap(`[data-a="${a}"]`);
      if (await page.locator('.zh[data-a^="aim:"]').count()) { aimed++; await look(`${a} aiming`); await tap('.zh[data-a^="aim:"]'); await look(`${a} aimed`); }
      await tap('[data-a="undo"]'); }
    for (const e of errors) fail(where, 'page error: ' + e);
    console.log(`${where}: ${seen.join(', ')}`);
    await ctx.close();
  }
  if (ringLooks) console.log(`${ringLooks} drawings of the table's marks checked`);
  await browser.close();
  if (fails.length) { console.log('faults by kind, most first:'); for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${String(n).padStart(6)}  ${k.slice(0, 220)}`); }
  console.log(`${scenes} scenes on ${SHAPES.length} screen shapes, ${screens} console screens checked, ${taps} random taps`);
  console.log(fails.length ? `${fails.length} faults` : 'console checks: all pass');
  process.exit(fails.length ? 1 : 0);
})();
