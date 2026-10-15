// On-demand AI coaching. Selected deck data leaves the device only after the user taps Review.
// The app sends what it already knows (Power's numbers, a sample hand, owned swap candidates),
// the AI returns decisions (lines, stress tests, swaps), and the app checks them in code before
// showing them: cards in the list, copies, per-turn limits, mana by turn, and re-scored swaps.
import { esc } from './ui.js';
import { aiOrb } from './ai-ui.js';
import { review } from './deckaudit.js';
import { competitiveScore } from './scouting.js';
const entries = new Map();
let activeDialog = null;
const plain = s => String(s ?? '').replace(/<[^>]*>/g, ' ').trim();
const pct = v => Math.round(v * 100) + '%';
const nm = x => typeof x === 'string' ? x : x?.name || x?.label || x?.key || '';
const names = (xs, n = 8) => (xs || []).slice(0, n).map(nm).filter(Boolean).join(', ');
const textOf = c => plain([c?.oracle_text, ...(c?.card_faces || []).map(f => f.oracle_text), c?.text, c?.desc, ...(c?.abilities || []).map(a => a.effect), ...(c?.attacks || []).map(a => a.effect)].filter(Boolean).join('\n'));
// The app's own card art: Scryfall images for Magic, the cached image for Yu-Gi-Oh!/Pokémon.
export const artOf = c => c?.image_uris?.normal || c?.image_uris?.small || c?.card_faces?.[0]?.image_uris?.normal || c?.image || c?.imageLarge || '';
const typeOf = c => c?.type_line || c?.typeLine || c?.card_faces?.[0]?.type_line || c?.type || '';

/* ---------- What the app sends ---------- */

function deckRows(game, deck, lookup) {
  const rows = game === 'mtg' ? [...(deck.cards || []).map(r => ({ ...r, zone: 'main' })), ...(deck.side || []).map(r => ({ ...r, zone: 'side' }))] : Object.entries(deck.zones || {}).flatMap(([zone, rows]) => rows.map(r => ({ ...r, zone })));
  return rows.map((r, i) => {
    const c = lookup(game === 'mtg' ? r.name : r.cardId);
    const zone = game === 'mtg' && deck.commander && r.name === deck.commander && r.zone === 'main' ? 'commander' : r.zone;
    return { id: 'c' + i, row: r, c, zone };
  });
}
function cardDetails(game, c) {
  if (!c) return '';
  return game === 'mtg' ? JSON.stringify({ mana: c.mana_cost, mv: c.cmc, identity: c.color_identity, power: c.power, toughness: c.toughness, produces: c.produced_mana, faces: c.card_faces?.map(x => ({ name: x.name, type: x.type_line, mana: x.mana_cost, text: x.oracle_text })) })
    : JSON.stringify(game === 'ptcg' ? { stage: c.stage, evolvesFrom: c.evolveFrom, hp: c.hp, types: c.types, abilities: c.abilities, attacks: c.attacks, weaknesses: c.weaknesses, retreat: c.retreat, regulationMark: c.regulationMark } : { attribute: c.attribute, race: c.race, level: c.level, atk: c.atk, def: c.def, link: c.link, archetype: c.archetype });
}
const cardEntry = (game, id, name, qty, zone, c) => ({ id, name: c?.name || name, qty, zone, type: typeOf(c), text: plain(c?.oracle_text || c?.text || c?.desc || ''), details: cardDetails(game, c), known: !!c && !c.brief });

// The card's real cost or role, from card data (never from the AI).
export function costOf(game, c) {
  if (!c) return '';
  const t = typeOf(c);
  if (game === 'mtg') return /\bLand\b/.test(t) ? 'Land' : c.mana_cost ? c.mana_cost.replace(/[{}]/g, '') : c.card_faces?.[0]?.mana_cost?.replace(/[{}]/g, '') || '0';
  if (game === 'ptcg') return c.category === 'Pokemon' ? [c.stage, c.hp ? c.hp + ' HP' : ''].filter(Boolean).join(' · ') : /Supporter|Item|Tool|Stadium/.exec(t)?.[0] || c.category || '';
  return c.level ? `Level ${c.level}` : c.link ? `Link-${c.link}` : /Spell|Trap/.exec(t)?.[0] || '';
}
function composition(game, rows) {
  const out = [], main = rows.filter(r => r.zone !== 'side' && r.c), count = f => main.filter(f).reduce((n, r) => n + r.row.qty, 0);
  if (game === 'mtg') {
    const t = r => typeOf(r.c), land = r => /\bLand\b/.test(t(r));
    out.push('Card types: ' + ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Land'].map(k => `${k} ${count(r => new RegExp('\\b' + k + '\\b').test(t(r)))}`).join(', '));
    const curve = {}; for (const r of main.filter(r => !land(r))) { const k = Math.min(7, Math.floor(r.c.cmc || 0)); curve[k] = (curve[k] || 0) + r.row.qty; }
    out.push('Nonland mana curve: ' + Object.entries(curve).map(([k, n]) => `${k === '7' ? '7+' : k}: ${n}`).join(', '));
    const legend = main.filter(r => /\bLegendary\b/.test(t(r)) && !/\b(Instant|Sorcery)\b/.test(t(r)));
    if (legend.length) {
      const by = {}; for (const r of legend) { const k = land(r) ? 'land' : Math.min(7, Math.floor(r.c.cmc || 0)); (by[k] ||= []).push(r.c.name); }
      out.push(`Legendary permanents: ${legend.reduce((n, r) => n + r.row.qty, 0)} (by mana value: ${Object.entries(by).map(([k, xs]) => `${k}: ${xs.length}`).join(', ')}). ${legend.slice(0, 30).map(r => r.c.name).join(', ')}`);
    }
    const ramp = main.filter(r => !land(r) && r.c.produced_mana?.length);
    out.push(`Nonland mana sources: ${count(r => !land(r) && r.c.produced_mana?.length)}${ramp.length ? ' — ' + names(ramp.map(r => r.c), 15) : ''}`);
  } else if (game === 'ptcg') {
    const poke = r => r.c.category === 'Pokemon', tl = r => typeOf(r.c);
    out.push(`Pokémon ${count(poke)} (Basic ${count(r => poke(r) && /basic/i.test(r.c.stage || ''))}, Stage 1 ${count(r => poke(r) && /1/.test(r.c.stage || ''))}, Stage 2 ${count(r => poke(r) && /2/.test(r.c.stage || ''))}), Trainers ${count(r => r.c.category === 'Trainer')} (Supporter ${count(r => /Supporter/.test(tl(r)))}, Item ${count(r => /Item/.test(tl(r)))}, Tool ${count(r => /Tool/.test(tl(r)))}, Stadium ${count(r => /Stadium/.test(tl(r)))}), Energy ${count(r => r.c.category === 'Energy')}`);
    const lines = main.filter(r => poke(r) && r.c.evolveFrom).map(r => `${r.row.qty}× ${r.c.name} from ${r.c.evolveFrom}`);
    if (lines.length) out.push('Evolutions: ' + lines.join(', '));
  } else {
    const t = r => typeOf(r.c), extra = main.filter(r => r.zone === 'extra');
    out.push(`Main Deck: Monsters ${count(r => r.zone === 'main' && !/Spell|Trap/.test(t(r)))}, Spells ${count(r => r.zone === 'main' && /Spell/.test(t(r)))}, Traps ${count(r => r.zone === 'main' && /Trap/.test(t(r)))}. Extra Deck ${extra.reduce((n, r) => n + r.row.qty, 0)}: ${['Fusion', 'Synchro', 'XYZ', 'Link'].map(k => `${k} ${count(r => r.zone === 'extra' && new RegExp(k, 'i').test(t(r)))}`).join(', ')}`);
  }
  return out;
}
export function deckFacts(game, rows, p) {
  const f = [...composition(game, rows)];
  if (!p) return f;
  f.push(`App scores: engine ${p.heuristic ?? p.score ?? '—'}/100${p.ctx?.score != null ? `, competitive ${p.ctx.score}/100` : ''}. Plan the app detected: ${p.plan || 'unknown'}.`);
  for (const s of p.sims || []) if (Number.isFinite(s.p)) f.push(`Hand odds · ${s.label}: ${pct(s.p)}${s.target != null ? ` (aim ${s.lower ? 'under' : 'over'} ${pct(s.target)})` : ''}${s.note ? ' — ' + s.note : ''}`);
  const g = p.goldfish;
  if (g) {
    if (g.headline) f.push('Played-out goldfish games: ' + g.headline);
    for (const m of g.metrics || []) if (m.value != null) f.push(`Goldfish · ${m.label}: ${m.pct ? pct(m.value) : typeof m.value === 'number' ? +m.value.toFixed(2) : m.value}${m.note ? ' ' + m.note : ''}`);
    if (g.winCon) f.push('How the goldfish wins: ' + g.winCon);
    if (g.endgame) f.push('Goldfish late game: ' + g.endgame);
  }
  for (const l of p.engine?.links || []) f.push(`Rules-text link: ${l.payoff} needs ${l.need}; provided by ${names(l.providers, 6)}${l.openingBoth != null ? `; opens both ${pct(l.openingBoth)}` : ''}`);
  if (p.engine?.unmappedNeeds) f.push(`${p.engine.unmappedNeeds} card requirements have no recognized provider in the list.`);
  const m = p.match;
  if (m?.deck) f.push(`Closest tournament list: ${m.archetype || m.deck.name}, ${pct(m.sim || 0)} similar, ${m.deck.place || ''} at ${m.deck.event || 'an event'}${m.missing?.length ? '. That list plays these you don\'t: ' + names(m.missing, 10) : ''}${m.extra?.length ? '. You play these it doesn\'t: ' + names(m.extra, 10) : ''}`);
  if (p.ctx?.coreMissing?.length) f.push('Core cards of the archetype missing: ' + names(p.ctx.coreMissing));
  if (p.ctx?.field?.length) f.push('Field: ' + p.ctx.field.slice(0, 6).map(x => `${x.name} ${pct(x.share || 0)}`).join(', '));
  for (const a of p.strategicRisk?.axes || []) f.push(`Exposed to hate: ${a.label} (${a.copies} copies: ${names(a.cards, 5)})${a.threats?.length ? '; answers seen in the field: ' + names(a.threats, 4) : ''}`);
  if (p.upgrades?.adds?.length) f.push('Same-archetype lists also play: ' + names(p.upgrades.adds, 8));
  for (const i of p.readiness?.issues || []) f.push('Deck check: ' + i);
  return f.slice(0, 90);
}
// A shuffled opening hand, the same for the same list (so reopening shows the same hand).
// Deck Power's analysis as the coach sees it: every area with Power's own status, points lost and
// ranking (score limits first, then weak areas by points lost). The coach explains these; it
// never sets a status itself.
export function powerSummary(p) {
  if (!p) return { areas: [], priority: [] };
  const R = review(p.parts || []), weak = new Set(R.weak.map(x => x.key)), strong = new Set(R.strong.map(x => x.key));
  const caps = (p.caps || []).map(c => ({ key: 'cap:' + c.key, label: c.label, count: '', target: '', status: 'cap', lost: 100 - (c.max ?? 100), max: c.max, why: c.why || '', cards: [] }));
  const parts = R.scored.map(x => ({ key: x.key, label: x.label || x.key, count: Number.isFinite(x.count) ? x.count : String(x.count ?? ''), target: Number.isFinite(x.target) ? x.target : String(x.target ?? ''), ratio: x.ratio, status: weak.has(x.key) ? 'weak' : strong.has(x.key) ? 'strong' : 'ok', lost: Math.round(x.lost * 10) / 10, why: x.why || x.hint || '', cards: (x.cards || []).map(nm).filter(Boolean).slice(0, 12) }));
  const comp = competitiveScore(p);
  return { score: comp ?? p.score, engine: p.heuristic ?? p.score, competitive: comp ?? null, verdict: p.caps?.[0] ? `Held to ${p.caps[0].max} by ${p.caps[0].label}` : '', plan: p.plan || '', areas: [...caps, ...parts], priority: [...caps.map(c => c.key), ...R.weak.map(x => x.key)] };
}
export function sampleHand(game, rows, seed) {
  const lib = rows.filter(r => r.zone === 'main' && r.c).flatMap(r => Array(r.row.qty).fill(r.id)), n = game === 'ygo' ? 5 : 7;
  if (lib.length < n) return [];
  let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  for (let i = lib.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]]; }
  return lib.slice(0, n);
}
export function reviewPayload(game, deck, lookup, p) {
  const rows = deckRows(game, deck, lookup);
  // Which Power areas each card counts toward, from Power's own card lists.
  const areasOf = new Map();
  for (const x of p?.parts || []) for (const c of x.cards || []) { const k = String(nm(c)).toLowerCase(); if (k) (areasOf.get(k) || areasOf.set(k, new Set()).get(k)).add(x.label || x.key); }
  const cards = rows.map(r => { const e = cardEntry(game, r.id, r.row.name || String(r.row.cardId), r.row.qty, r.zone, r.c), a = areasOf.get(String(e.name).toLowerCase()); return a?.size ? { ...e, power: [...a].join(', ') } : e; });
  const base = { game, format: p.formatName || deck.format || '', commander: game === 'mtg' ? deck.commander || '' : '', cards };
  return { ...base, power: powerSummary(p), facts: deckFacts(game, rows, p), hand: sampleHand(game, rows, JSON.stringify(cards.map(c => [c.name, c.qty, c.zone]))), checks: { engine: p.heuristic ?? p.score, competitive: p.ctx?.score ?? null, provisional: !!p.readiness?.provisional, issues: [...(p.readiness?.issues || []), ...(p.caps || []).map(c => `${c.label}: ${c.why || ''}`)] } };
}

/* ---------- What the app checks ---------- */

const OPT = /once per turn|only once each turn|activate only once/i;
// Code checks of one line. Returns plain-language problems; empty means every check passed.
export function checkLine(game, line, info) {
  line = { ...line, steps: (line.steps || []).filter(st => info.get(st.cardId)?.name) };
  const flags = [], byTurn = new Map(), plays = new Map();
  for (const st of line.steps) { if (!byTurn.has(st.turn)) byTurn.set(st.turn, []); byTurn.get(st.turn).push(st); }
  for (const st of line.steps) {
    const c = info.get(st.cardId); if (!c) continue;
    if (['play', 'normal_summon', 'special_summon', 'attach'].includes(st.kind) && c.zone !== 'commander') plays.set(st.cardId, (plays.get(st.cardId) || 0) + 1);
  }
  for (const [id, n] of plays) if (n > info.get(id).qty) flags.push(`Uses ${info.get(id).name} ${n} times, but the list has ${info.get(id).qty}.`);
  let ramp = 0;
  for (const [turn, steps] of [...byTurn].sort((a, b) => a[0] - b[0])) {
    const seen = new Map();
    for (const st of steps.filter(s => s.kind === 'activate')) {
      const c = info.get(st.cardId);
      if (OPT.test(c.text) && (game === 'ygo' || c.qty === 1)) { seen.set(st.cardId, (seen.get(st.cardId) || 0) + 1); if (seen.get(st.cardId) === 2) flags.push(`Turn ${turn} uses ${c.name}'s once-per-turn effect twice.`); }
    }
    if (game === 'mtg') {
      const cost = steps.filter(s => s.kind === 'play' && !info.get(s.cardId).land).reduce((n, s) => n + (info.get(s.cardId).mv || 0), 0), have = turn + ramp;
      if (cost > have + 1) flags.push(`Turn ${turn} casts ${cost} mana of spells; one land a turn plus the mana pieces this line played gives about ${have}.`);
      ramp += steps.filter(s => s.kind === 'play' && info.get(s.cardId).mana && !info.get(s.cardId).land).length;
    }
    if (game === 'ptcg') {
      if (steps.filter(s => s.kind === 'play' && info.get(s.cardId).supporter).length > 1) flags.push(`Turn ${turn} plays two Supporters; only one is allowed each turn.`);
      if (steps.filter(s => s.kind === 'attach' && info.get(s.cardId).energy).length > 1) flags.push(`Turn ${turn} attaches Energy from hand twice; only one attachment a turn unless a card's text allows more.`);
      if (turn === 1 && steps.some(s => s.kind === 'evolve')) flags.push('Evolves on turn 1; Pokémon can\'t evolve on your first turn.');
    }
    if (game === 'ygo') {
      if (steps.filter(s => s.kind === 'normal_summon').length > 1) flags.push(`Turn ${turn} Normal Summons twice; only one Normal Summon a turn unless a card grants another.`);
      for (const s of steps) if (s.kind === 'normal_summon' && info.get(s.cardId).zone === 'extra') flags.push(`${info.get(s.cardId).name} is an Extra Deck monster; it can't be Normal Summoned.`);
    }
  }
  if (game === 'ptcg') for (const s of line.steps) { const c = info.get(s.cardId); if (s.kind === 'evolve' && c.evolvesFrom && !info.has('name:' + c.evolvesFrom) && !info.has('name:Rare Candy')) flags.push(`${c.name} evolves from ${c.evolvesFrom}, which isn't in the list.`); }
  return flags;
}
function cardInfo(game, rows) {
  const info = new Map();
  for (const r of rows) {
    const c = r.c, t = typeOf(c);
    info.set(r.id, { img: artOf(c), name: c?.name || r.row.name, qty: r.row.qty, zone: r.zone, text: textOf(c), mv: c?.cmc || 0, land: /\bLand\b/.test(t), mana: !!c?.produced_mana?.length, supporter: /Supporter/.test(t), energy: c?.category === 'Energy', evolvesFrom: c?.evolveFrom || '', cost: costOf(game, c) });
    if (c?.name) info.set('name:' + c.name, true);
  }
  return info;
}
function verify(entry) {
  if (entry.verified || !entry.result) return entry.verified;
  const r = entry.result, info = cardInfo(entry.game, entry.rows);
  const lines = (r.pilot?.lines || []).map(l => checkLine(entry.game, l, info));
  const swaps = (r.improve || []).map(s => {
    const out = entry.rows.find(x => x.id === s.cut), add = entry.cands?.find(x => x.id === s.add);
    if (!out || !add || !entry.hooks?.rescore) return null;
    try {
      const v = entry.hooks.rescore(out, add.c), had = new Set(v.beforeIssues || []);
      return { before: v.before, after: v.after, issues: (v.issues || []).filter(i => !had.has(i)), area: s.area ? areaMove(v, s.area) : null };
    } catch { return null; }
  });
  return (entry.verified = { info, lines, swaps });
}

/* ---------- Launcher and dialog ---------- */

export function aiReviewPanel(game, deck, lookup, p, hooks = {}) {
  const payload = reviewPayload(game, deck, lookup, p), signature = JSON.stringify(payload), key = game + ':' + deck.id;
  let entry = entries.get(key);
  if (!entry || entry.signature !== signature) {
    if (entries.size > 40) entries.delete(entries.keys().next().value);
    entry = { signature, payload, game, rows: deckRows(game, deck, lookup), hooks, busy: false, result: null, error: '', errorCode: '', tab: 'deck' }; entries.set(key, entry);
    if (activeDialog?.key === key) { activeDialog.stale = true; updateDialog(); }
  } else entry.hooks = hooks;
  const result = entry.result, ready = result ? `${plural(result.pilot?.lines?.length || 0, 'line')} · ${plural(result.pressure?.scenarios?.length || 0, 'stress test')} · ${plural(result.improve?.length || 0, 'swap')}` : '';
  return `<section class="panel ai-review ai-review-launch" aria-label="AI deck coach"><div class="ai-launch-top"><span class="ai-sigil" aria-hidden="true">✦</span><div><p class="eyebrow">AI coach · all three games</p><h3>Pilot, pressure-test and improve this deck</h3></div><span class="chip">AI</span></div><p class="small muted">Winning lines from your own cards, what to do when your key piece is answered, and swaps from cards you own. The app checks each one before you see it.</p><div class="ai-launch-actions"><button class="btn small" data-act="aiDeckReview" data-ai="${esc(key)}">${entry.busy ? 'View coaching progress' : result ? 'Open coaching' : 'Coach this deck'} <span aria-hidden="true">↗</span></button><span class="small muted">${entry.busy ? 'Coaching in progress' : result ? ready : 'Optional · your score stays unchanged'}</span></div><p class="foot">Tapping it sends this deck's card text, the app's checks and the names and text of up to 25 cards you own to OpenAI. Your account details and prices stay out of the request.</p><div role="status" aria-live="polite">${entry.error ? `<p class="warn-text small">${esc(entry.error)}</p>` : ''}</div></section>`;
}

const ev = list => list?.length ? `<details class="air-ev"><summary>Card text</summary>${list.map(e => `<p><b>${esc(e.name)}</b><q>${esc(e.quote)}</q></p>`).join('')}</details>` : '';
const chips = cards => cards?.length ? `<div class="air-chips">${cards.map(c => `<span>${esc(c.name)}</span>`).join('')}</div>` : '';
function pilotTab(r, v, entry) {
  const h = r.pilot?.hand, hand = entry.payload.hand.map(id => v.info.get(id)).filter(Boolean);
  const handHtml = h && hand.length ? `<article class="air-card air-hand" style="--i:1"><div class="air-card-head"><span class="air-label">Opening hand coach</span><span class="air-verdict ${h.verdict}">${h.verdict === 'keep' ? 'Keep' : 'Mulligan'}</span></div><div class="air-fan">${hand.map((c, i) => `<span class="${c.img ? 'art' : ''}" style="--k:${i - (hand.length - 1) / 2}" title="${esc(c.name)}">${c.img ? `<img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy">` : `<b>${esc(c.name)}</b><small>${esc(c.cost)}</small>`}</span>`).join('')}</div><p class="air-hand-names">${hand.map(c => esc(c.name)).join(' · ')}</p><p class="air-lead">${esc(h.reason)}</p><dl class="air-dl">${h.firstTurns ? `<dt>First turns</dt><dd>${esc(h.firstTurns)}</dd>` : ''}${h.lookFor ? `<dt>Dig for</dt><dd>${esc(h.lookFor)}</dd>` : ''}${h.preserve ? `<dt>Hold back</dt><dd>${esc(h.preserve)}</dd>` : ''}</dl>${ev(h.evidence)}<p class="air-note">A random hand the app dealt from your list.</p></article>` : '';
  const lines = (r.pilot?.lines || []).map((l, i) => {
    const flags = v.lines[i] || [];
    return `<article class="air-card air-line" style="--i:${i + 2}"><div class="air-card-head"><span class="air-label">Winning line ${i + 1}</span><span class="air-check ${flags.length ? 'warn' : 'ok'}">${flags.length ? '⚠ Check' : '✓ App-checked'}</span></div><h4>${esc(l.name)}</h4>${l.goal ? `<p class="air-lead">${esc(l.goal)}</p>` : ''}<ol class="air-steps">${l.steps.map(s => `<li><span class="air-turn">T${s.turn}</span>${v.info.get(s.cardId)?.img ? `<img class="air-thumb" src="${esc(v.info.get(s.cardId).img)}" alt="" loading="lazy">` : ''}<div><b>${esc(s.name)}</b>${v.info.get(s.cardId)?.cost ? `<small class="air-cost">${esc(v.info.get(s.cardId).cost)}</small>` : ''}<p>${esc(s.action)}</p>${s.quote ? `<q>${esc(s.quote)}</q>` : ''}</div></li>`).join('')}</ol>${l.payoff ? `<p class="air-row good"><b>Payoff</b>${esc(l.payoff)}</p>` : ''}${l.interrupt ? `<p class="air-row bad"><b>Can be stopped</b>${esc(l.interrupt)}</p>` : ''}${flags.length ? `<ul class="air-flags">${flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : `<p class="air-note">The app confirmed every card is in your list, copies and once-per-turn limits${entry.game === 'mtg' ? ', and mana by turn' : entry.game === 'ptcg' ? ', Supporter, attachment and evolution rules' : ' and Normal Summon limits'}.</p>`}</article>`;
  }).join('');
  return handHtml + lines || '<p class="air-empty">No line held up to the app\'s checks for this list. Try the Goldfish tab to see how it plays out.</p>';
}
const STATUS = { cap: ['Holds the score back', 'bad'], weak: ['Needs work', 'warn'], ok: ['Fine', 'ok'], strong: ['Strength', 'good'] };
function deckTab(r, entry) {
  const P = entry.payload.power || { areas: [], priority: [] }, areaOf = new Map(P.areas.map(a => [a.key, a]));
  const id = r.identity || {}, chipList = (label, cards) => cards?.length ? `<div class="air-idrow"><span class="air-label">${label}</span>${chips(cards)}</div>` : '';
  const who = `<article class="air-card air-identity" style="--i:1"><span class="air-label">What this deck does</span><p class="air-lead">${esc(id.plan || P.plan)}</p>${id.howItWins ? `<p class="air-row good"><b>Wins by</b>${esc(id.howItWins)}</p>` : ''}${chipList('Wins with', id.winCards)}${chipList('Runs on', id.engineCards)}</article>`;
  // Rows in Power's own order (what to fix first), each with Power's number and status; the coach
  // only adds what it means for this deck and what the count can't show.
  const said = new Map((r.explain || []).map(x => [x.area, x])), more = new Map(); for (const b of r.beyond || []) (more.get(b.area) || more.set(b.area, []).get(b.area)).push(b);
  const fixes = new Set((r.improve || []).map(x => x.area).filter(Boolean));
  const order = [...new Set([...P.priority, ...P.areas.filter(a => a.status === 'strong').map(a => a.key), ...said.keys()])].filter(k => areaOf.has(k) && (said.has(k) || more.has(k) || P.priority.includes(k)));
  const rows = order.map((k, i) => {
    const a = areaOf.get(k), [word, tone] = STATUS[a.status] || STATUS.ok, x = said.get(k);
    const meter = a.status === 'cap' ? `<span class="air-max">max ${esc(String(a.max ?? ''))}</span>` : Number.isFinite(a.ratio) ? `<div class="air-meter ${tone}"><span style="width:${Math.round(Math.min(1, a.ratio) * 100)}%"></span></div>` : '';
    return `<div class="air-area ${tone}" style="--i:${i + 3}"><div class="air-area-top"><b>${esc(a.label)}</b>${a.count !== '' && a.count != null ? `<span class="air-num">${esc(String(a.count))}${a.target !== '' && a.target != null ? `<small> / ${esc(String(a.target))}</small>` : ''}</span>` : ''}<span class="air-status ${tone}">${word}</span></div>${meter}${x ? `<p>${esc(x.says)}</p>${chips(x.cards)}` : a.why ? `<p class="air-note">${esc(a.why)}</p>` : ''}${(more.get(k) || []).map(b => `<div class="air-beyond"><span class="air-label">What the count doesn't show</span><p>${esc(b.note)}</p>${ev(b.evidence)}</div>`).join('')}${fixes.has(k) ? `<button class="link air-jump" data-ai-tab="improve">See the swap that fixes this →</button>` : ''}</div>`;
  }).join('');
  const nums = `<div class="air-power-nums">${P.competitive != null ? `<span><b>${P.competitive}</b>Competitive</span>` : ''}<span><b>${P.engine ?? '—'}</b>Engine</span></div>`;
  return who + (rows ? `<article class="air-card air-power" style="--i:2"><div class="air-card-head"><span class="air-label">Deck Power, explained</span>${nums}</div><p class="air-note">Numbers and verdicts are Power's own; the coach explains them.</p>${rows}</article>` : '');
}
const EDGE = { 'they are favoured': ['Tough matchup', 'bad'], close: ['Close', 'warn'], 'you are favoured': ['Good for you', 'good'] };
function metaTab(r, entry) {
  const pct = x => Math.round((x || 0) * 100) + '%';
  const rows = (r.meta || []).map((m, i) => {
    const [word, tone] = EDGE[m.edge] || EDGE.close, mine = new Map((entry.meta || []).map(f => [f.name, f]));
    return `<article class="air-card air-meta ${tone}" style="--i:${i + 1}"><div class="air-card-head"><span class="air-label">${pct(m.share)} of the field</span><span class="air-status ${tone}">${word}</span></div><h4>${esc(m.deck)}</h4><p class="air-lead">${esc(m.how)}</p>${m.theirKeys?.length ? `<div class="air-idrow"><span class="air-label">Their key cards</span><div class="air-chips them">${m.theirKeys.map(n => `<span>${esc(n)}</span>`).join('')}</div></div>` : ''}${m.yourAnswers?.length ? `<div class="air-idrow"><span class="air-label">Your answers</span>${chips(m.yourAnswers)}</div>` : `<p class="air-row bad"><b>Answers</b>None in this list yet; see Improve.</p>`}${m.plan ? `<p class="air-row good"><b>Plan</b>${esc(m.plan)}</p>` : ''}${mine.get(m.deck)?.lists ? `<p class="air-note">From ${mine.get(m.deck).lists} placing list${mine.get(m.deck).lists === 1 ? '' : 's'}.</p>` : ''}</article>`;
  }).join('');
  // Top decks the coach didn't cover still appear, with their key cards from the tournament data.
  const covered = new Set((r.meta || []).map(m => m.deck)), rest = (entry.meta || []).filter(f => !covered.has(f.name)).map((f, i) => `<article class="air-card air-meta" style="--i:${(r.meta || []).length + i + 1}"><div class="air-card-head"><span class="air-label">${pct(f.share)} of the field</span><span class="air-status ok">Not analysed this time</span></div><h4>${esc(f.name)}</h4><div class="air-idrow"><span class="air-label">Plays</span><div class="air-chips them">${f.cards.slice(0, 6).map(c => `<span>${esc(c.name)}</span>`).join('')}</div></div></article>`).join('');
  const head = rows || rest ? `<p class="air-note">How the decks winning now play against this list, from their real tournament lists. "Tough" and "Good for you" are the coach's card-by-card read; the Matchups tab has the app's measured odds.</p>` : `<p class="air-empty">No tournament data for this format is loaded yet. Open Power and tap "Compare with tournament decks", then ask again.</p>`;
  const sc = pressureTab(r, true);
  return head + rows + rest + (sc ? `<h4 class="air-sub">If things go wrong</h4>${sc}` : '');
}
function pressureTab(r, inner = false) {
  const sc = (r.pressure?.scenarios || []).map((s, i) => `<article class="air-card air-threat" style="--i:${i + 1}"><div class="air-card-head"><span class="air-label">If…</span><span class="air-check ${s.gap ? 'bad' : 'ok'}">${s.gap ? 'Gap' : 'Backup ready'}</span></div><h4>${esc(s.threat)}</h4>${s.impact ? `<p>${esc(s.impact)}</p>` : ''}<p class="air-row ${s.gap ? 'bad' : 'good'}"><b>${s.gap ? 'Missing' : 'Then'}</b>${esc(s.backup)}</p>${chips(s.backupCards)}${ev(s.evidence)}</article>`).join('');
  return inner ? sc : sc || '<p class="air-empty">No stress test held up to the card-text check.</p>';
}
function improveTab(r, v, entry) {
  const areaOf = new Map((entry.payload.power?.areas || []).map(a => [a.key, a]));
  // A swap Power's deck check calls illegal is never shown (Power's legal pick replaces it if found).
  const shown = (r.improve || []).map((s, i) => [s, v.swaps[i]]).filter(([, sc]) => !sc?.issues?.length || (sc.better && !sc.better.issues.length));
  const sw = shown.map(([s, sc], i) => {
    if (sc?.issues?.length && sc.better) { s = { ...s, cut: '', cutName: sc.better.cutName }; sc = { ...sc.better, better: null }; }
    const d = sc ? sc.after - sc.before : 0;
    const verdict = sc ? (sc.issues.length ? `<span class="air-check bad">Not legal: ${esc(sc.issues[0])}</span>` : `<span class="air-score ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">Power ${sc.before} → ${sc.after} <b>${d > 0 ? '+' : ''}${d}</b></span>`) : s.add ? '' : '<span class="air-check">Find a card</span>';
    const A = areaOf.get(s.area), aims = !(sc?.area?.up || sc?.better?.area?.up), moved = sc?.area && sc.area.before != null ? `<span class="air-score ${sc.area.up ? 'up' : sc.area.down ? 'down' : ''}">${esc(A?.label || s.area)} ${esc(String(sc.area.before))} → ${esc(String(sc.area.after))}</span>` : A ? `<span class="air-check">${esc(A.label)}</span>` : '';
    return `<article class="air-card air-swap" style="--i:${i + 1}">${moved ? `<div class="air-fixes"><span class="air-label">${aims ? 'Aims at' : 'Fixes'}</span>${moved}</div>` : ''}<div class="air-swap-pair"><span class="out">${(v.info.get(s.cut)?.img) ? `<img src="${esc(v.info.get(s.cut).img)}" alt="" loading="lazy">` : ''}<small>OUT</small>${esc(s.cutName)}</span><span class="air-arrow" aria-hidden="true">→</span><span class="in">${artOf(entry.cands?.find(c => c.id === s.add)?.c) ? `<img src="${esc(artOf(entry.cands.find(c => c.id === s.add).c))}" alt="" loading="lazy">` : ''}<small>${s.add ? 'IN · you own it' : 'IN'}</small>${esc(s.addName || s.role || 'A better card for this role')}</span></div>${verdict ? `<div class="air-verdict-row">${verdict}${sc ? '<small>recounted by Power</small>' : ''}</div>` : ''}${sc?.better ? `<div class="air-better"><span class="air-label">Power's pick</span><p>Keep ${esc(s.cutName)} and cut <b>${esc(sc.better.cutName)}</b> instead: <span class="air-score ${sc.better.after > sc.better.before ? 'up' : ''}">Power ${sc.better.before} → ${sc.better.after}</span>${sc.better.area && sc.better.area.before != null ? ` <span class="air-score ${sc.better.area.up ? 'up' : sc.better.area.down ? 'down' : ''}">${esc(areaOf.get(s.area)?.label || s.area)} ${esc(String(sc.better.area.before))} → ${esc(String(sc.better.area.after))}</span>` : ''}</p></div>` : ''}<ul class="air-pm">${s.gain ? `<li class="good"><i>+</i>${esc(s.gain)}</li>` : ''}${s.loss ? `<li class="bad"><i>−</i>${esc(s.loss)}</li>` : ''}${s.lost ? `<li class="bad"><i>×</i>${esc(s.lost)}</li>` : ''}${s.test ? `<li><i>▶</i>${esc(s.test)}</li>` : ''}</ul>${ev(s.evidence)}</article>`;
  }).join('');
  const tests = r.tests?.length ? `<article class="air-card air-tests" style="--i:6"><span class="air-label">Prove it in the app</span><ol>${r.tests.map(t => `<li>${esc(t)}</li>`).join('')}</ol></article>` : '';
  const hidden = (r.improve || []).length - shown.length;
  return sw + tests + (hidden ? `<p class="foot">${hidden} suggested swap${hidden === 1 ? ' was' : 's were'} left out because Power's deck check found the card isn't legal here.</p>` : '') || '<p class="air-empty">No swap held up to the app\'s checks.</p>';
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function tabBody(entry, v = verify(entry)) {
  const r = entry.result, tab = entry.tab || 'deck';
  return tab === 'pressure' || tab === 'meta' ? metaTab(r, entry) : tab === 'improve' ? improveTab(r, v, entry) : tab === 'pilot' ? pilotTab(r, v, entry) : deckTab(r, entry);
}
function reviewReport(entry) {
  const r = entry.result, v = verify(entry) || { info: new Map(), lines: [], swaps: [] }, tab = entry.tab || 'deck';
  const counts = { deck: r.explain?.length || 0, pilot: (r.pilot?.lines?.length || 0) + (r.pilot?.hand ? 1 : 0), meta: (r.meta?.length || 0) + (r.pressure?.scenarios?.length || 0), improve: r.improve?.length || 0 };
  const focus = (entry.payload.power?.areas || []).find(a => a.key === r.priority);
  const checked = v.lines.filter(f => !f.length).length, scored = v.swaps.filter(Boolean).length;
  const tabs = [['deck', '◆', 'Deck'], ['pilot', '▶', 'Pilot'], ['meta', '⚔', 'Meta'], ['improve', '↑', 'Improve']];
  const body = tabBody(entry, v);
  return `<section class="air-hero" style="--i:0"><span class="air-kicker"><span aria-hidden="true">✦</span> The decision${focus ? ` · <em>${esc(focus.label)}</em>` : ''}</span><p class="air-headline">${esc(r.headline)}</p><div class="air-stats"><span>${plural(r.pilot?.lines?.length || 0, 'line')} · ${checked} passed app checks</span><span>${plural(r.meta?.length || 0, 'meta matchup')} · ${plural(r.pressure?.scenarios?.length || 0, 'stress test')}</span><span>${plural(counts.improve, 'swap')} · ${scored} re-scored</span></div></section>
  <div class="air-tabs" role="tablist" aria-label="Coaching sections">${tabs.map(([k, icon, label]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-ai-tab="${k}"><span aria-hidden="true">${icon}</span>${label}<em>${counts[k]}</em></button>`).join('')}</div>
  <div class="air-panel" role="tabpanel">${body}</div>
  ${r.omitted ? `<p class="foot">${r.omitted} suggestion${r.omitted === 1 ? ' was' : 's were'} dropped because ${r.omitted === 1 ? 'it' : 'they'} cited cards or text that aren't in this list.</p>` : ''}<p class="foot">AI coaching · card quotes are matched to real card text and the app checks cards, copies and turn limits, but full rules interactions aren't verified. Your score is unchanged. Clears when you change the deck or reload.</p>`;
}
export function aiReviewDialogContent(entry, stale = false) {
  if (stale) return '<div class="ai-state"><span class="ai-state-symbol" aria-hidden="true">↻</span><h3>The deck changed</h3><p>Close this window and ask for fresh coaching on your updated list. The earlier answer won\'t be applied to it.</p></div>';
  if (entry.busy) return `<div class="ai-state"><div class="ai-orbit" aria-hidden="true"><i></i><span>✦</span></div><p class="eyebrow">Your deck, another perspective</p><h3>Coaching your deck</h3><p>OpenAI is reading your cards and the app's numbers. The app then checks every line and swap before showing it.</p><div class="ai-review-steps"><span>Deck sent</span><span class="current">Finding lines</span><span>Power checks next</span></div><p class="foot">You can close this window and keep browsing. Reopening it won't start another request. No automatic retries.</p></div>`;
  if (entry.error) {
    const title = ['billing', 'credits', 'spend_limit', 'usage_limit'].includes(entry.errorCode) ? 'API billing needs attention' : entry.errorCode === 'rate_limit' ? 'OpenAI needs a breather' : entry.errorCode === 'app_limit' ? 'App review allowance reached' : entry.errorCode === 'authentication' ? 'API connection needs attention' : 'Coaching couldn\'t finish';
    return `<div class="ai-state ai-error"><span class="ai-state-symbol" aria-hidden="true">!</span><h3>${title}</h3><p>${esc(entry.error)}</p><p class="foot">Your deck and score are unchanged. No automatic retry was made. Resolve the issue before trying again.</p><button class="btn small" data-ai-retry>Try again</button></div>`;
  }
  return entry.result ? `<p class="sr-only" role="status">Coaching ready</p>${reviewReport(entry)}` : '<p>Choose a deck to begin.</p>';
}
function updateDialog() {
  if (!activeDialog) return;
  const body = activeDialog.node.querySelector('.ai-dialog-body');
  activeDialog.node.classList?.toggle?.('thinking', !!activeDialog.entry.busy);
  body.setAttribute('aria-busy', String(activeDialog.entry.busy && !activeDialog.stale));
  body.innerHTML = aiReviewDialogContent(activeDialog.entry, activeDialog.stale);
  activeDialog.node.querySelector('.ai-dialog-status').textContent = activeDialog.stale ? 'Deck changed' : activeDialog.entry.busy ? 'Coaching in progress' : activeDialog.entry.error ? 'Coaching unavailable' : 'Coaching ready';
}
export function closeAiReview() {
  if (!activeDialog) return;
  const { node, key } = activeDialog; activeDialog = null;
  node.close?.(); node.remove();
  [...document.querySelectorAll('[data-act="aiDeckReview"]')].find(b => b.dataset.ai === key)?.focus({ preventScroll: true });
}
export function showAiReview(key, render, fetcher = fetch) {
  const entry = entries.get(key); if (!entry) return;
  if (activeDialog) closeAiReview();
  const node = document.createElement('dialog');
  node.className = 'ai-review-dialog ai-companion'; node.setAttribute('aria-labelledby', 'ai-review-title');
  node.innerHTML = `<div class="ai-dialog-shell"><header class="ai-dialog-head ask-head">${aiOrb()}<div><p class="eyebrow">AI coach</p><h2 id="ai-review-title">Deck coaching</h2></div><button class="icon" data-ai-close aria-label="Close AI coaching">✕</button></header><p class="ai-dialog-status sr-only" role="status" aria-live="polite"></p><div class="ai-dialog-body"></div></div>`;
  document.body.append(node); activeDialog = { key, entry, node, stale: false };
  node.addEventListener('cancel', e => { e.preventDefault(); closeAiReview(); });
  node.addEventListener('click', e => {
    const tab = e.target.closest?.('[data-ai-tab]');
    if (tab) {
      // Swap only the tab's content, so the decision card doesn't replay; bring the tabs to the top.
      entry.tab = tab.dataset.aiTab;
      for (const b of node.querySelectorAll('.air-tabs [data-ai-tab]')) { const on = b.dataset.aiTab === entry.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
      const panel = node.querySelector('.air-panel'), body = node.querySelector('.ai-dialog-body'), bar = node.querySelector('.air-tabs');
      if (panel) panel.innerHTML = tabBody(entry);
      if (body && bar && body.scrollTop > bar.offsetTop - 8) body.scrollTop = bar.offsetTop - 8;
      return;
    }
    if (e.target === node || e.target.closest('[data-ai-close]')) closeAiReview();
    else if (e.target.closest('[data-ai-retry]') && !activeDialog?.stale) { void runAiReview(key, render, fetcher); node.querySelector('[data-ai-close]').focus(); }
  });
  updateDialog();
  if (node.showModal) node.showModal(); else node.setAttribute('open', '');
  node.querySelector('[data-ai-close]').focus();
  if (!entry.busy && !entry.result) return runAiReview(key, render, fetcher);
}
// Owned cards offered as swaps, chosen with Power: each is test-added and Power's own counts say
// which weak areas it would raise (within a time budget, yielding so the progress animation runs).
// Only at request time, so rendering never walks the collection.
async function withCandidates(entry, budget = 1500) {
  let pool = [];
  try { pool = (entry.hooks?.candidates?.() || []).filter(Boolean).slice(0, 60); } catch {}
  const P = entry.payload.power || { areas: [], priority: [] }, weak = P.priority.filter(k => !k.startsWith('cap:')).slice(0, 4);
  // "Helps" means Power's own ratio for that area rises (closer to target), not just a bigger count:
  // adding a card to an oversized deck raises its size count but moves it away from the target.
  const base = new Map(P.areas.map(a => [a.key, a.ratio])), label = new Map(P.areas.map(a => [a.key, a.label])), helps = new Map();
  if (entry.hooks?.probe && weak.length) {
    const t = Date.now();
    for (const c of pool) {
      if (Date.now() - t > budget) break;
      try { const parts = entry.hooks.probe(c), up = weak.filter(k => { const x = parts?.find(p => p.key === k)?.ratio; return Number.isFinite(x) && Number.isFinite(base.get(k)) && x > base.get(k) + 1e-9; }); if (up.length) helps.set(c, up.map(k => label.get(k))); } catch {}
      await new Promise(r => setTimeout(r, 0));
    }
  }
  const cards = [...pool.filter(c => helps.has(c)), ...pool.filter(c => !helps.has(c))].slice(0, 25);
  entry.cands = cards.map((c, i) => ({ id: 'o' + i, c, helps: helps.get(c) || [] }));
  let field = [];
  try { field = (entry.hooks?.field?.() || []).slice(0, 5).map(f => ({ name: String(f.name), share: Number(f.share) || 0, lists: f.lists || 0, cards: (f.rows || []).slice(0, 12).map(r => ({ name: r.c?.name || r.name, qty: r.qty, type: typeOf(r.c), text: textOf(r.c).slice(0, 400) })) })); } catch {}
  entry.meta = field;
  return { ...entry.payload, meta: field, candidates: entry.cands.map(x => ({ ...cardEntry(entry.game, x.id, x.c.name, 1, 'owned', x.c), ...(x.helps.length ? { helps: x.helps.join(', ') } : {}) })) };
}
// How a swap moves one Power area: its count before and after, and whether Power's ratio for it rose.
function areaMove(v, key) {
  const a = v.beforeParts?.find(x => x.key === key), b = v.afterParts?.find(x => x.key === key);
  return a && b ? { before: a.count, after: b.count, up: b.ratio > a.ratio + 1e-9, down: b.ratio < a.ratio - 1e-9 } : null;
}
// When a suggested swap would lower Deck Power, Power tries other cuts for the same added card
// (cards outside the deck's core and outside Power's weak areas first) and offers its best pick.
async function betterCuts(entry, budget = 3000) {
  const v = verify(entry); if (!v || !entry.hooks?.rescore) return;
  const r = entry.result, P = entry.payload.power || { areas: [], priority: [] }, t = Date.now();
  const core = new Set([...(r.identity?.winCards || []), ...(r.identity?.engineCards || [])].map(x => x.cardId)), weakLabels = new Set(P.areas.filter(a => a.status === 'weak' || a.status === 'cap').map(a => a.label));
  const powerOf = new Map(entry.payload.cards.map(c => [c.id, (c.power || '').split(', ').filter(Boolean)]));
  for (const [i, s] of (r.improve || []).entries()) {
    const sc = v.swaps[i], add = entry.cands?.find(x => x.id === s.add);
    if (!sc || !add || (sc.after >= sc.before && !sc.issues.length && (!sc.area || sc.area.up))) continue;
    const alts = entry.rows.filter(x => x.zone === 'main' && x.id !== s.cut && !core.has(x.id) && x.c).map(x => ({ x, a: powerOf.get(x.id) || [] })).sort((p, q) => p.a.filter(l => weakLabels.has(l)).length - q.a.filter(l => weakLabels.has(l)).length || p.a.length - q.a.length).slice(0, 10);
    let best = null;
    for (const { x } of alts) {
      if (Date.now() - t > budget) break;
      try {
        const w = entry.hooks.rescore(x, add.c), had = new Set(w.beforeIssues || []);
        const cand = { cutName: x.c.name, before: w.before, after: w.after, issues: (w.issues || []).filter(z => !had.has(z)), area: s.area ? areaMove(w, s.area) : null };
        const good = c => !c.issues.length ? c.after + (c.area?.up ? 0.5 : 0) : -1;
        if (good(cand) > (best ? good(best) : good(sc))) best = cand;
      } catch {}
      await new Promise(res => setTimeout(res, 0));
    }
    if (best) sc.better = best;
  }
}
export async function runAiReview(key, render, fetcher = fetch) {
  const entry = entries.get(key); if (!entry || entry.busy || entry.result) return;
  entry.busy = true; entry.error = ''; entry.errorCode = ''; entry.verified = null; render(); updateDialog();
  try {
    const r = await fetcher('/api/ai/deck-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(await withCandidates(entry)), signal: AbortSignal.timeout(110000) });
    let data; try { data = await r.json(); } catch { throw Error('AI coaching is unavailable. Check your connection and try later.'); }
    if (!r.ok) throw Object.assign(Error(data.message || 'AI coaching is unavailable. Try later.'), { code: data.code || '' });
    if (!data || typeof data.headline !== 'string' || !data.pilot || !data.pressure || !Array.isArray(data.improve)) throw Error('AI coaching returned an unreadable response.');
    entry.result = data; entry.verified = null;
    await betterCuts(entry);
  } catch (e) { entry.errorCode = e.code || ''; entry.error = e.name === 'TimeoutError' || e.name === 'AbortError' ? 'AI coaching took too long. Try again later.' : e.message || 'AI coaching is unavailable.'; }
  finally { entry.busy = false; if (entries.get(key) === entry) render(); if (activeDialog?.entry === entry) updateDialog(); }
}

// The current coaching for a deck, with the app's own checks (used by scripts/coach-eval.mjs).
export function coachEntry(key) { const e = entries.get(key); return e ? { ...e, verified: verify(e) } : null; }
