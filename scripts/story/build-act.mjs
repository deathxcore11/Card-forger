// Builds data/story/act-<n>.json from scripts/story/acts-src/act-<n>.mjs: every card name and
// portrait is locked to an exact printing (set + collector number + Scryfall id) from the act's
// pool. Order of preference: the deck's own `prefer` sets, then the act's set order. Basic lands
// always come from the act's land set. Unknown names stop the build.
import {readFileSync, writeFileSync} from 'node:fs';
import {storyAct} from '../../story-acts.js';
const n = Number(process.argv[2]), act = storyAct(n);
const src = (await import(`./acts-src/act-${n}.mjs`)).default;
const pool = JSON.parse(readFileSync(`/tmp/story/pool-${n}.json`, 'utf8')).cards.filter(c => !/^(?:A-|)$/.test('x'));
const BASIC = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest)$/;
const missing = [];
// Alpha printed on cards with rounded black corners; Beta and Unlimited share the same paintings.
// The first printing of a card in the act's sets wins unless the deck asks otherwise.
function pick(name, prefer = []) {
  const all = pool.filter(c => c.name === name && !/[a-z]$/.test(c.number) || c.name === name && /^\d+a$/.test(c.number));
  const hits = all.length ? all : pool.filter(c => c.name === name);
  if (!hits.length) { missing.push(name); return null; }
  const order = BASIC.test(name) ? [act.landSet] : [...prefer, ...act.sets];
  hits.sort((a, b) => (order.indexOf(a.set) + 1 || 99) - (order.indexOf(b.set) + 1 || 99) || parseInt(a.number) - parseInt(b.number));
  const h = hits[0];
  if (BASIC.test(name) && h.set !== act.landSet) missing.push(name + ' (no ' + act.landSet + ' printing)');
  return h;
}
const deck = (d) => {
  const cards = [];
  for (const line of d.list.trim().split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(.+?)(?:\s+\[(\w+)\])?$/); if (!m) continue;
    const c = pick(m[2], m[3] ? [m[3]] : d.prefer); if (!c) continue;
    const same = cards.find(x => x.id === c.id);
    if (same) same.qty += +m[1]; else cards.push({qty: +m[1], name: c.name, set: c.set, number: c.number, id: c.id});
  }
  return {name: d.name, colors: d.colors, archetype: d.archetype || null, cards};
};
// A character's face may come from a later card that paints them (Urza, Prince of Kroog): `fixed` names that exact printing.
const face = (p) => { if (p.fixed) return {...p.fixed, focus: p.focus || '50% 30%'}; const c = p.number ? pool.find(x => x.name === p.card && x.number === p.number && (!p.set || x.set === p.set)) || pick(p.card, p.prefer || []) : pick(p.card, p.prefer || []); return c ? {card: c.name, set: c.set, number: c.number, id: c.id, crop: c.art, artist: c.artist, focus: p.focus || '50% 30%'} : null; };
const out = {act: n, title: act.title, years: act.years, sets: act.sets, landSet: act.landSet, intro: src.intro, finale: src.finale, cast: {}, battles: []};
for (const [k, p] of Object.entries(src.cast)) out.cast[k] = {name: p.name, title: p.title || '', portrait: face(p)};
for (const b of src.battles) {
  out.battles.push({id: `a${n}b${b.slot}`, slot: b.slot, kind: b.kind, title: b.title, difficulty: b.difficulty, teaches: b.teaches, blurb: b.blurb,
    rewardSet: b.rewardSet, host: b.slot === 8,
    hero: {who: b.hero.who, deck: deck(b.hero.deck)}, villain: {who: b.villain.who, deck: deck(b.villain.deck)},
    scene: b.scene, villainScene: b.villainScene || null, cues: b.cues, bigPlays: b.bigPlays || [], sim: b.sim || null});
}
if (missing.length) { console.error('MISSING:', [...new Set(missing)].join(' | ')); process.exit(1); }
writeFileSync(new URL(`../../data/story/act-${n}.json`, import.meta.url), JSON.stringify(out, null, 1));
const legal = [...new Set(pool.filter(c => c.forge && !['banned', 'not_legal'].includes(c.vintage)).map(c => c.name))].sort();
writeFileSync(new URL(`../../data/story/pool-${n}.json`, import.meta.url), JSON.stringify(legal));
console.log('built act', n, out.battles.length, 'battles');
