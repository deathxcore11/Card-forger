#!/usr/bin/env node
// Bakes data/play-starters/precons.json: the ten free precons every Play player gets (Randall 4 Nov
// 00:32Z, "5 60 and 5 commanders", recent official decks). Lists come from the official decklists as
// kept in github.com/taw/magic-preconstructed-decks (clone it, pass its data folder). A card the web
// engine has no rules for yet is swapped for a close stand-in (SWAPS); the native app plays every card.
// Run: node scripts/bake-play-starters.mjs <taw-repo>/data [out]
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';

const PICKS = [
  {key: 'fin-ub', file: 'starter-kit-std/fin/Blue-Black.txt', name: 'Blue-Black', product: 'Final Fantasy Starter Kit', format: 'Standard', face: "Sephiroth, Planet's Heir", plan: 'Graveyard and removal'},
  {key: 'fin-rw', file: 'starter-kit-std/fin/Red-White.txt', name: 'Red-White', product: 'Final Fantasy Starter Kit', format: 'Standard', face: "Cloud, Planet's Champion", plan: 'Equipment aggro'},
  {key: 'blb-gw', file: 'starter-kit-std/blb/Hare Raising.txt', name: 'Hare Raising', product: 'Bloomburrow Starter Kit', format: 'Standard', face: 'Byrke, Long Ear of the Law', plan: 'Rabbit tokens, go wide'},
  {key: 'blb-ur', file: 'starter-kit-std/blb/Otter Limits.txt', name: 'Otter Limits', product: 'Bloomburrow Starter Kit', format: 'Standard', face: 'Bria, Riptide Rogue', plan: 'Spells and tempo'},
  {key: 'otj-br', file: 'arena-starter/otj/Outlaw Posse.txt', name: 'Outlaw Posse', product: 'Outlaws of Thunder Junction Starter', format: 'Standard', face: 'Vial Smasher, Gleeful Grenadier', plan: 'Outlaws, drain and burn'},
  {key: 'fic-cloud', file: 'cmd/fic/Limit Break (FINAL FANTASY VII).txt', name: 'Limit Break', product: 'Final Fantasy Commander', format: 'Commander', face: 'Cloud, Ex-SOLDIER', plan: 'Voltron: suit up one hero'},
  {key: 'fic-yshtola', file: 'cmd/fic/Scions & Spellcraft (FINAL FANTASY XIV).txt', name: 'Scions & Spellcraft', product: 'Final Fantasy Commander', format: 'Commander', face: "Y'shtola, Night's Blessed", plan: 'Spellslinger'},
  {key: 'tdc-sultai', file: 'cmd/tdc/Sultai Arisen.txt', name: 'Sultai Arisen', product: 'Tarkir: Dragonstorm Commander', format: 'Commander', face: 'Teval, the Balanced Scale', plan: 'Graveyard and lands'},
  {key: 'blc-bello', file: 'cmd/blc/Animated Army.txt', name: 'Animated Army', product: 'Bloomburrow Commander', format: 'Commander', face: 'Bello, Bard of the Brambles', plan: 'Artifacts and enchantments come alive'},
  {key: 'tdc-abzan', file: 'cmd/tdc/Abzan Armor.txt', name: 'Abzan Armor', product: 'Tarkir: Dragonstorm Commander', format: 'Commander', face: 'Felothar the Steadfast', plan: 'Big toughness, walls attack'},
];
// Same colours and job, with rules in the web engine (play-card-support.js).
const SWAPS = {'Summon: Kujata': 'Inferno Titan', 'Papalymo Totolymo': 'Archmage of Runes', 'Afterlife from the Loam': 'Dread Return',
  'Domri, Anarch of Bolas': 'Garruk Wildspeaker', 'Grothama, All-Devouring': 'Craterhoof Behemoth', "Colfenor's Urn": 'Overgrown Battlement'};

const root = process.argv[2], out = process.argv[3] || new URL('../data/play-starters/precons.json', import.meta.url).pathname;
if (!root) throw Error('Pass the data folder of a magic-preconstructed-decks clone.');
const decks = [];
for (const p of PICKS) {
  const text = await readFile(join(root, p.file), 'utf8'), rows = [];
  let side = false, released = '';
  for (const line of text.split('\n')) {
    const date = line.match(/^\/\/ DATE: (\d{4}-\d\d-\d\d)/); if (date) released = date[1];
    if (/^\/\/ ?Sideboard|^Sideboard/i.test(line)) { side = true; continue; }
    if (side || line.startsWith('//') || !line.trim()) continue;
    const m = line.match(/^(COMMANDER: )?(\d+) (.+?)((?: \[[^\]]*\])*)$/);
    if (!m) continue;
    const print = (m[4].match(/\[([A-Za-z0-9]+):([^\]]+)\]/) || []), name = SWAPS[m[3].trim()] || m[3].trim();
    rows.push({name, qty: Number(m[2]), ...(m[1] ? {commander: true} : {}), ...(print[1] && !SWAPS[m[3].trim()] ? {set: print[1].toLowerCase(), number: print[2]} : {})});
  }
  const size = rows.reduce((t, r) => t + r.qty, 0);
  if (size !== (p.format === 'Commander' ? 100 : 60)) throw Error(`${p.name}: ${size} cards`);
  const {file, ...meta} = p;
  decks.push({...meta, released, rows});
}
await mkdir(dirname(out), {recursive: true});
await writeFile(out, JSON.stringify({baked: new Date().toISOString().slice(0, 10), source: 'Official decklists via github.com/taw/magic-preconstructed-decks', swaps: SWAPS, decks}, null, 1) + '\n');
console.log(decks.map(d => `${d.name} (${d.format}) ${d.rows.length} rows`).join('\n'));
