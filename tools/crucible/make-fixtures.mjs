// Writes golden fixtures for Lost Memories (codename crucible): seed, action list and a
// state hash after every action. The Kotlin engine must replay these hash for hash.
//   node tools/crucible/make-fixtures.mjs          (writes crucible/fixtures/*.json)
//   node tools/crucible/make-fixtures.mjs --check  (replays and compares, writes nothing)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadDb } from '../../crucible/engine/cards.mjs';
import { newDuel, applyMut, viewFor, canonical } from '../../crucible/engine/duel.mjs';
import { chooseAction } from '../../crucible/engine/ai.mjs';
import { Rng } from '../../crucible/engine/rng.mjs';
import { RELICS, sortRelics } from '../../crucible/engine/relics.mjs';
import { newRun, runApply, makeKit, makeRival, KITS, THEMES } from '../../crucible/engine/run.mjs';
import { policyAction } from '../../crucible/engine/policy.mjs';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../crucible/fixtures');
const db = loadDb();
const h = x => crypto.createHash('sha256').update(canonical(x)).digest('hex').slice(0, 16);
const dataHash = crypto.createHash('sha256').update(canonical({ cfg: db.config, n: db.pool.cards.length, cut: db.pool.cutoff })).digest('hex').slice(0, 16);

function duelSetup(n) {
  const r = Rng.fromSeed(1000 + n);
  const kit = makeKit(db, r, KITS[n % 3]);
  const rival = makeRival(db, r, { floor: n % 3, tier: ['regular', 'cursed', 'champion', 'guardian'][n % 4], theme: THEMES[n % THEMES.length] });
  const relics = sortRelics(r.shuffle(Object.keys(RELICS)).slice(0, n % 7));
  const twist = [null, 'fog', 'narrow', 'storm', 'locked'][n % 5];
  return { seed: 5000 + n, decks: [kit.deck, rival.deck], seats: [{ relics, homeField: kit.homeField, underCap: 12, secondWind: relics.includes('second_wind') }, {}], twist };
}
function playDuel(n, given) {
  const s = newDuel(db, duelSetup(n));
  const actions = [], hashes = [h(s)];
  let i = 0;
  while (s.winner === null) {
    const seat = s.pending ? 1 - s.active : s.active;
    const a = given ? given[i++] : (chooseAction(db, viewFor(s, db, seat), 2, {}) || { t: 'end' });
    applyMut(s, a, db); actions.push(a); hashes.push(h(s));
  }
  return { n, actions, hashes, winner: s.winner, turns: s.turn };
}
function playRunFx(seed, given) {
  const run = newRun(db, { seed });
  const actions = [], hashes = [h(run)];
  let i = 0;
  while (run.phase !== 'over') {
    const a = given ? given[i++] : policyAction(db, run, { level: 2, family: ['neutral', 'furnace', 'shadow', 'lean', 'storm'][seed % 5] });
    runApply(run, a, db); actions.push(a); hashes.push(h(run));
  }
  return { seed, actions, hashes, result: run.result };
}

const check = process.argv.includes('--check');
if (check) {
  const duels = JSON.parse(fs.readFileSync(path.join(DIR, 'duels.json'), 'utf8')), runs = JSON.parse(fs.readFileSync(path.join(DIR, 'runs.json'), 'utf8'));
  if (duels.dataHash !== dataHash) { console.error('fixtures were made from different data or config; regenerate them on purpose'); process.exit(1); }
  let steps = 0;
  for (const f of duels.duels) { const g = playDuel(f.n, f.actions); if (g.hashes.join() !== f.hashes.join()) { console.error('duel fixture', f.n, 'diverged at step', g.hashes.findIndex((x, i) => x !== f.hashes[i])); process.exit(1); } steps += f.actions.length; }
  for (const f of runs.runs) { const g = playRunFx(f.seed, f.actions); if (g.hashes.join() !== f.hashes.join()) { console.error('run fixture', f.seed, 'diverged at step', g.hashes.findIndex((x, i) => x !== f.hashes[i])); process.exit(1); } steps += f.actions.length; }
  console.log('crucible fixtures:', duels.duels.length, 'duels and', runs.runs.length, 'runs replayed hash for hash,', steps, 'actions');
} else {
  fs.mkdirSync(DIR, { recursive: true });
  const duels = Array.from({ length: 50 }, (_, n) => playDuel(n));
  const runs = Array.from({ length: 10 }, (_, k) => playRunFx(900 + k));
  fs.writeFileSync(path.join(DIR, 'duels.json'), JSON.stringify({ dataHash, duels }) + '\n');
  fs.writeFileSync(path.join(DIR, 'runs.json'), JSON.stringify({ dataHash, runs }) + '\n');
  console.log('wrote', duels.length, 'duels,', runs.length, 'runs', duels.reduce((n, d) => n + d.actions.length, 0) + runs.reduce((n, d) => n + d.actions.length, 0), 'actions');
}
