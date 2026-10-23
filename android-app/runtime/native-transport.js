import { NATIVE_ORIGIN, SERVICE_ORIGIN, resolveServiceURL, planServiceRequest } from './native-service-policy.js';

// A JS routing adapter, never a native HTTP proxy. Browser CORS and server auth
// remain in force. The APK's INTERNET permission and CSP are independent gates.
const fail = message => { throw new TypeError(message); };
const rawURL = input => input instanceof Request ? input.url : String(input);
const parse = input => {
  const raw = rawURL(input);
  if (/^[\s]|[\s]$|[\\\u0000-\u001f\u007f]/.test(raw) || raw.startsWith('//')) fail('Ambiguous URL');
  const url = new URL(raw, NATIVE_ORIGIN + '/');
  if (url.username || url.password) fail('URL credentials are forbidden');
  return url;
};

export function createNativeFetch({ enabled = false, fetcher = globalThis.fetch.bind(globalThis) } = {}) {
  return async (input, init) => {
    const url = parse(input);
    const plan = planServiceRequest(input, init);
    const remote = plan.kind === 'service' || (url.protocol === 'https:' && url.origin !== NATIVE_ORIGIN);
    if (remote && !enabled) fail('Online services are disabled in this integration build.');
    if (!['https:', 'blob:', 'data:'].includes(url.protocol)) fail('Insecure or unsupported fetch URL');
    // Card art stays at the app's own /img/ paths, served from the phone's art cache (CardStashyWebViewClient).
    if (plan.kind === 'service' && plan.route.image) return fetcher(appImageURL(plan.route), { credentials: 'omit', signal: init?.signal });
    if (plan.kind === 'service') return fetcher(plan.request);
    // Provider-specific public keys/headers already supplied by shared code are
    // preserved. No session, bearer, cookie, or Origin is added by this adapter.
    return fetcher(input, init);
  };
}

// Same path and query as the website's https://cardstashy.com/img/... URL, at the app's own origin.
const appImageURL = route => NATIVE_ORIGIN + route.url.slice(SERVICE_ORIGIN.length);

export function resolveNativeImage(input, { enabled = false } = {}) {
  if (input === '') return '';
  const url = parse(input), route = resolveServiceURL(input);
  if (route.kind === 'service') {
    if (!route.image) fail('API responses are not image sources');
    return enabled ? appImageURL(route) : '';
  }
  if (url.protocol === 'https:') return url.origin === NATIVE_ORIGIN || enabled ? String(input) : '';
  if (url.protocol === 'blob:' && url.origin === NATIVE_ORIGIN) return String(input);
  if (url.protocol === 'data:' && /^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml)(?:;|,)/i.test(String(input))) return String(input);
  fail('Unsupported image URL');
}

const CREDENTIAL_KEY = /^(?:access_token|refresh_token|id_token|authorization|apikey|api_key|token|code)$/i;
// Inspect every key, not just its first value; reject malformed encodings instead
// of URLSearchParams' replacement-character recovery. Decode separators too so
// fragment-router query syntax cannot hide credentials from the browser opener.
function safeExternalParameters(raw) {
  let decoded;
  try { decoded = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { return false; }
  if (/[\\\u0000-\u001f\u007f\ufffd]/.test(decoded)) return false;
  for (const field of decoded.split(/[&?;#]/)) {
    let key = field.split('=', 1)[0].trim();
    // Nested encoded key names are ambiguous. Inspect a bounded number of
    // layers, then fail closed rather than handing them to another URL parser.
    for (let depth = 0; key.includes('%') && depth < 4; depth++) {
      try { key = decodeURIComponent(key).trim(); } catch { return false; }
    }
    if (key.includes('%') || /[&?;#=]/.test(key) || /[\\\u0000-\u001f\u007f\ufffd]/.test(key) || CREDENTIAL_KEY.test(key)) return false;
  }
  return true;
}

export function resolveExternalURL(input) {
  const url = parse(input);
  if (url.protocol !== 'https:' || url.origin === NATIVE_ORIGIN) fail('Not a secure external URL');
  if (!safeExternalParameters(url.search.slice(1)) || !safeExternalParameters(url.hash.slice(1))) fail('Authentication data or malformed parameters are not an external link');
  return url.href;
}

// Install before importing the shared app. Returns cleanup for tests/reloads.
// HTML is parsed in a TEMPLATE (inert content) before any image can be inserted.
// MutationObserver covers DOM fragment insertion; direct src/srcset and attribute
// setters cover assignments before connection. CSS image URLs are a build/CSP
// inventory responsibility, not rewritten with an unsafe arbitrary text replace.
export function installNativeTransport({ enabled = false, realm = globalThis, openExternal, onError = () => {} } = {}) {
  if (realm.location.origin !== NATIVE_ORIGIN) fail('Unexpected native origin');
  const undo = [];
  const previousFetch = realm.fetch;
  realm.fetch = createNativeFetch({ enabled, fetcher: previousFetch.bind(realm) });
  undo.push(() => { realm.fetch = previousFetch; });
  const image = value => { try { return resolveNativeImage(String(value), { enabled }); } catch { return ''; } };
  const srcset = value => {
    // Single data-URI images are retained intact; ambiguous mixed data srcsets
    // fail closed. Shared 3.91.3 does not generate srcsets.
    if (/^\s*data:/i.test(value)) return /^data:image\/[^\s]+(?:\s+(?:\d+w|[\d.]+x))?$/i.test(value) ? value : '';
    return String(value).split(',').map(candidate => {
      const parts = candidate.trim().split(/\s+/), resolved = image(parts.shift() || '');
      return resolved ? [resolved, ...parts].join(' ') : '';
    }).filter(Boolean).join(', ');
  };
  const ElementProto = realm.Element.prototype;
  const originalSetAttribute = ElementProto.setAttribute;
  const patch = (proto, name, descriptor) => {
    const old = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, { ...old, ...descriptor });
    undo.push(() => Object.defineProperty(proto, name, old));
  };
  const isImage = el => ['IMG', 'SOURCE'].includes(el.tagName);
  // Card art from https://cardstashy.com/img/ is requested with CORS (the server answers this exact
  // origin), so foils, name masks and pack trimming can read its pixels as they do on the web.
  patch(ElementProto, 'setAttribute', { value: function(name, value) {
    const key = String(name).toLowerCase();
    if (isImage(this) && key === 'src') value = image(value);
    if (isImage(this) && key === 'srcset') value = srcset(String(value));
    return originalSetAttribute.call(this, name, value);
  } });
  for (const ctor of [realm.HTMLImageElement, realm.HTMLSourceElement].filter(Boolean)) {
    for (const key of ['src', 'srcset']) {
      const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, key);
      if (!descriptor?.set) continue;
      patch(ctor.prototype, key, { set(value) { descriptor.set.call(this, key === 'src' ? image(value) : srcset(String(value))); } });
    }
  }
  const normalize = root => {
    const elements = [...(isImage(root) ? [root] : []), ...root.querySelectorAll('img,source')];
    for (const el of elements) for (const name of ['src', 'srcset']) if (el.hasAttribute(name)) {
      const old = el.getAttribute(name), value = name === 'src' ? image(old) : srcset(old);
      if (value !== old) originalSetAttribute.call(el, name, value);
    }
  };
  const inner = Object.getOwnPropertyDescriptor(ElementProto, 'innerHTML');
  const rewriteHTML = html => {
    if (!/<(?:img|source)\b/i.test(String(html))) return html;
    const template = realm.document.createElement('template');
    inner.set.call(template, html); normalize(template.content);
    return inner.get.call(template);
  };
  patch(ElementProto, 'innerHTML', { set(html) { inner.set.call(this, rewriteHTML(html)); } });
  const outer = Object.getOwnPropertyDescriptor(ElementProto, 'outerHTML');
  patch(ElementProto, 'outerHTML', { set(html) { outer.set.call(this, rewriteHTML(html)); } });
  const insert = ElementProto.insertAdjacentHTML;
  patch(ElementProto, 'insertAdjacentHTML', { value(position, html) { return insert.call(this, position, rewriteHTML(html)); } });
  const observer = new realm.MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) normalize(node); });
  observer.observe(realm.document.documentElement, { childList: true, subtree: true });
  undo.push(() => observer.disconnect());
  normalize(realm.document);

  const open = async value => {
    try {
      if (!enabled) fail('External browsing is disabled in this integration build.');
      const url = resolveExternalURL(value);
      if (typeof openExternal !== 'function') fail('System browser bridge unavailable');
      await openExternal({ url });
    } catch { onError('The link could not be opened in the system browser.'); }
  };
  const previousOpen = realm.open;
  realm.open = (url = '') => { if (url && url !== 'about:blank') void open(url); return null; };
  undo.push(() => { realm.open = previousOpen; });
  const click = event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const raw = anchor.getAttribute('href');
    let url;
    try { url = parse(raw); } catch { event.preventDefault(); return; }
    // Existing native file adapter owns download links and blob artifacts.
    if (anchor.hasAttribute('download') && (url.protocol === 'blob:' || url.origin === NATIVE_ORIGIN)) return;
    if (url.origin === NATIVE_ORIGIN && url.protocol === 'https:') return;
    event.preventDefault(); event.stopImmediatePropagation(); void open(raw);
  };
  realm.document.addEventListener('click', click, true);
  undo.push(() => realm.document.removeEventListener('click', click, true));
  return () => { for (const restore of undo.reverse()) restore(); };
}
