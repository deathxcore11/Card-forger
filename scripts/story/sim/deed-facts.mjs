// Reads DeedSim's stream on stdin and prints one JSON line per game: the match-facts.js facts for both
// seats (hero = seat 0, villain = seat 1), the winner and who went first.
// java ... DeedSim root 10 a.txt b.txt | node scripts/story/sim/deed-facts.mjs >> facts.jsonl
import {createInterface} from 'node:readline';
import {createMatchFacts} from '../../../match-facts.js';
let pair = null, trackers = null;
const fresh = () => [createMatchFacts(), createMatchFacts()];
for await (const line of createInterface({input: process.stdin})) {
  if (line.startsWith('P ')) { pair = JSON.parse(line.slice(2)).replace(/^.*\/|-hero\.txt$/g, ''); trackers = fresh(); continue; }
  if (line.startsWith('S ')) { const i = line.indexOf(' ', 2), s = JSON.parse(line.slice(i + 1)); trackers ??= fresh(); trackers[0].update({...s, seat: 0}); trackers[1].update({...s, seat: 1}); continue; }
  if (line.startsWith('G ')) {
    const i = line.indexOf(' ', 2), g = Number(line.slice(2, i)), r = JSON.parse(line.slice(i + 1));
    if (trackers) console.log(JSON.stringify({battle: pair, game: g, winner: r.winner, hero: trackers[0].snapshot({onPlay: r.heroFirst}), villain: trackers[1].snapshot({onPlay: !r.heroFirst})}));
    trackers = fresh();
  }
}
