// What a card needs from the rest of the deck before it does its job, and
// which cards provide it. The builder (builder.js) only keeps a card whose
// needs the finished list meets, so a Pirate's Cutlass never arrives without
// Pirates and a "second spell each turn" payoff never arrives without cheap
// spells. Rules of thumb read from Oracle text with a bounded vocabulary: an
// unrecognised clause yields no need (never a false block), and every need
// names the wording it came from.
import { MTG_VOCABULARY, tribePattern } from './mtg-vocabulary.js';
import { rulesText, typeText, isLand } from './core.js';

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Subtypes a spell can depend on: every creature type, plus the noncreature
// subtypes decks are built around. Land subtypes are the land step's business.
const OTHER_SUBTYPES = ['Lesson', 'Equipment', 'Aura', 'Vehicle', 'Saga', 'Shrine', 'Curse', 'Room', 'Case', 'Class', 'Background', 'Adventure', 'Arcane', 'Trap', 'Treasure', 'Food', 'Clue', 'Blood', 'Map', 'Role'];
const SUBTYPES = [...new Set([...MTG_VOCABULARY['creature-types'], ...OTHER_SUBTYPES])].sort((a, b) => b.length - a.length);
const TERM = '(' + SUBTYPES.map(tribePattern).join('|') + ')';
const singular = new Map(SUBTYPES.flatMap(t => { const m = tribePattern(t).match(/^\(\?:(.+)\|(.+)\)$/); return m ? [[m[1].replace(/\\/g, '').toLowerCase(), t], [m[2].replace(/\\/g, '').toLowerCase(), t]] : [[t.toLowerCase(), t]]; }));
// Wordings where the card wants ANOTHER object of that subtype. Case-sensitive: Oracle text capitalises subtypes.
const SUBTYPE_NEEDS = [
 'target ' + TERM + ' you control',
 '(?:another|other|each other) ' + TERM + '(?: creatures?)? you control',
 '(?:another|other) ' + TERM + '\\b(?! token)',
 'for each (?:other )?' + TERM + ' (?:you control|card in your graveyard)',
 '(?:if|as long as|unless) you control (?:a|an|another|two or more|three or more) ' + TERM,
 "(?:there's|there is) (?:a|an) " + TERM + ' card in your graveyard',
 TERM + ' cards? (?:in|from) your graveyard',
 '[Ww]henever you cast (?:a|an) ' + TERM + ' spell',
 '[Ww]henever (?:a|an|another) ' + TERM + '(?: you control)? (?:enters|attacks|dies|deals)',
 '(?:^|\\n|\\. )(?:Other )?' + TERM + '(?: creatures)? you control (?:get|have|gain)',
].map(p => new RegExp(p, 'g'));
const textOf = c => rulesText(c).replace(/\([^)]*\)/g, ' ');
const typeLine = c => c?.card_faces?.length ? c.card_faces.map(f => f.type_line || '').join(' // ') : typeText(c);
const subtypeIn = (c, t) => new RegExp('(?:—|\\s)' + esc(t) + '(?:\\s|$)').test(' ' + typeLine(c).split('—').slice(1).join(' — ') + ' ');
const isType = (c, re) => re.test(typeLine(c));
const mv = c => Number(c?.cmc) || 0;

const memo = new WeakMap();
// [{id, label, min(size), provides(card)}] for one card. `size` is the deck size.
export function cardNeeds(card) {
 if (!card || typeof card !== 'object') return [];
 const hit = memo.get(card), sig = textOf(card) + '|' + typeLine(card);
 if (hit?.sig === sig) return hit.needs;
 const text = textOf(card), needs = [], seen = new Set();
 const add = need => { if (!seen.has(need.id)) { seen.add(need.id); needs.push(need); } };
 for (const re of SUBTYPE_NEEDS) for (const m of text.matchAll(re)) {
  const type = singular.get(String(m[1]).toLowerCase()); if (!type) continue;
  // A card that makes its own supply ("create a Treasure token … sacrifice a Treasure") needs no one else.
  if (new RegExp('create[^.\\n]*\\b' + tribePattern(type) + '\\b[^.\\n]*token', 'i').test(text)) continue;
  const everyType = c => /\bCreature\b/.test(typeLine(c)) && /\bchangeling\b|is every creature type/i.test(textOf(c));
  add({ id: 'sub:' + type, kind: 'subtype', subject: type, label: type + ' cards', min: size => size >= 100 ? 10 : 8,
   provides: c => c !== card && !isLand(c) && (subtypeIn(c, type) || everyType(c) || new RegExp('create[^.\\n]*\\b' + tribePattern(type) + '\\b[^.\\n]*token', 'i').test(textOf(c))) });
 }
 if (/\byou cast your second spell each turn/i.test(text)) add({ id: 'second-spell', kind: 'tempo', label: 'cheap spells (two in one turn)', min: size => size >= 100 ? 18 : 12,
  provides: c => c !== card && !isLand(c) && (mv(c) <= 1 || mv(c) <= 2 && isType(c, /\b(?:Instant|Sorcery)\b/)) });
 if (/draw your second card each turn/i.test(text)) add({ id: 'second-draw', kind: 'draw', label: 'extra card draw', min: size => size >= 100 ? 12 : 8,
  provides: c => c !== card && mv(c) <= 3 && /\bdraws? (?:a|an additional|two|three|x|that many) cards?\b|\bconnives?\b/i.test(textOf(c)) });
 if (/\bcollect evidence\b/i.test(text)) add({ id: 'graveyard-fill', kind: 'graveyard', label: 'ways to fill your graveyard', min: size => size >= 100 ? 10 : 8,
  provides: c => c !== card && (/\bmills?\b|\bsurveil\b|\bdiscard a card\b|\bloot\b|\bdredge\b/i.test(textOf(c)) || isType(c, /\b(?:Instant|Sorcery)\b/) && mv(c) >= 2) });
 if (/(?:each|other|another|target) creatures? you control with a \+1\/\+1 counter|for each \+1\/\+1 counter on (?:other|another)|creatures you control with \+1\/\+1 counters/i.test(text)) add({ id: 'plus-counters', kind: 'counters', label: '+1/+1 counter makers', min: size => size >= 100 ? 10 : 8,
  provides: c => c !== card && /\+1\/\+1 counters?\b[^.\n]*\bon\b|enters with (?:a|two|three|x|\d+) \+1\/\+1 counter|\bproliferate\b|\badapt\b|\bbolster\b|\bmentor\b|\btraining\b|\bevolve\b/i.test(textOf(c)) });
 memo.set(card, { sig, needs });
 return needs;
}

// For a list of {card, qty}: each card's needs with how many providers the list holds.
// A need is met when the providers (copies) reach its minimum for this deck size.
export function inspectNeeds(rows, { size = 60, exempt = () => false } = {}) {
 const list = rows.filter(r => r?.card && r.qty > 0), out = [];
 for (const row of list) for (const need of cardNeeds(row.card)) {
  const have = list.reduce((n, r) => n + (need.provides(r.card) ? r.qty : 0), 0), min = need.min(size);
  out.push({ name: row.card.name, need: need.id, label: need.label, have, min, met: have >= min, exempt: !!exempt(row.card) });
 }
 return out;
}
export const unmetNeeds = (rows, options) => inspectNeeds(rows, options).filter(n => !n.met && !n.exempt);

// A mana-colour fixer has nothing to fix in a deck of one colour or none.
export function idleFixer(card, colors = []) {
 if (colors.filter(k => k !== 'C').length > 1 || isLand(card)) return false;
 return /add one mana of any (?:color|type)/i.test(textOf(card)) && !/add (?:two|three|x) mana|\{t\}: add \{/i.test(textOf(card));
}
