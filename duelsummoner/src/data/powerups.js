// The ten pickups of the big desert (they drop from vases, and rarely from elites): each has its own look, one job, and a plain line. A vase drops nothing extra 85 times in 100, one common pickup 12 in 100, one rare one 3 in 100;
// a banded vase always drops one (7 in 10 common). Kinds 0 to 2 (XP crystal, coin, heart) are the old pickups; these continue the numbering.
export const PICK = { XP: 0, COIN: 1, HEART: 2, GREAT: 3, PURSE: 4, LODE: 5, STOP: 6, WIND: 7, DRUM: 8, WARD: 9, BURST: 10, RUMOUR: 11 };
export const POWERUPS = {
  2:  { id: 'heart',   name: 'Heart',        text: 'Heal 25.',                                   tier: 'common', color: 0xff5a7a },
  3:  { id: 'great',   name: 'Great Heart',  text: 'Heal 60.',                                   tier: 'rare',   color: 0xff8aa0 },
  4:  { id: 'purse',   name: 'Coin Purse',   text: 'A fistful of coins.',                        tier: 'common', color: 0xf0c040 },
  5:  { id: 'lode',    name: 'Lodestar',     text: 'Pulls every XP crystal to you.',             tier: 'common', color: 0xc8f6ff },
  6:  { id: 'stop',    name: 'Stopped Sand', text: 'Freezes every enemy for 5 s.',               tier: 'rare',   color: 0xa8d8ff },
  7:  { id: 'wind',    name: 'Wind Step',    text: 'Double speed for 8 s.',                      tier: 'rare',   color: 0x7dffb0 },
  8:  { id: 'drum',    name: 'War Drum',     text: '+50% damage for 10 s.',                      tier: 'rare',   color: 0xffa03c },
  9:  { id: 'ward',    name: 'Ward',         text: 'Blocks the next 3 hits.',                    tier: 'rare',   color: 0x9db0ff },
  10: { id: 'burst',   name: 'Seal Burst',   text: 'Clears the normal enemies near you.',        tier: 'rare',   color: 0xfff2c0 },
  11: { id: 'rumour',  name: 'Rumour Shard', text: 'The door rises 30 s sooner, or points the way.', tier: 'rare', color: 0x3fe0c8 }
};
export const POWER = { heal: 25, healGreat: 60, purseCoins: 14, stopSeconds: 5, windSeconds: 8, windMult: 2, drumSeconds: 10, drumBonus: 0.5, wardHits: 3, burstRadius: 30, rumourSooner: 30,
  vaseNone: 0.85, vaseCommon: 0.12, bandedCommonShare: 0.7, enemyChance: 0.0035, aceChance: 0.5 };
export const COMMON_KINDS = [2, 4, 5], RARE_KINDS = [3, 6, 7, 8, 9, 10, 11];
