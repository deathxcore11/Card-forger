// How often each Story deed is earned in Forge self-play: of the games its seat won, the share that
// met the deed's test. Usage: node scripts/story/sim/deed-rates.mjs <facts.jsonl> [--md out.md]
// A deed nobody earns is broken or too hard; one every win earns is free. Bands: battle deeds 15-70%,
// hidden deeds under 20% (or never seen in 10 games), villain deeds judged on the villain's wins.
import {readFileSync, writeFileSync} from 'node:fs';
import {STORY_DEEDS} from '../../../story-deeds.js';
import {factsMeet} from '../../../match-facts.js';
const [file, ...rest] = process.argv.slice(2), md = rest[rest.indexOf('--md') + 1] && rest.includes('--md') ? rest[rest.indexOf('--md') + 1] : null;
const games = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const by = new Map(); for (const g of games) { if (!by.has(g.battle)) by.set(g.battle, []); by.get(g.battle).push(g); }
const rows = [];
for (const d of STORY_DEEDS) {
  const list = by.get(d.battle); if (!list) continue;
  const seat = d.seat === 'villain' ? 1 : 0, wins = list.filter(g => g.winner === seat);
  const hit = wins.filter(g => factsMeet(d.seat === 'villain' ? g.villain : g.hero, d.when)).length;
  const rate = wins.length ? hit / wins.length : null;
  const band = d.gold ? 'gold' : d.hidden ? (rate === null || rate <= 0.2 ? 'ok' : 'easy') : rate === null ? 'no wins' : rate < 0.15 ? 'hard' : rate > 0.7 ? 'easy' : 'ok';
  rows.push({id: d.id, battle: d.battle, seat: d.seat, games: list.length, wins: wins.length, hit, rate, band});
}
const pct = r => r === null ? '–' : Math.round(r * 100) + '%';
const lines = ['| Deed | Battle | Seat | Seat wins | Earned | Rate | Band |', '|---|---|---|---|---|---|---|', ...rows.map(r => `| ${r.id} | ${r.battle} | ${r.seat} | ${r.wins}/${r.games} | ${r.hit} | ${pct(r.rate)} | ${r.band} |`)];
if (md) writeFileSync(md, lines.join('\n') + '\n');
for (const r of rows) if (r.band !== 'ok' && r.band !== 'gold') console.log(r.band.padEnd(8), r.id.padEnd(22), r.battle.padEnd(6), `${r.hit}/${r.wins}`, pct(r.rate));
console.log(`${rows.length} deeds measured over ${games.length} games; ${rows.filter(r => r.band === 'ok').length} in band`);
