// On-demand review only. Selected deck data leaves the device after the user taps Review.
import { esc } from './ui.js';
const entries = new Map();
let activeDialog = null;
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
    entry = { signature, payload, busy: false, result: null, error: '', errorCode: '' }; entries.set(key, entry);
    if (activeDialog?.key === key) { activeDialog.stale = true; updateDialog(); }
  }
  const result = entry.result;
  return `<section class="panel ai-review ai-review-launch" aria-label="AI deck review"><div class="ai-launch-top"><span class="ai-sigil" aria-hidden="true">✦</span><div><p class="eyebrow">Second opinion · all three games</p><h3>See how your deck connects</h3></div><span class="chip">AI</span></div><p class="small muted">A closer look at your game plan, synergies and weak spots, with card-text evidence.</p><div class="ai-launch-actions"><button class="btn small" data-act="aiDeckReview" data-ai="${esc(key)}">${entry.busy ? 'View review progress' : result ? 'Open AI review' : 'Review with AI'} <span aria-hidden="true">↗</span></button><span class="small muted">${entry.busy ? 'Review in progress' : result ? `${result.findings.length} findings ready` : 'Optional · your score stays unchanged'}</span></div><p class="foot">Tapping Review sends this deck’s card text and checks to OpenAI. Your collection and account details stay out of the request.</p><div role="status" aria-live="polite">${entry.error ? `<p class="warn-text small">${esc(entry.error)}</p>` : ''}</div></section>`;
}
function reviewReport(result) {
  return `<p class="ai-plan">${esc(result.plan)}</p>${result.findings.map(f => `<article class="ai-finding ${['strength','risk','idea'].includes(f.kind) ? f.kind : 'idea'}"><div class="row between"><b>${esc(f.title)}</b><span class="chip">${f.kind === 'idea' ? 'Try next' : f.kind === 'risk' ? 'Check this' : 'Strength'}</span></div><p>${esc(f.explanation)}</p><details><summary>Card-text evidence</summary>${f.evidence.map(e => `<p class="small"><b>${esc(e.name)}</b><br><q>${esc(e.quote)}</q></p>`).join('')}</details>${f.verify ? `<p class="foot"><b>Still to verify:</b> ${esc(f.verify)}</p>` : ''}</article>`).join('')}${result.questions.length ? `<h4>Questions to test</h4><ul>${result.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}${result.omitted ? '<p class="foot">Some findings were omitted because their card-text citations could not be matched.</p>' : ''}<p class="foot">AI interpretation · evidence quotes matched to supplied text; interactions are not rules-verified. Your score is unchanged. This review clears when you change the deck or reload.</p>`;
}
export function aiReviewDialogContent(entry, stale = false) {
  if (stale) return '<div class="ai-state"><span class="ai-state-symbol" aria-hidden="true">↻</span><h3>The deck changed</h3><p>Close this window and request a fresh review of your updated list. The earlier response will not be applied to it.</p></div>';
  if (entry.busy) return `<div class="ai-state"><div class="ai-orbit" aria-hidden="true"><i></i><span>✦</span></div><p class="eyebrow">Your deck, another perspective</p><h3>Requesting your AI review</h3><p>OpenAI is reviewing the supplied cards and checks. We’ll show its response and matching text evidence here.</p><div class="ai-review-steps"><span>Deck sent</span><span class="current">Awaiting review</span><span>Evidence check next</span></div><p class="foot">You can close this window and keep browsing. Reopening progress won’t start another request. No automatic retries.</p></div>`;
  if (entry.error) {
    const title = ['billing','credits','spend_limit','usage_limit'].includes(entry.errorCode) ? 'API billing needs attention' : entry.errorCode === 'rate_limit' ? 'OpenAI needs a breather' : entry.errorCode === 'app_limit' ? 'App review allowance reached' : entry.errorCode === 'authentication' ? 'API connection needs attention' : 'Review couldn’t finish';
    return `<div class="ai-state ai-error"><span class="ai-state-symbol" aria-hidden="true">!</span><h3>${title}</h3><p>${esc(entry.error)}</p><p class="foot">Your deck and score are unchanged. Another request uses the review allowance, so fix the issue before retrying.</p><button class="btn small" data-ai-retry>Try again</button></div>`;
  }
  return entry.result ? `<div class="ai-ready" role="status"><span aria-hidden="true">✦</span> Review ready · ${entry.result.findings.length} findings</div>${reviewReport(entry.result)}` : '<p>Choose a deck to begin a review.</p>';
}
function updateDialog() {
  if (!activeDialog) return;
  const body = activeDialog.node.querySelector('.ai-dialog-body');
  body.setAttribute('aria-busy', String(activeDialog.entry.busy && !activeDialog.stale));
  body.innerHTML = aiReviewDialogContent(activeDialog.entry, activeDialog.stale);
  activeDialog.node.querySelector('.ai-dialog-status').textContent = activeDialog.stale ? 'Deck changed' : activeDialog.entry.busy ? 'Review in progress' : activeDialog.entry.error ? 'Review unavailable' : 'Review ready';
}
export function closeAiReview() {
  if (!activeDialog) return;
  const { node, key } = activeDialog; activeDialog = null;
  node.close?.(); node.remove();
  [...document.querySelectorAll('[data-act="aiDeckReview"]')].find(b => b.dataset.ai === key)?.focus({preventScroll:true});
}
export function showAiReview(key, render, fetcher = fetch) {
  const entry = entries.get(key); if (!entry) return;
  if (activeDialog) closeAiReview();
  const node = document.createElement('dialog');
  node.className = 'ai-review-dialog'; node.setAttribute('aria-labelledby','ai-review-title');
  node.innerHTML = `<div class="ai-dialog-shell"><header class="ai-dialog-head"><div><p class="eyebrow">Second opinion</p><h2 id="ai-review-title">AI deck review</h2></div><button class="icon" data-ai-close aria-label="Close AI review">✕</button></header><p class="ai-dialog-status sr-only" role="status" aria-live="polite"></p><div class="ai-dialog-body"></div></div>`;
  document.body.append(node); activeDialog = { key, entry, node, stale: false };
  node.addEventListener('cancel', e => { e.preventDefault(); closeAiReview(); });
  node.addEventListener('click', e => {
    if (e.target === node || e.target.closest('[data-ai-close]')) closeAiReview();
    else if (e.target.closest('[data-ai-retry]') && !activeDialog?.stale) { void runAiReview(key, render, fetcher); node.querySelector('[data-ai-close]').focus(); }
  });
  updateDialog();
  if (node.showModal) node.showModal(); else node.setAttribute('open','');
  node.querySelector('[data-ai-close]').focus();
  if (!entry.busy && !entry.result) return runAiReview(key, render, fetcher);
}
export async function runAiReview(key, render, fetcher = fetch) {
  const entry = entries.get(key); if (!entry || entry.busy || entry.result) return;
  entry.busy = true; entry.error = ''; entry.errorCode = ''; render(); updateDialog();
  try {
    const r = await fetcher('/api/ai/deck-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry.payload), signal: AbortSignal.timeout(55000) });
    let data; try { data = await r.json(); } catch { throw Error('AI review is unavailable. Check your connection and try later.'); }
    if (!r.ok) throw Object.assign(Error(data.message || 'AI review is unavailable. Try later.'), { code: data.code || '' });
    if (!data || typeof data.plan !== 'string' || !Array.isArray(data.findings) || !Array.isArray(data.questions)) throw Error('AI review returned an unreadable response.');
    entry.result = data;
  } catch (e) { entry.errorCode = e.code || ''; entry.error = e.name === 'TimeoutError' || e.name === 'AbortError' ? 'AI review took too long. Try again later.' : e.message || 'AI review is unavailable.'; }
  finally { entry.busy = false; if (entries.get(key) === entry) render(); if (activeDialog?.entry === entry) updateDialog(); }
}
