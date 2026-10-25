import {reviewPracticeSetup} from './experiments/phase-engine/practice-preflight.mjs';
// Desktop setup only. Format/difficulty preferences do not certify engine,
// construction legality, card support or a working opponent connection.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message = issue => typeof issue === 'string' ? issue : issue?.reason || issue?.message || issue?.name || 'Review this entry.';
const count = rows => Array.isArray(rows) && rows.every(row => Number.isSafeInteger(row?.qty) && row.qty > 0) ? rows.reduce((sum, row) => sum + row.qty, 0) : 'Unverified';
function notices(items, title) {
  return items?.length ? `<details class="note warn"><summary>${esc(title)} (${items.length})</summary><ul>${items.map(item => `<li>${esc(message(item))}</li>`).join('')}</ul></details>` : '';
}
export function playMenuMarkup(state, {avatarMarkup = '', deckTiles = new Map(), deckPreview = '', importPreview = '', selectedArt = '', opponentPreview = '', matchReleaseReady = false} = {}) {
  const p = state.profile || {}, draft = state.draft || {}, selected = state.inspectedSeat==='opponent'?state.opponent:state.selected;
  const match = state.match || {format:'Commander',mode:'cpu',difficulty:'Medium'}, query = state.browse?.query || '';
  const signedIn = p.signedIn === true, importReady = ['review','ready'].includes(state.importStatus);
  const decks = (state.decks || []).filter(d => d.format === match.format);
  const visible = decks.filter(d => [d.name,d.commander].some(v => String(v || '').toLowerCase().includes(query.toLowerCase().trim())));
  const chosen = d => state.selectedSource === 'saved' && selected?.id === d.id;
  const review=reviewPracticeSetup(state),canStart=matchReleaseReady&&review.canLoad;
  const footerText=review.reasons.join(' ')|| (matchReleaseReady?'The rules engine will check both exact lists before the game starts.':'Practice launch is still being verified.');
  return `<section class="play-menu" aria-labelledby="playTitle">
    <header class="play-heading"><div><p class="eyebrow">Your next match</p><h1 id="playTitle">Play</h1></div><div class="play-format" role="group" aria-label="Match format">${['Standard','Commander'].map(format => `<button class="btn ${match.format === format ? '' : 'ghost'}" data-act="playConfigure" data-play-option="format" data-play-value="${format}" aria-pressed="${match.format === format}">${format}</button>`).join('')}</div><span class="chip play-beta">In development</span></header>
    <div class="play-workspace">
      <section class="panel play-library" aria-labelledby="playDecksTitle">
        <div class="play-library-head"><div class="page-head"><div><p class="eyebrow">Choose your deck</p><h2 id="playDecksTitle">My ${esc(match.format)} decks</h2></div><a class="btn ghost small" href="#decks">Open Decks</a></div>
          ${signedIn ? `<label class="play-search"><span class="small muted">Search your decks</span><input id="playDeckSearch" type="search" maxlength="160" value="${esc(query)}" data-input="playDeckSearch" placeholder="Deck name or commander"></label>` : ''}
        </div>
        <div class="play-library-scroll" data-play-scroll="library" tabindex="0" role="region" aria-label="Deck browser">
          ${signedIn ? `<details id="playImportDisclosure" class="play-import" ${draft.text || importReady || state.busy || state.error ? 'open' : ''}><summary>Paste a deck list <span class="small muted">Import for ${esc(match.format)}</span></summary>
            <div class="play-import-body"><h3 id="playImportTitle">Import a deck list</h3><p class="small muted">Paste a list, review the cards, then choose Use this list. The original rows and printing details are kept for review.</p>
              <label>Deck name<input id="playImportName" data-input="playImportDraft" data-play-field="name" maxlength="160" value="${esc(draft.name || '')}" placeholder="Imported deck"></label>
              <label>Deck list<textarea id="playImportText" data-input="playImportDraft" data-play-field="text" rows="6" maxlength="100000" placeholder="${match.format === 'Commander' ? 'Commander&#10;1 Your commander&#10;&#10;' : ''}Deck&#10;1 Card name">${esc(draft.text || '')}</textarea></label>
              <div class="actions wrap"><button class="btn" data-act="playImportPreview" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Matching cards…' : 'Preview & match'}</button>${importReady ? '<button class="btn ghost" data-act="playImportUse">Use this list</button>' : ''}</div>
              <p class="small muted">Pasted lists stay here until you save a copy in Decks.</p>
              <div role="status" aria-live="polite">${state.error ? `<p class="note warn">${esc(state.error)}</p>` : ''}${state.busy ? '<p class="muted">Matching card names…</p>' : state.importStatus === 'selected' ? '<p class="muted">List selected. Review it in Your deck.</p>' : importReady ? '<p class="muted">Review the entries, then choose Use this list.</p>' : ''}</div>
              ${notices(state.warnings, 'Import notes')}${notices(state.unresolved, 'Unmatched cards')}
              ${importReady && state.reviewDeck ? `<div class="play-import-review"><h3>Review imported list</h3><p class="muted small">${count(state.reviewDeck.cards)} cards${state.reviewDeck.side?.length ? ` · ${count(state.reviewDeck.side)} sideboard` : ''}</p>${importPreview}</div>` : ''}
            </div></details>
            <p class="play-result-count small muted" role="status">${visible.length} of ${decks.length} ${esc(match.format)} decks</p>
            ${visible.length ? `<div class="deck-grid play-deck-choices">${visible.map(deck => `<article class="play-deck-choice${chosen(deck) ? ' selected' : ''}">${deckTiles.get(deck.id) || `<button class="deck-tile" data-act="playSelectDeck" data-play-deck="${esc(deck.id)}" aria-pressed="${chosen(deck)}" aria-label="Select ${esc(deck.name)}"><span class="tile-body"><b>${esc(deck.name)}</b><small>${esc(deck.format)}</small></span></button>`}<span class="play-deck-selection" aria-hidden="true">${chosen(deck) ? '✓ Selected' : 'Choose deck'}</span></article>`).join('')}</div>` : `<div class="empty"><h3>${query ? 'No matching decks' : `No ${esc(match.format)} decks yet`}</h3><p>${query ? 'Try another name or clear your search.' : 'Paste a list above or build a deck in Decks.'}</p></div>`}
            ${(state.decks || []).length > decks.length ? '<p class="small muted play-other-formats">Your other formats remain available in Decks.</p>' : ''}` : '<div class="empty"><h3>Your decks, ready for the table</h3><p>Sign in to choose your saved decks or import a list.</p><button class="btn" data-act="menu">Sign in</button></div>'}
        </div>
      </section>
      <aside class="panel play-inspector" aria-labelledby="playInspectorTitle">
        <div class="play-inspector-head"><div class="play-inspector-tabs" role="group" aria-label="Inspect seat">${[['player','Your deck'],['opponent','CPU deck']].map(([seat,label])=>`<button class="btn ghost small" data-act="playInspectSeat" data-play-seat="${seat}" aria-pressed="${(state.inspectedSeat||'player')===seat}">${label}</button>`).join('')}</div><div class="page-head"><h2 id="playInspectorTitle">${state.inspectedSeat==='opponent'?'CPU deck':'Your deck'}</h2>${selected&&state.inspectedSeat!=='opponent' ? '<button class="btn ghost small" data-act="playClearSelection">Clear</button>' : ''}</div>
          ${selected ? `<div class="play-selected-cover">${selectedArt}<div class="play-selected-copy"><p class="eyebrow">Selected deck</p><h3 id="playSelectedTitle" tabindex="-1">${esc(selected.name)}</h3><p class="small">${esc(selected.format)} · ${count(selected.cards)} cards${selected.side?.length ? ` · ${count(selected.side)} sideboard` : ''}</p></div></div>` : '<p class="muted">Select a deck to see its artwork and full card list here.</p>'}
        </div>
        <div class="play-inspector-scroll" data-play-scroll="inspector" tabindex="0" role="region" aria-label="Selected deck cards">${match.mode==='cpu'&&signedIn?`<details class="play-opponent-review" ${state.opponentBuild?.busy||state.opponent?'open':''}><summary>CPU opponent · ${esc(state.opponent?.name||'Choose a deck')}</summary><p class="small muted">Build a new opponent with the shared deck builder, then inspect its list. Gameplay eligibility is checked separately.</p><details><summary>Build preferences</summary>${match.format==='Commander'?'<label>Aim for bracket<select data-opponent-bracket><option value="">Any bracket</option>'+[1,2,3,4,5].map(n=>'<option'+(String(state.opponentBuild?.request?.targetBracket)===String(n)?' selected':'')+'>'+n+'</option>').join('')+'</select></label>':''}<label>Deck style<select data-opponent-style><option value="classic">Classic strategy</option><option value="infinite-mana" ${state.opponentBuild?.request?.deckStyle==='infinite-mana'?'selected':''}>Infinite mana engine</option></select></label></details>${state.selected?'<button class="btn ghost" data-act="playUseSelectedOpponent">Use selected deck for CPU</button>':''}<button class="btn ghost" data-act="playRandomOpponent" ${state.opponentBuild?.busy?'disabled':''}>Random opponent deck</button>${state.opponentBuild?.busy?'<button class="btn ghost" data-act="playCancelOpponentBuild">Cancel build</button>':''}<p class="small muted" role="status">${esc(state.opponentBuild?.error||state.opponentBuild?.status||'')}</p></details>`:''}
        ${selected ? `${deckPreview}<p class="small muted">Deck eligibility will be checked before a match.</p>` : '<div class="play-selection-empty"><span aria-hidden="true">◇</span><p>Choose your next game plan.</p><p class="small muted">Browse on the left. Inspect your deck here.</p></div>'}</div>
      </aside>
    </div>
    <footer class="panel play-match-bar" aria-label="Match setup">
      <div class="play-profile">${avatarMarkup}<div><b>${esc(p.displayName || (signedIn ? 'Player' : 'Your player profile'))}</b>${p.username ? `<span class="small muted">@${esc(p.username)}</span>` : ''}<span class="small muted">${signedIn ? 'Your seat · 1v1' : 'Sign in to prepare your match'}</span></div></div>
      <fieldset class="play-opponent"><legend>Play against</legend>${[['cpu','Practice · CPU'],['friends','Friends']].map(([value,label]) => `<label><input type="radio" name="playOpponent" value="${value}" data-change="playMatchOption" data-play-option="mode" ${match.mode === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>
      ${match.mode === 'cpu' ? `<label class="play-difficulty">Difficulty<select id="playDifficulty" data-change="playMatchOption" data-play-option="difficulty">${['Easy','Medium','Hard'].map(level => `<option value="${level}"${match.difficulty === level ? ' selected' : ''}${level==='Medium'?'':' disabled'}>${level}${level==='Medium'?' · Beta CPU':' · Coming later'}</option>`).join('')}</select></label>` : '<p class="small muted play-friends-note">Private matches<br>Coming after CPU practice</p>'}
      <div class="play-start"><button class="btn" data-act="playStartCandidate" ${canStart?'':'disabled'} aria-describedby="playMatchStatus">${match.mode === 'friends' ? 'Play with friends' : 'Play CPU'}</button></div>
      <div id="playMatchStatus" class="small muted" role="status"><p>${esc(footerText)}</p>${Object.entries(review.seats||{}).map(([seat,s])=>notices(s.unsupported,(seat==='player'?'Your deck':'CPU deck')+': outside tested beta pool')).join('')}</div>
    </footer>
  </section>`;
}
