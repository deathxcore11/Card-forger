// The browser the site's random deck builder expects, for QuickJS (which here cannot run its own job loop).
// The bundle is built at an es2016 target so every async function goes through the global Promise below;
// its jobs, timers and network requests wait in queues that the app drains (RandomBuild.kt: __pump / __host).
// Nothing here decides anything about a deck: it only carries the web's own code.
const jobs = [];
const enqueue = fn => { jobs.push(fn); };
class Promise {
  constructor(executor) {
    this._s = 0; this._v = undefined; this._h = [];
    let done = false;
    const res = v => { if (done) return; done = true; this._resolve(v); };
    const rej = e => { if (done) return; done = true; this._settle(2, e); };
    try { executor(res, rej); } catch (e) { rej(e); }
  }
  _resolve(v) {
    if (v === this) return this._settle(2, new TypeError('Chaining cycle'));
    if (v && (typeof v === 'object' || typeof v === 'function')) {
      let then;
      try { then = v.then; } catch (e) { return this._settle(2, e); }
      if (typeof then === 'function') {
        let called = false;
        enqueue(() => { try { then.call(v, x => { if (!called) { called = true; this._resolve(x); } }, e => { if (!called) { called = true; this._settle(2, e); } }); } catch (e) { if (!called) { called = true; this._settle(2, e); } } });
        return;
      }
    }
    this._settle(1, v);
  }
  _settle(s, v) { if (this._s) return; this._s = s; this._v = v; const h = this._h; this._h = null; h.forEach(f => enqueue(f)); }
  then(onOk, onErr) {
    return new Promise((res, rej) => {
      const run = () => {
        const f = this._s === 1 ? onOk : onErr;
        if (typeof f !== 'function') return this._s === 1 ? res(this._v) : rej(this._v);
        try { res(f(this._v)); } catch (e) { rej(e); }
      };
      if (this._s) enqueue(run); else this._h.push(run);
    });
  }
  catch(f) { return this.then(undefined, f); }
  finally(f) { return this.then(v => Promise.resolve(f && f()).then(() => v), e => Promise.resolve(f && f()).then(() => { throw e; })); }
  static resolve(v) { return v instanceof Promise ? v : new Promise(r => r(v)); }
  static reject(e) { return new Promise((_, r) => r(e)); }
  static all(list) { return new Promise((res, rej) => { const a = Array.from(list), out = new Array(a.length); let n = a.length; if (!n) return res(out); a.forEach((p, i) => Promise.resolve(p).then(v => { out[i] = v; if (--n === 0) res(out); }, rej)); }); }
  static allSettled(list) { return Promise.all(Array.from(list).map(p => Promise.resolve(p).then(value => ({status: 'fulfilled', value}), reason => ({status: 'rejected', reason})))); }
  static race(list) { return new Promise((res, rej) => { Array.from(list).forEach(p => Promise.resolve(p).then(res, rej)); }); }
  static any(list) { return new Promise((res, rej) => { const a = Array.from(list); let n = a.length; if (!n) return rej(new Error('All promises were rejected')); a.forEach(p => Promise.resolve(p).then(res, () => { if (--n === 0) rej(new Error('All promises were rejected')); })); }); }
}
globalThis.Promise = Promise;
globalThis.queueMicrotask = f => enqueue(f);

// Timers: a virtual clock the app advances when nothing else can run (real waits happen in Kotlin).
let timerId = 0; const timers = new Map();
globalThis.setTimeout = (f, ms = 0, ...args) => { const id = ++timerId; timers.set(id, {at: Date.now() + Math.max(0, Number(ms) || 0), f: () => f(...args)}); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
globalThis.setInterval = () => 0; globalThis.clearInterval = () => {};
globalThis.requestAnimationFrame = f => setTimeout(() => f(Date.now()), 16);
globalThis.cancelAnimationFrame = id => clearTimeout(id);

// Network: fetch parks a request for the app; the app answers with __answer(id, status, headers, body).
let reqId = 0; const requests = new Map();
class Headers { constructor(h = {}) { this.h = {}; for (const [k, v] of Object.entries(h || {})) this.h[k.toLowerCase()] = String(v); } get(k) { return this.h[String(k).toLowerCase()] ?? null; } has(k) { return String(k).toLowerCase() in this.h; } }
globalThis.Headers = Headers;
globalThis.fetch = (url, opts = {}) => new Promise((resolve, reject) => {
  const id = ++reqId, signal = opts.signal;
  if (signal?.aborted) return reject(Object.assign(new Error('aborted'), {name: 'AbortError'}));
  const headers = opts.headers instanceof Headers ? opts.headers.h : (opts.headers || {});
  requests.set(id, {url: String(url), method: opts.method || 'GET', headers, body: typeof opts.body === 'string' ? opts.body : null, resolve, reject, sent: false});
  signal?.addEventListener?.('abort', () => { if (requests.delete(id)) reject(Object.assign(new Error('aborted'), {name: 'AbortError'})); });
});
class AbortSignal { constructor() { this.aborted = false; this.reason = undefined; this._l = []; } addEventListener(t, f) { if (t === 'abort') this._l.push(f); } removeEventListener(t, f) { this._l = this._l.filter(x => x !== f); } throwIfAborted() { if (this.aborted) throw this.reason; } }
class AbortController { constructor() { this.signal = new AbortSignal(); } abort(reason) { const s = this.signal; if (s.aborted) return; s.aborted = true; s.reason = reason ?? Object.assign(new Error('aborted'), {name: 'AbortError'}); s._l.slice().forEach(f => { try { f({type: 'abort'}); } catch {} }); } }
AbortSignal.timeout = ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
// AbortSignal.any: one signal that aborts when the first of [signals] does (mtg-wiki-client.js joins its timeout to the caller's).
AbortSignal.any = signals => { const c = new AbortController(); for (const s of signals) { if (s.aborted) { c.abort(s.reason); break; } s.addEventListener('abort', () => c.abort(s.reason)); } return c.signal; };
globalThis.AbortController = AbortController; globalThis.AbortSignal = AbortSignal;
globalThis.DOMException = class DOMException extends Error { constructor(message = '', name = 'Error') { super(message); this.name = name; } };

// The rest of what the web modules touch.
globalThis.structuredClone = v => clone(v, new Map());
function clone(v, seen) {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v);
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof Map) { const m = new Map(); seen.set(v, m); v.forEach((x, k) => m.set(clone(k, seen), clone(x, seen))); return m; }
  if (v instanceof Set) { const s = new Set(); seen.set(v, s); v.forEach(x => s.add(clone(x, seen))); return s; }
  if (Array.isArray(v)) { const a = []; seen.set(v, a); v.forEach((x, i) => { a[i] = clone(x, seen); }); return a; }
  const o = {}; seen.set(v, o); for (const k of Object.keys(v)) o[k] = clone(v[k], seen); return o;
}
const store = new Map();
globalThis.localStorage = globalThis.sessionStorage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear(), key: i => [...store.keys()][i] ?? null, get length() { return store.size; }};
globalThis.performance = globalThis.performance || {now: () => Date.now()};
// crypto.getRandomValues: seeded from the app (__seed) so a build can be replayed; otherwise the app passes a random seed.
let rng = 0x9e3779b9;
const next = () => { rng |= 0; rng = (rng + 0x6D2B79F5) | 0; let t = Math.imul(rng ^ (rng >>> 15), 1 | rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0); };
globalThis.crypto = {getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = next() % (a.BYTES_PER_ELEMENT === 1 ? 256 : a.BYTES_PER_ELEMENT === 2 ? 65536 : 4294967296); return a; }, randomUUID: () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (next() % 16).toString(16))};
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.location = {href: 'https://cardstashy.com/', origin: 'https://cardstashy.com', pathname: '/', hash: '', search: '', host: 'cardstashy.com', hostname: 'cardstashy.com', protocol: 'https:'};
globalThis.navigator = {userAgent: 'CardStashy native', onLine: true, maxTouchPoints: 1};

// A body as UTF-8 bytes (Response.arrayBuffer; the app hands bodies over as text, a gzip file already unpacked).
const utf8Bytes = t => {
  t = String(t); const out = new Uint8Array(t.length * 3); let n = 0;
  for (let i = 0; i < t.length; i++) {
    let c = t.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < t.length) { const d = t.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
    if (c < 0x80) out[n++] = c; else if (c < 0x800) { out[n++] = 0xc0 | c >> 6; out[n++] = 0x80 | c & 63; }
    else if (c < 0x10000) { out[n++] = 0xe0 | c >> 12; out[n++] = 0x80 | c >> 6 & 63; out[n++] = 0x80 | c & 63; }
    else { out[n++] = 0xf0 | c >> 18; out[n++] = 0x80 | c >> 12 & 63; out[n++] = 0x80 | c >> 6 & 63; out[n++] = 0x80 | c & 63; }
  }
  return out.slice(0, n);
};
globalThis.__utf8Bytes = utf8Bytes;

// The app's side of the loop.
globalThis.__host = {
  seed(n) { rng = n | 0; },
  // Runs every queued job; then fires due timers; returns {jobs, requests:[...], nextTimer}.
  pump(now) {
    let ran = 0;
    for (;;) {
      while (jobs.length) { const f = jobs.shift(); ran++; try { f(); } catch (e) { globalThis.__lastError = String(e && e.stack || e); } }
      let fired = false;
      for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (t.at <= now) { timers.delete(id); fired = true; try { t.f(); } catch (e) { globalThis.__lastError = String(e && e.stack || e); } }
      if (!fired && !jobs.length) break;
    }
    const out = [];
    for (const [id, r] of requests) if (!r.sent) { r.sent = true; out.push({id, url: r.url, method: r.method, headers: r.headers, body: r.body}); }
    let nextTimer = null; for (const t of timers.values()) nextTimer = nextTimer === null ? t.at : Math.min(nextTimer, t.at);
    return JSON.stringify({ran, requests: out, nextTimer, open: requests.size});
  },
  answer(id, status, headersJson, body) {
    const r = requests.get(id); if (!r) return; requests.delete(id);
    if (status < 0) return r.reject(new TypeError('Failed to fetch'));
    const headers = new Headers(JSON.parse(headersJson || '{}'));
    r.resolve({ok: status >= 200 && status < 300, status, headers, url: r.url, json: () => Promise.resolve().then(() => JSON.parse(body)), text: () => Promise.resolve(body), arrayBuffer: () => Promise.resolve().then(() => utf8Bytes(body).buffer), clone() { return this; }});
  },
};

// Builtins newer than this QuickJS (ES2021+), as the spec defines them.
const def = (o, k, v) => { if (!(k in o)) Object.defineProperty(o, k, {value: v, writable: true, configurable: true}); };
def(Object, 'hasOwn', (o, k) => Object.prototype.hasOwnProperty.call(Object(o), k));
def(Object, 'groupBy', (items, f) => { const out = Object.create(null); let i = 0; for (const x of items) { const k = f(x, i++); (out[k] ||= []).push(x); } return out; });
def(Map, 'groupBy', (items, f) => { const out = new Map(); let i = 0; for (const x of items) { const k = f(x, i++); if (!out.has(k)) out.set(k, []); out.get(k).push(x); } return out; });
const at = function (n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this[n]; };
def(Array.prototype, 'at', at); def(String.prototype, 'at', at);
def(Array.prototype, 'findLast', function (f, t) { for (let i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return this[i]; });
def(Array.prototype, 'findLastIndex', function (f, t) { for (let i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return i; return -1; });
def(Array.prototype, 'toSorted', function (f) { return this.slice().sort(f); });
def(Array.prototype, 'toReversed', function () { return this.slice().reverse(); });
def(Array.prototype, 'toSpliced', function (...a) { const c = this.slice(); c.splice(...a); return c; });
def(Array.prototype, 'with', function (i, v) { const c = this.slice(); c[i < 0 ? c.length + i : i] = v; return c; });
def(String.prototype, 'replaceAll', function (s, r) { return s instanceof RegExp ? this.replace(s, r) : this.split(s).join(typeof r === 'function' ? r(s) : r); });
def(Array.prototype, 'flat', function (d = 1) { return d < 1 ? this.slice() : this.reduce((a, x) => a.concat(Array.isArray(x) ? x.flat(d - 1) : [x]), []); });
def(Array.prototype, 'flatMap', function (f, t) { return this.map(f, t).flat(1); });
def(Object, 'fromEntries', it => { const o = {}; for (const [k, v] of it) o[k] = v; return o; });
def(String.prototype, 'trimStart', String.prototype.trimLeft); def(String.prototype, 'trimEnd', String.prototype.trimRight);
def(globalThis, 'globalThis', globalThis);
