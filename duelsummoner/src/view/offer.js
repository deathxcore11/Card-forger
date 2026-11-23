// The offer screen: level-ups, chests, Witness Stones, the Relic Broker and shrine blessings. Plain placeholder styling.
import { OFFER, LEVELS } from '../data/cards.js';
import { ITEMS, BLESSINGS } from '../data/items.js';
import { cardDef, monsterMax } from '../sim/field.js';
import { takeCode, MENU_REDRAW, MENU_PASS, MENU_LEAVE, MENU_BANISH } from '../sim/input.js';

const $ = id => document.getElementById(id);
import { playReveal } from './reveal.js';
const revealed = new WeakSet();
let busy = false;
// the chosen card flies down toward the field zones, then the choice enters the sim (instant with reduce motion)
function destFor(g, c) {                                  // the zone the pick lands in: the card's own zone if it has one, else the first free zone of its kind
  const q = s => document.querySelector(s);
  if (c && (c.kind === 'monster' || c.kind === 'fusion')) { const i = g.field.monsters.findIndex(m => m && m.id === c.id); return i >= 0 ? $('mz' + i) : q('.zone:not(.st):not(.full)') || $('zones'); }
  if (c && (c.kind === 'spell' || c.kind === 'trap' || c.kind === 'oneshot')) return q('.zone.st:not(.full)') || $('zones');
  return $('zones');
}
function fly(btn, go, g, c) {
  const card = btn.closest('.card'); if (busy) return;
  if (!card || document.body.classList.contains('rm')) { go(); return; }
  busy = true; $('offerScreen').style.pointerEvents = 'none';
  const r = card.getBoundingClientRect(), d = destFor(g, c).getBoundingClientRect(), dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2), s = Math.max(0.1, Math.min(0.3, d.width / r.width));
  for (const o of card.parentElement.children) if (o !== card) o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
  card.style.animation = 'none'; card.style.zIndex = 5;
  const a = card.animate([{ transform: 'none', opacity: 1, offset: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.2 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: 0.9, offset: 1 }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  const done = () => { busy = false; $('offerScreen').style.pointerEvents = ''; go(); }; a.onfinish = done;
}

function describe(c) {
  if (c.kind === 'banish') { const D = cardDef(c.id); return { D: { name: D.name, text: 'BANISH: remove this unowned card from every future offer this run.' }, kind: 'Altar action: BANISH', lv: 'Nothing on your field is lost.', fx: '' }; }
  if (c.kind === 'tribute') { const D = cardDef(c.id); return { D: { name: D.name, text: 'TRIBUTE: give up this card (level ' + c.level + ') and free its zone.' }, kind: 'Altar action: TRIBUTE', lv: 'Lost: the card and its levels. Carries forward: the next card placed in that zone starts +2 levels.', fx: '' }; }
  if (c.kind === 'final') return { D: c.id === 'close' ? { name: 'Close the Vault', text: 'Bank the win and go to the results.' } : { name: 'Duel On', text: 'The win is banked first. Then Overtime: endless hunters, a captain every 60 s, and the only place God Fusions can form.' }, kind: 'Final Altar', lv: '', fx: '' };
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

const TITLES = { final: 'THE FINAL ALTAR', altar: 'ALTAR OF TRIBUTE', fusion: 'FUSION', chest: 'CARD CHEST', item: 'WITNESS STONES', shop: 'THE RELIC BROKER', blessing: 'SHRINE OF TRIBUTE' };
const SUBS = {
  final: 'The Hollow King is down. Bank the win, or Duel On into endless Overtime.',
  altar: 'Two actions, one use: BANISH an unowned card, or TRIBUTE a card from your field.',
  fusion: 'Both parents are level 10. Choose a Fusion, or leave it for later.',
  item: 'A witnessed duel must begin with an offering. Take one item, free.',
  shop: 'Everything here belonged to a winner. So they told me. Stock and prices are fixed for the run.',
  blessing: 'Choose a stat blessing for the rest of the run.'
};

// act(code) sends a menu choice into the sim as input on a tick (see src/sim/input.js); the UI never calls the rules directly.
export function showOffer(g, act) {
  const o = g.offer; if (!o) return;
  if (o.type === 'chest' && o.reveal && !revealed.has(o)) { revealed.add(o); const rm = document.body.classList.contains('rm'); $('offerScreen').style.visibility = 'hidden'; playReveal(o.reveal, { rm }, t => { $('offerScreen').style.visibility = ''; showOffer(g, act); if (t === 'legendary') for (const cd of document.querySelectorAll('#offerCards .card')) cd.classList.add('flipslow'); }); return; }
  const shop = o.type === 'shop', level = o.type === 'level', cardy = level || o.type === 'chest';
  $('offerTitle').textContent = TITLES[o.type] ? TITLES[o.type] + (shop ? '  (coins ' + g.coins + ')' : '') : 'LEVEL UP ' + g.level;
  $('offerSub').textContent = SUBS[o.type] || 'Choose a card. Banish removes a card from all future offers.';
  const wrap = $('offerCards'); wrap.innerHTML = '';
  o.cards.forEach((c, i) => {
    const { D, kind, lv, fx } = describe(c);
    const el = document.createElement('div'); el.className = 'card ' + c.rarity + (c.isNew && cardy ? ' new' : '');
    const act = c.kind === 'banish' ? 'BANISH' : c.kind === 'tribute' ? 'TRIBUTE' : 'TAKE';
    const buy = shop ? (c.sold ? '<button disabled>SOLD</button>' : '<button data-pick="' + i + '"' + (g.coins < c.price ? ' disabled' : '') + '>BUY ' + c.price + '</button>') : '<button data-pick="' + i + '">' + act + '</button>';
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
    if (t.dataset.pick !== undefined) fly(t, () => act(takeCode(+t.dataset.pick)), g, o.cards[+t.dataset.pick]);
    else if (t.dataset.ban !== undefined) fly(t, () => act(MENU_BANISH + 1 + +t.dataset.ban), g, null);
    else if (t.dataset.act === 'redraw') act(MENU_REDRAW);
    else if (t.dataset.act === 'pass') act(MENU_PASS);
    else if (t.dataset.act === 'leave') act(MENU_LEAVE);
  };
}
export function offerKey(g, code, act) {                // keyboard: 1 to 4 take or buy, R redraw, P pass, L leave
  if (!g.offer) return false;
  if (/^Digit[1-9]$/.test(code)) { const b = document.querySelector('#offerCards [data-pick="' + (+code.slice(5) - 1) + '"]'); if (b && !b.disabled) b.click(); return true; }
  if (code === 'KeyR') { act(MENU_REDRAW); return true; }
  if (code === 'KeyP') { act(MENU_PASS); return true; }
  if (code === 'KeyL') { act(MENU_LEAVE); return true; }
  return false;
}
