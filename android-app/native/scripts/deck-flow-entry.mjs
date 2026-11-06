// Collection's Build a deck for the native app's WebView (RandomBuild.kt; Randall 5 Nov 23:18Z: Random Commander and Random deck in
// Collection › Decks do what the website's do). deck-experience.js runs here as app.js wires it (open, flowRandom, flowGenerate,
// flowAdjust, flowSave's checks, flowExport) on the random builder's own deckPipeline, so a deck builds at Chrome's speed; the page
// draws the site's own setup and result markup (deckSetupMarkup, deckResultMarkup) into a detached element and reads them back as
// data for the native screens. Only Magic: the bundle carries no Yu-Gi-Oh! or Pokémon sources (those still open the website).
import {deckPipeline, randomBuildSeed, flowCalls} from './random-build-entry.mjs';
import {deckSetupMarkup, deckResultMarkup} from 'WEB/deck-experience.js';
import {S} from 'WEB/store.js';
import {exportDeckText} from 'WEB/core.js';
import {customBudget} from 'WEB/ui.js';

const text = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const draw = html => { const host = document.createElement('div'); host.innerHTML = html; return host; };

// The signed-in workspace the build reads (app.js inv / priceOf: what is owned, the player's own prices), handed over by the app.
function workspace(w) {
  for (const k of ['collection', 'decks', 'myPrices', 'priceChoices', 'settings']) if (w && k in w) S.state[k] = w[k];
}

// deck-experience.js open(): the request it starts from (the format's default, the saved preferences, then what the button asked).
function opened(request, prefs) {
  const game = 'mtg', formats = deckPipeline.formats[game], fallback = formats.find(f => f.id === 'standard') || formats[0];
  return {game, format: fallback.name, budget: '', budgetBasis: 'total', budgetMode: 'cap', preferOwned: true, ...(prefs || {}), ...request};
}

// deckSetupMarkup as data: the card, the format (or Commander's lock), theme, budget, the Preferences and the Generate button.
function setupModel(request, status = '', error = false) {
  const host = draw(deckSetupMarkup({request, busy: false, status, error}, deckPipeline.formats));
  const q = s => host.querySelector(s), qa = s => [...host.querySelectorAll(s)];
  const select = f => { const el = q(`select[data-flow-field="${f}"]`); return el ? {label: text(el.closest('label')?.querySelector('.field-title') || el.closest('label')).replace(text(el), '').trim(),
    options: [...el.options].map(o => ({value: o.value, label: o.textContent.trim(), on: o.selected}))} : null; };
  const seedImg = q('.deck-seed-picker summary img'), budget = q('input[data-flow-field="budget"]'), note = q('[data-flow-budget-note]');
  const lock = q('.deck-format-lock'), req = qa('.deck-flow > p.small').map(text).find(t => t.startsWith('Required cards')) || '';
  return {request,
    title: text(q('.build-heading')),
    seed: {name: text(q('.deck-seed-picker summary b')), art: seedImg?.getAttribute('src') || '', empty: text(q('.deck-seed-empty')), change: text(q('.deck-seed-picker summary small')),
      label: text(q('.deck-seed-picker label')).trim(), placeholder: q('input[data-flow-field="seed"]')?.getAttribute('placeholder') || '', value: q('input[data-flow-field="seed"]')?.value || ''},
    image: request.seedCard?.image_uris?.normal || request.seedCard?.card_faces?.[0]?.image_uris?.normal || '',
    required: req, random: text(q('[data-act="flowRandom"]')),
    format: lock ? {locked: true, label: text(lock.querySelector('span')), value: text(lock.querySelector('b')), other: text(lock.querySelector('[data-act="flowAnyFormat"]'))} : {locked: false, ...select('format')},
    theme: {title: text(q('[data-flow-field="theme"]')?.closest('label')?.querySelector('.field-title')), ...select('theme')},
    budget: {label: text(budget?.closest('label')).replace(text(note), '').trim(), value: budget?.value || '', placeholder: budget?.getAttribute('placeholder') || '', note: note && !note.hasAttribute('hidden') ? text(note) : ''},
    prefs: {title: text(q('.settings-disclosure summary')), matchMode: select('matchMode'), budgetMode: select('budgetMode'), budgetBasis: select('budgetBasis'),
      matchLabel: text(q('select[data-flow-field="matchMode"]')?.closest('label')).replace(/Not specified.*$/, '').trim(),
      ruleLabel: text(q('select[data-flow-field="budgetMode"]')?.closest('label')).replace(/Strict maximum.*$/, '').trim(),
      coversLabel: text(q('select[data-flow-field="budgetBasis"]')?.closest('label')).replace(/Whole deck.*$/, '').trim(),
      checks: qa('label.check').map(l => ({field: l.querySelector('input')?.dataset.flowField || '', label: text(l), on: !!l.querySelector('input')?.checked})),
      foot: text(q('.settings-disclosure .foot'))},
    generate: text(q('[data-act="flowGenerate"]')), status: text(q('[role="status"]')), error};
}

// deckResultMarkup as data: deckShell's hero, the notes before Save, the actions, the construction line, the loop and mechanic
// details, each zone's rows (the card picture from the row's card), Edit choices / Export list and "Deck plan, checks & pricing".
const results = new Map();
let sequence = 0;
function register(result) { const id = 'deck-result-' + (++sequence); results.set(id, {result, saved: false}); while (results.size > 30) results.delete(results.keys().next().value); return id; }
function resultModel(id) {
  const item = results.get(id), r = item.result, host = draw(deckResultMarkup(r, id, {saved: item.saved}));
  const q = s => host.querySelector(s), qa = s => [...host.querySelectorAll(s)];
  const hero = q('.ds-hero'), art = hero?.querySelector('img.hero-art'), brow = hero?.querySelector('.deck-hero-eyebrow');
  const bar = hero?.querySelector('.ds-bar i'), lead = q('.ds-lead');
  const article = q('[data-flow-result]');
  const details = el => ({summary: text(el.querySelector('summary')), lines: [...el.querySelectorAll(':scope > p, :scope > section, :scope > div p')].map(p => ({text: text(p), warn: p.classList.contains('warn-text') || p.classList.contains('warn')})).filter(x => x.text)});
  return {id, game: r.request.game,
    hero: {art: art?.getAttribute('src') || '', badge: text(brow?.querySelector('.ds-badge')), format: text([...(brow?.querySelectorAll('.chip') || [])].find(c => !c.classList.contains('ds-badge'))),
      legality: (() => { const b = brow?.querySelector('.review-badge'); return b ? {text: text(b), level: ['bad', 'warn', 'ok'].find(c => b.classList.contains(c)) || 'warn'} : null; })(),
      title: text(hero?.querySelector('h1')), line: (hero?.querySelector('.ds-line')?.innerHTML || '').split(/<br\s*\/?>/i).map(h => text(draw(h))).filter(Boolean),
      stats: [...(hero?.querySelectorAll('.ds-stat') || [])].map(s => ({value: text(s.querySelector('b')), label: text(s.querySelector('span'))})),
      owned: bar ? (parseFloat(bar.style.width) || 0) / 100 : null},
    lead: lead ? [...lead.children].map(el => { const b = el.querySelector(':scope > b'); return {head: text(b), text: b ? [...el.children].filter(k => k !== b).map(text).filter(Boolean).join('\n') || text(el) : text(el), warn: /\bwarn/.test(el.className)}; }).filter(x => x.text || x.head) : [],
    save: (() => { const b = q('[data-act="flowSave"]'); return {label: text(b), disabled: !!b?.disabled}; })(),
    rebuild: {summary: text(q('.ds-rebuild summary')), label: text(q('.deck-budget-rebuild label')), placeholder: q('[data-flow-budget]')?.getAttribute('placeholder') || '', button: text(q('[data-act="flowAdjust"]'))},
    construction: text([...(article?.children || [])].find(el => el.matches('p.foot'))),
    extras: [...(article?.children || [])].filter(el => el.tagName === 'DETAILS' && !el.classList.contains('deck-result-checks')).map(details),
    zones: qa('.deck-flow-cards section').map(sec => ({title: text(sec.querySelector('h3')).replace(/\s*\d+$/, ''), count: text(sec.querySelector('h3 span')),
      rows: [...sec.querySelectorAll('.deck-compact-row')].map(b => { const i = Number(b.dataset.row), row = r.rows[i], c = row?.card;
        return {index: i, qty: Number(b.dataset.flowQty) || row?.qty || 1, name: b.dataset.flowName || row?.name || '', zone: row?.zone || 'main',
          category: b.dataset.deckCategory || '', thumb: b.querySelector('img.row-thumb')?.getAttribute('src') || '',
          image: c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || '',
          pills: [...b.querySelectorAll('.deck-compact-copy span')].filter(x => !x.querySelector('span') && !x.classList.contains('foot')).map(text).filter(Boolean), price: text(b.querySelector(':scope > span.small'))}; })})),
    edit: text(q('[data-act="flowEdit"]')), export: text(q('[data-act="flowExport"]')),
    checks: (() => { const d = q('.deck-result-checks'); return d ? details(d) : null; })(),
    request: r.request};
}

let current = 0, status = '';
const live = me => () => me === current;
flowCalls.flowWorkspace = a => { workspace(a); return true; };
// open(): the setup for a request ({commanderLock, format}) and the player's saved preferences.
flowCalls.flowOpen = a => setupModel(opened(a.request || {}, a.prefs));
// A request the player edited (read()): its setup again, without building.
flowCalls.flowSetup = a => setupModel(a.request);
// A.flowRandom: a new build-around for the request (randomBuildSeed), then the setup around it.
flowCalls.flowRandom = async a => {
  const me = ++current;
  const r = {...a.request, seed: '', seedCard: null, seedCards: [], ygoPurchaseSelections: {}, ptcgPurchaseSelections: {}, randomSeed: Math.floor(Math.random() * 1e9)};
  const card = await randomBuildSeed(r);
  if (me !== current) return {cancelled: true};
  return setupModel({...r, seed: card.name, seedCard: card, seedCards: [card]});
};
// A.flowGenerate: the build with its live status; a finished deck is registered and read back as the result page.
flowCalls.flowGenerate = async a => {
  const me = ++current; status = 'Finding a coherent plan…';
  const result = await deckPipeline.build(a.request, {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  return result.ok ? {ok: true, model: resultModel(register(result))} : {ok: false, message: result.message, setup: setupModel(a.request, result.message, true)};
};
// A.flowAdjust: Rebuild with budget (customBudget checks the amount), from the previous deck and its estimate.
flowCalls.flowAdjust = async a => {
  const item = results.get(a.id); if (!item) throw Error('Your account or collection changed. Rebuild before opening this deck.');
  const budget = customBudget(a.budget);
  const me = ++current; status = 'Finding cards for your updated budget…';
  const result = await deckPipeline.build({...item.result.request, budget, previousDeck: item.result.deck, previousBudget: item.result.request.budget, previousEstimate: item.result.pricing.estimate},
    {current: live(me), onStatus: m => { if (me === current) status = String(m); }});
  if (me !== current) return {cancelled: true};
  status = '';
  return result.ok ? {ok: true, model: resultModel(register(result))} : {ok: false, message: result.message};
};
// A.flowSave's check (pipeline.recheck) and what app.js save() writes; the app's Collection engine writes it to My decks.
flowCalls.flowSaveData = a => {
  const item = results.get(a.id); if (!item) throw Error('Your account or collection changed. Rebuild before saving.');
  if (!deckPipeline.recheck(item.result)) throw Error('The list no longer passes its checks. Rebuild before saving.');
  return {deck: item.result.deck, request: item.result.request};
};
flowCalls.flowSaved = a => { const item = results.get(a.id); if (item) item.saved = true; return item ? resultModel(a.id) : null; };
// A.flowExport: the list as text (exportDeckText).
flowCalls.flowExport = a => { const item = results.get(a.id); if (!item) throw Error('This deck is no longer available.'); return {text: exportDeckText(item.result.deck)}; };
// A.flowCancelBuild.
globalThis.DeckFlow = {cancel() { current++; status = ''; }, status: () => status};
