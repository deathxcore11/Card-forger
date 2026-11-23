// The menu screens: main menu, duelist select, map select with Oaths, Card Library, Quests, Settings. Plain placeholder styling; everything
// shown comes from data (src/data/progress.js, quests.js, cards.js, items.js) and the saved progress (src/core/meta.js).
import { DUELIST_INFO, DUELIST_ORDER, MASTERY, MAPS, DIFF_CHIPS, OATHS, OATH_BY_ID, masteryRank, USEFUL_BY_ATTACK, USEFUL_BY_ELEMENT, LIBRARY_MIN } from '../data/progress.js';
import { QUESTS, QUEST_TABS, RARITY_COLOUR } from '../data/quests.js';
import { DIFFICULTY, DIFFICULTIES } from '../data/stages.js';
import { MONSTERS, FUSIONS, SPELLS, TRAPS, ONE_SHOTS } from '../data/cards.js';
import { ITEMS } from '../data/items.js';
import { boardUrl, fetchBoard } from '../core/board.js';
import { questProgress, questDone, closestQuests, questFor, mapRecord, masteryOf, outfitUnlocked, setCardEnabled } from '../core/meta.js';
import { startPreview } from './preview.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const clockText = s => { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const bar = (frac, label) => '<div class="bar2"><i style="width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%"></i><span>' + (label || '') + '</span></div>';
const initial = id => (DUELIST_INFO[id] ? DUELIST_INFO[id].name[0] : '?');
const rewardText = r => !r ? '' : r.chips ? r.chips + ' Star Chips' : r.card ? 'Unlocks card: ' + (MONSTERS[r.card] || SPELLS[r.card] || TRAPS[r.card] || ONE_SHOTS[r.card] || { name: r.card }).name : r.item ? 'Unlocks item: ' + (ITEMS[r.item] ? ITEMS[r.item].name : r.item) :
  r.duelist ? 'Unlocks duelist: ' + DUELIST_INFO[r.duelist].name : r.outfit ? 'Unlocks an outfit' : r.regalia ? 'Unlocks Regalia' : '';
const STAT_LABEL = { reach: 'Reach', burnDps: 'Burn', burnDur: 'Burn', markDur: 'Mark Depth', markBonus: 'Mark Depth', cardRate: 'Draw', move: 'Stride', dash: 'Dash', maxLp: 'Max LP', pickup: 'Magnet', xp: 'Insight', coinMult: 'Greed', luck: 'Fortune', armour: 'Guard', crit: 'Keen', dmgMult: 'Might', bossDmg: 'Hunter', monsterRate: 'Tempo', regen: 'Renewal', trapRecharge: 'Rewind', shopDiscount: 'Bargain', cardBurn: 'Affinity: Fire' };

export function initMenus(env) {
  const save = env.save, meta = () => save.meta;
  const sel = { duelist: 'kael', map: MAPS[0].id, difficulty: save.settings.difficulty || 'medium', oaths: [] };
  let preview = null, oathPanel = false, questTab = 'General', libTab = 'Monsters', hideDone = false, note = '';
  const stopPreview = () => { if (preview) { preview.stop(); preview = null; } };
  const persist = () => env.persist();
  const root = () => $('menuBody');
  const open = html => { stopPreview(); $('startScreen').classList.remove('on'); $('menuScreen').classList.add('on'); root().innerHTML = html; };
  const tabs = (names, cur, attr) => '<div class="tabs">' + names.map(n => '<button class="tab' + (n === cur ? ' sel' : '') + '" data-' + attr + '="' + n + '">' + n + '</button>').join('') + '</div>';

  // ---------- main menu ----------
  function showMain() {
    stopPreview(); $('menuScreen').classList.remove('on'); $('startScreen').classList.add('on');
    const tracker = closestQuests(meta(), 4).map(({ q, frac }) => '<div class="trk"><b>' + q.name + '</b><span>' + questProgress(meta(), q) + ' / ' + q.goal + '</span>' + bar(frac) + '</div>').join('');
    const recs = []; for (const map of MAPS) for (const d of DIFFICULTIES) { const r = mapRecord(meta(), map.id, d, 'run'); if (r.bestScore) recs.push(map.name + ', ' + DIFFICULTY[d].name + ': ' + r.bestScore + (r.bestTime ? ' (' + clockText(r.bestTime) + ')' : '')); }
    const now = new Date(), nextMon = new Date(now); nextMon.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); nextMon.setHours(0, 0, 0, 0); const ms = nextMon - now, dd = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5);
    $('startScreen').innerHTML = '<div class="chipsTop">Star Chips <b>' + save.starChips + '</b></div><h1>DUEL SUMMONER</h1>' +
      '<div class="mainRow"><div class="mainBtns"><button id="mPlay">PLAY</button><button id="mLib">CARD LIBRARY</button><button id="mQuests">QUESTS</button><button id="mShop">SHOP (DECK BOX)</button><button id="mSettings">SETTINGS</button><button class="small" id="mQuick">QUICK DUEL</button></div>' +
      '<div class="mainSide"><div class="panel"><h3>QUEST TRACKER</h3>' + (tracker || '<p>No quests in progress.</p>') + '</div>' +
      '<div class="panel"><h3>WEEKLY LEADERBOARD</h3><div class="tabs"><button class="tab sel">Global</button><button class="tab">Friends</button></div><div id="lbOnline"></div><p class="dim">' + (boardUrl(save.settings) ? 'Your local bests:' : 'Online boards are off. Your local bests:') + '</p>' + (recs.length ? recs.map(r => '<div class="lbrow">' + r + '</div>').join('') : '<p class="dim">No runs yet.</p>') + '<p class="dim">Resets in ' + dd + 'd ' + hh + 'h</p></div></div></div>';
    $('mPlay').onclick = showDuelists; $('mLib').onclick = () => showLibrary(); $('mQuests').onclick = () => showQuests(); $('mShop').onclick = () => { $('startScreen').classList.remove('on'); env.showDeckBox(); };
    $('mSettings').onclick = showSettings; $('mQuick').onclick = () => start('quick');
    const base = boardUrl(save.settings);
    if (base) {                                                                  // live board: difficulty tabs, this week, verified runs only
      const draw = diff => fetchBoard(base, 'run', diff, 'week').then(b => {
        const el = $('lbOnline'); if (!el) return;
        el.innerHTML = '<div class="tabs">' + DIFFICULTIES.map(d => '<button class="tab' + (d === diff ? ' sel' : '') + '" data-lbd="' + d + '">' + DIFFICULTY[d].name + '</button>').join('') + '</div>' +
          (b.top.length ? b.top.slice(0, 10).map(r => '<div class="lbrow">#' + r.rank + ' ' + esc(r.name) + ' <b>' + r.score + '</b> <span class="dim">' + clockText(r.runMs / 1000) + '</span></div>').join('') : '<p class="dim">No verified runs this week.</p>') +
          (b.me && b.me.rank > 10 ? '<div class="lbrow">#' + b.me.rank + ' You <b>' + b.me.score + '</b></div>' : '');
        for (const t of el.querySelectorAll('[data-lbd]')) t.onclick = () => draw(t.dataset.lbd);
      }).catch(() => { const el = $('lbOnline'); if (el) el.innerHTML = '<p class="dim">Could not reach the leaderboard.</p>'; });
      draw('medium');
    }
  }

  // ---------- duelist select ----------
  function showDuelists() {
    const unlocked = id => meta().duelists.includes(id) && !DUELIST_INFO[id].locked || meta().duelists.includes(id);
    if (!unlocked(sel.duelist)) sel.duelist = 'kael';
    const grid = DUELIST_ORDER.map(id => { const D = DUELIST_INFO[id], open = unlocked(id); return '<button class="portrait' + (id === sel.duelist ? ' sel' : '') + (open ? '' : ' locked') + '" data-d="' + id + '"><span class="face" style="' + (open ? 'background:#' + D.color.toString(16).padStart(6, '0') : '') + '">' + (open ? initial(id) : '?') + '</span><small>' + (open ? D.name : '???') + '</small></button>'; }).join('');
    const D = DUELIST_INFO[sel.duelist], mst = masteryOf(meta(), sel.duelist), m = meta().mastery[sel.duelist] || { runs: 0, kills: 0 };
    const outfits = D.outfits.map(o => '<span class="slot' + (outfitUnlocked(meta(), sel.duelist, o) ? ' on' : '') + '" title="' + o.name + '">' + (outfitUnlocked(meta(), sel.duelist, o) ? o.name[0] : '&#128274;') + '</span>').join('') + '<span class="slot" title="locked">&#128274;</span>';
    open('<div class="selWrap"><div class="selLeft"><h2>CHOOSE YOUR DUELIST</h2><div class="portraits">' + grid + '</div></div><div class="selRight panel">' +
      '<canvas id="duelPreview" width="120" height="140" class="prev"></canvas><h2>' + D.name + ', ' + D.title + '</h2>' +
      '<div>Mastery rank <b>' + mst.rank + '</b> ' + bar(mst.frac, mst.next === null ? 'max' : mst.points + ' / ' + mst.next) + '</div>' +
      '<div class="dim">Runs played ' + m.runs + ' &middot; kills ' + m.kills + '</div><p class="joke">&ldquo;' + D.joke + '&rdquo;</p>' +
      '<div><b>Starts with</b> ' + (D.start ? MONSTERS[D.start].name : 'coming later') + '</div><div><b>Passive</b> ' + D.passive + '</div>' +
      '<div class="slots"><span>Outfits</span>' + outfits + '<span>Regalia</span><span class="slot" title="Regalia slot">&#128081;</span></div></div></div>' +
      '<div class="navRow"><button id="selBack" class="small">BACK</button><button id="selNext"' + (D.locked || !unlocked(sel.duelist) ? ' disabled' : '') + '>NEXT: CHOOSE A MAP</button></div>');
    preview = startPreview($('duelPreview'), D.color);
    for (const b of root().querySelectorAll('.portrait')) b.onclick = () => { if (unlocked(b.dataset.d)) { sel.duelist = b.dataset.d; showDuelists(); } else { sel.duelist = b.dataset.d; showDuelists(); } };
    $('selBack').onclick = showMain; $('selNext').onclick = showMaps;
  }

  // ---------- map select ----------
  function showMaps() {
    const map = MAPS.find(m => m.id === sel.map) || MAPS[0];
    const rows = DIFFICULTIES.map(d => { const r = mapRecord(meta(), map.id, d, 'run'), D = DIFFICULTY[d];
      return '<label class="diffRow' + (sel.difficulty === d ? ' sel' : '') + '"><input type="radio" name="dif" value="' + d + '"' + (sel.difficulty === d ? ' checked' : '') + '><b>' + D.name + '</b><span>Star Chips x' + DIFF_CHIPS[d].toFixed(1) + '</span><span>Score x' + D.score + '</span><span>Best ' + (r.bestScore || '-') + '</span><span>Clear ' + (r.bestTime ? clockText(r.bestTime) : '-') + '</span><span class="icons">' + (r.cleared.length ? r.cleared.map(id => '<i class="mini">' + initial(id) + '</i>').join('') : '<i class="dim">none yet</i>') + '</span></label>'; }).join('');
    const oathHtml = oathPanel ? '<div class="panel oaths"><h3>OATHS</h3><p class="dim">Sworn before the run. Each adds to the score multiplier, and keeping one by clearing the run earns its quest reward.</p>' +
      OATHS.map(o => '<label class="oathRow"><input type="checkbox" data-oath="' + o.id + '"' + (sel.oaths.includes(o.id) ? ' checked' : '') + '><b>' + o.name + '</b> ' + o.text + ' <span class="dim">(+' + o.scorePct + '% score, ' + o.reward.chips + ' chips)</span></label>').join('') + '<button class="small" id="oathDone">DONE</button></div>' : '';
    open('<h2>CHOOSE A MAP</h2><div class="selWrap"><div class="selLeft"><div class="mapList"><button class="portrait sel wide" data-m="' + map.id + '"><b>' + map.name + '</b><small>' + map.blurb + '</small></button><button class="portrait locked wide" disabled><b>???</b><small>More maps later.</small></button></div></div>' +
      '<div class="selRight panel"><h3>' + map.name + '</h3><p>' + map.blurb + '</p><div class="dim">Stages: ' + map.stages + '</div><div class="diffs">' + rows + '</div>' +
      '<div class="navRow"><button class="small" id="mapOaths">OATHS' + (sel.oaths.length ? ' (' + sel.oaths.length + ')' : '') + '</button></div>' + oathHtml + '</div></div>' +
      '<div class="navRow"><button id="mapBack" class="small">BACK</button><button id="mapQuick" class="small">QUICK DUEL (1 stage)</button><button id="mapGo">CONFIRM</button></div>');
    for (const r of root().querySelectorAll('input[name=dif]')) r.onchange = () => { sel.difficulty = r.value; save.settings.difficulty = r.value; persist(); showMaps(); };
    $('mapOaths').onclick = () => { oathPanel = !oathPanel; showMaps(); };
    for (const c of root().querySelectorAll('[data-oath]')) c.onchange = () => { const id = c.dataset.oath; sel.oaths = c.checked ? sel.oaths.concat(id) : sel.oaths.filter(x => x !== id); showMaps(); };
    if ($('oathDone')) $('oathDone').onclick = () => { oathPanel = false; showMaps(); };
    $('mapBack').onclick = showDuelists; $('mapGo').onclick = () => start('run'); $('mapQuick').onclick = () => start('quick');
  }
  function start(mode) { stopPreview(); $('menuScreen').classList.remove('on'); $('startScreen').classList.remove('on'); env.begin(mode, { duelist: sel.duelist, difficulty: sel.difficulty, oaths: sel.oaths.slice(), map: sel.map }); }

  // ---------- Card Library ----------
  function libEntries(tab) {
    const mt = meta(), out = [];
    if (tab === 'Duelists') for (const id of DUELIST_ORDER) out.push({ id, kind: 'duelist', name: DUELIST_INFO[id].name + ', ' + DUELIST_INFO[id].title, open: mt.duelists.includes(id), text: DUELIST_INFO[id].passive, useful: [], toggle: false });
    else if (tab === 'Monsters') for (const id of Object.keys(MONSTERS).concat(Object.keys(FUSIONS))) { const D = MONSTERS[id] || FUSIONS[id], fus = !!FUSIONS[id]; out.push({ id, kind: 'card', name: D.name, open: fus || mt.unlockedCards.includes(id), text: D.text, useful: USEFUL_BY_ATTACK[D.attack.kind].concat((D.elements || []).map(e => USEFUL_BY_ELEMENT[e])), toggle: !fus }); }
    else if (tab === 'Spells/Traps') for (const [set, label] of [[SPELLS, 'Spell'], [TRAPS, 'Trap'], [ONE_SHOTS, 'Spell (acts once)']]) for (const id of Object.keys(set)) out.push({ id, kind: 'card', name: set[id].name + ' (' + label + ')', open: mt.unlockedCards.includes(id), text: set[id].text, useful: Array.from(new Set(Object.keys(set[id].per || {}).map(k => STAT_LABEL[k] || k))), toggle: true });
    else if (tab === 'Items') for (const id of Object.keys(ITEMS)) out.push({ id, kind: 'item', name: ITEMS[id].name + ' (' + ITEMS[id].rarity + ')', open: mt.unlockedItems.includes(id), text: ITEMS[id].text || '', useful: Array.from(new Set(Object.keys(ITEMS[id].mods || {}).map(k => STAT_LABEL[k] || k))), toggle: true });
    else for (const q of QUESTS.filter(q => q.reward && q.reward.regalia)) out.push({ id: q.reward.regalia, kind: 'regalia', name: q.name, open: mt.regalia.includes(q.reward.regalia), text: 'A hat or trinket for your duelist.', useful: [], toggle: false });
    return out;
  }
  function showLibrary(tab) {
    if (tab) libTab = tab; const mt = meta(), off = new Set(mt.libraryOff);
    const rows = libEntries(libTab).map(e => { const q = e.open ? null : questFor(e.kind, e.id);
      return '<div class="libRow' + (e.open ? '' : ' locked') + '"><span class="sil">' + (e.open ? e.name[0] : '?') + '</span><div class="libMain"><b>' + (e.open ? e.name : '???') + '</b>' +
        (e.open ? '<div>' + (e.text || '') + '</div>' + (e.useful.length ? '<div class="dim">Useful stats: ' + e.useful.join(', ') + '</div>' : '') : '<div class="dim">Locked' + (q ? ': ' + q.name + ' (' + q.text + ')' : '') + '</div>') + '</div>' +
        (e.open && e.toggle ? '<label class="chk"><input type="checkbox" data-id="' + e.id + '"' + (off.has(e.id) ? '' : ' checked') + '> in offers</label>' : '') + '</div>'; }).join('');
    const enabled = mt.unlockedCards.concat(mt.unlockedItems).filter(c => !off.has(c)).length;
    open('<h2>CARD LIBRARY</h2>' + tabs(['Duelists', 'Monsters', 'Spells/Traps', 'Items', 'Regalia'], libTab, 'tab') + '<p class="dim">' + enabled + ' cards and items are in your offer pool (at least ' + LIBRARY_MIN + ' must stay on).' + (note ? ' <b style="color:#ff9a7a">' + note + '</b>' : '') + '</p><div class="list">' + rows + '</div><div class="navRow"><button id="libBack" class="small">BACK</button></div>');
    for (const t of root().querySelectorAll('[data-tab]')) t.onclick = () => { note = ''; showLibrary(t.dataset.tab); };
    for (const c of root().querySelectorAll('[data-id]')) c.onchange = () => { const ok = setCardEnabled(mt, c.dataset.id, c.checked); note = ok ? '' : 'At least ' + LIBRARY_MIN + ' must stay in the pool.'; persist(); showLibrary(); };
    $('libBack').onclick = () => { note = ''; showMain(); };
  }

  // ---------- Quests ----------
  function showQuests(tab) {
    if (tab) questTab = tab; const mt = meta();
    let list = QUESTS.filter(q => q.tab === questTab).map(q => ({ q, done: questDone(mt, q), frac: questProgress(mt, q) / q.goal }));
    list.sort((a, b) => (a.done - b.done) || (b.frac - a.frac));
    if (hideDone) list = list.filter(x => !x.done);
    const cards = list.map(({ q, done, frac }) => '<div class="qcard' + (done ? ' done' : '') + '" style="border-color:' + RARITY_COLOUR[q.rarity] + '"><div class="qhead"><b>' + q.name + '</b><span style="color:' + RARITY_COLOUR[q.rarity] + '">' + q.rarity + '</span></div><div>' + q.text + '</div>' +
      bar(frac, done ? 'Done' : questProgress(mt, q) + ' / ' + q.goal) + '<div class="dim">Reward: ' + rewardText(q.reward) + (q.stat === 'manual' ? ' &middot; not earnable yet' : '') + '</div></div>').join('');
    open('<h2>QUESTS</h2>' + tabs(QUEST_TABS, questTab, 'qt') + '<div class="navRow"><label class="chk"><input type="checkbox" id="hideDone"' + (hideDone ? ' checked' : '') + '> hide completed</label></div><div class="qgrid">' + (cards || '<p class="dim">Nothing here.</p>') + '</div><div class="navRow"><button id="qBack" class="small">BACK</button></div>');
    for (const t of root().querySelectorAll('[data-qt]')) t.onclick = () => showQuests(t.dataset.qt);
    $('hideDone').onchange = e => { hideDone = e.target.checked; showQuests(); }; $('qBack').onclick = showMain;
  }

  // ---------- Settings ----------
  function showSettings() {
    const s = save.settings;
    open('<h2>SETTINGS</h2><div class="panel"><div class="settings"><label><input type="checkbox" class="setRM"' + (s.reduceMotion ? ' checked' : '') + '> Reduce motion</label> <label>Shake <input type="range" class="setShake" min="0" max="100" value="' + s.shake + '"> <span class="setShakeV">' + (s.reduceMotion ? 'off' : s.shake) + '</span>%</label> <label>Field of view <input type="range" class="setFov" min="80" max="115" value="' + (s.fov || 100) + '"> <span class="setFovV">' + (s.fov || 100) + '</span>&deg;</label> <label>Detail <span class="seg setDetail"><button data-v="low">Low</button><button data-v="medium">Medium</button><button data-v="high">High</button></span></label> <label>Frame cap <select class="setFps">' + [30, 60, 90, 120].map(v => '<option value="' + v + '"' + ((s.fpsCap || 60) === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></div><p class="dim">Difficulty and Oaths are chosen on the map screen.</p></div><div class="navRow"><button id="setBack" class="small">BACK</button></div>');
    env.bindSettings(); $('setBack').onclick = showMain;
  }

  return { showMain, showDuelists, showMaps, showLibrary, showQuests, showSettings, sel };
}
