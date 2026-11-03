// The Story deck checker (story-mode-acts.md D1 step 4, D5). No deck ships without passing it.
// Usage: node scripts/story/check-story-deck.mjs <act> [--pool /tmp/story/pool-<act>.json] [--forge-root /tmp/fe/root] [--sim-dir /tmp/story/sim-<act>]
// Runs every gate in deck-gates.mjs over both seats of every battle in data/story/act-<act>.json:
// identity, era, build (60, 4-of, Vintage), the era's own banned and restricted list, Forge support and
// AI flags, mana sources, a way to win, and an honest label. Any FAIL stops the build; WARNs are printed.
// With --sim-dir it also writes one "qty|name|SET" file per seat for StorySim (Forge legality + self-play).
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {storyAct} from '../../story-acts.js';
import {checkDeck, eraFormat, LABELS} from './deck-gates.mjs';
const args = process.argv.slice(2), act = storyAct(args[0]);
if (!act) throw Error('usage: check-story-deck.mjs <act>');
const opt = k => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : null; };
const pool = JSON.parse(readFileSync(opt('--pool') || `/tmp/story/pool-${act.act}.json`, 'utf8')).cards;
const data = JSON.parse(readFileSync(new URL(`../../data/story/act-${act.act}.json`, import.meta.url), 'utf8'));
const forgeRoot = opt('--forge-root') || (existsSync('/tmp/fe/root') ? '/tmp/fe/root' : null);
const byKey = new Map(pool.map(c => [c.set + '#' + c.number, c]));
// Desktop Forge knows Kamigawa flip cards by their front face only (the app's engine takes either).
const simName = (x) => /^(chk|bok|sok)$/.test(x.set) ? x.name.split(' // ')[0] : x.name;
const simDir = opt('--sim-dir'); if (simDir) mkdirSync(simDir, {recursive: true});
let failures = 0, warnings = 0;
for (const b of data.battles) {
  const era = eraFormat(forgeRoot, b.era || data.era);
  for (const seat of ['hero', 'villain']) {
    const deck = b[seat]?.deck, r = checkDeck(deck, {pool: byKey, act, forgeRoot, era});
    if (r.fail.length) failures++;
    warnings += r.warn.length;
    console.log(`${r.fail.length ? 'FAIL' : 'PASS'} ${b.id} ${seat.padEnd(7)} ${deck?.name} [${LABELS[deck?.label] || 'no label'}] (${r.lands} lands)`
      + r.fail.map(x => '\n   FAIL ' + x).join('') + r.warn.map(x => '\n   warn ' + x).join(''));
    if (simDir && deck) writeFileSync(`${simDir}/${b.id}-${seat}.txt`, deck.cards.map(x => `${x.qty}|${simName(x)}|${x.set.toUpperCase()}`).join('\n') + '\n');
  }
}
console.log(failures ? `${failures} deck(s) FAILED` : `all ${data.battles.length * 2} decks pass (${warnings} warnings)`);
process.exit(failures ? 1 : 0);
