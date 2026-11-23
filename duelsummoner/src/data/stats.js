// The stat sheet: every player stat by id, how it is shown, and which run modifier feeds it. Content stays written as the modifier keys the
// sim already uses (data/items.js, cards.js, meta.js); the sheet maps each key to its stat so one panel can show the whole product with its sources
// ("Might +35% = Blessing of Might 10% + Toll of Ash 21% ..."). Display scale turns a stored fraction into the shown percentage.
export const STAT = { MIGHT: 0, HUNTER: 1, KEEN: 2, TEMPO: 3, DRAW: 4, REWIND: 5, LP: 6, GUARD: 7, REGEN: 8, WARD: 9, STRIDE: 10, DASHCD: 11, LIFT: 12, MAG: 13, GREED: 14, INSIGHT: 15, BARGAIN: 16, FORT: 17, MARKD: 18, BURN: 19, REACH: 20 };
export const STAT_N = 21;
// mod: the key in g.mods; unit: pct (fraction shown as %), flat (a number), lps (per second); ceiling: the bracket's asymptote or cap, when it has one
export const STAT_INFO = [
  { id: STAT.MIGHT, label: 'Might', mod: 'dmgMult', unit: 'pct', ceiling: 'bracket 1, up to x3.5' },
  { id: STAT.HUNTER, label: 'Hunter', mod: 'bossDmg', unit: 'pct', ceiling: 'bracket 4, up to x2.8 with marks' },
  { id: STAT.KEEN, label: 'Keen (crit chance)', mod: 'crit', unit: 'pct' },
  { id: STAT.TEMPO, label: 'Tempo (monster rate)', mod: 'monsterRate', unit: 'pct', ceiling: 'up to x3' },
  { id: STAT.DRAW, label: 'Draw (card throw rate)', mod: 'cardRate', unit: 'pct', ceiling: 'up to x3' },
  { id: STAT.REWIND, label: 'Rewind (trap cooldown)', mod: 'trapRecharge', unit: 'pct' },
  { id: STAT.LP, label: 'Max LP', mod: 'maxLp', unit: 'flat' },
  { id: STAT.GUARD, label: 'Guard (armour)', mod: 'armour', unit: 'flat' },
  { id: STAT.REGEN, label: 'Renewal (LP a second)', mod: 'regen', unit: 'lps' },
  { id: STAT.WARD, label: 'Wards', mod: 'talisman', unit: 'flat' },
  { id: STAT.STRIDE, label: 'Stride (move speed)', mod: 'move', unit: 'pct' },
  { id: STAT.DASHCD, label: 'Dash recovery', mod: 'dashCd', unit: 'pct' },
  { id: STAT.LIFT, label: 'Lift (air jumps)', mod: 'airJumps', unit: 'flat' },
  { id: STAT.MAG, label: 'Magnet (pickup range)', mod: 'pickup', unit: 'pct' },
  { id: STAT.GREED, label: 'Greed (coin gain)', mod: 'coinMult', unit: 'pct' },
  { id: STAT.INSIGHT, label: 'Insight (XP gain)', mod: 'xp', unit: 'pct' },
  { id: STAT.BARGAIN, label: 'Bargain (shop prices)', mod: 'shopDiscount', unit: 'pct' },
  { id: STAT.FORT, label: 'Fortune (luck)', mod: 'luck', unit: 'pct' },
  { id: STAT.MARKD, label: 'Mark Depth', mod: 'markBonus', unit: 'pct' },
  { id: STAT.BURN, label: 'Burn (damage a second)', mod: 'burnDps', unit: 'flat' },
  { id: STAT.REACH, label: 'Reach (area size)', mod: 'reach', unit: 'pct', ceiling: 'up to +150% area (radius x1.58)' }
];
// the panel's groups: survival, offence, tempo and rates, movement, pickups and economy
export const STAT_GROUPS = [['Survival', [STAT.LP, STAT.GUARD, STAT.REGEN, STAT.WARD]], ['Offence', [STAT.MIGHT, STAT.HUNTER, STAT.KEEN, STAT.BURN, STAT.MARKD, STAT.REACH]], ['Rates', [STAT.TEMPO, STAT.DRAW, STAT.REWIND]],
  ['Movement', [STAT.STRIDE, STAT.DASHCD, STAT.LIFT]], ['Pickups and economy', [STAT.MAG, STAT.INSIGHT, STAT.GREED, STAT.BARGAIN, STAT.FORT]]];
export const STAT_BY_MOD = Object.fromEntries(STAT_INFO.map(s => [s.mod, s]));
export function fmtStat(s, v) {
  if (s.unit === 'pct') return (v >= 0 ? '+' : '') + Math.round(v * 1000) / 10 + '%';
  if (s.unit === 'lps') return '+' + Math.round(v * 100) / 100 + '/s';
  return '+' + Math.round(v * 100) / 100;
}
