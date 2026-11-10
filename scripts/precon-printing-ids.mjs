// Adds the exact Scryfall printing id to every row of data/play-starters/precons.json, from the row's set + collector
// number, so a precon plays and shows the printing it came with (not the newest reprint of each card).
// Run: node scripts/precon-printing-ids.mjs [path to precons.json]   (also called by bake-play-starters.mjs)
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const scry = async (identifiers) => {
  let r;
  for (let t = 0; t < 5; t++) {
    r = await fetch('https://api.scryfall.com/cards/collection', {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'CardStashy/1.0'}, body: JSON.stringify({identifiers})});
    if (r.status !== 429) break;
    await new Promise(ok => setTimeout(ok, 3000 * (t + 1)));
  }
  if (!r.ok) throw Error('Scryfall ' + r.status);
  await new Promise(ok => setTimeout(ok, 120));
  return await r.json();
};
export async function addPrintingIds(rows) {
  const want = [...new Map(rows.map(r => [r.set + ':' + r.number, {set: r.set, collector_number: String(r.number)}])).values()], found = new Map();
  for (let i = 0; i < want.length; i += 70) for (const c of (await scry(want.slice(i, i + 70))).data || []) found.set(c.set + ':' + c.collector_number, c);
  for (const r of rows) { const c = found.get(r.set + ':' + r.number); if (!c) throw Error(`No Scryfall printing for ${r.name} (${r.set} ${r.number})`); r.id = c.id; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] || 'data/play-starters/precons.json', data = JSON.parse(await readFile(file, 'utf8'));
  for (const d of data.decks) await addPrintingIds(d.rows);
  await writeFile(file, JSON.stringify(data, null, 1) + '\n');
  console.log(data.decks.map(d => `${d.name}: ${d.rows.length} rows with ids`).join('\n'));
}
