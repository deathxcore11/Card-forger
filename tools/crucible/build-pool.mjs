// Lost Memories (codename crucible): builds the card pool from the same Yu-Gi-Oh card
// source the app uses (ygo.js). No card stats are typed by hand anywhere in this mode.
//
//   node tools/crucible/build-pool.mjs --in <cardinfo.json> [--cutoff 2004-03-07] [--count]
//   node tools/crucible/build-pool.mjs --fetch            (downloads once, then builds)
//
// --count prints the pool size at three candidate cut-offs and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../crucible/data/crucible-pool.json');
const API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes';
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const has = k => args.includes(k);

const TYPES_OUT = new Set(['Link Monster', 'Token', 'Skill Card']);

function firstPrint(c) {
  const m = (c.misc_info || [])[0] || {};
  return m.tcg_date || null;
}

function row(c) {
  const date = firstPrint(c);
  const isMon = /Monster/.test(c.type);
  const sets = c.card_sets || [];
  const base = { id: c.id, name: c.name, date, set: sets.length ? sets[0].set_code.split('-')[0] : null, rarity: sets.length ? sets[0].set_rarity : null };
  if (isMon) {
    if (typeof c.atk !== 'number' || typeof c.def !== 'number' || c.atk < 0 || c.def < 0) return null;
    const lvl = c.level || c.rank || 0;
    if (!lvl) return null;
    const kind = c.frameType === 'fusion' ? 'fusion' : 'monster';
    const r = { ...base, kind, type: c.race, attr: c.attribute, level: lvl, atk: c.atk, def: c.def };
    if (/ritual/.test(c.frameType)) r.ritual = true;
    if (kind === 'fusion') r.materialsText = String(c.desc || '').split(/\r?\n/)[0];
    return r;
  }
  if (c.type === 'Spell Card') {
    const kind = c.race === 'Field' ? 'field' : c.race === 'Equip' ? 'equip' : 'spell';
    return { ...base, kind };
  }
  if (c.type === 'Trap Card') return { ...base, kind: 'trap' };
  return null;
}

function parseMaterials(text, byName) {
  // Classic Fusion Monsters print their materials as: "A" + "B" (+ "C").
  const parts = text.replace(/[“”]/g, '"').split(/\s\+\s/).map(s => s.trim().replace(/^"|"$/g, '').replace(/"$/, ''));
  if (parts.length < 2 || parts.length > 3) return null;
  const ids = parts.map(n => byName.get(n.toLowerCase()));
  return ids.every(Boolean) ? ids : null;
}

function build(data, cutoff) {
  const rows = [];
  for (const c of data) {
    if (TYPES_OUT.has(c.type) || !/[A-Za-z]/.test(c.name)) continue;
    if (!c.card_images || !c.card_images.length) continue;
    const r = row(c);
    if (!r || !r.date || r.date > cutoff) continue;
    rows.push(r);
  }
  rows.sort((a, b) => a.id - b.id);
  const byName = new Map(rows.filter(r => r.kind !== 'fusion').map(r => [r.name.toLowerCase(), r.id]));
  let fusionsOk = 0;
  for (const r of rows) {
    if (r.kind !== 'fusion') continue;
    const m = parseMaterials(r.materialsText, byName);
    delete r.materialsText;
    if (m) { r.materials = m; fusionsOk++; }
  }
  return { rows, fusionsOk };
}

function counts(rows, fusionsOk) {
  const n = k => rows.filter(r => r.kind === k).length;
  const cells = new Map();
  for (const r of rows) if (r.kind === 'monster') { const k = r.type + '|' + r.attr; cells.set(k, (cells.get(k) || 0) + 1); }
  const types = new Set(rows.filter(r => r.kind === 'monster').map(r => r.type));
  const attrs = new Set(rows.filter(r => r.kind === 'monster').map(r => r.attr));
  const total = types.size * attrs.size;
  const hist = [0, 0, 0, 0];
  for (const v of cells.values()) hist[Math.min(v, 3)]++;
  hist[0] = total - cells.size;
  return { monsters: n('monster'), fusions: n('fusion'), fusionsWithAllMaterials: fusionsOk, field: n('field'), equip: n('equip'), spells: n('spell'), traps: n('trap'), total: rows.length, cells: { empty: hist[0], one: hist[1], two: hist[2], threePlus: hist[3] } };
}

async function main() {
  let src = arg('--in');
  if (has('--fetch')) {
    src = path.resolve(HERE, '.cache-cardinfo.json');
    if (!fs.existsSync(src)) { const res = await fetch(API); if (!res.ok) throw new Error('card source ' + res.status); fs.writeFileSync(src, await res.text()); }
  }
  if (!src) { console.error('need --in <file> or --fetch'); process.exit(2); }
  const data = JSON.parse(fs.readFileSync(src, 'utf8')).data;
  if (has('--count')) {
    for (const [label, cut] of [['year 1', '2003-03-07'], ['year 2', '2004-03-07'], ['year 3', '2005-03-07']]) {
      const { rows, fusionsOk } = build(data, cut);
      console.log(label, cut, JSON.stringify(counts(rows, fusionsOk)));
    }
    return;
  }
  const cutoff = arg('--cutoff', '2004-03-07');
  const { rows, fusionsOk } = build(data, cutoff);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ cutoff, source: 'db.ygoprodeck.com/api/v7 (the app\'s Yu-Gi-Oh card source)', cards: rows }) + '\n');
  console.log('wrote', OUT, JSON.stringify(counts(rows, fusionsOk)));
}
main();
