// Passive items (slotless) and stat blessings. Rewards never mix: cards fill zones, ITEMS come only from Witness Stones, the
// Relic Broker and (later) the Echo Forge, BLESSINGS come only from Shrines of Tribute. `mods` are added to the run's stats.
// Items implemented here are the stat items; the rest of the bible's 30 are listed under PLANNED for later steps.
export const ITEMS = {
  'thornbound-locket': { name: 'Thornbound Locket', rarity: 'rare', price: 70, text: 'When you are hurt, a nova of 6 x your Guard (at most 120) hits everything near you. More copies help, with a ceiling.', mods: { locket: 1 } },
  'worn-duel-glove':   { name: 'Worn Duel Glove', rarity: 'common', price: 30, text: 'Card throw 15% faster.', mods: { cardRate: 0.15 } },
  'surveyors-lens':    { name: "Surveyor's Lens", rarity: 'common', price: 30, text: 'Your area attacks cover 10% more ground. Stacks, up to +150% with every source.', mods: { reach: 0.10 } },
  'sand-sandals':      { name: 'Sand Sandals', rarity: 'common', price: 30, text: '+6% move speed.', mods: { move: 0.06 } },
  'cracked-hourglass': { name: 'Cracked Hourglass', rarity: 'common', price: 30, text: 'Trap recharge 10% shorter.', mods: { trapRecharge: 0.10 } },
  'scarab-charm':      { name: 'Scarab Charm', rarity: 'common', price: 30, text: '+15% coins.', mods: { coinMult: 0.15 } },
  'clay-heart':        { name: 'Clay Heart', rarity: 'common', price: 30, text: '+15 max health.', mods: { maxLp: 15 } },
  'lucky-coin':        { name: 'Lucky Coin', rarity: 'common', price: 30, text: '+5% luck: better rarities in offers.', mods: { luck: 0.05 } },
  'whetstone-tablet':  { name: 'Whetstone Tablet', rarity: 'common', price: 30, text: '+5% crit chance.', mods: { crit: 0.05 } },
  'travelling-cloak':  { name: 'Travelling Cloak', rarity: 'common', price: 30, text: 'Dash cooldown 15% shorter.', mods: { dashCd: 0.15 } },
  'lodestone':         { name: 'Lodestone', rarity: 'common', price: 30, text: '+20% pickup range.', mods: { pickup: 0.20 } },
  'bandaged-hand':     { name: 'Bandaged Hand', rarity: 'common', price: 30, text: 'Regain 1 health every 5 s.', mods: { regen: 0.2 } },
  'bronze-scale':      { name: 'Bronze Scale', rarity: 'common', price: 30, text: '+1 armour (4 Guard): about 17% less damage from every hit, a little less with each one you add.', mods: { armour: 1 } },
  'dueling-boots':     { name: 'Dueling Boots', rarity: 'common', price: 30, text: '+1 air jump.', mods: { airJumps: 1 } },
  'hunters-mark':      { name: "Hunter's Mark", rarity: 'rare', price: 60, text: '+25% damage to elites and bosses.', mods: { bossDmg: 0.25 } },
  'burning-deck':      { name: 'Burning Deck', rarity: 'rare', price: 60, text: 'Your card throw sets enemies on fire.', mods: { cardBurn: 1 }, unique: true },
  'traders-seal':      { name: "Trader's Seal", rarity: 'rare', price: 60, text: 'Shop prices 25% lower.', mods: { shopDiscount: 0.25 } },
  'paper-talisman':    { name: 'Paper Talisman', rarity: 'rare', price: 60, text: 'Blocks one hit every 20 s.', mods: { talisman: 1 } },
  'jar-of-avarice':    { name: 'Jar of Avarice', rarity: 'rare', price: 60, text: 'Every 5th chest is free.', mods: { freeChestEvery: 5 }, unique: true },
  'graveyard-bell':    { name: 'Graveyard Bell', rarity: 'rare', price: 60, text: 'Every 50th kill explodes for 10 damage in 4 m.', mods: { bell: 1 } }
};
// Items stack: a second Sand Sandals adds another +6%. Ceilings on the summed stat keep copies sensible (the stat panel shows the raw sum and the capped value).
// Items marked unique:true are single-only (a second copy would do nothing or work against you) and are never offered again once owned.
export const ITEM_CAPS = { critDmg: 3.0, jumpH: 1.0, heartMul: 3.0, vaseLuck: 3.0, sight: 1.5, thorns: 300, killHeal: 30, reach: 1.5, move: 1.0, crit: 0.6, dashCd: 0.6, trapRecharge: 0.6, shopDiscount: 0.6, luck: 0.5, airJumps: 3, bossDmg: 1.0, regen: 3, coinMult: 2.0 };
export const PLANNED_ITEMS = ['Summoner\'s Chalk', 'Mirror Shard', 'Soul Lantern', 'Twin Seal Ring', 'Crown of the Hollow King', 'Sandglass of Haste',
  'Polymer Flask', 'Tome Binder', "Summoner's Whistle", 'Field Banner', 'Eye of the Sealed One', 'Deck of Fate'];

// text(m): the blessing's line at a rarity multiplier m (1, 1.5, 2, 3)
const r1 = n => Math.round(n * 10) / 10;
export const BLESSINGS = {
  might:     { name: 'Blessing of Might', text: '+10% damage.', fmt: m => '+' + r1(10 * m) + '% damage.', mods: { dmgMult: 0.10 } },
  swiftness: { name: 'Blessing of Swiftness', text: '+8% move speed.', fmt: m => '+' + r1(8 * m) + '% move speed.', mods: { move: 0.08 } },
  vigor:     { name: 'Blessing of Vigor', text: '+20 max health and heal 20.', fmt: m => '+' + Math.round(20 * m) + ' max health and heal ' + Math.round(20 * m) + '.', mods: { maxLp: 20 }, heal: 20 },
  haste:     { name: 'Blessing of Haste', text: 'Your monsters attack 10% faster.', fmt: m => 'Your monsters attack ' + r1(10 * m) + '% faster.', mods: { monsterRate: 0.10 } },
  guard:     { name: 'Blessing of the Guard', text: '+1 armour.', fmt: m => '+' + Math.round(m) + ' armour.', mods: { armour: 1 } },
  plenty:    { name: 'Blessing of Plenty', text: '+15% XP.', fmt: m => '+' + r1(15 * m) + '% XP.', mods: { xp: 0.15 } },
  renewal:   { name: 'Blessing of Renewal', text: 'Regain 1 health every 4 s.', fmt: m => 'Regain 1 health every ' + r1(4 / m) + ' s.', mods: { regen: 0.25 } }
};

// ---- the big desert's catalog: 100 more items (data/items2.js), flagged big:true so the older modes keep their small pools, and the families of the first twenty
import { MORE_ITEMS } from './items2.js';
import { ITEMS3 } from './items3.js';
for (const k of Object.keys(MORE_ITEMS)) ITEMS[k] = Object.assign({ big: true }, MORE_ITEMS[k]);
for (const k of Object.keys(ITEMS3)) ITEMS[k] = Object.assign({ big: true }, ITEMS3[k]);       // the coded new-design items (the new Echo Bell takes the place of the old one)
const OLD_FAM = { 'thornbound-locket': 'defence', 'worn-duel-glove': 'card', 'surveyors-lens': 'spell', 'sand-sandals': 'move', 'cracked-hourglass': 'trap', 'scarab-charm': 'economy', 'clay-heart': 'defence', 'lucky-coin': 'risk', 'whetstone-tablet': 'card', 'travelling-cloak': 'move', 'lodestone': 'explore', 'bandaged-hand': 'defence', 'bronze-scale': 'defence', 'dueling-boots': 'move', 'hunters-mark': 'card', 'burning-deck': 'card', 'traders-seal': 'economy', 'paper-talisman': 'defence', 'jar-of-avarice': 'economy', 'graveyard-bell': 'spell' };
for (const k of Object.keys(OLD_FAM)) ITEMS[k].fam = OLD_FAM[k];

// ---- nine more boons for the big desert (sixteen in all): one stat each, its size rolled by the shrine's tier
Object.assign(BLESSINGS, {
  fortune:    { big: true, name: 'Boon of Fortune', text: '+4% luck.', fmt: m => '+' + r1(4 * m) + '% luck.', mods: { luck: 0.04 } },
  precision:  { big: true, name: 'Boon of Precision', text: '+4% crit chance.', fmt: m => '+' + r1(4 * m) + '% crit chance.', mods: { crit: 0.04 } },
  ferocity:   { big: true, name: 'Boon of Ferocity', text: 'Crits hit 20% harder.', fmt: m => 'Crits hit ' + r1(20 * m) + '% harder.', mods: { critDmg: 0.20 } },
  agility:    { big: true, name: 'Boon of Agility', text: 'Dash cooldown 8% shorter.', fmt: m => 'Dash cooldown ' + r1(8 * m) + '% shorter.', mods: { dashCd: 0.08 } },
  reaching:   { big: true, name: 'Boon of Reach', text: 'Area attacks cover 8% more ground.', fmt: m => 'Area attacks cover ' + r1(8 * m) + '% more ground.', mods: { reach: 0.08 } },
  plunder:    { big: true, name: 'Boon of Plunder', text: '+10% coins.', fmt: m => '+' + r1(10 * m) + '% coins.', mods: { coinMult: 0.10 } },
  keensight:  { big: true, name: 'Boon of Keen Sight', text: 'See 12% further across the fog.', fmt: m => 'See ' + r1(12 * m) + '% further across the fog.', mods: { sight: 0.12 } },
  magnetism:  { big: true, name: 'Boon of Magnetism', text: '+15% pickup range.', fmt: m => '+' + r1(15 * m) + '% pickup range.', mods: { pickup: 0.15 } },
  // ride boons (card riding plan section 11)
  pop:        { big: true, ride: true, name: 'Boon of the Pop', text: 'Ollies go 8% higher.', fmt: m => 'Ollies go ' + r1(8 * m) + '% higher.', mods: { ridePop: 0.08 } },
  poise:      { big: true, ride: true, name: 'Boon of Poise', text: 'Grind and manual balance drifts 12% slower.', fmt: m => 'Balance drifts ' + r1(12 * m) + '% slower.', mods: { rideBal: 0.12 } },
  whirl:      { big: true, ride: true, name: 'Boon of the Whirl', text: 'Spins turn 10% faster.', fmt: m => 'Spins turn ' + r1(10 * m) + '% faster.', mods: { rideSpin: 0.10 } },
  flowkeep:   { big: true, ride: true, name: 'Boon of Flow', text: 'Flow holds 2 s longer before it falls.', fmt: m => 'Flow holds ' + r1(2 * m) + ' s longer.', mods: { flowHold: 2 } },
  quake:      { big: true, ride: true, name: 'Boon of the Quake', text: 'Landing slams reach 10% further.', fmt: m => 'Slams reach ' + r1(10 * m) + '% further.', mods: { slamSize: 0.10 } },
  rails:      { big: true, ride: true, name: 'Boon of Rails', text: 'Grinds run 8% faster.', fmt: m => 'Grinds run ' + r1(8 * m) + '% faster.', mods: { grindSpeed: 0.08 } },
  tempo:      { big: true, name: 'Boon of Tempo', text: 'Card throw 6% faster.', fmt: m => 'Card throw ' + r1(6 * m) + '% faster.', mods: { cardRate: 0.06 } }
});
for (const k of Object.keys(ITEMS)) if (ITEMS[k].mods && ITEMS[k].mods.stakes) ITEMS[k].risk = true;       // the items that trade Stakes for power
