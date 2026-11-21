// Scripted players for the headless simulator. A policy plays a whole run by choosing
// run actions; in a duel it asks the same no-peek AI the rivals use, with weights for
// the build family it is trying to assemble.
import { roleOf, meldPair, codexKnows } from './cards.mjs';
import { viewFor } from './duel.mjs';
import { chooseAction } from './ai.mjs';
import { relicInfo } from './relics.mjs';
import { runApply, cardValue, entryWeight, deckWeight, weightCap, possibleMasterworks, MIN_DECK } from './run.mjs';

export const FAMILIES = {
  neutral: { kit: null, duel: {}, likes: [] },
  chain4: { kit: null, duel: { maxChain: 4 }, likes: [] },
  chain2: { kit: null, duel: { maxChain: 2 }, likes: [] },
  single: { kit: null, duel: { maxChain: 1 }, likes: [] },
  furnace: { kit: 'dragons_warriors', duel: { fieldBonus: 220, fireBonus: 220, meldBonus: 80 }, likes: ['furnace'] },
  shadow: { kit: 'spellcasters_fiends', duel: { veilBonus: 220, trapBonus: 220 }, likes: ['shadow'], trades: ['broken_anvil', 'glass_idol'] },
  tomb: { kit: null, duel: {}, likes: ['tomb'] },
  lean: { kit: 'beasts_plants', duel: { boundBonus: 400 }, likes: ['lean'], trades: ['heavy_crown'] },
  storm: { kit: null, duel: { maxChain: 4, chainBonus: 60 }, likes: ['storm'], trades: ['tinder_vow'] },
  // The same neutral player that only prefers one build's pieces: separates what the pieces are worth from how a build's brain plays.
  pick_storm: { kit: null, duel: {}, likes: ['storm'] }, pick_tomb: { kit: null, duel: {}, likes: ['tomb'] }, pick_shadow: { kit: null, duel: {}, likes: ['shadow'] },
  pick_furnace: { kit: null, duel: {}, likes: ['furnace'] }, pick_lean: { kit: null, duel: {}, likes: ['lean'] },
  // A player who aims for one engine: takes its pieces in this order whenever they are offered, then pieces of its build.
  engine_tomb: { kit: null, duel: {}, likes: ['tomb'], want: ['tomb_ledger', 'grave_call', 'last_rites', 'blood_price', 'chain_lightning', 'bone_tithe', 'charged_bones', 'second_burial', 'bone_bellows'] },
  engine_pyre: { kit: null, duel: {}, likes: ['furnace'], want: ['pyre_mark', 'bone_bellows', 'bone_tithe', 'grave_call', 'quench', 'chain_lightning', 'banked_coals', 'last_rites', 'blood_price'] },
  engine_veil: { kit: null, duel: {}, likes: ['shadow'], want: ['glass_idol', 'deep_shade', 'tomb_bell', 'thunderclap', 'blood_price', 'chain_lightning', 'snare', 'spoils', 'cold_lantern'] },
};

function relicScore(fam, id, run) {
  const r = relicInfo(id);
  if (fam.want && fam.want.includes(id)) return 200 - fam.want.indexOf(id);
  if (fam.likes.includes(r.family)) return 100;
  // A linked relic is worth taking when the player holds pieces of either build it joins.
  if (r.link) { if (fam.likes.includes(r.link)) return 90; const own = run ? [...run.charms, ...run.gifts, ...run.masterworks].map(x => relicInfo(x)).filter(Boolean) : []; return 30 + 25 * Math.min(2, own.filter(o => o.family === r.family || o.family === r.link).length); }
  if (r.family === 'trade') return (fam.trades || []).includes(id) ? 70 : -50;
  if (r.family === 'core') return 60;
  if (r.family === 'plain') return 40;
  return 20;
}
const bestIdx = (arr, f) => { let bi = -1, bv = -Infinity; arr.forEach((x, i) => { const v = f(x, i); if (v > bv) { bv = v; bi = i; } }); return bi; };

// Greedy deck tuning: the next swap that raises total value while the cap holds, or null.
function nextSwap(db, run) {
  const cap = weightCap(db, run);
  const count = new Map(); for (const e of run.deck) count.set(e.id, (count.get(e.id) || 0) + 1);
  const w = deckWeight(db, run.deck);
  const mons = run.deck.filter(e => db.isMonster(e.id)).length;
  let best = null;
  run.trunk.forEach((t, ti) => {
    const tv = cardValue(db, t), tw = entryWeight(db, t), tMon = db.isMonster(t.id);
    run.deck.forEach((d, di) => {
      if (d.b) return;
      if ((count.get(t.id) || 0) - (d.id === t.id ? 1 : 0) >= db.config.maxCopies) return;
      const dMon = db.isMonster(d.id);
      if (dMon && !tMon && mons <= 24) return;
      if (!dMon && tMon && mons >= 31) return;
      const gain = tv - cardValue(db, d);
      if (gain <= 40 || w - entryWeight(db, d) + tw > cap) return;
      if (!best || gain > best.gain) best = { gain, di, ti };
    });
  });
  return best ? { t: 'swap', deck: best.di, trunk: best.ti } : null;
}

function deckPower(db, run) { const m = run.deck.filter(e => db.isMonster(e.id)).map(e => cardValue(db, e)).sort((a, b) => b - a).slice(0, 12); return m.reduce((a, b) => a + b, 0) / Math.max(1, m.length); }

function doorScore(db, run, d, fam) {
  const P = db.config.prices, left = db.config.chambers - 1 - run.chamber, need = Math.max(0, 2 - run.seals);
  const strong = deckPower(db, run) > 1500 + run.floor * 350;
  const careful = run.sparks === 1;
  switch (d.type) {
    case 'boss': return 1000;
    case 'duel': return 55 + (need ? 35 : 0);
    case 'cursed': return 45 + (need ? 30 : 0) - (careful ? 15 : 0);
    case 'champion': return (strong ? 62 : 18) - (careful ? 30 : 0) + (need ? 20 : 0);
    case 'guardian': return (strong ? 50 : 8) - (careful ? 30 : 0) + (need ? 20 : 0);
    case 'anvil': return possibleMasterworks(run).length && run.embers >= P.masterwork ? 95 : run.embers >= P.temper ? 64 : 4;
    case 'bazaar': return run.embers >= 45 ? 50 : 4;
    case 'sanctum': return run.sparks < db.config.sparks ? 90 : 38;
    case 'omen': return run.trunk.length >= 2 ? 52 : 6;
    case 'treasure': return 92;
    case 'mystery': return 30;
    case 'secret': return 500; // the test player always opens the door that was not there
    case 'onward': return 100;
  }
  return 0;
}

function anvilAction(db, run, fam) {
  const P = db.config.prices, o = run.offer;
  if (o.masterworks.length && run.embers >= P.masterwork) return { t: 'anvil', kind: 'masterwork', id: o.masterworks[0] };
  if (fam.likes.includes('lean') && run.binds < db.config.maxBinds && run.embers >= P.bind) {
    let best = null;
    for (let i = 0; i < run.deck.length; i++) for (let j = i + 1; j < run.deck.length; j++) {
      const x = run.deck[i], y = run.deck[j];
      if (x.b || y.b || !db.isMonster(x.id) || !db.isMonster(y.id)) continue;
      if (!codexKnows(db, k => run.codex.includes(k), x.id, y.id)) continue;
      const r = meldPair(db, x.id, y.id); if (r.kind !== 'printed' && r.kind !== 'cross') continue;
      if (run.deck.filter(e => e.id === r.id).length >= db.config.maxCopies) continue; // a fourth copy is not a legal deck
      const atk = db.byId.get(r.id).atk; if (!best || atk > best.atk) best = { atk, a: i, b: j };
    }
    if (best && best.atk >= 1700) return { t: 'anvil', kind: 'bind', a: best.a, b: best.b };
  }
  const mons = run.deck.map((e, i) => [e, i]).filter(([e]) => db.isMonster(e.id)).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0]));
  if (run.embers >= P.enchant) { const t = mons.find(([e]) => !e.e); const pref = ['piercing', 'twin', 'drain', 'bulwark', 'venom', 'echo', 'herald', 'ambusher', 'kindred', 'catalyst', 'warden', 'soaring'].find(x => o.enchants.includes(x)); if (t && pref) return { t: 'anvil', kind: 'enchant', deck: t[1], enchant: pref }; }
  if (run.embers >= P.temper) { const t = mons.find(([e]) => !e.t); if (t) return { t: 'anvil', kind: 'temper', deck: t[1] }; }
  return { t: 'leave' };
}

// When a simulated player uses its Forger's once-a-duel power. Works from the view only.
function forgerPower(db, v, planned) {
  if (!v.forger || v.rs.power || v.played || v.attacked || v.pending || v.active !== v.me) return null;
  const me = v.me, r = 1 - me;
  if (v.forger === 'tarn') return planned && planned.t === 'play' && planned.hand.length >= 2 ? { t: 'power' } : null;
  if (v.forger === 'scrapper') { if (v.deckCount[me] < 2 || !v.hand.length || v.turn < 2) return null; return { t: 'power', hand: bestIdx(v.hand, c => -cardValue(db, c)) }; }
  if (v.forger === 'storm') return v.homeField && !(v.terrain && (v.terrain.lock || v.terrain.id === v.homeField)) ? { t: 'power' } : null;
  if (v.forger === 'last') { const mine = v.mon[me].filter(Boolean); return mine.length === 1 && !mine[0].veil ? { t: 'power' } : null; }
  if (v.forger === 'veil') {
    const top = Math.max(0, ...v.mon[r].filter(m => m && !m.veil).map(m => m.ea));
    const z = v.mon[me].findIndex(m => m && !m.veil && m.pos === 'a' && m.ea < top && m.ed >= m.ea + 300);
    return z >= 0 ? { t: 'power', zone: z } : null;
  }
  return null;
}

// The engine a player aims for when it follows what the run carries (family 'engine_run'): the first of the run's builds
// that has an engine list, or by the run's seed when the run names no builds, so the two cases can be compared.
function engineFor(run) {
  const byBuild = { tomb: 'engine_tomb', furnace: 'engine_pyre', shadow: 'engine_veil' };
  if (run.builds) { const b = run.builds.find(x => byBuild[x]); return b ? byBuild[b] : 'storm'; }
  return ['engine_tomb', 'engine_pyre', 'engine_veil'][Number(BigInt(run.seed) % 3n)];
}
export const familyOf = (run, family) => family === 'engine_run' ? FAMILIES[engineFor(run)] : FAMILIES[family];
// Chooses the next run action. `level` is the duel skill of the simulated player (0..2).
// lone: 'boss' keeps one monster in guardian duels (a player hunting the first secret), 'all' in every duel, 'last'
// in every duel when the Forger is The Last One. The default player never does.
export function policyAction(db, run, { family = 'neutral', level = 2, lone = null } = {}) {
  const fam = familyOf(run, family);
  switch (run.phase) {
    case 'kit': { const i = fam.kit ? run.offer.findIndex(k => k.kit === fam.kit) : Number(BigInt(run.seed) % 3n); return { t: 'kit', i: i < 0 ? 0 : i }; }
    case 'charm': return { t: 'pick', i: bestIdx(run.offer.options, id => relicScore(fam, id)) };
    case 'chamber': { const sw = nextSwap(db, run); if (sw) return sw; const ok = run.doors.map((d, i) => (d.type === 'boss' && run.seals < 2) ? -1e9 : doorScore(db, run, d, fam) - i * 0.01); return { t: 'door', i: bestIdx(ok, v => v) }; }
    case 'duel': {
      const v = viewFor(run.duel, db, 0);
      const alone = lone === 'all' || (lone === 'boss' && run.rival.tier === 'boss') || (lone === 'last' && run.forger === 'last');
      const a = chooseAction(db, v, level, alone ? { ...fam.duel, lone: true } : fam.duel);
      // Cracked Mask: before a meld, turn a veiled monster face up to arm it.
      if (level >= 1 && a && a.t === 'play' && a.hand.length >= 2 && v.relics.includes('cracked_mask') && !v.rs.mask && !v.played && !v.pending) { const z = v.mon[v.me].findIndex(m => m && m.veil && !m.moved && !(m.att > 0)); if (z >= 0) return { t: 'duel', action: { t: 'pos', zone: z } }; }
      const p = level >= 1 ? forgerPower(db, v, a) : null;
      return { t: 'duel', action: p || a || { t: 'end' } };
    }
    case 'reward': {
      const o = run.offer;
      if (o.kind === 'card') return { t: 'pick', i: bestIdx(o.options, e => cardValue(db, e)) };
      if (fam.want && o.kind === 'gift' && run.rerolls > 0 && !o.options.some(id => fam.want.includes(id))) return { t: 'reroll' };
      if (o.kind === 'gift' || o.kind === 'charm') { const i = bestIdx(o.options, id => relicScore(fam, id, run)); return relicScore(fam, o.options[i], run) < 0 ? { t: 'skip' } : { t: 'pick', i }; }
      if (o.kind === 'guardian') { const order = ['masterwork', 'charmPick', 'card']; return { t: 'pick', i: bestIdx(o.options, g => -order.indexOf(g.kind)) }; }
      if (o.kind === 'treasure') return { t: 'pick', i: bestIdx(o.options, g => g.kind === 'charm' ? relicScore(fam, g.id) * 30 : cardValue(db, g.entry)) };
      if (o.kind === 'sanctum') return { t: 'pick', i: run.sparks < db.config.sparks ? 0 : 1 };
      if (o.kind === 'omen') return run.trunk.length >= 2 ? { t: 'pick', i: 0 } : { t: 'skip' };
      return { t: 'skip' };
    }
    case 'anvil': return anvilAction(db, run, fam);
    case 'bazaar': {
      const o = run.offer;
      // Sim-only (config simOdd): always take the odd Gift when it can be paid for, to measure what holding one is worth.
      if (db.config.simOdd) { const gi = o.items.findIndex(it => it.kind === 'gift' && !it.sold && it.price <= run.embers); if (gi >= 0) return { t: 'buy', i: gi }; }
      const worst = Math.min(...run.deck.map(e => cardValue(db, e)));
      const i = bestIdx(o.items, it => {
        if (it.sold || it.price > run.embers) return -1e9;
        if (it.kind === 'card') return cardValue(db, it.entry) - worst - 350;
        if (it.kind === 'charm') return run.charms.length < db.config.charmSlots ? relicScore(fam, it.id) * 5 : -1e9;
        if (it.kind === 'gift') return relicScore(fam, it.id, run) * 5;
        return -1e9;
      });
      if (i >= 0) { const it = o.items[i]; if (!it.sold && it.price <= run.embers) { const v = it.kind === 'card' ? cardValue(db, it.entry) - worst - 350 : it.kind === 'charm' && run.charms.length < db.config.charmSlots ? relicScore(fam, it.id) : it.kind === 'gift' ? relicScore(fam, it.id, run) : -1; if (v > 0) return { t: 'buy', i }; } }
      // Sim-only (config simCut): let the Winnower cut the weakest loose card, to measure what a thinner deck is worth.
      if (db.config.simCut) { const si = o.items.findIndex(it => it.kind === 'scrap' && !it.sold && it.price <= run.embers); if (si >= 0 && run.deck.length > MIN_DECK) { const di = bestIdx(run.deck, e => e.b ? -1e9 : -cardValue(db, e)); if (di >= 0 && !run.deck[di].b) return { t: 'buy', i: si, deck: di }; } }
      return { t: 'leave' };
    }
  }
  return null;
}

export function playRun(db, run, opts = {}) {
  let guard = 0;
  while (run.phase !== 'over') {
    const a = policyAction(db, run, opts);
    runApply(run, a, db);
    if (++guard > 200000) throw new Error('run did not finish, seed ' + run.seed + ' phase ' + run.phase);
  }
  return run;
}
