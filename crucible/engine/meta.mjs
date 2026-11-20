// What a player keeps between runs of Lost Memories: Memories (a currency every run pays,
// win or lose), the Codex of melds found, unlocked Forgers, Heat levels and relics bought
// in the Memory Vault. Pure functions over a plain profile object. Unlocks add variety,
// never a stronger start.
import { RELICS as BASE, LAB } from './relics.mjs';
const RELICS = { ...BASE, ...LAB };
import { FORGERS } from './forgers.mjs';

export const MAX_HEAT = 5;
// Relics a new profile cannot be offered until bought in the Vault.
export const VAULT = [
  { id: 'tomb_bell', price: 20 }, { id: 'glass_idol', price: 20 }, { id: 'tinder_vow', price: 20 },
  { id: 'spare_wire', price: 20 }, { id: 'deep_pockets', price: 25 }, { id: 'second_wind', price: 25 },
  { id: 'living_furnace', price: 40 }, { id: 'unseen_hand', price: 40 }, { id: 'signature', price: 40 },
];
// Forgers are earned by feats, not bought.
export const FORGER_FEATS = {
  tarn: { text: 'Yours from the start.', test: () => true },
  scrapper: { text: 'Finish one run, win or lose.', test: p => p.runs >= 1 },
  veil: { text: 'Beat a floor guardian.', test: p => p.bossWins >= 1 },
  storm: { text: 'Reach the third floor.', test: p => p.bestFloor >= 2 },
};

// Build feats: counted across runs from run.feat, so a lost run still moves them. Each one
// follows ordinary good play for its build and unlocks one Gift into the offer pool.
export const FEATS = [
  { id: 'storm_hand', name: 'Storm Hand', build: 'Storm Chain', key: 'long4', goal: 12, gift: 'grounding_rod', text: 'Make 12 melds of four or more cards.', why: 'You keep building long melds, so the forge hands you a Storm payoff.' },
  { id: 'grave_tender', name: 'Grave Tender', build: 'Tomb Engine', key: 'gyWins', goal: 8, gift: 'grave_ward', text: 'Win 8 duels with eight or more of your monsters in the graveyard.', why: 'You win with a full graveyard, so the forge teaches you to spend it.' },
  { id: 'patient_trap', name: 'Patient Trap', build: 'Ambush', key: 'baits', goal: 12, gift: 'snare', text: 'Have rivals attack into your veiled monsters or Traps 12 times.', why: 'Rivals keep walking into what you set, so the forge makes it cost them.' },
];
export const FEAT_GIFTS = FEATS.map(f => f.gift);

export function newProfile() {
  return { v: 1, memories: 0, earned: 0, runs: 0, clears: 0, duelWins: 0, bossWins: 0, bestFloor: 0, heatCleared: -1, forgers: ['tarn'], bought: [], codex: [], seen: [], feats: {}, featsDone: [], fresh: [] };
}
export const lockedRelics = p => VAULT.map(v => v.id).filter(id => !p.bought.includes(id)).concat(FEATS.filter(f => !(p.featsDone || []).includes(f.id)).map(f => f.gift));
export const maxHeat = p => Math.min(MAX_HEAT, p.heatCleared + 1);

// What a finished run pays. Does not change the profile.
export function scoreRun(p, run) {
  const S = run.stats, lines = [];
  const add = (label, n) => { if (n > 0) lines.push([label, n]); };
  add('Duels won', S.wins);
  add('Guardians beaten', S.bossWins * 10);
  add('S ranks', (S.ranks.S || 0) * 3);
  const known = new Set(p.codex);
  const fresh = run.codex.filter(k => !known.has(k));
  add('New melds in the Codex', Math.min(20, fresh.length));
  const floor = run.result && run.result.won ? 3 : run.floor;
  add('Deeper than ever before', Math.max(0, floor - p.bestFloor) * 8);
  if (run.result && run.result.won) add('The pyramid cleared', 30);
  const base = lines.reduce((n, l) => n + l[1], 0);
  const heat = Math.round(base * 0.2 * (run.heat || 0));
  add('Heat ' + (run.heat || 0), heat);
  return { lines, total: base + heat, fresh, floor };
}

// Banks a finished run into the profile and returns what it paid and what it unlocked.
export function applyRun(p, run) {
  if (run.phase !== 'over') throw new Error('the run is not over');
  const r = scoreRun(p, run);
  p.memories += r.total; p.earned += r.total; p.runs++;
  p.duelWins += run.stats.wins; p.bossWins += run.stats.bossWins; p.bestFloor = Math.max(p.bestFloor, r.floor);
  for (const k of r.fresh) p.codex.push(k);
  const unlocks = [];
  if (run.result.won) { p.clears++; const h = run.heat || 0; if (h > p.heatCleared) { p.heatCleared = h; if (h < MAX_HEAT) unlocks.push({ kind: 'heat', id: h + 1, name: 'Heat ' + (h + 1), text: 'A harder descent that pays more Memories.' }); } }
  // feats: progress is banked win or lose
  const feats = [];
  p.feats = p.feats || {}; p.featsDone = p.featsDone || []; p.fresh = p.fresh || [];
  for (const f of FEATS) {
    if (p.featsDone.includes(f.id)) continue;
    const before = p.feats[f.id] || 0, gain = run.feat ? run.feat[f.key] || 0 : 0, after = Math.min(f.goal, before + gain);
    p.feats[f.id] = after;
    const done = after >= f.goal;
    feats.push({ id: f.id, name: f.name, build: f.build, text: f.text, before, after, gain: after - before, goal: f.goal, done });
    if (done) { p.featsDone.push(f.id); p.fresh.push(f.gift); unlocks.push({ kind: 'gift', id: f.gift, feat: f.name, name: RELICS[f.gift].name, text: RELICS[f.gift].text, why: f.why }); }
  }
  for (const id of Object.keys(FORGER_FEATS)) if (!p.forgers.includes(id) && FORGER_FEATS[id].test(p)) { p.forgers.push(id); unlocks.push({ kind: 'forger', id, name: FORGERS[id].name, text: FORGERS[id].tag + '. ' + FORGERS[id].powerText }); }
  return { ...r, unlocks, feats };
}

export function buy(p, id) {
  const item = VAULT.find(v => v.id === id);
  if (!item) throw new Error('not in the Vault');
  if (p.bought.includes(id)) throw new Error('already yours');
  if (p.memories < item.price) throw new Error('not enough Memories');
  p.memories -= item.price; p.bought.push(id);
  return { id, name: RELICS[id].name };
}
