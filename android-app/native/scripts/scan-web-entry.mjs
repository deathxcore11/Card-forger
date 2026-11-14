// The Scanner's engine: the site's scanner (scancam.js registerScanner / scanView, with app.js's scanCtx below) in a hidden WebView,
// whose canvas, images and text reader (vendor tesseract.js with its engine and English data, all from the app's own files) are the
// browser's own. The app draws the page from its markup (ScanWeb.model: the same tree the Collection engine gives SitePanel), taps
// and types into it (ScanWeb.tap / type), and feeds the phone's camera in (ScanWeb.frame): the "video" scancam draws from is a canvas
// each camera frame is painted on. What writes to the collection (adding a batch, a binder for it) goes to the app, which runs it in
// the Collection engine (app.js mtgScanAddMany / tcg.js c.scanAddMany there), as do a card's page and toasts.
import {S, cacheCard, inv} from 'WEB/store.js';
import {scanView, registerScanner} from 'WEB/scancam.js';
import * as T from 'WEB/tcg.js';
import {createScannerPrintingPicker} from 'WEB/scanner-printing.js';
import {createScryfallClient} from 'WEB/scryfall-client.js';
import {conditionValue} from 'WEB/condition-value.js';
import {mtgCollector, nameCandidates, textPhrases} from 'WEB/scan.js';
import {createScannerLookup} from 'WEB/scanner-lookup.js';
import {configureAiAuth} from 'WEB/ai-auth.js';
import {setAccountScope} from 'WEB/account-scope.js';
import {cardKey} from 'WEB/core.js';
import {tree, one, tagIs, icon, svgIn, picture} from './site-json.mjs';

const api = createScryfallClient();
const key = cardKey;
const {registerTcg, SOURCES: tcgSources} = T;
const native = globalThis.NativeScan || {model() {}, toast() {}, acted() {}, call() {}, torch() {}};

// ---- app.js "Scan" (7329–7440), verbatim: Magic's matching for the scanner. (mtgScanAdd / mtgScanAddMany write the collection, so
// they run in the Collection engine: scanCtx.add / addMany go to the app.)
// Matching for the scanner (Magic). The scanner itself lives in scancam.js and is shared by all games.
const mtgScanCand = (c, why, exact) => {
  cacheCard(c);
  return { id: c.id, name: c.name, image: c.image_uris?.normal || c.card_faces?.[0]?.image_uris?.normal || "", sub: `${c.set_name} · ${c.set.toUpperCase()} #${c.collector_number}`, why, exact, owned: inv(c.name).owned, card: c };
};
// Every paper printing of a scanned card, with a small picture for matching the artwork.
async function mtgScanPrintings(cand) {
  const oid = cand.card?.oracle_id;
  if (!oid) return [];
  const r = await api("/cards/search?" + new URLSearchParams({ q: `oracleid:${oid} game:paper`, unique: "prints", order: "released", dir: "desc" })).catch(() => null);
  return (r?.data || [])
    .map((c) => ({ id: c.id, thumb: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || "", card: c }))
    .filter((p) => p.thumb);
}
// No readable name: find the card from phrases of its rules or flavour text. A phrase that
// matches only a few cards is a strong hint; names hinted by several phrases come first.
async function mtgScanByText(phrases, full = "") {
  const ps = [...new Set(phrases.map((x) => x.replace(/["’]/g, "").trim()).filter(Boolean))];
  if (!ps.length) return [];
  // One search for every phrase at once; each card is then scored by the phrases its own text
  // contains, rare phrases counting most (a misread phrase simply matches nothing).
  const r = await api("/cards/search?" + new URLSearchParams({ q: `game:paper (${ps.map((x) => `o:"${x}" or ft:"${x}"`).join(" or ")})`, unique: "cards" })).catch(() => null);
  if (!r?.data?.length || r.total_cards > 175) return [];
  const text = (c) => [c.oracle_text, c.flavor_text, ...(c.card_faces || []).flatMap((f) => [f.oracle_text, f.flavor_text])].filter(Boolean).join(" ").toLowerCase().replace(/[’']/g, ""),
    texts = r.data.map((c) => [c.name, text(c)]),
    df = Object.fromEntries(ps.map((x) => [x, texts.filter(([, t]) => t.includes(x.toLowerCase())).length])),
    // A card usually names itself in its text ("Lightning Bolt deals 3 damage"): those first.
    said = (n) => n.split(" // ").some((f) => f.length > 3 && scanKey(full).includes(scanKey(f)));
  return texts
    .map(([n, t]) => [n, ps.reduce((sc, x) => sc + (t.includes(x.toLowerCase()) ? 1 / df[x] : 0), 0)])
    .filter(([, sc]) => sc > 0)
    .sort((x, y) => said(y[0]) - said(x[0]) || y[1] - x[1])
    .map((x) => x[0])
    .slice(0, 5);
}
const scanKey = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
async function mtgScanMatch(read, lang, manual = false, prefs = {}, control = null) {
  const lookup=(key,fn)=>Promise.resolve().then(()=>control?control.run(JSON.stringify(["mtg",...key]),fn):fn()).catch(e=>{if(control&&/^SCAN_/.test(e.code||""))throw e;return null;});
  const out = [],
    seen = new Set(),
    tried = [],
    push = (c, why, exact) => {
      if (!c?.name || seen.has(c.id) || out.length >= 3) return;
      seen.add(c.id);
      out.push(mtgScanCand(c, why, exact));
    };
  let limited=false;
  try {
  // The set code + collector number at the bottom identify the exact printing.
  const at = manual ? null : mtgCollector(`${read.code}\n${read.full}`);
  if (at) {
    tried.push(`${at.set.toUpperCase()} #${at.number}`);
    for (const l of lang.includes("jpn") ? ["ja", ""] : [""]) {
      const c = await lookup(["printing",at.set,at.number,l],()=>api(`/cards/${encodeURIComponent(at.set)}/${encodeURIComponent(at.number)}${l ? "/" + l : ""}`));
      if (c?.name) {
        push(c, `Set ${at.set.toUpperCase()} #${at.number}`, true);
        break;
      }
    }
  }
  // Then plausible names from the name strip, one at a time (never the whole noisy string).
  for (const n of manual ? [read.name] : nameCandidates("mtg", read.name || read.full)) {
    if (out.length >= 3) break;
    // A piece of a name already found ("Elves" after Llanowar Elves) would only add noise.
    if (out.some((o) => key(o.name).includes(key(n)))) continue;
    tried.push(n);
    // Lock set: look the name up in that set first.
    const locked = prefs.lockSet ? await lookup(["name",n,prefs.lockSet],()=>api("/cards/named?" + new URLSearchParams({ fuzzy: n, set: prefs.lockSet }))) : null;
    let c = locked || (await lookup(["name",n],()=>api("/cards/named?" + new URLSearchParams({ fuzzy: n }))));
    // Ignore promos: prefer the regular printing of the same card.
    if (c && prefs.ignorePromos && (c.promo || c.set_type === "promo")) {
      const r = await lookup(["regular",c.name],()=>api("/cards/search?" + new URLSearchParams({ q: `!"${c.name}" -is:promo -st:promo`, order: "released", dir: "desc" })));
      if (r?.data?.[0]) c = r.data[0];
    }
    // A short fragment ("wel") is not identification: closest-spelling hits need a real word.
    if (c?.name && (key(c.name) === key(n) || manual || key(n).length >= 5)) push(c, key(c.name) === key(n) ? "Name match" : `Closest name to “${n}”`, false);
  }
  }catch(e){if(!control||e.code!=="SCAN_BUDGET"||!out.length)throw e;limited=true;}
  return { cands: limited?out.map(c=>({...c,exact:false})):out, tried,...(limited?{budgetLimited:true}:{}) };
}
const mtgScanPrice = (cand, finish, selection = {}) => {
  const card=cand.card,p=card?.prices||{},v=finish==="foil"?p.usd_foil:finish==="etched"?p.usd_etched:p.usd;
  return conditionValue(v==null||v===""?null:Number(v),{...selection,printingId:card?.id||"",finish},card?.conditionQuotes||[]).price;
};

// ---- The app's side: calls that answer later (the Collection engine's writes) wait on ScanWeb.answer.
let calls = 0;
const waiting = new Map();
function ask(name, args) {
  const id = ++calls;
  return new Promise((ok, bad) => { waiting.set(id, {ok, bad}); native.call(id, name, JSON.stringify(args ?? null)); });
}

// ---- The page: a host for scanView, and index.html's #sheet after it.
let host = null, G = 'mtg';
const NAMES = {mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!'};
const toast = m => { if (m) native.toast(String(m)); };
const acted = (act, data = {}) => native.acted(JSON.stringify({act, data}));

// tcg.js's handlers and loaders for Yu-Gi-Oh! / Pokémon matching (c.scanMatch …): no page of its own here, no writes.
const TA = {}, TC = {}, TI = {}, tcgCtx = {A: TA, C: TC, I: TI, commit: async () => false, render() {}, openSheet() {}, closeSheet() {}, refreshSheet() {}, toast,
  download() {}, copyText() {}, busy: () => () => {}, go() {}, rerenderKeepingFocus() {}, writeRecord: async () => {}, navigationStamp: () => null, navigationCurrent: () => true};

// app.js scannerPrintingPicker (7444), verbatim but for openPicker: scancam opens it inline (inlinePrinting, config.openInline: the
// review's own printing browser), so printing-picker.js's sheet is never asked for.
const scannerPrintingPicker = createScannerPrintingPicker({
  openPicker: () => { throw Error('Printing choices are unavailable. Try again later.'); }, requestMagic: api, sources: T.SOURCES,
  ensureCard: (g,id) => T.ensureCard(g,id,false,false),
  getCatalogue: g => g === "mtg" ? [] : g === "ygo" ? T.currentYgoCatalogue() : T.ui(g).sets.list,
  loadCatalogue: async g => { await tcgCtx.loadSets(g); return g === "ygo" ? T.currentYgoCatalogue() : T.ui(g).sets.list; },
  projectCard: (g,c,r,catalogue,options) => T.setContextCard(g,c,r,catalogue,options)
});
const A = {}, C = {}, I = {};
const scanCtx = {
  A,
  C,
  I,
  openSheet: (html, c = null) => {
    S.ui.sheetCtx = c;
    let d = document.getElementById('sheet');
    if (!d) { d = document.createElement('dialog'); d.id = 'sheet'; d.className = 'sheet'; d.setAttribute('aria-label', 'Details'); d.innerHTML = '<div id="sheetBody" data-audit-scroll></div>'; document.body.append(d); }
    d.setAttribute('open', ''); document.getElementById('sheetBody').innerHTML = html;
  },
  closeSheet: () => { S.ui.sheetCtx = null; document.getElementById('sheet')?.remove(); },
  addMany: (g, items) => ask('addMany', {game: g, items}),
  priceOf: (g, cand, finish, selection = {}) => (g === "mtg" ? mtgScanPrice(cand, finish, selection) : tcgCtx.scanPrice?.(cand, finish, selection) ?? null),
  // app.js fetchConditionValue (the condition feed) runs in the Collection engine; its answer comes back here.
  requestConditionPrice: (g,cand,finish,selection,done,current,options={}) => {
    const card=cand.card;
    if(!card||!finish||cand.localReference||cand.detailsOnly||!(cand.exact||cand.printingConfirmed))return {status:'deferred',reason:'unverified-selection',notice:'Confirm the exact printing before checking its condition price.'};
    const [printing,rarity]=String(cand.print||'').split('|');
    const entry=g==='mtg'?{...selection,printingId:card.id,printingVerified:true,finish}:
      {...selection,cardId:card.id,...(g==='ptcg'?{variant:finish}:{printing:printing||'',rarity:rarity||'',edition:finish,setReleaseId:cand.setReleaseId||'',setReleaseUnverified:!!cand.setReleaseUnverified})};
    return ask('conditionPrice', {card, entry, game: g, retry: !!options.retry}).then(r => { if (r?.quotes && current?.() !== false) card.conditionQuotes = r.quotes; done?.(r); return r; }, () => ({status: 'deferred', reason: 'unavailable'}));
  },
  openPrintingPicker: config => scannerPrintingPicker.open(config),
  inlinePrinting: true,
  setOf: (g, cand) => (g === "mtg" ? cand.card?.set || "" : g === "ygo" ? String(cand.print || "").split("|")[0].split("-")[0] : cand.card?.set?.id || ""),
  numberOf: (g, cand) => (g === "mtg" ? cand.card?.collector_number || "" : g === "ygo" ? String(cand.print || "").split("|")[0] : cand.card?.set?.number || ""),
  render: () => render(),
  toast,
  game: () => G,
  match: (g, read, lang, manual, status, prefs = {}, control = null) => (g === "mtg" ? mtgScanMatch(read, lang, manual, prefs, control) : tcgCtx.scanMatch(read, lang, manual, status, g, control)),
  add: (g, c) => ask('addMany', {game: g, items: [{cand: c, qty: 1, finish: 'nonfoil', condition: 'Near Mint', lang: c.card?.lang || 'en', single: true}]}),
  byText: (g, full) => (g === "mtg" ? mtgScanByText(textPhrases(full, 12), full) : tcgCtx.scanByText?.(g, full) ?? []),
  printings: (g, cand) => (g === "mtg" ? mtgScanPrintings(cand) : tcgCtx.scanPrintings?.(g, cand) ?? []),
  candById: async (g, id, why, exact, options = {}) => (g === "mtg" ? api("/cards/" + encodeURIComponent(id), {signal:options.signal}).then((c) => mtgScanCand(c, why, exact)).catch(() => null) : tcgCtx.scanCandById?.(g, id, why, exact, options) ?? null),
  candOf: async (g, p, why, exact) => (g === "mtg" ? (p.card ? mtgScanCand(p.card, why, exact) : null) : tcgCtx.scanCandById?.(g, p.id, why, exact) ?? null),
  details: (g, c) => acted(g === "mtg" ? 'card' : 'tCard', g === "mtg" ? {name: c.name} : {id: c.id, game: g}),
};
let account = '';
scanCtx.rememberLocation = (g, name, {createBinder = false} = {}) => ask('rememberLocation', {game: g, name, createBinder});
scanCtx.lookupCandidates = createScannerLookup({requestMagic: api, sources: tcgSources, candById: scanCtx.candById, match: scanCtx.match});

function render() {
  if (!host) return;
  host.innerHTML = scanView(G, NAMES[G]);
  setTimeout(() => scanCtx.afterRender?.(), 0);
}

// ---- The camera: getUserMedia gives a stream whose one track is the phone's camera; the <video> scancam makes is a canvas each
// frame is painted on (videoWidth / videoHeight: the frame's; clientWidth / clientHeight: the preview's on the phone).
let preview = {w: 390, h: 640}, hasCamera = true, torchCap = false, frameCanvas = null, painting = false, pending = null;
const track = {kind: 'video', stop() { native.torch(false); }, getCapabilities: () => ({torch: torchCap, focusMode: ['continuous']}), getSettings: () => ({}),
  applyConstraints: c => { const t = c?.advanced?.find(x => 'torch' in x); if (t) native.torch(!!t.torch); return Promise.resolve(); }};
const stream = {getTracks: () => [track], getVideoTracks: () => [track], active: true};
const media = {getUserMedia: () => hasCamera ? Promise.resolve(stream) : Promise.reject(Object.assign(Error('No camera'), {name: 'NotFoundError'})),
  enumerateDevices: () => Promise.resolve([{kind: 'videoinput', deviceId: '', label: 'Back camera'}])};
try { Object.defineProperty(navigator, 'mediaDevices', {value: media, configurable: true}); } catch { navigator.mediaDevices = media; }
const makeElement = Document.prototype.createElement;
Document.prototype.createElement = function (tag, o) {
  if (String(tag).toLowerCase() !== 'video') return makeElement.call(this, tag, o);
  const c = frameCanvas = makeElement.call(this, 'canvas');
  c.width = 0; c.height = 0;
  Object.defineProperties(c, {
    videoWidth: {get: () => c.width}, videoHeight: {get: () => c.height},
    clientWidth: {get: () => preview.w}, clientHeight: {get: () => preview.h},
    srcObject: {value: null, writable: true}, paused: {value: false, writable: true}, readyState: {get: () => c.width ? 4 : 0},
  });
  c.play = () => Promise.resolve(); c.pause = () => {};
  return c;
};
async function paint(b64) {
  const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], {type: 'image/jpeg'}));
  const c = frameCanvas; if (!c) { bmp.close(); return; }
  if (c.width !== bmp.width || c.height !== bmp.height) { c.width = bmp.width; c.height = bmp.height; }
  c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
}

// ---- The page's markup for the app: the tree site-dom.mjs serialize gives the Collection engine (tag, id, attributes, children; a
// field's value; an svg as drawing items; an img's address and fallbacks), from the real DOM. Each node keeps its id while it lives.
const ids = new WeakMap(), nodes = new Map();
let nextId = 1;
const idOf = n => { let i = ids.get(n); if (!i) { i = nextId++; ids.set(n, i); nodes.set(i, new WeakRef(n)); } return i; };
function serialize(n) {
  if (n.nodeType === 3) return n.data;
  if (n.nodeType !== 1) return null;
  const t = n.localName, a = {};
  for (const at of n.attributes) a[at.name] = at.value;
  if (t === 'svg') return {t, i: idOf(n), a, k: [], icon: icon(svgIn(tree(n.outerHTML)))};
  if (t === 'canvas' || t === 'script' || t === 'style') return {t: 'div', i: idOf(n), a: {id: a.id || ''}, k: []};
  const k = [];
  for (const c of n.childNodes) { const s = serialize(c); if (s == null) continue; if (typeof s === 'string' && typeof k[k.length - 1] === 'string') k[k.length - 1] += s; else k.push(s); }
  const o = {t, i: idOf(n), a, k};
  if (t === 'input' || t === 'select' || t === 'textarea') o.v = n.type === 'checkbox' || n.type === 'radio' ? String(n.checked) : n.value;
  if (t === 'details') { if (n.open) a.open = ''; else delete a.open; }
  if (t === 'img') o.pic = picture(one(tree(n.outerHTML), tagIs('img')));
  return o;
}
const model = () => JSON.stringify({key: 'scan|' + G, body: serialize(document.body), reveal: null, acted: null, toasts: []});
let queued = false;
const push = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; native.model(model()); }, 30); };
new MutationObserver(push).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
const byId = id => nodes.get(id)?.deref() || null;

globalThis.ScanWeb = {
  // [o]: {game, state (the workspace: S.state), user (the profile's id, '' signed out), token (its access token, for the AI read),
  // camera (the phone has one), torch (it has a flashlight), preview {w, h}}.
  open(o) {
    const d = typeof o === 'string' ? JSON.parse(o) : o;
    if (d.state) S.state = {...S.state, ...d.state};
    account = d.user || ''; setAccountScope(account || null); configureAiAuth(async () => d.token || '');
    hasCamera = d.camera !== false; torchCap = !!d.torch; if (d.preview) preview = d.preview;
    G = d.game || 'mtg';
    (S.state.settings ||= {}).game = G;
    S.ui.view = 'scan';
    S.ui.scan ||= {mode: 'live', cands: []};
    if (!host) { host = document.createElement('div'); document.body.prepend(host); }
    render();
    return model();
  },
  // A tap as the browser makes one (pointerdown, then click: a label's reaches its control, a summary opens its details).
  tap(id) { const el = byId(id); if (!el) return false; el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true})); el.click(); return true; },
  type(id, value) {
    const el = byId(id); if (!el) return false;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = value === 'true'; else el.value = value;
    el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  },
  // Photos picked on the phone (gallery or its camera app) for a file input: [files] [{name, type, b64}].
  files(id, files) {
    const el = byId(id); if (!el) return false;
    const dt = new DataTransfer();
    for (const f of (typeof files === 'string' ? JSON.parse(files) : files)) dt.items.add(new File([Uint8Array.from(atob(f.b64), ch => ch.charCodeAt(0))], f.name || 'photo.jpg', {type: f.type || 'image/jpeg'}));
    el.files = dt.files; el.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  },
  // A camera frame (JPEG, base64): painted when the last one is done, the newest waiting (older ones dropped).
  frame(b64) { if (painting) { pending = b64; return; } painting = true; paint(b64).catch(() => {}).finally(() => { painting = false; if (pending) { const p = pending; pending = null; ScanWeb.frame(p); } }); },
  preview(w, h) { preview = {w, h}; },
  closeSheet() { scanCtx.closeSheet(); },
  // The workspace after the app saved from here (CollectionEngine.scanWorkspace): what the scanner shows as owned, its binders.
  workspace(json) { S.state = {...S.state, ...JSON.parse(json)}; },
  answer(id, ok, json) { const w = waiting.get(id); if (!w) return; waiting.delete(id); const v = json ? JSON.parse(json) : null; if (ok) w.ok(v); else w.bad(Error(v?.message || String(v || 'Failed'))); },
  // Leaving the page: the camera stops (scancam's own stop), the page stays for next time.
  close() { S.ui.view = 'home'; scanCtx.afterRender?.(); },
  model,
};

// app.js's event delegation (2671, 3229): a tap runs its data-act's handler (A), a control's change its data-change (C), typing its
// data-input (I); a handler's failure is a toast (app.js safely). Acts the scanner doesn't have here go to the app (acted).
const safely = r => { if (r?.catch) r.catch(e => toast(e?.message || String(e))); };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  if (t.tagName === 'A' && t.getAttribute('href')) return;
  const fn = A[t.dataset.act] || (t.dataset.act === 'closeSheet' ? () => scanCtx.closeSheet() : null);
  e.preventDefault();
  if (fn) { try { safely(fn(t, e)); } catch (err) { toast(err?.message || String(err)); } }
  else acted(t.dataset.act, {...t.dataset});
});
document.addEventListener('change', e => { const t = e.target.closest('[data-change]'); if (t && C[t.dataset.change]) safely(C[t.dataset.change](t, e)); });
document.addEventListener('input', e => { const t = e.target.closest('[data-input]'); if (t && I[t.dataset.input]) I[t.dataset.input](t, e); });

registerTcg(tcgCtx);
registerScanner(scanCtx);
native.ready?.();
