// Runs the Story deck gates (deck-gates.mjs) over a plain decklist before it becomes part of an act,
// e.g. a road-map draft. Each card takes its first printing in the given sets; basics come from --land.
// Usage: node scripts/story/validate-list.mjs --pool /tmp/story/pool-18.json --label tribute [--era 2011-07-01] [--forge-root /tmp/fe/root] list.txt [more.txt ...]
// List lines: "4 Card Name". Exit 1 if any list fails.
import {readFileSync, existsSync} from 'node:fs';
import {checkDeck, eraFormat, BASIC} from './deck-gates.mjs';
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const poolFile = JSON.parse(readFileSync(opt('--pool'), 'utf8'));
const act = {sets: poolFile.sets, eraSets: poolFile.eraSets || [], landSet: poolFile.landSet};
const pool = poolFile.cards.filter(c => !/[a-z]$/.test(c.number) || /^\d+a$/.test(c.number));
const byKey = new Map(pool.map(c => [c.set + '#' + c.number, c]));
const forgeRoot = opt('--forge-root') || (existsSync('/tmp/fe/root') ? '/tmp/fe/root' : null), era = eraFormat(forgeRoot, opt('--era'));
const files = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
let bad = 0;
for (const f of files) {
  const cards = [], unknown = [];
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(.+)$/); if (!m) continue;
    const hits = pool.filter(c => c.name === m[2] || c.name.split(' // ')[0] === m[2]);
    const order = BASIC.test(m[2]) ? [act.landSet] : [...act.sets, ...act.eraSets];
    hits.sort((a, b) => (order.indexOf(a.set) + 1 || 99) - (order.indexOf(b.set) + 1 || 99) || parseInt(a.number) - parseInt(b.number));
    if (!hits.length) { unknown.push(m[2]); continue; }
    cards.push({qty: +m[1], name: hits[0].name, set: hits[0].set, number: hits[0].number});
  }
  const r = checkDeck({label: opt('--label') || 'tribute', cards}, {pool: byKey, act, forgeRoot, era});
  for (const u of unknown) r.fail.unshift(`identity: "${u}" is not printed in ${act.sets.join(', ')}`);
  if (r.fail.length) bad++;
  console.log(`${r.fail.length ? 'FAIL' : 'PASS'} ${f} (${r.total} cards, ${r.lands} lands)` + r.fail.map(x => '\n   FAIL ' + x).join('') + r.warn.map(x => '\n   warn ' + x).join(''));
}
process.exit(bad ? 1 : 0);
