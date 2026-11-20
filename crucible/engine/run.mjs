// Lost Memories run layer (codename crucible): the descent through three floors of six
// chambers. A deterministic state machine over a serialisable RunState:
//   runApply(run, action, db) -> events[]   (mutates run; use runStep for the pure form)
// The duel inside a run lives in run.duel and is advanced through { t:'duel', action }.
import { Rng } from './rng.mjs';
import { roleOf, weightOf, meldPair } from './cards.mjs';
import { newDuel, applyMut, viewFor, clone } from './duel.mjs';
import { chooseAction } from './ai.mjs';
import { RELICS as BASE_RELICS, LAB, MASTERWORKS, sortRelics } from './relics.mjs';
const RELICS = { ...BASE_RELICS, ...LAB };
import { FORGERS } from './forgers.mjs';

export const ENCHANTS = ['piercing', 'twin', 'drain', 'bulwark', 'venom', 'soaring', 'herald', 'catalyst', 'ambusher', 'warden', 'kindred', 'echo'];

// Rival families. Names are ours; the cards inside come from the pool by Type.
export const THEMES = [
  { id: 'drake', name: 'the Drake Tamer', types: ['Dragon', 'Winged Beast'] },
  { id: 'school', name: 'the Lantern Scholar', types: ['Spellcaster', 'Fairy'] },
  { id: 'engine', name: 'the Gearwright', types: ['Machine', 'Rock'] },
  { id: 'grave', name: 'the Crypt Keeper', types: ['Fiend', 'Zombie'] },
  { id: 'wild', name: 'the Beastcaller', types: ['Beast', 'Beast-Warrior', 'Insect', 'Plant'] },
  { id: 'tide', name: 'the Tidewatcher', types: ['Aqua', 'Fish', 'Sea Serpent'] },
  { id: 'ember', name: 'the Cinder Monk', types: ['Pyro', 'Thunder', 'Dinosaur', 'Reptile'] },
  { id: 'blade', name: 'the Oathblade', types: ['Warrior'] },
];
export const KITS = [
  { id: 'dragons_warriors', name: 'Dragons and Warriors', types: ['Dragon', 'Warrior'] },
  { id: 'spellcasters_fiends', name: 'Spellcasters and Fiends', types: ['Spellcaster', 'Fiend'] },
  { id: 'beasts_plants', name: 'Beasts and Plants', types: ['Beast', 'Plant', 'Beast-Warrior', 'Insect'] },
];
export const BOSSES = [
  [{ id: 'kiln_warden', name: 'The Kiln Warden', ace: 'Flame Swordsman', law: 'scorched', types: ['Pyro', 'Warrior'], lawText: 'Scorched ground: the duel starts on Molten Destruction. A Field Spell you play holds for two of your turns, then his ground returns.' },
   { id: 'stone_sentinel', name: 'The Stone Sentinel', ace: 'Giant Soldier of Stone', law: 'stonewall', types: ['Rock'], lawText: 'Stonewall: her monsters win tied battles.' }],
  [{ id: 'bone_collector', name: 'The Bone Collector', ace: 'Summoned Skull', law: 'bloodprice', types: ['Fiend', 'Zombie'], lawText: 'Blood price: he gains 500 Life Points whenever his monster destroys yours in battle.' },
   { id: 'veiled_magus', name: 'The Veiled Magus', ace: 'Dark Magician', law: 'mist', types: ['Spellcaster'], lawText: 'Mist: all his monsters arrive veiled.' }],
  [{ id: 'white_tyrant', name: 'The White Tyrant', ace: 'Blue-Eyes White Dragon', law: 'tyranny', types: ['Dragon'], lawText: 'Tyranny: your hand refills to four.' },
   { id: 'last_gate', name: 'The Last Gate', ace: 'Gate Guardian', law: 'end', types: ['Warrior', 'Fiend'], lawText: 'The end: on his fourth turn his ace arrives at 5000 ATK. Win first, or hold an answer.' }],
];
// ATK bands for rival monsters: [min, max] by floor (0..2) and tier.
const BANDS = {
  regular: [[500, 1400], [1000, 1900], [1400, 2400]],
  cursed: [[600, 1500], [1100, 2000], [1500, 2500]],
  champion: [[900, 1700], [1300, 2200], [1700, 2700]],
  guardian: [[1000, 1800], [1400, 2300], [1800, 2800]],
  boss: [[1000, 1800], [1500, 2400], [1900, 3000]],
};
const AI_LEVEL = { regular: [0, 1, 2], cursed: [1, 1, 2], champion: [1, 2, 2], guardian: [1, 2, 2], boss: [1, 2, 2] };
const SPELL_VALUE = { destroy: 1500, destroyAll: 2200, bounce: 900, draw: 500, flip: 200, freeze: 900, position: 500, revive: 1400 };

export function cardValue(db, e) {
  const id = typeof e === 'number' ? e : e.id;
  const c = db.byId.get(id);
  switch (roleOf(db, id)) {
    case 'monster': return c.atk + c.def * 0.25 + (e.t ? 300 : 0) + (e.e ? 250 : 0) + (e.b ? 200 : 0);
    case 'field': return 480;
    case 'equip': return 450;
    case 'spell': case 'trap': { const t = db.tagOf.get(id); if (SPELL_VALUE[t.fx]) return SPELL_VALUE[t.fx]; if (t.fx === 'burn') return t.n < 0 ? 1300 : t.n; if (t.fx === 'heal') return t.n < 0 ? 500 : t.n * 0.4; return t.n + 300; }
    default: return 150;
  }
}
export function entryWeight(db, e) {
  const w = weightOf(db, e.id);
  return e.b && e.halves ? Math.min(w, weightOf(db, e.halves[0]) + weightOf(db, e.halves[1])) : w;
}
export const deckWeight = (db, deck) => deck.reduce((n, e) => n + entryWeight(db, e), 0);

function poolLists(db) {
  if (db._lists) return db._lists;
  const L = { monsters: [], field: [], equip: [], spell: [], trap: [], fuel: [] };
  for (const c of db.pool.cards) {
    if (c.kind === 'fusion') continue;
    const r = roleOf(db, c.id);
    if (r === 'monster') L.monsters.push(c); else L[r].push(c);
  }
  return (db._lists = L);
}

// A starter kit: 40 weak cards inside fixed quotas, checked against the kit weight limit.
export function makeKit(db, rng, kit) {
  const cfg = db.config, q = cfg.kit, L = poolLists(db);
  const themed = L.monsters.filter(c => kit.types.includes(c.type) && c.level <= q.maxLevel && c.atk <= q.maxAtk);
  const anyWeak = L.monsters.filter(c => c.level <= q.maxLevel && c.atk <= q.maxAtk);
  const fields = L.field.filter(c => { const f = db.fieldOf.get(c.id); return f.types && kit.types.some(t => f.types.has(t)); });
  for (let tries = 0; tries < 200; tries++) {
    const deck = [], count = new Map();
    const add = c => { const n = count.get(c.id) || 0; if (n >= cfg.maxCopies) return false; count.set(c.id, n + 1); deck.push({ id: c.id }); return true; };
    let guard = 0;
    while (deck.length < q.monsters && guard++ < 2000) add(rng.chance(3, 4) ? rng.pick(themed) : rng.pick(anyWeak));
    const f = fields.length ? fields : L.field;
    guard = 0; while (deck.length < q.monsters + q.field && guard++ < 500) add(rng.pick(f));
    guard = 0; while (deck.length < q.monsters + q.field + q.equip && guard++ < 500) add(rng.pick(L.equip));
    const tagged = L.spell.concat(L.trap).filter(c => { const t = db.tagOf.get(c.id); return t.fx !== 'destroyAll' && t.fx !== 'revive'; });
    guard = 0; while (deck.length < q.monsters + q.field + q.equip + q.tagged && guard++ < 500) add(rng.pick(tagged));
    guard = 0; while (deck.length < 40 && guard++ < 500) add(rng.pick(L.fuel));
    if (deck.length === 40 && deckWeight(db, deck) <= cfg.kitWeight) return { deck, rejected: tries, homeField: deck.find(e => roleOf(db, e.id) === 'field')?.id || null };
  }
  // Heavy themes (few low-Level monsters) can miss the limit 200 times. Build once more and
  // swap the heaviest monsters for the lightest weak ones until it fits.
  const deck = [], count = new Map();
  const add = c => { const n = count.get(c.id) || 0; if (n >= cfg.maxCopies) return false; count.set(c.id, n + 1); deck.push({ id: c.id }); return true; };
  let guard = 0;
  while (deck.length < q.monsters && guard++ < 2000) add(rng.chance(3, 4) ? rng.pick(themed) : rng.pick(anyWeak));
  const f = fields.length ? fields : L.field;
  guard = 0; while (deck.length < q.monsters + q.field && guard++ < 500) add(rng.pick(f));
  guard = 0; while (deck.length < q.monsters + q.field + q.equip && guard++ < 500) add(rng.pick(L.equip));
  const tagged = L.spell.concat(L.trap).filter(c => { const t = db.tagOf.get(c.id); return t.fx !== 'destroyAll' && t.fx !== 'revive'; });
  guard = 0; while (deck.length < q.monsters + q.field + q.equip + q.tagged && guard++ < 500) add(rng.pick(tagged));
  guard = 0; while (deck.length < 40 && guard++ < 500) add(rng.pick(L.fuel));
  const light = anyWeak.filter(c => c.level <= 2);
  guard = 0;
  while (deckWeight(db, deck) > cfg.kitWeight && guard++ < 400) {
    let hi = -1; deck.forEach((e, i) => { if (db.isMonster(e.id) && (hi < 0 || db.byId.get(e.id).level > db.byId.get(deck[hi].id).level)) hi = i; });
    const c = rng.pick(light); if ((count.get(c.id) || 0) >= cfg.maxCopies) continue;
    count.set(deck[hi].id, count.get(deck[hi].id) - 1); count.set(c.id, (count.get(c.id) || 0) + 1); deck[hi] = { id: c.id };
  }
  if (deck.length !== 40 || deckWeight(db, deck) > cfg.kitWeight) throw new Error('kit generator could not fit the weight limit');
  return { deck, rejected: 200, homeField: deck.find(e => roleOf(db, e.id) === 'field')?.id || null };
}

export function makeRival(db, rng, { floor, tier, theme, boss = null, heat = 0 }) {
  const L = poolLists(db);
  const band = BANDS[tier][floor].slice();
  band[0] += heat * 40; band[1] += heat * 60;
  if (boss && db.config.bossBand) { const bb = db.config.bossBand[floor] || 0; band[0] = Math.max(300, band[0] + Math.round(bb / 2)); band[1] = Math.max(band[0] + 200, band[1] + bb); }
  if (db.config.rivalBand) { const rb = Array.isArray(db.config.rivalBand) ? db.config.rivalBand[floor] || 0 : db.config.rivalBand; band[0] = Math.max(300, band[0] + Math.round(rb / 2)); band[1] = Math.max(band[0] + 200, band[1] + rb); }
  const types = boss ? boss.types : theme.types;
  let mons = L.monsters.filter(c => types.includes(c.type) && c.atk >= band[0] && c.atk <= band[1]);
  if (mons.length < 8) mons = mons.concat(L.monsters.filter(c => c.atk >= band[0] && c.atk <= band[1]));
  const deck = [], count = new Map();
  const add = c => { const n = count.get(c.id) || 0; if (n >= 3) return false; count.set(c.id, n + 1); deck.push({ id: c.id }); return true; };
  let ace = null;
  if (boss) { ace = db.byName.get(boss.ace); for (let k = 0; k < (db.config.bossAces || 3); k++) add(ace); }
  const extra = db.config.rivalExtraTagged || 0;
  const nMon = (boss ? 30 : 29) - extra;
  let guard = 0; while (deck.length < nMon && guard++ < 3000) add(rng.pick(mons));
  const fields = L.field.filter(c => { const f = db.fieldOf.get(c.id); return f.types && types.some(t => f.types.has(t)); });
  guard = 0; while (deck.length < nMon + 2 && guard++ < 200) add(rng.pick(fields.length ? fields : L.field));
  guard = 0; while (deck.length < nMon + 5 && guard++ < 200) add(rng.pick(L.equip));
  const strong = tier === 'regular' ? floor >= 1 : true;
  const tagged = L.spell.concat(L.trap).filter(c => { const t = db.tagOf.get(c.id); if (t.fx === 'destroyAll') return floor >= 2 || tier === 'boss'; if (t.fx === 'destroy' || t.fx === 'revive') return strong; return true; });
  guard = 0; while (deck.length < 40 && guard++ < 500) add(rng.pick(tagged));
  while (deck.length < 40) deck.push({ id: rng.pick(L.fuel).id });
  // drop lists
  const hi = L.monsters.filter(c => types.includes(c.type) && c.atk > band[1] - 300 && c.atk <= band[1] + 350).map(c => c.id);
  const fury = hi.concat(deck.filter(e => roleOf(db, e.id) === 'equip').map(e => e.id));
  const craft = deck.filter(e => ['spell', 'trap', 'field'].includes(roleOf(db, e.id))).map(e => e.id)
    .concat(tagged.slice(0, 0).map(c => c.id));
  for (let k = 0; k < 4; k++) craft.push(rng.pick(tagged).id);
  for (const f of db.pool.cards) if (f.kind === 'fusion' && f.materials && f.atk <= band[1] + 600) for (const m of f.materials) if (types.includes(db.byId.get(m).type)) craft.push(m);
  const common = deck.filter(e => db.isMonster(e.id)).map(e => e.id);
  return {
    name: boss ? boss.name : theme.name, tier, floor, deck, ai: Math.min(2, AI_LEVEL[tier][floor] + (heat >= 4 ? 1 : 0)),
    law: boss ? boss.law : null, lawText: boss ? boss.lawText : null, ace: ace ? ace.id : null,
    drops: { common, fury: fury.length ? fury : common, craft: craft.length ? craft : common }, bossId: boss ? boss.id : null,
  };
}

// ---------- rank ----------
export const rankLetter = (cfg, points) => points >= cfg.S ? 'S' : points >= cfg.A ? 'A' : points >= cfg.B ? 'B' : points >= cfg.C ? 'C' : 'D';
export function rankDuel(db, duel, seat = 0) {
  const st = duel.stats[seat], cfg = db.config.rank, lines = [];
  let fury = 0, craft = 0, either = 0;
  const t = st.turns;
  const speed = t <= 3 ? 20 : t <= 5 ? 10 : t <= 8 ? 0 : -5; fury += speed; lines.push(['Speed', speed]);
  const hits = Math.min(12, st.bigHits * 3); fury += hits; lines.push(['Big hits', hits]);
  const lp = duel.lp[seat] >= 7500 ? 10 : duel.lp[seat] >= 4000 ? 0 : -10; either += lp; lines.push(['Life Points', lp]);
  const melds = Math.min(12, st.melds * 3); craft += melds; lines.push(['Melds', melds]);
  const sp = Math.min(12, st.spells * 3); craft += sp; lines.push(['Spells and Traps', sp]);
  const dw = Math.min(9, st.defWins * 3); craft += dw; lines.push(['Defenders held', dw]);
  const fz = -3 * st.fizzles; either += fz; lines.push(['Fizzles', fz]);
  const low = duel.deck[seat].length <= 5 ? -10 : 0; either += low; lines.push(['Deck nearly empty', low]);
  const points = cfg.start + fury + craft + either;
  return { points, rank: rankLetter(cfg, points), style: craft > fury ? 'craft' : 'fury', lines };
}

const BOUNTIES = [
  { id: 'four_melds', text: 'Win with four melds', test: st => st.melds >= 4 },
  { id: 'untouched', text: 'Win with 7000 Life Points or more', test: (st, d) => d.lp[0] >= 7000 },
  { id: 'fast', text: 'Win in four of your turns or fewer', test: st => st.turns <= 4 },
  { id: 'long_chain', text: 'Win after a meld of four or more cards', test: st => st.longestChain >= 4 },
  { id: 'ambush', text: 'Win after springing a Trap', test: st => st.trapsSprung >= 1 },
  { id: 'wall', text: 'Win after a defender of yours beats an attacker', test: st => st.defWins >= 1 },
  { id: 'no_loss', text: 'Win without losing a monster in battle', test: (st, d) => d.stats[1].destroyed === 0 },
];

// ---------- run state ----------
// forger: a key of FORGERS (optional). locked: relic ids this profile has not unlocked yet (optional).
export function newRun(db, { seed, heat = 0, forger = null, locked = null } = {}) {
  DB = db;
  const cfg = db.config, rng = Rng.fromSeed(seed);
  const run = {
    v: 1, seed: String(seed), rng: null, heat, phase: 'kit', floor: 0, chamber: 0, seals: 0,
    sparks: cfg.sparks, embers: cfg.embers.start, xp: 0, level: 0, giftsQueued: 0,
    deck: [], trunk: [], charms: [], gifts: [], masterworks: [], binds: 0, capBonus: 0,
    kit: null, homeField: null, redeal: 1, doors: null, offer: null, duel: null, rival: null, door: null,
    bossOrder: BOSSES.map(pair => rng.int(pair.length)), secondWindUsed: false,
    codex: [], log: [], result: null,
    stats: { duels: 0, wins: 0, losses: 0, bossWins: 0, ranks: {}, turns: 0, melds: 0, fizzles: 0, capHits: 0, relicFires: {}, familiesInDuel: 0, doors: {}, bounties: 0, deckouts: 0, firstWins: 0, firstGames: 0, kitRejects: 0, byTier: {}, comebacks: 0, closeWins: 0, leadChanges: 0, trailedWins: 0, traps: 0, defWins: 0, lpLostInWins: 0, chains: {}, singles: 0, long: 0, reasons: {} },
  };
  if (forger) { if (!FORGERS[forger]) throw new Error('no such Forger'); run.forger = forger; }
  if (locked && locked.length) run.locked = locked.slice();
  run.offer = dealKits(db, rng, run);
  run.rng = rng.s;
  return run;
}
function dealKits(db, rng, run) {
  return (run.forger ? FORGERS[run.forger].kits : KITS).map(k => { const d = makeKit(db, rng, k); run.stats.kitRejects += d.rejected; return { kit: k.id, name: k.name, deck: d.deck, homeField: d.homeField }; });
}

export const weightCap = (db, run) => db.config.weightCaps[0] + run.capBonus + (run.charms.includes('heavy_pack') ? 10 : 0) - (run.charms.includes('heavy_crown') ? 10 : 0);
export const relicList = run => sortRelics([...run.charms, ...run.gifts, ...run.masterworks]);

let DB = null; // set on entry to runApply and newRun; never stored in the run
function ownedRelics(run) { return new Set([...run.charms, ...run.gifts, ...run.masterworks]); }
function relicOffer(run, rng, kind, n) {
  const own = ownedRelics(run);
  // parts already fused into a Masterwork do not come back
  for (const m of run.masterworks) for (const p of RELICS[m].parts) own.add(p);
  for (const id of run.locked || []) own.add(id);
  // Heavy Crown lowers the cap by 10, so it is only offered to a deck that already fits under it.
  const crownOk = DB ? deckWeight(DB, run.deck) <= weightCap(DB, run) - 10 : true;
  const lab = DB && DB.config.labPool || [];
  const ids = Object.keys(RELICS).filter(id => (!LAB[id] || lab.includes(id)) && RELICS[id].kind === kind && !own.has(id) && !(id === 'second_wind' && run.secondWindUsed) && !(id === 'heavy_crown' && !crownOk));
  rng.shuffle(ids);
  return ids.slice(0, n);
}

function genDoors(db, run, rng) {
  const cfg = db.config, ch = run.chamber, fl = run.floor;
  const needSeals = Math.max(0, 2 - run.seals);
  if (ch === cfg.chambers - 1 && !needSeals) return [bossDoor(run)];
  const left = cfg.chambers - 1 - ch; // chambers before the boss, including this one
  const mkDuel = tier => ({ type: tier === 'regular' ? 'duel' : tier, tier, theme: rng.int(THEMES.length), twist: tier === 'cursed' ? rng.pick(['fog', 'narrow', 'storm', 'locked']) : null, know: 'known' });
  const doors = [];
  if (needSeals >= left || ch === cfg.chambers - 1) { // a seal short with no room left: all duels, and the boss chamber waits
    for (let i = 0; i < 3; i++) doors.push(mkDuel(i === 0 ? 'regular' : rng.pick(['regular', 'cursed'])));
  } else {
    doors.push(mkDuel(rng.chance(1, 4) ? 'cursed' : 'regular'));
    const pool = ch === cfg.chambers - 2
      ? ['anvil', 'sanctum', 'champion', 'bazaar']
      : ['duel', 'cursed', 'champion', 'guardian', 'anvil', 'anvil', 'bazaar', 'bazaar', 'sanctum', 'omen', 'omen', 'treasure', 'mystery'];
    const used = new Set();
    while (doors.length < 3) {
      const t = rng.pick(pool);
      if (used.has(t) && !['duel', 'cursed'].includes(t)) continue;
      if (t === 'treasure' && !rng.chance(1, 3)) continue;
      if (t === 'guardian' && ch < 2) continue;
      used.add(t);
      if (['duel', 'cursed', 'champion', 'guardian'].includes(t)) doors.push(mkDuel(t === 'duel' ? 'regular' : t));
      else doors.push({ type: t, know: t === 'mystery' ? 'mystery' : rng.chance(1, 4) ? 'partial' : 'known', merchant: t === 'bazaar' ? rng.pick(['cards', 'charms', 'scrapper', 'shadow']) : null });
    }
    rng.shuffle(doors);
  }
  for (const d of doors) describe(db, run, d);
  return doors;
}
function bossDoor(run) {
  const b = BOSSES[run.floor][run.bossOrder[run.floor]];
  return { type: 'boss', tier: 'boss', know: 'known', boss: b.id, name: b.name, cost: 'A Spark if you lose. You face it again.', reward: 'Guardian Reward, +20 weight cap, the way down.', law: b.lawText, needsSeals: 2 };
}
function describe(db, run, d) {
  const TW = { fog: 'Fog: every monster arrives veiled.', narrow: 'Narrow Pass: three monster zones a side.', storm: 'Storm Front: the terrain changes every third turn.', locked: 'Locked terrain: the terrain cannot be replaced.' };
  switch (d.type) {
    case 'duel': d.name = 'Duel: ' + THEMES[d.theme].name; d.cost = 'A Spark if you lose.'; d.reward = 'Pick 1 of 3 cards, Embers, breaks a seal.'; break;
    case 'cursed': d.name = 'Cursed duel: ' + THEMES[d.theme].name; d.cost = 'A Spark if you lose. ' + TW[d.twist]; d.reward = 'Pick 1 of 3 cards, extra Embers, breaks a seal.'; break;
    case 'champion': d.name = 'Champion: ' + THEMES[d.theme].name; d.cost = 'A Spark if you lose. A much harder fight.'; d.reward = 'Cards, a charm, breaks a seal.'; break;
    case 'guardian': d.name = 'Guardian: ' + THEMES[d.theme].name; d.cost = 'A Spark if you lose. The hardest duel short of the boss.'; d.reward = 'A stronger card, breaks a seal.'; break;
    case 'anvil': d.name = 'Anvil'; d.cost = 'Embers.'; d.reward = 'Temper, enchant, bind or forge a Masterwork.'; break;
    case 'bazaar': d.name = 'Bazaar'; d.cost = 'Embers.'; d.reward = { cards: 'Cards for sale.', charms: 'Charms for sale.', scrapper: 'The Scrapper removes cards.', shadow: 'One known item and one sealed item at half price.' }[d.merchant]; break;
    case 'sanctum': d.name = 'Sanctum'; d.cost = 'Nothing.'; d.reward = 'Take back one Spark, or raise your weight cap by 5.'; break;
    case 'omen': d.name = 'Omen'; d.cost = 'A stated trade. You can always leave.'; d.reward = 'One stronger card for two trunk cards.'; break;
    case 'treasure': d.name = 'Treasure'; d.cost = 'Nothing.'; d.reward = 'A free pick of one from three.'; break;
    case 'mystery': d.name = 'Mysterious door'; d.cost = 'May cost up to 15 Embers. No Spark can be lost here.'; d.reward = 'Embers, a card, or nothing.'; break;
  }
  if (d.know === 'partial') d.hidden = 'One detail is hidden.';
  // Tags are worked out from the real deck, never guessed.
  d.tags = [];
  if (d.tier && d.theme != null) {
    const fam = THEMES[d.theme];
    const have = run.deck.filter(e => db.isMonster(e.id) && fam.types.includes(db.byId.get(e.id).type)).length;
    if (have >= 8) d.tags.push('Fits your ' + fam.types[0] + ' deck');
  }
  if (d.type === 'anvil') { const [a] = possibleMasterworks(run); if (a) d.tags.push('Masterwork ready: ' + RELICS[a].name); }
}

export function possibleMasterworks(run) {
  if (run.masterworks.length >= 2) return [];
  const own = ownedRelics(run);
  return MASTERWORKS.filter(m => m.parts.every(p => own.has(p)) && !(run.locked || []).includes(m.id)).map(m => m.id);
}

function startDuel(db, run, rng, door, onStep) {
  const boss = door.type === 'boss' ? BOSSES[run.floor][run.bossOrder[run.floor]] : null;
  const rival = makeRival(db, rng, { floor: run.floor, tier: door.tier, theme: door.theme != null ? THEMES[door.theme] : null, boss, heat: run.heat });
  const cap = weightCap(db, run);
  const relics = relicList(run);
  if (run.forger) relics.unshift(FORGERS[run.forger].rule);
  if (db.config.testRelics) for (const id of db.config.testRelics) if (!relics.includes(id)) relics.push(id);
  const bounty = rng.pick(BOUNTIES);
  const seats = [
    { relics, handSize: (relics.includes('deep_pockets') ? 6 : db.config.hand) - (rival.law === 'tyranny' ? 1 : 0), firstTurnHand: run.sparks === 1 ? 6 : 0, homeField: run.homeField, underCap: cap - deckWeight(db, run.deck), secondWind: relics.includes('second_wind') && !run.secondWindUsed, sparks: run.sparks, forger: run.forger || null },
    { law: rival.law, ace: rival.ace, relics: door.tier === 'champion' ? ['whetstone'] : [], ...(db.config.freeCastRival === 'none' || (db.config.freeCastRival === 'elite' && door.tier === 'regular') || (db.config.freeCastRival === 'boss' && door.tier !== 'boss') ? { noFree: 1 } : {}) },
  ];
  run.rival = { name: rival.name, tier: rival.tier, ai: rival.ai, law: rival.law, lawText: rival.lawText, drops: rival.drops, ace: rival.ace, bounty: bounty.id, bountyText: bounty.text, twist: door.twist || null };
  run.duel = newDuel(db, { seed: rng.u32(), decks: [run.deck, rival.deck], seats, twist: door.twist || null });
  run.phase = 'duel';
  if (onStep) onStep([{ e: 'duelStart' }]);
  advanceRival(db, run, onStep);
}

// Play the rival's moves until it is the player's turn to decide something.
function advanceRival(db, run, onStep) {
  const d = run.duel; let guard = 0;
  while (d.winner === null && guard++ < 400) {
    const rivalToAct = d.pending ? d.active === 0 : d.active === 1;
    if (!rivalToAct) break;
    const a = chooseAction(db, viewFor(d, db, 1), run.rival.ai, { maxChain: 3 });
    try { const evs = applyMut(d, a || { t: 'end' }, db); if (onStep) onStep(evs); } catch (e) { e.message += ' | rival action ' + JSON.stringify(a) + ' hand ' + JSON.stringify(d.hand[1].map(c => db.byId.get(c.id).name)) + ' twist ' + d.twist + ' law ' + d.seat[1].law; throw e; }
  }
}

function addCard(db, run, entry) { run.trunk.push(entry); }

function pickThree(db, rng, list, n, wantRare) {
  const ids = [...new Set(list)]; rng.shuffle(ids);
  const out = ids.slice(0, n);
  if (wantRare && ids.length > n) { const best = ids.slice().sort((a, b) => cardValue(db, b) - cardValue(db, a))[0]; if (!out.includes(best)) out[0] = best; }
  return out.map(id => ({ id }));
}

function finishDuel(db, run, rng, ev) {
  const d = run.duel, cfg = db.config, st = d.stats[0], S = run.stats;
  const won = d.winner === 0;
  S.duels++; S.turns += d.turn; S.melds += st.melds; S.fizzles += st.fizzles; S.capHits += st.capHits ? 1 : 0;
  S.firstGames++; if (d.winner === d.first) S.firstWins++;
  if (d.reason === 'deckout') S.deckouts++;
  if (cfg.trackFx && run.rival.tier === 'boss') { const b = S.byTier[run.rival.name] || (S.byTier[run.rival.name] = [0, 0, 0, 0, 0]); b[0]++; if (won) { b[1]++; b[2] += cfg.lp - Math.min(cfg.lp, d.lp[0]); if (st.wasBehind) b[3]++; } b[4] += d.turn; }
  { const k = run.rival.tier + (run.floor + 1); const b = S.byTier[k] || (S.byTier[k] = [0, 0, 0, 0, 0]); b[0]++; if (won) { b[1]++; b[2] += db.config.lp - Math.min(db.config.lp, d.lp[0]); if (st.wasBehind) b[3]++; } b[4] += d.turn; }
  for (const [k, v] of Object.entries(st.chains)) S.chains[k] = (S.chains[k] || 0) + v;
  S.leadChanges += st.leadChanges || 0;
  S.traps += st.trapsSprung + d.stats[1].trapsSprung; S.defWins += st.defWins + d.stats[1].defWins;
  if (st.fx || d.stats[1].fx) { S.fx = S.fx || [{}, {}]; for (const i of [0, 1]) for (const [k, v] of Object.entries(d.stats[i].fx || {})) S.fx[i][k] = (S.fx[i][k] || 0) + v; }
  S.singles += st.singles; if (d.turn > 30) S.long++;
  S.reasons[d.reason + (won ? 'W' : 'L')] = (S.reasons[d.reason + (won ? 'W' : 'L')] || 0) + 1;
  for (const [k, v] of Object.entries(st.relicFires)) S.relicFires[k] = (S.relicFires[k] || 0) + v;
  if (Object.keys(st.relicFamilies).filter(f => !['plain', 'core', 'trade'].includes(f)).length >= 2) S.familiesInDuel++;
  if (d.seat[0].rs.secondWind) run.secondWindUsed = true;
  for (const p of st.newMelds) { const k = p[0] < p[1] ? p[0] + '+' + p[1] : p[1] + '+' + p[0]; if (!run.codex.includes(k)) { run.codex.push(k); run.xp += cfg.xp.newMeld; } }
  const door = run.door, tier = run.rival.tier;
  const summary = { won, turns: d.turn, reason: d.reason, lp: d.lp.slice(), tier };
  run.lastDuel = summary;
  if (!won) {
    S.losses++; run.sparks--;
    ev.push({ e: 'duelLost', sparks: run.sparks });
    run.duel = null;
    if (run.sparks <= 0) { run.phase = 'over'; run.result = { won: false, floor: run.floor, chamber: run.chamber, reason: 'sparks' }; return; }
    if (tier === 'boss') { run.phase = 'chamber'; run.doors = [bossDoor(run)]; return; }
    descend(db, run, rng); return;
  }
  S.wins++; if (st.trailed) S.trailedWins++; if (st.wasBehind) S.comebacks++; if (d.lp[0] < 4000) S.closeWins++; S.lpLostInWins += Math.max(0, db.config.lp - d.lp[0]);
  const rk = rankDuel(db, d, 0);
  const bounty = BOUNTIES.find(b => b.id === run.rival.bounty);
  const bountyMet = bounty.test(st, d);
  if (bountyMet) { rk.points += 10; rk.lines.push(['Bounty', 10]); rk.rank = rankLetter(cfg.rank, rk.points); S.bounties++; }
  S.ranks[rk.rank] = (S.ranks[rk.rank] || 0) + 1; (S.points || (S.points = [])).push(rk.points); (S.bountyBy || (S.bountyBy = {}))[bounty.id] = [((S.bountyBy[bounty.id] || [0, 0])[0]) + 1, ((S.bountyBy[bounty.id] || [0, 0])[1]) + (bountyMet ? 1 : 0)];
  let embers = cfg.embers[rk.rank] + st.embers + (tier === 'cursed' ? cfg.embers.cursedBonus : 0) + (bountyMet ? cfg.embers.bountyBonus : 0) + (run.charms.includes('ember_purse') ? 8 : 0);
  run.embers += embers;
  run.xp += cfg.xp.duel + (bountyMet ? cfg.xp.bounty : 0) + (tier === 'champion' ? cfg.xp.champion : 0) + (tier === 'boss' ? cfg.xp.boss : 0);
  while (run.xp >= (run.level + 1) * cfg.xp.perLevel * (cfg.giftXpScale || 1)) { run.level++; run.giftsQueued++; }
  if (tier !== 'boss') run.seals++;
  summary.rank = rk; summary.embers = embers; summary.bountyMet = bountyMet;
  ev.push({ e: 'duelWon', rank: rk.rank, style: rk.style, embers });
  run.duel = null;
  const drops = run.rival.drops;
  const list = rk.rank === 'S' || rk.rank === 'A' ? drops[rk.style] : drops.common;
  const n = rk.rank === 'C' || rk.rank === 'D' ? 2 : 3;
  const queue = [];
  if (tier === 'boss') {
    S.bossWins++;
    const opts = [{ kind: 'card', entry: { id: run.rival.ace }, text: 'Legendary card' }];
    const mw = possibleMasterworks(run);
    if (mw.length) opts.push({ kind: 'masterwork', id: mw[0], text: 'Forge ' + RELICS[mw[0]].name });
    const ch = relicOffer(run, rng, 'C', 3);
    if (ch.length && run.charms.length < cfg.charmSlots) opts.push({ kind: 'charmPick', ids: ch, text: 'Pyramid relic: one of three charms' });
    queue.push({ kind: 'guardian', options: opts });
  } else {
    let cards = pickThree(db, rng, list, n, rk.rank === 'S');
    if (tier === 'guardian') cards = pickThree(db, rng, drops.fury.slice().sort((a, b) => cardValue(db, b) - cardValue(db, a)).slice(0, 4), 3, true);
    queue.push({ kind: 'card', options: cards });
    if (tier === 'champion' && run.charms.length < cfg.charmSlots) { const ch = relicOffer(run, rng, 'C', 2); if (ch.length) queue.push({ kind: 'charm', options: ch }); }
  }
  for (; run.giftsQueued > 0; run.giftsQueued--) queue.push({ kind: 'gift', lazy: true });
  run.queue = queue;
  nextReward(db, run, rng);
}

function nextReward(db, run, rng) {
  while (run.queue && run.queue.length) {
    const o = run.queue.shift();
    if (o.lazy) { o.options = relicOffer(run, rng, 'G', 3); delete o.lazy; if (!o.options.length) continue; }
    if (o.kind === 'charm') { o.options = o.options.filter(id => !run.charms.includes(id)); if (!o.options.length || run.charms.length >= db.config.charmSlots) continue; }
    run.offer = o; run.phase = 'reward'; return;
  }
  run.offer = null; run.queue = null;
  if (run.door && run.door.type === 'boss' && run.lastDuel && run.lastDuel.won) {
    run.capBonus += db.config.bossCapBonus;
    if (run.floor === db.config.floors - 1) { run.phase = 'over'; run.result = { won: true, floor: run.floor }; return; }
    run.floor++; run.chamber = 0; run.seals = 0; run.door = null;
    run.doors = genDoors(db, run, rng); run.phase = 'chamber'; return;
  }
  descend(db, run, rng);
}
function descend(db, run, rng) {
  if (run.chamber < db.config.chambers - 1) run.chamber++;
  run.door = null;
  run.doors = genDoors(db, run, rng); run.phase = 'chamber';
}

function bazaarStock(db, run, rng, merchant) {
  const P = db.config.prices, L = poolLists(db), fl = run.floor;
  const band = BANDS.champion[fl];
  const half = n => run.charms.includes('miser') ? Math.ceil(n / 2) : n;
  const items = [];
  const cardItem = () => { const c = rng.chance(2, 3) ? rng.pick(L.monsters.filter(m => m.atk >= band[0] && m.atk <= band[1] + 200)) : rng.pick(L.spell.concat(L.trap, L.equip)); return { kind: 'card', entry: { id: c.id }, price: half(P.card + Math.floor(cardValue(db, c.id) / 100)) }; };
  if (merchant === 'cards') for (let i = 0; i < 4; i++) items.push(cardItem());
  if (merchant === 'charms') for (const id of relicOffer(run, rng, 'C', 3)) items.push({ kind: 'charm', id, price: half(P.charm) });
  if (merchant === 'scrapper') items.push({ kind: 'scrap', price: half(P.scrap), uses: 3 });
  if (merchant === 'shadow') { const a = cardItem(); items.push(a); const b = cardItem(); b.sealed = true; b.price = Math.ceil(b.price / 2); items.push(b); }
  return items;
}

function validDeck(db, run, deck) {
  const cfg = db.config;
  if (deck.length !== 40 - run.binds) return 'deck must be ' + (40 - run.binds) + ' cards';
  const count = new Map();
  for (const e of deck) { const n = (count.get(e.id) || 0) + 1; if (n > cfg.maxCopies) return 'more than three copies'; count.set(e.id, n); }
  if (deckWeight(db, deck) > weightCap(db, run)) return 'over the weight cap';
  return null;
}

export function runApply(run, a, db, opts = {}) {
  DB = db;
  const ev = [];
  const rng = new Rng(run.rng);
  const cfg = db.config;
  const fail = m => { throw new Error(m); };
  switch (run.phase) {
    case 'kit':
      if (a.t === 'redeal') { if (!run.redeal) fail('no re-deal left'); run.redeal = 0; run.offer = dealKits(db, rng, run); break; }
      if (a.t !== 'kit' || !run.offer[a.i]) fail('pick a kit');
      run.kit = run.offer[a.i].kit; run.deck = run.offer[a.i].deck; run.homeField = run.offer[a.i].homeField;
      run.offer = { kind: 'charm', options: relicOffer(run, rng, 'C', 3) }; run.phase = 'charm';
      break;
    case 'charm':
      if (a.t !== 'pick' || !run.offer.options[a.i]) fail('pick a charm');
      run.charms.push(run.offer.options[a.i]); run.offer = null;
      run.doors = genDoors(db, run, rng); run.phase = 'chamber';
      break;
    case 'chamber': {
      if (a.t === 'swap') { // swap one deck card with one trunk card
        const d = run.deck.slice(), t = run.trunk.slice();
        if (!d[a.deck] || !t[a.trunk]) fail('no such card');
        const x = d[a.deck]; d[a.deck] = t[a.trunk]; t[a.trunk] = x;
        const bad = validDeck(db, run, d); if (bad) fail(bad);
        run.deck = d; run.trunk = t; break;
      }
      if (a.t !== 'door' || !run.doors[a.i]) fail('pick a door');
      const door = run.doors[a.i];
      if (door.type === 'boss' && run.seals < 2) fail('the boss door needs two seals');
      run.door = door; run.stats.doors[door.type] = (run.stats.doors[door.type] || 0) + 1;
      ev.push({ e: 'door', type: door.type });
      if (door.tier) { startDuel(db, run, rng, door, opts.onStep); if (run.duel.winner !== null) finishDuel(db, run, rng, ev); break; }
      switch (door.type) {
        case 'anvil': run.phase = 'anvil'; run.offer = { kind: 'anvil', masterworks: possibleMasterworks(run), enchants: rng.shuffle(ENCHANTS.slice()).slice(0, 3) }; break;
        case 'bazaar': run.phase = 'bazaar'; run.offer = { kind: 'bazaar', merchant: door.merchant, items: bazaarStock(db, run, rng, door.merchant) }; break;
        case 'sanctum': run.phase = 'reward'; run.queue = []; run.offer = { kind: 'sanctum', options: ['spark', 'cap'] }; break;
        case 'omen': { const strong = rng.pick(poolLists(db).monsters.filter(m => m.atk >= BANDS.guardian[run.floor][0] + 300 && m.atk <= BANDS.guardian[run.floor][1] + 300)); run.phase = 'reward'; run.queue = []; run.offer = { kind: 'omen', card: { id: strong.id }, seen: false, text: 'The altar takes two trunk cards for one stronger card unseen, or 30 Embers to see it first. You may leave.' }; break; }
        case 'treasure': { const opts = pickThree(db, rng, poolLists(db).monsters.filter(m => m.atk >= BANDS.champion[run.floor][0] && m.atk <= BANDS.champion[run.floor][1]).map(m => m.id), 2, false); const ch = relicOffer(run, rng, 'C', 1); run.phase = 'reward'; run.queue = []; run.offer = { kind: 'treasure', options: opts.map(e => ({ kind: 'card', entry: e })).concat(ch.length && run.charms.length < cfg.charmSlots ? [{ kind: 'charm', id: ch[0] }] : []) }; break; }
        case 'mystery': { const roll = rng.int(6); if (roll < 3) { run.embers += 25; ev.push({ e: 'mystery', embers: 25 }); } else if (roll < 5) { const c = rng.pick(poolLists(db).fuel); addCard(db, run, { id: c.id }); ev.push({ e: 'mystery', card: c.id }); } else { const loss = Math.min(15, run.embers); run.embers -= loss; ev.push({ e: 'mystery', embers: -loss }); } descend(db, run, rng); break; }
      }
      break;
    }
    case 'duel': {
      if (a.t !== 'duel') fail('a duel is in progress');
      const d = run.duel;
      const mine = d.pending ? d.active === 1 : d.active === 0;
      if (!mine) fail('not your move');
      { const mine = applyMut(d, a.action, db); for (const e of mine) ev.push(e); if (opts.onStep) opts.onStep(mine); }
      advanceRival(db, run, opts.onStep);
      if (d.winner !== null) finishDuel(db, run, rng, ev);
      break;
    }
    case 'reward': {
      const o = run.offer;
      if (a.t === 'skip') { nextReward(db, run, rng); break; }
      if (a.t !== 'pick') fail('pick or skip');
      if (o.kind === 'card') { if (!o.options[a.i]) fail('no such card'); addCard(db, run, o.options[a.i]); }
      else if (o.kind === 'gift') { if (!o.options[a.i]) fail('no such gift'); run.gifts.push(o.options[a.i]); }
      else if (o.kind === 'charm') { if (!o.options[a.i]) fail('no such charm'); if (run.charms.length >= cfg.charmSlots) fail('charm slots full'); run.charms.push(o.options[a.i]); }
      else if (o.kind === 'guardian') {
        const g = o.options[a.i]; if (!g) fail('no such reward');
        if (g.kind === 'card') addCard(db, run, g.entry);
        else if (g.kind === 'masterwork') forgeMasterwork(run, g.id);
        else if (g.kind === 'charmPick') { run.queue.unshift({ kind: 'charm', options: g.ids }); }
      } else if (o.kind === 'treasure') { const g = o.options[a.i]; if (!g) fail('no such item'); if (g.kind === 'card') addCard(db, run, g.entry); else run.charms.push(g.id); }
      else if (o.kind === 'sanctum') { if (a.i === 0) { if (run.sparks >= cfg.sparks) fail('Sparks are full'); run.sparks++; } else run.capBonus += cfg.prices.sanctumCap; }
      else if (o.kind === 'omen') {
        if (a.i === 1) { if (o.seen || run.embers < 30) fail('cannot pay to see'); run.embers -= 30; o.seen = true; break; }
        if (run.trunk.length < 2) fail('the altar needs two trunk cards');
        const t = run.trunk.slice().sort((x, y) => cardValue(db, x) - cardValue(db, y));
        for (const e of t.slice(0, 2)) run.trunk.splice(run.trunk.indexOf(e), 1);
        addCard(db, run, o.card);
      }
      nextReward(db, run, rng);
      break;
    }
    case 'anvil': {
      if (a.t === 'leave') { descend(db, run, rng); break; }
      if (a.t !== 'anvil') fail('use the anvil or leave');
      const P = cfg.prices;
      if (a.kind === 'temper') { const e = run.deck[a.deck]; if (!e || !db.isMonster(e.id) || e.t) fail('cannot temper that'); if (run.embers < P.temper) fail('not enough Embers'); run.embers -= P.temper; e.t = 1; }
      else if (a.kind === 'enchant') { const e = run.deck[a.deck]; if (!e || !db.isMonster(e.id) || e.e) fail('cannot enchant that'); if (!run.offer.enchants.includes(a.enchant)) fail('that Enchant is not offered'); if (run.embers < P.enchant) fail('not enough Embers'); run.embers -= P.enchant; e.e = a.enchant; }
      else if (a.kind === 'bind') {
        if (run.binds >= cfg.maxBinds) fail('no Binds left');
        const x = run.deck[a.a], y = run.deck[a.b]; if (!x || !y || a.a === a.b) fail('pick two deck cards');
        const r = meldPair(db, x.id, y.id); if (r.kind !== 'printed' && r.kind !== 'cross') fail('those two do not meld into a monster');
        const k = x.id < y.id ? x.id + '+' + y.id : y.id + '+' + x.id; if (!run.codex.includes(k)) fail('that meld is not in your Codex yet');
        if (run.embers < P.bind) fail('not enough Embers');
        const deck = run.deck.filter((_, i) => i !== a.a && i !== a.b); deck.push({ id: r.id, b: 1, halves: [x.id, y.id] });
        run.binds++; const bad = validDeck(db, run, deck); if (bad) { run.binds--; fail(bad); }
        run.embers -= P.bind; run.deck = deck;
        if (run.charms.includes('meldwrights_ledger')) run.embers += 20;
      } else if (a.kind === 'masterwork') { if (!run.offer.masterworks.includes(a.id)) fail('that Masterwork is not ready'); if (run.embers < P.masterwork) fail('not enough Embers'); run.embers -= P.masterwork; forgeMasterwork(run, a.id); }
      else fail('unknown anvil action');
      descend(db, run, rng);
      break;
    }
    case 'bazaar': {
      if (a.t === 'leave') { descend(db, run, rng); break; }
      const it = run.offer.items[a.i]; if (a.t !== 'buy' || !it || it.sold) fail('nothing to buy there');
      if (run.embers < it.price) fail('not enough Embers');
      if (it.kind === 'card') { addCard(db, run, it.entry); it.sold = true; }
      else if (it.kind === 'charm') { if (run.charms.length >= cfg.charmSlots) fail('charm slots full'); run.charms.push(it.id); it.sold = true; }
      else if (it.kind === 'scrap') { const e = run.trunk[a.trunk]; if (!e) fail('pick a trunk card to scrap'); run.trunk.splice(a.trunk, 1); if (--it.uses <= 0) it.sold = true; }
      run.embers -= it.price;
      break;
    }
    default: fail('the run is over');
  }
  run.rng = rng.s;
  return ev;
}
function forgeMasterwork(run, id) {
  const parts = RELICS[id].parts;
  run.charms = run.charms.filter(x => !parts.includes(x)); run.gifts = run.gifts.filter(x => !parts.includes(x));
  run.masterworks.push(id);
}

export function runStep(run, action, db) { const r = clone(run); const events = runApply(r, action, db); return { run: r, events }; }
