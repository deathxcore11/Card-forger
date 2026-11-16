import {powerEligibility, shownPower} from './power.js';
import {mtgResourceProfile} from './mtg-effects.js';
import {cleanCriteria, cleanConstructed, coachHandProfile} from './coach-evidence.js';
import {pokemonRole} from './pokemon-role.js';
import {brandMark} from './brand.js';
// Deck coach, no AI. The coaching is written by coach-plan.js from what the app already measures
// (Power's numbers, a sample hand, hand odds, the goldfish, the tournament field, owned swap candidates),
// and every swap is re-scored by Power before it is shown. Nothing leaves the device; it works offline.
import { esc } from './ui.js';
import { buildCoachPlan, coachBasics } from './coach-plan.js';
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
const compOf = p => { const score = competitiveScore(p); return Number.isFinite(score) ? score : null; };
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
    : JSON.stringify(game === 'ptcg' ? { category:c.category, prize:c.prize, tacticalRole:pokemonRole(c), stage: c.stage, evolvesFrom: c.evolveFrom, hp: c.hp, types: c.types, abilities: c.abilities, attacks: c.attacks, weaknesses: c.weaknesses, retreat: c.retreat, regulationMark: c.regulationMark } : { attribute: c.attribute, race: c.race, level: c.level, atk: c.atk, def: c.def, link: c.link, archetype: c.archetype });
}
const cardEntry = (game, id, name, qty, zone, c) => ({ id, name: c?.name || name, qty, zone, type: typeOf(c), text: plain(c?.oracle_text || c?.text || c?.desc || ''), details: cardDetails(game, c), known: !!c && !c.brief, ...(game === 'mtg' ? { legalities: c?.legalities || {} } : {}) });

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
    out.push('Every Basic Pokémon counts toward legal opening hands and mulligan odds, including one-copy tactical attackers. A low copy count does not make that Basic irrelevant.');
    for(const r of main){const role=pokemonRole(r.c);if(role)out.push(`${r.c.name}: ${role.prize} Prize liability; ${role.basic?'Basic; ':''}${role.attacks.map(a=>`${a.cost.length} Energy ${a.name}: ${a.base??'variable'} base${a.conditionalDamage!=null?' / '+a.conditionalDamage+' conditional damage':''} against Pokémon ${a.targets.join('/')}.`).join(' ')} Match the printed condition; do not assume a knockout or extend ex to GX/V.`);}
  } else {
    const t = r => typeOf(r.c), extra = main.filter(r => r.zone === 'extra');
    out.push(`Main Deck: Monsters ${count(r => r.zone === 'main' && !/Spell|Trap/.test(t(r)))}, Spells ${count(r => r.zone === 'main' && /Spell/.test(t(r)))}, Traps ${count(r => r.zone === 'main' && /Trap/.test(t(r)))}. Extra Deck ${extra.reduce((n, r) => n + r.row.qty, 0)}: ${['Fusion', 'Synchro', 'XYZ', 'Link'].map(k => `${k} ${count(r => r.zone === 'extra' && new RegExp(k, 'i').test(t(r)))}`).join(', ')}`);
  }
  return out;
}
export function deckFacts(game, rows, p) {
  const f = [...composition(game, rows)];
  if (!p) return f;
  const eligibility = powerEligibility(p), comp = eligibility.eligible ? compOf(p) : null;
  if (!eligibility.eligible) f.push(`Overall Power unavailable: ${eligibility.reason}. Component scores and role counts below are diagnostics, not an overall rating.`);
  if (p.strategic) {
    f.push(`Strategic route estimate: ${p.strategic.score == null ? 'unknown' : p.strategic.score + '/100'} (${p.strategic.confidence || 'insufficient'} coverage; ${eligibility.eligible ? 'provisional estimate' : 'diagnostic only'}). Not competitive strength or win odds.`);
    for (const r of (p.strategic.routes || []).slice(0, 3)) f.push(`Strategic route ${r.label || r.kind}: access ${Number.isFinite(r.access) ? pct(r.access) : 'unknown'}, deployment ${Number.isFinite(r.deployment) ? r.deployment : 'unknown'}, conversion ${Number.isFinite(r.conversion) ? r.conversion : 'unknown'}. Conditional component evidence, not execution or win odds.`);
    for (const limit of (p.strategic.limitations || []).slice(0, 4)) f.push('Strategic limitation: ' + limit);
  }
  f.push(`App scores: structural engine heuristic ${p.heuristic ?? p.score ?? '—'}/100, competitive ${comp == null ? 'unknown (no supported field estimate)' : comp + '/100'}. Not a win rate or proof of plan quality. Plan the app detected: ${p.plan || 'unknown'}.`);
  f.push('Power role counts are tagged or heuristic contributions, not necessarily effective copies. Targets are starting points, not mandatory quotas. Judge costs, conditions and actual plan support separately.');
  if (p.constructedCriteria) {
    const constructed = cleanConstructed(p.constructedCriteria);
    f.push(`Constructed evidence (${constructed.version}): ${constructed.scoreMeaning}. Coverage ${constructed.coverage.status}.`);
    f.push('Printed text, quantities and arithmetic under stated inputs are distinct from heuristic judgments. Effective flow, interaction weights and threat quality may be challenged with explained card-text or sequencing evidence; never fabricate replacement scores or win rates.');
    for (const c of constructed.cards.slice(0, 14)) {
      for (const e of c.flow.effects.slice(0, 2)) f.push(`Constructed flow · ${c.name}: ${e.mode}, activation ${e.activationMana ?? 'unknown'} mana, modeled total effect cost ${e.effectMana ?? 'unknown'}; ${e.status}. ${e.requirements.join(' ')}`);
      if (c.interaction.kind !== 'none') f.push(`Constructed interaction · ${c.name}: ${c.interaction.kind}, ${c.interaction.effective ?? 'unknown'} heuristic units. ${c.interaction.limitations.join(' ')}`);
      for (const r of c.requirements.slice(0, 3)) f.push(`Printed prerequisite · ${c.name}: ${r.kind}${r.subtype ? ' (' + r.subtype + ')' : ''}, ${r.status}${r.minimumMana != null ? ', printed-cost lower bound ' + r.minimumMana + ' mana' : ''}${r.activationMana != null ? ', activation ' + r.activationMana + ' mana' : ''}. ${r.note || r.evidence}`);
      for (const u of c.unsupported.slice(0, 1)) f.push(`Unmapped constructed effect · ${c.name}: ${u.reason}`);
    }
    for (const limit of constructed.coverage.limitations.slice(0, 3)) f.push('Constructed limitation: ' + limit);
  }
  if (p.criteria) f.push(`Contextual plan support: ${p.criteria.plan?.status || 'unknown'}. ${p.criteria.scoreMeaning || 'Structural checks do not verify a winning route.'}`);
  for (const s of p.sims || []) if (Number.isFinite(s.p)) f.push(`Hand odds · ${s.label}: ${pct(s.p)}${s.target != null ? ` (aim ${s.lower ? 'under' : 'over'} ${pct(s.target)})` : ''}${s.note ? ' — ' + s.note : ''}`);
  const g = p.goldfish;
  if (g) {
    if (g.headline) f.push('Simplified goldfish output (not a validated game result): ' + g.headline);
    for (const m of g.metrics || []) if (m.value != null) f.push(`Goldfish · ${m.label}: ${m.pct ? pct(m.value) : typeof m.value === 'number' ? +m.value.toFixed(2) : m.value}${m.note ? ' ' + m.note : ''}`);
    if (g.winCon) f.push('Goldfish damage/plan contributors (not verified win conditions): ' + g.winCon);
    if (g.endgame) f.push('Goldfish late game: ' + g.endgame);
  }
  for (const l of p.engine?.links || []) {
    const providers = (l.providers || []).slice(0, 6).map(c => typeof c === 'string' ? c : `${c.name} (${c.status || 'unverified'}${c.requirements?.length ? '; ' + c.requirements.slice(0, 3).join('; ') : ''})`).join(', ');
    f.push(`Inferred rules-text link (${l.status || 'unverified'}): ${l.payoff} needs ${l.need}; candidate providers ${providers}${l.openingBoth != null ? `; model opening availability ${pct(l.openingBoth)}` : l.openingAccess != null ? `; ${pct(l.openingAccess)} library-card access with command-zone support, not cards already in play` : ''}. Not a verified interaction.`);
  }
  for (const u of (p.engine?.unsupported || []).slice(0, 8)) f.push(`Unsupported effect/link: ${u.card || u.payoff || 'unknown'}${u.provider ? ' / ' + u.provider : ''}: ${(u.requirements || []).join('; ') || 'Requirements not established'}. No automatic support credit.`);
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
// ranking (score limits first, then weak areas by points lost). These remain app measurements;
// the coach may challenge their effective relevance without replacing the measured score.
export function powerSummary(p) {
  if (!p) return { areas: [], priority: [] };
  const eligibility = powerEligibility(p), overall = shownPower(p);
  const R = review(p.parts || []), weak = new Set(R.weak.map(x => x.key)), strong = new Set(R.strong.map(x => x.key));
  const caps = (p.caps || []).map(c => ({ key: 'cap:' + c.key, label: c.label, count: '', target: '', status: eligibility.eligible ? 'cap' : 'weak', lost: eligibility.eligible ? 100 - (c.max ?? 100) : 0, max: eligibility.eligible ? c.max : null, why: `${!eligibility.eligible ? 'Overall Power unavailable. ' : ''}${c.why || ''}`, cards: [] }));
  const parts = R.scored.map(x => ({ key: x.key, label: x.label || x.key, count: Number.isFinite(x.count) ? x.count : String(x.count ?? ''), target: Number.isFinite(x.target) ? x.target : String(x.target ?? ''), ratio: x.ratio, status: weak.has(x.key) ? 'weak' : strong.has(x.key) ? 'strong' : 'ok', lost: Math.round(x.lost * 10) / 10, why: x.why || x.hint || '', cards: (x.cards || []).map(nm).filter(Boolean).slice(0, 12), countBasis: x.countBasis || 'App structure/role heuristic, not necessarily effective copies', rawCount: Number.isFinite(x.rawCount) ? x.rawCount : null, effectiveCount: Number.isFinite(x.effectiveCount) ? x.effectiveCount : null }));
  const comp = eligibility.eligible ? compOf(p) : null;
  return { score: overall, eligible: eligibility.eligible, availabilityReason: eligibility.reason, scoreSource: p.ctx?.from || 'heuristic', scoreMeaning: !eligibility.eligible ? 'Overall Power unavailable; component diagnostics are not a rating' : p.strategic ? 'Provisional strategic route heuristic, not measured win rate or competitive strength' : p.criteria?.scoreMeaning || 'Structural build heuristic, not plan quality or win rate', engine: p.heuristic ?? p.score, competitive: comp ?? null, verdict: !eligibility.eligible ? `Overall Power unavailable: ${eligibility.reason}. Component diagnostics only.` : p.caps?.[0] ? `Held to ${p.caps[0].max} by ${p.caps[0].label}` : '', plan: p.plan || '', areas: [...caps, ...parts], priority: [...caps.map(c => c.key), ...R.weak.map(x => x.key)] };
}
export function sampleHand(game, rows, seed, format = '') {
  const lib = rows.filter(r => r.zone === 'main' && r.c).flatMap(r => Array(r.row.qty).fill(r.id)), n = coachHandProfile(game, format).initialHandCards;
  if (!Number.isInteger(n) || lib.length < n) return [];
  let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  for (let i = lib.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [lib[i], lib[j]] = [lib[j], lib[i]]; }
  return lib.slice(0, n);
}
export function reviewPayload(game, deck, lookup, p) {
  const rows = deckRows(game, deck, lookup), eligibility = powerEligibility(p);
  // Which Power areas each card counts toward, from Power's own card lists.
  const areasOf = new Map();
  for (const x of p?.parts || []) for (const c of x.cards || []) { const k = String(nm(c)).toLowerCase(); if (k) (areasOf.get(k) || areasOf.set(k, new Set()).get(k)).add(x.label || x.key); }
  const cards = rows.map(r => { const e = cardEntry(game, r.id, r.row.name || String(r.row.cardId), r.row.qty, r.zone, r.c), a = areasOf.get(String(e.name).toLowerCase()); return a?.size ? { ...e, power: [...a].join(', ') } : e; });
  const base = { game, format: (game === 'ygo' ? deck.format || p.formatName : p.formatName || deck.format) || '', commander: game === 'mtg' ? deck.commander || '' : '', cards }, handProfile = coachHandProfile(game, base.format);
  return { ...base, handProfile, power: powerSummary(p), criteria: cleanCriteria(p.criteria || p.strategic || p.constructedCriteria ? { ...p.criteria, constructed: p.constructedCriteria, strategic: p.strategic ? { ...p.strategic, ratingStatus: eligibility.eligible ? 'provisional-estimate' : 'diagnostic-only' } : null } : null), facts: [...deckFacts(game, rows, p), 'Opening-hand profile: ' + handProfile.note], hand: sampleHand(game, rows, JSON.stringify(cards.map(c => [c.name, c.qty, c.zone])), base.format), checks: { engine: p.heuristic ?? p.score, competitive: eligibility.eligible ? compOf(p) : null, scoreSource: p.ctx?.from || 'heuristic', provisional: !!p.readiness?.provisional, issues: [...(p.readiness?.issues || []), ...(p.caps || []).map(c => `${c.label}: ${c.why || ''}`)] } };
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
    info.set(r.id, { img: artOf(c), name: c?.name || r.row.name, qty: r.row.qty, zone: r.zone, text: textOf(c), mv: c?.cmc || 0, land: /\bLand\b/.test(t), mana: !!c?.produced_mana?.length && (game !== 'mtg' || mtgResourceProfile(c).acceleration), supporter: /Supporter/.test(t), energy: c?.category === 'Energy', evolvesFrom: c?.evolveFrom || '', cost: costOf(game, c) });
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

// The coach entry for a deck: made once per list, replaced when the list changes.
function entryFor(game, deck, lookup, p, hooks) {
  const payload = reviewPayload(game, deck, lookup, p), signature = JSON.stringify(payload), key = game + ':' + deck.id;
  let entry = entries.get(key);
  if (!entry || entry.signature !== signature) {
    if (entries.size > 40) entries.delete(entries.keys().next().value);
    entry = { signature, payload, game, p, rows: deckRows(game, deck, lookup), hooks, busy: false, result: null, error: '', errorCode: '', tab: 'deck', handN: 0 }; entries.set(key, entry);
    if (activeDialog?.key === key) { activeDialog.stale = true; updateDialog(); }
  } else { entry.hooks = hooks; entry.p = p; }
  return { key, entry };
}
/**
 * The coach, as data for the Power page (no window of its own). Everything but the swaps is ready at once; the
 * swaps are worked out in the background (Power re-scores each one) and `changed()` is called when they arrive.
 */
export function coachModel(game, deck, lookup, p, hooks = {}, changed = () => globalThis.dispatchEvent?.(new Event('cardstashy-rerender'))) {
  const { key, entry } = entryFor(game, deck, lookup, p, hooks), P = entry.payload.power || { areas: [], priority: [] };
  const handIds = entry.handN ? sampleHand(game, entry.rows, entry.signature.length + ':' + entry.handN + ':' + entry.rows.map(r => r.row.qty).join(''), entry.payload.format) : entry.payload.hand;
  const basics = entry.basics?.n === entry.handN ? entry.basics.r : (entry.basics = { n: entry.handN, r: coachBasics(entry, p, handIds) }).r;
  let pool = null; try { pool = hooks.poolSize?.() ?? null; } catch {}
  if (entry.result && !entry.busy && pool != null && entry.poolN != null && pool !== entry.poolN) { entry.result = null; entry.verified = null; entry.queued = false; }
  if (!entry.result && !entry.busy && !entry.error && !entry.queued) { entry.queued = true; entry.poolN = pool; setTimeout(() => { void runAiReview(key, changed, undefined, { quiet: true }); }, 0); }
  const info = cardInfo(game, entry.rows), v = entry.result ? verify(entry) : null, top = P.areas.find(a => a.key === P.priority[0]) || null;
  const area = a => ({ key: a.key, label: a.label, count: a.count, target: a.target, ratio: a.ratio, status: a.status, max: a.max ?? null, lost: a.lost, says: basics.explain.find(x => x.area === a.key)?.says || a.why || '' });
  const swaps = (entry.result?.improve || []).map((s, i) => ({ s, sc: v?.swaps[i] })).filter(x => x.sc && !x.sc.issues.length && x.sc.after >= x.sc.before).map(({ s, sc }) => ({ cut: s.cutName, add: s.addName, why: s.area ? s.gain : s.gain, before: sc.before, after: sc.after }));
  return { key, headline: basics.headline, fix: top ? area(top) : null, weak: P.priority.map(k => P.areas.find(a => a.key === k)).filter(Boolean).map(area), strong: P.areas.filter(a => a.status === 'strong').map(area), all: P.areas.length,
    hand: basics.pilot.hand ? { ...basics.pilot.hand, cards: (handIds || []).map(id => info.get(id)).filter(Boolean).map(c => ({ name: c.name, img: c.img, land: c.land, cost: c.cost })), note: entry.payload.handProfile?.note || '' } : null,
    pressure: basics.pressure.scenarios, field: basics.field, needs: basics.needs, swaps, swapsReady: !!entry.result, busy: !entry.result && !entry.error };
}
/** Deal another opening hand for the coach on the Power page. */
export function redealCoachHand(key) { const e = entries.get(key); if (e) e.handN = (e.handN || 0) + 1; }
export function aiReviewPanel(game, deck, lookup, p, hooks = {}, {compact = false} = {}) {
  const { key, entry: made } = entryFor(game, deck, lookup, p, hooks), payload = made.payload, signature = made.signature;
  let entry = made;
  if (!entry || entry.signature !== signature) {
    if (entries.size > 40) entries.delete(entries.keys().next().value);
    entry = { signature, payload, game, p, rows: deckRows(game, deck, lookup), hooks, busy: false, result: null, error: '', errorCode: '', tab: 'deck' }; entries.set(key, entry);
    if (activeDialog?.key === key) { activeDialog.stale = true; updateDialog(); }
  } else { entry.hooks = hooks; entry.p = p; }
  const result = entry.result, ready = result ? `${plural(result.pilot?.lines?.length || 0, 'line')} · ${plural(result.pressure?.scenarios?.length || 0, 'stress test')} · ${plural(result.improve?.length || 0, 'swap')}` : '';
  if(compact)return `<div class="deck-coach-action"><button class="btn ghost" data-act="aiDeckReview" data-ai="${esc(key)}" aria-label="Coach this deck">${brandMark('brand-idle')}<span>${entry.busy?'Coaching…':result?'Open coaching':'Coach this deck'}</span></button><small>From the app's own numbers · works offline.</small></div>`;
  return `<section class="panel ai-review ai-review-launch" aria-label="Deck coach"><div class="ai-launch-top"><span class="ai-sigil" aria-hidden="true">${brandMark("brand-idle")}</span><div><p class="eyebrow">Deck coach · all three games</p><h3>Pilot, pressure-test and improve this deck</h3></div><span class="chip">Offline</span></div><p class="small muted">What to fix first, how the opening hand plays, how the top decks match up and swaps from cards you own. Every line is one of the app's own measurements, and every swap is re-scored by Power.</p><div class="ai-launch-actions"><button class="btn small" data-act="aiDeckReview" data-ai="${esc(key)}">${entry.busy ? 'Coaching…' : result ? 'Open coaching' : 'Coach this deck'}</button><span class="small muted">${entry.busy ? 'Coaching in progress' : result ? ready : 'Your score stays unchanged'}</span></div><p class="foot">Nothing is sent anywhere. The coach reads this list on your device.</p><div role="status" aria-live="polite">${entry.error ? `<p class="warn-text small">${esc(entry.error)}</p>` : ''}</div></section>`;
}

const ev = list => list?.length ? `<details class="air-ev"><summary>Card text</summary>${list.map(e => `<p><b>${esc(e.name)}</b><q>${esc(e.quote)}</q></p>`).join('')}</details>` : '';
const chips = cards => cards?.length ? `<div class="air-chips">${cards.map(c => `<span>${esc(c.name)}</span>`).join('')}</div>` : '';
function pilotTab(r, v, entry) {
  const h = r.pilot?.hand, hand = entry.payload.hand.map(id => v.info.get(id)).filter(Boolean);
  const handLabel = entry.game === 'ygo' ? 'Assessment' : entry.game === 'ptcg' ? h?.verdict === 'keep' ? 'Basic present' : h?.verdict === 'mulligan' ? 'No Basic: redraw' : 'Setup review' : h?.verdict === 'keep' ? 'Keep' : h?.verdict === 'mulligan' ? 'Mulligan' : 'Review';
  const handHtml = h && hand.length ? `<article class="air-card air-hand" style="--i:1"><div class="air-card-head"><span class="air-label">Opening hand coach</span><span class="air-verdict ${h.verdict}">${handLabel}</span></div><div class="air-fan">${hand.map((c, i) => `<span class="${c.img ? 'art' : ''}" style="--k:${i - (hand.length - 1) / 2}" title="${esc(c.name)}">${c.img ? `<img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy">` : `<b>${esc(c.name)}</b><small>${esc(c.cost)}</small>`}</span>`).join('')}</div><p class="air-hand-names">${hand.map(c => esc(c.name)).join(' · ')}</p><p class="air-lead">${esc(h.reason)}</p><dl class="air-dl">${h.firstTurns ? `<dt>First turns</dt><dd>${esc(h.firstTurns)}</dd>` : ''}${h.lookFor ? `<dt>Dig for</dt><dd>${esc(h.lookFor)}</dd>` : ''}${h.preserve ? `<dt>Hold back</dt><dd>${esc(h.preserve)}</dd>` : ''}</dl>${ev(h.evidence)}<p class="air-note">${esc(entry.payload.handProfile?.note || 'An initial hand the app dealt from your list, before turn draws.')}</p></article>` : '';
  const odds = h?.odds?.length ? `<article class="air-card air-odds" style="--i:2"><span class="air-label">Across 3,000 shuffles of this list</span>${h.odds.map(o => `<div class="air-odd ${o.target == null ? '' : (o.lower ? o.p <= o.target : o.p >= o.target) ? 'good' : 'warn'}"><b>${Math.round(o.p * 100)}%</b><span>${esc(o.label)}${o.target != null ? `<small>aim ${o.lower ? 'under' : 'over'} ${Math.round(o.target * 100)}%</small>` : ''}${o.note ? `<small>${esc(o.note)}</small>` : ''}</span></div>`).join('')}</article>` : '';
  const gold = r.pilot?.goldfish?.length ? `<article class="air-card air-odds" style="--i:3"><span class="air-label">Played out alone (goldfish)</span>${r.pilot.goldfish.map(m => `<div class="air-odd"><b>${esc(m.value)}</b><span>${esc(m.label)}${m.note ? `<small>${esc(m.note)}</small>` : ''}</span></div>`).join('')}<p class="air-note">A simplified solo run with no opponent, not a match result.</p></article>` : '';
  const lines = (r.pilot?.lines || []).map((l, i) => {
    const flags = v.lines[i] || [];
    return `<article class="air-card air-line" style="--i:${i + 2}"><div class="air-card-head"><span class="air-label">Line ${i + 1}</span><span class="air-check ${flags.length ? 'warn' : 'ok'}">${flags.length ? '⚠ Check' : 'Mana checked'}</span></div><h4>${esc(l.name)}</h4>${l.goal ? `<p class="air-lead">${esc(l.goal)}</p>` : ''}<ol class="air-steps">${l.steps.map(s => `<li><span class="air-turn">T${s.turn}</span>${v.info.get(s.cardId)?.img ? `<img class="air-thumb" src="${esc(v.info.get(s.cardId).img)}" alt="" loading="lazy">` : ''}<div><b>${esc(s.name)}</b>${v.info.get(s.cardId)?.cost ? `<small class="air-cost">${esc(v.info.get(s.cardId).cost)}</small>` : ''}<p>${esc(s.action)}</p>${s.quote ? `<q>${esc(s.quote)}</q>` : ''}</div></li>`).join('')}</ol>${l.payoff ? `<p class="air-row good"><b>Payoff</b>${esc(l.payoff)}</p>` : ''}${l.interrupt ? `<p class="air-row bad"><b>Can be stopped</b>${esc(l.interrupt)}</p>` : ''}${flags.length ? `<ul class="air-flags">${flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : `<p class="air-note">Each play fits one land a turn. Colours and extra costs are not checked.</p>`}</article>`;
  }).join('');
  return handHtml + odds + gold + lines || '<p class="air-empty">This list has no full opening hand yet. Finish the deck and coach it again.</p>';
}
const STATUS = { cap: ['Holds the score back', 'bad'], weak: ['Needs work', 'warn'], ok: ['Fine', 'ok'], strong: ['Strength', 'good'] };
function deckTab(r, entry) {
  const P = entry.payload.power || { areas: [], priority: [] }, areaOf = new Map(P.areas.map(a => [a.key, a]));
  const id = r.identity || {}, context = entry.payload.criteria, chipList = (label, cards) => cards?.length ? `<div class="air-idrow"><span class="air-label">${label}</span>${chips(cards)}</div>` : '';
  const who = `<article class="air-card air-identity" style="--i:1"><span class="air-label">What this deck does</span><p class="air-lead">${esc(id.plan || P.plan)}</p>${id.howItWins ? `<p class="air-row"><b>Played out alone</b>${esc(id.howItWins)}</p>` : ''}${id.winCon ? `<p class="air-row"><b>Does the damage</b>${esc(id.winCon)}</p>` : ''}${id.endgame ? `<p class="air-row"><b>Late game</b>${esc(id.endgame)}</p>` : ''}${chipList('Runs on', id.engineCards)}${context?.version && context?.plan ? `<p class="air-note">App plan support: ${esc(context.plan.status || 'unknown')}${context.plan.label ? ' · ' + esc(context.plan.label) : ''}. Structural support is not a verified winning route.</p>` : ''}</article>`;
  // Rows in Power's own order (what to fix first), each with Power's number and status; the coach
  // only adds what it means for this deck and what the count can't show.
  const said = new Map((r.explain || []).map(x => [x.area, x])), more = new Map(); for (const b of r.beyond || []) (more.get(b.area) || more.set(b.area, []).get(b.area)).push(b);
  const fixes = new Set((r.improve || []).map(x => x.area).filter(Boolean));
  const order = [...new Set([...P.priority, ...P.areas.filter(a => a.status === 'strong').map(a => a.key), ...said.keys()])].filter(k => areaOf.has(k) && (said.has(k) || more.has(k) || P.priority.includes(k)));
  const rows = order.map((k, i) => {
    const a = areaOf.get(k), [word, tone] = STATUS[a.status] || STATUS.ok, x = said.get(k);
    const meter = a.status === 'cap' && Number.isFinite(a.max) ? `<span class="air-max">max ${esc(String(a.max ?? ''))}</span>` : Number.isFinite(a.ratio) ? `<div class="air-meter ${tone}"><span style="width:${Math.round(Math.min(1, a.ratio) * 100)}%"></span></div>` : '';
    return `<div class="air-area ${tone}" style="--i:${i + 3}"><div class="air-area-top"><b>${esc(a.label)}</b>${a.count !== '' && a.count != null ? `<span class="air-num">${esc(String(a.count))}${a.target !== '' && a.target != null ? `<small> / ${esc(String(a.target))}</small>` : ''}</span>` : ''}<span class="air-status ${tone}">${word}</span></div>${meter}${Number.isFinite(a.rawCount) || Number.isFinite(a.effectiveCount) ? `<p class="air-note">${esc(a.countBasis || 'Heuristic contribution')}${Number.isFinite(a.rawCount) ? ' · raw tags ' + a.rawCount : ''}${Number.isFinite(a.effectiveCount) ? ' · effective units ' + a.effectiveCount : ''}</p>` : ''}${x ? `<p>${esc(x.says)}</p>${chips(x.cards)}` : a.why ? `<p class="air-note">${esc(a.why)}</p>` : ''}${(more.get(k) || []).map(b => `<div class="air-beyond"><span class="air-label">${b.countScope === 'effective-estimate' ? 'Effective estimate, not a verified count' : "What the count doesn't show"}</span><p>${esc(b.note)}</p>${ev(b.evidence)}</div>`).join('')}${fixes.has(k) ? `<button class="link air-jump" data-ai-tab="improve">See the swap that fixes this →</button>` : ''}</div>`;
  }).join('');
  const nums = `<div class="air-power-nums">${P.eligible === false || P.score === null ? '<span><b>—</b>Power unavailable</span>' : context?.strategic && P.competitive == null ? `<span><b>${P.score ?? '—'}</b>Power estimate</span>` : ''}${P.competitive != null ? `<span><b>${P.competitive}</b>Competitive</span>` : ''}<span><b>${P.engine ?? '—'}</b>Structure diagnostic</span></div>`;
  return who + (P.eligible === false || P.score === null ? `<p class="air-note">${esc(P.verdict || 'Overall Power unavailable. Component diagnostics only.')}</p>` : '') + (rows ? `<article class="air-card air-power" style="--i:2"><div class="air-card-head"><span class="air-label">Deck Power, explained</span>${nums}</div><p class="air-note">In the order to fix them. Counts and targets are Power's own; they are not a win rate.</p>${rows}</article>` : '');
}
const EDGE = { 'they are favoured': ['Tough matchup', 'bad'], close: ['Close', 'warn'], 'you are favoured': ['Good for you', 'good'] };
function metaTab(r, entry) {
  const pct = x => Math.round((x || 0) * 100) + '%';
  const rows = (r.meta || []).map((m, i) => {
    const [word, tone] = EDGE[m.edge] || EDGE.close, mine = new Map((entry.meta || []).map(f => [f.name, f]));
    return `<article class="air-card air-meta ${tone}" style="--i:${i + 1}"><div class="air-card-head"><span class="air-label">${pct(m.share)} of the field</span><span class="air-status ${tone}">${word}</span></div><h4>${esc(m.deck)}</h4><p class="air-lead">${esc(m.how)}</p>${m.theirKeys?.length ? `<div class="air-idrow"><span class="air-label">Their key cards</span><div class="air-chips them">${m.theirKeys.map(n => `<span>${esc(n)}</span>`).join('')}</div></div>` : ''}${m.yourAnswers?.length ? `<div class="air-idrow"><span class="air-label">Your answers</span>${chips(m.yourAnswers)}</div>` : `<p class="air-row bad"><b>Answers</b>None in this list yet; see Improve.</p>`}${m.plan ? `<p class="air-row good"><b>Plan</b>${esc(m.plan)}</p>` : ''}${mine.get(m.deck)?.lists ? `<p class="air-note">From ${mine.get(m.deck).lists} placing list${mine.get(m.deck).lists === 1 ? '' : 's'}.</p>` : ''}</article>`;
  }).join('');
  // Top decks the coach didn't cover still appear, with their key cards from the tournament data.
  const covered = new Set((r.meta || []).map(m => m.deck)), rest = (entry.meta || []).filter(f => !covered.has(f.name)).map((f, i) => `<article class="air-card air-meta" style="--i:${(r.meta || []).length + i + 1}"><div class="air-card-head"><span class="air-label">${pct(f.share)} of the field</span><span class="air-status ok">Odds not measured</span></div><h4>${esc(f.name)}</h4><div class="air-idrow"><span class="air-label">Plays</span><div class="air-chips them">${f.cards.slice(0, 6).map(c => `<span>${esc(c.name)}</span>`).join('')}</div></div></article>`).join('');
  const head = rows || rest ? `<p class="air-note">The decks winning now, from real tournament lists. "Tough" and "Good for you" come from the app's matchup simulation, 2,000 games each.${rest && !rows ? ' Tap Simulate matchups on the Power page once, then coach again, to see the odds here.' : ''}</p>` : `<p class="air-empty">No tournament data for this format is loaded yet. Open Power and tap "Compare with tournament decks", then coach again.</p>`;
  const sc = pressureTab(r, true);
  return head + rows + rest + (sc ? `<h4 class="air-sub">If things go wrong</h4>${sc}` : '');
}
function pressureTab(r, inner = false) {
  const sc = (r.pressure?.scenarios || []).map((s, i) => `<article class="air-card air-threat" style="--i:${i + 1}"><div class="air-card-head"><span class="air-label">If…</span><span class="air-check ${s.gap ? 'bad' : 'ok'}">${s.gap ? 'Seen in the field' : 'Not seen now'}</span></div><h4>${esc(s.threat)}</h4>${s.impact ? `<p>${esc(s.impact)}</p>` : ''}<p class="air-row ${s.gap ? 'bad' : 'good'}"><b>${s.gap ? 'Watch for' : 'Field'}</b>${esc(s.backup)}</p>${chips(s.backupCards)}${ev(s.evidence)}</article>`).join('');
  return inner ? sc : sc || '<p class="air-empty">No part of this list is exposed to a single kind of hate card.</p>';
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
  const hidden = (r.improve || []).length - shown.length, F = r.field, cl = (label, xs) => xs?.length ? `<div class="air-idrow"><span class="air-label">${label}</span><div class="air-chips them">${xs.map(n => `<span>${esc(n)}</span>`).join('')}</div></div>` : '';
  const field = F && (F.core.length || F.also.length || F.missing.length) ? `<article class="air-card air-field" style="--i:5"><span class="air-label">From tournament lists</span>${F.archetype ? `<p class="air-lead">Closest list: ${esc(F.archetype)}${F.similar != null ? `, ${Math.round(F.similar * 100)}% the same` : ''}${F.place ? `, ${esc(F.place)}` : ''}${F.event ? ` at ${esc(F.event)}` : ''}.</p>` : ''}${cl('Core cards you are missing', F.core)}${cl('That list plays, you don\'t', F.missing)}${cl('Lists like yours also play', F.also)}</article>` : '';
  const more = [...(r.needs || []), ...(r.checks || [])], needs = more.length ? `<article class="air-card air-tests" style="--i:6"><span class="air-label">Deck checks</span><ol>${more.map(t => `<li>${esc(t)}</li>`).join('')}</ol></article>` : '';
  return sw + field + needs + tests + (hidden ? `<p class="foot">${hidden} suggested swap${hidden === 1 ? ' was' : 's were'} left out because Power's deck check found the card isn't legal here.</p>` : '') || '<p class="air-empty">No card you own raises a weak part of this deck without lowering its Power.</p>';
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
  return `<section class="air-hero" style="--i:0"><span class="air-kicker"><span aria-hidden="true">✦</span> Fix first${focus ? ` · <em>${esc(focus.label)}</em>` : ''}</span><p class="air-headline">${esc(r.headline)}</p><div class="air-stats"><span>${plural(r.explain?.length || 0, 'part')} explained</span><span>${plural(r.meta?.length || 0, 'matchup')} simulated · ${plural(r.pressure?.scenarios?.length || 0, 'stress test')}</span><span>${plural(counts.improve, 'swap')} · ${scored} re-scored</span></div></section>
  <div class="air-tabs" role="tablist" aria-label="Coaching sections">${tabs.map(([k, icon, label]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-ai-tab="${k}"><span aria-hidden="true">${icon}</span>${label}<em>${counts[k]}</em></button>`).join('')}</div>
  <div class="air-panel" role="tabpanel">${body}</div>
  <p class="foot">Written by the app from its own measurements, with no AI. Counts, odds and simulations are estimates, not win rates. Your score is unchanged.</p>`;
}
export function aiReviewDialogContent(entry, stale = false) {
  if (stale) return '<div class="ai-state"><span class="ai-state-symbol" aria-hidden="true">↻</span><h3>The deck changed</h3><p>Close this window and ask for fresh coaching on your updated list. The earlier answer won\'t be applied to it.</p></div>';
  if (entry.busy) return `<div class="ai-state"><div class="ai-brand-loader" aria-hidden="true">${brandMark("brand-loading")}</div><h3>Coaching your deck</h3><p>Power is trying swaps from the cards you own and re-scoring each one.</p></div>`;
  if (entry.error) return `<div class="ai-state ai-error"><span class="ai-state-symbol" aria-hidden="true">!</span><h3>Coaching couldn't finish</h3><p>${esc(entry.error)}</p><p class="foot">Your deck and score are unchanged.</p><button class="btn small" data-ai-retry>Try again</button></div>`;
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
export function clearAiReviews() { closeAiReview(); entries.clear(); }
export function closeAiReview() {
  if (!activeDialog) return;
  const { node, key } = activeDialog; activeDialog = null;
  node.close?.(); node.remove();
  [...document.querySelectorAll('[data-act="aiDeckReview"], [data-act="flowCoach"]')].find(b => b.dataset.ai === key)?.focus({ preventScroll: true });
}
export function showAiReview(key, render, fetcher = fetch) {
  const entry = entries.get(key); if (!entry) return;
  if (activeDialog) closeAiReview();
  const node = document.createElement('dialog');
  node.className = 'ai-review-dialog ai-companion'; node.setAttribute('aria-labelledby', 'ai-review-title');
  node.innerHTML = `<div class="ai-dialog-shell"><header class="ai-dialog-head ask-head"><span class="judge-mark" aria-hidden="true">C</span><div><p class="eyebrow">Deck coach · offline</p><h2 id="ai-review-title">Deck coaching</h2></div><button class="icon" data-ai-close aria-label="Close deck coaching">✕</button></header><p class="ai-dialog-status sr-only" role="status" aria-live="polite"></p><div class="ai-dialog-body"></div></div>`;
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
  try { field = (entry.hooks?.field?.() || []).slice(0, 5).map(f => ({ name: String(f.name), share: Number(f.share) || 0, lists: f.lists || 0, cards: (f.rows || []).slice(0, 12).map(r => ({ name: r.c?.name || r.name, qty: r.qty, type: typeOf(r.c), text: textOf(r.c).slice(0, 400), details:cardDetails(entry.game,r.c).slice(0,1600) })) })); } catch {}
  entry.meta = field;
  return { ...entry.payload, meta: field, candidates: entry.cands.map(x => ({ ...cardEntry(entry.game, x.id, x.c.name, 1, 'owned', x.c), ...(x.helps.length ? { helps: x.helps.join(', ') } : {}) })) };
}
// How a swap moves one Power area: its count before and after, and whether Power's ratio for it rose.
function areaMove(v, key) {
  const a = v.beforeParts?.find(x => x.key === key), b = v.afterParts?.find(x => x.key === key);
  return a && b ? { before: a.count, after: b.count, up: b.ratio > a.ratio + 1e-9, down: b.ratio < a.ratio - 1e-9 } : null;
}
export async function runAiReview(key, render, fetcher = fetch, { quiet = false } = {}) {
  const entry = entries.get(key); if (!entry || entry.busy || entry.result) return;
  entry.busy = true; entry.error = ''; entry.errorCode = ''; entry.verified = null; if (!quiet) render(); updateDialog();
  try {
    await withCandidates(entry);
    if (entries.get(key) !== entry) return;
    const data = await buildCoachPlan(entry, entry.p);
    if (entries.get(key) !== entry) return;
    entry.result = data; entry.verified = null;
  } catch (e) { entry.error = e?.message || 'The coach could not read this deck.'; }
  finally { entry.busy = false; if (entries.get(key) === entry) render(); if (activeDialog?.entry === entry) updateDialog(); }
}

// The current coaching for a deck, with the app's own checks (used by scripts/coach-eval.mjs).
export function coachEntry(key) { const e = entries.get(key); return e ? { ...e, verified: verify(e) } : null; }
