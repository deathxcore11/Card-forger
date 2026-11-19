// Relics (charms, Forge Gifts, Masterworks) for Lost Memories. Text is what the player
// reads; the handlers below are the rules. Every repeating effect has a finite count.
// kind: C charm, G gift, M masterwork. family: build family or 'trade' / 'plain' / 'core'.
export const RELICS = {
  forge_heart: { name: 'Forge Heart', kind: 'C', family: 'furnace', text: 'After you play a Field Spell, your next melded monster gets +300 ATK and DEF this duel. Once a duel.' },
  kindling: { name: 'Kindling', kind: 'G', family: 'furnace', text: 'Your first FIRE meld each duel gets +300 ATK and DEF this duel.' },
  ashen_echo: { name: 'Ashen Echo', kind: 'G', family: 'furnace', text: 'Once a duel, when a relic gives your melded monster a bonus, it gets +300 ATK more this duel.' },
  slag_tithe: { name: 'Slag Tithe', kind: 'C', family: 'furnace', text: 'When a meld fizzles, gain 15 Embers after the duel. At most twice a duel.' },
  living_furnace: { name: 'The Living Furnace', kind: 'M', family: 'furnace', parts: ['forge_heart', 'kindling'], text: 'Once a duel, your first FIRE meld while any terrain is active gets +600 ATK and DEF this duel and keeps its terrain bonus if the terrain changes.' },

  gravecloth: { name: 'Gravecloth', kind: 'C', family: 'shadow', text: 'The first time each duel one of your monsters survives an attack while defending, it gets +300 DEF this duel.' },
  patient_hunter: { name: 'Patient Hunter', kind: 'G', family: 'shadow', text: 'After your monster survives an attack while defending, your next meld gets +300 ATK this duel. Once a turn.' },
  tomb_bell: { name: 'Tomb Bell', kind: 'C', family: 'shadow', text: 'The first time each duel an attack reveals your veiled monster, gain 300 LP after that battle.' },
  hollow_mask: { name: 'Hollow Mask', kind: 'G', family: 'shadow', text: 'Once a duel, a monster you play veiled may be set in attack position. It is revealed when it battles.' },
  unseen_hand: { name: 'The Unseen Hand', kind: 'M', family: 'shadow', parts: ['gravecloth', 'patient_hunter'], text: 'Each time your veiled monster survives an attack (up to three times a duel), your next meld gets +500 ATK this duel and the attacker cannot change position next turn.' },

  balanced_scales: { name: 'Balanced Scales', kind: 'C', family: 'lean', text: 'At the start of a duel, if your deck is 10 or more weight under the cap, your first monster played gets +300 DEF this duel.' },
  precise_work: { name: 'Precise Work', kind: 'G', family: 'lean', text: 'The first bound monster you play each duel gets +300 ATK this duel.' },
  meldwrights_ledger: { name: "Meldwright's Ledger", kind: 'C', family: 'lean', text: 'Each time you bind a meld this run, gain 20 Embers.' },
  clean_draw: { name: 'Clean Draw', kind: 'G', family: 'lean', text: 'Once a duel, before you play, you may put one card from your hand on the bottom of your deck and draw another.' },
  signature: { name: 'The Signature', kind: 'M', family: 'lean', parts: ['balanced_scales', 'precise_work'], text: 'Your first bound monster each duel gets +300 ATK and DEF this duel, and if it is destroyed it returns to the bottom of your deck instead of the graveyard. Once a duel.' },

  copper_loop: { name: 'Copper Loop', kind: 'C', family: 'storm', text: 'A successful meld of three or more cards gives the result +300 ATK and DEF this duel. Up to twice a duel.' },
  storm_needle: { name: 'Storm Needle', kind: 'G', family: 'storm', text: 'After a successful meld of three or more cards, the rival loses 300 LP. Up to three times a duel.' },
  patient_coil: { name: 'Patient Coil', kind: 'G', family: 'storm', text: 'Once a duel, your first successful meld of four or more cards gets +300 ATK and DEF more.' },
  spare_wire: { name: 'Spare Wire', kind: 'C', family: 'storm', text: 'After a meld of three or more cards, your next refill draws one extra card. Once a duel.' },

  broken_anvil: { name: 'Broken Anvil', kind: 'C', family: 'trade', text: 'Your first melded monster each duel gets -300 ATK and +600 DEF this duel.' },
  glass_idol: { name: 'Glass Idol', kind: 'C', family: 'trade', text: 'Your veiled monsters have -300 DEF. When an attack reveals one, the rival loses 300 LP. Up to three times a duel.' },
  heavy_crown: { name: 'Heavy Crown', kind: 'C', family: 'trade', text: 'Your weight cap is 10 lower. Your first monster each duel gets +400 ATK this duel.' },
  tinder_vow: { name: 'Tinder Vow', kind: 'C', family: 'trade', text: 'You cannot play Equip Spells. Fuel melds give +500 instead of +300.' },

  whetstone: { name: 'Whetstone', kind: 'G', family: 'plain', text: 'Your first monster played each duel gets +200 ATK this duel.' },
  iron_rations: { name: 'Iron Rations', kind: 'G', family: 'plain', text: 'You start each duel with 500 more Life Points.' },
  ember_purse: { name: 'Ember Purse', kind: 'C', family: 'plain', text: 'Each duel you win pays 8 more Embers.' },
  heavy_pack: { name: 'Heavy Pack', kind: 'C', family: 'plain', text: 'Your weight cap is 10 higher.' },

  steady_hand: { name: 'Steady Hand', kind: 'C', family: 'core', text: 'Your first fizzle each duel returns card A to your hand instead of the graveyard.' },
  home_ground: { name: 'Home Ground', kind: 'C', family: 'core', text: "You start each duel with your kit's Field Spell as the terrain." },
  deep_pockets: { name: 'Deep Pockets', kind: 'C', family: 'core', text: 'Your hand refills to six.' },
  second_wind: { name: 'Second Wind', kind: 'C', family: 'core', text: 'The first time you would lose a duel, go to 1000 Life Points and keep playing. Once a run.' },
};

export const MASTERWORKS = Object.entries(RELICS).filter(([, r]) => r.kind === 'M').map(([id, r]) => ({ id, parts: r.parts }));
const ORDER = { C: 0, G: 1, M: 2 };
// Resolution order: charms, then Gifts, then Masterworks, each in the order they were gained.
export function sortRelics(ids) { return ids.map((id, i) => [id, i]).sort((a, b) => ORDER[RELICS[a[0]].kind] - ORDER[RELICS[b[0]].kind] || a[1] - b[1]).map(x => x[0]); }

export const has = (s, seat, id) => s.seat[seat].relics.includes(id);

function note(s, ev, seat, id, extra) {
  const st = s.stats[seat];
  st.relicFires[id] = (st.relicFires[id] || 0) + 1;
  const fam = RELICS[id].family; st.relicFamilies[fam] = 1;
  ev.push({ e: 'relic', seat, id, ...extra });
}

// Adds a relic bonus to a monster, holding the per-monster ceiling. Masterworks sit outside it.
export function relicBonus(s, db, ev, seat, m, atk, def, id) {
  const cap = db.config.relicCap, outside = RELICS[id].kind === 'M';
  let a = atk, d = def, clipped = false;
  if (!outside) {
    if (a > 0) { const room = cap - (m.ra || 0); if (a > room) { a = Math.max(0, room); clipped = true; } m.ra = (m.ra || 0) + a; }
    if (d > 0) { const room = cap - (m.rd || 0); if (d > room) { d = Math.max(0, room); clipped = true; } m.rd = (m.rd || 0) + d; }
  }
  m.ba = (m.ba || 0) + a; m.bd = (m.bd || 0) + d;
  note(s, ev, seat, id, { a, d, u: m.u });
  if (clipped) { s.stats[seat].capHits++; ev.push({ e: 'cap', seat, u: m.u, cap }); }
  const rs = s.seat[seat].rs;
  if (id !== 'ashen_echo' && m.meld && (a > 0 || d > 0) && has(s, seat, 'ashen_echo') && !rs.ashen) { rs.ashen = 1; relicBonus(s, db, ev, seat, m, 300, 0, 'ashen_echo'); }
}

export function fire(s, db, ev, seat, hook, ctx) {
  const st = s.seat[seat], rs = st.rs, r = 1 - seat;
  const list = st.relics;
  if (!list.length) return;
  const B = (m, a, d, id) => relicBonus(s, db, ev, seat, m, a, d, id);
  for (const id of list) {
    switch (hook + ':' + id) {
      case 'duelStart:iron_rations': s.lp[seat] += 500; note(s, ev, seat, id); break;
      case 'duelStart:home_ground': if (st.homeField && !s.terrain) { s.terrain = { id: st.homeField, owner: seat }; note(s, ev, seat, id); } break;
      case 'duelStart:balanced_scales': rs.scales = st.underCap >= 10 ? 1 : 0; break;

      case 'fieldPlayed:forge_heart': if (!rs.forgeHeart) { rs.forgeHeart = 1; rs.nextMeld.push({ a: 300, d: 300, id }); note(s, ev, seat, id, { armed: true }); } break;

      case 'fizzle:slag_tithe': if ((rs.slag || 0) < 2) { rs.slag = (rs.slag || 0) + 1; s.stats[seat].embers += 15; note(s, ev, seat, id); } break;

      case 'survived:gravecloth': if (!rs.gravecloth) { rs.gravecloth = 1; B(ctx.mon, 0, 300, id); } break;
      case 'survived:patient_hunter': if (rs.hunterTurn !== s.turn) { rs.hunterTurn = s.turn; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); } break;
      case 'survived:unseen_hand': if (ctx.wasVeiled && (rs.unseen || 0) < 3) { rs.unseen = (rs.unseen || 0) + 1; rs.nextMeld.push({ a: 500, d: 0, id }); if (ctx.attacker) ctx.attacker.lock = 1; note(s, ev, seat, id, { armed: true }); } break;

      case 'veiledRevealed:tomb_bell': if (!rs.tomb) { rs.tomb = 1; s.lp[seat] += 300; note(s, ev, seat, id); ev.push({ e: 'lp', seat, d: 300, src: 'relic' }); } break;
      case 'veiledRevealed:glass_idol': if ((rs.idol || 0) < 3) { rs.idol = (rs.idol || 0) + 1; note(s, ev, seat, id); hurt(s, ev, r, 300); } break;
    }
    if (hook === 'placed') placed(s, db, ev, seat, id, ctx, rs, st, B, r);
  }
  if (hook === 'placed' && ctx.melded) rs.nextMeld = rs.nextMeld.filter(x => !x.used);
  if (hook === 'placed' && ctx.fresh) rs.firstMon = 1;
  if (hook === 'placed' && ctx.bound && ctx.fresh) rs.boundPlayed = 1;
  if (hook === 'placed' && ctx.melded) rs.melded = 1;
}

function hurt(s, ev, seat, n) {
  s.lp[seat] -= n; s.stats[1 - seat].damageDealt += n; ev.push({ e: 'lp', seat, d: -n, src: 'relic' });
  if (s.lp[seat] <= 0 && s.winner === null) {
    const st = s.seat[seat];
    if (st.secondWind && !st.rs.secondWind) { st.rs.secondWind = 1; s.lp[seat] = 1000; return; }
    s.lp[seat] = 0; s.winner = 1 - seat; s.reason = 'lp'; s.pending = null; ev.push({ e: 'end', winner: s.winner, reason: 'lp' });
  }
}

function placed(s, db, ev, seat, id, ctx, rs, st, B, r) {
  const m = ctx.mon;
  if (ctx.fresh && !rs.firstMon) {
    if (id === 'balanced_scales' && rs.scales) B(m, 0, 300, id);
    if (id === 'heavy_crown') B(m, 400, 0, id);
    if (id === 'whetstone') B(m, 200, 0, id);
  }
  if (ctx.fresh && ctx.bound && !rs.boundPlayed) {
    if (id === 'precise_work') B(m, 300, 0, id);
    if (id === 'signature') { m.sig = 1; B(m, 300, 300, id); }
  }
  if (!ctx.melded) return;
  // "next meld" bonuses armed earlier by this relic
  for (const x of rs.nextMeld) if (x.id === id && !x.used) { x.used = 1; B(m, x.a, x.d, id); }
  if (id === 'kindling' && ctx.fire && !rs.kindling) { rs.kindling = 1; B(m, 300, 300, id); }
  if (id === 'living_furnace' && ctx.fire && s.terrain && !rs.furnace) { rs.furnace = 1; m.keepT = 1; B(m, 600, 600, id); }
  if (id === 'broken_anvil' && !rs.melded) { m.ba = (m.ba || 0) - 300; B(m, 0, 600, id); }
  if (ctx.len >= 3) {
    if (id === 'copper_loop' && (rs.copper || 0) < 2) { rs.copper = (rs.copper || 0) + 1; B(m, 300, 300, id); }
    if (id === 'storm_needle' && (rs.needle || 0) < 3) { rs.needle = (rs.needle || 0) + 1; note(s, ev, seat, id); hurt(s, ev, r, 300); }
    if (id === 'spare_wire' && !rs.spare) { rs.spare = 1; st.extraDraw = 1; note(s, ev, seat, id); }
  }
  if (ctx.len >= 4 && id === 'patient_coil' && !rs.coil) { rs.coil = 1; B(m, 300, 300, id); }
}
