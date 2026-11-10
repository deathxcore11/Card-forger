#!/usr/bin/env node
// Bakes data/play-starters/precons.json: the ten free precons every Play player gets (Randall 4 Nov
// 00:32Z, "5 60 and 5 commanders", recent official decks). Lists come from the official decklists as
// kept in github.com/taw/magic-preconstructed-decks (clone it, pass its data folder). A card the web
// engine has no rules for yet is swapped for a close stand-in (SWAPS); the native app plays every card.
// Run: node scripts/bake-play-starters.mjs <taw-repo>/data [out]
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';

const PICKS = [
  {key: 'fin-ub', home: 'fin', file: 'starter-kit-std/fin/Blue-Black.txt', name: 'Blue-Black', product: 'Final Fantasy Starter Kit', format: 'Standard', face: "Sephiroth, Planet's Heir", plan: 'Graveyard and removal'},
  {key: 'fin-rw', home: 'fin', file: 'starter-kit-std/fin/Red-White.txt', name: 'Red-White', product: 'Final Fantasy Starter Kit', format: 'Standard', face: "Cloud, Planet's Champion", plan: 'Equipment aggro'},
  {key: 'blb-gw', home: 'blb', file: 'starter-kit-std/blb/Hare Raising.txt', name: 'Hare Raising', product: 'Bloomburrow Starter Kit', format: 'Standard', face: 'Byrke, Long Ear of the Law', plan: 'Rabbit tokens, go wide'},
  {key: 'blb-ur', home: 'blb', file: 'starter-kit-std/blb/Otter Limits.txt', name: 'Otter Limits', product: 'Bloomburrow Starter Kit', format: 'Standard', face: 'Bria, Riptide Rogue', plan: 'Spells and tempo'},
  {key: 'otj-br', home: 'otj', file: 'arena-starter/otj/Outlaw Posse.txt', name: 'Outlaw Posse', product: 'Outlaws of Thunder Junction Starter', format: 'Standard', face: 'Vial Smasher, Gleeful Grenadier', plan: 'Outlaws, drain and burn'},
  {key: 'fic-cloud', home: 'fic', file: 'cmd/fic/Limit Break (FINAL FANTASY VII).txt', name: 'Limit Break', product: 'Final Fantasy Commander', format: 'Commander', face: 'Cloud, Ex-SOLDIER', plan: 'Voltron: suit up one hero'},
  {key: 'fic-yshtola', home: 'fic', file: 'cmd/fic/Scions & Spellcraft (FINAL FANTASY XIV).txt', name: 'Scions & Spellcraft', product: 'Final Fantasy Commander', format: 'Commander', face: "Y'shtola, Night's Blessed", plan: 'Spellslinger'},
  {key: 'tdc-sultai', home: 'tdc', file: 'cmd/tdc/Sultai Arisen.txt', name: 'Sultai Arisen', product: 'Tarkir: Dragonstorm Commander', format: 'Commander', face: 'Teval, the Balanced Scale', plan: 'Graveyard and lands'},
  // Marvel's two beginner Tier 1 picks (Randall 4 Nov 02:10Z) replace Animated Army and Abzan Armor.
  {key: 'msc-wakanda', home: 'msc', file: 'cmd/msc/Wakanda Forever.txt', name: 'Wakanda Forever', product: 'Marvel Super Heroes Commander', format: 'Commander', face: "T'Challa, the Black Panther", plan: 'Ramp into big artifacts'},
  {key: 'msc-avengers', home: 'msc', file: 'cmd/msc/Avengers Assemble.txt', name: 'Avengers Assemble', product: 'Marvel Super Heroes Commander', format: 'Commander', face: 'Captain America, Team Leader', plan: 'Go wide with heroes'},
  // The 2022 Starter Commander Decks (Randall 10 Nov 00:16Z, "could we get these 5 for all players too").
  {key: 'scd-first-flight', home: 'scd', file: 'cmd/scd/First Flight.txt', name: 'First Flight', product: 'Starter Commander Decks', format: 'Commander', face: 'Isperia, Supreme Judge', plan: 'Flyers and counterspells'},
  {key: 'scd-grave-danger', home: 'scd', file: 'cmd/scd/Grave Danger.txt', name: 'Grave Danger', product: 'Starter Commander Decks', format: 'Commander', face: 'Gisa and Geralf', plan: 'Zombies and the graveyard'},
  {key: 'scd-chaos-incarnate', home: 'scd', file: 'cmd/scd/Chaos Incarnate.txt', name: 'Chaos Incarnate', product: 'Starter Commander Decks', format: 'Commander', face: 'Kardur, Doomscourge', plan: 'Goad and make them fight'},
  {key: 'scd-draconic-destruction', home: 'scd', file: 'cmd/scd/Draconic Destruction.txt', name: 'Draconic Destruction', product: 'Starter Commander Decks', format: 'Commander', face: 'Atarka, World Render', plan: 'Dragons and double strike'},
  {key: 'scd-token-triumph', home: 'scd', file: 'cmd/scd/Token Triumph.txt', name: 'Token Triumph', product: 'Starter Commander Decks', format: 'Commander', face: 'Emmara, Soul of the Accord', plan: 'Tokens and go wide'},
];
// Same colours and job, with rules in the web engine (play-card-support.js).
// No stand-ins any more (Randall 10 Nov, app first): every free deck lists its real cards. Engine e5a0f81 plays them all.
const SWAPS = {};

const root = process.argv[2], out = process.argv[3] || new URL('../data/play-starters/precons.json', import.meta.url).pathname;
if (!root) throw Error('Pass the data folder of a magic-preconstructed-decks clone.');

// Every row carries set + collector number (so the deck view finds its art): rows the list has no printing for
// (or a basic land's '*') take the deck's own set, else Scryfall's default printing of that name.
const scry = async (identifiers) => {
  let r;
  for (let t = 0; t < 5; t++) {
    r = await fetch('https://api.scryfall.com/cards/collection', {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'CardStashy/1.0'}, body: JSON.stringify({identifiers})});
    if (r.status !== 429) break;
    await new Promise(ok => setTimeout(ok, 3000 * (t + 1)));
  }
  if (!r.ok) throw Error('Scryfall ' + r.status);
  await new Promise(ok => setTimeout(ok, 120));
  return (await r.json()).data || [];
};
async function printRows(rows, home) {
  const need = rows.filter(r => !r.set || r.number === '*'), front = r => r.name.split(' // ')[0], found = new Map();
  for (const [useSet, label] of [[true, 'home'], [false, 'default']]) {
    const todo = [...new Set(need.filter(r => !found.has(r.name)).map(front))];
    for (let i = 0; i < todo.length; i += 70) for (const c of await scry(todo.slice(i, i + 70).map(name => useSet ? {name, set: home} : {name}))) found.set(c.name, c), found.set(String(c.name).split(' // ')[0], c);
  }
  for (const r of need) { const c = found.get(r.name) || found.get(front(r)); if (!c) throw Error('No printing for ' + r.name); r.set = c.set; r.number = c.collector_number; }
}
const decks = [];
for (const p of PICKS) {
  const text = await readFile(join(root, p.file), 'utf8'), rows = [];
  let side = false, released = '';
  for (const line of text.split('\n')) {
    const date = line.match(/^\/\/ DATE: (\d{4}-\d\d-\d\d)/); if (date) released = date[1];
    if (/^\/\/ ?Sideboard|^Sideboard/i.test(line)) { side = true; continue; }
    if (side || line.startsWith('//') || !line.trim() || /\[token\]/i.test(line)) continue;
    const m = line.match(/^(COMMANDER: )?(\d+) (.+?)((?: \[[^\]]*\])*)$/);
    if (!m) continue;
    const print = (m[4].match(/\[([A-Za-z0-9]+):([^\]]+)\]/) || []), name = SWAPS[m[3].trim()] || m[3].trim();
    rows.push({name, ...(SWAPS[m[3].trim()] ? {was: m[3].trim()} : {}), qty: Number(m[2]), ...(m[1] ? {commander: true} : {}), ...(print[1] && !SWAPS[m[3].trim()] ? {set: print[1].toLowerCase(), number: print[2]} : {})});
  }
  const size = rows.reduce((t, r) => t + r.qty, 0);
  if (size !== (p.format === 'Commander' ? 100 : 60)) throw Error(`${p.name}: ${size} cards`);
  await printRows(rows, p.home);
  const {file, ...meta} = p;
  const {home, ...pub} = meta;
  decks.push({...pub, released, rows});
}
await mkdir(dirname(out), {recursive: true});
await writeFile(out, JSON.stringify({baked: new Date().toISOString().slice(0, 10), source: 'Official decklists via github.com/taw/magic-preconstructed-decks', swaps: SWAPS, decks}, null, 1) + '\n');
console.log(decks.map(d => `${d.name} (${d.format}) ${d.rows.length} rows`).join('\n'));
