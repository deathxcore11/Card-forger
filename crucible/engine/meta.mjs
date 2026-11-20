// What a player keeps between runs of Lost Memories: Memories (a currency every run pays,
// win or lose), the Codex of melds found, unlocked Forgers, Heat levels and relics bought
// in the Memory Vault. Pure functions over a plain profile object. Unlocks add variety,
// never a stronger start.
import { RELICS as BASE, LAB } from './relics.mjs';
const RELICS = { ...BASE, ...LAB };
import { FORGERS } from './forgers.mjs';

export const MAX_HEAT = 10;
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
  { id: 'master_smith', name: 'Master Smith', build: 'Living Furnace', key: 'bigWins', goal: 8, gift: 'cinder_fall', text: 'Win 8 duels with a monster of 3,000 ATK or more on your side.', why: 'You win behind one great monster, so the forge makes its heat burn the rival.' },
];
export const FEAT_GIFTS = FEATS.map(f => f.gift);

// ---------- the long road (optional; every function below takes long = true to use it) ----------
// More to earn once the first Vault is empty, all of it variety and none of it a stronger start: each Forger opens
// its second and third kit by winning duels, climbs Heat on its own ladder, six of the twelve Enchants are bought
// in the Vault, and three more feats each unlock one more Gift.
export const KIT_GOALS = [0, 10, 30];          // duels won as that Forger before its first, second and third kit are open
export const START_ENCHANTS = ['piercing', 'twin', 'drain', 'bulwark', 'venom', 'soaring'];
export const VAULT_ENCHANTS = ['herald', 'catalyst', 'ambusher', 'warden', 'kindred', 'echo'].map(id => ({ id, key: 'ench:' + id, price: 50 }));
export const FEATS_LONG = [
  { id: 'stone_wall', name: 'Stone Wall', build: 'Ambush', key: 'walls', goal: 8, gift: 'shield_oath', text: 'Have your defending monsters beat 8 attackers.', why: 'Your defenders keep holding, so the forge lets one of them stand guard.' },
  { id: 'kept_secret', name: 'Kept Secret', build: 'Ambush', key: 'veilWins', goal: 15, gift: 'cracked_mask', text: 'Win 15 duels with a veiled monster still on your side.', why: 'You win with something still hidden, so the forge lets you choose when to show it.' },
  { id: 'last_light', name: 'Last Light', build: 'Ambush', key: 'comebacks', goal: 10, gift: 'cold_lantern', text: 'Win 10 duels in which you were behind on Life Points.', why: 'You win from behind, so the forge makes what survives bite back.' },
];
export const LONG_GIFTS = FEATS_LONG.map(f => f.gift);
export const featList = long => long ? FEATS.concat(FEATS_LONG) : FEATS;
const forgerRow = (p, f) => (p.byForger || {})[f] || { runs: 0, wins: 0, clears: 0, heat: -1 };
export const forgerStats = forgerRow;
export const openKits = (p, forger) => FORGERS[forger].kits.filter((k, i) => forgerRow(p, forger).wins >= KIT_GOALS[i]).map(k => k.id);
export const nextKit = (p, forger) => { const n = openKits(p, forger).length, k = FORGERS[forger].kits[n]; return k ? { id: k.id, name: k.name, goal: KIT_GOALS[n], wins: forgerRow(p, forger).wins } : null; };
export const openEnchants = p => START_ENCHANTS.concat(VAULT_ENCHANTS.filter(v => p.bought.includes(v.key)).map(v => v.id));
// What a new run needs from the profile: pass the result straight into newRun.
export const runOptions = (p, forger, long) => long
  ? { locked: lockedRelics(p, true), featured: p.fresh || [], track: true, kits: openKits(p, forger), enchants: openEnchants(p) }
  : { locked: lockedRelics(p), featured: p.fresh || [], track: true };

export function newProfile() {
  return { v: 1, memories: 0, earned: 0, runs: 0, clears: 0, duelWins: 0, bossWins: 0, bestFloor: 0, heatCleared: -1, forgers: ['tarn'], bought: [], codex: [], seen: [], feats: {}, featsDone: [], fresh: [] };
}
export const lockedRelics = (p, long) => VAULT.map(v => v.id).filter(id => !p.bought.includes(id)).concat(featList(long).filter(f => !(p.featsDone || []).includes(f.id)).map(f => f.gift));
// The highest Heat a run may start at. On the long road each Forger climbs its own ladder.
export const maxHeat = (p, forger, long) => Math.min(MAX_HEAT, (long && forger ? forgerRow(p, forger).heat : p.heatCleared) + 1);

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
export function applyRun(p, run, { long = false } = {}) {
  if (run.phase !== 'over') throw new Error('the run is not over');
  const r = scoreRun(p, run);
  const kitsBefore = run.forger ? openKits(p, run.forger).length : 0;
  p.memories += r.total; p.earned += r.total; p.runs++;
  p.duelWins += run.stats.wins; p.bossWins += run.stats.bossWins; p.bestFloor = Math.max(p.bestFloor, r.floor);
  for (const k of r.fresh) p.codex.push(k);
  const unlocks = [];
  // per-Forger record: kept whether or not the long road is on, so turning it on later counts earlier play
  let fr = null;
  if (run.forger) { p.byForger = p.byForger || {}; fr = p.byForger[run.forger] = { ...forgerRow(p, run.forger) }; fr.runs++; fr.wins += run.stats.wins; }
  if (run.result.won) {
    p.clears++; const h = run.heat || 0;
    const mine = fr && h > fr.heat; if (fr) { fr.clears++; if (mine) fr.heat = h; }
    if (h > p.heatCleared) { p.heatCleared = h; if (!long && h < MAX_HEAT) unlocks.push({ kind: 'heat', id: h + 1, name: 'Heat ' + (h + 1), text: 'A harder descent that pays more Memories.' }); }
    if (long && mine && h < MAX_HEAT) unlocks.push({ kind: 'heat', id: h + 1, forger: run.forger, name: 'Heat ' + (h + 1) + ' for ' + FORGERS[run.forger].name, text: 'A harder descent that pays more Memories.' });
  }
  if (long && run.forger) FORGERS[run.forger].kits.forEach((k, i) => { if (i >= kitsBefore && fr.wins >= KIT_GOALS[i]) unlocks.push({ kind: 'kit', id: k.id, forger: run.forger, name: k.name, text: 'A new starter kit for ' + FORGERS[run.forger].name + '.' }); });
  // feats: progress is banked win or lose
  const feats = [];
  p.feats = p.feats || {}; p.featsDone = p.featsDone || []; p.fresh = p.fresh || [];
  for (const f of featList(long)) {
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
  const item = VAULT.find(v => v.id === id) || VAULT_ENCHANTS.find(v => v.key === id);
  if (!item) throw new Error('not in the Vault');
  if (p.bought.includes(id)) throw new Error('already yours');
  if (p.memories < item.price) throw new Error('not enough Memories');
  p.memories -= item.price; p.bought.push(id);
  return { id, name: item.key ? item.id[0].toUpperCase() + item.id.slice(1) : RELICS[id].name };
}
