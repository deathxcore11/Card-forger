// Shared, DOM-free Rules retrieval. Only server-loaded, integrity-pinned assets are evidence.
import { RULE_VERSIONS, RULE_SOURCES, entryReference, findRuleEntry, normalizeRuleId, resolveRuleReference, validateDecodedRulePack } from './rule-reference.js';

const FILES = Object.freeze({ mtg: '/rulebooks/mtg-rules-v1.json.gz', ptcg: '/rulebooks/ptcg-rules-v1.json.gz', ygo: '/rulebooks/ygo-rules-v1.json.gz' });
const COUNTS = Object.freeze({ mtg: 3375, ptcg: 114, ygo: 48 });
const serverPacks = new WeakMap();
const canonicalIndexes = new WeakMap();
const searchIndexes = new WeakMap();
function canonicalIndex(pack) {
  if (canonicalIndexes.has(pack)) return canonicalIndexes.get(pack);
  const groups = new Map();
  for (const e of pack.entries) { const key = `${e.doc}:${normalizeRuleId(e.id)}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e); }
  const index = new Map();
  for (const [key, entries] of groups) index.set(key, findRuleEntry({ game: pack.game, entries }, entries[0].id, entries[0].doc));
  canonicalIndexes.set(pack, index); return index;
}
const fail = (message, status = 503) => Object.assign(new Error(message), { status });
export async function validateServerRuleText(raw, game) {
  if (!RULE_VERSIONS[game] || typeof raw !== 'string' || raw.length > 5000000) throw fail('The selected rules source is unavailable.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (digest !== RULE_VERSIONS[game]) throw fail('The rules source failed its edition check. Reference and learning remain available.');
  let pack; try { pack = JSON.parse(raw); } catch { throw fail('The rules source is unreadable.'); }
  if (!validateDecodedRulePack(pack, game, { count: COUNTS[game] })) throw fail('The rules source does not match this game.');
  return { ...pack, version: RULE_VERSIONS[game], sources: RULE_SOURCES[game] };
}
export async function loadServerRulePack(env, game) {
  if (!FILES[game] || !env.ASSETS?.fetch) throw fail('The rules reference is unavailable to the guide. You can still open the Rules library.');
  let cache = serverPacks.get(env.ASSETS); if (!cache) serverPacks.set(env.ASSETS, cache = new Map());
  if (cache.has(game)) return cache.get(game);
  const pending = (async () => {
    // Never accept a client or model URL/path, including a manifest-supplied path.
    const response = await env.ASSETS.fetch(new Request('https://cardstashy.rules.invalid' + FILES[game]));
    if (!response.ok) throw fail('The bundled rules reference could not be loaded.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 2000000) throw fail('The rules reference is too large to verify.');
    let raw;
    if (bytes[0] === 31 && bytes[1] === 139) {
      if (typeof DecompressionStream === 'undefined') throw fail('The rules reference cannot be unpacked right now.');
      raw = await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))).text();
    } else raw = new TextDecoder().decode(bytes);
    return validateServerRuleText(raw, game);
  })();
  cache.set(game, pending); pending.catch(() => { if (cache.get(game) === pending) cache.delete(game); });
  return pending;
}
const norm = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const STOP = new Set('a an the can could may i my me you your we our it its is are was be been do does did how what which when where why if of to for on in at by and or with from about rule rules game card cards please would should have has this that'.split(' '));
const terms = value => [...new Set((norm(value).match(/[a-z0-9]+/g) || []).filter(x => x.length > 1 && !STOP.has(x)))];
// Topic aliases guide ranking; their labels/text are never passed as official evidence.
const TOPICS = {
  mtg: [ [/summoning sickness|first turn.*attack|attack.*first turn/, ['302.6', '702.10']], [/priority|respond|response|stack/, ['117', '405', '608']], [/target|fizzle/, ['115', '608.2b']], [/combat damage|block|trample/, ['510', '509', '702.19']], [/draw step|draw.*turn/, ['504']], [/mulligan|opening hand/, ['103.5']], [/commander/, ['903']], [/counter/, ['701.5', '122']], [/flying|reach/, ['702.9', '702.17']], [/ward|hexproof/, ['702.21', '702.11']], [/scry/, ['701.22']] ],
  ptcg: [ [/first turn|going first|go first|starting player/, ['0-p9', '0-p11', '0-p12', '0-p13']], [/attack|energy cost/, ['0-p13', '0-p14']], [/draw|empty deck/, ['0-p10']], [/evolv|evolution/, ['0-p11']], [/attach|energy/, ['0-p11', '0-p13']], [/retreat|supporter|trainer|abilit/, ['0-p12']], [/poison|burn|asleep|sleep|paraly|confus|checkup|condition/, ['0-p15', '0-p16']], [/prize|knock|damage counter/, ['0-p14']], [/rare candy/, ['2-p2', '0-p11']], [/pokemon tool/, ['2-p1']], [/mulligan|setup|set up/, ['0-p8', '0-p18']] ],
  ygo: [ [/first turn|draw phase|standby/, ['0-p20', '0-p21']], [/chain|spell speed|quick effect|respond/, ['0-p25', '0-p26']], [/normal summon|tribute|special summon/, ['0-p15']], [/attack|battle|damage step/, ['0-p21', '0-p23', '0-p24']], [/link|extra deck|pendulum/, ['0-p9', '0-p10', '0-p11']], [/negate|target|cost/, ['0-p29', '0-p30']] ],
};
export const citationId = (game, entry) => `${game}:${entry.doc}:${normalizeRuleId(entry.id)}`;
export function isContentsEntry(entry) { return /\b(?:table of contents|contents)\b/i.test(entry.text.slice(0, 600)) && (entry.text.match(/\.{4,}/g) || []).length >= 3; }
function applicable(pack, entry, question, format) {
  if (isContentsEntry(entry) || canonicalIndex(pack).get(`${entry.doc}:${normalizeRuleId(entry.id)}`) !== entry) return false;
  if (pack.game === 'mtg' && entry.doc !== 0) return false;
  // Alternative-play rules cannot silently become Standard gameplay evidence.
  if (pack.game === 'ptcg' && entry.doc === 3) {
    if (!/^(glc|gym leader challenge)$/i.test(format)) return false;
    if (/^(glc|gym leader challenge)$/i.test(format) && entry.id !== '3-p27') return false;
    if (!/alternative|gym leader|glc|raid|team|ditto|cube|draft|build.*battle/i.test(`${question} ${format}`)) return false;
  }
  if (pack.game === 'ptcg' && entry.doc === 1 && !/tournament|penalt|judge|time limit|sleeve|match|best.of|slow play|procedure/i.test(question)) return false;
  return true;
}
function passageText(entry, queryTerms, max = 4800) {
  const text = entry.text;
  if (text.length <= max) return { text, excerpt: false };
  let best = 0, score = -1;
  for (let i = 0; i < text.length; i += 1200) {
    const part = norm(text.slice(i, i + max)), n = queryTerms.reduce((s, t) => s + Number(part.includes(t)), 0);
    if (n > score) { score = n; best = i; }
  }
  return { text: text.slice(best, best + max), excerpt: true };
}
export function retrieveRules(pack, question, { format = '', references = [], limit = 8 } = {}) {
  if (!pack || pack.version !== RULE_VERSIONS[pack.game]) throw fail('The source edition changed. Reload the guide.', 409);
  const query = norm(question), queryTerms = terms(question), boosts = new Map();
  const boost = (entry, amount) => { if (entry && applicable(pack, entry, question, format)) boosts.set(citationId(pack.game, entry), Math.max(amount, boosts.get(citationId(pack.game, entry)) || 0)); };
  for (const reference of references) {
    const resolved = resolveRuleReference(pack, reference);
    if (!resolved?.entry) throw fail('A selected rule does not belong to this game and source edition.', 400);
    boost(resolved.entry, 130); resolved.entries.slice(1, 5).forEach(e => boost(e, 95));
  }
  const exacts = query.match(/\b\d{3}(?:\.\d+[a-z]?)?\b|\b\d+-p\d+\b/g) || [];
  for (const id of exacts) {
    const ref = entryReference(pack.game, id), resolved = resolveRuleReference(pack, ref);
    if (resolved) { boost(resolved.entry, 140); resolved.entries.slice(1, 5).forEach(e => boost(e, 100)); }
  }
  for (const [pattern, ids] of TOPICS[pack.game] || []) if (pattern.test(query)) for (const id of ids) {
    const reference = entryReference(pack.game, id), resolved = resolveRuleReference(pack, reference);
    if (resolved) { boost(resolved.entry, 40); resolved.entries.slice(1, 3).forEach(e => boost(e, 32)); }
  }
  const candidates = pack.entries.filter(e => applicable(pack, e, question, format));
  if (!searchIndexes.has(pack)) searchIndexes.set(pack, new Map([...canonicalIndex(pack).values()].map(entry => [entry, { entry, words: terms(entry.text), title: norm(entry.title) }])));
  const docs = candidates.map(entry => searchIndexes.get(pack).get(entry));
  const df = new Map(queryTerms.map(t => [t, docs.filter(d => d.words.some(w => w === t || (t.length > 4 && w.startsWith(t.replace(/(?:ing|ed|s)$/, ''))))).length]));
  const ranked = docs.map(d => {
    let hits = 0, score = boosts.get(citationId(pack.game, d.entry)) || 0;
    for (const t of queryTerms) {
      const stem = t.length > 4 ? t.replace(/(?:ing|ed|s)$/, '') : t;
      if (d.words.some(w => w === t || (stem.length > 3 && w.startsWith(stem)))) { hits++; score += (1 + Math.log(1 + docs.length / (1 + df.get(t)))) * (d.title.includes(t) ? 1.6 : 1) / (1 + d.words.length / 350); }
    }
    if (queryTerms.length > 1 && hits / queryTerms.length < 0.34 && !boosts.has(citationId(pack.game, d.entry))) score = 0;
    return { entry: d.entry, score };
  }).filter(d => d.score >= 2.5).sort((a, b) => b.score - a.score || a.entry.doc - b.entry.doc || a.entry.page - b.entry.page);
  const selected = ranked.slice(0, Math.min(limit, 6));
  // Add only close, same-document context; never confuse a same ID extraction fragment.
  for (const { entry } of selected.slice(0, 2)) {
    const at = pack.entries.indexOf(entry);
    for (const neighbor of [pack.entries[at - 1], pack.entries[at + 1]]) {
      if (selected.length >= limit) break;
      if (neighbor && neighbor.doc === entry.doc && (pack.game !== 'mtg' || normalizeRuleId(neighbor.id).slice(0, 3) === normalizeRuleId(entry.id).slice(0, 3)) && Math.abs(neighbor.page - entry.page) <= 1 && applicable(pack, neighbor, question, format) && !selected.some(x => x.entry === neighbor)) selected.push({ entry: neighbor, score: 0, neighbor: true });
    }
  }
  let budget = 22000;
  return selected.map(({ entry, score, neighbor }) => {
    const excerpt = passageText(entry, queryTerms, Math.max(0, Math.min(4800, budget))); budget -= excerpt.text.length;
    const canonical = resolveRuleReference(pack, entryReference(pack.game, entry.id));
    return { id: citationId(pack.game, entry), reference: canonical.reference, title: entry.title, source: canonical.source, ...excerpt, neighbor: !!neighbor, score };
  }).filter(p => p.text.length > 20);
}
export function sourceCoverage(game) {
  return {
    game, version: RULE_VERSIONS[game], entryCount: COUNTS[game],
    sources: RULE_SOURCES[game],
    limitations: [
      'Dated bundled excerpts, not a live rules or ban-list service. Text extraction can omit symbols and diagrams.',
      ...(game === 'ygo' ? ['Only legacy version 10 and the 2017 guide are indexed. The later 2021 update is external, not indexed; current interactions may be unsupported.'] : []),
      ...(game === 'ptcg' ? ['Official source links were checked on 2026-10-17, but live Pokémon PDF contents could not be verified. Current errata and format rules take precedence.'] : []),
    ],
  };
}
