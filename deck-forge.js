// Deck Forge engine (spec: deck-builder-spec.md, Slices A and B, rules only).
// Reads oracle text with the rules table in deck-forge-tags.js, answers the
// four questions for a commander (or a 60-card build-around), scores the
// overlap of a card with those hooks, checks the mana bar, and counts a deck's
// roles for the deck doctor. No AI and no prices: this module is safe to use
// behind the Play wall.
import { DECK_TAGS, DECK_TARGETS } from './deck-forge-tags.js';
import { GAME_CHANGER_SNAPSHOT } from './game-changers.js';

export { DECK_TAGS, DECK_TARGETS };
const lc = s => String(s || '').toLowerCase();
const typeOf = c => lc(c?.type_line || (c?.card_faces || []).map(f => f.type_line || '').join(' // '));
const isLandCard = c => /\bland\b/.test(typeOf(c).split(' // ')[0]);
const textOf = c => c?.oracle_text || (c?.card_faces || []).map(f => f.oracle_text || '').join('\n') || '';
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = DECK_TAGS.rules.map(r => ({ ...r, re: Object.fromEntries(['text', 'cost', 'effect', 'not', 'costNot', 'type', 'notType', 'whole'].filter(k => r[k]).map(k => [k, new RegExp(r[k], 'i')])) }));
const GAME_CHANGERS = new Set(GAME_CHANGER_SNAPSHOT.cards.map(c => lc(c.name)));
const LAND_TAGS = new Set(['fodder-artifact', 'counter-mover', 'fodder-creature', 'draw-investigate']);
const ROLE_TAGS = ['ramp', 'draw', 'removal', 'wipe', 'protection', 'wincon'];

// One ability per line, lower-cased, own name as "~", reminder text removed,
// ability words ("Landfall —") and modal bullets stripped, activated
// abilities split at their colon.
export function forgeRead(card) {
 if (!card) return { abilities: [], whole: '', type: '', mv: 0 };
 const names = [card.name, ...(card.card_faces || []).map(f => f.name)].filter(Boolean).flatMap(n => [n, n.split(',')[0]]).filter(n => n.length > 2).sort((a, b) => b.length - a.length);
 let text = textOf(card).replace(/\([^)]*\)/g, '');
 for (const n of names) text = text.replace(new RegExp(escape(n), 'gi'), '~');
 text = lc(text).replace(/\bthis (?:creature|artifact|enchantment|land|planeswalker|equipment|aura|permanent|token|vehicle|battle)\b/g, '~').replace(/[’]/g, "'");
 const abilities = text.split('\n').map(l => l.trim().replace(/^•\s*/, '').replace(/^[a-z][a-z' -]{2,30} — (?=when|whenever|at |\{|you |if )/, '')).filter(Boolean).map(line => {
  const m = line.match(/^([^:"]{1,90}):\s*(.+)$/);
  const activated = m && /\{|sacrifice|pay |tap |exile |remove |discard|^[+−-]?\d+$/.test(m[1]);
  return activated ? { line, cost: m[1].trim(), effect: m[2].trim() } : { line };
 });
 return { abilities, whole: text, type: typeOf(card), mv: Number(card.cmc) || 0 };
}

const tierOf = (rule, mv) => rule.tier !== 'mv' ? rule.tier : mv <= 2 ? 'A' : mv <= 3 ? 'B' : 'C';
function ruleHits(rule, read) {
 const t = read.type, spell = /\b(?:instant|sorcery)\b/.test(t);
 if (rule.on === 'permanent' && spell) return false;
 if (rule.on === 'spell' && !spell) return false;
 if (rule.re.type && !rule.re.type.test(t)) return false;
 if (rule.re.notType && rule.re.notType.test(t)) return false;
 if (rule.re.whole && !rule.re.whole.test(read.whole)) return false;
 return read.abilities.some(a => {
  if (rule.re.costNot && a.cost && rule.re.costNot.test(a.cost)) return false;
  if (rule.re.not && rule.re.not.test(a.line)) return false;
  if (rule.re.cost) return !!a.cost && rule.re.cost.test(a.cost) && (!rule.re.effect || rule.re.effect.test(a.effect));
  return rule.re.text.test(a.line);
 });
}

const tagMemo = new WeakMap();
// Every tag a card earns, best tier per tag: [{tag, tier, rule}]
export function forgeTags(card) {
 if (!card || typeof card !== 'object') return [];
 const sig = textOf(card) + '|' + typeOf(card) + '|' + card.cmc;
 const hit = tagMemo.get(card);
 if (hit?.sig === sig) return hit.tags;
 const read = forgeRead(card), best = new Map();
 {
  for (const rule of compiled) {
   if (isLandCard(card) && !LAND_TAGS.has(rule.tag)) continue;
   if (!ruleHits(rule, read)) continue;
   const tier = tierOf(rule, read.mv), old = best.get(rule.tag);
   if (!old || tier < old.tier) best.set(rule.tag, { tag: rule.tag, tier, rule: rule.id });
  }
 }
 // A Lotus-style card can read as both; burst wins over permanent ramp.
 if (best.has('burst') && best.get('ramp')?.rule === 'ramp-mana-ability') best.delete('ramp');
 // Cheap artifacts and artifact lands are sacrifice fodder for artifact-hungry commanders.
 if (/\bartifact\b/.test(read.type) && !/\bcreature\b/.test(read.type) && (read.mv <= 2 || isLandCard(card)) && !best.has('fodder-artifact')) best.set('fodder-artifact', { tag: 'fodder-artifact', tier: isLandCard(card) ? 'B' : 'C', rule: 'cheap-artifact' });
 const tags = [...best.values()];
 tagMemo.set(card, { sig, tags });
 return tags;
}
export const hasTag = (card, tag) => forgeTags(card).some(t => t.tag === tag);
export const forgeRule = (card, id) => forgeTags(card).some(t => t.rule === id);
const reducedType = card => { const m = forgeRead(card).whole.match(/(artifact|creature|enchantment|instant|sorcery|noncreature|legendary|[a-z]+) spells you cast cost/); return m?.[1] || ''; };
const isRepeatable = read => read.abilities.some(a => a.cost || /^(?:whenever|at the beginning|as long as|creatures you control|equipped|enchanted|each)/.test(a.line) || /\bget[s]? \+|\bhave\b/.test(a.line));
const immediate = read => read.abilities.some(a => /^when(?:ever)? ~ enters|^when you cast/.test(a.line)) || /\b(?:instant|sorcery)\b/.test(read.type);

// THE FOUR QUESTIONS. Each answer is a hook (a theme group) with a minimum.
// A hook's match() decides whether a card belongs to the group.
export function commanderHooks(leader, { size = 100 } = {}) {
 if (!leader) return [];
 const read = forgeRead(leader), lines = read.abilities.map(a => a.line), text = lines.join('\n'), scale = size >= 100 ? 1 : .6, min = id => { const base = DECK_TARGETS.hooks[id] ?? 3; return base ? Math.max(1, Math.round(base * scale)) : 0; };
 const out = new Map(), add = (id, label, question, match, minimum = min(id)) => { if (!out.has(id)) out.set(id, { id, label, question, min: minimum, match }); };
 const tag = (...names) => c => forgeTags(c).some(t => names.includes(t.tag));
 const creature = c => /\bcreature\b/.test(typeOf(c));
 // Q1: what triggers it?
 if (/when(?:ever)? ~ (?:enters|enters or attacks)|~ enters or|^when ~ enters/m.test(text)) add('reenter', 'Re-trigger enters', 'trigger', tag('flicker', 'enter-doubler', 'reenter'));
 if (/whenever ~ (?:enters or )?attacks|whenever ~ and at least|whenever ~ deals combat damage|~ (?:enters or )?attacks/.test(text)) {
  add('attack-helpers', 'Attack helpers', 'trigger', tag('attack-helper'));
  add('attackers', 'Want to attack', 'trigger', tag('attack-payoff'));
  add('protection', 'Protection', 'survive', tag('protection'));
 }
 if (/when(?:ever)? ~ dies|when(?:ever)? ~ leaves the battlefield|when(?:ever)? ~ is put into (?:a|your) graveyard/.test(text)) add('ways-to-leave', 'Ways to leave', 'trigger', tag('sac-outlet', 'flicker'));
 if (/whenever you cast (?:or copy )?(?:an? )?(?:instant|sorcery|noncreature|spell)|magecraft|prowess/.test(text)) add('spells', 'Instants and sorceries', 'trigger', c => /\b(?:instant|sorcery)\b/.test(typeOf(c)) || hasTag(c, 'spell-payoff'));
 if (/whenever you gain life|lifelink|whenever you gain/.test(text)) add('lifegain', 'Life gain', 'trigger', tag('lifegain', 'lifegain-payoff'));
 if (/whenever (?:a|another|one or more) (?:other )?(?:nontoken )?creatures?(?: you control)? (?:dies|die)|whenever you sacrifice/.test(text)) { add('fodder', 'Fodder', 'consume', tag('fodder-creature', 'fodder-value')); add('sac-outlets', 'Sac outlets', 'consume', tag('sac-outlet')); add('death-payoffs', 'Death payoffs', 'make', tag('death-payoff')); }
 if (/whenever (?:a|another|one or more) (?:other )?(?:nontoken )?creatures?[^,]*? enters/.test(text)) add('enters', 'Creatures entering', 'trigger', c => hasTag(c, 'fodder-creature') || creature(c) && forgeRead(c).mv <= 3);
 if (/whenever[^\n]*\btokens?\b|for each token/.test(text)) add('tokens', 'Token makers', 'trigger', tag('fodder-creature', 'fodder-artifact'));
 if (/landfall|whenever a land (?:you control )?enters/.test(text)) add('landfall', 'Landfall', 'trigger', c => forgeRule(c, 'ramp-land-search') || forgeRule(c, 'ramp-extra-land') || hasTag(c, 'landfall'));
 if (/\+1\/\+1 counters? (?:is|are) put|whenever you put/.test(text)) add('counters', '+1/+1 counters', 'trigger', tag('counters', 'counter-mover'));
 if (/whenever you draw/.test(text)) add('draw-trigger', 'Extra draws', 'trigger', tag('draw'));
 // Q2: what does it consume?
 const sac = text.match(/sacrifice (?:another|a|an|any number of|x)(?: other)? ([a-z ,]+?)(?:[.:]|$| to| if| and)/m);
 if (sac && !/sacrifice (?:it|them|~) at/.test(sac[0])) {
  const what = sac[1], creatures = /creature|permanent/.test(what), artifacts = /artifact|permanent/.test(what);
  add('fodder', 'Fodder', 'consume', c => (creatures && (hasTag(c, 'fodder-creature') || hasTag(c, 'fodder-value') && creature(c))) || (artifacts && (hasTag(c, 'fodder-artifact') || hasTag(c, 'fodder-value') && /\bartifact\b/.test(typeOf(c)))));
  add('sac-outlets', 'Sac outlets', 'consume', tag('sac-outlet'));
  add('sac-value', 'Value when sacrificed', 'consume', c => hasTag(c, 'fodder-value') && (creatures && creature(c) || artifacts && /\bartifact\b/.test(typeOf(c))));
  add('enter-value', 'Enter value', 'consume', c => hasTag(c, 'enter-value') && (creatures && creature(c) || artifacts && /\bartifact\b/.test(typeOf(c))));
  if (creatures) add('death-payoffs', 'Death payoffs', 'make', tag('death-payoff'));
 }
 if (/discard (?:a|two|x|one or more) cards?/.test(text)) add('discard', 'Discard fuel', 'consume', c => /\bdiscard\b/.test(forgeRead(c).whole) || hasTag(c, 'self-mill'));
 if (/pay (?:\d+|x) life/.test(text)) add('lifegain', 'Life gain', 'consume', tag('lifegain', 'lifegain-payoff'));
 if (/exile [^\n]*cards? from your graveyard|from your graveyard/.test(text)) add('self-mill', 'Fill the graveyard', 'consume', tag('self-mill', 'reenter'));
 // Q3: what does it make?
 if (/\+1\/\+1 counter|proliferate/.test(text)) add('counters', '+1/+1 counters', 'make', tag('counters', 'counter-mover'));
 if (/create[^\n]*token/.test(text) && !out.has('tokens')) add('token-payoffs', 'Token payoffs', 'make', tag('token-payoff', 'death-payoff'));
 // Rule (recipients): a commander that moves counters/auras/equipment onto a
 // creature you control rewards evasive and lifelink recipients.
 if (/(?:put its counters|attach|move [^\n]*counters?)[^\n]*(?:target|another) creature you control/.test(text)) add('recipients', 'Evasive recipients', 'make', c => creature(c) && /\b(?:flying|menace|lifelink|trample|can't be blocked)\b/.test(forgeRead(c).whole), 0);
 // Q4: what does it need to survive or connect? (voltron and equipment-hungry leaders)
 if (/equipped|enchanted|aura|equipment|commander damage/.test(text)) add('protection', 'Protection', 'survive', tag('protection'));
 return [...out.values()];
}

// How a card sits against a commander: hooks hit, overlap points, mana bar.
export function forgeFit(card, hooks, { leader = null, power = null } = {}) {
 const read = forgeRead(card), tags = forgeTags(card), names = new Set(tags.map(t => t.tag)), hit = hooks.filter(h => h.match(card)).map(h => h.id), why = [];
 let bonus = 0;
 // Conditions the deck's own themes meet count as one more hook (Airbender Ascension).
 if (read.abilities.some(a => /^whenever (?:a|another) (?:nontoken )?creature (?:you control )?enters/.test(a.line)) && hooks.some(h => ['fodder', 'tokens', 'enters'].includes(h.id))) { bonus++; why.push('condition fed by fodder'); }
 // Numbers in conditions are checked against the actual commander (Angel of Indemnity).
 const mvCap = read.whole.match(/mana value (\d+) or less from your graveyard to the battlefield/);
 if (mvCap && leader && Number(leader.cmc) <= Number(mvCap[1]) && hooks.some(h => ['reenter', 'ways-to-leave', 'fodder'].includes(h.id))) { bonus++; why.push(`can return ${leader.name}`); }
 let penalty = 0;
 // A condition the deck can't meet (Starfield Mystic).
 if (names.has('reducer') && !names.has('ramp')) {
  const type = reducedType(card);
  if (!['creature', 'artifact', 'noncreature', 'legendary'].includes(type) || type === 'artifact' && !hooks.some(h => h.id === 'fodder')) { penalty += 2; why.push(`needs ${type} spells`); }
 }
 // Overlap rises faster than one point per hook (1, 3, 6, 10), capped at four
 // hooks so near-duplicate groups (sac outlet and way to leave) can't run away.
 const n = new Set(hit).size + bonus, m = Math.min(4, n), overlap = m * (m + 1) / 2;
 const role = ROLE_TAGS.some(t => names.has(t));
 let bar = 'n/a';
 if (hooks.length && !isLandCard(card)) {
  const mv = read.mv, rep = isRepeatable(read);
  if (mv <= 3) bar = rep && n >= 1 || role || n >= 2 ? 'pass' : 'fail';
  else if (mv <= 4) bar = n >= 2 || names.has('enter-doubler') || role && rep ? 'pass' : 'fail';
  else if (mv <= 5) bar = immediate(read) && n >= 1 || names.has('wipe') || names.has('wincon') ? 'pass' : 'fail';
  else bar = names.has('wipe') || names.has('wincon') || rep && immediate(read) && n >= 1 || immediate(read) && n >= 3 ? 'pass' : 'fail';
  if (bar === 'fail') penalty += mv <= 3 ? 1 : mv <= 4 ? 2 : mv <= 5 ? 4 : 6;
 }
 const offPlan = hooks.length > 0 && n === 0 && !role && !isLandCard(card);
 if (offPlan) penalty += 5;
 // Theme-fit card advantage: draw that comes from the deck's own engine (Skullclamp in a sacrifice deck).
 const themeDraw = names.has('draw') && hooks.some(h => ['fodder', 'sac-outlets', 'death-payoffs'].includes(h.id)) && /sacrific|dies|die\b|put into a graveyard/.test(read.whole);
 // Power: Casual keeps fast mana, game changers and tutors out.
 const casual = power === 'casual' || power === 'focused';
 if (names.has('burst')) penalty += casual ? 4 : 1;
 if (casual && GAME_CHANGERS.has(lc(card?.name))) penalty += power === 'casual' ? 10 : 4;
 if (casual && names.has('tutor')) penalty += power === 'casual' ? 3 : 1;
 return { hooks: [...new Set(hit)], conditions: why, n, overlap, bar, offPlan, themeDraw, penalty, tags };
}

const TIER_POINTS = { A: 1.5, B: .75, C: 0 };
// One number the builder adds to its own score. Synergy first, mana value second.
export function forgeScore(card, hooks, opts = {}) {
 const fit = forgeFit(card, hooks, opts);
 const roleTier = fit.tags.filter(t => ROLE_TAGS.includes(t.tag)).reduce((m, t) => Math.max(m, TIER_POINTS[t.tier] || 0), 0);
 return { score: fit.overlap * 2.5 + roleTier + (fit.themeDraw ? 2.5 : 0) - fit.penalty, fit };
}

// The roles a card fills for quotas: permanent ramp only, real card advantage,
// interaction (removal, interruption, protection), wipes, win conditions.
export function forgeRoles(card, deckTypeCounts = null) {
 const tags = forgeTags(card), names = new Set(tags.map(t => t.tag)), out = [];
 if (names.has('ramp')) out.push('ramp');
 else if (names.has('reducer') && deckTypeCounts) { const t = reducedType(card); if ((deckTypeCounts[t] || 0) >= 8) out.push('ramp'); }
 if (names.has('draw')) out.push('draw');
 if (names.has('removal') || names.has('protection')) out.push('interaction');
 if (names.has('wipe')) out.push('wipe');
 if (names.has('wincon')) out.push('wincon');
 return out;
}

export function forgeTargets(format) {
 const size = Number(format?.size) || 60, commander = !!format?.commander && size >= 100;
 return commander ? DECK_TARGETS.commander : DECK_TARGETS.constructed;
}

// Seeded variation (Tight / Varied / Wild): same seed, same deck.
export function forgeNoise(seed, name, variation = 'varied') {
 if (!seed || variation === 'tight') return 0;
 let h = 2166136261;
 for (const ch of String(seed) + '|' + lc(name)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
 return ((h >>> 0) / 4294967296) * (variation === 'wild' ? 6 : 2.5);
}
export const newForgeSeed = (rand = Math.random) => Array.from({ length: 6 }, () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(rand() * 32)]).join('');

// Scryfall queries that make sure each hook's cards are in the candidate pool.
export function forgeDiscoveryQueries(leader, { size = 100 } = {}) {
 const q = {
  reenter: '(o:"then return" or o:"triggers an additional time" or o:"return target creature card from your graveyard to the battlefield")',
  'attack-helpers': '(o:"equipped creature can\'t be blocked" or o:"remove target attacking creature" or (t:equipment o:flying) or o:"commander creatures you own")',
  'ways-to-leave': '(o:"sacrifice another creature:" or o:"sacrifice a creature:" or o:"then return it to the battlefield")',
  fodder: '(o:"create" (o:"creature token" or o:treasure or o:clue or o:food) or (o:"dies" o:"when this"))',
  'sac-outlets': '(o:"sacrifice a creature:" or o:"sacrifice another creature:" or o:"sacrifice an artifact:")',
  'death-payoffs': '(o:"whenever another creature" o:dies or o:"whenever a creature you control dies")',
  counters: '(o:"+1/+1 counter" (o:move or o:proliferate or o:"whenever"))',
  spells: '(o:"whenever you cast an instant or sorcery")',
  lifegain: '(o:"whenever you gain life")',
  tokens: '(o:"create" o:"creature token")',
  landfall: '(o:landfall or o:"additional land")',
 };
 const hooks = commanderHooks(leader, { size }), out = hooks.map(h => q[h.id]).filter(Boolean);
 // Draw from the theme (spec step 3) and the deck's finishers (step 7).
 if (hooks.some(h => ['fodder', 'sac-outlets', 'death-payoffs'].includes(h.id))) out.push('o:draw (o:sacrifice or o:dies)', '(o:"each opponent loses" (o:dies or o:sacrifice))');
 return [...new Set(out)].slice(0, 6);
}

// DECK DOCTOR (Slice A): gauges per role and per theme group.
// rows: [{name, qty}] ; card(name) → card data.
export function deckDoctor(rows, card, { format = null, commander = null } = {}) {
 const size = Number(format?.size) || rows.reduce((n, r) => n + (Number(r.qty) || 0), 0) || 60, isCommander = !!format?.commander && size >= 100, targets = forgeTargets({ size, commander: isCommander });
 const leader = commander ? card(commander) : null, hooks = commanderHooks(leader, { size });
 const list = rows.map(r => ({ ...r, c: card(r.name) })).filter(r => r.c && r.name !== leader?.name);
 const typeCounts = {};
 for (const r of list) for (const t of ['artifact', 'creature', 'enchantment', 'instant', 'sorcery', 'legendary']) if (new RegExp('\\b' + t + '\\b').test(typeOf(r.c))) typeCounts[t] = (typeCounts[t] || 0) + r.qty;
 typeCounts.noncreature = list.filter(r => !/\bcreature\b|\bland\b/.test(typeOf(r.c))).reduce((n, r) => n + r.qty, 0);
 const bucket = new Map(), push = (k, r) => { if (!bucket.has(k)) bucket.set(k, []); bucket.get(k).push(r); };
 let mvSum = 0, spells = 0;
 for (const r of list) {
  if (isLandCard(r.c)) { push('lands', r); if (forgeRoles(r.c).length) for (const role of forgeRoles(r.c)) push(role, r); continue; }
  mvSum += (Number(r.c.cmc) || 0) * r.qty; spells += r.qty;
  for (const role of forgeRoles(r.c, typeCounts)) push(role, r);
  if (hasTag(r.c, 'burst')) push('burst', r);
  if (hasTag(r.c, 'reducer') && !forgeRoles(r.c, typeCounts).includes('ramp')) push('not-counting', r);
  for (const h of hooks) if (h.match(r.c)) push('hook:' + h.id, r);
  if (hooks.length && forgeFit(r.c, hooks, { leader }).offPlan) push('off-plan', r);
 }
 const count = k => (bucket.get(k) || []).reduce((n, r) => n + r.qty, 0), names = k => (bucket.get(k) || []).map(r => r.name);
 const wipe = targets.wipe, landsTarget = isCommander ? targets.lands : Math.round(size * .4);
 const gauges = [
  { key: 'ramp', label: 'Ramp', count: count('ramp'), target: targets.ramp },
  { key: 'draw', label: 'Card advantage', count: count('draw'), target: targets.draw },
  { key: 'interaction', label: 'Interaction', count: count('interaction'), target: targets.interaction },
  { key: 'wipe', label: 'Board wipes', count: count('wipe'), target: wipe.min, max: wipe.max },
  { key: 'wincon', label: 'Win conditions', count: count('wincon'), target: targets.wincon || 0 },
  { key: 'lands', label: 'Lands', count: count('lands'), target: landsTarget },
  ...hooks.filter(h => h.min > 0).map(h => ({ key: 'hook:' + h.id, label: h.label, count: count('hook:' + h.id), target: h.min, hook: true })),
 ].map(g => ({ ...g, cards: names(g.key), full: g.count >= g.target && (g.max === undefined || g.count <= g.max) }));
 return { version: DECK_TAGS.version, gauges, hooks: hooks.map(h => ({ id: h.id, label: h.label, question: h.question, min: h.min })), burst: names('burst'), notCounting: names('not-counting'), offPlan: names('off-plan'), averageMv: spells ? Math.round(mvSum / spells * 100) / 100 : 0 };
}
