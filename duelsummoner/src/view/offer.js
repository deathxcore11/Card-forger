// The offer screen: level-ups, chests, Witness Stones, the Relic Broker and shrine blessings. Plain placeholder styling.
import { OFFER, LEVELS } from '../data/cards.js';
import { ITEMS, BLESSINGS } from '../data/items.js';
import { cardDef, monsterMax, damageOf, param } from '../sim/field.js';
import { SPELLS, TRAPS } from '../data/cards.js';
import { takeCode, MENU_REDRAW, MENU_PASS, MENU_LEAVE, MENU_BANISH } from '../sim/input.js';

const $ = id => document.getElementById(id);
import { playReveal } from './reveal.js';
const revealed = new WeakSet();
let busy = false, openOffer = null, openedAt = 0;
// Input guard: for 0.3 s after an offer opens, and for as long as a picked card is flying, every key, click, touch and pad press is ignored, so a click or jump from the fight cannot take or banish a card
export const offerGuard = () => busy || performance.now() - openedAt < 300;
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
  busy = true; $('offerScreen').style.pointerEvents = 'none'; $('offerScreen').classList.add('closing');       // the title and buttons fade with the other cards
  const r = card.getBoundingClientRect(), d = destFor(g, c).getBoundingClientRect(), dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2), s = Math.max(0.1, Math.min(0.3, d.width / r.width));
  for (const o of card.parentElement.children) if (o !== card) o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
  card.style.animation = 'none'; card.style.zIndex = 5;
  const a = card.animate([{ transform: 'none', opacity: 1, offset: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.2 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')', opacity: 0.9, offset: 1 }], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  const done = () => { busy = false; $('offerScreen').style.pointerEvents = ''; go(); }; a.onfinish = done;
}

// Numeric deltas: every changed stat prints as "Stat: a -> b" with b highlighted. A new card prints its base numbers (damage and attack interval, and the rest of its attack).
const r2 = n => String(Math.round(n * 100) / 100), arrow = (label, a, b, u) => '<div class="nl">' + label + ': ' + (a === null ? '' : r2(a) + (u || '') + ' &rarr; ') + '<b>' + r2(b) + (u || '') + '</b></div>';
const SPELL_LABEL = { reach: ['Area size', 100, '%'], dmgMult: ['Might', 100, '%'], burnDps: ['Burn damage per second', 1, ''], burnDur: ['Burn time', 1, ' s'], markDur: ['Mark time', 1, ' s'], markBonus: ['Mark bonus', 100, '%'], cardRate: ['Card throw speed', 100, '%'], move: ['Move speed', 100, '%'], dash: ['Dash', 100, '%'], maxLp: ['Max LP', 1, ''], pickup: ['Pickup range', 100, '%'], xp: ['XP gain', 100, '%'], affPerElement: ['Damage per element fielded', 100, '%'] };
function statLines(c, g) {
  let h = '', L2 = c.to || 1, L1 = c.isNew ? null : L2 - 1; const D = cardDef(c.id); if (!D) return '';
  if (c.kind === 'monster' || c.kind === 'fusion') {
    const m1 = { id: c.id, level: L1 || 1 }, m2 = { id: c.id, level: L2 }; h += arrow('Damage', L1 === null ? null : damageOf(m1), damageOf(m2));
    if (L1 === null) h += arrow('Attacks every', null, D.attack.cd / (1 + ((g.mods && g.mods.monsterRate) || 0)), ' s');
    for (const [k, label, u] of [['pierce', 'Pierces', ''], ['length', 'Line length', ' m'], ['splash', 'Splash', ' m'], ['count', 'Fireballs', ''], ['marks', 'Marks', ''], ['range', 'Range', ' m'], ['arc', 'Cone', ' deg'], ['speed', 'Bolt speed', '']]) {
      const a = param(m1, k), b = param(m2, k); if (L1 === null ? b > 0 : a !== b) h += arrow(label, L1 === null ? null : a, b, u);
    }
  } else if (c.kind === 'spell') {
    const per = D.per || {}; for (const k of Object.keys(per)) { const sp = SPELL_LABEL[k]; if (!sp || typeof per[k] !== 'number') continue; h += arrow(sp[0], L1 === null ? null : per[k] * L1 * sp[1], per[k] * L2 * sp[1], sp[2]); }
    if (D.per && D.per.drill) h += arrow('Monster hits', L1 === null ? null : D.per.drill[1] * L1 * 100, D.per.drill[1] * L2 * 100, '%');
  } else if (c.kind === 'trap') {
    const T = TRAPS[c.id], rc = n => T.recharge * Math.pow(T.rechargePerLevel, n - 1), dm = n => T.dmg * (1 + T.dmgPerLevel * (n - 1));
    h += arrow('Damage', L1 === null ? null : dm(L1), dm(L2)) + arrow('Recharge', L1 === null ? null : rc(L1), rc(L2), ' s');
  } else if (c.kind === 'oneshot') {
    h += D.cards ? arrow('Cards', null, D.cards) + arrow('Damage each', null, D.dmg) : arrow('Heals', null, Math.max(0, Math.ceil((g.p ? g.p.maxHp - g.p.hp : 0))), ' LP');
  }
  return h;
}

function describe(c, g) {
  if (c.kind === 'banish') { const D = cardDef(c.id); return { D: { name: D.name, text: 'BANISH: remove this unowned card from every future offer this run.' }, kind: 'Altar action: BANISH', lv: 'Nothing on your field is lost.', fx: '' }; }
  if (c.kind === 'tribute') { const D = cardDef(c.id); return { D: { name: D.name, text: 'TRIBUTE: give up this card (level ' + c.level + ') and free its zone.' }, kind: 'Altar action: TRIBUTE', lv: 'Lost: the card and its levels. Carries forward: the next card placed in that zone starts +2 levels.', fx: '' }; }
  if (c.kind === 'final') return { D: c.id === 'close' ? { name: 'Close the Vault', text: 'Bank the win and go to the results.' } : { name: 'Duel On', text: 'The win is banked first. Then Overtime: endless hunters, a captain every 60 s, and the only place God Fusions can form.' }, kind: 'Final Altar', lv: '', fx: '' };
  if (c.kind === 'item') { const D = ITEMS[c.id]; return { D, kind: 'Item (passive, no slot)', lv: c.price !== undefined ? '' : 'Yours for the rest of the run', fx: '' }; }
  if (c.kind === 'blessing') return { D: { name: BLESSINGS[c.id].name, text: BLESSINGS[c.id].fmt ? BLESSINGS[c.id].fmt(c.mult || 1) : BLESSINGS[c.id].text }, kind: 'Stat blessing', lv: 'Permanent for this run', fx: '' };
  const D = cardDef(c.id), kind = c.kind === 'fusion' ? 'FUSION' : c.kind === 'monster' ? (D.type + ' monster') : c.kind === 'oneshot' ? 'Spell, acts once' : c.kind === 'trap' ? 'Trap' : 'Spell';
  let lv = '';
  if (c.kind === 'monster') lv = c.isNew ? 'Level 1' : 'Level ' + (c.to - 1) + ' to ' + c.to + ' of ' + monsterMax(c.id);
  else if (c.kind === 'fusion') lv = 'Level 1 of ' + LEVELS.monsterMax + '. Merges its two parents into one zone.';
  else if (c.kind === 'spell' || c.kind === 'trap') lv = c.isNew ? 'Level 1' : 'Level ' + (c.to - 1) + ' to ' + c.to + ' of ' + LEVELS.spellMax;
  let fx = '';
  if (c.kind === 'monster' && D.fxText && !c.isNew && D.fxText[c.to]) fx = '<br><b>Now: ' + D.fxText[c.to] + '</b>';
  else if (c.kind === 'monster' && D.fxText && c.isNew) fx = '<br>Level 3: ' + D.fxText[3] + '; 6: ' + D.fxText[6] + '; 10: ' + D.fxText[10];
  return { D, kind, lv, fx: fx + '<div class="nums">' + statLines(c, g) + '</div>' };
}

const TITLES = { final: 'THE FINAL ALTAR', altar: 'ALTAR OF TRIBUTE', fusion: 'FUSION', chest: 'CARD CHEST', item: 'WITNESS STONES', shop: 'THE RELIC BROKER', blessing: 'SHRINE OF TRIBUTE' };
const SUBS = {
  final: 'The Hollow King is down. Bank the win, or Duel On into endless Overtime.',
  altar: 'Two actions, one use: BANISH an unowned card, or TRIBUTE a card from your field.',
  fusion: 'Both parents are level 10. Choose a Fusion, or leave it for later.',
  item: 'A witnessed duel must begin with an offering. Take one item, free.',
  shop: 'Everything here belonged to a winner. So they told me. Stock and prices are fixed for the run.',
  blessing: 'Choose a stat blessing for the rest of the run, or decline and come back to this shrine later.'
};

// act(code) sends a menu choice into the sim as input on a tick (see src/sim/input.js); the UI never calls the rules directly.
let banishMode = false;
export function showOffer(g, act) {
  const o = g.offer; if (!o) return;
  if (o.type === 'chest' && o.reveal && !revealed.has(o)) { revealed.add(o); const rm = document.body.classList.contains('rm'); $('offerScreen').style.visibility = 'hidden'; playReveal(o.reveal, { rm }, t => { $('offerScreen').style.visibility = ''; showOffer(g, act); if (t === 'legendary') for (const cd of document.querySelectorAll('#offerCards .card')) cd.classList.add('flipslow'); }); return; }
  if (o !== openOffer) { openOffer = o; openedAt = performance.now(); }
  const shop = o.type === 'shop', level = o.type === 'level', cardy = level || o.type === 'chest';
  $('offerTitle').textContent = TITLES[o.type] ? TITLES[o.type] + (shop ? '  (coins ' + g.coins + ')' : '') : 'LEVEL UP ' + g.level;
  $('offerSub').textContent = SUBS[o.type] || 'Choose a card. Banish removes a card from all future offers.';
  const wrap = $('offerCards'); wrap.innerHTML = '';
  o.cards.forEach((c, i) => {
    const { D, kind, lv, fx } = describe(c, g);
    const el = document.createElement('div'); el.className = 'card ' + c.rarity + (c.isNew && cardy ? ' new' : '');
    const act = c.kind === 'banish' ? 'BANISH' : c.kind === 'tribute' ? 'TRIBUTE' : 'TAKE';
    const buy = shop ? (c.sold ? '<button disabled>SOLD</button>' : '<button data-pick="' + i + '"' + (g.coins < c.price ? ' disabled' : '') + '>BUY ' + c.price + '</button>') : '<button data-pick="' + i + '">' + act + '</button>';
    el.innerHTML = '<h3>' + (i + 1) + '. ' + D.name + '</h3><div class="t">' + kind + ' &middot; ' + c.rarity + '</div><div>' + (D.text || '') + '</div><div class="t">' + lv + '</div>' + fx +
      '<div class="rowBtn">' + buy + '' + '</div>';
    wrap.appendChild(el);
  });
  if ((level || o.type === 'blessing') && window.__dealFrom && !document.body.classList.contains('rm')) { const O = window.__dealFrom; [...wrap.children].forEach((el, i, all) => { const r = el.getBoundingClientRect(); el.style.animation = 'none'; el.animate([{ transform: 'translate(' + (O.x - (r.left + r.width / 2)) + 'px,' + (O.y - (r.top + r.height / 2)) + 'px) scale(0.12) rotate(' + ((i - (all.length - 1) / 2) * 38) + 'deg)', opacity: 0.9 }, { transform: 'none', opacity: 1 }], { duration: 340, delay: i * 45, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }); }); }       // the cards travel out from the duelist (about 0.43 s from the bar filling to the last card landed)
  { let pill = $('offerPill'); if (!pill) { pill = document.createElement('div'); pill.id = 'offerPill'; $('offerTitle').after(pill); } const waiting = level ? g.pendingLevels : 0; pill.textContent = waiting > 1 ? waiting + ' level-ups waiting' : ''; pill.style.display = waiting > 1 ? 'inline-block' : 'none'; }
  const btns = $('offerBtns'); btns.innerHTML = '';
  const rds = (o.freeRedraws || 0) + g.field.redraws;       // free redraws from the offer are spent first, so they count here too
  if (cardy) btns.insertAdjacentHTML('beforeend', '<button data-act="redraw"' + (rds > 0 ? '' : ' disabled') + '>REDRAW (' + rds + ')</button>');
  if (cardy && g.field.banishes > 0) btns.insertAdjacentHTML('beforeend', '<button data-act="banish">BANISH (' + g.field.banishes + ')</button>');       // one shared Banish: press it, then press the card to remove
  if (level) btns.insertAdjacentHTML('beforeend', '<button data-act="pass">PASS (+' + OFFER.passCoins + ' coins)</button>');
  if (o.leave) btns.insertAdjacentHTML('beforeend', '<button data-act="leave">' + (shop ? 'LEAVE THE STALL' : o.type === 'blessing' ? 'DECLINE' : 'LEAVE IT FOR LATER') + '</button>');
  banishMode = false; $('offerScreen').classList.remove('closing', 'banishing');
  $('offerScreen').onclick = e => {
    if (banishMode && !offerGuard()) { const cd = e.target.closest('.card'); if (cd) { const i = [...cd.parentElement.children].indexOf(cd); banishMode = false; fly(cd.querySelector('button'), () => act(MENU_BANISH + 1 + i), g, null); return; } }
    const t = e.target.closest('button'); if (!t || t.disabled || offerGuard()) return;
    if (t.dataset.act === 'banish') { banishMode = !banishMode; $('offerScreen').classList.toggle('banishing', banishMode); t.textContent = banishMode ? 'PICK A CARD TO BANISH' : 'BANISH (' + g.field.banishes + ')'; return; }
    if (t.dataset.pick !== undefined) fly(t, () => act(takeCode(+t.dataset.pick)), g, o.cards[+t.dataset.pick]);
    else if (t.dataset.ban !== undefined) fly(t, () => act(MENU_BANISH + 1 + +t.dataset.ban), g, null);
    else if (t.dataset.act === 'redraw') act(MENU_REDRAW);
    else if (t.dataset.act === 'pass') act(MENU_PASS);
    else if (t.dataset.act === 'leave') act(MENU_LEAVE);
  };
}
export function offerKey(g, code, act) {                // keyboard: 1 to 4 take or buy, R redraw, P pass, L leave
  if (!g.offer) return false;
  if (offerGuard()) return /^(Digit[1-9]|KeyR|KeyP|KeyL)$/.test(code);       // swallowed while the guard is on
  if (/^Digit[1-9]$/.test(code)) { const b = document.querySelector('#offerCards [data-pick="' + (+code.slice(5) - 1) + '"]'); if (b && !b.disabled) b.click(); return true; }
  if (code === 'KeyR') { act(MENU_REDRAW); return true; }
  if (code === 'KeyP') { act(MENU_PASS); return true; }
  if (code === 'KeyL') { act(MENU_LEAVE); return true; }
  return false;
}

