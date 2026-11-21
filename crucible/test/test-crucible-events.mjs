// Do the events tell the whole story? The page animates a duel from its events, so anything the state does
// without an event is something the player never sees happen. Random legal play (with random Spell targets),
// and after every action the change in the state is checked against the events that action produced.
// Usage: node crucible/test/test-crucible-events.mjs [duels=1500]
import { loadDb, roleOf } from '../engine/cards.mjs';
import { newDuel, applyMut, legalActions, clone } from '../engine/duel.mjs';
import { Rng } from '../engine/rng.mjs';
import { RELICS, LAB, sortRelics } from '../engine/relics.mjs';
import { ENCHANTS } from '../engine/run.mjs';

const db = loadDb();
const DUELS = +process.argv[2] || 1500;
const all = db.pool.cards.filter(c => c.kind !== 'fusion').map(c => c.id);
const relicIds = Object.keys({ ...RELICS, ...LAB }).filter(id => ({ ...RELICS, ...LAB })[id].kind !== 'F');
const found = {}; const note = (k, d) => { const f = found[k] || (found[k] = { n: 0, eg: d }); f.n++; };
let actions = 0;
for (let n = 1; n <= DUELS; n++) {
  const r = Rng.fromSeed(n * 6151);
  const deck = () => Array.from({ length: 36 + r.int(5) }, () => { const e = { id: r.pick(all) }; if (r.chance(1, 6)) e.t = 1; if (r.chance(1, 3)) e.e = r.pick(ENCHANTS); return e; });
  const rel = () => sortRelics(r.shuffle(relicIds.slice()).slice(0, r.int(9)));
  const s = newDuel(db, { seed: n, decks: [deck(), deck()], seats: [{ forger: r.pick([null, 'tarn', 'scrapper', 'veil', 'storm']), relics: rel(), secondWind: r.chance(1, 3), underCap: 20 }, { relics: rel(), underCap: 20 }] });
  for (let k = 0; k < 900 && s.winner === null; k++) {
    const la = legalActions(s, db, { maxChain: 2 });
    let a = r.pick(la); if (a.t === 'end' && la.length > 1 && r.chance(3, 4)) a = r.pick(la);
    if (a.t === 'play' && a.hand.length === 1 && a.onto == null && roleOf(db, s.hand[s.active][a.hand[0]].id) !== 'monster' && r.chance(1, 2)) a = { ...a, target: r.int(s.zones) };
    const b = clone(s); let ev;
    try { ev = applyMut(s, a, db); } catch (e) { if (a.target != null) { Object.assign(s, clone(b)); continue; } throw e; }
    actions++;
    const tag = 'seed ' + n + ' step ' + k + ' ' + JSON.stringify(a);
    for (const p of [0, 1]) {
      // Life Points
      const lpEv = ev.filter(e => e.e === 'lp' && e.seat === p).reduce((t, e) => t + e.d, 0), wind = ev.some(e => e.e === 'relic' && e.id === 'second_wind' && e.seat === p);
      if (s.lp[p] - b.lp[p] !== lpEv && !wind && !(s.lp[p] === 0 && s.lp[p] - b.lp[p] > lpEv)) note('Life Points changed with no event for it', tag);
      // cards leaving the deck
      const took = b.deck[p].length - s.deck[p].length, drawn = ev.filter(e => e.e === 'draw' && e.seat === p).reduce((t, e) => t + e.n, 0);
      // (a relic, a Forger power or a returned monster may put a card under the deck in the same action)
      if (drawn !== took && !ev.some(e => ((e.e === 'relic' || e.e === 'power' || e.e === 'bounce') && e.seat === p))) note('cards left the deck and the draw events do not add up', tag);
      // monsters leaving the table
      const after = new Map(s.mon[p].map((m, z) => m ? [m.u, z] : null).filter(Boolean));
      b.mon[p].forEach((m, z) => { if (!m || after.has(m.u)) return;
        const ok = ev.some(e => (e.e === 'destroyed' || e.e === 'bounce') && e.seat === p && e.zone === z) || (a.t === 'play' && a.onto === z && p === b.active) || ev.some(e => e.e === 'relic' && e.seat === p && e.zone === z);
        if (!ok) note('a monster left the table with no event for its zone', tag); });
      // monsters turned face up
      s.mon[p].forEach((m, z) => { if (!m || m.veil) return; const was = b.mon[p].find(x => x && x.u === m.u); if (!was || !was.veil) return;
        const ok = ev.some(e => e.e === 'reveal' && e.seat === p && e.zone === z) || (a.t === 'pos' && a.zone === z && p === b.active) || (a.t === 'play' && a.onto === z);
        if (!ok) note('a veiled monster turned face up with no reveal event', tag); });
      // monsters arriving
      const had = new Set(b.mon[p].filter(Boolean).map(m => m.u));
      s.mon[p].forEach((m, z) => { if (!m || had.has(m.u)) return; if (!ev.some(e => (e.e === 'summon' || e.e === 'revive') && e.seat === p && e.zone === z) && !ev.some(e => e.e === 'relic' && e.seat === p)) note('a monster arrived with no event for its zone', tag); });
      // stat changes on monsters that stayed
      s.mon[p].forEach((m, z) => { if (!m) return; const was = b.mon[p].find(x => x && x.u === m.u); if (!was) return;
        const d = (m.ba || 0) + (m.ra || 0) - (was.ba || 0) - (was.ra || 0); if (!d) return;
        if (!ev.some(e => (e.e === 'stat' || e.e === 'equip' || e.e === 'relic' || e.e === 'meld' || e.e === 'solo' || e.e === 'power') )) note('a monster\'s ATK bonus changed with no event', tag); });
    }
  }
}
console.log('crucible events:', DUELS, 'duels,', actions, 'actions');
for (const [k, f] of Object.entries(found)) console.log(' ', String(f.n).padStart(6), k, '| first:', f.eg);
if (Object.keys(found).length) process.exit(1);
console.log('crucible events: every change checked has an event');
