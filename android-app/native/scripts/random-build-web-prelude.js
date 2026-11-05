// The random deck builder as the app's WebView runs it (assets/random-build-web.js, RandomBuild.kt): Chrome's own engine, so the
// web modules run as they do on the site, with real promises, timers and fetch. Only storage differs: the WebView shares
// cardstashy.com's storage with the in-app site, so the builder keeps its caches in memory, as the QuickJS bundle does.
const store = new Map();
const memory = {
  getItem: k => store.has(String(k)) ? store.get(String(k)) : null,
  setItem: (k, v) => { store.set(String(k), String(v)); },
  removeItem: k => { store.delete(String(k)); },
  clear: () => { store.clear(); },
  key: i => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
export {memory as localStorage, memory as sessionStorage};
