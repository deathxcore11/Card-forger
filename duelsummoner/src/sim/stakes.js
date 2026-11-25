// Stakes: the big desert's in-run difficulty stat, shown as a percent (0 at the start). It rises with the difficulty chosen, the stage clock (a gentle +2% a minute), Wager Shrines, and items and boons that trade safety for power;
// it carries over from stage to stage. It raises the crowd (spawn density up to +500%, so 6x), a SMALL swarm hp and damage scale (up to +60% at the cap) and how hard bosses hit and how long they last, and it pays back in coins, XP, pickup and
// item luck, and score. A weak build that pushes it early hits a wall; a strong one that climbs it across stages 2 and 3 snowballs into big kill counts. Only one rare legendary item lowers it.
export const STAKES = { cap: 500, perMinute: 2, base: { easy: 0, medium: 30, hard: 70 }, hpAtCap: 0.6, dmgAtCap: 0.6, bossHp: 0.5, coin: 1 / 300, xp: 1 / 400, pickup: 1 / 250, luck: 1 / 400, score: 1 / 200, wager: [5, 10] };
export function stakesOf(g) {
  if (!g.big) return 0; let s = (STAKES.base[g.difficulty] || 0) + ((g.scTotal || 0) + (g.sc || 0)) / 60 * STAKES.perMinute + (g.stakesAdd || 0) + ((g.mods && g.mods.stakes) || 0);
  return s < 0 ? 0 : s > STAKES.cap ? STAKES.cap : s;
}
export const stakesFrac = g => Math.min(1, (g.stakes || 0) / STAKES.cap);
export const stakesDensity = g => 1 + (g.stakes || 0) / 100;
export function wager(g, shrine) {
  const lo = STAKES.wager[0], hi = STAKES.wager[1], add = lo + Math.floor(g.rl() * (hi - lo + 1)); shrine.used = true; g.stakesAdd = (g.stakesAdd || 0) + add; g.wagersTaken = (g.wagersTaken | 0) + 1;
  g.stakes = stakesOf(g);
  g.event('banner', 'The Wager Shrine takes its price: Stakes +' + add + '%.');
  if (g.rl() < 0.5) g.coins += Math.round(35 * (1 + g.stakes / 100)), g.event('banner', 'Coins fall out of the sand.');
  else { g.world.wagerItem = shrine; return true; }       // the caller opens a free item offer
  return false;
}
