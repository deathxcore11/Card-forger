// Turns the locked roster plan (roster-plan.md, exported by the block roster thread; kept outside the repo) into game data: src/data/roster-plan.gen.js.
// Only the plan's tables and named lists are read; nothing is invented. Re-run whenever the plan file grows (the 320-basic set is coming).
//   node tools/roster-import.mjs "<path to roster-plan.md>" ["<path to index.json>"] ["<path to roster-320.md>"]
import { readFileSync, writeFileSync } from 'node:fs';
const [planPath, indexPath, bigPath] = process.argv.slice(2);
if (!planPath) { console.log('usage: node tools/roster-import.mjs <roster-plan.md> [index.json]'); process.exit(1); }
const md = readFileSync(planPath, 'utf8').split(/\r?\n/), index = indexPath ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
const slug = s => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = s => s.replace(/\(have\)/i, '').replace(/\s*\((?!have)[^)]*\)\s*$/, '').trim();
const note = s => { const m = /\((?!have)([^)]*)\)/i.exec(s); return m ? m[1] : ''; };
// every markdown table, with the heading it sits under
const tables = []; let head = '';
for (let i = 0; i < md.length; i++) {
  if (/^#+\s/.test(md[i])) head = md[i].replace(/^#+\s*/, '');
  if (/^\|/.test(md[i]) && /^\|\s*-{3}/.test(md[i + 1] || '')) { const cols = md[i].split('|').slice(1, -1).map(s => s.trim()), rows = []; let j = i + 2; for (; j < md.length && /^\|/.test(md[j]); j++) rows.push(md[j].split('|').slice(1, -1).map(s => s.trim())); tables.push({ head, cols, rows }); i = j - 1; }
}
const byCols = (...names) => tables.filter(t => names.every(n => t.cols.includes(n)));
const modelOf = name => { const n = clean(name).toLowerCase(), m = index.find(e => (e.name || '').toLowerCase().replace(/,.*$/, '') === n); return m ? m.id : ''; };
const RAR = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'epic' };
// basics: Element | Monster | Rarity | Job | What it does | Fuses with
const basics = [];
for (const t of byCols('Element', 'Monster', 'Rarity', 'Job')) for (const r of t.rows) { const c = Object.fromEntries(t.cols.map((k, i) => [k, r[i]])); basics.push({ id: slug(clean(c.Monster)), name: clean(c.Monster), species: note(c.Monster), have: /\(have\)/i.test(c.Monster), element: c.Element.toLowerCase(), rarity: RAR[c.Rarity.toLowerCase()] || c.Rarity.toLowerCase(), job: c.Job, text: c['What it does'], partner: slug(clean(c['Fuses with'] || '')), model: modelOf(c.Monster) }); }
// fusions: Fusion | Parents | Elements | What it does
const fusions = [];
for (const t of byCols('Fusion', 'Parents')) for (const r of t.rows) { const c = Object.fromEntries(t.cols.map((k, i) => [k, r[i]])); fusions.push({ id: slug(c.Fusion), name: c.Fusion, parents: c.Parents.split('+').map(s => slug(s.trim())), elements: c.Elements.toLowerCase().split(/,\s*/), text: c['What it does'] || '', model: modelOf(c.Fusion) }); }
// the Fusions the plan says you already have (named in prose)
const haveF = (md.join('\n').match(/The nine you have stay: ([^.]+)\./) || [])[1];
if (haveF) for (const n of haveF.replace(/ and /, ', ').split(/,\s*/)) { const id = slug(n); if (!fusions.some(f => f.id === id)) fusions.push({ id, name: n.trim(), parents: [], elements: [], text: '', have: true, model: modelOf(n) }); }
// gods: God Fusion | Parents | Elements
const gods = [];
for (const t of byCols('God Fusion', 'Parents')) for (const r of t.rows) { const c = Object.fromEntries(t.cols.map((k, i) => [k, r[i]])); gods.push({ id: slug(c['God Fusion']), name: c['God Fusion'], parents: c.Parents.split('+').map(s => slug(s.trim())), elements: c.Elements.toLowerCase().split(/,\s*/), model: modelOf(c['God Fusion']) }); }
// secrets: "Name (A + B)" in prose
const secrets = []; for (const m of md.join('\n').matchAll(/([A-Z][A-Za-z' ]+?) \(([A-Z][A-Za-z' ]+?) \+ ([A-Z][A-Za-z' ]+?)\)/g)) { const name = m[1].replace(/^(The new Secrets are|The two extra Secrets are|are|and)\s+/i, '').replace(/^.*(?:are|and) /, '').trim(); if (gods.some(g => g.id === slug(m[2])) || gods.some(g => g.id === slug(m[3]))) secrets.push({ id: slug(name), name, parents: [slug(m[2]), slug(m[3])], hidden: true }); }
// items: Item | Rarity | What it does
const items = []; for (const t of byCols('Item', 'Rarity')) for (const r of t.rows) { const c = Object.fromEntries(t.cols.map((k, i) => [k, r[i]])); items.push({ id: slug(c.Item), name: c.Item, rarity: c.Rarity.toLowerCase(), text: c['What it does'] }); }
const itemRules = []; for (const t of byCols('Rarity', 'Offer odds')) for (const r of t.rows) { const c = Object.fromEntries(t.cols.map((k, i) => [k, r[i]])); itemRules.push({ rarity: c.Rarity.toLowerCase(), count: +c.Count, odds: parseFloat(c['Offer odds']), job: c['What it is'], stacking: c.Stacking }); }
// boon lines: Line | What its boons push | Capstone boon
const boonLines = []; for (const t of byCols('Line', 'Capstone boon (the fourth)')) for (const r of t.rows) { const names = r[0].split(/,\s*/); for (const n of names) boonLines.push({ id: slug(n), name: n, push: r[1], capstone: r[2] }); }
// builds: Build | Core pieces | Why it breaks | What stops it
const builds = []; for (const t of byCols('Build', 'Core pieces')) for (const r of t.rows) builds.push({ name: r[0], pieces: r[1].split(/,\s*/), why: r[2], counter: r[3] });
// enemies: Attack type | Have | New | What it asks of you
const enemyTypes = []; for (const t of byCols('Attack type', 'Have', 'New')) for (const r of t.rows) { const nw = r[2] ? r[2].split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean) : []; enemyTypes.push({ type: r[0], have: r[1] ? r[1].split(/,\s*/) : [], new: nw.map(s => ({ id: slug(clean(s)), name: clean(s), note: note(s) })), asks: r[3] }); }
// ---- the grown set (roster-320.md): families of eight, a trait each, four Fusions per family from the pairs, a family God, cross Gods and element Secrets ----
const families = [], big = { budgetText: '' };
for (const b of basics) b.family = 'core-' + b.element;
for (const el of ['fire', 'lightning', 'ice', 'light', 'dark', 'earth', 'poison', 'wind']) families.push({ id: 'core-' + el, name: 'Core', element: el, trait: '', core: true });
if (bigPath) {
  const L = readFileSync(bigPath, 'utf8').split(/\r?\n/), txt = L.join('\n');
  big.budgetText = (txt.match(/Point budget:[^\n]+/) || [''])[0];
  let fam = null;
  for (let i = 0; i < L.length; i++) {
    const h = /^###\s+(\w+):\s+the (.+) family/.exec(L[i]); if (h) { fam = { id: slug(h[2]), name: h[2], element: h[1].toLowerCase(), trait: '' }; families.push(fam); continue; }
    if (!fam) continue;
    const tr = /^Family trait:\s*(.+)$/.exec(L[i]); if (tr) fam.trait = tr[1].trim();
    if (/^\| Monster \|/.test(L[i])) { const cols = L[i].split('|').slice(1, -1).map(s => s.trim()); for (let j = i + 2; j < L.length && /^\|/.test(L[j]); j++) { const r = L[j].split('|').slice(1, -1).map(s => s.trim()), c = Object.fromEntries(cols.map((k, n) => [k, r[n]]));
      basics.push({ id: slug(clean(c.Monster)), name: clean(c.Monster), species: note(c.Monster), have: false, element: fam.element, family: fam.id, rarity: c.Rarity.toLowerCase(), job: c.Job, text: c['What it does'], partner: slug(clean(c['Fuses with'] || '')), into: slug(c.Into || ''), model: modelOf(c.Monster) }); } }
    if (/^\| Fusion \| What it does/.test(L[i])) for (let j = i + 2; j < L.length && /^\|/.test(L[j]); j++) { const r = L[j].split('|').slice(1, -1).map(s => s.trim()), id = slug(r[0]), ps = basics.filter(b => b.into === id).map(b => b.id); fusions.push({ id, name: r[0], parents: ps, elements: [fam.element], family: fam.id, text: r[1], model: modelOf(r[0]) }); }
    const gd = /^Family God:\s*\*\*(.+?)\*\*\s*\((.+?) \+ (.+?)\)/.exec(L[i]); if (gd) gods.push({ id: slug(gd[1]), name: gd[1], parents: [slug(gd[2]), slug(gd[3])], elements: [fam.element], family: fam.id, model: modelOf(gd[1]) });
  }
  const pairs = label => { const m = txt.match(new RegExp('^' + label + ':(.+)$', 'm')); return m ? [...m[1].matchAll(/([^,(]+?) \(([^+]+?) \+ ([^)]+?)\)/g)].map(x => ({ name: x[1].trim().replace(/^and /, ''), a: x[2].trim(), b: x[3].trim() })) : []; };
  for (const g of pairs('Cross Gods')) { const pe = [slug(g.a), slug(g.b)].map(id => basics.find(b => b.id === id)); gods.push({ id: slug(g.name), name: g.name, parents: [slug(g.a), slug(g.b)], elements: [...new Set(pe.filter(Boolean).map(b => b.element))], cross: true, model: modelOf(g.name) }); }
  for (const s of pairs('Secrets')) secrets.push({ id: slug(s.name), name: s.name, parents: [slug(s.a), slug(s.b)], hidden: true });
}
const out = { source: bigPath ? 'roster-plan.md + roster-320.md' : 'roster-plan.md', budgetText: big.budgetText, families, basics, fusions, gods, secrets, items, itemRules, boonLines, builds, enemyTypes };
const text = '// GENERATED by tools/roster-import.mjs from the locked roster plan (27 Nov). Do not edit by hand: re-run the importer when the plan grows.\n// Plain data only; the rules that use it are in src/data/roster.js.\nexport const PLAN = ' + JSON.stringify(out, null, 1) + ';\n';
writeFileSync(new URL('../src/data/roster-plan.gen.js', import.meta.url), text);
console.log(JSON.stringify({ basics: basics.length, fusions: fusions.length, gods: gods.length, secrets: secrets.length, items: items.length, itemRules: itemRules.length, boonLines: boonLines.length, builds: builds.length, enemyTypes: enemyTypes.length, newEnemies: enemyTypes.reduce((a, t) => a + t.new.length, 0), basicsWithModel: basics.filter(b => b.model).length }));
