// Deck Box (spend Star Chips) and Card Library (what is unlocked, and the quest that opens the rest). Plain placeholder screens.
import { DECK_BOX, QUESTS } from '../data/meta.js';
import { MONSTERS, SPELLS, TRAPS, ONE_SHOTS } from '../data/cards.js';
import { ITEMS } from '../data/items.js';
import { deckIcon } from '../ui/icons.js';
import { rankOf, upgradeCost, buyUpgrade, questFor, refundOne, refundKey, refundAll, refundValue, effectText } from '../core/meta.js';

const $ = id => document.getElementById(id);

export function showDeckBox(save, persist, back) {
  const meta = save.meta, keys = Object.keys(DECK_BOX), fmt = n => Number(n).toLocaleString('en-US');
  const afford = k => { const c = upgradeCost(meta, k); return c !== null && save.starChips >= c; };
  let sel = null, sheet = false, table = false;
  { const cheap = keys.filter(afford).sort((a, b) => upgradeCost(meta, a) - upgradeCost(meta, b))[0]; sel = cheap || keys[0]; }       // opens on the cheapest affordable upgrade, else the first tile
  const pips = (k, big) => { const r = rankOf(meta, k), n = DECK_BOX[k].cost.length; return '<span class="pips' + (big ? ' big' : '') + '">' + Array.from({ length: n }, (_, i) => '<i class="' + (i < r ? 'on' : '') + '"></i>').join('') + '</span>'; };
  const invested = () => refundValue(meta, sel, 'all');
  const tile = k => { const D = DECK_BOX[k], c = upgradeCost(meta, k); return '<button class="dtile' + (k === sel ? ' sel' : '') + '" data-k="' + k + '"><span class="dico">' + deckIcon(k, 40) + '</span><b>' + D.name + '</b>' + pips(k) + (c === null ? '<span class="cost max">MAX</span>' : '<span class="cost' + (afford(k) ? ' ok' : '') + '">' + fmt(c) + ' chips</span>') + '</button>'; };
  const details = () => {
    const D = DECK_BOX[sel], r = rankOf(meta, sel), n = D.cost.length, c = upgradeCost(meta, sel);
    const buy = c === null ? '<button class="gold" disabled>MAX RANK</button>' : afford(sel) ? '<button class="gold" id="dBuy">Buy rank ' + (r + 1) + ' &middot; ' + fmt(c) + '</button>' : '<button class="gold" disabled>Buy rank ' + (r + 1) + ' &middot; ' + fmt(c) + '</button><div class="dim need">Need ' + fmt(c - save.starChips) + ' more</div>';
    let tbl = ''; if (table) tbl = '<table class="rtab"><tr><th>' + deckIcon(sel, 22) + '</th><th>Price</th><th>Total effect</th></tr>' + Array.from({ length: n }, (_, i) => '<tr class="' + (i < r ? 'own' : '') + '"><td>' + (i + 1) + '</td><td>' + fmt(D.cost[i]) + '</td><td>' + effectText(sel, i + 1) + '</td></tr>').join('') + '</table>';
    return '<div class="dico big">' + deckIcon(sel, 84) + '</div><h2>' + D.name + '</h2><div class="rk">Rank ' + r + ' of ' + n + ' ' + pips(sel, true) + '</div><div class="dim">' + D.text + '</div>' +
      '<div class="nn">Now <b>' + effectText(sel, r) + '</b> &rarr; Next <b class="gain">' + (c === null ? 'max' : effectText(sel, r + 1)) + '</b></div>' + buy +
      (r > 0 ? '<button class="ghost" id="dRef">Refund&hellip;</button>' : '') + '<div class="foot"><a href="#" id="dTab">' + (table ? 'Hide rank table' : 'Rank table') + '</a> &middot; Invested ' + fmt(refundValue(meta, sel, 'key')) + ' in this upgrade. Refunds return the full price.</div>' + tbl;
  };
  const sheetHtml = () => '<div class="rsheet"><div class="panel"><h3>Refund</h3><div class="dim">Nothing is lost: any refund can be bought back.</div>' +
    '<button data-ref="one"' + (rankOf(meta, sel) ? '' : ' disabled') + '>Refund one rank (+' + fmt(refundValue(meta, sel, 'one')) + ')</button><button data-ref="key"' + (rankOf(meta, sel) ? '' : ' disabled') + '>Refund this upgrade (+' + fmt(refundValue(meta, sel, 'key')) + ')</button><button data-ref="all"' + (refundValue(meta, sel, 'all') ? '' : ' disabled') + '>Refund everything (+' + fmt(refundValue(meta, sel, 'all')) + ')</button><button id="dCancel" class="small">Cancel</button></div></div>';
  const render = () => {
    $('metaBody').innerHTML = '<div class="dbHead"><button id="metaBack" class="small">BACK</button><h1>DECK BOX</h1><div class="dchips">Star Chips <b>' + fmt(save.starChips) + '</b></div></div><div class="dbWrap"><div class="dbGrid">' + keys.map(tile).join('') + '</div><div class="dbDet panel">' + details() + '</div></div>' + (sheet ? sheetHtml() : '');
    const nb = $('metaBody'); for (const t of nb.querySelectorAll('.dtile')) t.onclick = () => { sel = t.dataset.k; render(); };
    if ($('metaBack')) $('metaBack').onclick = () => { $('metaScreen').classList.remove('on'); back(); };
    if ($('dBuy')) $('dBuy').onclick = () => { const left = buyUpgrade(meta, save.starChips, sel); if (left !== null) { save.starChips = left; persist(); render(); } };
    if ($('dRef')) $('dRef').onclick = () => { sheet = true; render(); };
    if ($('dCancel')) $('dCancel').onclick = () => { sheet = false; render(); };
    for (const b of nb.querySelectorAll('[data-ref]')) b.onclick = () => { const m = b.dataset.ref; save.starChips += m === 'one' ? refundOne(meta, sel) : m === 'key' ? refundKey(meta, sel) : refundAll(meta); persist(); sheet = false; render(); };
    if ($('dTab')) $('dTab').onclick = e => { e.preventDefault(); table = !table; render(); };
  };
  $('metaScreen').classList.add('on'); render();
}
export function showLibrary(save, back) {
  const meta = save.meta, entries = [];
  for (const id of Object.keys(MONSTERS)) entries.push({ id, name: MONSTERS[id].name, kind: MONSTERS[id].type + ' monster', card: true });
  for (const id of Object.keys(SPELLS)) entries.push({ id, name: SPELLS[id].name, kind: 'Spell', card: true });
  for (const id of Object.keys(TRAPS)) entries.push({ id, name: TRAPS[id].name, kind: 'Trap', card: true });
  for (const id of Object.keys(ONE_SHOTS)) entries.push({ id, name: ONE_SHOTS[id].name, kind: 'Spell (acts once)', card: true });
  for (const id of Object.keys(ITEMS)) entries.push({ id, name: ITEMS[id].name, kind: 'Item, ' + ITEMS[id].rarity, card: false });
  const rows = entries.map(e => {
    const open = e.card ? meta.unlockedCards.includes(e.id) : meta.unlockedItems.includes(e.id), q = questFor(e.card ? 'card' : 'item', e.id);
    return '<div class="row' + (open ? '' : ' locked') + '"><b>' + (open ? e.name : '???') + '</b><span>' + e.kind + '</span><i>' + (open ? 'Unlocked' : 'Locked: ' + (q ? q.name + ' (' + q.text + ')' : 'a quest')) + '</i></div>';
  }).join('');
  const done = meta.questsDone.length;
  $('metaBody').innerHTML = '<h1 style="font-size:28px">CARD LIBRARY</h1><p>' + meta.unlockedCards.length + ' cards and ' + meta.unlockedItems.length + ' items unlocked. Quests done ' + done + ' of ' + QUESTS.length + '.</p><div id="metaRows">' + rows + '</div><button id="metaBack">BACK</button>';
  $('metaBody').onclick = e => { if (e.target.id === 'metaBack') { $('metaScreen').classList.remove('on'); back(); } };
  $('metaScreen').classList.add('on');
}
