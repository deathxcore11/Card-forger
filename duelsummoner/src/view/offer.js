// The offer screen: level-ups, chests, Witness Stones, the Relic Broker and shrine blessings. Plain placeholder styling.
import { OFFER, LEVELS } from '../data/cards.js';
import { ITEMS, BLESSINGS } from '../data/items.js';
import { cardDef, monsterMax } from '../sim/field.js';

const $ = id => document.getElementById(id);

function describe(c) {
  if (c.kind === 'item') { const D = ITEMS[c.id]; return { D, kind: 'Item (passive, no slot)', lv: c.price !== undefined ? '' : 'Yours for the rest of the run', fx: '' }; }
  if (c.kind === 'blessing') return { D: BLESSINGS[c.id], kind: 'Stat blessing', lv: 'Permanent for this run', fx: '' };
  const D = cardDef(c.id), kind = c.kind === 'fusion' ? 'FUSION' : c.kind === 'monster' ? (D.type + ' monster') : c.kind === 'oneshot' ? 'Spell, acts once' : c.kind === 'trap' ? 'Trap' : 'Spell';
  let lv = '';
  if (c.kind === 'monster') lv = c.isNew ? 'Level 1' : 'Level ' + (c.to - 1) + ' to ' + c.to + ' of ' + monsterMax(c.id);
  else if (c.kind === 'fusion') lv = 'Level 1 of ' + LEVELS.monsterMax + '. Merges its two parents into one zone.';
  else if (c.kind === 'spell' || c.kind === 'trap') lv = c.isNew ? 'Level 1' : 'Level ' + (c.to - 1) + ' to ' + c.to + ' of ' + LEVELS.spellMax;
  let fx = '';
  if (c.kind === 'monster' && D.fxText && !c.isNew && D.fxText[c.to]) fx = '<br><b>Now: ' + D.fxText[c.to] + '</b>';
  else if (c.kind === 'monster' && D.fxText && c.isNew) fx = '<br>Level 3: ' + D.fxText[3] + '; 6: ' + D.fxText[6] + '; 10: ' + D.fxText[10];
  return { D, kind, lv, fx };
}

const TITLES = { fusion: 'FUSION', chest: 'CARD CHEST', item: 'WITNESS STONES', shop: 'THE RELIC BROKER', blessing: 'SHRINE OF TRIBUTE' };
const SUBS = {
  fusion: 'Both parents are level 10. Choose a Fusion, or leave it for later.',
  item: 'A witnessed duel must begin with an offering. Take one item, free.',
  shop: 'Everything here belonged to a winner. So they told me. Stock and prices are fixed for the run.',
  blessing: 'Choose a stat blessing for the rest of the run.'
};

export function showOffer(g, onChange) {
  const o = g.offer; if (!o) return;
  const shop = o.type === 'shop', level = o.type === 'level', cardy = level || o.type === 'chest';
  $('offerTitle').textContent = TITLES[o.type] ? TITLES[o.type] + (shop ? '  (coins ' + g.coins + ')' : '') : 'LEVEL UP ' + g.level;
  $('offerSub').textContent = SUBS[o.type] || 'Choose a card. Banish removes a card from all future offers.';
  const wrap = $('offerCards'); wrap.innerHTML = '';
  o.cards.forEach((c, i) => {
    const { D, kind, lv, fx } = describe(c);
    const el = document.createElement('div'); el.className = 'card ' + c.rarity + (c.isNew && cardy ? ' new' : '');
    const buy = shop ? (c.sold ? '<button disabled>SOLD</button>' : '<button data-pick="' + i + '"' + (g.coins < c.price ? ' disabled' : '') + '>BUY ' + c.price + '</button>') : '<button data-pick="' + i + '">TAKE</button>';
    el.innerHTML = '<h3>' + (i + 1) + '. ' + D.name + '</h3><div class="t">' + kind + ' &middot; ' + c.rarity + '</div><div>' + (D.text || '') + '</div><div class="t">' + lv + '</div>' + fx +
      '<div class="rowBtn">' + buy + (cardy && g.field.banishes > 0 ? '<button data-ban="' + i + '">BANISH</button>' : '') + '</div>';
    wrap.appendChild(el);
  });
  const btns = $('offerBtns'); btns.innerHTML = '';
  if (cardy) btns.insertAdjacentHTML('beforeend', '<button data-act="redraw"' + (g.field.redraws > 0 ? '' : ' disabled') + '>REDRAW (' + g.field.redraws + ')</button>');
  if (level) btns.insertAdjacentHTML('beforeend', '<button data-act="pass">PASS (+' + OFFER.passCoins + ' coins)</button>');
  if (o.leave) btns.insertAdjacentHTML('beforeend', '<button data-act="leave">' + (shop ? 'LEAVE THE STALL' : 'LEAVE IT FOR LATER') + '</button>');
  $('offerScreen').onclick = e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.pick !== undefined) g.choose(+t.dataset.pick);
    else if (t.dataset.ban !== undefined) g.banish(+t.dataset.ban);
    else if (t.dataset.act === 'redraw') g.redraw();
    else if (t.dataset.act === 'pass') g.pass();
    else if (t.dataset.act === 'leave') g.leave();
    onChange();
  };
}
export function offerKey(g, code) {                       // keyboard: 1 to 3 take or buy, R redraw, P pass, L leave
  const o = g.offer; if (!o) return false;
  if (/^Digit[1-4]$/.test(code)) { g.choose(+code.slice(5) - 1); return true; }
  if (code === 'KeyR') return g.redraw();
  if (code === 'KeyP') return g.pass();
  if (code === 'KeyL') return g.leave();
  return false;
}
