// Deck emblems for Play deck tiles (Randall 4 Nov 00:19Z, "deck emblems like mana and meta"): the
// deck's mana colours, its plan in one word (Burn, Drain, Fliers, Control…) read from what its cards do, and, when it is close
// to a tournament list of its format, that list's archetype. Pure: the app hands in card facts
// (name -> Scryfall card) and the format's meta lists (the same ones the deck finder ranks).
// Shared copies over all copies (deckpower.js overlap), kept here so this file stays pure.
const overlap = (a, b) => { let num = 0, den = 0; for (const k of new Set([...a.keys(), ...b.keys()])) { const x = a.get(k) || 0, y = b.get(k) || 0; num += Math.min(x, y); den += Math.max(x, y); } return den ? num / den : 0; };

const BASIC_COLOR = {Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G', 'Snow-Covered Plains': 'W', 'Snow-Covered Island': 'U', 'Snow-Covered Swamp': 'B', 'Snow-Covered Mountain': 'R', 'Snow-Covered Forest': 'G'};
const typeOf = c => c?.type_line || c?.card_faces?.[0]?.type_line || '';
const textOf = c => c?.oracle_text || (c?.card_faces || []).map(f => f.oracle_text || '').join('\n');
const RAMP = /\badd \{|search your library for (?:a|up to \w+) (?:basic )?(?:land|plains|island|swamp|mountain|forest)/i;
// What a card does for the deck's plan, read from its rules text (one count per copy).
const PLAN = {
  lifegain: /\bgain (?:\d+|x|that much) life|\blifelink\b|whenever you gain life/i,
  drain: /(?:each opponent|target opponent|that player|defending player) loses \d+ life|opponent loses (?:\d+|x|that much) life/i,
  burn: /deals? (?:\d+|x) damage to (?:any target|each opponent|target (?:player|opponent))/i,
  removal: /\b(?:destroy|exile) target (?:creature|nonland permanent|permanent)|deals? (?:\d+|x) damage to (?:any target|target creature)|target creature gets -\d+\/-\d+/i,
  counter: /\bcounter target\b/i,
  bounce: /return target (?:creature|nonland permanent)[^.]*to (?:its|their) owner'?s? hand/i,
  tokens: /\bcreate (?:a|an|two|three|four|x|\d+) [^.]*token/i,
  draw: /\bdraw (?:a|two|three|\d+) cards?/i,
};
// The deck's plan in one word, from what most of its spells do. Ties go to the earlier rule.
function planOf(n, {nonland, creatures, avg, flyers, ramp}) {
  const share = nonland ? creatures / nonland : 0, at = k => (n[k] || 0) / Math.max(1, nonland);
  if (ramp >= 8 && avg >= 3) return 'Ramp';
  if (at('burn') >= 0.25) return 'Burn';
  if (at('drain') >= 0.2) return 'Drain';
  if (at('lifegain') >= 0.3) return 'Lifegain';
  if (at('counter') + at('bounce') >= 0.15 && flyers >= creatures * 0.4) return 'Tempo';
  if (creatures && flyers >= creatures * 0.5) return 'Fliers';
  if (at('tokens') >= 0.25) return 'Go wide';
  if (share < 0.3 && at('removal') + at('counter') + at('draw') >= 0.35) return 'Control';
  if (avg >= 3.8) return 'Big';
  if (avg <= 2.4 && share >= 0.6) return 'Aggro';
  if (creatures >= 20 && avg <= 3) return 'Creatures';
  return 'Midrange';
}
// A tournament list counts as this deck's archetype when they share most of the same cards.
export const META_MATCH = 0.55;

export function deckEmblem(rows = [], cardOf = () => null, metaLists = []) {
  const main = rows.filter(r => r?.name && r.board !== 'side');
  const colors = new Set();
  let nonland = 0, creatures = 0, mv = 0, ramp = 0, known = 0, flyers = 0;
  const n = {};
  for (const r of main) {
    const qty = Math.max(1, r.qty | 0), basic = BASIC_COLOR[r.name], c = cardOf(r.name);
    if (basic) { colors.add(basic); continue; }
    if (!c) continue;
    for (const k of c.color_identity || []) if (k !== 'C') colors.add(k);
    const t = typeOf(c);
    if (/\bLand\b/.test(t)) continue;
    known += qty; nonland += qty; mv += (Number(c.cmc) || 0) * qty;
    if (/Creature/.test(t)) creatures += qty;
    const text = textOf(c);
    if (RAMP.test(text)) ramp += qty;
    if (/Creature/.test(t) && /\bflying\b/i.test(text)) flyers += qty;
    for (const [k, rx] of Object.entries(PLAN)) if (rx.test(text)) n[k] = (n[k] || 0) + qty;
  }
  const avg = nonland ? mv / nonland : 0;
  // Needs most of the deck's cards loaded before it names a style.
  const want = main.filter(r => !BASIC_COLOR[r.name]).reduce((t, r) => t + Math.max(1, r.qty | 0), 0);
  const style = !nonland || known < want * 0.7 ? '' : planOf(n, {nonland, creatures, avg, flyers, ramp});
  let meta = null;
  if (metaLists.length) {
    const mine = new Map(), key = n => String(n).toLowerCase();
    for (const r of main) if (!BASIC_COLOR[r.name]) mine.set(key(r.name), (mine.get(key(r.name)) || 0) + Math.max(1, r.qty | 0));
    for (const l of metaLists) {
      const theirs = new Map();
      for (const r of l.cards || []) if (!BASIC_COLOR[r.name] && r.board !== 'side') theirs.set(key(r.name), (theirs.get(key(r.name)) || 0) + Math.max(1, r.qty | 0));
      const sim = overlap(mine, theirs);
      if (sim >= META_MATCH && (!meta || sim > meta.sim)) meta = {sim, name: l.archetype || l.name || ''};
    }
    if (meta && !meta.name) meta = null;
  }
  // A bought precon is saved with its real printings (set and collector number on every row).
  const precon = main.length > 0 && main.every(r => r.set && r.number);
  return {colors: 'WUBRG'.split('').filter(k => colors.has(k)), style, meta: meta ? meta.name : '', precon};
}
