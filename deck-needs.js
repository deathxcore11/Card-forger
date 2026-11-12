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

const hasKeyword = (c, k) => (c?.keywords || []).includes(k) || new RegExp('(?:^|\\n)' + k + '\\b', 'i').test(rulesText(c));
// Makes tokens for its controller at a price a game reaches: reminder text is stripped (so a gift to the opponent does
// not count) and an activated ability that costs five or more generic mana is not a token plan.
const makesTokens = c => textOf(c).split('\n').some(line => /\bcreates? [^.]*\btokens?\b/i.test(line) && !/^[^:]*\{(?:[5-9]|\d\d)\}[^:]*:/.test(line) && !/\b(?:opponent|that player|its controller|their controller) creates?\b/i.test(line));
const gainsLife = c => /\blifelink\b/i.test(textOf(c)) || (c?.keywords || []).includes('Lifelink') || /\byou gain (?:\d+|x|that much) life\b|\byou gain life equal\b/i.test(textOf(c));
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
 // "Put a permanent card from your hand onto the battlefield" is a plan to cheat something expensive in:
 // the deck needs permanents worth cheating (six mana or more). A few are enough; `cap` keeps the build-around's
 // higher fuel bar from flooding the deck with them.
 if (/put (?:a|an|up to one|one) (?:permanent|creature|artifact|enchantment|creature or planeswalker|nonland permanent)(?: or [a-z]+)? card[^.\n]* from your hand onto the battlefield/i.test(text)) add({ id: 'cheat-target', kind: 'cheat', label: 'expensive permanents to put into play', min: size => size >= 100 ? 8 : 6, cap: true,
  provides: c => c !== card && !isLand(c) && mv(c) >= 6 && !isType(c, /\b(?:Instant|Sorcery)\b/) });
 // Input conditions (seen 12 Nov in a live Mono-White list): a payoff is only as good as the thing that sets it off.
 // Agent Maria Hill pays off teamwork costs, Belladonna Took pays off your own tokens, Exemplar of Light pays off lifegain.
 if (/\bteamwork cost\b|cast using teamwork/i.test(text) && !hasKeyword(card, 'Teamwork')) add({ id: 'teamwork', kind: 'mechanic', label: 'teamwork cards', min: size => size >= 100 ? 10 : 8,
  provides: c => c !== card && !isLand(c) && hasKeyword(c, 'Teamwork') });
 if (/whenever (?:a|another|one or more) (?:[a-z]+ )?tokens? you control enters?|for each token you control|\btokens you control (?:get|have|gain)/i.test(text) && !makesTokens(card)) add({ id: 'own-tokens', kind: 'tokens', label: 'token makers', min: size => size >= 100 ? 10 : 8,
  provides: c => c !== card && !isLand(c) && mv(c) <= 4 && makesTokens(c) });
 if (/whenever you gain life|if you(?:'ve| have) gained (?:\w+ or more )?life|for each 1 life you gained|equal to the amount of life you gained/i.test(text) && !gainsLife(card)) add({ id: 'lifegain', kind: 'lifegain', label: 'ways to gain life', min: size => size >= 100 ? 10 : 8,
  provides: c => c !== card && !isLand(c) && mv(c) <= 3 && gainsLife(c) });
 // A sweeper that takes your own board with it ("exile all artifacts and creatures with mana value 2 or less") has no place
 // beside a crowd of exactly those cards. `max`: at most this many copies of its own victims may share the list.
 const sweep = text.match(/(?:exile|destroy) (?:all|each) ([^.\n]*?) with mana value (\d+) or less/i);
 if (sweep && !/\b(?:your opponents?|an opponent|you don't) controls?\b/i.test(sweep[1])) {
  const what = sweep[1].toLowerCase(), limit = Number(sweep[2]), kinds = /nonland permanent|\bpermanents?\b/.test(what) ? /./ : new RegExp('\\b(?:' + ['artifact', 'creature', 'enchantment', 'planeswalker'].filter(k => what.includes(k)).map(k => k[0].toUpperCase() + k.slice(1)).join('|') + ')\\b');
  if (kinds.source !== '\\b(?:)\\b') add({ id: 'self-sweep', kind: 'conflict', label: 'your own cards it would sweep away', min: () => 0, max: size => size >= 100 ? 11 : 7,
   provides: c => c !== card && !isLand(c) && !isType(c, /\b(?:Instant|Sorcery)\b/) && mv(c) <= limit && isType(c, kinds) });
 }
 memo.set(card, { sig, needs });
 return needs;
}

// For a list of {card, qty}: each card's needs with how many providers the list holds.
// A need is met when the providers (copies) reach its minimum for this deck size.
export function inspectNeeds(rows, { size = 60, exempt = () => false } = {}) {
 const list = rows.filter(r => r?.card && r.qty > 0), out = [];
 for (const row of list) for (const need of cardNeeds(row.card)) {
  const have = list.reduce((n, r) => n + (need.provides(r.card) ? r.qty : 0), 0), min = fuelMinimum(need, size, exempt(row.card));
  const max = need.max ? need.max(size) : Infinity;
  out.push({ name: row.card.name, need: need.id, label: need.label, have, min, max, met: have >= min && have <= max, exempt: !!exempt(row.card) });
 }
 return out;
}
export const unmetNeeds = (rows, options) => inspectNeeds(rows, options).filter(n => !n.met && !n.exempt);

// A mana-colour fixer has nothing to fix in a deck of one colour or none.
export function idleFixer(card, colors = []) {
 if (colors.filter(k => k !== 'C').length > 1 || isLand(card)) return false;
 // Sunburst and converge count the colours of mana spent: one colour or none leaves them nearly blank.
 if (/\bsunburst\b|\bconverge\b|for each color of mana spent/i.test(rulesText(card))) return true;
 return /add one mana of any (?:color|type)/i.test(textOf(card)) && !/add (?:two|three|x) mana|\{t\}: add \{/i.test(textOf(card));
}

// Shape faults of a finished list, counted: unsupported cards, idle colour fixers and, in 60-card decks,
// legends past two copies and stray one-ofs past two. `keep` names the build-around and the player's own cards.
// The pipeline's upgrade search (deck-pipeline.js) never accepts a swap that adds a fault.
export function shapeFaults(rows, { size = 60, colors = [], keep = () => false } = {}) {
 const list = rows.filter(r => r?.card && r.qty > 0), spells = list.filter(r => !isLand(r.card) && !keep(r.card));
 let n = unmetNeeds(list, { size, exempt: keep }).length + spells.filter(r => idleFixer(r.card, colors)).length;
 if (size < 100) n += spells.filter(r => /\bLegendary\b/.test(typeLine(r.card).split(' // ')[0]) && r.qty > 2).length + Math.max(0, spells.filter(r => r.qty === 1).length - 2);
 return n;
}

// Scryfall searches that find what a build-around needs (builder.js themeQueries): its fuel must be in the
// candidate pool before the builder can choose it. One query per need, in the search syntax the app already uses.
export function needQueries(card) {
 return cardNeeds(card).map(need => need.kind === 'subtype' ? `(t:${/^[a-z]+$/i.test(need.subject) ? need.subject.toLowerCase() : '"' + need.subject.toLowerCase() + '"'} or o:"${need.subject.toLowerCase()} token")`
  : need.id === 'second-spell' ? 'cmc<=2 (t:instant or t:sorcery) (o:"draw a card" or o:scry or o:surveil or cmc<=1)'
  : need.id === 'second-draw' ? 'cmc<=3 (o:"draw a card" or o:"draw two cards" or o:connive)'
  : need.id === 'graveyard-fill' ? 'cmc<=3 (o:mill or o:surveil or o:"discard a card")'
  : need.id === 'plus-counters' ? 'cmc<=3 o:"+1/+1 counter"'
  : need.id === 'teamwork' ? 'keyword:teamwork'
  : need.id === 'own-tokens' ? 'cmc<=3 o:create o:token'
  : need.id === 'lifegain' ? 'cmc<=3 (keyword:lifelink or o:"you gain")'
  : need.id === 'cheat-target' ? 'cmc>=6 (t:creature or t:enchantment or t:artifact or t:planeswalker)' : '').filter(Boolean);
}
// The build-around's own fuel is held to the higher bar (twelve in sixty cards, sixteen in a hundred): it has to
// be there most games, not some games.
export const fuelMinimum = (need, size, kept) => kept && !need.cap && !need.max ? Math.max(need.min(size), size >= 100 ? 16 : 12) : need.min(size);
