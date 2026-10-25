// Play setup shares the application's deck/profile renderers. It cannot start
// a match or declare card support; the rules/runtime gate remains separate.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message = issue => typeof issue === 'string' ? issue : issue?.reason || issue?.message || issue?.name || 'Review this entry.';
const count = rows => Array.isArray(rows) && rows.every(row => Number.isSafeInteger(row?.qty) && row.qty > 0) ? rows.reduce((sum, row) => sum + row.qty, 0) : 'Unverified';
function notices(items, title) {
  return items?.length ? `<details class="note warn"><summary>${esc(title)} (${items.length})</summary><ul>${items.map(item => `<li>${esc(message(item))}</li>`).join('')}</ul></details>` : '';
}
export function playMenuMarkup(state, {avatarMarkup = '', deckTiles = new Map(), deckPreview = '', importPreview = '', formatOptions = ''} = {}) {
  const p = state.profile || {}, draft = state.draft || {}, selected = state.selected;
  const signedIn = p.signedIn === true;
  const importReady = state.importStatus === 'review' || state.importStatus === 'ready';
  return `<section class="play-menu" aria-labelledby="playTitle">
    <div class="page-head"><div><h1 id="playTitle">Play</h1><p class="muted">1v1 CPU practice · Beta</p></div><span class="chip">In development</span></div>
    <section class="panel play-profile" aria-label="Your player profile">${avatarMarkup}<div><h2>${esc(p.displayName || (signedIn ? 'Player' : 'Your player profile'))}</h2>${p.username ? `<p class="muted">@${esc(p.username)}</p>` : ''}<p class="small muted">${signedIn ? 'Your CardStashy profile will appear at the table.' : 'Sign in to choose decks saved on your account.'}</p></div>${signedIn ? '' : '<button class="btn" data-act="menu">Sign in</button>'}</section>
    ${signedIn ? `<section aria-labelledby="playDecksTitle"><div class="page-head"><h2 id="playDecksTitle">My decks</h2><span class="muted small">${state.decks.length} saved</span></div>
      ${state.decks.length ? `<div class="deck-grid play-deck-choices">${state.decks.map(deck => `<div class="play-deck-choice${state.selectedSource === 'saved' && selected?.id === deck.id ? ' selected' : ''}">${deckTiles.get(deck.id) || `<div class="panel"><h3>${esc(deck.name)}</h3><p class="muted">${esc(deck.format)}</p></div>`}<button class="btn ${state.selectedSource === 'saved' && selected?.id === deck.id ? '' : 'ghost'}" data-act="playSelectDeck" data-play-deck="${esc(deck.id)}" aria-pressed="${state.selectedSource === 'saved' && selected?.id === deck.id}">${state.selectedSource === 'saved' && selected?.id === deck.id ? 'Selected' : 'Use this deck'}</button></div>`).join('')}</div>` : '<div class="empty"><h3>No saved decks yet</h3><p>Paste a deck list below, or import one in Decks.</p><button class="btn ghost" data-act="go" data-to="#decks">Open Decks</button></div>'}
    </section>
    <section class="panel" aria-labelledby="playImportTitle"><h2 id="playImportTitle">Import a deck list</h2><p class="muted small">Copy a text deck list from your deck site and paste it here. Common headings, quantities and printing details are recognized. Review unmatched entries before using the list.</p>
      <div class="grid2"><label>Deck name<input id="playImportName" data-input="playImportDraft" data-play-field="name" maxlength="160" value="${esc(draft.name || '')}" placeholder="Imported deck"></label><label>Format<select id="playImportFormat" data-change="playImportDraft" data-play-field="format">${formatOptions}</select></label></div>
      <label>Deck list<textarea id="playImportText" data-input="playImportDraft" data-play-field="text" rows="8" maxlength="100000" placeholder="Commander&#10;1 Your commander&#10;&#10;Deck&#10;1 Sol Ring&#10;36 Island">${esc(draft.text || '')}</textarea></label>
      <div class="actions wrap"><button class="btn" data-act="playImportPreview" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Matching cards…' : 'Preview & match'}</button>${importReady ? '<button class="btn ghost" data-act="playImportUse">Use this list</button>' : ''}</div>
      <p class="muted small">Pasted lists stay in Play until you choose to save a copy in Decks.</p>
      <div role="status" aria-live="polite">${state.error ? `<p class="note warn">${esc(state.error)}</p>` : ''}${state.busy ? '<p class="muted">Matching card names…</p>' : state.importStatus === 'selected' ? '<p class="muted">List selected. Your deck is shown below.</p>' : importReady ? '<p class="muted">List read. Review the entries, then choose Use this list.</p>' : ''}</div>
      ${notices(state.warnings, 'Import notes')}${notices(state.unresolved, 'Unmatched cards')}
      ${importReady && state.reviewDeck ? `<div class="play-import-review"><h3>Review imported list</h3><p class="muted small">${count(state.reviewDeck.cards)} cards${state.reviewDeck.side?.length ? ` · ${count(state.reviewDeck.side)} sideboard` : ''}</p>${importPreview}</div>` : ''}
    </section>` : ''}
    ${selected ? `<section class="panel" aria-labelledby="playSelectedTitle"><div class="page-head"><div><p class="eyebrow">Selected deck</p><h2 id="playSelectedTitle" tabindex="-1">${esc(selected.name)}</h2><p class="muted small">${esc(selected.format)} · ${count(selected.cards)} cards${selected.side?.length ? ` · ${count(selected.side)} sideboard` : ''}</p></div><button class="btn ghost small" data-act="playClearSelection">Clear</button></div>${deckPreview}</section>` : ''}
    <section class="panel"><h2>1v1 CPU match</h2><p class="muted">CPU matches are still in development. Selecting or importing a deck does not yet start a game.</p><button class="btn" disabled aria-describedby="playMatchStatus">Play CPU</button><p id="playMatchStatus" class="small muted">${selected ? 'Your deck is selected. Match play will open after the gameplay checks pass.' : 'Choose a saved deck or paste a list to prepare your match.'}</p></section>
  </section>`;
}
