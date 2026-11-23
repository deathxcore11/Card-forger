// The field: 4 Monster Zones and 4 shared Spell and Trap Zones, level-up offers, Redraw / Banish / Pass, and Fusion.
import { MONSTERS, FUSIONS, SPELLS, ONE_SHOTS, TRAPS, DUELISTS, OFFER, LEVELS, FIELD_RULES, XP, formOf } from '../data/cards.js';
import { addFx } from './combat.js';
import { monsterMul, knee } from './ledger.js';
import { STAT_BY_MOD } from '../data/stats.js';
import { K } from '../data/tuning.js';
import { RECIPES, TIERS, ELEMENTS } from '../data/elements.js';
import { ITEMS, BLESSINGS, ITEM_CAPS } from '../data/items.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { elemBits } from '../data/elements.js';
const E_ALTAR = ENCOUNTERS.altar;

// the first levels come about every 30 s (the recordings), easing to the old curve by level 9 so Fusion timing is not pushed back
const earlyMul = level => 1 + (XP.early || 0) * Math.max(0, (XP.earlyTo - level) / (XP.earlyTo - 1));
export const xpNeeded = level => (XP.table ? tableXp(level) : XP.base + XP.perLevel * level + (XP.quad || 0) * level * level) * earlyMul(level);
function tableXp(level) { const T = XP.table; if (level <= T.length) return T[level - 1]; let v = T[T.length - 1]; for (let k = T.length; k < level; k++) v *= XP.tail; return v; }       // a data table of XP per level, then a steady climb (plain loops, so every machine agrees)

export function makeField(duelistId, rng) {
  const D = DUELISTS[duelistId] || DUELISTS.kael;
  const f = { duelist: duelistId, monsters: [null, null, null, null], spells: [null, null, null, null], redraws: OFFER.redraws, banishes: OFFER.banishes, banished: new Set(), picks: 0, firstFusionAt: -1, bonusM: [0, 0, 0, 0], bonusS: [0, 0, 0, 0] };
  f.monsters[0] = newMonster(D.start, 1, rng);
  return f;
}
function newMonster(id, level, rng) { return { id, level, cd: 0.1, ang: (rng ? rng() : 0) * 6.28, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }; }

export const def = id => MONSTERS[id] || FUSIONS[id];
export const isFused = id => !!FUSIONS[id];
export const monsterMax = id => (isFused(id) ? LEVELS.fusedMax : LEVELS.monsterMax);
export const trapOrSpell = id => SPELLS[id] || TRAPS[id];
export function cardDef(id) { return MONSTERS[id] || FUSIONS[id] || SPELLS[id] || ONE_SHOTS[id] || TRAPS[id]; }

// current value of one attack parameter at the monster's level (base plus level 3/6/8 extras)
export function param(m, name) {
  const D = def(m.id), base = D.attack[name] || 0; let v = base;
  for (const lv of Object.keys(D.fx)) if (m.level >= +lv && D.fx[lv][name] !== undefined) v += D.fx[lv][name];
  return v;
}
export const damageOf = m => param(m, 'dmg') * monsterMul(m.id, m.level);          // base x level x form x tier (the Ledger, section 8)

// ---- derived stats from spells ----
export function recompute(g) {
  const f = g.field, M = { burnDps: 0, burnDur: 0, markDur: 0, markBonus: 0, cardRate: 0, move: 0, dash: 0, maxLp: 0, pickup: 0, xp: 0, markExplode: null, monsterRate: 0,
    trapRecharge: 0, coinMult: 0, luck: 0, crit: 0, dashCd: 0, regen: 0, armour: 0, airJumps: 0, bossDmg: 0, cardBurn: 0, shopDiscount: 0, talisman: 0, freeChestEvery: 0, bell: 0, dmgMult: 0, drill: [0, 0, 0, 0, 0], aff: [0, 0, 0, 0, 0, 0, 0, 0], toll: 0, locket: 0 };
  const WHOLE = { armour: 1, maxLp: 1, airJumps: 1 };
  const addMods = (mods, mul) => { mul = mul || 1; for (const k of Object.keys(mods)) if (k in M && typeof M[k] === 'number') M[k] += WHOLE[k] ? Math.round(mods[k] * mul) : mods[k] * mul; };
  if (g.metaMods) addMods(g.metaMods);                                    // Deck Box ranks
  const src = {};                                                                   // stat mod key -> [[source name, value], ...]
  const note = (key, name, v) => { if (v && STAT_BY_MOD[key]) (src[key] || (src[key] = [])).push([name, v]); };
  if (g.metaMods) for (const k of Object.keys(g.metaMods)) note(k, 'Deck Box', g.metaMods[k]);
  for (const id of (g.items || [])) { addMods(ITEMS[id].mods); for (const k of Object.keys(ITEMS[id].mods)) note(k, ITEMS[id].name, ITEMS[id].mods[k]); }
  (g.blessings || []).forEach((id, i) => { const m = (g.blessingMult && g.blessingMult[i]) || 1; addMods(BLESSINGS[id].mods, m); for (const k of Object.keys(BLESSINGS[id].mods)) note(k, BLESSINGS[id].name, WHOLE[k] ? Math.round(BLESSINGS[id].mods[k] * m) : BLESSINGS[id].mods[k] * m); });
  for (const s of f.spells) {
    if (!s || !SPELLS[s.id]) continue;
    const P = SPELLS[s.id].per, n = s.level;
    if (P.burnDps) { M.burnDps += P.burnDps * n; M.burnDur += P.burnDur * n; }
    if (P.markDur) { M.markDur += P.markDur * n; M.markBonus += P.markBonus * n; }
    if (P.cardRate) { M.cardRate += P.cardRate * n; note('cardRate', SPELLS[s.id].name, P.cardRate * n); }
    if (P.move) { M.move += P.move * n; M.dash += P.dash * n; note('move', SPELLS[s.id].name, P.move * n); }
    if (P.maxLp) { M.maxLp += P.maxLp * n; note('maxLp', SPELLS[s.id].name, P.maxLp * n); }
    if (P.pickup) { M.pickup += P.pickup * n; M.xp += P.xp * n; note('pickup', SPELLS[s.id].name, P.pickup * n); note('xp', SPELLS[s.id].name, P.xp * n); }
    if (P.burnDps) note('burnDps', SPELLS[s.id].name, P.burnDps * n); if (P.markBonus) note('markBonus', SPELLS[s.id].name, P.markBonus * n);
    if (P.drill) M.drill[P.drill[0]] += P.drill[1] * n;                                  // bracket 2: invest in one kind of source
    if (P.affPerElement) { for (const m of f.monsters) if (m) { const D = MONSTERS[m.id] || FUSIONS[m.id]; if (D) for (const el of D.elements) M.aff[ELEMENTS[el].bit === 1 ? 0 : ELEMENTS[el].bit === 2 ? 1 : ELEMENTS[el].bit === 4 ? 2 : ELEMENTS[el].bit === 8 ? 3 : ELEMENTS[el].bit === 16 ? 4 : ELEMENTS[el].bit === 32 ? 5 : ELEMENTS[el].bit === 64 ? 6 : 7] += P.affPerElement * n; } }       // bracket 3: more for every monster that shares the element
    if (P.toll) { M.toll += n; M.dmgMult += P.dmgMult * n; note('dmgMult', SPELLS[s.id].name, P.dmgMult * n); }
  }
  for (const m of f.monsters) if (m && m.id === 'astral-magus') M.markExplode = { radius: param(m, 'explodeRadius'), dmg: param(m, 'explodeDmg') };
  // rate stats have a ceiling (Tempo and Draw approach x3): linear up to +100%, then a knee
  M.cardRateRaw = M.cardRate; M.monsterRateRaw = M.monsterRate;
  M.cardRate = knee(M.cardRate, K.drawKnee, K.drawKneeK); M.monsterRate = knee(M.monsterRate, K.tempoKnee, K.tempoKneeK);
  M.raw = {}; for (const k of Object.keys(ITEM_CAPS)) { M.raw[k] = M[k]; if (M[k] > ITEM_CAPS[k]) M[k] = ITEM_CAPS[k]; }
  M.raw.pickup = M.pickup; if (M.pickup > K.magCap) M.pickup = K.magCap;       // Magnet is clamped at K.magCap (+180%), not at the old item ceiling that cut Collector's Eye 5 to +10%          // ceilings on stacked stats; the raw sum stays for the stat panel
  g.sheetSrc = src; g.mods = M;
  const maxHp = g.oaths && g.oaths.glass ? 1 : g.cfgHp + M.maxLp;                  // Glass Oath: 1 LP and it cannot be raised
  if (maxHp !== g.p.maxHp) g.p.maxHp = maxHp;
}

// ---- Fusion ----
export function fusionsReady(g) {
  const f = g.field, out = [];
  for (const r of RECIPES) {                                         // generic table: any tier, any pair
    const ma = f.monsters.find(m => m && m.id === r.a), mb = f.monsters.find(m => m && m.id === r.b);
    if (ma && mb && ma.level >= FIELD_RULES.fusionLevel && mb.level >= FIELD_RULES.fusionLevel && !out.includes(r.result)) out.push(r.result);
  }
  return out;
}
// the monsters of a Fusion pair you field that are not both at the Fusion level yet, lower first; .relax is set once the higher of the two has reached OFFER.fusionPushAt
export function pairPush(g) {
  const f = g.field;
  for (const r of RECIPES) {
    const ma = f.monsters.find(m => m && m.id === r.a), mb = f.monsters.find(m => m && m.id === r.b); if (!ma || !mb) continue;
    const FL = FIELD_RULES.fusionLevel; if (ma.level >= FL && mb.level >= FL) continue;
    const ids = [ma, mb].filter(m => m.level < FL).sort((x, y) => x.level - y.level).map(m => m.id); ids.relax = Math.max(ma.level, mb.level) >= OFFER.fusionPushAt; return ids;
  }
  const none = []; none.relax = false; return none;
}
export function doFusion(g, id) {
  const r = RECIPES.find(x => x.result === id); if (!r) return false;
  const f = g.field, ia = f.monsters.findIndex(m => m && m.id === r.a), ib = f.monsters.findIndex(m => m && m.id === r.b);
  if (ia < 0 || ib < 0) return false;
  f.monsters[Math.min(ia, ib)] = newMonster(id, TIERS[r.tier].startLevel, g.rcos); f.monsters[Math.max(ia, ib)] = null;      // takes one zone, frees the other
  if (f.firstFusionAt < 0) f.firstFusionAt = g.t;
  g.fusions++; g.fusionIds.push(id); recompute(g); g.event('banner', FUSIONS[id].name + ' is summoned!'); g.event('summon', id);
  return true;
}

// ---- offers ----
function rarityRoll(g) {
  const O = OFFER.rarityOdds, ks = Object.keys(O); let t = 0; for (const k of ks) t += O[k];
  let r = g.rl() * t, pick = 'common'; for (const k of ks) { r -= O[k]; if (r < 0) { pick = k; break; } }
  if (g.mods.luck > 0 && g.rl() < g.mods.luck * 1.0) { const i = ks.indexOf(pick); pick = ks[Math.min(ks.length - 1, i + 1)]; }      // luck: sometimes one rarity step up
  return pick;
}
const ORDER = ['common', 'rare', 'epic', 'legendary'];

// every card the duelist can be offered right now
export function candidates(g, minRarity) {
  const f = g.field, c = [], free = f.monsters.some(m => !m), freeS = f.spells.some(s => !s);
  const minI = minRarity ? ORDER.indexOf(minRarity) : 0;
  const push = (id, kind, isNew, to) => { if (g.unlockedCards && (MONSTERS[id] || SPELLS[id] || TRAPS[id] || ONE_SHOTS[id]) && !g.unlockedCards.has(id)) return; const d = cardDef(id); if (!f.banished.has(id) && ORDER.indexOf(d.rarity || 'common') >= minI) c.push({ id, kind, isNew, to, rarity: d.rarity || 'common' }); };
  for (const id of Object.keys(MONSTERS)) {
    const m = f.monsters.find(x => x && x.id === id);
    if (m) { if (m.level < monsterMax(id)) push(id, 'monster', false, m.level + 1); }
    else if (free && !f.monsters.some(x => x && FUSIONS[x.id] && FUSIONS[x.id].from.includes(id))) push(id, 'monster', true, 1);
  }
  for (const id of Object.keys(FUSIONS)) { const m = f.monsters.find(x => x && x.id === id); if (m && m.level < LEVELS.fusedMax) push(id, 'monster', false, m.level + 1); }
  for (const id of Object.keys(SPELLS)) {
    const s = f.spells.find(x => x && x.id === id);
    if (s) { if (s.level < LEVELS.spellMax) push(id, 'spell', false, s.level + 1); } else if (freeS) push(id, 'spell', true, Math.min(LEVELS.spellMax, 1 + bonusFree(f.spells, f.bonusS)));
  }
  for (const id of Object.keys(TRAPS)) {
    const s = f.spells.find(x => x && x.id === id);
    if (s) { if (s.level < LEVELS.spellMax) push(id, 'trap', false, s.level + 1); } else if (freeS) push(id, 'trap', true, 1);
  }
  for (const id of Object.keys(ONE_SHOTS)) push(id, 'oneshot', true, 1);
  return c;
}

function bonusFree(slots, bonus) { const i = slots.findIndex((x, k) => !x && bonus[k] > 0); return i >= 0 ? bonus[i] : 0; }
// Offer rules: an owned monster's upgrade is in at most one of the three slots, and in at most 2 of any 3 consecutive offers
// (a Redraw or Banish rebuilds the current offer and is exempt, so spending one is how you ask for more).
export function buildOffer(g, minRarity, reroll) {
  const f = g.field, D = DUELISTS[f.duelist] || DUELISTS.kael, pool = candidates(g, minRarity), out = [];
  const H = g.upgHist || (g.upgHist = []), isUp = c => c.kind === 'monster' && !c.isNew;
  const push = pairPush(g), allow = reroll || H.length < 2 || !(H[H.length - 1] && H[H.length - 2]) || push.relax;
  const dropUps = () => { for (let i = pool.length - 1; i >= 0; i--) if (isUp(pool[i])) pool.splice(i, 1); };
  const take = c => { out.push(c); const i = pool.indexOf(c); if (i >= 0) pool.splice(i, 1); if (isUp(c)) dropUps(); };
  if (!allow) dropUps();
  if (push.length && minRarity) { const extra = candidates(g).find(c => c.id === push[0] && !c.isNew); if (extra && !pool.some(x => x.id === extra.id)) pool.push(extra); }       // a chest's rarity floor never hides the Fusion pair's upgrade
  const seen = g.upgSeen || (g.upgSeen = {}); g.offerN = (g.offerN || 0) + (reroll ? 0 : 1);
  if (!reroll && g.lastOffered) { const avoid = new Set(g.lastOffered), keep = pool.filter(c => !(c.isNew && avoid.has(c.id))); if (keep.length >= OFFER.size) { pool.length = 0; pool.push(...keep); } }       // a new card you passed on does not come straight back
  // forced cards: the partner monster by level 3, a Trap by level 4
  if (g.level >= OFFER.secondMonsterByLevel && !f.monsters.some(m => m && (m.id === D.second || (FUSIONS[m.id] && FUSIONS[m.id].from.includes(D.second))))) {
    const c = pool.find(x => x.id === D.second && x.isNew); if (c) take(c);
  }
  if (g.level >= OFFER.trapByLevel && !g.trapForced && !f.spells.some(s => s && TRAPS[s.id]) && out.length < OFFER.size) {       // the first Trap is pushed into one offer, once
    const c = pool.find(x => x.kind === 'trap' && x.isNew); if (c) { take(c); g.trapForced = true; }
  }
  if (OFFER.guaranteeMonsterUpgrade && allow && out.length < OFFER.size && !out.some(isUp)) {
    const ups = pool.filter(x => x.kind === 'monster' && !x.isNew), pu = push.length ? ups.find(x => x.id === push[0]) : null;
    if (pu) take(pu); else if (ups.length) { let best = ups[0]; for (const u of ups) if ((seen[u.id] === undefined ? -1 : seen[u.id]) < (seen[best.id] === undefined ? -1 : seen[best.id])) best = u; take(best); }       // the guaranteed upgrade rotates to the monster offered longest ago
  }
  while (out.length < OFFER.size && pool.length) {
    const want = rarityRoll(g);
    let tier = pool.filter(c => c.rarity === want);
    if (!tier.length) for (let d = 1; d < 4 && !tier.length; d++) tier = pool.filter(c => c.rarity === ORDER[Math.max(0, ORDER.indexOf(want) - d)]) || [];
    if (!tier.length) tier = pool;
    take(tier[Math.floor(g.rl() * tier.length)]);
  }
  for (const c of out) { if (isUp(c)) seen[c.id] = g.offerN; } if (!reroll) g.lastOffered = out.map(c => c.id); else g.lastOffered = out.map(c => c.id);
  const flag = out.some(isUp); if (reroll && H.length) H[H.length - 1] = flag; else H.push(flag); if (H.length > 3) H.shift();
  return out;
}

export function openLevelOffer(g) {
  const cards = buildOffer(g);
  if (!cards.length) { g.coins += OFFER.passCoins; g.pendingLevels--; g.event('banner', 'Nothing to offer. +' + OFFER.passCoins + ' coins.'); return; }
  g.offer = { type: 'level', cards, leave: false };
  g.event('offer', null);
}
export function openChest(g, chest) {
  const ready = fusionsReady(g);
  if (ready.length) { g.offer = { type: 'fusion', cards: ready.map(id => ({ id, kind: 'fusion', isNew: true, to: 1, rarity: 'epic' })), leave: true, chest }; }
  else { const cards = buildOffer(g, OFFER.chestRarityFloor); if (!cards.length) { g.event('banner', 'The chest is empty of anything you can use.'); return; } g.offer = { type: 'chest', cards, leave: true, chest }; }
  g.event('offer', null);
}

function applyCard(g, c) {
  const f = g.field;
  if (c.kind !== 'fusion' && !g.cardsPicked.includes(c.id)) g.cardsPicked.push(c.id);
  const D0 = MONSTERS[c.id] || FUSIONS[c.id]; if (D0 && D0.elements) g.elementsUsed |= elemBits(D0.elements);
  if (c.kind === 'fusion') { doFusion(g, c.id); return; }
  if (c.kind === 'monster') {
    const m = f.monsters.find(x => x && x.id === c.id);
    if (m) { const before = formOf(m.id, m.level); m.level = c.to; evolve(g, m, before); } else {
      let i = f.monsters.findIndex((x, k) => !x && f.bonusM[k] > 0); if (i < 0) i = f.monsters.findIndex(x => !x);
      if (i >= 0) { const start = Math.min(monsterMax(c.id), 1 + f.bonusM[i]); f.bonusM[i] = 0; f.monsters[i] = newMonster(c.id, start, g.rcos); g.event('summon', c.id); if (start > 1) g.event('banner', def(c.id).name + ' starts at level ' + start + ' (Tribute).'); }
    }
  } else if (c.kind === 'spell' || c.kind === 'trap') {
    const s = f.spells.find(x => x && x.id === c.id);
    if (s) s.level = c.to; else {
      let i = f.spells.findIndex((x, k) => !x && f.bonusS[k] > 0); if (i < 0) i = f.spells.findIndex(x => !x);
      if (i >= 0 && TRAPS[c.id]) { g.trapEver = true; g.trapsSet++; }
      if (i >= 0) { const start = Math.min(LEVELS.spellMax, 1 + f.bonusS[i]); f.bonusS[i] = 0; f.spells[i] = { id: c.id, level: start, cd: 0, rootFx: 0 }; }
    }
    if (c.id === 'heart-of-the-cards') g.p.hp = Math.min(g.cfgHp + g.mods.maxLp + SPELLS[c.id].per.maxLp, g.p.hp + SPELLS[c.id].healNow);
  } else if (c.kind === 'oneshot') {
    if (c.id === 'second-wind') g.p.hp = g.p.maxHp;
    if (c.id === 'storm-of-cards') g.storm = { left: ONE_SHOTS['storm-of-cards'].cards, t: 0 };
  }
  f.picks++; recompute(g);
}

// crossing level 5 or 10 swaps the monster to its next form with a short summon flash
function evolve(g, m, before) {
  if (formOf(m.id, m.level) === 2 && !g.fullForms.includes(m.id)) g.fullForms.push(m.id);          // reached its full form (unlock key dsfull:<monster>)
  if (formOf(m.id, m.level) <= before) return;
  addFx(g, { type: 'ring', owner: 2, x: m.x, y: m.y - 1, z: m.z, r: 3.5, dur: 0.6, color: 0xc090ff });
  g.event('banner', def(m.id).name + ' evolves!'); g.event('summon', m.id);
}

// Altar of Tribute: give up a fielded card, free its zone, and the next card placed there starts +2 levels
export function tributeCard(g, c) {
  const f = g.field, list = c.zone === 'monster' ? f.monsters : f.spells, bonus = c.zone === 'monster' ? f.bonusM : f.bonusS;
  list[c.index] = null; bonus[c.index] = (bonus[c.index] || 0) + E_ALTAR.tributeBonus;
  recompute(g); g.event('banner', cardDef(c.id).name + ' is given up. The next card in that zone starts +' + E_ALTAR.tributeBonus + ' levels.');
}
export function addItem(g, id) { if (ITEMS[id].unique && g.items.includes(id)) return false; g.items.push(id); recompute(g); g.event('banner', ITEMS[id].name + ': ' + ITEMS[id].text); return true; }
export function addBlessing(g, id, mult) { mult = mult || 1; g.blessings.push(id); (g.blessingMult || (g.blessingMult = [])).push(mult); recompute(g); if (BLESSINGS[id].heal) g.p.hp = Math.min(g.p.maxHp, g.p.hp + Math.round(BLESSINGS[id].heal * mult)); g.event('banner', BLESSINGS[id].name + '. ' + (BLESSINGS[id].fmt ? BLESSINGS[id].fmt(mult) : BLESSINGS[id].text)); }

export function chooseCard(g, idx) {
  const o = g.offer; if (!o || !o.cards[idx]) return false;
  const c = o.cards[idx];
  if (o.type === 'shop') {                                           // the Broker: pay Coins, the offer stays open so you can browse
    if (c.sold || g.coins < c.price || (ITEMS[c.id].unique && g.items.includes(c.id))) return false;
    g.coins -= c.price; c.sold = true; c.stockRef.sold = true; addItem(g, c.id); return true;
  }
  if (c.kind === 'item') addItem(g, c.id);
  else if (c.kind === 'blessing') addBlessing(g, c.id, c.mult);
  else if (c.kind === 'banish') { g.field.banished.add(c.id); g.event('banner', cardDef(c.id).name + ' will no longer be offered.'); }
  else if (c.kind === 'tribute') tributeCard(g, c);
  else applyCard(g, c);
  if (o.type === 'level') g.pendingLevels--;
  if (o.source && (o.type === 'item' || o.type === 'altar')) o.source.used = true;
  if (o.chest) o.chest.open = true;
  g.offer = null; g.event('offer-closed', null);
  return true;
}
export function redraw(g) {
  const o = g.offer, f = g.field; if (!o || !(o.type === 'level' || o.type === 'chest')) return false;
  if (o.freeRedraws > 0) o.freeRedraws--;                                 // Deck Box: free Redraws on chests
  else if (f.redraws > 0) f.redraws--; else return false; o.cards = buildOffer(g, o.floor || (o.type === 'chest' ? OFFER.chestRarityFloor : undefined), true); return o.cards.length > 0;
}
export function banish(g, idx) {
  const o = g.offer, f = g.field; if (!o || f.banishes <= 0 || !o.cards[idx] || !(o.type === 'level' || o.type === 'chest')) return false;
  f.banished.add(o.cards[idx].id); f.banishes--;
  o.cards = buildOffer(g, o.floor || (o.type === 'chest' ? OFFER.chestRarityFloor : undefined), true); return true;
}
export function pass(g) {
  const o = g.offer; if (!o || o.type !== 'level') return false;
  g.coins += OFFER.passCoins; g.pendingLevels--; g.offer = null; g.event('offer-closed', null); return true;
}
export function leaveChest(g) { const o = g.offer; if (!o || !o.leave) return false; if (o.type === 'blessing' && o.source) { o.source.done = false; o.source.charge = 0; o.source.idle = 0; } g.offer = null;       // declining a shrine keeps it, with the same three blessings, for later
   g.event('offer-closed', null); return true; }








