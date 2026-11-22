// The level-up / chest offer screen: pick a card, Redraw, Banish or Pass. Plain placeholder styling.
import { OFFER, LEVELS } from '../data/cards.js';
import { cardDef, isFused, monsterMax } from '../sim/field.js';

const $ = id => document.getElementById(id);

function describe(c, g) {
  const D = cardDef(c.id), kind = c.kind === 'fusion' ? 'FUSION' : c.kind === 'monster' ? (D.type + ' monster') : c.kind === 'oneshot' ? 'Spell, acts once' : c.kind === 'trap' ? 'Trap' : 'Spell';
  let lv = '';
  if (c.kind === 'monster') lv = c.isNew ? 'Level 1' : 'Level ' + (c.to - 1) + ' to ' + c.to + ' of ' + monsterMax(c.id);
  else if (c.kind === 'fusion') lv = 'Level 1 of ' + LEVELS.fusedMax + '. Merges its two parents into one zone.';
  else if (c.kind === 'spell' || c.kind === 'trap') lv = c.isNew ? 'Level 1' : 'Level ' + (c.to - 1) + ' to ' + c.to + ' of ' + LEVELS.spellMax;
  let fx = '';
  if (c.kind === 'monster' && D.fxText && !c.isNew && D.fxText[c.to]) fx = '<br><b>Now: ' + D.fxText[c.to] + '</b>';
  else if (c.kind === 'monster' && D.fxText && c.isNew) fx = '<br>Level 3: ' + D.fxText[3] + '; 6: ' + D.fxText[6];
  return { D, kind, lv, fx };
}

export function showOffer(g, onChange) {
  const o = g.offer; if (!o) return;
  $('offerTitle').textContent = o.type === 'fusion' ? 'FUSION' : o.type === 'chest' ? 'SEALED CHEST' : 'LEVEL UP ' + g.level;
  $('offerSub').textContent = o.type === 'fusion' ? 'Both parents are level 6 or higher. Choose a Fusion, or leave it for later.' : 'Choose a card. Banish removes a card from all future offers.';
  const wrap = $('offerCards'); wrap.innerHTML = '';
  o.cards.forEach((c, i) => {
    const { D, kind, lv, fx } = describe(c, g);
    const el = document.createElement('div'); el.className = 'card ' + c.rarity + (c.isNew ? ' new' : '');
    el.innerHTML = '<h3>' + (i + 1) + '. ' + D.name + '</h3><div class="t">' + kind + ' &middot; ' + c.rarity + '</div><div>' + (D.text || '') + '</div><div class="t">' + lv + '</div>' + fx +
      '<div class="rowBtn"><button data-pick="' + i + '">TAKE</button>' + (o.type !== 'fusion' && g.field.banishes > 0 ? '<button data-ban="' + i + '">BANISH</button>' : '') + '</div>';
    wrap.appendChild(el);
  });
  const btns = $('offerBtns'); btns.innerHTML = '';
  if (o.type !== 'fusion') btns.insertAdjacentHTML('beforeend', '<button data-act="redraw"' + (g.field.redraws > 0 ? '' : ' disabled') + '>REDRAW (' + g.field.redraws + ')</button>');
  if (o.type === 'level') btns.insertAdjacentHTML('beforeend', '<button data-act="pass">PASS (+' + OFFER.passCoins + ' coins)</button>');
  if (o.leave) btns.insertAdjacentHTML('beforeend', '<button data-act="leave">LEAVE IT FOR LATER</button>');
  const act = e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.pick !== undefined) g.choose(+t.dataset.pick);
    else if (t.dataset.ban !== undefined) g.banish(+t.dataset.ban);
    else if (t.dataset.act === 'redraw') g.redraw();
    else if (t.dataset.act === 'pass') g.pass();
    else if (t.dataset.act === 'leave') g.leave();
    onChange();
  };
  $('offerScreen').onclick = act;
}
export function offerKey(g, code) {                       // keyboard: 1 to 3 take, R redraw, P pass
  const o = g.offer; if (!o) return false;
  if (/^Digit[1-4]$/.test(code)) return g.choose(+code.slice(5) - 1);
  if (code === 'KeyR') return g.redraw();
  if (code === 'KeyP') return g.pass();
  if (code === 'KeyL') return g.leave();
  return false;
}
