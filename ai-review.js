// On-demand review only. Selected deck data leaves the device after the user taps Review.
import { esc } from './ui.js';
const entries = new Map();
const plain = s => String(s ?? '').replace(/<[^>]*>/g, ' ').trim();
export function reviewPayload(game, deck, lookup, p) {
  const rows = game === 'mtg' ? [...(deck.cards || []).map(r => ({ ...r, zone: 'main' })), ...(deck.side || []).map(r => ({ ...r, zone: 'side' }))] : Object.entries(deck.zones || {}).flatMap(([zone, rows]) => rows.map(r => ({ ...r, zone })));
  return { game, format: p.formatName || deck.format || '', commander: game === 'mtg' ? deck.commander || '' : '', cards: rows.map((r, i) => {
    const c = lookup(game === 'mtg' ? r.name : r.cardId);
    const details = !c ? '' : game === 'mtg' ? JSON.stringify({ mana: c.mana_cost, identity: c.color_identity, power: c.power, toughness: c.toughness, produces: c.produced_mana, faces: c.card_faces?.map(x => ({ name: x.name, type: x.type_line, mana: x.mana_cost, text: x.oracle_text })) }) : JSON.stringify(game === 'ptcg' ? { stage: c.stage, evolvesFrom: c.evolveFrom, hp: c.hp, types: c.types, abilities: c.abilities, attacks: c.attacks, retreat: c.retreat, regulationMark: c.regulationMark } : { attribute: c.attribute, race: c.race, level: c.level, atk: c.atk, def: c.def, link: c.link, archetype: c.archetype });
    return { id: 'c' + i, name: c?.name || r.name || String(r.cardId), qty: r.qty, zone: game === 'mtg' && r.name === deck.commander && r.zone === 'main' ? 'commander' : r.zone, type: c?.type_line || c?.typeLine || '', text: plain(c?.oracle_text || c?.text || ''), details, known: !!c && !c.brief };
  }), checks: { engine: p.heuristic ?? p.score, competitive: p.ctx?.score ?? null, provisional: !!p.readiness?.provisional, issues: [...(p.readiness?.issues || []), ...(p.caps || []).map(c => `${c.label}: ${c.why || ''}`)] } };
}
export function aiReviewPanel(game, deck, lookup, p) {
  const payload = reviewPayload(game, deck, lookup, p), signature = JSON.stringify(payload), key = game + ':' + deck.id;
  let entry = entries.get(key);
  if (!entry || entry.signature !== signature) {
    if (entries.size > 40) entries.delete(entries.keys().next().value);
    entry = { signature, payload, busy: false, result: null, error: '' }; entries.set(key, entry);
  }
  const result = entry.result;
  return `<section class="panel ai-review" aria-label="AI deck review"><div class="row between"><div><p class="eyebrow">Second opinion</p><h3>AI deck review</h3></div><span class="chip">Optional</span></div><p class="small muted">Explore your plan, synergies and weak spots. Tapping Review sends this deck’s card text and checks to OpenAI. Your collection and account details stay out of the request.</p><p class="foot">AI interpretations need rules checks and do not change your score.</p>
  ${!result ? `<button class="btn small" data-act="aiDeckReview" data-ai="${esc(key)}" ${entry.busy ? 'disabled' : ''}>${entry.busy ? 'Reviewing your deck…' : 'Review with AI'}</button>` : `<p class="ai-plan">${esc(result.plan)}</p>${result.findings.map(f => `<article class="ai-finding ${f.kind}"><div class="row between"><b>${esc(f.title)}</b><span class="chip">${f.kind === 'idea' ? 'Try next' : f.kind === 'risk' ? 'Check this' : 'Strength'}</span></div><p>${esc(f.explanation)}</p><details><summary>Card-text evidence</summary>${f.evidence.map(e => `<p class="small"><b>${esc(e.name)}</b><br><q>${esc(e.quote)}</q></p>`).join('')}</details>${f.verify ? `<p class="foot"><b>Still to verify:</b> ${esc(f.verify)}</p>` : ''}</article>`).join('')}${result.questions.length ? `<h4>Questions to test</h4><ul>${result.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}${result.omitted ? '<p class="foot">Some findings were omitted because their card-text citations could not be matched.</p>' : ''}<p class="foot">AI interpretation · evidence quotes matched to supplied text; interactions are not rules-verified. This review clears when you change the deck or reload.</p>`}
  <div role="status" aria-live="polite">${entry.error ? `<p class="warn-text small">${esc(entry.error)}</p>` : entry.busy ? '<p class="small muted">Checking the supplied cards. You can keep browsing.</p>' : ''}</div></section>`;
}
export async function runAiReview(key, render, fetcher = fetch) {
  const entry = entries.get(key); if (!entry || entry.busy || entry.result) return;
  entry.busy = true; entry.error = ''; render();
  try {
    const r = await fetcher('/api/ai/deck-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry.payload), signal: AbortSignal.timeout(55000) });
    let data; try { data = await r.json(); } catch { throw Error('AI review is unavailable. Check your connection and try later.'); }
    if (!r.ok) throw Error(data.message || 'AI review is unavailable. Try later.');
    if (!data || typeof data.plan !== 'string' || !Array.isArray(data.findings) || !Array.isArray(data.questions)) throw Error('AI review returned an unreadable response.');
    entry.result = data;
  } catch (e) { entry.error = e.name === 'TimeoutError' || e.name === 'AbortError' ? 'AI review took too long. Try again later.' : e.message || 'AI review is unavailable.'; }
  finally { entry.busy = false; if (entries.get(key) === entry) render(); }
}
