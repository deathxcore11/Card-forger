// Deck coach, no AI. Everything here is the app's own measurement, put into plain sentences by fixed rules:
// Deck Power's areas, the 3,000-shuffle hand odds, the played-out goldfish, the tournament field, the matchup
// simulation and swaps that Power itself re-scores. Works offline; nothing leaves the device.
import { unmetNeeds } from './deck-needs.js';

const nm = x => typeof x === 'string' ? x : x?.name || x?.label || x?.key || '';
const pct = v => Math.round(v * 100) + '%';
const typeOf = c => c?.type_line || c?.typeLine || c?.card_faces?.[0]?.type_line || c?.type || '';
const isLand = c => /\bLand\b/.test(typeOf(c).split(' // ')[0]);
const list = (xs, n = 4) => { xs = xs.slice(0, n); return xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || ''; };
const num = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v ?? '');
const cut = (s, n = 400) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function refs(entry) {
  const byName = new Map();
  for (const r of entry.rows) if (r.c?.name && r.zone !== 'side' && !byName.has(r.c.name.toLowerCase())) byName.set(r.c.name.toLowerCase(), { cardId: r.id, name: r.c.name });
  return (xs, n = 6) => [...new Set((xs || []).map(nm).filter(Boolean).map(x => x.toLowerCase()))].map(k => byName.get(k)).filter(Boolean).slice(0, n);
}

function headline(P) {
  const top = P.areas.find(a => a.key === P.priority[0]);
  if (P.eligible === false) return cut(`${P.availabilityReason || 'This list is not complete enough to rate'}. The parts below are still measured.`, 300);
  if (!top) { const best = P.areas.filter(a => a.status === 'strong').sort((a, b) => (b.ratio || 0) - (a.ratio || 0))[0]; return best ? `No part of this deck is under its target. Its strongest part is ${best.label}.` : 'No part of this deck is under its target.'; }
  if (top.status === 'cap') return cut(`${top.label} holds this deck to ${top.max} Power. Fix that before anything else.`, 300);
  const have = top.count !== '' ? ` It has ${num(top.count)}${top.target !== '' ? ` where about ${num(top.target)} is the aim` : ''}.` : '';
  return cut(`${top.label} is the weakest part of this deck.${have}${top.lost ? ` It costs ${num(top.lost)} Power.` : ''}`, 300);
}

function explain(P, ref) {
  const keys = [...new Set([...P.priority, ...P.areas.filter(a => a.status === 'strong').map(a => a.key)])];
  return keys.map(k => P.areas.find(a => a.key === k)).filter(Boolean).map(a => {
    const cards = ref(a.cards, 6), n = a.count !== '' && a.target !== '' ? `${num(a.count)} where about ${num(a.target)} is the aim.` : '';
    const lead = a.status === 'cap' ? `This limits the whole score to ${a.max}. ` : '';
    return { area: a.key, says: cut(lead + (a.why || n), 420), cards };
  });
}

// Opening hand: a fixed rule, stated in the answer. Magic: lands in hand and what can be cast early.
function handRead(entry, p, ids = entry.payload.hand) {
  const byId = new Map(entry.rows.map(r => [r.id, r])), hand = (ids || []).map(id => byId.get(id)).filter(r => r?.c);
  if (!hand.length) return null;
  const game = entry.game, weak = (entry.payload.power?.areas || []).find(a => a.key === (entry.payload.power.priority || []).find(k => !k.startsWith('cap:')));
  const odds = (p?.sims || []).filter(s => Number.isFinite(s.p)).slice(0, 5).map(s => ({ label: s.label, p: s.p, target: s.target ?? null, lower: !!s.lower, note: s.note || '' }));
  if (game === 'mtg') {
    const lands = hand.filter(r => isLand(r.c)), spells = hand.filter(r => !isLand(r.c)).sort((a, b) => (a.c.cmc || 0) - (b.c.cmc || 0)), n = lands.length, size = hand.length;
    const early = spells.filter(r => (r.c.cmc || 0) <= Math.min(3, n + 1));
    const verdict = n < 2 || n > size - 2 ? 'mulligan' : n === 2 && !early.length ? 'mulligan' : 'keep';
    const reason = verdict === 'keep' ? `${n} land${n === 1 ? '' : 's'} and ${spells.length} spell${spells.length === 1 ? '' : 's'}${early.length ? `, with ${list([...new Set(early.map(r => r.c.name))], 3)} castable in the first three turns` : ''}. The rule used: keep ${size} cards with 2 to ${size - 2} lands and something to cast early.`
      : n < 2 ? `Only ${n} land${n === 1 ? '' : 's'} in ${size} cards. The rule used: fewer than 2 lands is a mulligan.` : n > size - 2 ? `${n} lands and only ${spells.length} spell${spells.length === 1 ? '' : 's'}. The rule used: a hand with fewer than 2 spells is a mulligan.` : `2 lands and nothing to cast in the first three turns. The rule used: a 2-land hand needs an early play.`;
    const turns = []; let used = new Set();
    for (let t = 1; t <= Math.min(4, n + 1); t++) { const play = spells.filter(r => !used.has(r) && (r.c.cmc || 0) <= Math.min(t, n) && (r.c.cmc || 0) > 0).pop(); if (play) { used.add(play); turns.push(`Turn ${t}: ${play.c.name}`); } }
    return { verdict, reason, firstTurns: turns.join('. '), lookFor: n < 3 ? 'Your next land.' : weak ? `${weak.label}: the deck is short on it.` : '', preserve: '', evidence: [], odds };
  }
  if (game === 'ptcg') {
    const basics = hand.filter(r => r.c.category === 'Pokemon' && /basic/i.test(r.c.stage || '')), sup = hand.filter(r => /Supporter/.test(typeOf(r.c))), energy = hand.filter(r => r.c.category === 'Energy');
    return { verdict: basics.length ? 'keep' : 'mulligan', reason: basics.length ? `${basics.length} Basic Pokémon (${list(basics.map(r => r.c.name), 3)}), ${sup.length} Supporter${sup.length === 1 ? '' : 's'} and ${energy.length} Energy.` : 'No Basic Pokémon: the rules make you show the hand and draw a new one.', firstTurns: basics.length ? `Start with ${basics[0].c.name} Active.` : '', lookFor: !sup.length && basics.length ? 'A Supporter that draws cards.' : '', preserve: '', evidence: [], odds };
  }
  const t = r => typeOf(r.c), mon = hand.filter(r => !/Spell|Trap/.test(t(r))).length, sp = hand.filter(r => /Spell/.test(t(r))).length, tr = hand.filter(r => /Trap/.test(t(r))).length;
  return { verdict: 'none', reason: `${mon} monster${mon === 1 ? '' : 's'}, ${sp} Spell${sp === 1 ? '' : 's'} and ${tr} Trap${tr === 1 ? '' : 's'}. Yu-Gi-Oh! has no mulligan, so this hand is played as dealt.`, firstTurns: '', lookFor: '', preserve: '', evidence: [], odds };
}

// Magic: the deck's usual curve, from the cards it holds the most copies of at each mana value.
function curveLine(entry) {
  if (entry.game !== 'mtg') return [];
  const main = entry.rows.filter(r => r.zone === 'main' && r.c && !isLand(r.c)), steps = [], used = new Set();
  for (let t = 1; t <= 5; t++) {
    const pick = main.filter(r => !used.has(r) && Math.floor(r.c.cmc || 0) === t).sort((a, b) => b.row.qty - a.row.qty || a.c.name.localeCompare(b.c.name))[0];
    if (!pick) continue; used.add(pick);
    steps.push({ turn: t, cardId: pick.id, name: pick.c.name, kind: 'play', action: `${pick.row.qty} cop${pick.row.qty === 1 ? 'y' : 'ies'} in the deck, the most at ${t} mana.`, quote: '' });
  }
  return steps.length >= 2 ? [{ name: 'On curve', goal: 'The card this list holds the most copies of at each mana value, so the play you will most often have on that turn.', payoff: '', interrupt: '', steps }] : [];
}

function metaRead(entry, ref) {
  let sims = null; try { sims = entry.hooks?.matchups?.() || null; } catch {}
  const all = sims?.all || [], even = sims?.even ?? 0.5, P = entry.payload.power || { areas: [] };
  if (!all.length) return [];
  const answers = ref(P.areas.filter(a => /interact|removal|answer|disrupt|counter|hand trap/i.test(a.label + ' ' + a.key)).flatMap(a => a.cards), 4);
  return (entry.meta || []).map(f => {
    const m = all.find(x => x.name === f.name); if (!m || !Number.isFinite(m.w)) return null;
    const edge = m.w >= even + 0.05 ? 'you are favoured' : m.w <= even - 0.05 ? 'they are favoured' : 'close';
    return { deck: f.name, share: f.share, edge, how: cut(`This list wins ${pct(m.w)} of simulated games against it${even !== 0.5 ? ` (an even share is ${pct(even)})` : ''}.${m.why ? ' ' + m.why : ''}`, 420), theirKeys: f.cards.slice(0, 5).map(c => c.name), yourAnswers: answers, plan: '' };
  }).filter(Boolean);
}

function byRival(threats) {
  const m = new Map(); for (const t of threats) { const r = t.rival || 'A top deck'; (m.get(r) || m.set(r, []).get(r)).push(t.card || nm(t)); }
  return [...m].map(([r, cards]) => `${r} plays ${list([...new Set(cards)], 3)}`).join('. ') + '.';
}
function pressure(p) {
  return (p?.strategicRisk?.axes || []).slice(0, 4).map(a => {
    const cards = (a.cards || []).map(nm).filter(Boolean), threats = (a.threats || []).slice(0, 3);
    return { threat: `Something shuts off your ${String(a.label || '').toLowerCase()}`, impact: `${a.copies} card${a.copies === 1 ? '' : 's'} in this list lean on it${cards.length ? ': ' + list(cards, 5) : ''}.`, backup: threats.length ? byRival(threats) : 'No top deck in the loaded tournament field plays a card that does this.', backupCards: [], gap: threats.length > 0, evidence: [] };
  });
}

// Swaps from cards you own: Power says the added card raises a weak area, then Power re-scores every cut.
async function swaps(entry, budget = 3500) {
  const P = entry.payload.power || { areas: [], priority: [] }, out = [], t0 = Date.now();
  if (!entry.hooks?.rescore) return out;
  const keyOf = new Map(P.areas.map(a => [a.label, a])), weakLabels = new Set(P.areas.filter(a => a.status === 'weak' || a.status === 'cap').map(a => a.label));
  const areasOf = new Map(entry.payload.cards.map(c => [c.id, (c.power || '').split(', ').filter(Boolean)]));
  const cuts = entry.rows.filter(r => r.zone === 'main' && r.c && !(entry.game === 'mtg' && isLand(r.c))).map(r => ({ r, a: areasOf.get(r.id) || [] }))
    .sort((p, q) => p.a.filter(l => weakLabels.has(l)).length - q.a.filter(l => weakLabels.has(l)).length || p.a.length - q.a.length || p.r.row.qty - q.r.row.qty).slice(0, 8);
  const perArea = new Map();
  // First: cards you own that the closest tournament list plays and this list doesn't. Cut what that list doesn't play.
  const m = entry.p?.match, wanted = [...(entry.p?.ctx?.coreMissing || []), ...(m?.missing || [])].map(nm).filter(Boolean).map(x => x.toLowerCase()), extra = new Set((m?.extra || []).map(nm).map(x => x.toLowerCase()));
  if (wanted.length) {
    let pool = []; try { pool = (entry.hooks.candidates?.() || []).filter(Boolean); } catch {}
    const fieldCuts = [...cuts.filter(x => extra.has(x.r.c.name.toLowerCase())), ...entry.rows.filter(r => r.zone === 'main' && r.c && extra.has(r.c.name.toLowerCase()) && !cuts.some(x => x.r === r)).map(r => ({ r, a: areasOf.get(r.id) || [] })), ...cuts.filter(x => !extra.has(x.r.c.name.toLowerCase()))].filter(x => !(entry.game === 'mtg' && isLand(x.r.c))).slice(0, 8);
    for (const name of [...new Set(wanted)]) {
      if (out.length >= 3 || Date.now() - t0 > budget * 0.6) break;
      const c = pool.find(x => x.name?.toLowerCase() === name); if (!c) continue;
      let cand = (entry.cands || []).find(x => x.c === c); if (!cand) { cand = { id: 'o' + (entry.cands ||= []).length, c, helps: [] }; entry.cands.push(cand); }
      let best = null;
      for (const { r, a } of fieldCuts) {
        if (Date.now() - t0 > budget * 0.6) break;
        if (out.some(s => s.cut === r.id)) continue;
        try { const v = entry.hooks.rescore(r, c), had = new Set(v.beforeIssues || []); if (!(v.issues || []).some(i => !had.has(i)) && v.after > v.before && (!best || v.after > best.v.after)) best = { r, a, v }; } catch {}
        await new Promise(res => setTimeout(res, 0));
      }
      if (best) out.push({ area: '', cut: best.r.id, cutName: best.r.c.name, add: cand.id, addName: c.name, role: '', gain: `${m?.archetype || 'The closest tournament list'} plays ${c.name}, and you own it.`, loss: extra.has(best.r.c.name.toLowerCase()) ? `That list does not play ${best.r.c.name}.` : best.a.length ? `${best.r.c.name} counted toward ${list(best.a, 3)}.` : '', lost: '', test: '', evidence: [] });
    }
  }
  for (const cand of (entry.cands || []).filter(x => x.helps.length)) {
    if (out.length >= 5 || Date.now() - t0 > budget) break;
    const area = keyOf.get(cand.helps[0]); if (!area || (perArea.get(area.key) || 0) >= 2) continue;
    let best = null;
    for (const { r, a } of cuts) {
      if (Date.now() - t0 > budget) break;
      if (out.some(s => s.cut === r.id)) continue;
      try {
        const v = entry.hooks.rescore(r, cand.c), had = new Set(v.beforeIssues || []), bad = (v.issues || []).some(i => !had.has(i));
        const x = v.beforeParts?.find(z => z.key === area.key), y = v.afterParts?.find(z => z.key === area.key), up = x && y && y.ratio > x.ratio + 1e-9;
        if (!bad && up && v.after >= v.before && (v.after > v.before || String(x.count) !== String(y.count)) && (!best || v.after > best.v.after)) best = { r, a, v, x, y };
      } catch {}
      await new Promise(res => setTimeout(res, 0));
    }
    if (!best) continue;
    perArea.set(area.key, (perArea.get(area.key) || 0) + 1);
    out.push({ area: area.key, cut: best.r.id, cutName: best.r.c.name, add: cand.id, addName: cand.c.name, role: '', gain: `${area.label} goes from ${num(best.x.count)} to ${num(best.y.count)}${area.target !== '' ? ` (aim about ${num(area.target)})` : ''}.`, loss: best.a.length ? `${best.r.c.name} counted toward ${list(best.a, 3)}.` : `${best.r.c.name} was not counted toward any measured part.`, lost: '', test: '', evidence: [] });
  }
  return out;
}

function fieldAdds(p) {
  const m = p?.match, core = (p?.ctx?.coreMissing || []).map(nm).filter(Boolean).slice(0, 8), also = (p?.upgrades?.adds || []).map(nm).filter(Boolean).filter(x => !core.includes(x)).slice(0, 8);
  if (!core.length && !also.length && !m?.deck) return null;
  return { archetype: m?.archetype || m?.deck?.name || '', similar: Number.isFinite(m?.sim) ? m.sim : null, place: m?.deck?.place || '', event: m?.deck?.event || '', core, also, missing: (m?.missing || []).map(nm).filter(Boolean).slice(0, 8) };
}

function needs(entry) {
  if (entry.game !== 'mtg') return [];
  try {
    const rows = entry.rows.filter(r => r.zone === 'main' && r.c).map(r => ({ card: r.c, qty: r.row.qty })), size = rows.reduce((n, r) => n + r.qty, 0);
    const seen = new Set();
    return unmetNeeds(rows, { size: size >= 90 ? 100 : 60 }).filter(n => !seen.has(n.name + n.need) && seen.add(n.name + n.need)).slice(0, 5).map(n => `${n.name} wants ${n.label}: the list has ${n.have}, and it needs ${n.max !== Infinity && n.have > n.max ? 'no more than ' + n.max : 'at least ' + n.min}.`);
  } catch { return []; }
}

/** Everything the coach can say at once (no swaps yet), in the shape the coach screen draws. `p` is Deck Power's result; `hand` is a dealt hand's row ids. */
export function coachBasics(entry, p, hand = entry.payload.hand) {
  const P = entry.payload.power || { areas: [], priority: [] }, ref = refs(entry), g = p?.goldfish;
  const engine = ref((p?.engine?.links || []).flatMap(l => [l.payoff, ...(l.providers || [])]), 6);
  return {
    headline: headline(P), priority: P.priority[0] || '',
    identity: { plan: cut(P.plan || 'The app could not name a plan for this list.', 300), howItWins: cut(g?.headline || '', 300), winCards: [], proposedCards: [], winEvidence: [], evidenceStatus: '', engineCards: engine, winCon: cut(g?.winCon || '', 300), endgame: cut(g?.endgame || '', 300) },
    explain: explain(P, ref), beyond: [],
    meta: metaRead(entry, ref),
    pilot: { hand: handRead(entry, p, hand), lines: curveLine(entry), goldfish: (g?.metrics || []).filter(m => m.value != null).slice(0, 6).map(m => ({ label: m.label, value: m.pct ? pct(m.value) : num(typeof m.value === 'number' ? +m.value.toFixed(2) : m.value), note: m.note || '' })) },
    pressure: { scenarios: pressure(p) },
    improve: [], field: fieldAdds(p), needs: needs(entry), checks: (p?.readiness?.issues || []).slice(0, 6),
    tests: [], omitted: 0,
  };
}
/** The whole coaching result for one deck: the basics plus swaps from owned cards that Power has re-scored. */
export async function buildCoachPlan(entry, p) { return { ...coachBasics(entry, p), improve: await swaps(entry) }; }
