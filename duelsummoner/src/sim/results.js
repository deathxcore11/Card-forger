// One flat, versioned object describing a finished run. The save, quests, unlock keys and any host (browser or native) read this.
import { hashHex } from './hash.js';
import { OATH_BY_ID } from '../data/progress.js';
export const RESULTS_SCHEMA = 1, BUILD_VERSION = '0.3.0';

// damage dealt per source per run minute, rounded: { 'ember-wyvern': [0, 12, 40, ...], 'card-throw': [...] }
function dealtOf(g) { const out = {}; for (const k of Object.keys(g.dealtLog)) { const a = g.dealtLog[k], r = []; for (let i = 0; i < a.length; i++) r.push(Math.round(a[i] || 0)); out[k] = r; } return out; }
// An Oath is kept when the run cleared every stage (Swift also needs the time). Not kept = the quest is not credited.
function oathsKept(g) {
  if (g.mode === 'classic' || !g.stages || g.stagesCleared < g.stages.length) return [];
  const secs = g.scTotal + g.sc;
  return g.oathList.filter(id => id !== 'swift' || secs < OATH_BY_ID.swift.swiftSeconds);
}
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
    chestsOpened: g.chestsOpenedTotal, trapsFired: g.trapsFired, trapsSet: g.trapsSet, maxMonstersOnField: g.maxMonsters,
    gateOpenedAt: g.gateOpenedAt, oaths: g.oathList.slice(), oathsKept: oathsKept(g), map: (g.opts && g.opts.map) || 'ruins', stagesCleared: g.stagesCleared, stageFacts: g.stageFacts, mode: g.mode, difficulty: g.difficulty, score: g.score(), stateHash: hashHex(g), damagePerMinute: dealtOf(g), keys,
    // extras this build also reports
    level: g.level, wardenKilled: g.wardenKilled, elitesKilled: g.elitesKilled, vasesBroken: g.vasesBroken, starChips: g.starChips(), killedBy: g.killedBy
  };
}
