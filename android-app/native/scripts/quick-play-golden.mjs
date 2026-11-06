// The site's chooseQuickOpponent over a fixed pool and a fixed stream of random numbers: the picks the Kotlin port must repeat.
// node scripts/quick-play-golden.mjs <web root> app/src/test/resources/quick-play/quick-golden.json (QuickOpponentTest.sameAsTheSite)
const [web, out] = process.argv.slice(2);
const {chooseQuickOpponent} = await import(new URL('play-quick-match.js', 'file://' + web.replace(/\/?$/, '/')));
const {matchupLine} = await import(new URL('power-tier.js', 'file://' + web.replace(/\/?$/, '/')));
import {writeFileSync} from 'node:fs';
let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const ARCH = ['Burn', 'Control', 'Elves', 'Tron', 'Affinity', 'Storm', 'Reanimator', 'Midrange'];
const deck = (i, fmt, extra = {}) => ({id: 'd' + i, name: ARCH[i % ARCH.length] + ' · list ' + i, format: fmt, cards: [{name: 'Card ' + i, qty: 4}, {name: 'Filler ' + (i % 5), qty: 56}], ...extra});
const modern = Array.from({length: 70}, (_, i) => deck(i, 'Modern'));
const power = d => d.power0 ?? null;
modern.forEach((d, i) => { d.power0 = i % 9 === 4 ? null : 18 + ((i * 37) % 81); });
const cmd = Array.from({length: 30}, (_, i) => ({id: 'c' + i, name: 'Commander ' + i, format: 'Commander', commander: 'Leader ' + i, cards: [{name: 'Card ' + i, qty: 1}, {name: 'Filler', qty: 98}], power0: 30 + ((i * 13) % 65), b0: 1 + (i % 5)}));
const random = [];
const tracked = () => { const v = rnd(); random.push(v); return v; };
const cases = [];
const run = (name, player, candidates, opts) => {
  const start = random.length;
  const r = chooseQuickOpponent({player, candidates, estimate: power, bracketOf: d => d.b0 ?? null, candidateEligible: () => true, nativeValidationPending: true, random: tracked, ...opts});
  cases.push({name, player: player.id, difficulty: opts.difficulty || 'Medium', streak: opts.streak || 0, sample: opts.sample ?? 40, from: start, to: random.length,
    pick: r.deck.id, candidateCount: r.candidateCount, estimated: r.estimated, wildCard: r.wildCard, power: r.power, bracket: r.bracket, myPower: r.myPower, mirror: r.mirror, reason: r.reason, line: matchupLine(r)});
};
const me = {...deck(999, 'Modern'), name: 'Burn · mine', power0: 71};
for (const difficulty of ['Easy', 'Medium', 'Hard']) for (let k = 0; k < 40; k++) run('modern', me, [...modern, me], {difficulty, streak: [0, 10, -15][k % 3]});
for (let k = 0; k < 20; k++) run('small-sample', me, modern, {difficulty: 'Hard', sample: 12});
const mine = {id: 'mine-c', name: 'My Commander', format: 'Commander', commander: 'My Leader', cards: [{name: 'Mine', qty: 1}, {name: 'Filler', qty: 98}], power0: 64, b0: 2};
for (let k = 0; k < 30; k++) run('commander', mine, cmd, {difficulty: ['Easy', 'Medium', 'Hard'][k % 3]});
const unrated = {...me, power0: null};
for (let k = 0; k < 5; k++) run('unrated', unrated, modern, {});
writeFileSync(out, JSON.stringify({random, decks: {modern, cmd, me, mine, unrated}, cases}, null, 0));
console.log(cases.length, 'cases', random.length, 'numbers', cases.filter(c => c.wildCard).length, 'wild', [...new Set(cases.map(c => c.line))].slice(0, 6));
