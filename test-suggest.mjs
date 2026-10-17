// Suggestions: names from each game's source, starting-with first; recent searches capped and deduped.
import assert from "node:assert/strict";
import { captureSearchFocus, restoreSearchFocus } from './catalog-tools.js';
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const { suggestNames, rememberSearch, recentSearches, attachSuggest } = await import("./suggest.js");
const fake = (body) => async () => ({ ok: true, json: async () => body });
assert.deepEqual(await suggestNames("mtg", "sol", fake({ data: ["Bolt of Sol", "Sol Ring", "Sol Ring // Sol Ring", "Solemn Offering"] })), ["Sol Ring", "Solemn Offering", "Bolt of Sol"]);
assert.deepEqual(await suggestNames("ygo", "dark mag", fake({ data: [{ name: "Dark Magician Girl" }, { name: "Dark Magician" }] })), ["Dark Magician", "Dark Magician Girl"]);
assert.deepEqual(await suggestNames("ptcg", "pika", fake([{ id: "a", name: "Pikachu" }, { id: "b", name: "Pikachu" }, { id: "A1-1", name: "Pikachu ex" }])), ["Pikachu"], "duplicates and Pocket cards dropped");
assert.deepEqual(await suggestNames("mtg", "s", fake({ data: ["x"] })), [], "one letter: nothing yet");
for (const q of ["Sol Ring", "Lightning Bolt", "sol ring", "t:angel", "Counterspell"]) rememberSearch("mtg", q);
assert.deepEqual(recentSearches("mtg"), ["Counterspell", "sol ring", "Lightning Bolt"], "newest first, no dupes, syntax queries skipped");
console.log("PASS: search suggestions and recent searches.");

// Event/geometry doubles only: no DOM renderer, browser, server or network.
class Element {
  constructor() { this.handlers = {}; this.attrs = {}; this.dataset = {}; this.style = {}; this.isConnected = true; this.children = []; this.value = ""; this.rect = { left: 30, bottom: 240, width: 595 }; }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, extra = {}) { for (const fn of this.handlers[type] || []) fn({ target: this, preventDefault() {}, ...extra }); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  getBoundingClientRect() { return this.rect; }
  closest() { return this.dataset.suggest ? this : null; }
  append(node) { this.children.push(node); node.parent = this; }
  contains(node) { return this === node || this.children.includes(node); }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); }
  querySelectorAll() { return this.options || []; }
  focus(options) { this.focusOptions = options; doc.activeElement = this; doc.emit('focusin', { target: this }); }
  setSelectionRange(start, end, direction) { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
  set innerHTML(html) {
    this.html = html;
    this.options = [...html.matchAll(/data-pick="([^"]+)"/g)].map(match => ({ dataset: { pick: match[1] }, on: false, classList: { toggle: (_, on) => { this.options.find(n => n.dataset.pick === match[1]).on = on; } } }));
  }
  get innerHTML() { return this.html; }
}
const doc = new Element(), win = new Element(), timers = new Map(), deferred = new Map(); let timerId = 0, requests = 0, releaseOld;
const saved = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
doc.body = new Element(); doc.documentElement = { clientWidth: 1024 }; doc.createElement = () => new Element();
win.scrollX = 0; win.scrollY = 0; win.innerWidth = 1024;
globalThis.document = doc; globalThis.window = win;
globalThis.setTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id; };
globalThis.clearTimeout = id => timers.delete(id);
globalThis.fetch = async url => {
  requests++;
  const u = new URL(url), q = u.searchParams.get('q') || u.searchParams.get('name') || u.searchParams.get('fname');
  const names = [q + ' first', q + ' second'];
  const body = u.hostname === 'api.tcgdex.net' ? names.map((name, i) => ({ id: 'fixture-' + i, name })) : u.hostname === 'db.ygoprodeck.com' ? { data: names.map(name => ({ name })) } : { data: names };
  if (q === 'Old async query') return new Promise(resolve => { releaseOld = () => resolve({ ok: true, json: async () => ({ data: ['Old async result'] }) }); });
  if (q.startsWith('Deferred ')) return new Promise(resolve => deferred.set(q, () => resolve({ ok: true, json: async () => body })));
  return { ok: true, json: async () => body };
};
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const flushTimers = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
const focus = async el => { doc.activeElement = el; doc.emit('focusin', { target: el }); await settle(); };
const popup = () => doc.body.children.find(n => n.id === 'suggestBox');
try {
  attachSuggest();
  const field = new Element(); field.dataset.suggest = 'mtg'; field.value = 'Fold query';
  await focus(field);
  const original = popup(), options = original.querySelectorAll();
  assert(original); assert.equal(requests, 1); assert.equal(original.style.width, '595px');
  doc.emit('keydown', { target: field, key: 'ArrowDown' });
  assert.equal(field.getAttribute('aria-activedescendant'), 'sg0'); assert(options[0].on);
  for (const [viewport, left, width, bottom] of [[320, 16, 288, 300], [768, 24, 540, 210], [844, 30, 595, 180], [1024, 30, 595, 240]]) {
    win.innerWidth = doc.documentElement.clientWidth = viewport; field.rect = { left, width, bottom }; win.emit('resize');
    assert.equal(popup(), original, 'fold keeps the same listbox'); assert.equal(original.querySelectorAll(), options, 'fold never rebuilds options');
    assert.equal(original.style.left, left + 'px'); assert.equal(original.style.width, width + 'px'); assert.equal(original.style.top, bottom + 6 + 'px');
    assert.equal(doc.activeElement, field); assert.equal(field.value, 'Fold query'); assert.equal(field.getAttribute('aria-activedescendant'), 'sg0'); assert(options[0].on);
  }
  win.innerWidth = doc.documentElement.clientWidth = 320; win.scrollX = 17; win.scrollY = 40;
  field.rect = { left: -20, width: 500, bottom: 190 }; win.emit('resize');
  assert.deepEqual(original.style, { left: '17px', top: '236px', width: '320px' }, 'oversize/negative input rect clamps within the viewport while retaining document offsets');
  field.rect = { left: 300, width: 80, bottom: 190 }; win.emit('resize');
  assert.equal(original.style.left, '257px', 'right edge clamps without overflowing the document');
  assert.equal(requests, 1, 'every resize reuses results without provider requests');

  doc.activeElement = null; doc.emit('focusout', { target: field });
  const next = new Element(); next.dataset.suggest = 'ptcg'; rememberSearch('ptcg', 'Pikachu recent');
  await focus(next); const nextBox = popup(); assert(nextBox);
  assert.equal(field.getAttribute('aria-expanded'), 'false'); assert.equal(field.getAttribute('aria-activedescendant'), null);
  flushTimers(); assert.equal(popup(), nextBox, 'old field blur cannot close a newer field popup');
  doc.activeElement = null; doc.emit('focusout', { target: next }); await focus(next); flushTimers();
  assert(popup(), 'blur/refocus of the same input does not close its fresh popup');
  next.isConnected = false; win.emit('resize'); assert.equal(popup(), undefined, 'detached input closes on resize');
  next.isConnected = true; await focus(next); doc.activeElement = null; win.emit('resize');
  assert.equal(popup(), undefined, 'unfocused input closes immediately on resize');
  await focus(next); doc.activeElement = null; doc.emit('focusout', { target: next }); flushTimers();
  assert.equal(popup(), undefined, 'ordinary blur still closes the popup');

  const old = new Element(); old.dataset.suggest = 'mtg'; old.value = 'Old async query'; await focus(old); assert(releaseOld);
  doc.activeElement = null; doc.emit('focusout', { target: old }); await focus(next); const fresh = popup();
  releaseOld(); await settle(); flushTimers(); assert.equal(popup(), fresh); assert.match(fresh.innerHTML, /Pikachu recent/); assert.doesNotMatch(fresh.innerHTML, /Old async result/);
  assert.equal(requests, 2, 'changing focus or resizing never duplicates a provider lookup');
  win.emit('scroll'); assert.equal(popup(), undefined, 'existing scroll-close behavior is retained');
  console.log('PASS: focused popup fold/rotation geometry, viewport clamping, stable options/query/selection, no duplicate requests, blur ownership/refocus, detached inputs and stale async results.');

  const searchField = (value, game = 'mtg', id = 'dbTerm') => {
    const el = new Element(); Object.assign(el, { tagName: 'INPUT', id, value, selectionStart: 2, selectionEnd: 5, selectionDirection: 'backward' });
    el.dataset = { suggest: game, input: 'dbTerm' }; return el;
  };
  const rootFor = el => ({ contains: n => n === el, querySelectorAll: () => [el] });
  const replace = (old, next = searchField(old.value, old.dataset.suggest, old.id), state = captureSearchFocus(rootFor(old), old)) => {
    old.isConnected = false; doc.activeElement = doc.body; doc.emit('focusout', { target: old });
    restoreSearchFocus(rootFor(next), state);
    assert.equal(Object.hasOwn(next, 'suggestFocusRestore'), false, 'synchronous restoration marker never leaks into later user events');
    assert.deepEqual(next.focusOptions, { preventScroll: true });
    assert.deepEqual([next.selectionStart, next.selectionEnd, next.selectionDirection], [state.start, state.end, state.direction]);
    return next;
  };
  let current = searchField('Open restoration'); await focus(current);
  doc.emit('keydown', { target: current, key: 'ArrowDown' });
  const openBox = popup(), openOptions = openBox.querySelectorAll(), beforeOpen = requests, oldInput = current;
  current = replace(current); await settle(); flushTimers();
  assert.equal(popup(), openBox); assert.equal(popup().querySelectorAll(), openOptions); assert.equal(requests, beforeOpen);
  assert.equal(current.getAttribute('aria-activedescendant'), 'sg0'); assert(openOptions[0].on);
  assert.equal(oldInput.getAttribute('aria-expanded'), 'false'); assert.equal(oldInput.getAttribute('aria-activedescendant'), null);
  assert.equal(current.getAttribute('aria-expanded'), 'true');

  // Exercise the actual helper, not a hand-written approximation of app focus.
  for (const key of ['Enter', 'Escape']) {
    current = searchField('Closed restoration ' + key); await focus(current);
    doc.emit('keydown', { target: current, key }); assert.equal(popup(), undefined);
    const before = requests;
    for (const phase of ['loading', 'result']) {
      current = replace(current); await settle(); flushTimers(); await settle();
      assert.equal(popup(), undefined, `${key}: ${phase} render cannot reopen dismissed suggestions`);
      assert.equal(requests, before, `${key}: ${phase} render does not refetch`);
    }
    doc.activeElement = doc.body; doc.emit('focusout', { target: current }); flushTimers();
    await focus(current); assert(popup(), `${key}: explicit user refocus still opens suggestions`);
    doc.emit('keydown', { target: current, key: 'Escape' });
    current.value = 'Typed after ' + key; doc.emit('input', { target: current, isTrusted: true }); flushTimers(); await settle();
    assert.match(popup().innerHTML, new RegExp('Typed after ' + key), 'restored field remains current for trusted typing');
    assert.equal(requests, before + 1);
  }

  current = searchField(''); await focus(current); doc.emit('keydown', { target: current, key: 'Escape' });
  const beforeDebounce = requests; current.value = 'Pending restoration'; doc.emit('input', { target: current, isTrusted: true });
  current = replace(current); await settle(); assert.equal(requests, beforeDebounce, 'render does not prematurely issue a pending debounce');
  flushTimers(); await settle(); assert.equal(requests, beforeDebounce + 1); assert.match(popup().innerHTML, /Pending restoration/);
  current.value = 'Cancelled pending restoration'; doc.emit('input', { target: current, isTrusted: true });
  doc.emit('keydown', { target: current, key: 'Enter' }); current = replace(current); flushTimers(); await settle();
  assert.equal(requests, beforeDebounce + 1, 'submission cancels queued typing even across render'); assert.equal(popup(), undefined);

  current = searchField('Deferred restored'); await focus(current); const beforeFlight = requests;
  current = replace(current); await settle(); assert.equal(requests, beforeFlight);
  deferred.get('Deferred restored')(); await settle(); assert.match(popup().innerHTML, /Deferred restored/);
  assert.equal(current.getAttribute('aria-expanded'), 'true', 'in-flight completion belongs to the replacement field without a duplicate request');
  current = searchField('Deferred cancelled'); await focus(current); current = replace(current);
  doc.emit('keydown', { target: current, key: 'Enter' }); deferred.get('Deferred cancelled')(); await settle(); assert.equal(popup(), undefined);
  current = searchField('Deferred escaped'); await focus(current); current = replace(current);
  doc.emit('keydown', { target: current, key: 'Escape' }); deferred.get('Deferred escaped')(); await settle(); assert.equal(popup(), undefined, 'Escape cancels in-flight work even before its popup exists');
  current = searchField('Deferred edited'); await focus(current); current = replace(current);
  const beforeEdited = requests; current.value = 'Edited during debounce'; doc.emit('input', { target: current, isTrusted: true });
  deferred.get('Deferred edited')(); await settle(); assert.equal(popup(), undefined, 'old query cannot paint during the next typing debounce'); assert.equal(requests, beforeEdited);
  flushTimers(); await settle(); assert.equal(requests, beforeEdited + 1); assert.match(popup().innerHTML, /Edited during debounce/);
  current = searchField('Deferred switched'); await focus(current); current = replace(current); current.dataset.suggest = 'ptcg';
  deferred.get('Deferred switched')(); await settle(); assert.equal(popup(), undefined, 'in-flight old-game results cannot paint after a game change');
  current = searchField('Deferred detached'); await focus(current); current = replace(current); current.isConnected = false;
  deferred.get('Deferred detached')(); await settle(); assert.equal(popup(), undefined, 'detached replacement cannot receive late results');

  for (const mismatch of ['query', 'game', 'source game', 'source key', 'live sibling', 'stale source']) {
    current = searchField('Mismatch ' + mismatch); await focus(current); const prior = popup();
    const state = captureSearchFocus(rootFor(current), current), next = searchField(current.value);
    if (mismatch === 'query') state.value = 'Changed restored query';
    if (mismatch === 'game') next.dataset.suggest = 'ygo';
    if (mismatch === 'source game') current.dataset.suggest = 'ptcg';
    if (mismatch === 'source key') current.id = 'unrelated-source';
    if (mismatch === 'stale source') { const other = searchField('Unrelated active query'); await focus(other); }
    if (mismatch !== 'live sibling') current.isConnected = false;
    restoreSearchFocus(rootFor(next), state); await settle();
    assert.notEqual(popup(), prior, `${mismatch}: never carry the old listbox/options to an unrelated lifecycle`);
    assert.equal(next.getAttribute('aria-activedescendant'), null);
  }
  current = searchField('Different field identity'); await focus(current);
  const state = captureSearchFocus(rootFor(current), current), unrelated = searchField(current.value, 'mtg', 'homeQ');
  restoreSearchFocus(rootFor(unrelated), state); assert.equal(unrelated.focusOptions, undefined, 'unrelated replacement key is not focused');
  // A helper failure must not leave a marker that suppresses a later real focus.
  const throwing = searchField(current.value); throwing.focus = () => { throw Error('focus failed'); };
  assert.throws(() => restoreSearchFocus(rootFor(throwing), state), /focus failed/); assert.equal(Object.hasOwn(throwing, 'suggestFocusRestore'), false);
  const previous = { sentinel: true }; throwing.suggestFocusRestore = previous;
  assert.throws(() => restoreSearchFocus(rootFor(throwing), state), /focus failed/); assert.equal(throwing.suggestFocusRestore, previous);
  console.log('PASS: actual Search focus restoration preserves open selection, closed Enter/Escape intent, cursor/preventScroll, pending/in-flight work, cancellation and genuine user typing/refocus; game/query/key/stale/detached isolation and finally cleanup.');
} finally {
  for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
}
