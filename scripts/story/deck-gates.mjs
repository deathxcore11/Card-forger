// The Story deck gates (Randall, 2 Nov 2026: "no silent substitution, ever"). One deck goes in, a list
// of FAIL and WARN lines comes out. check-story-deck.mjs runs these over every seat of an act, and
// validate-list.mjs runs them over a plain decklist (road-map drafts) before it becomes an act.
//
// Gates, in order:
//   1 identity   every row is a real printing in the pool, name matches Scryfall's
//   2 era        the printing's set belongs to the act; basic lands come from the act's land set
//   3 build      60 cards, at most 4 of a name (basics unlimited), Forge's Vintage rules (what Story runs on)
//   4 era rules  the act's historical banned and restricted list, from Forge's own archived formats
//   5 engine     the card exists in Forge; with a Forge root, AI:RemoveDeck:All fails, :Random warns
//   6 mana       every coloured pip has sources; too few sources warns, none or almost none fails
//   7 win        the deck has a real way to win: creatures, direct damage or an alternate win
//   8 label      Historical Exact / Historical Tribute / Experimental, and the label tells the truth
import {readFileSync, existsSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

export const BASIC = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest|Wastes)$/;
export const LABELS = {exact: 'Historical Exact', tribute: 'Historical Tribute', experimental: 'Experimental'};
const COLOR_LAND = {W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest'};

// Forge's own card scripts: which cards the CPU is told never to play. Read once per Forge root.
let aiCache = null;
export function forgeAiFlags(root) {
  if (aiCache) return aiCache;
  const zip = `${root}/forge/forge-gui/res/cardsfolder/cardsfolder.zip`, cache = '/tmp/story/forge-ai-flags.json';
  if (existsSync(cache)) return (aiCache = JSON.parse(readFileSync(cache, 'utf8')));
  if (!existsSync(zip)) return null;
  const text = execFileSync('unzip', ['-p', zip], {maxBuffer: 1 << 30, encoding: 'utf8'});
  const flags = {};
  for (const block of text.split(/\n(?=Name:)/)) {
    const name = block.match(/^Name:(.+)$/m)?.[1]?.trim(); if (!name) continue;
    if (/AI:RemoveDeck:All/.test(block)) flags[name.toLowerCase()] = 'All';
    else if (/AI:RemoveDeck:Random/.test(block)) flags[name.toLowerCase()] ||= 'Random';
  }
  try { writeFileSync(cache, JSON.stringify(flags)); } catch {}
  return (aiCache = flags);
}

// Forge's archived Vintage formats are the real historical lists (res/formats/Archived/Vintage/<date>.txt).
export function eraFormat(root, date) {
  const f = `${root}/forge/forge-gui/res/formats/Archived/Vintage/${date}.txt`;
  if (!root || !date || !existsSync(f)) return null;
  const t = readFileSync(f, 'utf8'), list = k => (t.match(new RegExp(`^${k}:(.*)$`, 'm'))?.[1] || '').split(';').map(s => s.trim()).filter(Boolean);
  return {date, name: t.match(/^Name:(.*)$/m)?.[1]?.trim() || date, sets: list('Sets').map(s => s.toLowerCase()), restricted: list('Restricted'), banned: list('Banned')};
}

// Coloured pips of one mana cost. Hybrid {W/U} counts for either side; Phyrexian and {2/W} can be paid otherwise.
function pips(cost) {
  const out = {};
  for (const m of String(cost || '').matchAll(/\{([^}]+)\}/g)) {
    const s = m[1];
    if (/^[WUBRG]$/.test(s)) out[s] = (out[s] || 0) + 1;
    else if (/^[WUBRG]\/[WUBRG]$/.test(s)) { const k = s; out[k] = (out[k] || 0) + 1; }
  }
  return out;
}
// What colours a card can make mana of (lands, mana rocks, mana creatures). Rituals don't count: they need the colour first.
export function produces(c) {
  if (!/Land|Artifact|Creature/.test(c.type)) return new Set();
  const out = new Set();
  for (const [k, land] of Object.entries(COLOR_LAND)) if (c.type.includes(land)) out.add(k);
  const text = c.text || '';
  if (/Add (?:one|two|three)? ?mana of any (?:one )?colou?r|mana of any colou?r|any type that a land/i.test(text)) 'WUBRG'.split('').forEach(k => out.add(k));
  for (const m of text.matchAll(/Add ([^.]*)/g)) for (const k of m[1].matchAll(/\{([WUBRG])\}/g)) out.add(k[1]);
  return out;
}
// Sources a coloured spell wants in a 60-card deck (a light version of Frank Karsten's tables).
const want = (n, cmc) => n >= 3 ? 16 : n === 2 ? (cmc <= 3 ? 14 : 12) : (cmc <= 1 ? 12 : cmc <= 3 ? 10 : 8);

const DAMAGE = /deals? (?:\d+|X|that much|damage equal)[^.]*damage to (?:any target|target (?:creature or )?player|each (?:opponent|player)|that player|target opponent)|deals? \d+ damage to (?:each|that) player|loses? (?:\d+|X) life/i;

// deck: {name, label, original?, changes?, rules?, cards: [{qty, name, set, number, id?}]}
// ctx: {pool: Map(set#number -> card), act: {sets, landSet}, forgeRoot?, era?}
export function checkDeck(deck, ctx) {
  const fail = [], warn = [], info = [];
  const rows = [];
  let total = 0;
  const counts = new Map();
  // 1-3: identity, era, build.
  for (const r of deck?.cards || []) {
    total += r.qty;
    const c = ctx.pool.get(r.set + '#' + r.number);
    if (!c) { fail.push(`identity: ${r.name} ${r.set} #${r.number} is not a printing in this act`); continue; }
    if (c.name !== r.name) fail.push(`identity: ${r.set} #${r.number} is "${c.name}", list says "${r.name}"`);
    if (r.id && r.id !== c.id) fail.push(`identity: ${c.name} printing id does not match ${r.set} #${r.number}`);
    if (!ctx.act.sets.includes(r.set)) fail.push(`era: ${c.name} from ${r.set}, outside this act`);
    if (BASIC.test(c.name)) { if (ctx.act.landSet && r.set !== ctx.act.landSet) fail.push(`era: basic ${c.name} from ${r.set}, must be ${ctx.act.landSet}`); }
    else counts.set(c.name, (counts.get(c.name) || 0) + r.qty);
    if (['banned', 'not_legal'].includes(c.vintage)) fail.push(`build: ${c.name} is not legal in Vintage, which Story matches run on`);
    rows.push({r, c});
  }
  if (!rows.length) fail.push('build: no cards');
  if (total !== 60) fail.push(`build: ${total} cards, needs 60`);
  for (const [n, q] of counts) if (q > 4) fail.push(`build: ${q} copies of ${n}, max 4`);
  for (const {c} of rows) if (c.vintage === 'restricted' && counts.get(c.name) > 1) fail.push(`build: ${c.name} is restricted in Vintage, max 1`);
  // 4: the era's own banned and restricted list (Forge archived format).
  if (ctx.era) {
    for (const [n, q] of counts) {
      if (ctx.era.banned.includes(n)) warn.push(`era rules: ${n} was banned in ${ctx.era.name}`);
      else if (ctx.era.restricted.includes(n) && q > 1) warn.push(`era rules: ${n} was restricted in ${ctx.era.name}, deck has ${q}`);
    }
  }
  // 5: engine support and the CPU's own "never play this" flags.
  const ai = ctx.forgeRoot ? forgeAiFlags(ctx.forgeRoot) : null;
  for (const {c} of rows) {
    if (!c.forge) fail.push(`engine: ${c.name} is not in Forge`);
    const f = ai?.[c.name.toLowerCase()];
    if (f === 'All') fail.push(`engine: Forge's CPU never plays ${c.name} (AI:RemoveDeck:All)`);
    else if (f === 'Random') info.push(`engine: ${c.name} is AI:RemoveDeck:Random (fine in a fixed deck)`);
  }
  if (!ai) info.push('engine: AI flags not checked (no Forge root)');
  // 6: mana. Sources per colour against what the spells ask for.
  const src = {W: 0, U: 0, B: 0, R: 0, G: 0};
  let lands = 0;
  for (const {r, c} of rows) {
    if (/Land/.test(c.type)) lands += r.qty;
    for (const k of produces(c)) src[k] += r.qty;
  }
  const need = {}, users = {};
  for (const {r, c} of rows) if (!/Land/.test(c.type)) for (const k of Object.keys(pips(c.mana_cost))) users[k] = (users[k] || 0) + r.qty;
  for (const {c} of rows) {
    if (/Land/.test(c.type)) continue;
    for (const [k, n] of Object.entries(pips(c.mana_cost))) {
      const opts = k.split('/'), have = Math.max(...opts.map(o => src[o] || 0));
      // A splash (one or two cards of a colour) only asks for a few sources.
      const key = opts.join('/'), w = users[k] <= 2 && n === 1 ? 6 : want(n, c.cmc);
      if (!need[key] || need[key].w < w) need[key] = {w, have, card: c.name, n};
    }
  }
  for (const [k, {w, have, card, n}] of Object.entries(need)) {
    if (have === 0) fail.push(`mana: ${card} needs {${k}} and nothing in the deck makes it`);
    else if (have < Math.ceil(w * 0.6)) fail.push(`mana: ${card} needs ${n} {${k}}, only ${have} sources (wants ${w})`);
    else if (have < w) warn.push(`mana: ${have} {${k}} sources for ${card} (wants ${w})`);
  }
  if (lands < 16 || lands > 26) warn.push(`mana: ${lands} lands`);
  // 7: a way to win.
  let bodies = 0, burn = 0, alt = 0;
  for (const {r, c} of rows) {
    if (/Creature/.test(c.type) || /becomes? an? [^.]*creature|create[^.]*creature token/i.test(c.text)) bodies += r.qty;
    if (DAMAGE.test(c.text)) burn += r.qty;
    if (/wins? the game|loses the game/i.test(c.text)) alt += r.qty;
  }
  if (bodies < 8 && burn < 8 && !alt) fail.push(`win: no clear way to win (${bodies} creatures, ${burn} damage cards)`);
  // 8: the label tells the truth.
  const label = deck?.label;
  if (!LABELS[label]) fail.push(`label: needs exact, tribute or experimental (has ${label || 'none'})`);
  if (label === 'experimental' && !deck.rules) fail.push('label: Experimental decks say which special rules they use');
  if (deck?.original) {
    // A partial original (only some counts are sourced) is compared on the names it lists.
    const diff = diffLists(deck.original.list, rows.map(({r, c}) => ({qty: r.qty, name: c.name})), !!deck.original.partial);
    if (label === 'exact' && deck.original.partial) fail.push('label: Historical Exact needs the full original list');
    if (label === 'exact' && diff.length) fail.push(`label: called Historical Exact but differs from ${deck.original.source}: ${diff.map(d => d.text).join('; ')}`);
    const said = (deck.changes || []).map(ch => (ch.from + ' ' + ch.to).toLowerCase());
    for (const d of diff) if (!said.some(s => s.includes(d.name.toLowerCase()))) fail.push(`label: silent change, ${d.text} is not explained`);
  } else if (label === 'exact') fail.push('label: Historical Exact needs the original list and its source');
  return {fail: [...new Set(fail)], warn: [...new Set(warn)], info: [...new Set(info)], total, lands, src};
}

// Compare a documented list ("4 Black Vise\n...") with the deck as built. Returns one entry per name that differs.
export function diffLists(originalText, rows, partial = false) {
  const a = new Map(), b = new Map();
  for (const line of String(originalText).trim().split('\n')) { const m = line.trim().match(/^(\d+)\s+(.+)$/); if (m) a.set(m[2], (a.get(m[2]) || 0) + +m[1]); }
  for (const r of rows) b.set(r.name, (b.get(r.name) || 0) + r.qty);
  const out = [];
  for (const n of new Set([...a.keys(), ...(partial ? [] : b.keys())])) {
    const x = a.get(n) || 0, y = b.get(n) || 0;
    if (x !== y) out.push({name: n, from: x, to: y, text: `${n} ${x} -> ${y}`});
  }
  return out;
}
