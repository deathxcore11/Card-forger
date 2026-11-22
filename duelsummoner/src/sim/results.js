// One flat, versioned object describing a finished run. The save, quests, unlock keys and any host (browser or native) read this.
export const RESULTS_SCHEMA = 1, BUILD_VERSION = '0.3.0';

export function runResults(g, ctx) {
  ctx = ctx || {};
  const keys = [];
  for (const id of g.fullForms) keys.push('dsfull:' + id);
  for (const id of g.fusionIds) keys.push('dsfu:' + id);
  for (let b = 0; b < 8; b++) if (g.elementsUsed & (1 << b)) keys.push('dsel:' + ['fire', 'lightning', 'ice', 'poison', 'wind', 'earth', 'light', 'dark'][b]);
  for (const id of g.items) keys.push('dsit:' + id);
  keys.push('dsdu:' + g.duelist);
  for (const id of g.cardsPicked) keys.push('dslib:' + id);
  const deck = g.opts.meta && g.opts.meta.deck ? g.opts.meta.deck : {};
  for (const k of Object.keys(deck)) if (deck[k] > 0) keys.push('dsdb:' + k + ':' + deck[k]);
  return {
    game: 'ds', schema: RESULTS_SCHEMA, runId: ctx.runId || ('ds-' + g.seed), seed: g.seed, version: ctx.version || BUILD_VERSION,
    timeSurvived: g.t, overtimeSeconds: g.overtimeSeconds(),
    result: g.bossKilled ? 'win' : g.ended ? 'ended' : g.over ? 'loss' : 'running',
    heat: ctx.heat || 0, duelist: g.duelist, kills: g.kills, bossKills: g.bossKilled ? 1 : 0, levelUps: g.levelUps,
    fusions: g.fusions, godFusions: g.godFusions, secretFusions: g.secretFusions, reactionsByType: {},
    chestsOpened: g.world.opened, trapsFired: g.trapsFired, trapsSet: g.trapsSet, maxMonstersOnField: g.maxMonsters,
    gateOpenedAt: g.gateOpenedAt, stagesCleared: 0, keys,
    // extras this build also reports
    level: g.level, wardenKilled: g.wardenKilled, elitesKilled: g.elitesKilled, vasesBroken: g.vasesBroken, starChips: g.starChips(), killedBy: g.killedBy
  };
}
