// The Story deck checker (story-mode-acts.md D1 step 4, D5). No deck ships without passing it.
// Usage: node scripts/story/check-story-deck.mjs <act> [--pool /tmp/story/pool-<act>.json] [--sim-dir /tmp/story/sim-<act>]
// Checks, per seat of every battle in data/story/act-<act>.json:
//  - exactly 60 cards, at most 4 of a name (basic lands unlimited);
//  - every row is a (set, number) pair in the act's pool, and the name matches Scryfall's for that pair;
//  - the set is one of the act's sets; basic lands come from the act's land set;
//  - the card is in Forge's supported list and legal in Vintage (the format Story matches run in);
//  - the printing id stored for the table art is that same Scryfall printing.
// With --sim-dir it also writes one "qty|name|SET" file per seat for StorySim (Forge legality + self-play).
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {storyAct} from '../../story-acts.js';
const args = process.argv.slice(2), act = storyAct(args[0]);
if (!act) throw Error('usage: check-story-deck.mjs <act>');
const opt = k => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : null; };
const pool = JSON.parse(readFileSync(opt('--pool') || `/tmp/story/pool-${act.act}.json`, 'utf8')).cards;
const data = JSON.parse(readFileSync(new URL(`../../data/story/act-${act.act}.json`, import.meta.url), 'utf8'));
const byKey = new Map(pool.map(c => [c.set + '#' + c.number, c]));
const BASIC = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest)$/;
const simDir = opt('--sim-dir'); if (simDir) mkdirSync(simDir, {recursive: true});
let failures = 0;
const report = [];
for (const b of data.battles) for (const seat of ['hero', 'villain']) {
  const deck = b[seat]?.deck, errs = [], warns = [];
  if (!deck?.cards?.length) { errs.push('no deck'); }
  const counts = new Map(); let total = 0;
  for (const r of deck?.cards || []) {
    const c = byKey.get(r.set + '#' + r.number);
    total += r.qty;
    if (!c) { errs.push(`not in pool: ${r.name} ${r.set} #${r.number}`); continue; }
    if (c.name !== r.name) errs.push(`name mismatch ${r.set} #${r.number}: wrote "${r.name}", Scryfall says "${c.name}"`);
    if (!act.sets.includes(r.set)) errs.push(`set outside act: ${r.set}`);
    if (!c.forge) errs.push(`not in Forge: ${c.name}`);
    if (['banned', 'not_legal'].includes(c.vintage)) errs.push(`not Vintage legal: ${c.name}`);
    if (c.vintage === 'restricted' && r.qty > 1) errs.push(`restricted, max 1: ${c.name}`);
    if (r.id && r.id !== c.id) errs.push(`printing id mismatch: ${c.name}`);
    if (BASIC.test(c.name)) { if (r.set !== act.landSet) errs.push(`basic land from ${r.set}, must be ${act.landSet}`); }
    else counts.set(c.name, (counts.get(c.name) || 0) + r.qty);
  }
  if (total !== 60) errs.push(`deck has ${total} cards, needs 60`);
  for (const [n, q] of counts) if (q > 4) errs.push(`${q} copies of ${n}`);
  const lands = (deck?.cards || []).filter(r => /Land/.test(byKey.get(r.set + '#' + r.number)?.type || '')).reduce((t, r) => t + r.qty, 0);
  if (lands < 16 || lands > 26) warns.push(`${lands} lands`);
  if (errs.length) failures++;
  report.push({battle: b.id, seat, deck: deck?.name, ok: !errs.length, errs, warns, lands});
  if (simDir && deck) writeFileSync(`${simDir}/${b.id}-${seat}.txt`, deck.cards.map(r => `${r.qty}|${r.name}|${r.set.toUpperCase()}`).join('\n') + '\n');
}
for (const r of report) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.battle} ${r.seat.padEnd(7)} ${r.deck} (${r.lands} lands)${r.errs.length ? '\n   ' + r.errs.join('\n   ') : ''}${r.warns.length ? '  warn: ' + r.warns.join(', ') : ''}`);
console.log(failures ? `${failures} deck(s) FAILED` : `all ${report.length} decks pass`);
process.exit(failures ? 1 : 0);
