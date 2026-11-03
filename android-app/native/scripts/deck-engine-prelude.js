// QuickJS has no browser globals: the few the web modules touch at load time, inert.
if (typeof globalThis.URL === 'undefined') globalThis.URL = class URL { constructor(u, b) { this.href = String(b && !/^[a-z]+:/i.test(u) ? String(b).replace(/[^/]*$/, '') + u : u); } toString() { return this.href; } };
if (typeof globalThis.URLSearchParams === 'undefined') globalThis.URLSearchParams = class URLSearchParams { constructor(o = {}) { this.o = o; } toString() { return Object.entries(this.o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'); } };
// Intl: only value-history.js's cents formatter touches it at load (prices never reach Play).
if (typeof globalThis.Intl === 'undefined') globalThis.Intl = {NumberFormat: class NumberFormat { constructor(l, o = {}) { this.o = o; } format(n) { const d = this.o.maximumFractionDigits ?? 2; return Number(n).toFixed(d); } }};
