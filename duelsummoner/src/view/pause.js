// The Pause screen as a duel mat (menus-spec 10.1): the run's board laid out as a card mat on the left, the Ledger column (Actions, Stats, Rites) on the right.
// The static markup lives in index.html; renderPause(g) fills it each time Pause opens. Hold buttons need a 1.0 s hold with a pointer; with a pad or keys they need two presses within 1.5 s.
import { MONSTERS, FUSIONS, SPELLS, TRAPS, LEVELS, FIELD_RULES, formOf } from '../data/cards.js';
import { ITEMS, BLESSINGS } from '../data/items.js';
import { STAT_INFO, STAT_GROUPS, fmtStat } from '../data/stats.js';
import { DIFFICULTY } from '../data/stages.js';
import { MAPS } from '../data/progress.js';
import { fusionsReady } from '../sim/field.js';
import { clock } from '../core/util.js';
const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let showAll = false, tab = 'actions';
const ROMAN = ['I', 'II', 'III'];
const pips = (n, max) => '<span class="pips">' + Array.from({ length: max }, (_, k) => '<i class="' + (k < n ? 'on' : '') + '"></i>').join('') + '</span>';

export function pauseHeader(g) {
  const map = (MAPS.find(m => m.id === (g.opts && g.opts.map)) || MAPS[0] || {}).name || 'The Open Desert', dif = DIFFICULTY[(g.opts && g.opts.difficulty) || 'medium'];
  const stage = g.stages && g.stages.length > 1 ? 'Stage ' + (g.stage + 1) + ' of ' + g.stages.length : 'Quick duel';
  const seals = g.oaths ? Object.keys(g.oaths).filter(k => g.oaths[k]).length : 0;
  return '<h1>Duel paused</h1><div class="pm2">' + esc(map) + ' &middot; ' + stage + ' &middot; ' + (dif ? dif.name : '') + ' &middot; ' + clock(Math.floor(g.sc || g.t || 0)) + '</div><div class="pm3">Coins <b>' + g.coins + '</b> &middot; Kills <b>' + g.kills + '</b> &middot; Level <b>' + g.level + '</b>' + (seals ? ' &middot; Oaths <b>' + seals + '</b>' : '') + '</div>';
}
function monsterTile(m) {
  if (!m) return '<div class="ptile empty">Monster zone<br><small>empty</small></div>';
  const D = MONSTERS[m.id] || FUSIONS[m.id], ready = false;
  return '<div class="ptile mon"><span class="pform">' + ROMAN[formOf(m.id, m.level)] + '</span><b>' + esc(D.name) + '</b><span class="plv">Level ' + m.level + '</span>' + pips(m.level, LEVELS.monsterMax) + (D.from ? '<small>Fusion</small>' : '') + '</div>';
}
function spellTile(s) {
  if (!s) return '<div class="ptile empty">Spell / Trap<br><small>empty</small></div>';
  const D = SPELLS[s.id] || TRAPS[s.id], trap = !!TRAPS[s.id];
  return '<div class="ptile st"><b>' + esc(D.name) + '</b><span class="plv">' + (trap ? 'Trap' : 'Spell') + ' &middot; Level ' + s.level + '</span>' + pips(s.level, 5) + '</div>';
}
export function pauseMat(g) {
  const cnt = {}; for (const id of g.items) cnt[id] = (cnt[id] || 0) + 1;
  const items = Object.keys(cnt).map(id => '<span class="pitem" title="' + esc(ITEMS[id].text || '') + '">' + esc(ITEMS[id].name) + (cnt[id] > 1 ? '<em>x' + cnt[id] + '</em>' : '') + '</span>').join('') || '<span class="dim">No items yet</span>';
  const ex = [...(g.field.banished || [])].map(id => { const D = MONSTERS[id] || FUSIONS[id] || SPELLS[id] || TRAPS[id]; return '<span class="pexile">' + esc(D ? D.name : id) + '</span>'; }).join('');
  return { header: pauseHeader(g), monsters: g.field.monsters.map(monsterTile).join(''), spells: g.field.spells.map(spellTile).join(''), items: '<div class="pitems">' + items + '</div>' + (ex ? '<div class="pexiled"><small>Exiled</small>' + ex + '</div>' : '') };
}
export function matHtml(g) { const m = pauseMat(g); return '<div class="pmHeader">' + m.header + '</div><div class="pmRow m">' + m.monsters + '</div><div class="pmRow s">' + m.spells + '</div>' + m.items; }
export function statRows(g, all) {
  const M = g.mods, out = [];
  if (g.big) out.push('<h4>Stakes</h4><div class="srow2"><span>Stakes (crowd, hp, damage, rewards)</span><b>' + Math.round(g.stakes || 0) + '%</b></div>');
  for (const [gname, ids] of STAT_GROUPS) {
    const rows = []; for (const id of ids) { const s = STAT_INFO[id], v = M[s.mod] || 0; if (!all && !v) continue; rows.push('<div class="srow2' + (v ? '' : ' zero') + '"><span>' + esc(s.label) + '</span><b class="' + (v ? 'gain' : '') + '">' + (v ? fmtStat(s, v) : '0') + '</b></div>'); }
    if (rows.length) out.push('<h4>' + esc(gname) + '</h4>' + rows.join(''));
  }
  return out.join('') || '<div class="dim">Nothing has changed from the base yet.</div>';
}
export function ritesRows(g) {
  const rows = (g.blessings || []).map(id => '<div class="rite"><b>' + esc((BLESSINGS[id] || { name: id }).name) + '</b><span class="dim">' + esc((BLESSINGS[id] || {}).text || '') + '</span></div>');
  return rows.join('') || '<div class="dim">No Rites taken yet. Shrines and altars add them.</div>';
}
export function renderPause(g) {
  const m = pauseMat(g); $('pmHeader').innerHTML = m.header; $('pmMonsters').innerHTML = m.monsters; $('pmSpells').innerHTML = m.spells; $('pmItems').innerHTML = m.items;
  const st = $('pmStats'); st.innerHTML = '<a href="#" id="pmShowAll" class="tlink">' + (showAll ? 'Show changed' : 'Show all') + '</a>' + statRows(g, showAll);
  $('pmShowAll').onclick = e => { e.preventDefault(); showAll = !showAll; renderPause(g); };
  $('pmRites').innerHTML = ritesRows(g); setTab(tab);
  const fr = fusionsReady(g); for (const el of document.querySelectorAll('.ptile.mon')) if (fr.length) el.classList.add('fusionReady');
}
export function setTab(t) { tab = t; for (const b of document.querySelectorAll('#pmTabs [data-pt]')) b.classList.toggle('sel', b.dataset.pt === t); $('pmActions').style.display = t === 'actions' ? '' : 'none'; $('pmStats').style.display = t === 'stats' ? '' : 'none'; $('pmRites').style.display = t === 'rites' ? '' : 'none'; }
// hold buttons: a 1.0 s pointer hold, or two presses within 1.5 s from a pad or keys
export function bindHolds(root) {
  for (const b of root.querySelectorAll('[data-hold]')) {
    let timer = null, armed = 0; const label = b.textContent;
    const fire = () => { b.dataset.holdOk = '1'; b.click(); delete b.dataset.holdOk; b.classList.remove('holding'); b.textContent = label; armed = 0; };
    b.addEventListener('click', e => { if (b.dataset.holdOk) return; e.stopImmediatePropagation(); e.preventDefault(); const now = performance.now(); if (now - armed < 1500) { fire(); return; } armed = now; b.textContent = 'Press again to confirm'; setTimeout(() => { if (performance.now() - armed >= 1450) { b.textContent = label; armed = 0; } }, 1500); }, true);
    b.addEventListener('pointerdown', () => { if (b.disabled) return; b.classList.add('holding'); timer = setTimeout(() => { timer = null; fire(); }, 1000); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { if (timer) { clearTimeout(timer); timer = null; } b.classList.remove('holding'); });
  }
}
