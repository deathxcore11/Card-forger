// The menu screens: main menu, duelist select, map select with Oaths, Card Library, Quests, Settings. Plain placeholder styling; everything
// shown comes from data (src/data/progress.js, quests.js, cards.js, items.js) and the saved progress (src/core/meta.js).
import { DUELIST_INFO, DUELIST_ORDER, MASTERY, MAPS, DIFF_CHIPS, OATHS, OATH_BY_ID, masteryRank, USEFUL_BY_ATTACK, USEFUL_BY_ELEMENT, LIBRARY_MIN } from '../data/progress.js';
import { BOARDS, START_BOARDS } from '../data/boards.js';
import { QUESTS, QUEST_TABS, RARITY_COLOUR } from '../data/quests.js';
import { DIFFICULTY, DIFFICULTIES } from '../data/stages.js';
import { MONSTERS, FUSIONS, SPELLS, TRAPS, ONE_SHOTS, DUELISTS } from '../data/cards.js';
import { ITEMS } from '../data/items.js';
import { boardUrl, fetchBoard } from '../core/board.js';
import { deviceClass } from '../ui/device.js';
import { settingsHtml, bindSettingsScreen, tabsFor } from './settings-screen.js';
import { firstPad } from '../core/padnav.js';
import { SEALS } from '../data/seals.js';
import { oathOpen, diffUnlocked, questProgress, questDone, closestQuests, questFor, mapRecord, masteryOf, outfitUnlocked, setCardEnabled } from '../core/meta.js';
import { startBakedPreview } from './portraits.js';
import { BASICS, FAMILIES } from '../data/roster.js';
import { summonMeta, summonOwned, nearestSummons, gameId } from '../core/summonUnlocks.js';
import { thumbInto, HAND_BODY } from './thumbs.js';

// element colours of the Bestiary cards (violet is the Fusion colour and is used for Fusions only)
const EL_COL = { fire: '#ff8a4c', lightning: '#ffe14a', ice: '#7fd8ff', light: '#fff2b8', dark: '#8f9bff', earth: '#d9b06a', poison: '#9be35a', wind: '#9ff0d0', fusion: '#b26bff' };
const EL_NAME = { fire: 'Fire', lightning: 'Lightning', ice: 'Ice', light: 'Light', dark: 'Dark', earth: 'Earth', poison: 'Poison', wind: 'Wind', fusion: 'Fusion' };
const FAM = Object.fromEntries(FAMILIES.map(f => [f.id, f]));
const stagger = el => { let i = 0; for (const x of el.querySelectorAll('.qcard, .bcell, .portrait, .bGoal, .diffRow, #dSummons .newSum')) x.style.setProperty('--n', i++); };
export const summonArt = (b, i) => { const g = gameId(b.id), H = HAND_BODY[g], D = MONSTERS[g]; return H ? H[Math.min(i, H.length - 1)] : D && D.roster && D.forms[i] ? D.forms[i].modelId : (b.forms[i] && b.forms[i].model) || b.id + (i + 1); };       // the block model of a summon's form, by the same rule the field uses
const shortLine = l => l.replace(/ \(Its own feat comes later.*$/, '');
const TITLE = 'DUEL SUMMONER'.split('').map((c, i) => c === ' ' ? ' ' : '<span style="--i:' + i + '">' + c + '</span>').join('');
const EQ = '<div class="flEq" aria-hidden="true">' + [0.5, 0.9, 0.65, 1.1, 0.8, 1.25, 0.7, 1, 1.3, 0.75, 1.15, 0.6, 0.95, 0.55].map((k, i) => '<i style="--k:' + k + ';--d:' + (60 + (i * 53) % 190) + 'ms"></i>').join('') + '</div>';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const clockText = s => { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const bar = (frac, label) => '<div class="bar2"><i style="width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%"></i><span>' + (label || '') + '</span></div>';
const initial = id => (DUELIST_INFO[id] ? DUELIST_INFO[id].name[0] : '?');
const rewardText = r => !r ? '' : r.chips ? r.chips + ' Star Chips' : r.card ? 'Unlocks card: ' + (MONSTERS[r.card] || SPELLS[r.card] || TRAPS[r.card] || ONE_SHOTS[r.card] || { name: r.card }).name : r.item ? 'Unlocks item: ' + (ITEMS[r.item] ? ITEMS[r.item].name : r.item) :
  r.duelist ? 'Unlocks duelist: ' + DUELIST_INFO[r.duelist].name : r.outfit ? 'Unlocks an outfit' : r.regalia ? 'Unlocks Regalia' : '';
const STAT_LABEL = { reach: 'Reach', burnDps: 'Burn', burnDur: 'Burn', markDur: 'Mark Depth', markBonus: 'Mark Depth', cardRate: 'Draw', move: 'Stride', dash: 'Dash', maxLp: 'Max LP', pickup: 'Magnet', xp: 'Insight', coinMult: 'Greed', luck: 'Fortune', armour: 'Guard', crit: 'Keen', dmgMult: 'Might', bossDmg: 'Hunter', monsterRate: 'Tempo', regen: 'Renewal', trapRecharge: 'Rewind', shopDiscount: 'Bargain', cardBurn: 'Affinity: Fire' };

export function initMenus(env) {
  const save = env.save, meta = () => save.meta, portraits = env.portraits || {};
  const sel = { duelist: 'kael', map: MAPS[0].id, difficulty: save.settings.difficulty || 'medium', oaths: [] };
  let preview = null, oathPanel = false, questTab = 'General', libTab = 'Monsters', hideDone = false, note = '', lastKey = '', libSel = '', libEl = '';
  const stopPreview = () => { if (preview) { preview.stop(); preview = null; } };
  const persist = () => env.persist();
  const root = () => $('menuBody');
  const open = (html, key) => { document.body.dataset.cam = 'center'; stopPreview(); $('startScreen').classList.remove('on'); $('menuScreen').classList.add('on'); const R = root(), sc = key === lastKey ? [].map.call(R.querySelectorAll('.bGrid, .bDetail, .list, .qgrid'), x => x.scrollTop) : null; R.innerHTML = html; R.classList.toggle('fl-enter', key !== lastKey); if (sc) [].forEach.call(R.querySelectorAll('.bGrid, .bDetail, .list, .qgrid'), (x, i) => { x.scrollTop = sc[i] || 0; }); lastKey = key; stagger(R); };       // a screen's parts rise in only when it is first opened; a click inside it redraws in place and keeps its scroll
  const tabs = (names, cur, attr) => '<div class="tabs">' + names.map(n => '<button class="tab' + (n === cur ? ' sel' : '') + '" data-' + attr + '="' + n + '">' + n + '</button>').join('') + '</div>';

  // ---------- main menu ----------
  function showMain() {
    stopPreview(); document.body.dataset.cam = 'center'; $('menuScreen').classList.remove('on'); $('startScreen').classList.add('on'); lastKey = '';
    const tracker = closestQuests(meta(), 12).filter((x, i, A) => A.findIndex(y => y.q.name.replace(/ rank \d+$/, '') === x.q.name.replace(/ rank \d+$/, '')) === i).slice(0, 3).map(({ q, frac }) => '<div class="trk"><b>' + q.name + '</b><span>' + questProgress(meta(), q) + ' / ' + q.goal + '</span>' + bar(frac) + '</div>').join('');
    const recs = []; for (const map of MAPS) for (const d of DIFFICULTIES) { const r = mapRecord(meta(), map.id, d, 'run'); if (r.bestScore) recs.push(map.name + ', ' + DIFFICULTY[d].name + ': ' + r.bestScore + (r.bestTime ? ' (' + clockText(r.bestTime) + ')' : '')); }
    const now = new Date(), nextMon = new Date(now); nextMon.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); nextMon.setHours(0, 0, 0, 0); const ms = nextMon - now, dd = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5);
    const ns = nearestSummons(meta(), 1)[0], sumRow = ns ? '<div class="trk"><b>New summon</b><span>' + ns.have + ' / ' + ns.need + '</span><div class="dim" style="font-size:12px;clear:both">' + esc(shortLine(ns.line)) + '</div>' + bar(ns.frac) + '</div>' : '';
    $('startScreen').innerHTML = '<div class="flMandala" aria-hidden="true"></div><div class="chipsTop">Star Chips <b>' + save.starChips + '</b></div><h1 class="flTitle" aria-label="Duel Summoner">' + TITLE + '</h1>' + EQ +
      '<div class="mainRow fl-enter"><div class="mainBtns"><button id="mPlay">PLAY</button><button id="mShop">DECK BOX</button><button id="mLib">BESTIARY</button><button id="mQuests">QUESTS</button><button id="mSettings">SETTINGS</button><button id="mQuick">QUICK DUEL</button></div>' +
      '<div class="mainMid"></div><div class="mainSide"><div class="panel goals"><h3>NEXT GOALS</h3>' + (tracker || '<p>No quests in progress.</p>') + sumRow + '</div>' +
      '</div></div>';       // (the weekly leaderboard panel is gone: leaderboards were skipped, 27 Nov)
    $('mPlay').onclick = showDuelists; const gl = document.querySelector('.goals'); if (gl) gl.onclick = () => gl.classList.toggle('open'); $('mLib').onclick = () => showLibrary(); $('mQuests').onclick = () => showQuests(); $('mShop').onclick = () => { $('startScreen').classList.remove('on'); env.showDeckBox(); };
    $('mSettings').onclick = showSettings; $('mQuick').onclick = () => start('quick');
    const base = boardUrl(save.settings);
    if (base) {                                                                  // live board: difficulty tabs, this week, verified runs only
      const draw = diff => fetchBoard(base, 'run', diff, 'week').then(b => {
        const el = $('lbOnline'); if (!el) return;
        el.innerHTML = '<div class="tabs">' + DIFFICULTIES.filter(d => diffUnlocked(meta(), MAPS[0].id, d)).map(d => '<button class="tab' + (d === diff ? ' sel' : '') + '" data-lbd="' + d + '">' + DIFFICULTY[d].name + '</button>').join('') + '</div>' +
          (b.top.length ? b.top.slice(0, 10).map(r => '<div class="lbrow">#' + r.rank + ' ' + esc(r.name) + ' <b>' + r.score + '</b> <span class="dim">' + clockText(r.runMs / 1000) + '</span></div>').join('') : '<p class="dim">No verified runs this week.</p>') +
          (b.me && b.me.rank > 10 ? '<div class="lbrow">#' + b.me.rank + ' You <b>' + b.me.score + '</b></div>' : '');
        for (const t of el.querySelectorAll('[data-lbd]')) t.onclick = () => draw(t.dataset.lbd);
      }).catch(() => { const el = $('lbOnline'); if (el) el.innerHTML = '<p class="dim">Could not reach the leaderboard.</p>'; });
      draw('easy');
    }
  }

  // ---------- duelist select ----------
  function showDuelists() {
    const unlocked = id => meta().duelists.includes(id) && !DUELIST_INFO[id].locked || meta().duelists.includes(id);
    if (!unlocked(sel.duelist)) sel.duelist = 'kael';
    const grid = DUELIST_ORDER.map(id => { const D = DUELIST_INFO[id], open = unlocked(id); return '<button class="portrait' + (id === sel.duelist ? ' sel' : '') + (open ? '' : ' locked') + '" data-d="' + id + '"><span class="face" style="' + (open ? 'background:#' + D.color.toString(16).padStart(6, '0') : '') + '">' + (open ? (portraits[id] ? '<img class="faceImg" alt="" src="' + portraits[id].tile + '">' : '<img class="faceImg" alt="" hidden data-art="' + id + '"><b>' + initial(id) + '</b>') : '?') + '</span><small>' + (open ? D.name : '???') + '</small></button>'; }).join('');
    const D = DUELIST_INFO[sel.duelist], mst = masteryOf(meta(), sel.duelist), m = meta().mastery[sel.duelist] || { runs: 0, kills: 0 };
    const outfits = D.outfits.map(o => '<span class="slot' + (outfitUnlocked(meta(), sel.duelist, o) ? ' on' : '') + '" title="' + o.name + '">' + (outfitUnlocked(meta(), sel.duelist, o) ? o.name[0] : '&#128274;') + '</span>').join('') + '<span class="slot" title="locked">&#128274;</span>';
    open('<div class="selWrap"><div class="selLeft"><h2>CHOOSE YOUR DUELIST</h2><div class="portraits">' + grid + '</div></div><div class="selRight panel">' +
      (portraits[sel.duelist] ? '<canvas id="duelPreview" width="120" height="140" class="prev"></canvas>' : '<img class="prev bob" alt="" hidden data-art="' + sel.duelist + '">') + '<h2>' + D.name + ', ' + D.title + '</h2>' +
      '<div>Mastery rank <b>' + mst.rank + '</b> ' + bar(mst.frac, mst.next === null ? 'max' : mst.points + ' / ' + mst.next) + '</div>' +
      '<div class="dim">Runs played ' + m.runs + ' &middot; kills ' + m.kills + '</div><p class="joke">&ldquo;' + D.joke + '&rdquo;</p>' +
      '<div><b>Starts with</b> ' + (D.start ? MONSTERS[D.start].name : 'coming later') + '</div><div><b>Passive</b> ' + D.passive + '</div>' + (DUELISTS[sel.duelist] && DUELISTS[sel.duelist].rideStyle ? '<div><b>Ride style</b> ' + DUELISTS[sel.duelist].rideStyle.name + ': ' + DUELISTS[sel.duelist].rideStyle.text + '</div>' : '') +
      '<div class="rowLabel">Outfits</div><div class="slots slotRow">' + outfits + '<span>Regalia</span><span class="slot" title="Regalia slot">&#128081;</span></div>' + boardRow() + '</div></div>' +
      '<div class="navRow"><button id="selBack" class="small">BACK</button><button id="selNext"' + (D.locked || !unlocked(sel.duelist) ? ' disabled' : '') + '>NEXT: CHOOSE A MAP</button></div>', 'duelists');
    document.body.dataset.cam = 'left';       // the Camp camera puts the live duelist on the left, the panels on the right
    preview = portraits[sel.duelist] ? startBakedPreview($('duelPreview'), portraits[sel.duelist]) : null; for (const im of root().querySelectorAll('img[data-art]')) thumbInto(im, im.dataset.art);       // the real model from its baked frames; the robe stand-in only when a model is missing
    for (const b of root().querySelectorAll('[data-board]')) b.onclick = () => { const M = meta(); if ((M.boards || START_BOARDS).includes(b.dataset.board)) { M.board = b.dataset.board; if (env.persist) env.persist(); showDuelists(); } };
    for (const b of root().querySelectorAll('.portrait')) b.onclick = () => { if (unlocked(b.dataset.d)) { sel.duelist = b.dataset.d; showDuelists(); } else { sel.duelist = b.dataset.d; showDuelists(); } };
    $('selBack').onclick = showMain; $('selNext').onclick = showMaps;
  }

  // ---------- map select ----------
  function showMaps() {
    const map = MAPS.find(m => m.id === sel.map) || MAPS[0];
    if (!diffUnlocked(meta(), map.id, sel.difficulty)) { sel.difficulty = 'easy'; save.settings.difficulty = 'easy'; }       // a locked difficulty can never stay picked
    const rows = DIFFICULTIES.map((d, i) => { const r = mapRecord(meta(), map.id, d, 'run'), D = DIFFICULTY[d], open = diffUnlocked(meta(), map.id, d);
      if (!open) return '<label class="diffRow locked" title="Locked"><input type="radio" name="dif" value="' + d + '" disabled><b>' + D.name + '</b><span class="dstats"><span class="lockTxt">&#128274; Clear ' + DIFFICULTY[DIFFICULTIES[i - 1]].name + ' to unlock</span></span></label>';
      return '<label class="diffRow' + (sel.difficulty === d ? ' sel' : '') + '"><input type="radio" name="dif" value="' + d + '"' + (sel.difficulty === d ? ' checked' : '') + '><b>' + D.name + '</b><span class="dstats"><span>Star Chips x' + DIFF_CHIPS[d].toFixed(1) + '</span><span>Score x' + D.score + '</span><span>Best ' + (r.bestScore || '-') + '</span><span>Clear ' + (r.bestTime ? clockText(r.bestTime) : '-') + '</span><span class="icons">' + (r.cleared.length ? r.cleared.map(id => '<i class="mini">' + initial(id) + '</i>').join('') : '<i class="dim">none yet</i>') + '</span></span></label>'; }).join('');
    const fresh = env.freshSeals ? env.freshSeals() : [];
    sel.oaths = sel.oaths.filter(id => oathOpen(meta(), id));       // a sealed Oath can never be sworn
    const oathHtml = oathPanel ? '<div class="panel oaths"><h3>OATHS</h3><p class="dim">Sworn before the run. Each adds to the score multiplier, and keeping one by clearing the run earns its quest reward. Every Oath starts sealed: do its feat in a normal run (no Oath sworn) to break the seal.</p>' +
      OATHS.map(o => oathOpen(meta(), o.id)
        ? '<label class="oathRow' + (fresh.includes(o.id) ? ' fresh' : '') + '"><input type="checkbox" data-oath="' + o.id + '"' + (sel.oaths.includes(o.id) ? ' checked' : '') + '><b>' + o.name + '</b> ' + o.text + ' <span class="dim">(+' + o.scorePct + '% score, ' + o.reward.chips + ' chips)</span></label>'
        : '<div class="oathRow sealed" data-sealed="' + o.id + '"><span class="waxSeal" aria-hidden="true"></span><span><b>Sealed Oath</b> <span class="riddle">&ldquo;' + esc(SEALS[o.id] ? SEALS[o.id].riddle : 'Its seal is unbroken.') + '&rdquo;</span></span></div>').join('') + '<button class="small" id="oathDone">DONE</button></div>' : '';
    open('<h2>CHOOSE A MAP</h2><div class="selWrap"><div class="selLeft"><div class="mapList"><button class="portrait sel wide" data-m="' + map.id + '"><b>' + map.name + '</b><small>' + map.blurb + '</small></button><button class="portrait locked wide" disabled><b>???</b><small>More maps later.</small></button></div></div>' +
      '<div class="selRight panel"><h3>' + map.name + '</h3><p>' + map.blurb + '</p><div class="dim">Stages: ' + map.stages + '</div><div class="diffs">' + rows + '</div>' +
      '<div class="navRow"><button class="small" id="mapOaths">OATHS' + (sel.oaths.length ? ' (' + sel.oaths.length + ')' : '') + '</button></div>' + oathHtml + '</div></div>' +
      '<div class="navRow"><button id="mapBack" class="small">BACK</button><button id="mapQuick" class="small">QUICK DUEL (1 stage)</button><button id="mapGo">CONFIRM</button></div>', 'maps');
    for (const r of root().querySelectorAll('input[name=dif]')) r.onchange = () => { sel.difficulty = r.value; save.settings.difficulty = r.value; persist(); showMaps(); };
    $('mapOaths').onclick = () => { oathPanel = !oathPanel; showMaps(); };
    for (const c of root().querySelectorAll('[data-oath]')) c.onchange = () => { const id = c.dataset.oath; sel.oaths = c.checked ? sel.oaths.concat(id) : sel.oaths.filter(x => x !== id); showMaps(); };
    if ($('oathDone')) $('oathDone').onclick = () => { oathPanel = false; showMaps(); };
    $('mapBack').onclick = showDuelists; $('mapGo').onclick = () => start('run'); $('mapQuick').onclick = () => start('quick');
  }
  // the card back you ride on the big desert: the three you start with and the ones earned on the ride quests
  function boardRow() { const M = meta(), owned = M.boards || START_BOARDS, cur = owned.includes(M.board) ? M.board : 'plain-back', hex = c => '#' + c.toString(16).padStart(6, '0'); return '<div class="rowLabel">Board <b>' + BOARDS[cur].name + '</b></div><div class="slots slotRow">' + Object.keys(BOARDS).map(id => { const B = BOARDS[id], has = owned.includes(id); return '<button class="bcard' + (id === cur ? ' on' : '') + (has ? '' : ' locked') + '"' + (has ? '' : ' disabled') + ' data-board="' + id + '" title="' + B.name + ': ' + (has ? B.text : 'earned on a ride quest (Quests, Riding)') + '" style="background:linear-gradient(180deg,' + hex(B.face) + ',' + hex(B.face) + ' 60%,' + hex(B.edge) + ');border-color:' + hex(B.edge) + '"><i></i>' + (has ? '' : '<b>&#128274;</b>') + '</button>'; }).join('') + '</div><div class="dim bpick">Riding <b>' + BOARDS[cur].name + '</b>: ' + BOARDS[cur].text + '</div>'; }       // each board a small upright card back in its own face and edge; locked ones carry the lock; the picked one a gold ring, its name and lean below
  function start(mode) { if (!diffUnlocked(meta(), sel.map, sel.difficulty)) sel.difficulty = 'easy'; stopPreview(); $('menuScreen').classList.remove('on'); $('startScreen').classList.remove('on'); env.begin(mode, { duelist: sel.duelist, difficulty: sel.difficulty, oaths: sel.oaths.slice(), map: sel.map }); }

  // ---------- Card Library ----------
  function libEntries(tab) {
    const mt = meta(), out = [];
    if (tab === 'Duelists') for (const id of DUELIST_ORDER) out.push({ id, kind: 'duelist', name: DUELIST_INFO[id].name + ', ' + DUELIST_INFO[id].title, open: mt.duelists.includes(id), text: DUELIST_INFO[id].passive, useful: [], toggle: false });
    else if (tab === 'Monsters') for (const id of Object.keys(MONSTERS).concat(Object.keys(FUSIONS))) { const D = MONSTERS[id] || FUSIONS[id], fus = !!FUSIONS[id]; out.push({ id, kind: 'card', name: D.name, open: fus || mt.unlockedCards.includes(id), text: D.text, useful: USEFUL_BY_ATTACK[D.attack.kind].concat((D.elements || []).map(e => USEFUL_BY_ELEMENT[e])), toggle: !fus }); }
    else if (tab === 'Spells/Traps') for (const [set, label] of [[SPELLS, 'Spell'], [TRAPS, 'Trap'], [ONE_SHOTS, 'Spell (acts once)']]) for (const id of Object.keys(set)) out.push({ id, kind: 'card', name: set[id].name + ' (' + label + ')', open: mt.unlockedCards.includes(id), text: set[id].text, useful: Array.from(new Set(Object.keys(set[id].per || {}).map(k => STAT_LABEL[k] || k))), toggle: true });
    else if (tab === 'Items') for (const id of Object.keys(ITEMS)) out.push({ id, kind: 'item', name: ITEMS[id].name + ' (' + ITEMS[id].rarity + ')', open: !!ITEMS[id].v2 || mt.unlockedItems.includes(id), text: ITEMS[id].text || '', useful: Array.from(new Set(Object.keys(ITEMS[id].mods || {}).map(k => STAT_LABEL[k] || k))), toggle: true });
    else for (const q of QUESTS.filter(q => q.reward && q.reward.regalia)) out.push({ id: q.reward.regalia, kind: 'regalia', name: q.name, open: mt.regalia.includes(q.reward.regalia), text: 'A hat or trinket for your duelist.', useful: [], toggle: false });
    return out;
  }
  // The Bestiary: only what this save has found, each a card with its own model picture and element colour; a click shows it large with its forms.
  // What is not found yet is never drawn as a grey slot: a count, and the goals closest to done, say what is left.
  function showLibrary(tab) {
    if (tab) { if (tab !== libTab) { libSel = ''; libEl = ''; } libTab = tab; } const mt = summonMeta(meta()), off = new Set(mt.libraryOff);
    let cells = [], total = 0, goals = [];
    if (libTab === 'Monsters') {
      total = BASICS.length;
      for (const b of BASICS) { if (!summonOwned(mt, b.id)) continue; const g = gameId(b.id), D = MONSTERS[g]; cells.push({ id: b.id, gid: g, name: b.name, el: b.element, sub: b.rarity, art: summonArt(b, 0), text: (D && D.text) || b.text, tags: [b.job, (FAM[b.family] || {}).core ? '' : (FAM[b.family] || {}).name, b.species].filter(Boolean), forms: b.forms.map((f, i) => ({ lv: f.fromLevel, art: summonArt(b, i) })), best: Math.max(mt.sumBest[b.id] || 0, mt.sumBest[g] || 0), toggle: mt.unlockedCards.includes(g), useful: D ? USEFUL_BY_ATTACK[D.attack.kind].concat((D.elements || []).map(e => USEFUL_BY_ELEMENT[e])) : [] }); }
      for (const id of Object.keys(FUSIONS)) { const D = FUSIONS[id]; if (!(mt.fusionsSeen || []).includes(id) && !(mt.sumBest[id] > 0)) continue; total++; cells.push({ id, gid: id, name: D.name, el: 'fusion', sub: 'fusion', art: (HAND_BODY[id] || [])[0], text: D.text, tags: ['Fusion'], forms: [], best: mt.sumBest[id] || 0, toggle: false, useful: [] }); }
      goals = nearestSummons(mt, 6).map(g => ({ line: shortLine(g.line), have: g.have, need: g.need }));
    } else {
      const all = libEntries(libTab); total = all.length;
      for (const e of all) { if (!e.open) continue; cells.push({ id: e.id, gid: e.id, name: e.name, el: '', sub: libTab === 'Items' ? ITEMS[e.id].rarity : '', art: e.kind === 'item' && ITEMS[e.id].v2 ? 'it-' + e.id : '', img: e.kind === 'duelist' && portraits[e.id] ? portraits[e.id].tile : '', text: e.text, tags: [], forms: [], best: 0, toggle: e.toggle, useful: e.useful }); }
      const seen = new Set(); for (const e of all) { if (e.open) continue; const q = questFor(e.kind, e.id); if (!q || seen.has(q.id || q.name)) continue; seen.add(q.id || q.name); goals.push({ line: q.name + ': ' + q.text, have: questProgress(mt, q), need: q.goal }); }
      goals = goals.sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 6);
    }
    const els = libTab === 'Monsters' ? Array.from(new Set(cells.map(c => c.el))) : []; if (libEl && !els.includes(libEl)) libEl = '';
    const shown = libEl ? cells.filter(c => c.el === libEl) : cells; if (!shown.some(c => c.id === libSel)) libSel = shown[0] ? shown[0].id : '';
    const C = shown.find(c => c.id === libSel), col = c => EL_COL[c.el] || (c.sub && RARITY_COLOUR[c.sub]) || '#E8C46E';
    const grid = shown.map(c => '<button class="bcell' + (c.id === libSel ? ' sel' : '') + (c.toggle && off.has(c.gid) ? ' off' : '') + '" data-cell="' + c.id + '" style="--ec:' + col(c) + '"><span class="art">' + (c.img ? '<img alt="" src="' + c.img + '">' : c.art ? '<img alt="" hidden data-art="' + c.art + '">' : esc(c.name[0])) + '</span>' + esc(c.name) + (c.el || c.sub ? '<small>' + esc(EL_NAME[c.el] || c.sub) + '</small>' : '') + '</button>').join('');
    const detail = C ? '<div class="bDetail panel" style="--ec:' + col(C) + '">' + (C.img ? '<img class="big" alt="" src="' + C.img + '">' : C.art ? '<img class="big" alt="" hidden data-art="' + C.art + '">' : '') + '<h3>' + esc(C.name) + '</h3><div class="bTags">' + (C.el ? '<span class="el">' + EL_NAME[C.el] + '</span>' : '') + (C.sub && C.sub !== 'fusion' ? '<span>' + esc(C.sub) + '</span>' : '') + C.tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div><div>' + (C.text || '') + '</div>' +
      (C.forms.length ? '<div class="bForms">' + C.forms.map(f => '<div><img alt="" hidden data-art="' + f.art + '">Level ' + f.lv + '</div>').join('') + '</div>' : '') + (C.best ? '<div class="dim">Best level reached: <b>' + C.best + '</b></div>' : '') + (C.useful.length ? '<div class="dim">Useful stats: ' + C.useful.join(', ') + '</div>' : '') +
      (C.toggle ? '<label class="chk"><input type="checkbox" data-id="' + C.gid + '"' + (off.has(C.gid) ? '' : ' checked') + '> in offers</label>' : '') + '</div>' : '';
    const goalHtml = goals.length ? '<div class="bGoalsT">' + (libTab === 'Monsters' ? 'NEXT DISCOVERIES' : 'CLOSEST TO UNLOCKING') + '</div><div class="bGoals">' + goals.map(g => '<div class="bGoal"><span class="q">?</span><div class="g"><i class="n">' + g.have + ' / ' + g.need + '</i>' + esc(g.line) + bar(g.have / g.need) + '</div></div>').join('') + '</div>' : '';
    const enabled = mt.unlockedCards.concat(mt.unlockedItems).filter(c => !off.has(c)).length;
    open('<h2>BESTIARY</h2>' + tabs(['Duelists', 'Monsters', 'Spells/Traps', 'Items', 'Regalia'], libTab, 'tab') +
      '<div class="bHead"><span class="bCount"><b>' + cells.length + '</b> / ' + total + ' found</span>' + bar(total ? cells.length / total : 0) + '</div>' +
      (els.length > 1 ? '<div class="bChips"><button class="bChip' + (libEl ? '' : ' sel') + '" data-el="">All</button>' + els.map(e => '<button class="bChip' + (libEl === e ? ' sel' : '') + '" data-el="' + e + '" style="--ec:' + EL_COL[e] + '">' + EL_NAME[e] + '</button>').join('') + '</div>' : '') +
      (cells.length ? '<div class="bWrap">' + '<div class="bGrid">' + grid + '</div>' + detail + '</div>' : '<p class="dim">Nothing found here yet.</p>') + goalHtml +
      (note ? '<p><b style="color:#ff9a7a">' + note + '</b></p>' : '') + '<div class="navRow"><button id="libBack" class="small">BACK</button><span class="dim">' + enabled + ' cards and items are in your offer pool (at least ' + LIBRARY_MIN + ' must stay on).</span></div>', 'lib:' + libTab);
    for (const im of root().querySelectorAll('img[data-art]')) thumbInto(im, im.dataset.art);
    for (const t of root().querySelectorAll('[data-tab]')) t.onclick = () => { note = ''; showLibrary(t.dataset.tab); };
    for (const t of root().querySelectorAll('[data-cell]')) t.onclick = () => { libSel = t.dataset.cell; showLibrary(); };
    for (const t of root().querySelectorAll('[data-el]')) t.onclick = () => { libEl = t.dataset.el; showLibrary(); };
    for (const c of root().querySelectorAll('[data-id]')) c.onchange = () => { const ok = setCardEnabled(mt, c.dataset.id, c.checked); note = ok ? '' : 'At least ' + LIBRARY_MIN + ' must stay in the pool.'; persist(); showLibrary(); };
    $('libBack').onclick = () => { note = ''; showMain(); };
  }

  // ---------- Quests ----------
  function showQuests(tab) {
    if (tab) questTab = tab; const mt = meta();
    let list = QUESTS.filter(q => q.tab === questTab).map(q => ({ q, done: questDone(mt, q), frac: questProgress(mt, q) / q.goal }));
    list.sort((a, b) => (a.done - b.done) || (b.frac - a.frac));
    if (hideDone) list = list.filter(x => !x.done);
    const cards = list.map(({ q, done, frac }) => '<div class="qcard' + (done ? ' done' : '') + '" style="border-color:' + RARITY_COLOUR[q.rarity] + ';--rc:' + RARITY_COLOUR[q.rarity] + '"><div class="qhead"><b>' + q.name + '</b><span style="color:' + RARITY_COLOUR[q.rarity] + '">' + q.rarity + '</span></div><div>' + q.text + '</div>' +
      bar(frac, done ? 'Done' : questProgress(mt, q) + ' / ' + q.goal) + '<div class="dim">Reward: ' + rewardText(q.reward) + (q.stat === 'manual' ? ' &middot; not earnable yet' : '') + '</div></div>').join('');
    open('<h2>QUESTS</h2>' + tabs(QUEST_TABS, questTab, 'qt') + '<div class="navRow"><label class="chk"><input type="checkbox" id="hideDone"' + (hideDone ? ' checked' : '') + '> hide completed</label></div><div class="qgrid">' + (cards || '<p class="dim">Nothing here.</p>') + '</div><div class="navRow"><button id="qBack" class="small">BACK</button></div>', 'quests');
    for (const t of root().querySelectorAll('[data-qt]')) t.onclick = () => showQuests(t.dataset.qt);
    $('hideDone').onchange = e => { hideDone = e.target.checked; showQuests(); }; $('qBack').onclick = showMain;
  }

  // ---------- Settings ----------
  let setTab = 'game', setOpts = {};
  function showSettings(tab, opts) {
    if (typeof tab === 'string') setTab = tab; if (opts) setOpts = opts; else if (typeof tab !== 'string') setOpts = {};
    const cls = deviceClass(), ctx = { cls, pad: !!firstPad(), dual: true, gyro: false, keyboard: false, signedIn: false, inRun: !!setOpts.inRun, version: (document.getElementById('buildLabel') || {}).textContent || '' };
    { const tl = tabsFor(save, ctx); if (!tl.includes(setTab)) setTab = tl[0] || 'game'; }
    open(settingsHtml(save, setTab, ctx), 'settings');
    const draw = () => showSettings(setTab, setOpts), live = (id, dragging) => { if (!dragging) persist(); env.bindSettings(); };
    for (const t of root().querySelectorAll('[data-stab]')) t.onclick = () => showSettings(t.dataset.stab, setOpts);
    bindSettingsScreen(root(), save, ctx, draw, live);
    $('setBack').onclick = setOpts.back ? () => { const b = setOpts.back; setOpts = {}; b(); } : showMain;
  }
  return { showMain, showDuelists, showMaps, showLibrary, showQuests, showSettings, sel };
}
