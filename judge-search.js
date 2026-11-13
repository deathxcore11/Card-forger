// Ask a Judge without AI. A question is read into the rulebook's own terms (its glossary and section
// headings), and the answer is the rule text that covers those terms, quoted exactly with its number.
// DOM-free and network-free: it runs in the browser, in the app's engine and offline.
import { entryReference, normalizeRuleId, resolveRuleReference } from './rule-reference.js';
import { retrieveRules } from './rules-retrieval.js';

const norm = v => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();
const stem = w => w.length > 4 ? w.replace(/(?:'s|ies|ing|ed|es|s)$/, m => m === 'ies' ? 'y' : '') : w.replace(/'s$/, '');
const words = v => (norm(v).match(/[a-z0-9+/]+(?:'[a-z]+)?/g) || []).map(stem);
const STOP = new Set('a an the can could may might i my me you your we our it its is are was were be been do does did how what which when where why who if of to for on in at by and or with from about rule rules game card cards please would should have has had this that then than there their they them he she his her so get gets got will not no yes still also just into out up any some one'.split(' ').map(stem));
// Rulebook words that are too ordinary to count as the subject of a question on their own.
const PLAIN = new Set('card player game turn rule text name object type owner play number order source effect event cost color step phase zone value choose control ability spell permanent creature land hand deck opponent you attack block damage draw life mana tap untap target'.split(' ').map(stem));

// Player words for rulebook terms. Each points at the rulebook by a heading or by words in a rule, never by a number,
// so a new rulebook edition keeps working. `find` picks the first rule whose text contains every phrase.
const SAYINGS = {
  mtg: [
    [/summoning sick|(?:attack|tap|swing|use)\b.*\b(?:turn (?:it|they|i) (?:enter|came|come|play|cast|was|is)|same turn|just (?:play|cast|summon)|right away|first turn)|(?:turn (?:it|they) (?:enter|came|come)|same turn|just (?:play|cast|summon))\b.*\b(?:attack|tap|swing)/, { find: ['can’t attack unless it has been under its controller’s control continuously'], also: [{ find: ['can’t be activated unless the creature has been under its controller’s control continuously'] }, { head: 'Haste' }], label: 'summoning sickness' }],
    [/\b(?:respond|response|in response|priority|instant speed|hold priority)\b/, { head: 'Timing and Priority', label: 'priority' }],
    [/\b(?:respond|response|counter|stack)\b.*\b(?:land drop|play(?:ing|ed)? (?:a |my |the )?land|land (?:being )?played)|\bland\b.*\b(?:use|uses|go on|goes on) the stack/, { find: ['Playing a land is a special action', 'doesn’t use the stack'], also: [{ find: ['Special actions don’t use the stack'] }], label: 'playing a land' }],
    [/\b(?:land drop|how many lands|second land|two lands|extra land|play(?:ing)? (?:a |my )?land)\b/, { find: ['A player can normally play one land during their turn'], also: [{ find: ['A player who has priority may play a land card from their hand during a main phase'] }], label: 'playing a land' }],
    [/\b(?:counterspell|uncounterable|counter(?:ed|ing|s)? (?:a |an |the |that |this |my |his |her |their |target |your )?(?:spell|ability|it|creature|trigger)|be countered|get countered)\b/, { head: 'Counter', chapter: '701', label: 'countering a spell' }],
    [/\b(?:fizzle|illegal target|target (?:is gone|dies|left|leaves|becomes illegal)|no (?:legal )?targets?)\b/, { find: ['all its targets', 'illegal', 'doesn’t resolve'], label: 'illegal targets' }],
    [/\blegend(?:ary)? rule\b|two (?:of the same )?legendar|same legendary|second copy of (?:a |my )?legendary/, { find: ['legend rule'], label: 'legend rule' }],
    [/\b(?:deck out|decked|mill(?:ed)? out|empty library|no cards (?:left )?in (?:my |the |their |your )?(?:library|deck)|library is empty|draw from an empty|run out of cards)\b/, { find: ['attempted to draw a card from a library with no cards in it'], also: [{ find: ['attempts to draw a card from a library with no cards in it loses'] }], label: 'drawing from an empty library' }],
    [/\bcommander tax\b|recast(?:ing)? (?:my |a |the )?commander|cast (?:my |a |the )?commander again/, { find: ['commander cast from the command zone costs an additional'], label: 'commander tax' }],
    [/\bcommander\b.*\b(?:dies|died|die|destroyed|exiled|graveyard|command zone|killed|removed)\b|\bcommand zone\b/, { find: ['If a commander is in a graveyard or in exile', 'command zone'], also: [{ find: ['If a commander would be put into its owner’s hand or library', 'command zone'] }], label: 'commander changing zones' }],
    [/\bcommander damage\b/, { find: ['21 or more combat damage', 'commander'], label: 'commander damage' }],
    [/\b(?:hand size|cards? in (?:my |your |a )?hand at|too many cards|discard down|maximum hand)\b/, { find: ['maximum hand size'], label: 'maximum hand size' }],
    [/\b(?:starting life|start(?:s|ing)? (?:the game )?(?:with|at) .*life|how much life)\b/, { find: ['starting life total'], label: 'starting life total' }],
    [/\b(?:deck size|how many cards .*deck|minimum deck|cards in a deck|how many copies|four copies|4 copies)\b/, { find: ['Constructed', 'at least sixty cards'], also: [{ find: ['no more than four of any card'] }], label: 'deck construction' }],
    [/\bmulligan/, { find: ['To take a mulligan'], label: 'mulligan' }],
    [/\b(?:who goes first|goes first|play first|on the play)\b|\bfirst turn\b.*\bdraw|\bdraw\b.*\bfirst turn/, { find: ['The player who plays first skips the draw step'], also: [{ find: ['starting player'] }], label: 'starting the game' }],
    [/\b(?:etb|enters? the battlefield|enter(?:s|ed|ing)? (?:play|tapped))\b/, { head: 'Triggered Abilities', find: ['enters the battlefield', 'trigger'], label: 'entering the battlefield' }],
    [/\b(?:dies|died|die|death trigger|leaves the battlefield)\b/, { find: ['“dies” means'], also: [{ find: ['Leaves-the-battlefield abilities'] }], label: 'dying' }],
    [/\b(?:state[- ]based|sba|0 toughness|zero toughness|lethal damage)\b/, { head: 'State-Based Actions', label: 'state-based actions' }],
    [/\b(?:trigger(?:s|ed)? (?:twice|order|at the same time|simultaneously)|order (?:of )?triggers|two triggers|both trigger|apnap)\b/, { find: ['APNAP'], also: [{ find: ['If multiple abilities have triggered since the last time a player received priority'] }], label: 'ordering triggers' }],
    [/\b(?:miss(?:ed)? (?:a |my |the )?trigger|forgot (?:a |my |the )?trigger|may ability|optional)\b/, { head: 'Handling Triggered Abilities', label: 'triggered abilities' }],
    [/\b(?:replacement effect|instead|would die|would be destroyed)\b/, { head: 'Replacement Effects', label: 'replacement effects' }],
    [/\blayers?\b|\bdependenc|timestamp/, { head: 'Interaction of Continuous Effects', label: 'layers' }],
    [/\b(?:copy|copies|copying|clone)\b/, { head: 'Copying Objects', label: 'copying' }],
    [/\btokens?\b/, { head: 'Tokens', label: 'tokens' }],
    [/\b(?:\+1\/\+1|-1\/-1|counters? on|loyalty counter|poison counter|remove (?:a )?counter)\b/, { head: 'Counters', label: 'counters' }],
    [/\b(?:planeswalker|loyalty)\b/, { head: 'Planeswalkers', label: 'planeswalkers' }],
    [/\b(?:double[- ]?faced|transform|flip (?:it|the card)|back face|mdfc)\b/, { head: 'Double-Faced Cards', label: 'double-faced cards' }],
    [/\b(?:x spell|value of x|what is x|x cost|\{x\})\b/, { find: ['mana cost', '{X}', 'announces the value'], also: [{ find: ['If a card in any zone other than the stack has an {X}'] }], label: 'X in costs' }],
    [/\b(?:mana value|cmc|converted mana cost)\b/, { head: 'Mana Cost and Color', find: ['mana value of an object'], label: 'mana value' }],
    [/\b(?:color identity)\b/, { find: ['color identity of a card is'], label: 'color identity' }],
    [/\b(?:combat damage|assign(?:s|ing)? damage|double block|multiple blockers|damage order)\b/, { head: 'Combat Damage Step', label: 'combat damage' }],
    [/\b(?:declare (?:an? )?attack|attack(?:ing)? (?:a |my |the )?planeswalker|who can i attack|attack tax)\b/, { head: 'Declare Attackers Step', label: 'declaring attackers' }],
    [/\b(?:chump|declare block|block(?:ing)? (?:more than one|two|multiple)|can (?:it|i|a creature) block|tapped .*block|block .*tapped)\b/, { head: 'Declare Blockers Step', find: ['untapped creature'], label: 'declaring blockers' }],
    [/\b(?:untap step|upkeep|draw step|end step|cleanup|beginning of combat|main phase|until end of turn)\b/, { phases: true, label: 'turn structure' }],
    [/\b(?:mana pool|mana burn|floating mana|mana (?:empties|empty|goes away|disappear))\b/, { find: ['unspent mana', 'empties'], label: 'unspent mana' }],
    [/\b(?:concede|scoop|draw the game|tie)\b/, { head: 'Ending the Game', label: 'ending the game' }],
    [/\b(?:sorcery speed|at sorcery|any time i could cast a sorcery)\b/, { find: ['could cast a sorcery'], also: [{ find: ['A player may cast an instant spell any time they have priority'] }], label: 'sorcery timing' }],
    [/\b(?:aura|enchant(?:ed)? (?:creature|permanent)|equip(?:ment|ped)?)\b.*\b(?:dies|leaves|destroyed|fall off|falls off|goes away|happens|bounced|exiled)\b/, { find: ['Aura', 'illegal object or player', 'graveyard'], also: [{ find: ['Equipment', 'becomes unattached', 'remains on the battlefield'] }], label: 'attached permanents' }],
    [/\b(?:hybrid|phyrexian mana|generic mana|colorless)\b/, { head: 'Mana Cost and Color', find: ['hybrid'], label: 'mana symbols' }],
    [/\b(?:protection from|pro (?:red|blue|black|white|green))\b/, { head: 'Protection', label: 'protection' }],
    [/\b(?:sacrific\w+)\b.*\b(?:indestructible|regenerat\w+|hexproof|shroud|protection)\b|\b(?:indestructible|regenerat\w+|hexproof|shroud|protection)\b.*\bsacrific/, { find: ['To sacrifice a permanent', 'can’t be regenerated'], also: [{ head: 'Indestructible' }], label: 'sacrificing' }],
    [/\b(?:board ?wipe|wrath|destroy all|destroy(?:ed|s)?)\b/, { head: 'Destroy', label: 'destroying' }],
    [/\bcast(?:ing)? (?:from|out of) (?:the |my )?(?:graveyard|exile)|\bflashback\b/, { head: 'Flashback', label: 'flashback' }],
  ],
};
const MANY = /\b(?:stacks?|multiple|two|twice|double|both|redundant|several|2x|more than one|two instances|cumulative)\b/;

function glossaryTerms(pack) {
  const lines = pack.entries.filter(e => /^glossary-/.test(e.id)).map(e => e.text).join('\n').split('\n').map(s => s.trim()).filter(Boolean), out = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], prev = lines[i - 1] || '', next = lines[i + 1] || '';
    const isTerm = line.length <= 58 && line.split(' ').length <= 7 && /^[A-Z0-9“{+-]/.test(line) && !/^\d+\.\s/.test(line) && !/[.:;,”]$/.test(line) && (!prev || /[.”)]$/.test(prev)) && next && (/^[A-Z0-9“{(]/.test(next));
    if (isTerm) { cur = { label: line.replace(/\s*\((?:Obsolete|Informal)\)$/, ''), obsolete: /\(Obsolete\)$/.test(line), def: '' }; out.push(cur); }
    else if (cur) cur.def += (cur.def ? ' ' : '') + line;
  }
  return out.filter(t => t.def.length > 8);
}
const indexes = new WeakMap();
/** The rulebook read once into terms: every glossary term and every section heading, with where its rules live. */
export function judgeIndex(pack) {
  if (indexes.has(pack)) return indexes.get(pack);
  const entries = pack.entries.filter(e => !/^glossary-/.test(e.id) && !/contents|credits|^intro/i.test(e.id)), byId = new Map(entries.map(e => [normalizeRuleId(e.id), e]));
  const rows = entries.map(e => { const body = e.text.replace(/^\d{3}\.\d*[a-z]?\.?\s*/, ''); return { entry: e, id: normalizeRuleId(e.id), low: norm(body).replace(/\s+/g, ' '), heading: body.length < 60 && !/[.!?”]$/.test(body.trim()) && /^\d{3}\.\d*\.?$/.test(e.id) ? body.trim() : '' }; });
  const concepts = new Map(), add = (label, patch) => {
    const key = words(label).join(' '); if (!key || key.length < 2) return;
    const c = concepts.get(key) || { key, label, n: key.split(' ').length, def: '', sections: [], refs: [] };
    if (patch.def && !c.def) { c.def = patch.def; c.label = label; }
    if (patch.section && !c.sections.includes(patch.section)) c.sections.push(patch.section);
    for (const r of patch.refs || []) if (!c.refs.includes(r)) c.refs.push(r);
    concepts.set(key, c);
  };
  if (pack.game === 'mtg') {
    for (const r of rows) if (r.heading) add(r.heading, { section: r.id });
    for (const t of glossaryTerms(pack)) {
      if (t.obsolete) continue;
      const refs = [...t.def.matchAll(/rules? (\d{3}(?:\.\d+[a-z]?)?)/g)].map(m => m[1]).filter(id => byId.has(id) || byId.has(id + '.'));
      add(t.label, { def: t.def, refs });
    }
  }
  const index = { rows, byId, concepts, maxN: Math.max(1, ...[...concepts.values()].map(c => c.n)), mention: new Map() };
  indexes.set(pack, index); return index;
}
const phraseOf = c => norm(c.label).replace(/\s*\(.*\)$/, '');
function mentions(index, c) {
  if (index.mention.has(c.key)) return index.mention.get(c.key);
  const p = phraseOf(c), re = new RegExp('(?:^|[^a-z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|es|ed|ing)?(?![a-z])'), set = new Set(index.rows.filter(r => re.test(r.low)).map(r => r.id));
  index.mention.set(c.key, set); return set;
}
const inSection = (id, section) => { const s = section.replace(/\.$/, ''); return id === s || id.startsWith(s + '.') || (/\.\d+$/.test(s) && id.startsWith(s) && /^[a-z]$/.test(id.slice(s.length))); };
const sectionOf = (index, head, chapter = '') => index.rows.find(r => r.heading && norm(r.heading) === norm(head) && (!chapter || r.id.startsWith(chapter)))?.id || '';
const findRule = (index, phrases, within = '') => index.rows.find(r => !r.heading && (!within || inSection(r.id, within)) && phrases.every(p => r.low.includes(norm(p))));

/** Rulebook terms found in the words, longest first. Ordinary words (card, turn, player) never count alone. */
export function readTerms(pack, question) {
  const index = judgeIndex(pack), toks = words(question), found = [], used = new Set();
  for (let n = Math.min(index.maxN, 6); n >= 1; n--) for (let i = 0; i + n <= toks.length; i++) {
    if ([...Array(n).keys()].some(k => used.has(i + k))) continue;
    const key = toks.slice(i, i + n).join(' '), c = index.concepts.get(key);
    if (!c || (n === 1 && (STOP.has(key) || PLAIN.has(key) || key.length < 3))) continue;
    found.push({ ...c, at: i }); for (let k = 0; k < n; k++) used.add(i + k);
  }
  return found.sort((a, b) => a.at - b.at);
}
const passage = (pack, entry, why) => { const canonical = resolveRuleReference(pack, entryReference(pack.game, entry.id)); return { id: normalizeRuleId(entry.id), number: entry.id.replace(/\.$/, ''), reference: canonical?.reference || entryReference(pack.game, entry.id), source: canonical?.source || null, text: entry.text.replace(/^\d{3}\.\d*[a-z]?\.?\s*/, '').replace(/\s*\n\s*/g, ' ').trim(), why }; };
const headingFor = (index, id) => { const m = id.match(/^(\d{3})(?:\.(\d+))?/); if (!m) return ''; return (m[2] && index.rows.find(r => r.heading && r.id === m[1] + '.' + m[2])?.heading) || index.rows.find(r => r.heading && r.id === m[1])?.heading || ''; };

/**
 * Answer a rules question from the rulebook alone.
 * cards: [{name, text, keywords:[], rulings:[{date,text}]}] the caller already holds (never fetched here).
 * Returns {status:'answered'|'related'|'none', read:[labels], lead:{...passage}, rules:[passage], terms:[{label,def}], cards:[{name,text,rulings}], edition}.
 */
// The sentences of a long rulebook page that carry the words asked, in page order.
function bestSentences(text, qWords, max = 520) {
  const flat = text.replace(/\s*\n\s*/g, ' ').replace(/^THE POK[ÉE]MON TRADING CARD GAME: WEB RULEBOOK \| \d{4} \d+\s*/, '').trim(); if (flat.length <= max) return flat;
  const parts = flat.match(/[^.!?]+[.!?]+(?:[”"')]+)?\s*/g) || [flat], scored = parts.map((t, i) => { const w = new Set(words(t)); return { t, i, s: qWords.filter(x => w.has(x)).length }; });
  let best = 0, top = -1; for (let i = 0; i < scored.length; i++) { let n = 0, len = 0; for (let k = i; k < scored.length && len + scored[k].t.length <= max; k++) { n += scored[k].s; len += scored[k].t.length; } if (n > top) { top = n; best = i; } }
  let out = '', k = best; while (k < scored.length && out.length + scored[k].t.length <= max) out += scored[k++].t;
  return (best ? '… ' : '') + (out || flat.slice(0, max)).trim() + (k < scored.length ? ' …' : '');
}
export function judgeAnswer(pack, question, { format = '', cards = [], glossary = [], limit = 5 } = {}) {
  const index = judgeIndex(pack), q = norm(question), qWords = words(question).filter(w => !STOP.has(w));
  const read = [], score = new Map(), why = new Map(), bump = (id, n, reason) => { if (!index.byId.has(id) && !index.byId.has(id + '.')) return; score.set(id, (score.get(id) || 0) + n); if (reason && !why.has(id)) why.set(id, reason); };
  let anchored = false;
  // 1. A rule number in the words is the answer.
  for (const m of q.matchAll(/\b(\d{3}(?:\.\d+[a-z]?)?)\b/g)) { const row = index.rows.find(r => r.id === m[1]) || index.rows.find(r => r.id === m[1] + '.'); if (row) { anchored = true; read.push('rule ' + m[1]); bump(row.id, 500, 'rule ' + m[1]); index.rows.filter(r => r.id !== row.id && inSection(r.id, row.id)).slice(0, 6).forEach((r, i) => bump(r.id, 300 - i, 'rule ' + m[1])); } }
  // 2. Player sayings point at headings and rule wording.
  const said = [];
  for (const [pattern, to] of SAYINGS[pack.game] || []) {
    if (!pattern.test(q)) continue;
    const targets = [to, ...(to.also || [])]; let hit = false;
    targets.forEach((t, n) => {
      const section = t.head ? sectionOf(index, t.head, t.chapter) : '';
      if (t.phases) { for (const r of index.rows) if (r.heading && q.includes(norm(r.heading).replace(/ step| phase/, ''))) { index.rows.filter(x => inSection(x.id, r.id) && !x.heading).slice(0, 4).forEach((x, i) => bump(x.id, 60 - i * 4, to.label)); hit = true; } return; }
      const rule = t.find ? findRule(index, t.find, section) || (section ? null : findRule(index, t.find)) : null;
      if (rule) { bump(rule.id, 150 - n * 22, to.label); hit = true; }
      if (section) { index.rows.filter(r => inSection(r.id, section) && !r.heading).forEach((r, i) => bump(r.id, Math.max(3, (t.find ? 14 : 26) - n * 8 - i * 2), to.label)); hit = true; }
    });
    if (hit) { said.push(to.label); anchored = true; }
  }
  // 3. The rulebook's own terms in the words, plus keywords printed on the cards in play.
  let terms = readTerms(pack, question); const cardTerms = [];
  // "Does lifelink stack?" asks about two of the same keyword, not about the stack zone.
  const many = MANY.test(terms.filter(c => c.n > 1).reduce((text, c) => text.replace(phraseOf(c), ' '), q));
  if (many && terms.some(c => c.key !== 'stack' && c.sections.length)) terms = terms.filter(c => c.key !== 'stack');
  for (const card of cards) for (const k of card.keywords || []) { const c = index.concepts.get(words(k).join(' ')); if (c && !terms.some(t => t.key === c.key) && !cardTerms.some(t => t.key === c.key)) cardTerms.push({ ...c, card: card.name }); }
  const weight = c => { const n = mentions(index, c).size; return 6 + 22 / (1 + Math.log(1 + n)); };
  for (const [list, scale] of [[terms, 1], [cardTerms, 0.45]]) for (const c of list) {
    const w = weight(c) * scale;
    for (const s of c.sections) index.rows.filter(r => inSection(r.id, s) && !r.heading).forEach((r, i) => bump(r.id, w * (i === 0 ? 1.5 : 1) * (1 - Math.min(i, 12) * 0.03), c.label));
    c.refs.forEach(id => { const row = index.rows.find(r => r.id === id) || index.rows.find(r => r.id === id + '.'); if (!row) return; if (row.heading) index.rows.filter(r => inSection(r.id, row.id) && !r.heading).slice(0, 5).forEach((r, i) => bump(r.id, w * 0.9 - i, c.label)); else bump(row.id, w * 1.3, c.label); });
    for (const id of mentions(index, c)) bump(id, w * 0.55, c.label);
  }
  // 4. Two terms together: the rules that speak about both come first.
  const all = [...terms, ...cardTerms];
  if (all.length > 1) for (const r of index.rows) { const n = all.filter(c => mentions(index, c).has(r.id) || c.sections.some(s => inSection(r.id, s))).length, direct = terms.filter(c => mentions(index, c).has(r.id) || c.sections.some(s => inSection(r.id, s))).length; if (n > 1 && direct) bump(r.id, 38 * (n - 1) + (direct > 1 ? 30 : 0), 'covers ' + all.filter(c => mentions(index, c).has(r.id) || c.sections.some(s => inSection(r.id, s))).map(c => c.label).join(' and ')); }
  // Two keyword sections rarely name each other; the rulebook term they share (lethal damage, combat damage step) joins them.
  const withSections = terms.filter(c => c.sections.length);
  if (withSections.length > 1) {
    const sectionRows = withSections.map(c => index.rows.filter(r => !r.heading && c.sections.some(s => inSection(r.id, s))));
    for (const bridge of index.concepts.values()) {
      if (bridge.n < 2 || all.some(c => c.key === bridge.key)) continue;
      const phrase = phraseOf(bridge), per = sectionRows.map(list => list.filter(r => r.low.includes(phrase)));
      if (per.filter(list => list.length).length > 1) per.flat().forEach(r => bump(r.id, 46, 'both ' + withSections.map(c => c.label).join(' and ') + ' turn on ' + phrase));
    }
  }
  // 5. "Does it stack?": the rule about several instances of that keyword.
  if (many) for (const c of terms) for (const s of c.sections) index.rows.filter(r => inSection(r.id, s) && /multiple instances|more than one instance|redundant|each (?:one )?(?:works|triggers) separately/.test(r.low)).forEach(r => bump(r.id, 120, 'more than one ' + c.label));
  // 6. The remaining words break ties inside what the terms selected.
  const rest = qWords.filter(w => !PLAIN.has(w) || true);
  for (const [id] of score) { const row = index.rows.find(r => r.id === id); if (!row) continue; const rw = new Set(words(row.low)); let hits = 0; for (const w of rest) if (rw.has(w)) hits++; if (hits) bump(id, Math.min(24, hits * 4.5) / (1 + row.low.length / 2400)); }
  for (const t of terms) if (t.n > 1 || t.sections.length || mentions(index, t).size < 150) read.push(t.label); for (const s of said) if (!read.some(x => norm(x) === norm(s))) read.push(s);
  let ranked = [...score].map(([id, s]) => { const row = index.rows.find(r => r.id === id); return { row, s: !row ? 0 : s * (row.low.length < 56 ? 0.45 : 1) * ((row.low.match(/,/g) || []).length > 14 ? 0.3 : 1) }; }).filter(x => x.row && !x.row.heading && x.row.low.length > 12).sort((a, b) => b.s - a.s || a.row.id.localeCompare(b.row.id, 'en', { numeric: true }));
  // Each keyword asked about gets its own best rule near the top, so a two-keyword question shows both sides.
  const sided = terms.filter(c => c.sections.length);
  if (sided.length > 1) { const firsts = sided.map(c => ranked.find(x => c.sections.some(sec => inSection(x.row.id, sec)))).filter(Boolean), lead = ranked[0]; ranked = [...new Set([lead, ...firsts, ...ranked])]; }
  let status = ranked.length ? (anchored || terms.length ? 'answered' : 'related') : 'none', rules = ranked.slice(0, limit).map(x => passage(pack, x.row.entry, why.get(x.row.id) || ''));
  // 7. Nothing recognised: fall back to plain word matching over the rulebook, and say it is only related.
  if (!rules.length) { try { rules = retrieveRules(pack, question, { format, limit }).filter(p => { const rw = new Set(words(p.text)); return !/^glossary|contents/i.test(p.reference?.entryId || '') && (p.score >= 30 || (qWords.length > 1 && qWords.filter(w => rw.has(w)).length / qWords.length >= 0.75)); }).slice(0, limit).map(p => ({ id: normalizeRuleId(p.reference.entryId), number: String(p.reference.entryId).replace(/\.$/, ''), reference: p.reference, source: p.source, text: pack.game === 'mtg' ? p.text.replace(/^\d{3}\.\d*[a-z]?\.?\s*/, '').replace(/\s*\n\s*/g, ' ').trim() : bestSentences(p.text, qWords), heading: pack.game === 'mtg' ? '' : p.title, why: p.score >= 30 ? 'topic' : 'matching words' })); } catch { rules = []; } status = rules.length ? (rules[0].why === 'topic' ? 'answered' : 'related') : 'none'; }
  for (const r of rules) if (pack.game === 'mtg') r.heading = headingFor(index, r.id);
  // A long rule keeps its whole text, plus the sentences that carry the words asked so a small screen can lead with them.
  const focusWords = [...new Set([...qWords, ...terms.flatMap(t => t.key.split(' ')), ...said.flatMap(x => words(x))])];
  for (const r of rules) if (pack.game === 'mtg' && r.text.length > 420) r.focus = bestSentences(r.text.split(/\s+Example:/)[0], focusWords, 380);
  const definitions = terms.filter(t => t.def).slice(0, 3).map(t => ({ label: t.label, def: t.def }));
  // Pokémon and Yu-Gi-Oh! have no rulebook glossary: the app's own reviewed term notes stand in, marked as ours.
  for (const [, label, , aliases, summary, points] of glossary) { if (definitions.length >= 3) break; if ([label, ...(aliases || [])].some(a => new RegExp('(?:^|[^a-z])' + norm(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|es|ed|ing)?(?![a-z])').test(q))) { definitions.push({ label, def: summary, points: points || [], ours: true }); read.push(label); } }
  if (status === 'none' && definitions.length) status = 'related';
  // Cards: their printed text, and the official rulings that speak to the words asked.
  const cardRows = cards.slice(0, 4).map(card => {
    const termRe = [...terms, ...cardTerms].map(phraseOf);
    const rulings = (card.rulings || []).map(r => { const low = norm(r.text), rw = new Set(words(r.text)); let s = 0; for (const p of termRe) if (low.includes(p)) s += 5; for (const w of qWords) if (rw.has(w) && !PLAIN.has(w)) s += 2; for (const other of cards) if (other !== card && low.includes(norm(other.name))) s += 8; return { date: r.date || '', text: r.text, s }; }).filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map(({ date, text }) => ({ date, text }));
    return { name: card.name, text: card.text || '', rulings, rulingCount: (card.rulings || []).length };
  });
  return { status, read, lead: rules[0] || null, rules: rules.slice(1), terms: definitions, cards: cardRows, game: pack.game, format, edition: (pack.sources || [])[0] ? { title: pack.sources[0].title, date: pack.sources[0].date } : null };
}
