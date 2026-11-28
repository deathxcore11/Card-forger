// Meta rules (pure, testable): Deck Box ranks to run modifiers, quest progress and rewards, mastery, map records, unlock sets, buying upgrades.
import { summonMeta, applySummonRun } from './summonUnlocks.js';
import { DECK_BOX, STARTER, OLD_STARTER } from '../data/meta.js';
import { START_BOARDS } from '../data/boards.js';
import { QUESTS } from '../data/quests.js';
import { MASTERY, masteryRank, MAPS, DUELIST_INFO, LIBRARY_MIN } from '../data/progress.js';

export function defaultMeta() {
  return {
    deck: {}, unlockedCards: STARTER.cards.slice(), unlockedItems: STARTER.items.slice(), unlockedBoons: STARTER.boons.slice(), unlockedPickups: STARTER.pickups.slice(), itemsFound: [], stagesOpen: STARTER.stages, questsDone: [],
    totals: { kills: 0, chests: 0, vases: 0, runs: 0, bossKills: 0, stagesCleared: 0, fusions: 0, godFusions: 0, wardenKills: 0, minutes: 0, doorsFound: 0, deaths: 0, pickups: 0, boons: 0 },
    boards: START_BOARDS.slice(), board: 'plain-back',
    best: {}, keys: {}, oathCount: {}, mastery: {}, maps: {}, duelists: STARTER.duelists.slice(), outfits: [], regalia: [], libraryOff: [], diffUnlock: {}, oathsOpen: []
  };
}
export const rankOf = (meta, key) => Math.min(5, meta.deck[key] || 0);

// ranks -> modifiers handed to the sim as opts.meta.mods
export function deckMods(meta) {
  const m = {};
  const add = o => { for (const k of Object.keys(o)) m[k] = (m[k] || 0) + o[k]; };
  for (const key of Object.keys(DECK_BOX)) {
    const D = DECK_BOX[key], r = rankOf(meta, key);
    for (let i = 0; i < r; i++) { if (D.per) { const o = {}; for (const k of Object.keys(D.per)) o[k] = D.per[k]; add(o); } else if (D.perRank) add(D.perRank[i]); }
  }
  return m;
}
// what the sim receives. Cards the player switched off in the Card Library stay out of the offer pool.
export function simMeta(meta) {
  const off = new Set(meta.libraryOff || []);
  return { summons: summonMeta(meta).summons.slice(), mods: deckMods(meta), cards: meta.unlockedCards.filter(c => !off.has(c)), items: meta.unlockedItems.filter(c => !off.has(c)), deck: Object.assign({}, meta.deck), boons: (meta.unlockedBoons || STARTER.boons).slice(), pickups: (meta.unlockedPickups || STARTER.pickups).slice(), stagesOpen: meta.stagesOpen || 3 };
}
// switching a card off is refused when fewer than LIBRARY_MIN would stay on
export function setCardEnabled(meta, id, on) {
  const off = new Set(meta.libraryOff || []);
  if (on) off.delete(id); else {
    const enabled = meta.unlockedCards.concat(meta.unlockedItems).filter(c => !off.has(c));
    if (!enabled.includes(id)) return true;
    if (enabled.length - 1 < LIBRARY_MIN) return false;
    off.add(id);
  }
  meta.libraryOff = Array.from(off); return true;
}

export function upgradeCost(meta, key) { const r = rankOf(meta, key); return r >= 5 ? null : DECK_BOX[key].cost[r]; }
export function buyUpgrade(meta, chips, key) {                    // returns the new chip total, or null when it cannot be bought
  const c = upgradeCost(meta, key); if (c === null || chips < c) return null;
  meta.deck[key] = rankOf(meta, key) + 1; return chips - c;
}

// Refunds (menus-spec 8): every rank gives back its full price, so nothing is lost. Each returns the Star Chips to add; the caller adds them.
export function refundOne(meta, key) { const r = rankOf(meta, key); if (r <= 0) return 0; meta.deck[key] = r - 1; return DECK_BOX[key].cost[r - 1]; }
export function refundKey(meta, key) { let sum = 0; while (rankOf(meta, key) > 0) sum += refundOne(meta, key); return sum; }
export function refundAll(meta) { let sum = 0; for (const k of Object.keys(DECK_BOX)) sum += refundKey(meta, k); return sum; }
export const refundValue = (meta, key, mode) => { const r = rankOf(meta, key), c = DECK_BOX[key].cost; if (mode === 'one') return r > 0 ? c[r - 1] : 0; if (mode === 'key') return c.slice(0, r).reduce((s, v) => s + v, 0); return Object.keys(DECK_BOX).reduce((s, k) => s + DECK_BOX[k].cost.slice(0, rankOf(meta, k)).reduce((a, v) => a + v, 0), 0); };
// the total effect of an upgrade at rank r, as text ("+10 max LP", "+4% XP", "+1 Redraw")
export function effectText(key, r) {
  const D = DECK_BOX[key]; if (r <= 0) return 'none';
  const tot = {}; if (D.per) for (const f in D.per) tot[f] = D.per[f] * r; if (D.perRank) for (let i = 0; i < r; i++) for (const f in D.perRank[i]) tot[f] = (tot[f] || 0) + D.perRank[i][f];
  const NAME = { maxLp: 'max LP', move: 'move speed', pickup: 'pickup range', xp: 'XP', coinMult: 'coins', luck: 'luck', armour: 'armour', redraws: 'Redraw', banishes: 'Exile', startLevel: 'starting monster level', chestRedraws: 'chest Redraw', openingHand: 'opening Spell' };
  return Object.keys(tot).map(f => (tot[f] < 1 && tot[f] > 0 ? '+' + Math.round(tot[f] * 100) + '%' : '+' + tot[f]) + ' ' + (NAME[f] || f) + (tot[f] > 1 && /Redraw|Exile|Spell/.test(NAME[f] || '') ? 's' : '')).join(', ') || 'none';
}

// ---- quests ----
export function statValue(meta, stat) {
  const [kind, name] = [stat.slice(0, stat.indexOf('.')), stat.slice(stat.indexOf('.') + 1)];
  if (kind === 'total') return meta.totals[name] || 0;
  if (kind === 'found') return (meta.itemsFound || []).length;
  if (kind === 'best') return meta.best[name] || 0;
  if (kind === 'key') return meta.keys[name] || 0;
  if (kind === 'oath') return meta.oathCount[name] || 0;
  if (kind === 'mastery') { if (name === 'any') return Math.max(0, ...Object.keys(meta.mastery).map(d => masteryRank(meta.mastery[d]).rank)); return masteryRank(meta.mastery[name]).rank; }
  return 0;                                                       // 'manual' and unknown stats cannot be earned yet
}
export const questProgress = (meta, q) => Math.min(q.goal, statValue(meta, q.stat));
export const questDone = (meta, q) => meta.questsDone.includes(q.id);
// the quests closest to done (for the pinned tracker): not done, earnable, ordered by share complete
export function closestQuests(meta, n) {
  return QUESTS.filter(q => !questDone(meta, q) && q.stat !== 'manual').map(q => ({ q, frac: questProgress(meta, q) / q.goal })).sort((a, b) => b.frac - a.frac || a.q.goal - b.q.goal).slice(0, n);
}
function grant(meta, q) {
  const r = q.reward || {};
  if (r.card && !meta.unlockedCards.includes(r.card)) meta.unlockedCards.push(r.card);
  if (r.item && !meta.unlockedItems.includes(r.item)) meta.unlockedItems.push(r.item);
  if (r.boon) { const b = meta.unlockedBoons || (meta.unlockedBoons = []); if (!b.includes(r.boon)) b.push(r.boon); }
  if (r.pickup) { const b = meta.unlockedPickups || (meta.unlockedPickups = []); if (!b.includes(r.pickup)) b.push(r.pickup); }
  if (r.duelist && !meta.duelists.includes(r.duelist)) meta.duelists.push(r.duelist);
  if (r.outfit && !meta.outfits.includes(r.outfit)) meta.outfits.push(r.outfit);
  if (r.regalia && !meta.regalia.includes(r.regalia)) meta.regalia.push(r.regalia);
  if (r.board) { const b = meta.boards || (meta.boards = START_BOARDS.slice()); if (!b.includes(r.board)) b.push(r.board); }
}
export function evaluateQuests(meta) {
  const done = [];
  for (const q of QUESTS) { if (questDone(meta, q) || statValue(meta, q.stat) < q.goal) continue; meta.questsDone.push(q.id); grant(meta, q); done.push(q); }
  return done;
}
export function questFor(kind, id) { return QUESTS.find(q => q.reward && q.reward[kind] === id); }

// ---- mastery ----
export const masteryOf = (meta, duelist) => masteryRank(meta.mastery[duelist]);
export const outfitUnlocked = (meta, duelist, outfit) => meta.outfits.includes(outfit.id) || (outfit.killsNeeded && ((meta.mastery[duelist] || { kills: 0 }).kills >= outfit.killsNeeded)) || false;

// ---- difficulty unlocks: per map, Easy is open; Medium opens when that map is cleared on Easy, Hard when it is cleared on Medium. A clear is a won FULL run (mode 'run'); a Quick Duel win is a separate record and does not count. ----
export const DIFF_ORDER = ['easy', 'medium', 'hard'];
export const diffUnlocked = (meta, map, d) => d === 'easy' || ((meta.diffUnlock || {})[map] || []).includes(d);
export function unlockAfterClear(meta, map, d) {
  const next = DIFF_ORDER[DIFF_ORDER.indexOf(d) + 1]; if (!next) return null; const u = meta.diffUnlock || (meta.diffUnlock = {}), list = u[map] || (u[map] = []);
  if (list.includes(next)) return null; list.push(next); return next;
}
// older saves (before the unlock order) keep every difficulty they had played or cleared: anything with a score or a clear stays open, along with everything under it, and a clear opens the next one up
export function migrateDiffUnlock(meta) {
  if (meta.diffUnlock) return meta; meta.diffUnlock = {};
  for (const key of Object.keys(meta.maps || {})) { const parts = key.split(':'); if (parts[2] === 'quick') continue; const [map, d] = parts, rec = meta.maps[key], i = DIFF_ORDER.indexOf(d); if (i < 0) continue;
    const cleared = (rec.bestTime || 0) > 0 || (rec.cleared || []).length > 0, played = cleared || (rec.bestScore || 0) > 0; if (!played) continue;
    const top = cleared ? Math.min(2, i + 1) : i; for (let k = 1; k <= top; k++) { const u = meta.diffUnlock[map] || (meta.diffUnlock[map] = []); if (!u.includes(DIFF_ORDER[k])) u.push(DIFF_ORDER[k]); } }
  return meta;
}

// a save from before the unlock ladder (it has runs, items or quests done): keep every card, item, boon, duelist and stage it already had, and open the three stages. A fresh save starts small.
export function migrateLadder(meta) {
  if (meta.stagesOpen) return meta; const T = meta.totals || {}, old = (T.runs || 0) > 0 || (meta.unlockedItems || []).length > OLD_STARTER.items.length || (meta.questsDone || []).length > 0;
  meta.unlockedBoons = (old ? OLD_STARTER.boons.concat(STARTER.boons) : STARTER.boons).filter((b, i, a) => a.indexOf(b) === i); meta.unlockedPickups = STARTER.pickups.slice(); meta.itemsFound = (meta.itemsFound || []).slice(); meta.stagesOpen = old ? 3 : STARTER.stages;
  if (old) { for (const d of OLD_STARTER.duelists) if (!meta.duelists.includes(d)) meta.duelists.push(d); } else meta.duelists = STARTER.duelists.slice();
  for (const k of ['minutes', 'doorsFound', 'deaths', 'pickups', 'boons']) if (T[k] === undefined) T[k] = 0; meta.totals = T; return meta;
}

// ---- Oath seals: every Oath starts sealed; a feat in a normal run (sim/seals.js) breaks its seal for good. oathsOpen lists the unsealed ones. ----
export const oathOpen = (meta, id) => (meta.oathsOpen || []).includes(id);
// older saves had every Oath open: anyone who already KEPT an Oath (cleared a run with it sworn) keeps it; the rest start sealed
export function migrateSeals(meta) { if (meta.oathsOpen) return meta; meta.oathsOpen = Object.keys(meta.oathCount || {}).filter(id => meta.oathCount[id] > 0); return meta; }
export function unseal(meta, ids) { const open = meta.oathsOpen || (meta.oathsOpen = []), fresh = []; for (const id of ids || []) if (!open.includes(id)) { open.push(id); fresh.push(id); } return fresh; }

// ---- map records ----
export const mapKey = (map, difficulty, mode) => map + ':' + difficulty + (mode === 'quick' ? ':quick' : '');
export const mapRecord = (meta, map, difficulty, mode) => meta.maps[mapKey(map, difficulty, mode)] || { bestScore: 0, bestTime: 0, cleared: [] };

// results: the flat run report from the sim (src/sim/results.js). Returns the quests completed by this run.
export function applyRun(meta, r) {
  const d = defaultMeta(); for (const k of Object.keys(d)) if (meta[k] === undefined) meta[k] = d[k];           // saves from older builds gain the new fields
  r.newSummons = applySummonRun(meta, r);       // the summons this run unlocked, for the results screen
  const T = meta.totals, B = meta.best, mx = (k, v) => { if ((v || 0) > (B[k] || 0)) B[k] = v || 0; };
  const win = r.result === 'win' || (r.stagesCleared || 0) > 0 && r.result === 'win';
  if (r.big) {       // the big desert's own counters and the unlock ladder
    T.minutes = (T.minutes || 0) + Math.floor((r.timeSurvived || 0) / 60); T.doorsFound = (T.doorsFound || 0) + (r.doorsFound || 0); T.deaths = (T.deaths || 0) + (r.result === 'win' ? 0 : 1); T.pickups = (T.pickups || 0) + (r.pickups || 0); T.boons = (T.boons || 0) + (r.boons || 0);
    const found = meta.itemsFound || (meta.itemsFound = []); for (const id of r.items || []) if (!found.includes(id)) found.push(id);
    if (win && r.mode === 'run' && (r.stagesCleared || 0) >= (meta.stagesOpen || 1)) meta.stagesOpen = Math.min(3, (meta.stagesOpen || 1) + 1);
  }
  if (r.ride) { const R2 = r.ride; T.slams = (T.slams || 0) + (R2.slams || 0); T.grindSec = (T.grindSec || 0) + Math.floor(R2.grindSec || 0); T.sealSets = (T.sealSets || 0) + (R2.sealSets || 0); T.loops = (T.loops || 0) + (R2.loops || 0); mx('combo', R2.bestCombo); }       // the ride quests' counters
  T.kills += r.kills || 0; T.chests += r.chestsOpened || 0; T.vases += r.vasesBroken || 0; T.runs += 1; T.bossKills += r.bossKills || 0;
  T.stagesCleared = (T.stagesCleared || 0) + (r.stagesCleared || 0); T.fusions = (T.fusions || 0) + (r.fusions || 0); T.godFusions = (T.godFusions || 0) + (r.godFusions || 0); T.wardenKills = (T.wardenKills || 0) + (r.wardenKilled ? 1 : 0);
  mx('level', r.level); mx('timeSurvived', r.timeSurvived); mx('overtimeSeconds', r.overtimeSeconds); mx('trapsSet', r.trapsSet); mx('stagesCleared', r.stagesCleared);
  if ((r.bossKills || 0) > 0 && !(r.trapsSet > 0)) B.bareBossKill = 1;
  if (r.difficulty === 'hard') mx('hardStages', r.stagesCleared); if (r.difficulty === 'medium' && r.mode === 'run' && (r.stagesCleared || 0) >= 3) B.mediumFull = 1;
  for (const k of r.keys || []) meta.keys[k] = (meta.keys[k] || 0) + 1;
  for (const o of r.oathsKept || []) meta.oathCount[o] = (meta.oathCount[o] || 0) + 1;
  unseal(meta, r.oathsKept); r.newSeals = unseal(meta, r.sealsCracked);       // keeping an Oath also proves it; r.newSeals lists the seals this run broke, for the results screen
  if (r.duelist) { const m = meta.mastery[r.duelist] || (meta.mastery[r.duelist] = { runs: 0, kills: 0 }); m.runs += 1; m.kills += r.kills || 0; }
  if (r.map) {
    const rec = meta.maps[mapKey(r.map, r.difficulty, r.mode)] || (meta.maps[mapKey(r.map, r.difficulty, r.mode)] = { bestScore: 0, bestTime: 0, cleared: [] });
    if ((r.score || 0) > rec.bestScore) rec.bestScore = r.score;
    if (win) { if (!rec.bestTime || r.timeSurvived < rec.bestTime) rec.bestTime = r.timeSurvived; if (r.duelist && !rec.cleared.includes(r.duelist)) rec.cleared.push(r.duelist); if (r.mode === 'run') unlockAfterClear(meta, r.map, r.difficulty); }
  }
  return evaluateQuests(meta);
}
export { MAPS, DUELIST_INFO, MASTERY };
