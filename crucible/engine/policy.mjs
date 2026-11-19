// Scripted players for the headless simulator. A policy plays a whole run by choosing
// run actions; in a duel it asks the same no-peek AI the rivals use, with weights for
// the build family it is trying to assemble.
import { roleOf, meldPair } from './cards.mjs';
import { viewFor } from './duel.mjs';
import { chooseAction } from './ai.mjs';
import { RELICS } from './relics.mjs';
import { runApply, cardValue, entryWeight, deckWeight, weightCap, possibleMasterworks } from './run.mjs';

export const FAMILIES = {
  neutral: { kit: null, duel: {}, likes: [] },
  chain4: { kit: null, duel: { maxChain: 4 }, likes: [] },
  chain2: { kit: null, duel: { maxChain: 2 }, likes: [] },
  single: { kit: null, duel: { maxChain: 1 }, likes: [] },
  furnace: { kit: 'dragons_warriors', duel: { fieldBonus: 220, fireBonus: 220, meldBonus: 80 }, likes: ['furnace'] },
  shadow: { kit: 'spellcasters_fiends', duel: { veilBonus: 220, trapBonus: 220 }, likes: ['shadow'], trades: ['broken_anvil', 'glass_idol'] },
  lean: { kit: 'beasts_plants', duel: { boundBonus: 400 }, likes: ['lean'], trades: ['heavy_crown'] },
  storm: { kit: null, duel: { maxChain: 4, chainBonus: 60 }, likes: ['storm'], trades: ['tinder_vow'] },
};

function relicScore(fam, id) {
  const r = RELICS[id];
  if (fam.likes.includes(r.family)) return 100;
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
      const k = x.id < y.id ? x.id + '+' + y.id : y.id + '+' + x.id; if (!run.codex.includes(k)) continue;
      const r = meldPair(db, x.id, y.id); if (r.kind !== 'printed' && r.kind !== 'cross') continue;
      const atk = db.byId.get(r.id).atk; if (!best || atk > best.atk) best = { atk, a: i, b: j };
    }
    if (best && best.atk >= 1700) return { t: 'anvil', kind: 'bind', a: best.a, b: best.b };
  }
  const mons = run.deck.map((e, i) => [e, i]).filter(([e]) => db.isMonster(e.id)).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0]));
  if (run.embers >= P.enchant) { const t = mons.find(([e]) => !e.e); const pref = ['piercing', 'twin', 'drain', 'bulwark', 'venom', 'echo', 'herald', 'ambusher', 'kindred', 'catalyst', 'warden', 'soaring'].find(x => o.enchants.includes(x)); if (t && pref) return { t: 'anvil', kind: 'enchant', deck: t[1], enchant: pref }; }
  if (run.embers >= P.temper) { const t = mons.find(([e]) => !e.t); if (t) return { t: 'anvil', kind: 'temper', deck: t[1] }; }
  return { t: 'leave' };
}

// Chooses the next run action. `level` is the duel skill of the simulated player (0..2).
export function policyAction(db, run, { family = 'neutral', level = 2 } = {}) {
  const fam = FAMILIES[family];
  switch (run.phase) {
    case 'kit': { const i = fam.kit ? run.offer.findIndex(k => k.kit === fam.kit) : Number(BigInt(run.seed) % 3n); return { t: 'kit', i: i < 0 ? 0 : i }; }
    case 'charm': return { t: 'pick', i: bestIdx(run.offer.options, id => relicScore(fam, id)) };
    case 'chamber': { const sw = nextSwap(db, run); if (sw) return sw; const ok = run.doors.map((d, i) => (d.type === 'boss' && run.seals < 2) ? -1e9 : doorScore(db, run, d, fam) - i * 0.01); return { t: 'door', i: bestIdx(ok, v => v) }; }
    case 'duel': { const a = chooseAction(db, viewFor(run.duel, db, 0), level, fam.duel); return { t: 'duel', action: a || { t: 'end' } }; }
    case 'reward': {
      const o = run.offer;
      if (o.kind === 'card') return { t: 'pick', i: bestIdx(o.options, e => cardValue(db, e)) };
      if (o.kind === 'gift' || o.kind === 'charm') { const i = bestIdx(o.options, id => relicScore(fam, id)); return relicScore(fam, o.options[i]) < 0 ? { t: 'skip' } : { t: 'pick', i }; }
      if (o.kind === 'guardian') { const order = ['masterwork', 'charmPick', 'card']; return { t: 'pick', i: bestIdx(o.options, g => -order.indexOf(g.kind)) }; }
      if (o.kind === 'treasure') return { t: 'pick', i: bestIdx(o.options, g => g.kind === 'charm' ? relicScore(fam, g.id) * 30 : cardValue(db, g.entry)) };
      if (o.kind === 'sanctum') return { t: 'pick', i: run.sparks < db.config.sparks ? 0 : 1 };
      if (o.kind === 'omen') return run.trunk.length >= 2 ? { t: 'pick', i: 0 } : { t: 'skip' };
      return { t: 'skip' };
    }
    case 'anvil': return anvilAction(db, run, fam);
    case 'bazaar': {
      const o = run.offer;
      const worst = Math.min(...run.deck.map(e => cardValue(db, e)));
      const i = bestIdx(o.items, it => {
        if (it.sold || it.price > run.embers) return -1e9;
        if (it.kind === 'card') return cardValue(db, it.entry) - worst - 350;
        if (it.kind === 'charm') return run.charms.length < db.config.charmSlots ? relicScore(fam, it.id) * 5 : -1e9;
        return -1e9;
      });
      if (i >= 0) { const it = o.items[i]; if (!it.sold && it.price <= run.embers) { const v = it.kind === 'card' ? cardValue(db, it.entry) - worst - 350 : it.kind === 'charm' && run.charms.length < db.config.charmSlots ? relicScore(fam, it.id) : -1; if (v > 0) return { t: 'buy', i }; } }
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
