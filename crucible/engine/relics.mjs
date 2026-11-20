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

  // Forger rules. Kind F: carried only by that Forger, never offered.
  f_tarn: { name: "Tarn's Fire", kind: 'F', family: 'forger', text: 'Your first meld each duel gets +100 ATK this duel.' },
  f_scrapper: { name: "Scrapper's Luck", kind: 'F', family: 'forger', text: 'Each fizzle pays 5 Embers after the duel, up to four a duel. The first fizzle each duel also makes your next refill draw one extra card.' },
  f_veil: { name: 'Quiet Hands', kind: 'F', family: 'forger', text: 'Once a turn, setting a Trap does not use your play.' },
  f_storm: { name: 'Home Sky', kind: 'F', family: 'forger', text: "You start each duel with your kit's Field Spell as the terrain, and your first monster it favours each duel gets +300 DEF this duel." },
};

// Lab relics: experiments that are never offered in a run. They are added to the player's
// relics only through the config list `testRelics`, so normal runs and fixtures never see them.
// They use the chained hooks (ingredients, mark, returned, endTurn): one relic's effect can
// raise a hook that another relic answers, inside the limits in fire().
export const LAB = {
  tomb_ledger: { name: 'Tomb Ledger', kind: 'G', family: 'tomb', text: 'Once a turn, when a meld sends two or more of your monsters to the graveyard, gain a Tomb mark. Each of your first five marks a duel gives your next meld +200 ATK this duel.' },
  grave_call: { name: 'Grave Call', kind: 'G', family: 'tomb', text: 'The first time each turn you gain a Tomb mark, return your best monster with 1500 ATK or less from the graveyard to your hand. Without marks, it does this once a duel when a meld sends three or more monsters to the graveyard.' },
  second_burial: { name: 'Second Burial', kind: 'G', family: 'tomb', text: 'Once a turn, when a monster returns from your graveyard to your hand, your next meld gets +300 ATK this duel.' },
  returning_tomb: { name: 'The Returning Tomb', kind: 'M', family: 'tomb', text: 'Once a duel, on your third Tomb mark, return the strongest monster in your graveyard to your hand.' },
  thorn_veil: { name: 'Thorn Veil', kind: 'G', family: 'shadow', text: 'At the end of your turn the rival loses 200 Life Points for each of your veiled monsters, up to three.' },
  shield_oath: { name: 'Shield Oath', kind: 'G', family: 'shadow', text: 'When your defending monster survives an attack it becomes a Guard: while it stays in defense the rival must attack it first. Each time a Guard survives, up to four times a duel, your next meld gets +300 ATK this duel.' },
  deep_shade: { name: 'Deep Shade', kind: 'G', family: 'shadow', text: 'When an attack reveals your veiled monster, your next meld gets +300 ATK this duel. Up to four times a duel.' },
  long_watch: { name: 'Long Watch', kind: 'G', family: 'shadow', text: 'At the start of your turn, if you hold a veiled monster, your next meld gets +400 ATK this duel. Up to five times a duel.' },
  bone_tithe: { name: 'Bone Tithe', kind: 'G', family: 'tomb', text: 'Each time you gain a Tomb mark, the rival loses 300 Life Points. Without Tomb Ledger, this happens the first time each turn a meld sends two or more of your monsters to the graveyard. Up to five times a duel.' },
  deep_grave: { name: 'Deep Grave', kind: 'G', family: 'tomb', text: 'While your graveyard holds eight or more monsters, each meld you make gets +200 ATK this duel. Up to four times a duel.' },
  last_rites: { name: 'Last Rites', kind: 'G', family: 'tomb', text: 'When a monster returns from your graveyard to your hand, gain 300 Life Points. Up to four times a duel.' },
  ossuary: { name: 'Ossuary', kind: 'G', family: 'tomb', text: 'At the end of your turn, if your graveyard holds six or more monsters, the rival loses 100 Life Points for every two monsters in it, up to 800.' },
  grave_ward: { name: 'Grave Ward', kind: 'G', family: 'tomb', text: 'Once a turn, when a rival monster destroys yours in battle, remove the three weakest monsters in your graveyard from the duel to destroy that rival monster. Up to twice a duel.' },
  grounding_rod: { name: 'Grounding Rod', kind: 'G', family: 'storm', text: "Once a duel, after your meld of four or more cards, destroy the rival's strongest face-up monster." },
  snare: { name: 'Snare', kind: 'G', family: 'shadow', text: 'When an attack destroys your veiled monster, the attacker is destroyed too. Up to twice a duel.' },
  static_field: { name: 'Static Field', kind: 'G', family: 'storm', text: "After your meld of three or more cards, the rival's strongest face-up monster loses 300 ATK this duel. Up to three times a duel." },
  overcharge: { name: 'Overcharge', kind: 'G', family: 'storm', text: 'After your meld of four or more cards, your next meld gets +300 ATK this duel. Up to three times a duel.' },
  chain_lightning: { name: 'Chain Lightning', kind: 'G', family: 'storm', text: 'Each time one of your relics makes the rival lose Life Points, the new meld that caused it, or else your strongest monster, gets +200 ATK this duel. Up to four times a duel.' },
  spite: { name: 'Spite', kind: 'G', family: 'shadow', text: 'When an attack reveals your veiled monster, the attacker loses 400 ATK this duel. Up to four times a duel.' },
  false_floor: { name: 'False Floor', kind: 'G', family: 'shadow', text: 'Once a turn, when your veiled monster is destroyed by the attack that reveals it, the rival cannot attack again this turn.' },
  banked_coals: { name: 'Banked Coals', kind: 'G', family: 'furnace', text: 'At the start of your turn, your strongest face-up melded monster gets +300 ATK this duel. Up to four times a duel.' },
  cinder_fall: { name: 'Cinder Fall', kind: 'G', family: 'furnace', text: 'At the end of your turn, if you hold a face-up monster with 2500 ATK or more, the rival loses 400 Life Points. Up to four times a duel.' },
  quench: { name: 'Quench', kind: 'G', family: 'furnace', text: 'When your melded monster destroys a rival monster in battle, it gets +200 ATK and DEF this duel. Up to four times a duel.' },
  cracked_mask: { name: 'Cracked Mask', kind: 'G', family: 'shadow', text: 'Once a duel, when you turn your own veiled monster face up, your relics treat it as revealed by an attack, and your next meld gets +300 ATK this duel.' },
  cold_lantern: { name: 'Cold Lantern', kind: 'G', family: 'shadow', text: 'Each time an attack reveals your veiled monster and it survives, the rival loses 300 Life Points. Up to four times a duel.' },
};
const info = id => RELICS[id] || LAB[id];
export const CHAIN_DEPTH = 4, CHAIN_TURN = 12;

export const relicInfo = info;
export const MASTERWORKS = Object.entries(RELICS).filter(([, r]) => r.kind === 'M').map(([id, r]) => ({ id, parts: r.parts }));
const ORDER = { F: -1, C: 0, G: 1, M: 2 };
// Resolution order: charms, then Gifts, then Masterworks, each in the order they were gained.
export function sortRelics(ids) { return ids.map((id, i) => [id, i]).sort((a, b) => ORDER[info(a[0]).kind] - ORDER[info(b[0]).kind] || a[1] - b[1]).map(x => x[0]); }

export const has = (s, seat, id) => s.seat[seat].relics.includes(id);

function note(s, ev, seat, id, extra) {
  const st = s.stats[seat];
  st.relicFires[id] = (st.relicFires[id] || 0) + 1;
  const fam = info(id).family; st.relicFamilies[fam] = 1;
  ev.push({ e: 'relic', seat, id, ...extra });
}

// Adds a relic bonus to a monster, holding the per-monster ceiling. Masterworks sit outside it.
export function relicBonus(s, db, ev, seat, m, atk, def, id) {
  const cap = db.config.relicCap, outside = info(id).kind === 'M';
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

let depth = 0;
export function fire(s, db, ev, seat, hook, ctx) {
  const st = s.seat[seat], rs = st.rs, r = 1 - seat;
  const list = st.relics;
  if (!list.length) return;
  const B = (m, a, d, id) => relicBonus(s, db, ev, seat, m, a, d, id);
  // A relic may raise another hook. Two hard limits stop any loop: nesting depth, and raises per turn.
  const raise = (h, c) => {
    if (depth >= CHAIN_DEPTH) return;
    if (rs.chainTurn !== s.turn) { rs.chainTurn = s.turn; rs.chainN = 0; }
    if (rs.chainN >= CHAIN_TURN) return;
    rs.chainN++; s.stats[seat].chained = (s.stats[seat].chained || 0) + 1;
    depth++; try { fire(s, db, ev, seat, h, c); } finally { depth--; }
  };
  const shock = n => { hurt(s, ev, r, n); if (s.winner === null && list.includes('chain_lightning')) raise('shock', {}); };
  const strongest = p => { let b = null; for (const m of s.mon[p]) if (m && !m.veil && (!b || db.byId.get(m.id).atk + (m.ba || 0) > db.byId.get(b.id).atk + (b.ba || 0))) b = m; return b; };
  const fromGrave = (maxAtk) => {
    if (s.hand[seat].length >= db.config.handMax) return false;
    let bi = -1; s.gy[seat].forEach((g, i) => { if (db.isMonster(g) && db.byId.get(g).atk <= maxAtk && (bi < 0 || db.cmp(db.byId.get(g), db.byId.get(s.gy[seat][bi])) > 0)) bi = i; });
    if (bi < 0) return false;
    const g = s.gy[seat].splice(bi, 1)[0]; s.hand[seat].push({ u: s.uid++, id: g }); ev.push({ e: 'return', seat, id: g }); return true;
  };
  for (const id of list) {
    switch (hook + ':' + id) {
      case 'duelStart:iron_rations': s.lp[seat] += 500; note(s, ev, seat, id); break;
      case 'duelStart:home_ground': if (st.homeField && !s.terrain) { s.terrain = { id: st.homeField, owner: seat }; note(s, ev, seat, id); } break;
      case 'duelStart:f_storm': if (st.homeField && !s.terrain) { s.terrain = { id: st.homeField, owner: seat }; note(s, ev, seat, id); } break;
      case 'fizzle:f_scrapper': if ((rs.fScrap || 0) < 4) { rs.fScrap = (rs.fScrap || 0) + 1; s.stats[seat].embers += 5; if (rs.fScrap === 1) st.extraDraw = 1; note(s, ev, seat, id); } break;
      case 'duelStart:balanced_scales': rs.scales = st.underCap >= 10 ? 1 : 0; break;

      case 'fieldPlayed:forge_heart': if (!rs.forgeHeart) { rs.forgeHeart = 1; rs.nextMeld.push({ a: 300, d: 300, id }); note(s, ev, seat, id, { armed: true }); } break;

      case 'fizzle:slag_tithe': if ((rs.slag || 0) < 2) { rs.slag = (rs.slag || 0) + 1; s.stats[seat].embers += 15; note(s, ev, seat, id); } break;

      case 'survived:gravecloth': if (!rs.gravecloth) { rs.gravecloth = 1; B(ctx.mon, 0, 300, id); } break;
      case 'survived:patient_hunter': if (rs.hunterTurn !== s.turn) { rs.hunterTurn = s.turn; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); } break;
      case 'survived:unseen_hand': if (ctx.wasVeiled && (rs.unseen || 0) < 3) { rs.unseen = (rs.unseen || 0) + 1; rs.nextMeld.push({ a: 500, d: 0, id }); if (ctx.attacker) ctx.attacker.lock = 1; note(s, ev, seat, id, { armed: true }); } break;

      case 'veiledRevealed:tomb_bell': if (!rs.tomb) { rs.tomb = 1; s.lp[seat] += 300; note(s, ev, seat, id); ev.push({ e: 'lp', seat, d: 300, src: 'relic' }); } break;
      case 'veiledRevealed:glass_idol': if ((rs.idol || 0) < 3) { rs.idol = (rs.idol || 0) + 1; note(s, ev, seat, id); hurt(s, ev, r, 300); } break;
    }
    if (s.winner !== null) return;
    switch (hook + ':' + id) {
      case 'ingredients:bone_tithe': if (!list.includes('tomb_ledger') && ctx.n >= 2 && rs.titheTurn !== s.turn && (rs.tithe || 0) < 5) { rs.titheTurn = s.turn; rs.tithe = (rs.tithe || 0) + 1; note(s, ev, seat, id); shock(300); } break;
      case 'mark:bone_tithe': if ((rs.tithe || 0) < 5) { rs.tithe = (rs.tithe || 0) + 1; note(s, ev, seat, id); shock(300); } break;
      case 'returned:last_rites': if ((rs.rites || 0) < 4) { rs.rites = (rs.rites || 0) + 1; s.lp[seat] += 300; note(s, ev, seat, id); ev.push({ e: 'lp', seat, d: 300, src: 'relic' }); } break;
      case 'surge:static_field': { const m = (rs.staticN || 0) < 3 ? strongest(r) : null; if (m) { rs.staticN = (rs.staticN || 0) + 1; m.ba = (m.ba || 0) - 300; note(s, ev, seat, id, { u: m.u, a: -300 }); } } break;
      case 'surge:overcharge': if (ctx.len >= 4 && (rs.overcharge || 0) < 3) { rs.overcharge = (rs.overcharge || 0) + 1; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); } break;
      case 'shock:chain_lightning': { const m = (rs.chainL || 0) < 4 ? strongest(seat) : null; if (m) { rs.chainL = (rs.chainL || 0) + 1; B(m, 200, 0, id); } } break;
      case 'veiledRevealed:deep_shade': if ((rs.shade || 0) < 4) { rs.shade = (rs.shade || 0) + 1; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); } break;
      case 'veiledRevealed:spite': if ((rs.spite || 0) < 4 && ctx.attacker) { rs.spite = (rs.spite || 0) + 1; ctx.attacker.ba = (ctx.attacker.ba || 0) - 400; note(s, ev, seat, id, { u: ctx.attacker.u, a: -400 }); } break;
      case 'selfReveal:cracked_mask': if (!rs.mask) { rs.mask = 1; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); raise('veiledRevealed', ctx); } break;
      case 'veiledFell:snare': if ((rs.snare || 0) < 2) { rs.snare = (rs.snare || 0) + 1; ctx.kill = true; note(s, ev, seat, id); } break;
      case 'veiledFell:false_floor': if (rs.floorTurn !== s.turn) { rs.floorTurn = s.turn; s.noAttack = true; note(s, ev, seat, id); } break;
      case 'ingredients:tomb_ledger': if (ctx.n >= 2 && rs.ledgerTurn !== s.turn) { rs.ledgerTurn = s.turn; rs.marks = (rs.marks || 0) + 1; note(s, ev, seat, id, { marks: rs.marks }); if (rs.marks <= 5) rs.nextMeld.push({ a: 200, d: 0, id }); raise('mark', { marks: rs.marks }); } break;
      case 'ingredients:grave_call': if (ctx.n >= 3 && !rs.callSolo && rs.callTurn !== s.turn && !list.includes('tomb_ledger') && fromGrave(1500)) { rs.callSolo = 1; rs.callTurn = s.turn; note(s, ev, seat, id); raise('returned', {}); } break;
      case 'mark:grave_call': if (rs.callTurn !== s.turn && fromGrave(1500)) { rs.callTurn = s.turn; note(s, ev, seat, id); raise('returned', {}); } break;
      case 'mark:returning_tomb': if (ctx.marks >= 3 && !rs.retTomb && fromGrave(99999)) { rs.retTomb = 1; note(s, ev, seat, id); raise('returned', {}); } break;
      case 'returned:second_burial': if (rs.burialTurn !== s.turn) { rs.burialTurn = s.turn; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); } break;
      case 'fell:grave_ward': if (rs.wardTurn !== s.turn && (rs.wardN || 0) < 2) { const idx = []; s.gy[seat].forEach((g, i) => { if (db.isMonster(g)) idx.push(i); }); if (idx.length >= 3) { idx.sort((x, y) => db.cmp(db.byId.get(s.gy[seat][x]), db.byId.get(s.gy[seat][y])) || x - y); for (const i of idx.slice(0, 3).sort((x, y) => y - x)) s.gy[seat].splice(i, 1); rs.wardTurn = s.turn; rs.wardN = (rs.wardN || 0) + 1; ctx.kill = true; note(s, ev, seat, id); } } break;
      case 'endTurn:ossuary': { const n = s.gy[seat].filter(g => db.isMonster(g)).length; if (n >= 6) { note(s, ev, seat, id, { n }); shock(Math.min(800, 100 * (n >> 1))); } } break;
      case 'endTurn:thorn_veil': { const n = Math.min(3, s.mon[seat].filter(m => m && m.veil).length); if (n) { note(s, ev, seat, id, { n }); shock((db.config.thornLp || 200) * n); } } break;
      case 'survived:shield_oath': { const was = ctx.mon.guard; ctx.mon.guard = 1; if (!was) note(s, ev, seat, id, { guard: true }); else if ((rs.oath || 0) < 4) { rs.oath = (rs.oath || 0) + 1; rs.nextMeld.push({ a: 300, d: 0, id }); note(s, ev, seat, id, { armed: true }); } } break;
      case 'turnStart:long_watch': if ((rs.watch || 0) < 5 && s.mon[seat].some(m => m && m.veil)) { rs.watch = (rs.watch || 0) + 1; rs.nextMeld.push({ a: db.config.watchAtk || 400, d: 0, id }); note(s, ev, seat, id, { armed: true }); } break;
      case 'turnStart:banked_coals': { let m = null; if ((rs.coals || 0) < 4) for (const x of s.mon[seat]) if (x && x.meld && !x.veil && (!m || ctx.eff(x) > ctx.eff(m))) m = x; if (m) { rs.coals = (rs.coals || 0) + 1; B(m, db.config.coalsAtk || 300, 0, id); } } break;
      case 'endTurn:cinder_fall': if ((rs.cinder || 0) < 4 && s.mon[seat].some(m => m && !m.veil && ctx.eff(m) >= (db.config.cinderAtk || 2500))) { rs.cinder = (rs.cinder || 0) + 1; note(s, ev, seat, id); shock(db.config.cinderLp || 400); } break;
      case 'wonBattle:quench': if (ctx.mon.meld && (rs.quench || 0) < 4) { rs.quench = (rs.quench || 0) + 1; B(ctx.mon, 200, 200, id); } break;
      case 'survived:cold_lantern': if (ctx.wasVeiled && (rs.lantern || 0) < 4) { rs.lantern = (rs.lantern || 0) + 1; note(s, ev, seat, id); hurt(s, ev, r, 300); } break;
    }
    if (hook === 'placed') placed(s, db, ev, seat, id, ctx, rs, st, B, r);
  }
  if (hook === 'placed' && ctx.melded && list.includes('deep_grave') && (rs.deepG || 0) < 4 && s.gy[seat].filter(g => db.isMonster(g)).length >= 8) { rs.deepG = (rs.deepG || 0) + 1; B(ctx.mon, 200, 0, 'deep_grave'); }
  if (hook === 'placed' && ctx.melded && ctx.len >= 3 && (list.includes('static_field') || list.includes('overcharge'))) raise('surge', { len: ctx.len });
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
  if (id === 'f_storm' && ctx.fresh && ctx.favoured && !rs.fStorm) { rs.fStorm = 1; B(m, 0, 300, id); }
  if (!ctx.melded) return;
  if (id === 'f_tarn' && !rs.fTarn) { rs.fTarn = 1; B(m, 100, 0, id); }
  // "next meld" bonuses armed earlier by this relic
  for (const x of rs.nextMeld) if (x.id === id && !x.used) { x.used = 1; B(m, x.a, x.d, id); }
  if (id === 'kindling' && ctx.fire && !rs.kindling) { rs.kindling = 1; B(m, 300, 300, id); }
  if (id === 'living_furnace' && ctx.fire && s.terrain && !rs.furnace) { rs.furnace = 1; m.keepT = 1; B(m, 600, 600, id); }
  if (id === 'broken_anvil' && !rs.melded) { m.ba = (m.ba || 0) - 300; B(m, 0, 600, id); }
  if (ctx.len >= 3) {
    if (id === 'copper_loop' && (rs.copper || 0) < (db.config.stormTune ? 1 : 2)) { rs.copper = (rs.copper || 0) + 1; B(m, 300, 300, id); }
    if (id === 'storm_needle' && (rs.needle || 0) < 3) { rs.needle = (rs.needle || 0) + 1; note(s, ev, seat, id); hurt(s, ev, r, 300); if (s.winner === null && st.relics.includes('chain_lightning') && (rs.chainL || 0) < 4) { const mm = ctx.mon; rs.chainL = (rs.chainL || 0) + 1; B(mm, 200, 0, 'chain_lightning'); } }
    if (id === 'spare_wire' && !rs.spare) { rs.spare = 1; st.extraDraw = 1; note(s, ev, seat, id); }
  }
  if (ctx.len >= 4 && id === 'patient_coil' && !rs.coil) { rs.coil = 1; const n = db.config.stormTune ? 200 : 300; B(m, n, n, id); }
}
