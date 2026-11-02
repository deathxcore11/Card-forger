// Controller support for the Android app (the "console edition"): the handheld's own buttons (Retroid
// Pocket, AYN Odin/Thor, Anbernic) or any Bluetooth/USB pad, through CardStashyGamepad.java. One scheme for
// every screen, so nothing has to be relearned between the app, a Magic match and Planeswalk:
//   d-pad / left stick  move the gold focus ring        A  press it          B  back / cancel
//   right stick          free cursor (A or RT clicks)    X  main action (Pass, Next, End turn; Search in the app)
//   LB / RB              tabs, or the next part of the screen (hand, board, buttons)
//   LT / RT              page up / down                  Y  look closer at the focused card (its hold menu)
//   Start                settings, or the game's menu    Select  decks (in a game: your deck)
// Touch keeps working the whole time; a tap moves the focus to what was tapped and never turns the
// controller off. Button glyphs show only while a controller is connected.
const GLYPH = { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', START: '', SELECT: '' };
const DIRS = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
const FOCUSABLE = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=option],[role=menuitem],[role=checkbox],[role=radio],[role=switch],[tabindex]:not([tabindex="-1"]),[data-act],[data-hold]';
const CARDS = '.card,.unit,.node,.play-match-card,[data-instance],[data-hold]';
const TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),textarea,select,[contenteditable=""],[contenteditable=true]';

const CSS = `
#pad-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483600;contain:strict}
#pad-layer[hidden]{display:none}
.pad-ring{position:absolute;left:0;top:0;border-radius:12px;opacity:0;transition:opacity .14s ease,transform .09s cubic-bezier(.2,.8,.2,1),width .09s,height .09s;
 box-shadow:0 0 0 2px #f6d68a,0 0 0 4px rgba(20,14,6,.55),0 0 18px 2px rgba(246,214,138,.55),inset 0 0 12px rgba(246,214,138,.28)}
.pad-ring.on{opacity:1}
.pad-ring::after{content:'';position:absolute;inset:-2px;border-radius:inherit;background:linear-gradient(115deg,transparent 35%,rgba(255,244,214,.55) 50%,transparent 65%) no-repeat;background-size:250% 100%;
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;padding:2px;animation:pad-sheen 2.6s ease-in-out infinite}
@keyframes pad-sheen{0%{background-position:150% 0}60%,100%{background-position:-60% 0}}
@media (prefers-reduced-motion:reduce){.pad-ring{transition:opacity .14s}.pad-ring::after{animation:none}}
.pad-cursor{position:absolute;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;opacity:0;transition:opacity .18s,width .12s,height .12s,margin .12s;
 background:radial-gradient(circle,#fff 0 3px,rgba(255,255,255,.0) 3.5px);box-shadow:0 0 0 2px rgba(255,248,230,.95),0 0 0 4px rgba(18,12,4,.5),0 0 14px rgba(246,214,138,.7)}
.pad-cursor.on{opacity:1}
.pad-cursor.over{width:30px;height:30px;margin:-15px 0 0 -15px;box-shadow:0 0 0 2px #f6d68a,0 0 0 4px rgba(18,12,4,.5),0 0 18px rgba(246,214,138,.85)}
.pad-cursor.press{width:16px;height:16px;margin:-8px 0 0 -8px}
.pad-g{position:absolute;left:0;top:0;display:grid;place-items:center;box-sizing:border-box;min-width:24px;height:24px;padding:0 6px;border-radius:12px;
 font:800 12px/1 'DM Sans',system-ui,sans-serif;letter-spacing:.02em;color:#f4efe6;
 background:linear-gradient(180deg,rgba(52,46,58,.96),rgba(14,12,18,.96));box-shadow:0 0 0 1px rgba(246,214,138,.55),0 2px 8px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.14);
 opacity:0;transition:opacity .16s ease;will-change:transform}
.pad-g.on{opacity:1}
.pad-g[data-b=A]{color:#7fdc5c}.pad-g[data-b=B]{color:#ff6b5e}.pad-g[data-b=X]{color:#5cb2ff}.pad-g[data-b=Y]{color:#ffd24d}
.pad-g[data-b=A],.pad-g[data-b=B],.pad-g[data-b=X],.pad-g[data-b=Y]{width:24px;padding:0;font-size:13px}
.pad-g[data-b=LB],.pad-g[data-b=RB],.pad-g[data-b=LT],.pad-g[data-b=RT]{border-radius:7px 7px 9px 9px;font-size:11px;color:#f6d68a}
.pad-g[data-b=START],.pad-g[data-b=SELECT]{width:28px;padding:0}
.pad-g svg{width:14px;height:14px;display:block}
`;
const ICON = {
  START: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="#f6d68a" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  SELECT: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="7.5" height="6.5" rx="1.4" fill="none" stroke="#f6d68a" stroke-width="1.5"/><rect x="6" y="6.5" width="7.5" height="6.5" rx="1.4" fill="rgba(20,16,24,.95)" stroke="#f6d68a" stroke-width="1.5"/></svg>',
};

const visible = el => { if (!el?.isConnected) return null; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth ? r : null; };
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export function installGamepad({ plugin, page = 'app', win = globalThis, doc = globalThis.document } = {}) {
  if (!plugin || doc.getElementById('pad-layer')) return null;
  const style = doc.createElement('style'); style.id = 'pad-style'; style.textContent = CSS; doc.head.append(style);
  const layer = doc.createElement('div'); layer.id = 'pad-layer'; layer.hidden = true; layer.setAttribute('aria-hidden', 'true');
  const ring = doc.createElement('div'); ring.className = 'pad-ring';
  const cursor = doc.createElement('div'); cursor.className = 'pad-cursor';
  layer.append(ring, cursor); doc.body.append(layer);
  const glyphs = new Map();
  const glyph = b => { let g = glyphs.get(b); if (!g) { g = doc.createElement('span'); g.className = 'pad-g'; g.dataset.b = b; g.innerHTML = ICON[b] || GLYPH[b]; layer.append(g); glyphs.set(b, g); } return g; };

  let beforeModal = null;
  let connected = false, cur = null, curSig = '', lastRect = null, ringShown = false;
  const ptr = { x: innerWidth / 2, y: innerHeight / 2, on: false, over: null, idle: 0 };
  const held = new Set();
  let axes = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, hx: 0, hy: 0 };
  let repeat = null, frame = 0, lastTime = 0;

  // ---------- what is on screen ----------
  const context = () => {
    if (page === 'planeswalk') return 'planeswalk';
    return doc.body.classList.contains('practice-table-open') && doc.querySelector('.play-match-table') ? 'match' : 'app';
  };
  const modalRoot = () => {
    const open = [...doc.querySelectorAll('dialog[open]')].filter(d => visible(d)).pop();
    if (open) return open;
    const pw = [...doc.querySelectorAll('.pw-menu')].pop();
    return pw || doc;
  };
  const hits = (el, r) => {
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.top + Math.min(r.height / 2, 40), 1), innerHeight - 1);
    const hit = doc.elementFromPoint(x, y);
    if (!hit) return false;
    return el === hit || el.contains(hit) || hit.closest?.('label')?.control === el;
  };
  const usable = el => {
    if (el.closest('#pad-layer,[inert],[aria-hidden="true"]')) return false;
    if ((el.disabled || el.getAttribute('aria-disabled') === 'true') && !el.matches(CARDS)) return false;
    if (el.matches('summary') && !el.parentElement?.matches('details')) return false;
    return true;
  };
  function candidates() {
    const root = modalRoot(), out = [];
    for (const el of root.querySelectorAll(FOCUSABLE)) {
      if (!usable(el)) continue;
      const r = visible(el);
      if (!r || !hits(el, r)) continue;
      // A control inside another control (a card's inner button) keeps only the outer one unless it is bigger.
      out.push({ el, r });
    }
    return out.filter(c => !out.some(o => o !== c && o.el.contains(c.el) && o.r.width * o.r.height <= c.r.width * c.r.height * 1.05 && !c.el.matches(CARDS)) || true);
  }
  const SIG_KEYS = ['id', 'data-focus-key', 'data-native-key', 'data-instance', 'data-cid', 'data-nav', 'data-act', 'data-i', 'data-id', 'data-r', 'data-l', 'data-m', 'data-tracker', 'data-zone', 'aria-label', 'data-to'];
  const signature = el => el.tagName + SIG_KEYS.map(k => el.hasAttribute(k) ? `[${k}=${el.getAttribute(k)}]` : '').join('') + (el.attributes.length < 3 ? '|' + (el.textContent || '').trim().slice(0, 40) : '');

  // ---------- focus ----------
  function setFocus(el, { scroll = true, hover = true } = {}) {
    if (cur && cur !== el && hover) hoverOut(cur);
    cur = el; curSig = el ? signature(el) : '';
    if (!el) { ring.classList.remove('on'); return; }
    try { if (el.matches(TYPING)) el.blur?.(); else el.focus({ preventScroll: true }); } catch {}
    if (scroll) {
      const r = el.getBoundingClientRect();
      if (r.top < 8 || r.bottom > innerHeight - 8 || r.left < 0 || r.right > innerWidth) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    if (hover) hoverIn(el);
    ringShown = true; lastRect = el.getBoundingClientRect();
    placeRing(true); refreshGlyphs(); wake();
  }
  // Hover previews (the table's card peek, Planeswalk's node names) appear for the focused card, as with a mouse.
  const mouse = (type, el, x, y, extra = {}) => {
    const init = { bubbles: !/enter|leave/.test(type), cancelable: true, composed: true, clientX: x, clientY: y, view: win, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, ...extra };
    el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
  };
  function hoverIn(el) { const r = el.getBoundingClientRect(), p = center(r); mouse('pointerover', el, p.x, p.y); mouse('pointerenter', el, p.x, p.y); mouse('mouseover', el, p.x, p.y); }
  function hoverOut(el) { if (!el.isConnected) return; const r = el.getBoundingClientRect(), p = center(r); mouse('pointerout', el, p.x, p.y); mouse('pointerleave', el, p.x, p.y); mouse('mouseout', el, p.x, p.y); }

  // Re-renders replace elements: find the same control again, or the nearest one to where it was.
  // Still pressable where it is: on screen, not covered, and inside the open menu or dialog if there is one.
  const valid = el => { if (!el?.isConnected || !usable(el)) return false; const r = visible(el), root = modalRoot(); return !!r && (root === doc || root.contains(el)) && hits(el, r); };
  function recover() {
    if (valid(cur)) return cur;
    const list = candidates();
    if (!list.length) { cur = null; return null; }
    // A menu or dialog opened over the focus: start on its main button.
    if (cur?.isConnected && modalRoot() !== doc && !modalRoot().contains(cur)) { beforeModal = cur; cur = firstFocus(list); curSig = cur ? signature(cur) : ''; return cur; }
    // ...and when it closes, back to where you were.
    if (beforeModal && modalRoot() === doc) { const back_ = beforeModal; beforeModal = null; if (valid(back_)) { cur = back_; curSig = signature(cur); return cur; } }
    const same = curSig && list.find(c => signature(c.el) === curSig);
    if (same) { cur = same.el; return cur; }
    if (!lastRect) return null;
    const p = center(lastRect);
    list.sort((a, b) => Math.hypot(center(a.r).x - p.x, center(a.r).y - p.y) - Math.hypot(center(b.r).x - p.x, center(b.r).y - p.y));
    cur = list[0].el; curSig = signature(cur); return cur;
  }

  const firstFocus = list => {
    const prefer = modalRoot() !== doc ? ['.btn.main', '[role=tab][aria-selected=true]', '[autofocus]', 'button:not([aria-label*=Close i])', 'button'] : { match: ['.play-match-hand .play-match-card', '.play-match-decisions [data-native-key=ok]'], planeswalk: ['.hand .card:not(:disabled)', '.node.open', '.btn.main', '.card'], app: ['#content button,#content a[href],#content [data-act]'] }[context()];
    const pick = prefer.map(sel => list.find(c => c.el.matches(sel))).find(Boolean) || list.slice().sort((a, b) => Math.hypot(center(a.r).x - innerWidth / 2, center(a.r).y - innerHeight / 2) - Math.hypot(center(b.r).x - innerWidth / 2, center(b.r).y - innerHeight / 2))[0];
    return pick?.el || null;
  };

  function best(list, from, dx, dy) {
    const f = center(from); let win_ = null, score = Infinity;
    for (const c of list) {
      if (c.el === cur) continue;
      const p = center(c.r);
      const along = dx ? (p.x - f.x) * dx : (p.y - f.y) * dy;
      if (along <= 2) continue;
      // Only what lies roughly that way (a 60-degree cone, widened by overlap), never a far corner.
      const off = dx ? Math.abs(p.y - f.y) - (c.r.height + from.height) / 2 : Math.abs(p.x - f.x) - (c.r.width + from.width) / 2;
      if (off > along * 1.8) continue;
      const gap = dx ? Math.max(0, dx > 0 ? c.r.left - from.right : from.left - c.r.right) : Math.max(0, dy > 0 ? c.r.top - from.bottom : from.top - c.r.bottom);
      const side = dx ? Math.max(0, Math.abs(p.y - f.y) - (c.r.height + from.height) / 4) : Math.max(0, Math.abs(p.x - f.x) - (c.r.width + from.width) / 4);
      const s = gap + along * 0.15 + side * 2.4;
      if (s < score) { score = s; win_ = c.el; }
    }
    return win_;
  }
  const scroller = (el, vertical) => {
    for (let n = el; n && n !== doc.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n), o = vertical ? cs.overflowY : cs.overflowX;
      if (/(auto|scroll)/.test(o) && (vertical ? n.scrollHeight > n.clientHeight + 4 : n.scrollWidth > n.clientWidth + 4)) return n;
    }
    const se = doc.scrollingElement;
    return se && (vertical ? se.scrollHeight > innerHeight + 4 : se.scrollWidth > innerWidth + 4) ? se : null;
  };
  function move(dir) {
    ptr.on = false; cursor.classList.remove('on');
    const [dx, dy] = DIRS[dir];
    const list = candidates();
    const here = recover();
    if (!here || !ringShown) { setFocus(here && ringShown !== false ? here : firstFocus(list)); return; }
    const from = here.getBoundingClientRect();
    const next = best(list, from, dx, dy);
    if (next) { setFocus(next); return; }
    // Nothing further that way on screen: scroll the list it sits in, then look again.
    const s = scroller(here, !!dy);
    if (!s) return;
    const box = s === doc.scrollingElement ? { width: innerWidth, height: innerHeight } : s.getBoundingClientRect();
    s.scrollBy({ left: dx * box.width * 0.6, top: dy * box.height * 0.6, behavior: 'auto' });
    const again = best(candidates(), here.getBoundingClientRect(), dx, dy);
    if (again) setFocus(again);
  }

  // ---------- doing things ----------
  const key = (k, target = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body) => {
    const ev = new KeyboardEvent('keydown', { key: k, code: k, bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(ev); target.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: k, bubbles: true, cancelable: true }));
    return ev.defaultPrevented;
  };
  const press = el => {
    if (!el) return;
    if (el.matches(TYPING)) { el.focus(); if (el.matches('select')) el.showPicker?.(); return; }
    if (el.matches('input[type=checkbox],input[type=radio]')) { el.click(); return; }
    const r = el.getBoundingClientRect(), p = center(r);
    mouse('pointerdown', el, p.x, p.y, { buttons: 1 }); mouse('mousedown', el, p.x, p.y, { buttons: 1 });
    mouse('pointerup', el, p.x, p.y); mouse('mouseup', el, p.x, p.y);
    el.click();
  };
  const clickAt = (x, y) => {
    const el = doc.elementFromPoint(x, y); if (!el) return;
    cursor.classList.add('press'); setTimeout(() => cursor.classList.remove('press'), 120);
    mouse('pointerdown', el, x, y, { buttons: 1 }); mouse('mousedown', el, x, y, { buttons: 1 });
    mouse('pointerup', el, x, y); mouse('mouseup', el, x, y);
    const target = el.closest(FOCUSABLE) || el;
    if (target.matches?.(TYPING)) target.focus();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: win, detail: 1 }));
  };
  const shown = sel => { for (const el of modalRoot().querySelectorAll(sel)) if (visible(el) && !el.disabled && hits(el, el.getBoundingClientRect())) return el; return null; };
  const inspect = el => {
    if (!el) return;
    const r = el.getBoundingClientRect(), p = center(r);
    if (context() === 'match' && el.matches('.play-match-card')) { key('i', el); return; }
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, view: win, button: 2 }));
  };
  const appBack = () => { try { return !!win.cardstashyBack?.(); } catch { return false; } };

  // The X button: the one thing the screen is asking for.
  const mainAction = () => ({
    match: () => shown('.play-match-decisions [data-native-key=ok]') || shown('.play-result-actions .btn:not(.ghost),.play-match-primary'),
    planeswalk: () => shown('[data-act=end]') || shown('.pw-menu .btn.main,.btn.main,[data-act=giftok]'),
    app: () => doc.querySelector('dialog[open]') ? null : shown('.bottom-nav [data-nav=search],#desktopSearch [data-nav=search],.nav-search'),
  })[context()]();
  const startTarget = () => ({
    match: () => shown('.play-match-header>.play-match-menu>summary') || shown('.play-match-menu>summary'),
    planeswalk: () => shown('.pw-menubtn'),
    app: () => shown('.topbar [data-act=menu]'),
  })[context()]();
  const selectTarget = () => ({
    // The tracker button lives inside the table's menu; pressing it works even while the menu is folded.
    match: () => shown('[data-tracker=toggle]') || doc.querySelector('.play-match-table [data-tracker=toggle]'),
    planeswalk: () => shown('details.deck>summary'),
    app: () => doc.querySelector('dialog[open]') ? null : shown('.bottom-nav [data-nav=decks],.top-nav [data-nav=decks]'),
  })[context()]();

  // A menu that opens in place (not a dialog) takes the focus on its first item, so the stick walks it at once.
  function focusOpened(trigger) {
    setTimeout(() => {
      const box = trigger.closest?.('details');
      if (!box?.open) return;
      const inside = candidates().filter(c => box.contains(c.el) && c.el !== trigger);
      if (inside.length) setFocus(inside[0].el);
    }, 120);
  }
  function back() {
    const ctx = context();
    if (doc.activeElement?.matches?.(TYPING)) { doc.activeElement.blur(); return; }
    if (ctx === 'planeswalk') {
      const cancel = shown('[data-act=cancel]'); if (cancel) { cancel.click(); return; }
      const deck = doc.querySelector('details.deck[open]'); if (deck) { deck.open = false; return; }
      if (doc.querySelector('.pw-menu,.pw-zoom,.pw-coach,[data-act=giftok],[data-act=closeinspect]')) key('Escape', doc.body);
      return;
    }
    if (ctx === 'match') {
      const menu = doc.querySelector('.play-match-menu[open],.play-turn-controls[open]'); if (menu) { menu.open = false; return; }
      if (doc.querySelector('dialog[open]')) { appBack(); return; }
      const cancel = shown('.play-match-decisions [data-native-key=cancel]');
      if (cancel) { cancel.click(); return; }
      key('Escape', cur?.isConnected ? cur : doc.body);
      return;
    }
    appBack();
  }
  // LB/RB: the tabs on screen, else the next part of the screen.
  function shoulder(step) {
    const root = modalRoot(), ctx = context();
    const lists = [...root.querySelectorAll('[role=tablist]')].filter(t => visible(t) && t.id !== 'gameTabs' && t.querySelectorAll('[role=tab]').length > 1);
    const list = lists.find(t => cur && t.contains(cur)) || lists[0];
    if (list) {
      const tabs = [...list.querySelectorAll('[role=tab]')].filter(t => visible(t) && !t.disabled);
      const at = Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));
      const next = tabs[(at + step + tabs.length) % tabs.length];
      if (next) { press(next); setTimeout(() => setFocus(next, { hover: false }), 60); }
      return;
    }
    const regions = {
      match: ['.play-match-hand', ...[...doc.querySelectorAll('.play-match-lane')].map((_, i) => `.play-match-lane:nth-of-type(${i + 1})`), '.play-match-decisions'],
      planeswalk: ['.battle .hand', '.battle .side.foe', '.battle .side.you', '.battle .controls', '.map', '.choices'],
      app: [],
    }[ctx];
    const all = candidates();
    const groups = regions.map(sel => [...doc.querySelectorAll(sel)].flatMap(r => all.filter(c => r.contains(c.el)))).filter(g => g.length);
    if (groups.length > 1) {
      const at = groups.findIndex(g => g.some(c => c.el === cur));
      const g = groups[(at + step + groups.length) % groups.length];
      setFocus((g.find(c => !c.el.disabled) || g[0]).el);
      return;
    }
    if (ctx === 'app' && !doc.querySelector('dialog[open]')) {
      const nav = [...doc.querySelectorAll('.bottom-nav [data-nav],.top-nav [data-nav]')].filter(b => visible(b) && !b.disabled);
      if (!nav.length) return;
      const view = doc.body.dataset.view, at = nav.findIndex(b => b.dataset.nav === view);
      const next = nav[at < 0 ? (step > 0 ? 0 : nav.length - 1) : (at + step + nav.length) % nav.length];
      press(next); ringShown = false; ring.classList.remove('on');
    }
  }
  function page_(step) {
    const s = (cur?.isConnected && scroller(cur, true)) || scroller(doc.elementFromPoint(innerWidth / 2, innerHeight / 2) || doc.body, true);
    if (!s) return;
    const h = s === doc.scrollingElement ? innerHeight : s.clientHeight;
    s.scrollBy({ top: step * h * 0.8, behavior: 'smooth' });
    // The ring moves to whatever now sits where it was.
    setTimeout(() => { if (cur && !visible(cur)) { const p = lastRect; cur = null; lastRect = p; const c = recover(); if (c) setFocus(c, { scroll: false }); } }, 420);
  }

  function act(button) {
    win.dispatchEvent(new CustomEvent('cardstashy-pad', { detail: { button } }));
    if (DIRS[button]) { move(button); return; }
    switch (button) {
      case 'A': if (ptr.on) clickAt(ptr.x, ptr.y); else if (ringShown && recover()) press(cur); else move('DOWN'); break;
      case 'B': back(); break;
      case 'X': press(mainAction()); break;
      case 'Y': if (ptr.on) inspect(doc.elementFromPoint(ptr.x, ptr.y)); else inspect(recover()); break;
      case 'START': { const t = startTarget(); if (t) { press(t); focusOpened(t); } else if (context() === 'planeswalk') key('Escape', doc.body); break; }
      case 'SELECT': { const t = selectTarget(); if (t) { press(t); focusOpened(t); } break; }
      case 'LB': shoulder(-1); break;
      case 'RB': shoulder(1); break;
      case 'LT': page_(-1); break;
      case 'RT': if (ptr.on) clickAt(ptr.x, ptr.y); else page_(1); break;
      case 'RS': ptr.on = !ptr.on; if (ptr.on && cur) { const p = center(cur.getBoundingClientRect()); ptr.x = p.x; ptr.y = p.y; } cursor.classList.toggle('on', ptr.on); break;
      case 'LS': if (ringShown && cur) inspect(cur); break;
    }
    setTimeout(refreshGlyphs, 80);
  }

  // Direction keys repeat while held, like a console menu.
  const startRepeat = dir => { stopRepeat(); act(dir); repeat = { dir, timer: setTimeout(function tick() { act(dir); repeat.timer = setTimeout(tick, 95); }, 360) }; };
  const stopRepeat = dir => { if (repeat && (!dir || repeat.dir === dir)) { clearTimeout(repeat.timer); repeat = null; } };
  // One logical button can come from a key, a hat or an analog trigger; it presses once.
  const state = new Set();
  function set(button, down) {
    if (down === state.has(button)) return;
    if (down) { state.add(button); wake(); if (DIRS[button]) startRepeat(button); else act(button); }
    else { state.delete(button); if (DIRS[button]) stopRepeat(button); }
  }
  function combined() {
    const want = {
      UP: held.has('UP') || axes.hy < -0.5 || stickDir === 'UP', DOWN: held.has('DOWN') || axes.hy > 0.5 || stickDir === 'DOWN',
      LEFT: held.has('LEFT') || axes.hx < -0.5 || stickDir === 'LEFT', RIGHT: held.has('RIGHT') || axes.hx > 0.5 || stickDir === 'RIGHT',
      LT: held.has('LT') || axes.lt > 0.6, RT: held.has('RT') || axes.rt > 0.6,
    };
    for (const [b, on] of Object.entries(want)) set(b, on);
  }
  let stickDir = null;
  const stick = () => {
    const { lx, ly } = axes, m = Math.hypot(lx, ly);
    if (m < 0.35) stickDir = null;
    else if (m > 0.6) stickDir = Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 'RIGHT' : 'LEFT') : (ly > 0 ? 'DOWN' : 'UP');
  };

  // ---------- the right-stick cursor ----------
  function loop(t) {
    frame = 0;
    const dt = Math.min(0.05, (t - (lastTime || t)) / 1000); lastTime = t;
    const { rx, ry } = axes, m = Math.hypot(rx, ry);
    if (m > 0.12) {
      if (!ptr.on) { ptr.on = true; if (cur && visible(cur)) { const p = center(cur.getBoundingClientRect()); ptr.x = p.x; ptr.y = p.y; } cursor.classList.add('on'); ring.classList.remove('on'); }
      const under = doc.elementFromPoint(ptr.x, ptr.y), sticky = under?.closest?.(FOCUSABLE) ? 0.55 : 1;
      const speed = (180 + 900 * m * m) * sticky;
      const nx = ptr.x + (rx / m) * speed * m * dt, ny = ptr.y + (ry / m) * speed * m * dt;
      ptr.x = Math.min(Math.max(nx, 2), innerWidth - 2); ptr.y = Math.min(Math.max(ny, 2), innerHeight - 2);
      // Pushing against the top or bottom edge scrolls whatever is under the cursor.
      if ((ny < 2 && ry < 0) || (ny > innerHeight - 2 && ry > 0)) { const s = scroller(under || doc.body, true); s?.scrollBy({ top: ry * 900 * dt }); }
      const over = doc.elementFromPoint(ptr.x, ptr.y);
      if (over !== ptr.over) { if (ptr.over?.isConnected) { mouse('pointerout', ptr.over, ptr.x, ptr.y); mouse('mouseout', ptr.over, ptr.x, ptr.y); } if (over) { mouse('pointerover', over, ptr.x, ptr.y); mouse('mouseover', over, ptr.x, ptr.y); } ptr.over = over; }
      if (over) mouse('pointermove', over, ptr.x, ptr.y);
      cursor.classList.toggle('over', !!over?.closest?.(FOCUSABLE));
      cursor.style.transform = `translate3d(${ptr.x}px,${ptr.y}px,0)`;
      wake();
    }
    combined();
    placeRing(false);
    // Runs only while something moves (stick, held direction, or the ring settling after a press); idle costs nothing.
    if (m > 0.12 || stickDir || repeat || t < followUntil) frame = requestAnimationFrame(loop);
  }
  const kick = () => { if (!frame) { lastTime = 0; frame = requestAnimationFrame(loop); } };

  let lastPos = '';
  function placeRing(force) {
    if (!ringShown || ptr.on || !connected) { ring.classList.remove('on'); return; }
    const el = valid(cur) ? cur : recover();
    const r = el && visible(el);
    if (!r) { ring.classList.remove('on'); return; }
    lastRect = r;
    const pos = `${r.left|0},${r.top|0},${r.width|0},${r.height|0}`;
    if (pos === lastPos && !force) return;
    lastPos = pos;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 10;
    ring.style.borderRadius = `${Math.min(radius + 3, r.height / 2 + 3)}px`;
    ring.style.width = `${r.width + 6}px`; ring.style.height = `${r.height + 6}px`;
    ring.style.transform = `translate3d(${r.left - 3}px,${r.top - 3}px,0)`;
    ring.classList.add('on');
    placeGlyph('A', r, 'br');
    if (el.matches(CARDS)) placeGlyph('Y', r, 'tr'); else glyph('Y').classList.remove('on');
  }

  // ---------- glyphs on the controls they press ----------
  function placeGlyph(b, r, corner) {
    const g = glyph(b), w = g.offsetWidth || 24, h = 24;
    let x = corner.endsWith('r') ? r.right - w / 2 - 2 : r.left - w / 2 + 2;
    let y = corner.startsWith('b') ? r.bottom - h / 2 - 2 : r.top - h / 2 + 2;
    x = Math.min(Math.max(x, 4), innerWidth - w - 4); y = Math.min(Math.max(y, 4), innerHeight - h - 4);
    g.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`; g.classList.add('on');
  }
  const hide = b => glyphs.get(b)?.classList.remove('on');
  function refreshGlyphs() {
    if (!connected) return;
    const mark = (b, el, corner = 'tr') => { const r = el && visible(el); if (r && el !== cur) placeGlyph(b, r, corner); else hide(b); };
    mark('X', mainAction()); mark('START', startTarget(), 'br'); mark('SELECT', selectTarget(), 'br');
    const tabs = [...modalRoot().querySelectorAll('[role=tablist]')].find(t => visible(t) && t.id !== 'gameTabs' && t.querySelectorAll('[role=tab]').length > 1);
    if (tabs) { const r = visible(tabs); placeGlyph('LB', r, 'tl'); placeGlyph('RB', r, 'tr'); } else { hide('LB'); hide('RB'); }
    if (!ringShown || ptr.on) { hide('A'); hide('Y'); }
  }

  // ---------- touch and the outside world ----------
  // A tap moves the focus to what was tapped (hidden until the next controller press); the glyphs stay.
  doc.addEventListener('pointerdown', e => {
    // No controller: a tap costs nothing here (no layout read on every touch).
    if (!connected || !e.isTrusted || e.pointerType === 'mouse') return;
    const el = e.target.closest?.(FOCUSABLE);
    if (el) { cur = el; curSig = signature(el); lastRect = el.getBoundingClientRect(); }
    ringShown = false; ring.classList.remove('on'); hide('A'); hide('Y'); usedAt = 0; settled();
    if (ptr.on) { ptr.on = false; cursor.classList.remove('on'); }
  }, true);
  let glyphTimer = 0;
  let followUntil = 0;
  const wake = () => { followUntil = performance.now() + 700; kick(); };
  // The ring and glyphs follow re-renders by re-measuring every 400 ms, but only while the controller is
  // in use: 6 s after its last press (or at once on a tap) the check rests, so a handheld played by touch
  // or a pad lying on the table never re-measures the page in the background. Any press wakes it again.
  let usedAt = 0, settleTimer = 0;
  const watch = () => {
    clearInterval(glyphTimer); glyphTimer = 0;
    if (!connected || performance.now() - usedAt > 6000) return;
    glyphTimer = setInterval(() => { if (performance.now() - usedAt > 6000) { clearInterval(glyphTimer); glyphTimer = 0; return; } placeRing(false); refreshGlyphs(); }, 400);
  };
  const used = () => { usedAt = performance.now(); if (!glyphTimer) watch(); };
  // At rest, the glyphs are re-placed once after the page settles from a scroll or a turn.
  const settled = () => { clearTimeout(settleTimer); settleTimer = setTimeout(() => { if (connected) { lastPos = ''; placeRing(false); refreshGlyphs(); } }, 180); };
  win.addEventListener('resize', () => { lastPos = ''; if (connected) settled(); });
  win.addEventListener('scroll', () => { if (!connected) return; lastPos = ''; if (ringShown) wake(); else settled(); }, { capture: true, passive: true });

  function setConnected(on) {
    connected = !!on;
    layer.hidden = !connected;
    doc.documentElement.classList.toggle('pad-connected', connected);
    if (!connected) { ringShown = false; ptr.on = false; cursor.classList.remove('on'); for (const g of glyphs.values()) g.classList.remove('on'); held.clear(); state.clear(); stopRepeat(); }
    watch(); refreshGlyphs();
  }

  const onButton = ({ button, down, repeat: r }) => {
    if (r) return;
    used();
    if (!connected) setConnected(true);
    if (down) held.add(button); else held.delete(button);
    if (DIRS[button] || button === 'LT' || button === 'RT') { combined(); return; }
    if (down) { wake(); act(button); }
  };
  const onAxes = a => { used(); if (!connected) setConnected(true); axes = { ...axes, ...a }; stick(); combined(); kick(); };

  plugin.addListener('button', onButton);
  plugin.addListener('axes', onAxes);
  plugin.addListener('devices', d => setConnected((d?.count || 0) > 0));
  plugin.start().then(d => setConnected((d?.count || 0) > 0)).catch(() => {});
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) plugin.start().then(d => setConnected((d?.count || 0) > 0)).catch(() => {}); });

  return { act, setConnected, get focused() { return cur; }, get cursor() { return { ...ptr }; }, onButton, onAxes };
}
