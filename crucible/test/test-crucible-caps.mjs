// Does any relic fire more often than its own words allow? Random duels, CPU on both sides, seven random relics a side.
// The limit is read from each relic's own text, so a text and a rule that drift apart show up here.
// Usage: node crucible/test/test-crucible-caps.mjs [duels=600] [tuned=0|1]
import { loadDb } from '../engine/cards.mjs';
import { newDuel, applyMut, viewFor } from '../engine/duel.mjs';
import { chooseAction } from '../engine/ai.mjs';
import { RELICS, LAB, sortRelics, relicText } from '../engine/relics.mjs';
import { makeKit, KITS } from '../engine/run.mjs';
import { FORGERS } from '../engine/forgers.mjs';
import { Rng } from '../engine/rng.mjs';
const db0 = loadDb(); const tuned = +process.argv[3] || 0; const db = { ...db0, config: { ...db0.config, itemTune: tuned, trackFx: 0 }, _pair: new Map() };
const ALL = { ...RELICS, ...LAB }; const ids = Object.keys(ALL).filter(id => ALL[id].kind !== 'F' && id !== 'second_wind');
// Relics that arm now and pay on the next meld: the payment is not a second use.
const ARMS = new Set(['tomb_ledger', 'pyre_mark', 'forge_heart', 'patient_hunter', 'unseen_hand', 'deep_shade', 'cracked_mask', 'second_burial', 'shield_oath', 'long_watch', 'overcharge', 'outrider', 'charged_bones']);
// Two clauses in one text: the limit named belongs to the other clause.
const SKIP = { grave_call: 'duel', bone_tithe: 'turn' };
const NUM = { once: 1, twice: 2, two: 2, three: 3, four: 4, five: 5 };
const caps = {};
for (const id of ids) { const t = relicText(db, id); let duel = null, turn = null, m;
  if ((m = t.match(/up to (twice|two|three|four|five)(?: times)? a duel/i))) duel = NUM[m[1].toLowerCase()];
  else if (/once a duel|the first time each duel|your first [^.]* each duel|at most twice a duel/i.test(t)) duel = /at most twice/i.test(t) ? 2 : 1;
  if (/once a turn|the first time each turn/i.test(t)) turn = 1;
  if (SKIP[id] === 'duel') duel = null; if (SKIP[id] === 'turn') turn = null;
  if (duel || turn) caps[id] = { duel, turn, text: t }; }
const kits = [...Object.values(KITS), ...Object.values(FORGERS).flatMap(f => f.kits || [])];
const N = +process.argv[2] || 600; const worst = {}; let duels = 0, acts = 0;
for (let n = 1; n <= N; n++) {
  const r = new Rng(n * 104729); const deck = () => makeKit(db, r, r.pick(kits)).deck;
  const rel = () => sortRelics(r.shuffle(ids.slice()).slice(0, 7));
  const s = newDuel(db, { seed: n, decks: [deck(), deck()], seats: [{ relics: rel(), underCap: 20, homeField: null }, { relics: rel(), underCap: 20 }] });
  const perDuel = [{}, {}], perTurn = [{}, {}]; let turn = s.turn;
  for (let k = 0; k < 600 && s.winner === null; k++) {
    const seat = s.pending ? 1 - s.active : s.active; const a = chooseAction(db, viewFor(s, db, seat), 2, {}) || { t: 'end' };
    let ev; try { ev = applyMut(s, a, db); } catch (e) { ev = applyMut(s, s.pending ? { t: 'respond', trap: -1 } : { t: 'end' }, db); }
    acts++;
    for (const e of ev) if (e.e === 'relic' && caps[e.id]) {
      const key = e.id, kind = e.armed || (e.id === 'tomb_ledger' && e.marks) ? 'arm' : e.u != null && (e.a || e.d) && ARMS.has(e.id) ? 'pay' : e.longer ? 'long' : e.guard ? 'guard' : e.note ? 'note' : 'fire';
      const d = perDuel[e.seat][key] || (perDuel[e.seat][key] = {}); d[kind] = (d[kind] || 0) + 1;
      const tk = s.turn + ':' + key, t = perTurn[e.seat][tk] || (perTurn[e.seat][tk] = {}); t[kind] = (t[kind] || 0) + 1;
    }
  }
  duels++;
  for (const seat of [0, 1]) {
    for (const [id, d] of Object.entries(perDuel[seat])) { const c = caps[id]; const top = Math.max(d.arm || 0, d.fire || 0); if (c.duel && top > c.duel) { const w = worst[id] || (worst[id] = { cap: 'duel ' + c.duel, seen: 0, n: 0, text: c.text }); w.n++; w.seen = Math.max(w.seen, top); w.detail = JSON.stringify(d); } }
    for (const [tk, d] of Object.entries(perTurn[seat])) { const id = tk.split(':')[1], c = caps[id]; const top = Math.max(d.arm || 0, d.fire || 0); if (c.turn && top > c.turn) { const w = worst[id + '/turn'] || (worst[id + '/turn'] = { cap: 'turn 1', seen: 0, n: 0, text: c.text }); w.n++; w.seen = Math.max(w.seen, top); w.detail = JSON.stringify(d); } }
  }
}
console.log('duels', duels, 'actions', acts, 'relics with a stated limit', Object.keys(caps).length);
for (const [id, w] of Object.entries(worst)) console.log(id.padEnd(22), 'limit', w.cap, 'seen', w.seen, 'in', w.n, 'cases', w.detail, '|', w.text.slice(0, 150));
if (Object.keys(worst).length) { console.error('crucible caps: a relic fired more often than its text allows'); process.exit(1); }
console.log('crucible caps: no relic went past its stated limit');
