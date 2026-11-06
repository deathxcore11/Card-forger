// A small DOM for the site's own panel scripts (rule-learning.js attachRuleLearning, rule-dex.js showRuleHint…): the site's
// markup goes in, the site's own listeners run on it, and the markup as they leave it comes back out for the app to draw.
// Only what those scripts touch: elements, text, attributes (hidden, open, disabled, value, dataset, classList), innerHTML,
// querySelector / closest / matches with compound selectors and descendant / child combinators, and bubbling events.
const VOID = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source', 'wbr', 'col', 'area']);
const unescape = t => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|rarr|larr|middot|times|hellip|ndash|mdash);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  : {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', middot: '·', times: '×', hellip: '…', ndash: '–', mdash: '—'}[e.toLowerCase()]);
const escText = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
let ids = 0;

export class Text {
  constructor(text, doc) { this.nodeType = 3; this.data = text; this.parentNode = null; this.ownerDocument = doc; }
  get textContent() { return this.data; } set textContent(v) { this.data = String(v); }
  get parentElement() { return this.parentNode; }
  remove() { this.parentNode?._drop(this); }
}

const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

export class Element {
  constructor(tag, doc) {
    this.nodeType = 1; this.localName = tag.toLowerCase(); this.tagName = tag.toUpperCase(); this.nodeName = this.tagName;
    this.attributes = {}; this.childNodes = []; this.parentNode = null; this.ownerDocument = doc; this._on = {}; this._id = ++ids;
    this.style = {setProperty() {}, removeProperty() {}}; this.scrollTop = 0; this.scrollLeft = 0;
    const el = this;
    this.dataset = new Proxy({}, {
      get: (_, k) => typeof k === 'string' ? el.getAttribute('data-' + kebab(k)) ?? undefined : undefined,
      set: (_, k, v) => { el.setAttribute('data-' + kebab(String(k)), v); return true; },
      deleteProperty: (_, k) => { el.removeAttribute('data-' + kebab(String(k))); return true; },
      has: (_, k) => el.hasAttribute('data-' + kebab(String(k))),
      ownKeys: () => Object.keys(el.attributes).filter(a => a.startsWith('data-')).map(a => camel(a.slice(5))),
      getOwnPropertyDescriptor: (_, k) => el.hasAttribute('data-' + kebab(String(k))) ? {value: el.getAttribute('data-' + kebab(String(k))), enumerable: true, configurable: true} : undefined,
    });
    this.classList = {
      contains: c => el.className.split(/\s+/).includes(c),
      add: (...cs) => { const s = el.className.split(/\s+/).filter(Boolean); for (const c of cs) if (!s.includes(c)) s.push(c); el.className = s.join(' '); },
      remove: (...cs) => { el.className = el.className.split(/\s+/).filter(c => c && !cs.includes(c)).join(' '); },
      toggle: (c, force) => { const has = el.classList.contains(c), want = force === undefined ? !has : !!force; if (want && !has) el.classList.add(c); else if (!want && has) el.classList.remove(c); return want; },
    };
  }
  getAttribute(k) { k = String(k).toLowerCase(); return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  setAttribute(k, v) { k = String(k).toLowerCase(); this.attributes[k] = String(v); if (k === 'value') this._value = undefined; }
  removeAttribute(k) { delete this.attributes[String(k).toLowerCase()]; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, String(k).toLowerCase()); }
  toggleAttribute(k, force) { const want = force === undefined ? !this.hasAttribute(k) : !!force; if (want) this.setAttribute(k, ''); else this.removeAttribute(k); return want; }
  _flag(k) { return this.hasAttribute(k); } _setFlag(k, v) { if (v) this.setAttribute(k, ''); else this.removeAttribute(k); }
  get hidden() { return this._flag('hidden'); } set hidden(v) { this._setFlag('hidden', v); }
  get open() { return this._flag('open'); } set open(v) { this._setFlag('open', v); }
  get disabled() { return this._flag('disabled'); } set disabled(v) { this._setFlag('disabled', v); }
  get checked() { return this._flag('checked'); } set checked(v) { this._setFlag('checked', v); }
  // A select's value is its chosen option's (the one marked selected, else the first); an option's its value or its words.
  get value() {
    if (this._value !== undefined) return this._value;
    if (this.localName === 'select') { const os = this.querySelectorAll('option'); const o = os.find(x => x.hasAttribute('selected')) || os[0]; return o ? o.value : ''; }
    return this.getAttribute('value') ?? (this.localName === 'textarea' || this.localName === 'option' ? this.textContent : '');
  }
  set value(v) { this._value = String(v); }
  get id() { return this.getAttribute('id') || ''; } set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; } set className(v) { this.setAttribute('class', v); }
  get type() { return this.getAttribute('type') || (this.localName === 'button' ? 'submit' : this.localName === 'input' ? 'text' : ''); }
  get href() { return this.getAttribute('href') || ''; }
  get onclick() { return this._onclick || null; } set onclick(f) { this._onclick = f; }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get firstChild() { return this.childNodes[0] || null; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get nextElementSibling() { const s = this.parentNode?.children || [], i = s.indexOf(this); return i >= 0 ? s[i + 1] || null : null; }
  get previousElementSibling() { const s = this.parentNode?.children || [], i = s.indexOf(this); return i > 0 ? s[i - 1] : null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument; }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) { this._clear(); if (String(v)) this._add(new Text(String(v), this.ownerDocument)); }
  get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
  get innerHTML() { return this.childNodes.map(n => n.nodeType === 3 ? escText(n.data) : n.outerHTML).join(''); }
  set innerHTML(html) { this._clear(); for (const n of parse(String(html ?? ''), this.ownerDocument)) this._add(n); }
  get outerHTML() {
    const a = Object.entries(this.attributes).map(([k, v]) => v === '' ? ' ' + k : ` ${k}="${escAttr(v)}"`).join('');
    return VOID.has(this.localName) ? `<${this.localName}${a}>` : `<${this.localName}${a}>${this.innerHTML}</${this.localName}>`;
  }
  set outerHTML(html) { this.replaceWith(...parse(String(html ?? ''), this.ownerDocument)); }
  _clear() { for (const n of this.childNodes) n.parentNode = null; this.childNodes = []; }
  _add(n, at = this.childNodes.length) { if (n.parentNode) n.parentNode._drop(n); n.parentNode = this; this.childNodes.splice(at, 0, n); return n; }
  _drop(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; }
  _nodes(xs) { return xs.flatMap(x => typeof x === 'string' ? [new Text(x, this.ownerDocument)] : x?.nodeType === 11 ? [...x.childNodes] : [x]); }
  append(...xs) { for (const n of this._nodes(xs)) this._add(n); }
  appendChild(n) { for (const x of this._nodes([n])) this._add(x); return n; }
  prepend(...xs) { this._nodes(xs).forEach((n, i) => this._add(n, i)); }
  insertBefore(n, ref) { const i = ref ? this.childNodes.indexOf(ref) : -1; this._add(n, i < 0 ? this.childNodes.length : i); return n; }
  removeChild(n) { this._drop(n); return n; }
  remove() { this.parentNode?._drop(this); }
  replaceWith(...xs) { const p = this.parentNode; if (!p) return; let i = p.childNodes.indexOf(this); p._drop(this); for (const n of p._nodes(xs)) p._add(n, i++); }
  replaceChildren(...xs) { this._clear(); this.append(...xs); }
  before(...xs) { const p = this.parentNode; if (!p) return; let i = p.childNodes.indexOf(this); for (const n of p._nodes(xs)) p._add(n, i++); }
  after(...xs) { const p = this.parentNode; if (!p) return; let i = p.childNodes.indexOf(this) + 1; for (const n of p._nodes(xs)) p._add(n, i++); }
  insertAdjacentHTML(where, html) {
    const ns = parse(String(html), this.ownerDocument), w = where.toLowerCase();
    if (w === 'beforeend') ns.forEach(n => this._add(n)); else if (w === 'afterbegin') ns.forEach((n, i) => this._add(n, i));
    else if (w === 'beforebegin') this.before(...ns); else if (w === 'afterend') this.after(...ns);
  }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  cloneNode(deep) { const c = new Element(this.localName, this.ownerDocument); c.attributes = {...this.attributes}; if (deep) c.innerHTML = this.innerHTML; return c; }
  matches(sel) { return parseSelectors(sel).some(s => matchComplex(this, s)); }
  closest(sel) { const list = parseSelectors(sel); for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (list.some(s => matchComplex(n, s))) return n; return null; }
  querySelectorAll(sel) { const list = parseSelectors(sel), out = []; walk(this, n => { if (list.some(s => matchComplex(n, s, this))) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(t) { return this.querySelectorAll(t); }
  addEventListener(type, f, opts) { (this._on[type] ||= []).push({f, capture: opts === true || !!opts?.capture, once: !!opts?.once}); }
  removeEventListener(type, f) { if (this._on[type]) this._on[type] = this._on[type].filter(l => l.f !== f); }
  dispatchEvent(e) { return dispatch(this, e); }
  click() { return dispatch(this, new Event('click', {bubbles: true})); }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; this.ownerDocument?._reveal?.(this, 'focus'); }
  blur() {}
  scrollIntoView() { this.ownerDocument?._reveal?.(this, 'scroll'); }
  scrollTo() {} scroll() {}
  getBoundingClientRect() { return {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0}; }
  get offsetHeight() { return 0; } get offsetWidth() { return 0; } get clientHeight() { return 0; } get scrollHeight() { return 0; }
  showModal() { this.setAttribute('open', ''); } show() { this.setAttribute('open', ''); } close() { this.removeAttribute('open'); }
  animate() { return {finished: Promise.resolve(), cancel() {}, onfinish: null}; }
}
function walk(n, f) { for (const k of n.childNodes) if (k.nodeType === 1) { f(k); walk(k, f); } }

export class Event {
  constructor(type, o = {}) { this.type = type; this.bubbles = !!o.bubbles; this.cancelable = !!o.cancelable; this.defaultPrevented = false; this._stop = false; this._now = false; this.target = null; this.currentTarget = null; Object.assign(this, o.extra || {}); }
  preventDefault() { this.defaultPrevented = true; } stopPropagation() { this._stop = true; } stopImmediatePropagation() { this._stop = this._now = true; }
}
function dispatch(target, e) {
  e.target = target;
  const path = []; for (let n = target; n; n = n.parentNode) path.push(n);
  const run = (n, capture) => { e.currentTarget = n; for (const l of (n._on?.[e.type] || []).slice()) { if (l.capture !== capture && n !== target) continue; if (l.once) n.removeEventListener(e.type, l.f); try { l.f.call(n, e); } catch (x) { globalThis.__lastError = String(x && x.stack || x); } if (e._now) return false; } return !e._stop; };
  for (const n of path.slice(1).reverse()) if (!run(n, true)) return !e.defaultPrevented;
  if (e.type === 'click' && target._onclick) { try { target._onclick.call(target, e); } catch (x) { globalThis.__lastError = String(x && x.stack || x); } }
  if (!run(target, false)) return !e.defaultPrevented;
  if (e.bubbles) for (const n of path.slice(1)) if (!run(n, false)) break;
  return !e.defaultPrevented;
}

// Markup into nodes (the same reader as the engine's tree()).
export function parse(html, doc) {
  const root = new Element('#root', doc), stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) { const tag = m[1].toLowerCase(); const i = stack.map(n => n.localName).lastIndexOf(tag); if (i > 0) stack.length = i; }
    else if (m[2]) {
      const node = new Element(m[2], doc), ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3] || ''))) node.attributes[a[1].toLowerCase()] = unescape(a[2] ?? a[3] ?? a[4] ?? '');
      top._add(node); if (!m[4] && !VOID.has(node.localName)) stack.push(node);
    } else if (m[5] !== undefined) top._add(new Text(unescape(m[5]), doc));
    else if (m[0] === '<') top._add(new Text('<', doc));
  }
  const out = root.childNodes.slice(); root._clear(); return out;
}

// Selectors: lists of complex selectors (descendant ' ' and child '>'), each a compound of tag, #id, .class, [attr op "v"],
// :not(…), :scope, :checked, :disabled, :first-child.
const selCache = new Map();
function splitTop(s, ch) { const out = []; let d = 0, q = '', cur = ''; for (const c of s) { if (q) { if (c === q) q = ''; cur += c; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if (c === '[' || c === '(') d++; if (c === ']' || c === ')') d--; if (c === ch && d === 0) { out.push(cur); cur = ''; continue; } cur += c; } out.push(cur); return out; }
function parseSelectors(sel) {
  if (selCache.has(sel)) return selCache.get(sel);
  const list = splitTop(String(sel), ',').map(s => s.trim()).filter(Boolean).map(parseComplex);
  selCache.set(sel, list); return list;
}
function parseComplex(s) {
  const parts = []; let cur = '', d = 0, q = '', comb = ' ';
  const push = () => { if (cur.trim()) { parts.push({comb, c: parseCompound(cur.trim())}); comb = ' '; } cur = ''; };
  for (const c of s) {
    if (q) { if (c === q) q = ''; cur += c; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '(') d++; if (c === ']' || c === ')') d--;
    if (d === 0 && (c === ' ' || c === '>')) { push(); if (c === '>') comb = '>'; continue; }
    cur += c;
  }
  push(); return parts;
}
function parseCompound(s) {
  const c = {tag: null, id: null, cls: [], attrs: [], not: [], pseudo: []}; let m;
  const re = /^(\*|[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[\s*([^\s~|^$*=\]]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]|:not\(((?:[^()]|\([^()]*\))*)\)|:([\w-]+)/g;
  while ((m = re.exec(s))) {
    if (m[1]) c.tag = m[1] === '*' ? null : m[1].toLowerCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]);
    else if (m[4]) c.attrs.push({k: m[4].toLowerCase(), op: m[5] || '', v: m[6] ?? m[7] ?? m[8] ?? ''});
    else if (m[9] !== undefined) c.not.push(parseSelectors(m[9])); else if (m[10]) c.pseudo.push(m[10]);
  }
  return c;
}
function matchCompound(n, c, scope) {
  if (n.nodeType !== 1) return false;
  if (c.tag && n.localName !== c.tag) return false;
  if (c.id && n.id !== c.id) return false;
  if (c.cls.length) { const own = n.className.split(/\s+/); if (!c.cls.every(x => own.includes(x))) return false; }
  for (const a of c.attrs) {
    const v = n.getAttribute(a.k); if (v === null) return false;
    if (a.op === '=' && v !== a.v) return false; if (a.op === '~=' && !v.split(/\s+/).includes(a.v)) return false;
    if (a.op === '^=' && !v.startsWith(a.v)) return false; if (a.op === '$=' && !v.endsWith(a.v)) return false;
    if (a.op === '*=' && !v.includes(a.v)) return false; if (a.op === '|=' && v !== a.v && !v.startsWith(a.v + '-')) return false;
  }
  for (const l of c.not) if (l.some(s => matchComplex(n, s, scope))) return false;
  for (const p of c.pseudo) {
    if (p === 'scope' && n !== scope) return false;
    if (p === 'checked' && !n.checked) return false; if (p === 'disabled' && !n.disabled) return false;
    if (p === 'first-child' && n.parentNode?.children[0] !== n) return false;
    if (p === 'last-child' && n.parentNode?.children.at(-1) !== n) return false;
  }
  return true;
}
function matchComplex(n, parts, scope) {
  const at = (node, i) => {
    if (!matchCompound(node, parts[i].c, scope)) return false;
    if (i === 0) return true;
    if (parts[i].comb === '>') { const p = node.parentNode; return !!p && p.nodeType === 1 && at(p, i - 1); }
    for (let p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) if (at(p, i - 1)) return true;
    return false;
  };
  return at(n, parts.length - 1);
}

// A document: body plus the few document-level calls (createElement, querySelector, listeners, activeElement).
export class Document {
  constructor() {
    this.nodeType = 9; this.childNodes = []; this._on = {}; this.activeElement = null; this.scrollingElement = null; this.reveals = [];
    this.documentElement = new Element('html', this); this.documentElement.parentNode = this; this.childNodes.push(this.documentElement);
    this.body = new Element('body', this); this.documentElement._add(this.body); this.head = new Element('head', this);
  }
  get ownerDocument() { return null; }
  get parentNode() { return null; }
  _drop() {}
  _reveal(el, how) { this.reveals.push(el._id); }
  createElement(t) { return new Element(t, this); }
  createTextNode(t) { return new Text(String(t), this); }
  createDocumentFragment() { const f = new Element('#fragment', this); f.nodeType = 11; return f; }
  querySelector(s) { return this.body.querySelector(s); }
  querySelectorAll(s) { return this.body.querySelectorAll(s); }
  getElementById(id) { return this.body.querySelector('#' + id); }
  addEventListener(type, f, opts) { (this._on[type] ||= []).push({f, capture: opts === true || !!opts?.capture, once: !!opts?.once}); }
  removeEventListener(type, f) { if (this._on[type]) this._on[type] = this._on[type].filter(l => l.f !== f); }
  dispatchEvent(e) { return dispatch(this, e); }
  contains(n) { return this.documentElement.contains(n); }
}

// For the app: the nodes as JSON (tag, attributes, children; text as strings), each element with its id for taps and typing.
// [svg]: what an <svg> becomes instead of its nodes (the engine's icon model).
// [svg]: a drawing's icon model; [img]: a picture's sources, for the app to draw them.
export function serialize(n, svg, img) {
  if (n.nodeType === 3) return n.data;
  if (svg && n.localName === 'svg') return {t: 'svg', i: n._id, a: n.attributes, k: [], icon: svg(n)};
  const kids = []; for (const k of n.childNodes) { if (k.nodeType === 3 && kids.length && typeof kids[kids.length - 1] === 'string') kids[kids.length - 1] += k.data; else kids.push(serialize(k, svg, img)); }
  const o = {t: n.localName, i: n._id, a: n.attributes, k: kids};
  if (n._value !== undefined) o.v = n._value;
  if (img && n.localName === 'img') o.pic = img(n);
  return o;
}
export function byId(root, id) { if (root._id === id) return root; let hit = null; walk(root, n => { if (!hit && n._id === id) hit = n; }); return hit; }
// A tap as the browser makes one: click bubbles through the site's listeners; a summary nobody stopped opens or closes its
// details; a label's tap reaches its control.
export function tap(el) {
  dispatch(el, new Event('pointerdown', {bubbles: true, cancelable: true}));
  if (!el.isConnected) return false;
  const ok = dispatch(el, new Event('click', {bubbles: true, cancelable: true}));
  const summary = el.closest('summary'), details = summary?.parentNode;
  if (ok && details?.localName === 'details' && details.children[0] === summary) { details.open = !details.open; dispatch(details, new Event('toggle')); }
  return ok;
}
export function type(el, value) {
  el.value = value;
  dispatch(el, new Event('input', {bubbles: true}));
  dispatch(el, new Event('change', {bubbles: true}));
}
