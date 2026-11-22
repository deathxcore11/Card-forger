// Deck Box (spend Star Chips) and Card Library (what is unlocked, and the quest that opens the rest). Plain placeholder screens.
import { DECK_BOX, QUESTS } from '../data/meta.js';
import { MONSTERS, SPELLS, TRAPS, ONE_SHOTS } from '../data/cards.js';
import { ITEMS } from '../data/items.js';
import { rankOf, upgradeCost, buyUpgrade, questFor } from '../core/meta.js';

const $ = id => document.getElementById(id);

export function showDeckBox(save, persist, back) {
  const meta = save.meta;
  const render = () => {
    const rows = Object.keys(DECK_BOX).map(k => {
      const D = DECK_BOX[k], r = rankOf(meta, k), c = upgradeCost(meta, k);
      return '<div class="row"><b>' + D.name + '</b><span>' + '■'.repeat(r) + '□'.repeat(5 - r) + '</span><i>' + D.text + '</i>' +
        (c === null ? '<button disabled>MAX</button>' : '<button data-k="' + k + '"' + (save.starChips < c ? ' disabled' : '') + '>' + c + ' chips</button>') + '</div>';
    }).join('');
    $('metaBody').innerHTML = '<h1 style="font-size:28px">DECK BOX</h1><p>Star Chips: <b>' + save.starChips + '</b>. Permanent upgrades for every run.</p><div id="metaRows">' + rows + '</div><button id="metaBack">BACK</button>';
    $('metaBody').onclick = e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.id === 'metaBack') { $('metaScreen').classList.remove('on'); back(); return; }
      const left = buyUpgrade(meta, save.starChips, t.dataset.k); if (left !== null) { save.starChips = left; persist(); render(); }
    };
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
