// The rest of the item catalog of the big desert: 100 more items on top of the 20 in items.js, so 120 in all (45 common, 40 rare, 25 epic, 10 legendary). Their one-line texts are written from their own numbers, so a line never disagrees with what the item does.
// Common items are plain stat items. Rare items do something when something happens (a proc) or while a condition holds. Epic items are builds in one piece (a stat or two and a proc). Legendary items change how a run plays and are single-only (unique).
// Families (fam) group them for unlocking: finding a new item of a family counts toward the family's quests. Procs are run by sim/procs.js, stats by sim/field.js.
const pc = v => Math.round(v * 100) + '%', n1 = v => Math.round(v * 10) / 10;
const STAT_TEXT = {
  duneAir: v => 'Big air over the dune sea: a second slam where you land, ' + Math.round(60 * v) + '% bigger.', canyonVert: v => 'Each vert in a canyon heals ' + Math.round(3 * v) + ' and holds Flow 1 s longer.', ruinGrind: v => 'Grinding in a ruin field: sparks hit ' + Math.round(80 * v) + '% harder and reach 1 m further.',
  cardRate: v => 'Card throw ' + pc(v) + ' faster.', monsterRate: v => 'Your monsters attack ' + pc(v) + ' faster.', reach: v => 'Area attacks cover ' + pc(v) + ' more ground.', move: v => '+' + pc(v) + ' move speed.',
  trapRecharge: v => 'Trap recharge ' + pc(v) + ' shorter.', coinMult: v => '+' + pc(v) + ' coins.', maxLp: v => '+' + v + ' max health.', luck: v => '+' + pc(v) + ' luck: better rarities.', crit: v => '+' + pc(v) + ' crit chance.',
  critDmg: v => 'Crits hit ' + pc(v) + ' harder.', dashCd: v => 'Dash cooldown ' + pc(v) + ' shorter.', dash: v => 'Dash goes ' + pc(v) + ' further.', pickup: v => '+' + pc(v) + ' pickup range.', regen: v => 'Regain 1 health every ' + n1(1 / v) + ' s.',
  armour: v => '+' + v + ' armour.', airJumps: v => '+' + v + ' air jump' + (v > 1 ? 's' : '') + '.', bossDmg: v => '+' + pc(v) + ' damage to elites and bosses.', dmgMult: v => '+' + pc(v) + ' damage.', xp: v => '+' + pc(v) + ' XP.',
  shopDiscount: v => 'Shop prices ' + pc(v) + ' lower.', drillCard: v => 'Card throw +' + pc(v) + ' damage.', drillMon: v => 'Monsters +' + pc(v) + ' damage.', drillTrap: v => 'Traps +' + pc(v) + ' damage.', drillSpell: v => 'Spells +' + pc(v) + ' damage.',
  jumpH: v => 'Jump ' + pc(v) + ' higher.', killHeal: v => 'Heal ' + v + ' health every 20 kills.', heartMul: v => 'Hearts heal ' + pc(v) + ' more.', vaseLuck: v => 'Vases drop pickups ' + pc(v) + ' more often.', sight: v => 'See ' + pc(v) + ' further across the fog.',
  thorns: v => 'Enemies that hurt you take ' + v + ' damage.', stakes: v => 'Stakes ' + (v > 0 ? '+' : '') + v + '%.'
};
const COND_TEXT = { lowhp: 'Below 35% health', full: 'At full health', still: 'Standing still', moving: 'While running', swarm: 'With 8 or more enemies near', alone: 'With no enemy near' };
function fxText(f, n) {
  const o = [];
  if (f.nova) o.push('burst for ' + f.nova.dmg + ' in ' + f.nova.r + ' m'); if (f.heal) o.push('heal ' + f.heal); if (f.healPct) o.push(f.healPct >= 1 ? 'refill your health' : 'heal ' + pc(f.healPct)); if (f.ward) o.push('gain ' + f.ward + ' Ward');
  if (f.coins) o.push('gain ' + f.coins + ' coins'); if (f.xp) o.push('gain ' + f.xp + ' XP'); if (f.haste) o.push(pc(f.haste.amt) + ' faster for ' + f.haste.t + ' s'); if (f.might) o.push('+' + pc(f.might.amt) + ' damage for ' + f.might.t + ' s');
  if (f.stop) o.push('stop the enemies for ' + f.stop.t + ' s'); if (f.pickup) o.push(f.pickup.kind ? 'drop a pickup' : 'drop a rare pickup'); if (f.magnet) o.push('pull every crystal to you'); if (f.dashReset) o.push('refund your dash'); if (f.rumour) o.push('get a Rumour Shard');
  void n; return o.join(' and ');
}
function procText(P) {
  const e = fxText(P.fx);
  if (P.cond) { const f = P.fx, cond = COND_TEXT[P.cond]; if (f.might) return cond + ': +' + pc(f.might.amt) + ' damage.'; if (f.haste) return cond + ': ' + pc(f.haste.amt) + ' faster.'; if (f.heal) return cond + ': regain ' + f.heal + ' health a second.'; if (f.ward) return cond + ': gain a Ward every ' + (P.cd || 15) + ' s.'; }
  let t;
  if (P.on === 'kill') t = P.every ? 'Every ' + P.every + 'th kill:' : 'Each kill has a ' + pc(P.chance) + ' chance to';
  else if (P.on === 'crit') t = 'Each crit has a ' + pc(P.chance) + ' chance to';
  else if (P.on === 'hurt') t = 'When you are hurt' + (P.cd ? ' (once per ' + P.cd + ' s)' : '') + ':';
  else if (P.on === 'dash') t = P.chance ? 'Dashing has a ' + pc(P.chance) + ' chance to' : 'Each dash:';
  else if (P.on === 'level') t = 'On level-up:';
  else if (P.on === 'chest') t = 'Opening a chest:';
  else if (P.on === 'vase') t = P.chance ? 'Breaking a vase has a ' + pc(P.chance) + ' chance to' : 'Breaking a vase:';
  else if (P.on === 'pickup') t = (P.chance ? 'Taking a pickup has a ' + pc(P.chance) + ' chance to' : 'Taking a pickup') + (P.cd ? ' (once per ' + P.cd + ' s)' : '') + (P.chance ? '' : ':');
  else if (P.on === 'tick') t = 'Every ' + P.every + ' s:';
  const e2 = e.charAt(0).toUpperCase() + e.slice(1); return t.endsWith(':') ? t + ' ' + e + '.' : t + ' ' + e + '.';
}
const statLine = mods => Object.keys(mods).map(k => STAT_TEXT[k](mods[k])).join(' ');
const mk = (rarity, price, fam, extra) => (id, name, mods, proc) => { const o = { name, rarity, price, fam, mods: mods || {}, text: (mods && Object.keys(mods).length ? statLine(mods) : '') + (mods && Object.keys(mods).length && proc ? ' ' : '') + (proc ? procText(proc) : '') }; if (proc) o.proc = proc; if (extra) Object.assign(o, extra); return [id, o]; };
const C = (fam, price) => mk('common', price || 30, fam), R = fam => mk('rare', 60, fam), E = fam => mk('epic', 100, fam), L = fam => mk('legendary', 160, fam, { unique: true });
const kill = (every, fx) => ({ on: 'kill', every, fx }), killC = (chance, fx) => ({ on: 'kill', chance, fx });

export const MORE_ITEMS = Object.fromEntries([
  // ---- common: 32 plain stat items
  C('card')('sharpened-edge', 'Sharpened Edge', { critDmg: 0.25 }), C('card')('keen-eye', 'Keen Eye', { crit: 0.04 }), C('card')('stacked-deck', 'Stacked Deck', { drillCard: 0.12 }), C('card')('paper-fan', 'Paper Fan', { cardRate: 0.10 }),
  C('monster')('summoners-chalk', "Summoner's Chalk", { drillMon: 0.12 }), C('monster')('field-banner', 'Field Banner', { monsterRate: 0.10 }),
  C('trap')('spiked-plate', 'Spiked Plate', { drillTrap: 0.12 }), C('trap')('oiled-springs', 'Oiled Springs', { trapRecharge: 0.08 }),
  C('spell')('ritual-candle', 'Ritual Candle', { drillSpell: 0.12 }), C('spell')('sundial', 'Sundial', { reach: 0.08 }),
  C('move')('runner-wraps', "Runner's Wraps", { move: 0.05 }), C('move')('springy-soles', 'Springy Soles', { jumpH: 0.12 }), C('move')('fleet-sash', 'Fleet Sash', { dashCd: 0.10 }), C('move')('wind-chimes', 'Wind Chimes', { dash: 0.12 }),
  C('defence')('leather-vest', 'Leather Vest', { armour: 1 }), C('defence')('waterskin', 'Waterskin', { maxLp: 12 }), C('defence')('baked-brick', 'Baked Brick', { maxLp: 8 }), C('defence')('ox-hide', 'Ox Hide', { maxLp: 20 }, null), C('defence')('herb-pouch', 'Herb Pouch', { regen: 0.15 }),
  C('defence')('honey-jar', 'Honey Jar', { heartMul: 0.25 }), C('defence')('scar-tissue', 'Scar Tissue', { thorns: 8 }), C('defence')('travellers-bread', "Traveller's Bread", { killHeal: 1 }),
  C('economy')('brass-ring', 'Brass Ring', { coinMult: 0.12 }), C('economy')('tally-stick', 'Tally Stick', { xp: 0.08 }), C('economy')('gilded-cup', 'Gilded Cup', { coinMult: 0.20 }, null), C('economy')('haggler-tooth', "Haggler's Tooth", { shopDiscount: 0.10 }), C('economy')('scribes-ledger', "Scribe's Ledger", { xp: 0.12 }),
  C('explore')('spyglass', 'Spyglass', { sight: 0.20 }), C('explore')('dusty-map', 'Dusty Map', { sight: 0.15 }), C('explore')('iron-filings', 'Iron Filings', { pickup: 0.25 }), C('explore')('treasure-sack', 'Treasure Sack', { vaseLuck: 0.25 }), C('risk')('rabbit-foot', "Rabbit's Foot", { luck: 0.06, stakes: 5 }),
  // ---- rare: 33 procs and conditions
  R('defence')('vampire-fang', 'Vampire Fang', {}, kill(15, { heal: 2 })), R('card')('echo-bell', 'Echo Bell', {}, { on: 'crit', chance: 0.05, fx: { nova: { dmg: 12, r: 4 } } }), R('move')('dust-devil-charm', 'Dust Devil Charm', {}, { on: 'dash', chance: 0.25, fx: { haste: { amt: 0.3, t: 2 } } }),
  R('spell')('cinder-coal', 'Cinder Coal', {}, killC(0.03, { nova: { dmg: 14, r: 3.5 } })), R('economy')('lucky-sling', 'Lucky Sling', {}, { on: 'vase', chance: 0.3, fx: { coins: 8 } }), R('explore')('brass-compass', 'Brass Compass', {}, { on: 'tick', every: 90, fx: { rumour: 1 } }),
  R('trap')('old-hourglass', 'Old Hourglass', {}, { on: 'tick', every: 45, fx: { stop: { t: 1.5 } } }), R('defence')('quiet-boots', 'Quiet Boots', {}, { cond: 'still', cd: 10, fx: { ward: 1 } }), R('move')('runners-resolve', "Runner's Resolve", {}, { cond: 'moving', fx: { might: { amt: 0.10 } } }),
  R('risk')('last-stand', 'Last Stand', { stakes: 8 }, { cond: 'lowhp', fx: { might: { amt: 0.35 } } }), R('defence')('fortress-pose', 'Fortress Pose', {}, { cond: 'still', fx: { might: { amt: 0.25 } } }), R('monster')('crowd-breaker', 'Crowd Breaker', {}, { cond: 'swarm', fx: { might: { amt: 0.15 } } }),
  R('move')('lone-wolf', 'Lone Wolf', {}, { cond: 'alone', fx: { haste: { amt: 0.2 } } }), R('economy')('pickpocket', "Pickpocket's Glove", {}, { on: 'pickup', chance: 0.25, fx: { coins: 5 } }), R('spell')('level-spark', 'Level Spark', {}, { on: 'level', fx: { nova: { dmg: 40, r: 8 } } }),
  R('defence')('level-lantern', 'Level Lantern', {}, { on: 'level', fx: { ward: 1 } }), R('economy')('chest-keeper', 'Chest Keeper', {}, { on: 'chest', fx: { heal: 30 } }), R('explore')('treasure-hunter', 'Treasure Hunter', {}, { on: 'chest', fx: { xp: 20 } }),
  R('defence')('thorn-crown', 'Thorn Crown', {}, { on: 'hurt', cd: 6, fx: { nova: { dmg: 25, r: 4 } } }), R('defence')('shield-bearer', 'Shield Bearer', {}, { on: 'hurt', cd: 20, fx: { ward: 1 } }), R('move')('dash-ember', 'Dash Ember', {}, { on: 'dash', fx: { nova: { dmg: 10, r: 3 } } }),
  R('risk')('burst-bag', 'Burst Bag', { stakes: 8 }, kill(40, { pickup: {} })), R('card')('soul-jar', 'Soul Jar', {}, kill(25, { xp: 8 })), R('move')('bone-whistle', 'Bone Whistle', {}, killC(0.02, { haste: { amt: 0.4, t: 3 } })),
  R('risk')('war-paint', 'War Paint', { stakes: 8 }, { on: 'hurt', fx: { might: { amt: 0.25, t: 4 } } }), R('defence')('second-breath', 'Second Breath', {}, { on: 'hurt', cd: 90, fx: { healPct: 0.25 } }), R('explore')('magnet-heart', 'Magnet Heart', {}, { on: 'pickup', cd: 20, fx: { magnet: 1 } }),
  R('economy')('vase-breakers-glove', "Vase-Breaker's Glove", {}, { on: 'vase', chance: 0.10, fx: { pickup: {} } }), R('move')('wind-hawk', 'Wind Hawk', {}, { on: 'dash', chance: 0.2, fx: { dashReset: 1 } }), R('economy')('greedy-scale', 'Greedy Scale', {}, { on: 'chest', fx: { coins: 40 } }),
  R('economy')('fortune-tellers-cup', "Fortune Teller's Cup", {}, { on: 'level', fx: { coins: 25 } }), R('monster')('battle-hymn', 'Battle Hymn', {}, { on: 'tick', every: 30, fx: { might: { amt: 0.2, t: 6 } } }), R('move')('quick-feet', 'Quick Feet', {}, { on: 'tick', every: 25, fx: { haste: { amt: 0.25, t: 4 } } }),
  // ---- land items (card riding plan section 11): each rewards riding its own land
  R('move')('dune-kite', 'Dune Kite', { duneAir: 1 }), R('move')('canyon-spur', 'Canyon Spur', { canyonVert: 1 }), R('move')('ruin-chalk', 'Ruin Chalk', { ruinGrind: 1 }),
  // ---- epic: 25 builds
  E('defence')('ember-heart', 'Ember Heart', { maxLp: 30 }, { cond: 'lowhp', fx: { heal: 3 } }), E('card')('crown-of-cards', 'Crown of Cards', { drillCard: 0.25, drillMon: 0.15 }), E('move')('sandstorm-mantle', 'Sandstorm Mantle', { move: 0.12 }, { cond: 'moving', fx: { might: { amt: 0.15 } } }),
  E('spell')('reaper-scythe', 'Reaper Scythe', {}, kill(10, { nova: { dmg: 30, r: 5 } })), E('defence')('phoenix-feather', 'Phoenix Feather', {}, { on: 'hurt', cd: 120, fx: { healPct: 0.5, ward: 3 } }), E('explore')('hollow-lantern', 'Hollow Lantern', { sight: 0.5 }, { on: 'tick', every: 120, fx: { rumour: 1 } }),
  E('economy')('golden-idol', 'Golden Idol', { coinMult: 0.40 }, { on: 'vase', chance: 0.5, fx: { coins: 10 } }), E('card')('twin-seal-ring', 'Twin Seal Ring', { crit: 0.08, critDmg: 0.5 }), E('economy')('sage-stone', 'Sage Stone', { xp: 0.25 }, { on: 'level', fx: { heal: 20 } }),
  E('spell')('storm-caller', 'Storm Caller', {}, { on: 'crit', chance: 0.15, fx: { nova: { dmg: 20, r: 5 } } }), E('trap')('timekeeper', 'Timekeeper', {}, { on: 'tick', every: 40, fx: { stop: { t: 2 }, might: { amt: 0.15, t: 4 } } }), E('monster')('war-banner', 'War Banner', { monsterRate: 0.20, drillMon: 0.20 }),
  E('spell')('spell-weaver', 'Spell Weaver', { drillSpell: 0.30, reach: 0.15 }), E('trap')('trap-master', 'Trap Master', { drillTrap: 0.30, trapRecharge: 0.15 }), E('defence')('iron-covenant', 'Iron Covenant', { armour: 3 }, { on: 'hurt', cd: 15, fx: { ward: 1 } }),
  E('economy')('merchants-eye', "Merchant's Eye", { shopDiscount: 0.25, luck: 0.10 }, { on: 'chest', fx: { coins: 60 } }), E('defence')('bloodstone', 'Bloodstone', { killHeal: 3 }, kill(20, { heal: 3 })), E('spell')('locust-swarm', 'Locust Swarm', {}, killC(0.06, { nova: { dmg: 18, r: 3 } })),
  E('move')('blessing-of-the-wind', 'Blessing of the Wind', { airJumps: 1, jumpH: 0.2, move: 0.08 }), E('explore')('ruin-seeker', 'Ruin Seeker', { vaseLuck: 0.5, pickup: 0.3 }, { on: 'pickup', chance: 0.3, fx: { coins: 12 } }), E('risk')('gamblers-dice', "Gambler's Dice", { luck: 0.15, stakes: 15 }, { on: 'chest', fx: { xp: 40 } }),
  E('card')('executioner', 'Executioner', { bossDmg: 0.40 }, { cond: 'swarm', fx: { might: { amt: 0.10 } } }), E('defence')('plague-mask', 'Plague Mask', { regen: 0.6, maxLp: 20 }), E('risk')('sun-disc', 'Sun Disc', { dmgMult: 0.15, stakes: 10 }, { on: 'tick', every: 30, fx: { might: { amt: 0.25, t: 5 } } }),
  E('explore')('lodestone-crown', 'Lodestone Crown', { pickup: 0.6 }, { on: 'pickup', cd: 10, fx: { magnet: 1 } }),
  // ---- legendary: 10 that change a run
  L('trap')('sandglass-of-haste', 'Sandglass of Haste', {}, { on: 'tick', every: 30, fx: { stop: { t: 3 }, haste: { amt: 0.5, t: 4 } } }), L('risk')('deck-of-fate', 'Deck of Fate', { stakes: 15 }, kill(100, { healPct: 1, might: { amt: 0.5, t: 8 } })),
  L('monster')('crown-of-the-hollow-king', 'Crown of the Hollow King', { drillMon: 0.5, monsterRate: 0.3, maxLp: 40 }), L('explore')('eye-of-the-sealed-one', 'Eye of the Sealed One', { sight: 1.0, luck: 0.2 }, { on: 'tick', every: 90, fx: { rumour: 1 } }),
  L('move')('boots-of-the-gale', 'Boots of the Gale', { move: 0.25, dash: 0.3, dashCd: 0.25, airJumps: 2, jumpH: 0.3 }), L('defence')('heart-of-the-mesa', 'Heart of the Mesa', { maxLp: 120, regen: 1.0, armour: 3 }),
  L('card')('mirror-shard', 'Mirror Shard', { crit: 0.20, critDmg: 1.0 }, { on: 'crit', chance: 0.10, fx: { nova: { dmg: 40, r: 6 } } }), L('risk')('anvil-of-ruin', 'Anvil of Ruin', { dmgMult: 0.40, bossDmg: 0.50, stakes: 20 }),
  L('economy')('merchant-queens-ledger', "Merchant Queen's Ledger", { coinMult: 0.80, shopDiscount: 0.40 }, { on: 'chest', fx: { coins: 100, xp: 60 } }), L('defence')('phoenix-sigil', 'Phoenix Sigil', { stakes: -40 }, { on: 'hurt', cd: 180, fx: { healPct: 1, ward: 6 } })
]);
