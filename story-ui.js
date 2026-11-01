// Story mode screens (story-mode-acts.md Parts B and H; Randall 1 Nov 18:09Z): the road of acts,
// an act's battles, the duel setup, the talking-head scenes and the speech bubbles that come from a
// seat's portrait during a match. Markup and two small DOM controllers; app.js wires the actions.
// The road reveals itself: cleared acts, the current act, one blurred tease, and nothing after it.
import {STORY_ACTS, SET_NAMES, setSymbolUrl} from './story-acts.js';
import {purseMarkup} from './play-econ-ui.js';
import {battleStars, battleCleared, actCleared, actStars, currentBattle, currentAct, STAR_VALUE} from './story-client.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const back = (act, label) => `<button class="pl-back" data-act="${act}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>`;
const head = (title, econ, eyebrow, backAct = 'playHome', backLabel = 'Back to Play') => `<header class="pl-head pe-head st-head">${back(backAct, backLabel)}<div class="pl-head-title"><p class="eyebrow">${esc(eyebrow)}</p><h1 id="playTitle" tabindex="-1">${esc(title)}</h1></div>${purseMarkup(econ)}</header>`;
const symbols = act => `<span class="st-symbols">${act.sets.filter(c => c !== 'leb' && c !== '2ed').map(c => `<img src="${setSymbolUrl(c)}" alt="${esc(SET_NAMES[c] || c)}" title="${esc(SET_NAMES[c] || c)}" loading="lazy" decoding="async">`).join('')}</span>`;
const star = (on, label) => `<svg class="st-star${on ? ' on' : ''}" viewBox="0 0 24 24" role="img" aria-label="${esc(label)}"><path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z"/></svg>`;
const STAR_SLOTS = [['loaner', 'Loaner deck win'], ['loaner', 'Loaner deck win'], ['loaner', 'Loaner deck win'], ['own', 'Win with your own deck'], ['villain', 'Win from the other side']];
export const starsRow = rec => `<span class="st-stars" role="group" aria-label="${battleStars(rec)} of 5 stars">${STAR_SLOTS.map(([k, l]) => star(!!rec?.[k], l)).join('')}</span>`;
const ring = (done, total, label) => { const pct = Math.round(done / total * 100); return `<span class="st-ring" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="st-ring-track"/><circle cx="18" cy="18" r="15" class="st-ring-fill" pathLength="100" stroke-dasharray="${pct} 100"/></svg><b>${done}<small>/${total}</small></b></span>`; };
export const portraitUrl = p => p?.crop || '';
const faceStyle = p => `background-image:url(${esc(portraitUrl(p))});background-position:${esc(p?.focus || '50% 30%')}`;

// The Story road: the age you're in, as a shelf of act covers.
export function storyHomeMarkup({progress, econ, actsData = {}}) {
  const now = currentAct(progress), shown = STORY_ACTS.filter(a => a.act <= now + 1);
  const cover = a => {
    const data = actsData[a.act], done = actCleared(progress, a.act), here = a.act === now, tease = a.act > now;
    const cleared = Array.from({length: 8}, (_, i) => battleCleared(progress, `a${a.act}b${i + 1}`)).filter(Boolean).length;
    const art = `<span class="st-cover-art" style="background-image:url(${esc(a.art.crop)})" aria-hidden="true"></span>`;
    const name = `<span class="st-cover-act">Act ${a.act}</span><span class="st-cover-name">${esc(a.title)}</span>`;
    if (tease) return `<div class="st-cover st-cover--tease" aria-hidden="true">${art}<span class="st-cover-copy">${symbols(a)}${name}</span></div>`;
    return `<button class="st-cover${here ? ' st-cover--hero' : ' st-cover--done'}" data-act="storyOpenAct" data-story-act="${a.act}" aria-label="Act ${a.act}, ${esc(a.title)}. ${done ? 'Cleared' : cleared + ' of 8 battles won'}">${art}
      <span class="st-cover-copy">${symbols(a)}${name}<span class="st-cover-years">${esc(a.years)}</span>
      ${here ? `<span class="st-cover-foot">${ring(cleared, 8, cleared + ' of 8 battles won')}<span class="pl-mode-cta">${cleared ? 'Continue' : 'Begin'}</span></span>` : `<span class="st-cover-foot"><span class="st-cover-stars">${star(true, 'Stars')}<b>${actStars(progress, a.act)}</b><small>/40</small></span></span>`}</span>
      ${data && here ? '' : ''}</button>`;
  };
  const allDone = now > STORY_ACTS.length;
  return `<section class="play-menu st-screen st-road" aria-labelledby="playTitle">${head('Story', econ, 'Play')}
    <p class="st-age">${esc(STORY_ACTS[0].age)}</p>
    <div class="st-shelf">${shown.map(cover).join('')}${allDone ? `<div class="st-cover st-cover--book" aria-hidden="true"><span class="st-book"></span><span class="st-cover-copy"><span class="st-cover-act">The next age</span><span class="st-cover-name">The Weatherlight Saga</span></span></div>` : ''}</div>
  </section>`;
}

// One act: its banner and the battles you've reached. Cleared ones, the current one, then one tease.
export function storyActMarkup({act, data, progress, econ}) {
  const meta = STORY_ACTS.find(a => a.act === act), now = currentBattle(progress, act);
  const cleared = data.battles.filter(b => battleCleared(progress, b.id)).length;
  const villainFace = b => data.cast[b.villain.who]?.portrait;
  const row = b => {
    const rec = progress.battles?.[b.id], done = battleCleared(progress, b.id), here = b.slot === now, tease = b.slot === now + 1;
    if (tease) return `<li class="st-battle st-battle--tease" aria-hidden="true"><span class="st-battle-face" style="${faceStyle(villainFace(b))}"></span><span class="st-battle-copy"><span class="st-battle-kind">${esc(b.kind)}</span><span class="st-battle-title">${esc(b.title)}</span></span></li>`;
    return `<li><button class="st-battle${here ? ' st-battle--here' : ''}${b.slot === 8 ? ' st-battle--boss' : ''}" data-act="storyOpenBattle" data-story-battle="${esc(b.id)}" aria-label="${esc(b.kind)}: ${esc(b.title)}. ${done ? battleStars(rec) + ' of 5 stars' : 'Not won yet'}">
      <span class="st-battle-face" style="${faceStyle(villainFace(b))}" aria-hidden="true"></span>
      <span class="st-battle-copy"><span class="st-battle-kind">${b.slot === 8 ? 'Boss' : esc(b.kind)} <i>${esc(b.difficulty)}</i></span><span class="st-battle-title">${esc(b.title)}</span><span class="st-battle-blurb">${esc(b.blurb)}</span></span>
      <span class="st-battle-side">${starsRow(rec)}<span class="pl-mode-cta">${done ? 'Replay' : 'Duel'}</span></span></button></li>`;
  };
  return `<section class="play-menu st-screen st-act" aria-labelledby="playTitle">${head(meta.title, econ, 'Story · Act ' + act, 'storyHome', 'Back to Story')}
    <header class="st-banner"><span class="st-banner-art" style="background-image:url(${esc(meta.art.crop)})" aria-hidden="true"></span>
      <span class="st-banner-copy">${symbols(meta)}<span class="st-banner-years">${esc(meta.years)}</span></span>${ring(cleared, 8, cleared + ' of 8 battles won')}</header>
    <ol class="st-battles">${data.battles.filter(b => b.slot <= now + 1).map(row).join('')}</ol>
  </section>`;
}

// The duel setup: both sides, your deck, and Play. ui: {seat, deck:'loaner'|<play deck id>}.
// "New in this battle": one plain sentence per mechanic a battle introduces (battle.teaches).
export const LESSONS = {
  'Land drops and mana': 'Play one land a turn and tap lands for mana to cast your spells.',
  'Casting creatures': 'Creatures can\'t attack the turn they arrive. Next turn, they fight.',
  'Attacking and blocking': 'Attack with creatures; your opponent chooses which of theirs block. Unblocked damage hits the player.',
  'Flying': 'Creatures with flying can only be blocked by other flyers.',
  'First strike': 'A first striker deals its combat damage before creatures without it.',
  'Protection from a colour': 'Protection from a colour: it can\'t be blocked, targeted, damaged or enchanted by that colour.',
  "Instants on the opponent's turn": 'Instants can be cast any time, even during your opponent\'s turn. Hold mana open to surprise them.',
  'Bounce': 'Bounce returns a permanent to its owner\'s hand. They have to pay for it again.',
  'Artifacts': 'Artifacts are colourless, so any deck can play them.',
  'Answering artifacts': 'Some cards destroy artifacts outright. Save them for the biggest machine.',
  'Tempo': 'Tempo means using your mana better than your opponent each turn, so they fall behind.',
  'Counterspells': 'A counterspell stops a spell as it\'s cast. Leave blue mana open to threaten one.',
  'Artifact creatures': 'Artifact creatures are both artifacts and creatures, so artifact removal hits them too.',
  'Sacrifice': 'Sacrifice means putting your own permanent into the graveyard to pay for an effect.',
  'Two colours of mana': 'Two-colour decks need both land types. Watch which colours your hand needs.',
  'Legendary creatures': 'Legendary creatures are named heroes. You can only control one with each name.',
  'Three colours': 'Three-colour cards need all three mana colours. Dual lands make that possible.',
  'Tokens': 'Tokens are creatures made by other cards. They count as creatures until they leave play.',
  'Counters': 'Counters placed on a card change it, like spore counters that grow into Thallids.',
  'Multicolour gold cards': 'Gold cards need more than one colour of mana and are usually stronger for it.',
  'Card advantage': 'Card advantage: getting more cards than your opponent. More cards, more choices.',
  'Playing around counterspells': 'Against counterspells, cast your less important spell first, or wait until their mana is tapped.',
  'Discard': 'Discard makes a player throw cards from hand. Play your cards before they\'re taken.',
  'Snow': 'Snow lands make snow mana, which powers the cards of the long winter.',
  'Cumulative upkeep': 'Cumulative upkeep: pay more each turn to keep it, or let it go.',
  'Paying life': 'Some cards cost life instead of mana. Life is a resource until it runs out.',
  'Direct damage': 'Direct damage spells hit creatures or go straight at the player.',
  'Growing creatures': 'Some creatures grow with counters or pump spells. Answer them early.',
  'Alternate costs': 'Alternate costs let you cast a spell without paying its mana, at a price.',
  'Racing a card-draw engine': 'They pay life to draw cards. Attack hard: every point you deal is one they can\'t spend.',
  'Playing under a lock': 'A lock stops cards from untapping or moving. Break it, or win with what\'s already in play.',
};
// What a battle pays, in words: era packs for your side, the villain's signature card for theirs.
export const rewardText = (rw = {}, set = '') => rw.card ? `${esc(rw.card.name)}${rw.coins ? ` and ${rw.coins} coins` : ''}`
  : `${rw.packs || 1} ${esc(SET_NAMES[set] || set.toUpperCase())} ${(rw.packs || 1) > 1 ? 'packs' : 'pack'}${rw.coins ? ` and ${rw.coins} coins` : ''}`;
export function storyBattleMarkup({act, data, battle: b, progress, econ, ui = {}, ownDecks = [], avatarUrl = '', listHtml = ''}) {
  const rec = progress.battles?.[b.id] || {}, villainOpen = battleCleared(progress, b.id), seat = villainOpen && ui.seat === 'villain' ? 'villain' : 'hero';
  const mine = b[seat], theirs = b[seat === 'hero' ? 'villain' : 'hero'];
  const person = side => data.cast[b[side].who] || {name: 'You'};
  const face = side => b[side].who === 'you' && avatarUrl ? `background-image:url(${esc(avatarUrl)});background-position:50% 50%` : faceStyle(person(side).portrait);
  const listOpen = !!ui.listOpen;
  // Each side pays once: say what this win pays, or point at the other side's reward once yours is claimed.
  const rw = b.reward || {}, mineDone = seat === 'villain' ? !!rec.villain : !!rec.loaner, ownPick = (ui.deck || 'loaner') !== 'loaner';
  const prize = ownPick ? '<small>Your deck</small> XP only' : !mineDone ? `<small>Win</small> ${rewardText(rw[seat], b.rewardSet)}`
    : seat === 'hero' && !rec.villain && rw.villain?.card ? `<small>Their side</small> ${rewardText(rw.villain, b.rewardSet)}` : '<small>Reward claimed</small>';
  const deckChoice = ui.deck && ui.deck !== 'loaner' ? ownDecks.find(d => d.id === ui.deck) : null;
  const sideCard = (side, you) => `<article class="st-side${you ? ' st-side--you' : ''}" data-side="${side}"><span class="st-side-face" style="${face(side)}" aria-hidden="true"></span>
    <span class="st-side-copy"><span class="st-side-who">${you ? 'You play' : 'Opponent'}</span><h2>${esc(person(side).name)}</h2>${you ? '' : `<p>${esc(b[side].deck.name)}</p>`}</span></article>`;
  // Deck choice: the app's deck shelf cards. The loaner deck shows its lead card in the act's own printing.
  const cropOf = id => `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`;
  const lead = deck => deck.cards.find(r => !/^(snow-covered )?(plains|island|swamp|mountain|forest)$/i.test(r.name));
  const count = deck => deck.cards.reduce((t, r) => t + (Number(r.qty) || 0), 0);
  const deckCard = ({id, name, art, sub, ok = true, reason = ''}) => `<button type="button" class="home-personal-deck st-deck-opt" data-act="storyDeckPick" data-story-deck="${esc(id)}" aria-pressed="${(ui.deck || 'loaner') === id}"${(ui.deck || 'loaner') === id ? ` aria-expanded="${listOpen}" aria-controls="stDeckList"` : ''} ${ok ? '' : 'disabled'}><span class="home-personal-art" aria-hidden="true">${art ? `<img src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span><span class="home-personal-copy"><b>${esc(name)}</b><small>${esc(ok ? sub : reason)}</small></span>${(ui.deck || 'loaner') === id ? '<span class="st-deck-chev" aria-hidden="true"></span>' : ''}</button>`;
  const loanLead = lead(mine.deck);
  const picks = [deckCard({id: 'loaner', name: mine.deck.name, art: loanLead?.id ? cropOf(loanLead.id) : '', sub: `Story deck · ${count(mine.deck)} cards`}),
    ...(ownDecks.length ? ownDecks.map(d => deckCard({id: d.id, name: d.name, art: d.art || '', sub: `Your deck · ${count(d)} cards`, ok: d.fits.ok, reason: d.fits.reason})) : [])].join('');
  // Their list stays secret until you've beaten them; after that you can play their side too.
  const listSide = villainOpen && ui.listSide === 'theirs' ? 'theirs' : 'mine';
  const learn = (b.teaches || []).filter(t => LESSONS[t]);
  return `<section class="play-menu st-screen st-duel" aria-labelledby="playTitle">${head(b.title, econ, `Act ${act} · ${b.slot === 8 ? 'Boss' : b.kind}`, 'storyOpenAct', 'Back to the act')}
    <div class="st-duel-stage" style="--st-bg:url(${esc(person('villain').portrait?.crop || '')})">
      <section class="pl-arena st-arena" aria-label="This battle">${sideCard(seat, true)}<span class="pl-vs" aria-hidden="true"><b><span>VS</span></b></span>${sideCard(seat === 'hero' ? 'villain' : 'hero', false)}</section>
      <p class="st-duel-blurb">${esc(b.blurb)}</p>
    </div>
    ${learn.length ? `<aside class="st-learn" aria-label="New in this battle"><span class="st-learn-tag">New in this battle</span>${learn.map(t => `<p><b>${esc(t)}</b> ${esc(LESSONS[t])}</p>`).join('')}</aside>` : ''}
    <div class="home-personal-grid st-deck-grid" role="group" aria-label="Your deck">${picks}</div>
    <div class="st-duel-bar">
      ${villainOpen ? `<div class="st-seg" role="group" aria-label="Side"><button data-act="storySeat" data-story-seat="hero" aria-pressed="${seat === 'hero'}">${esc(person('hero').name)}</button><button data-act="storySeat" data-story-seat="villain" aria-pressed="${seat === 'villain'}">${esc(person('villain').name)}</button></div>` : ''}
      <span class="st-duel-stars">${starsRow(rec)}</span>
      <span class="st-reward">${prize}</span>
      <button class="pl-mode-cta st-play" data-act="storyPlay">${battleCleared(progress, b.id) ? 'Replay' : 'Duel'}</button>
    </div>
    ${listOpen ? `<section class="st-decks" id="stDeckList" aria-label="Decklist">
      <div class="st-lists">
        ${villainOpen ? `<div class="st-seg" role="group" aria-label="Decklist"><button data-act="storyListSide" data-story-list="mine" aria-pressed="${listSide === 'mine'}">Your deck</button><button data-act="storyListSide" data-story-list="theirs" aria-pressed="${listSide === 'theirs'}">Their deck</button></div>` : ''}
        ${listHtml}
      </div>
    </section>` : ''}
  </section>`;
}

// Talking heads: one line at a time, the speaker lit, everyone else dimmed. Tap to go on, Skip to end.
// Returns a promise that settles when the scene closes.
export function playScene({lines, cast, leftWho, rightWho, avatarUrl = '', title = '', doc = document}) {
  return new Promise(resolve => {
    if (!lines?.length) return resolve();
    const el = doc.createElement('div');
    el.className = 'st-scene'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title || 'Story');
    const faceUrl = who => who === 'you' ? avatarUrl : cast[who]?.portrait?.crop || '';
    const bg = cast[rightWho]?.portrait?.crop || cast[leftWho]?.portrait?.crop || '';
    el.innerHTML = `<span class="st-scene-bg" style="background-image:url(${esc(bg)})"></span>
      <figure class="st-talker st-talker--left"><span class="st-talker-face"></span></figure>
      <figure class="st-talker st-talker--right"><span class="st-talker-face"></span></figure>
      <div class="st-say" aria-live="polite"><b class="st-say-name"></b><p class="st-say-line"></p><span class="st-say-next" aria-hidden="true"></span></div>
      <button class="st-skip" type="button">Skip</button>`;
    const left = el.querySelector('.st-talker--left'), right = el.querySelector('.st-talker--right'), name = el.querySelector('.st-say-name'), text = el.querySelector('.st-say-line'), say = el.querySelector('.st-say');
    const setFace = (fig, who) => { const url = faceUrl(who), f = fig.querySelector('.st-talker-face'); fig.dataset.who = who || ''; fig.hidden = !url; f.style.backgroundImage = url ? `url("${url}")` : ''; f.style.backgroundPosition = cast[who]?.portrait?.focus || '50% 30%'; };
    setFace(left, leftWho); setFace(right, rightWho);
    let i = -1, typing = 0, full = '', closed = false;
    const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const close = () => { if (closed) return; closed = true; clearInterval(typing); el.classList.add('st-scene--out'); doc.removeEventListener('keydown', key, true); setTimeout(() => { el.remove(); resolve(); }, reduce ? 0 : 260); };
    const next = () => {
      if (typing) { clearInterval(typing); typing = 0; text.textContent = full; say.classList.add('done'); return; }
      i++; if (i >= lines.length) return close();
      const l = lines[i], stage = l.who === 'stage' || l.who === 'narrator';
      // A third speaker takes the side of whoever they stand with: the villain's side if it's the villain.
      if (!stage && l.who !== leftWho && l.who !== rightWho) { if (l.who === rightWho) setFace(right, l.who); else setFace(left, l.who); }
      const onRight = l.who === right.dataset.who;
      left.classList.toggle('on', !stage && !onRight); right.classList.toggle('on', !stage && onRight);
      el.classList.toggle('st-scene--stage', stage); say.classList.toggle('st-say--right', onRight); say.classList.toggle('st-say--whisper', !!l.whisper || !!l.offstage);
      name.textContent = stage ? '' : (cast[l.who]?.name || l.who);
      full = (l.aside ? `(${l.aside}) ` : '') + (l.quote ? `“${l.line}”` : l.line);
      say.classList.remove('done'); text.textContent = '';
      if (reduce) { text.textContent = full; say.classList.add('done'); return; }
      let k = 0; typing = setInterval(() => { k += 2; text.textContent = full.slice(0, k); if (k >= full.length) { clearInterval(typing); typing = 0; say.classList.add('done'); } }, 18);
    };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); } };
    el.addEventListener('click', e => { if (e.target.closest('.st-skip')) close(); else next(); });
    doc.addEventListener('keydown', key, true);
    doc.body.append(el);
    requestAnimationFrame(() => { el.classList.add('st-scene--in'); el.querySelector('.st-skip').focus({preventScroll: true}); next(); });
  });
}

// In-match speech: a bubble grows out of the speaker's seat portrait and fades. It never takes a tap
// and never pauses play. Cues: start, big (first creature of power 4+), low (life 5 or less), win, loss.
export function createStoryBubbles({root, battle, cast, playerSide, avatarUrl = '', doc = document, now = () => Date.now()}) {
  const cpuSide = playerSide === 'hero' ? 'villain' : 'hero';
  const said = new Set(), queue = [];
  let busy = false, mySeat = null, faced = false, disposed = false;
  const sideOf = who => who === 'me' ? playerSide : cpuSide;
  const speaker = side => battle[side].who;
  const lineFor = (side, cue) => battle.cues?.[side]?.[cue] || null;
  // The seat's portrait (its crest badge) when the table draws one, otherwise the seat itself.
  const seatEl = mine => root.querySelector(mine ? '.play-match-seat[data-seat="you"]' : '.play-match-seat[data-player-seat]:not([data-seat="you"])');
  const anchor = mine => { const s = seatEl(mine); return s?.querySelector('.play-match-profile-badge') || s; };
  function show({side, text}) {
    const mine = side === playerSide, who = speaker(side), url = who === 'you' ? avatarUrl : cast[who]?.portrait?.crop || '';
    const b = doc.createElement('div');
    b.className = `st-bubble ${mine ? 'st-bubble--me' : 'st-bubble--them'}`; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
    b.innerHTML = `${url ? `<span class="st-bubble-face" style="background-image:url(${esc(url)});background-position:${esc(cast[who]?.portrait?.focus || '50% 30%')}"></span>` : ''}<span class="st-bubble-copy"><b>${esc(cast[who]?.name || 'You')}</b><span>${esc(text)}</span></span>`;
    const a = anchor(mine), r = a?.getBoundingClientRect?.(), vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    if (r && r.width) {
      const x = Math.min(Math.max(12, r.left + r.width / 2 - 150), vw - 312);
      b.style.left = x + 'px';
      if (mine) b.style.bottom = Math.max(12, vh - r.top + 10) + 'px'; else b.style.top = Math.min(vh - 120, r.bottom + 10) + 'px';
      b.style.setProperty('--tail-x', Math.max(18, Math.min(282, r.left + r.width / 2 - x)) + 'px');
    } else b.classList.add(mine ? 'st-bubble--dock-me' : 'st-bubble--dock-them');
    root.append(b);
    requestAnimationFrame(() => b.classList.add('in'));
    return new Promise(done => setTimeout(() => { b.classList.remove('in'); b.classList.add('out'); setTimeout(() => { b.remove(); done(); }, 300); }, Math.min(5200, 2200 + text.length * 45)));
  }
  async function pump() { if (busy) return; busy = true; while (queue.length && !disposed) { await show(queue.shift()); await new Promise(r => setTimeout(r, 250)); } busy = false; }
  const say = (who, cue) => { const side = sideOf(who), key = side + ':' + cue; if (said.has(key)) return; said.add(key); const text = lineFor(side, cue); if (!text) return; queue.push({side, text}); pump(); };
  // The opponent's seat wears their character's portrait.
  function dressSeat() {
    const badge = seatEl(false)?.querySelector('.play-match-profile-badge'), who = speaker(cpuSide), url = who === 'you' ? avatarUrl : cast[who]?.portrait?.crop;
    if (!badge || !url || badge.querySelector(':scope>.st-seat-face')) return;
    const f = doc.createElement('span'); f.className = 'st-seat-face'; f.setAttribute('aria-hidden', 'true'); f.style.backgroundImage = `url("${url}")`; f.style.backgroundPosition = cast[who]?.portrait?.focus || '50% 30%'; badge.append(f); faced = true;
  }
  return {
    update(state) {
      if (disposed || state?.phase !== 'playing') return;
      const s = state.game?.status?.surface; if (!s) return;
      mySeat = s.seat ?? mySeat; dressSeat();
      if ((s.turn || 0) >= 1 && !said.has(cpuSide + ':start')) { say('cpu', 'start'); setTimeout(() => say('me', 'start'), 400); }
      for (const p of s.players || []) if (Number.isFinite(p.life) && p.life <= 5 && p.life > 0) say(p.seat === mySeat ? 'me' : 'cpu', 'low');
      for (const c of s.cards || []) if (c.zone === 'Battlefield' && c.types?.includes('Creature') && Number(c.power) >= 4) say(c.controller === mySeat ? 'me' : 'cpu', 'big');
    },
    finish(outcome) {
      if (disposed || !['win', 'loss'].includes(outcome)) return;
      say('cpu', outcome === 'win' ? 'loss' : 'win'); say('me', outcome === 'win' ? 'win' : 'loss');
    },
    destroy() { disposed = true; queue.length = 0; root.querySelectorAll('.st-bubble,.st-seat-face').forEach(n => n.remove()); },
    _faced: () => faced,
  };
}

// The Story tile on the Play home: the act you're on, its boss art, and where you are in it.
export function storyTileMarkup(progress) {
  const now = Math.min(currentAct(progress), STORY_ACTS.length), a = STORY_ACTS.find(x => x.act === now), done = currentAct(progress) > STORY_ACTS.length;
  const cleared = Array.from({length: 8}, (_, i) => battleCleared(progress, `a${now}b${i + 1}`)).filter(Boolean).length;
  return `<button class="pl-mode st-tile" data-act="storyHome"><span class="pl-mode-art" style="background-image:url(${esc(a.art.crop)});background-position:50% 35%" aria-hidden="true"></span>
    <span class="st-tile-copy"><span class="pl-mode-name">Story</span><span class="pl-mode-copy">${done ? 'Every act so far is cleared.' : `Act ${now} · ${esc(a.title)}`}</span>${symbols(a)}</span>
    <span class="pl-mode-foot">${done ? '' : ring(cleared, 8, cleared + ' of 8 battles won')}<span class="pl-mode-cta">${cleared || now > 1 ? 'Continue' : 'Begin'}</span></span></button>`;
}
export {STAR_VALUE};
