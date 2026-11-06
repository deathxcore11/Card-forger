// The Build a deck screens as data, shared by the WebView's builder (deck-flow-entry.mjs, Magic) and the Collection engine
// (collection-engine-entry.mjs, Yu-Gi-Oh! and Pokémon): deck-experience.js's own setup and result markup, drawn into a detached
// element and read back for the native screens. Only DOM calls both the browser and site-dom.mjs answer the same way.
const text = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
// The page's document (the browser's), or the one the Collection engine hands in (site-dom.mjs; QuickJS has none).
let drawDoc = null;
export const useDocument = d => { drawDoc = d; };
export const draw = html => { const host = (drawDoc || document).createElement('div'); host.innerHTML = html; return host; };
// A freshly drawn <select>'s options and which one is chosen (the one marked selected, else the first), as the browser reads it.
const chosen = el => { const os = [...el.querySelectorAll('option')], pick = os.find(o => o.hasAttribute('selected')) || os[0]; return os.map(o => [o, o === pick]); };

// deckSetupMarkup as data: the card, the format (or Commander's lock), theme, budget, the Preferences and the Generate button.
// [themes]: Yu-Gi-Oh!'s archetype names, which deck-experience.js open() loads into the Theme list once they arrive (model.themes).
export function setupModel(request, status, error, deckSetupMarkup, formats, themes) {
  status = status || ''; error = !!error;
  const host = draw(deckSetupMarkup({request, busy: false, status, error, ...(themes ? {themes} : {})}, formats));
  const q = s => host.querySelector(s), qa = s => [...host.querySelectorAll(s)];
  const select = f => { const el = q(`select[data-flow-field="${f}"]`); return el ? {label: text(el.closest('label')?.querySelector('.field-title') || el.closest('label')).replace(text(el), '').trim(),
    options: chosen(el).map(([o, on]) => ({value: o.value, label: o.textContent.trim(), on}))} : null; };
  const seedImg = q('.deck-seed-picker summary img'), budget = q('input[data-flow-field="budget"]'), note = q('[data-flow-budget-note]');
  const lock = q('.deck-format-lock'), req = qa('.deck-flow > p.small').map(text).find(t => t.startsWith('Required cards')) || '';
  return {request,
    title: text(q('.build-heading')),
    seed: {name: text(q('.deck-seed-picker summary b')), art: seedImg?.getAttribute('src') || '', empty: text(q('.deck-seed-empty')), change: text(q('.deck-seed-picker summary small')),
      label: text(q('.deck-seed-picker label')).trim(), placeholder: q('input[data-flow-field="seed"]')?.getAttribute('placeholder') || '', value: q('input[data-flow-field="seed"]')?.value || ''},
    image: request.seedCard?.image_uris?.normal || request.seedCard?.card_faces?.[0]?.image_uris?.normal || (request.game !== 'mtg' ? seedImg?.getAttribute('src') || '' : '') || '',
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

export function resultModel(id, item, deckResultMarkup) {
  const r = item.result, host = draw(deckResultMarkup(r, id, {saved: item.saved}));
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
      owned: bar ? (parseFloat(bar.style?.width || (bar.getAttribute('style') || '').match(/width\s*:\s*([\d.]+)/)?.[1]) || 0) / 100 : null},
    lead: lead ? [...lead.children].map(el => { const b = el.querySelector(':scope > b'); return {head: text(b), text: b ? [...el.children].filter(k => k !== b).map(text).filter(Boolean).join('\n') || text(el) : text(el), warn: /\bwarn/.test(el.className)}; }).filter(x => x.text || x.head) : [],
    save: (() => { const b = q('[data-act="flowSave"]'); return {label: text(b), disabled: !!b?.disabled}; })(),
    rebuild: {summary: text(q('.ds-rebuild summary')), label: text(q('.deck-budget-rebuild label')), placeholder: q('[data-flow-budget]')?.getAttribute('placeholder') || '', button: text(q('[data-act="flowAdjust"]'))},
    construction: text([...(article?.children || [])].find(el => el.matches('p.foot'))),
    extras: [...(article?.children || [])].filter(el => el.tagName === 'DETAILS' && !el.classList.contains('deck-result-checks')).map(details),
    zones: qa('.deck-flow-cards section').map(sec => ({title: text(sec.querySelector('h3')).replace(/\s*\d+$/, ''), count: text(sec.querySelector('h3 span')),
      rows: [...sec.querySelectorAll('.deck-compact-row')].map(b => { const i = Number(b.dataset.row), row = r.rows[i], c = row?.card;
        return {index: i, qty: Number(b.dataset.flowQty) || row?.qty || 1, name: b.dataset.flowName || row?.name || '', zone: row?.zone || 'main',
          category: b.dataset.deckCategory || '', thumb: b.querySelector('img.row-thumb')?.getAttribute('src') || '',
          image: c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || (r.request.game !== 'mtg' ? c?.image || b.querySelector('img.row-thumb')?.getAttribute('src') || '' : '') || '',
          id: r.request.game !== 'mtg' ? String(row?.id || row?.cardId || c?.id || '') : '',
          // app.js deckExperience card(): Pokémon opens on the row's variant, Yu-Gi-Oh! on its printing and edition.
          ...(r.request.game === 'ptcg' ? {setVariant: row?.selection?.variant || ''} : r.request.game === 'ygo' ? {printing: row?.selection?.printingKey || '', edition: row?.selection?.edition || ''} : {}),
          pills: [...b.querySelectorAll('.deck-compact-copy span')].filter(x => !x.querySelector('span') && !x.classList.contains('foot')).map(text).filter(Boolean), price: text(b.querySelector(':scope > span.small'))}; })})),
    edit: text(q('[data-act="flowEdit"]')), export: text(q('[data-act="flowExport"]')),
    checks: (() => { const d = q('.deck-result-checks'); return d ? details(d) : null; })(),
    request: r.request};
}

