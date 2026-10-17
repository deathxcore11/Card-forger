// Rules-only AI companion. Session memory stays local and is never sent as official evidence.
import { esc } from './ui.js';
import { aiOrb } from './ai-ui.js';
import { RULE_VERSIONS, RULE_SOURCES, sourceDestination, lessonReference, resolveRuleReference } from './rule-reference.js';
import { loadRulePack } from './rule-corpus.js';
import { FORMATS } from './formats.js';
import { openRuleReference, closeRuleReference, attachRuleLearning } from './rule-learning.js';

const NAMES = { mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!' };
const EXAMPLES = { mtg: ['Can a creature attack the turn it enters?', 'How does priority work?', 'How do flying and reach interact?'], ptcg: ['Can I attack on my first turn?', 'When can I evolve a Pokémon?', 'How does Pokémon Checkup work?'], ygo: ['Can I attack on the first turn?', 'How do Chains and Spell Speed work?', 'When can I Normal Summon?'] };
const sessions = new Map(); let current = null;
const FORMAT_CHOICES = { mtg: FORMATS.map(f => f.name), ptcg: ['Standard', 'Expanded', 'Unlimited', 'Gym Leader Challenge'], ygo: ['Advanced (TCG)', 'Traditional (TCG)', 'OCG', 'Master Duel', 'Speed Duel', 'Duel Links', 'Edison', 'GOAT', 'Casual'] };
const FORMAT_LABELS = { ...Object.fromEntries(FORMATS.map(f => [f.id, f.name])), glc: 'Gym Leader Challenge', tcg: 'Advanced (TCG)', traditional: 'Traditional (TCG)', md: 'Master Duel', speed: 'Speed Duel', dl: 'Duel Links' };
function formatOptions(context) { const values = [...new Set([context.format, ...FORMAT_CHOICES[context.game]].filter(Boolean))]; return '<option value="">Format not selected</option>' + values.map(f => `<option value="${esc(f)}"${f === context.format ? ' selected' : ''}>${esc(FORMAT_LABELS[f] || f)}</option>`).join(''); }
export function rulesContext(options = {}) {
  const game = options.game;
  if (!RULE_VERSIONS[game]) throw Error('Choose a supported game for the rules guide.');
  const cards = (options.cards || []).slice(0, 4).map(c => ({ game: c.game, id: String(c.id || ''), name: String(c.name || ''), set: String(c.set || ''), number: String(c.number || ''), typeLine: String(c.typeLine || ''), manaCost: String(c.manaCost || ''), text: String(c.text || ''), complete: c.complete === true }));
  if (cards.some(c => c.game !== game || !c.id || !c.name || c.text.length > 10000)) throw Error('Choose an exact card from this game, with its complete wording.');
  const references = (options.references || []).slice(0, 4).map(r => ({ kind: r.kind, game: r.game, version: r.version, doc: r.doc, entryId: r.entryId, label: r.label }));
  if (references.some(r => r.kind !== 'bundled-entry' || r.game !== game || r.version !== RULE_VERSIONS[game])) throw Error('Choose a rule from this game and source edition.');
  return { mode: 'rules', game, format: String(options.format || '').trim().slice(0, 80), version: RULE_VERSIONS[game], cards, references };
}
export function rulesContextKey(context) {
  return JSON.stringify([context.mode, context.game, context.format, context.version, context.cards.map(c => [c.game, c.id, c.set, c.number, c.name, c.typeLine, c.manaCost, c.text, c.complete]), context.references.map(r => [r.game, r.version, r.doc, r.entryId])]);
}
export { rulesAskPanel } from './ai-rules-panel.js';
const sectionHtml = section => section?.text ? `<p>${esc(section.text)}</p>` : '';
export function rulesAnswerHtml(answer, index = 0, context = null) {
  const citations = (answer.citations || []).map((c, n) => `<div class="rules-ai-citation"><button type="button" class="ask-item" data-rules-citation="${index}:${n}"><b>${esc(c.title)}</b><small>${esc(c.source?.title)} · ${esc(c.source?.date)}${c.source?.legacy ? ' · legacy source' : ''}</small><span>Open exact rule →</span></button><details><summary>Read cited excerpt</summary><p class="rule-source-text">${esc(c.quote)}</p></details></div>`).join('');
  const external = (answer.externalReferences || []).map((r, n) => `<button type="button" class="btn ghost small" data-rules-external="${index}:${n}">Open ${esc(r.label)} →</button>`).join('');
  return `<article class="ask-msg ai rules-ai-answer"><p class="ask-source">${answer.status === 'answered' ? 'From the indexed rules · AI interpretation' : answer.status === 'needs_context' ? 'One detail first' : 'Evidence is limited'}</p><div class="rules-ai-short">${sectionHtml(answer.shortAnswer)}</div>${(answer.explanation || []).map(sectionHtml).join('')}${answer.example?.text ? `<div class="learn-example"><span class="eyebrow">For example</span>${sectionHtml(answer.example)}</div>` : ''}${answer.questions?.length ? `<ul class="rules-ai-questions">${answer.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}${answer.details?.length ? `<details class="rules-ai-details"><summary>Why, timing & exceptions</summary>${answer.details.map(sectionHtml).join('')}</details>` : ''}${citations ? `<details class="rules-ai-sources" open><summary>Exact sources · ${answer.citations.length}</summary>${citations}</details>` : ''}${external}${context?.cards?.length ? `<details class="rules-ai-card-wording"><summary>Selected card wording</summary>${context.cards.map(c => `<p><b>${esc(c.name)}</b><small>${esc([c.set, c.number, c.id].filter(Boolean).join(' · '))}</small></p><p class="rule-source-text">${esc([c.typeLine, c.manaCost, c.text].filter(Boolean).join('\n'))}</p>`).join('')}<p class="foot">Supplied card context, not independently verified live wording.</p></details>${context.cards.some(c => !c.complete || !c.text) ? '<button type="button" class="btn ghost small" data-rules-drop-cards>Ask without selected card</button>' : ''}` : ''}<details class="rules-ai-limits"><summary>Scope & source dates</summary>${(answer.limitations || []).map(t => `<p class="small muted">${esc(t)}</p>`).join('')}</details><p class="foot">${esc(answer.disclaimer || 'AI interpretation, not an official judge or guaranteed ruling.')}</p></article>`;
}
function documentsHtml(game) {
  return `<details class="rules-ai-documents"><summary>Official documents & downloads</summary>${RULE_SOURCES[game].map(s => { const d = sourceDestination(s); return `<p><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} · ${esc(d.label)} ↗</a><small>${esc(s.organization)} · ${esc(s.date)}${s.legacy ? ' · legacy source' : ''}</small></p>`; }).join('')}${game === 'ygo' ? `<p><a href="${esc(lessonReference(game, '2021 Rules Update').url)}" target="_blank" rel="noopener noreferrer">Later 2021 update (external, not indexed) ↗</a></p>` : ''}</details>`;
}
function shell(context) {
  const node = document.createElement('dialog'); node.className = 'ask-dialog ai-companion rules-ask-dialog'; node.setAttribute('aria-labelledby', 'rules-ask-title');
  node.innerHTML = `<div class="ask-shell"><header class="ask-head">${aiOrb()}<div><p class="eyebrow">AI rules guide · ${esc(NAMES[context.game])}</p><h2 id="rules-ask-title">Ask a Judge</h2></div><button type="button" class="ask-new" data-rules-new aria-label="New rules chat">＋<span>New</span></button><button type="button" class="icon" data-rules-close aria-label="Close rules guide">✕</button></header><div class="rules-ai-format-bar"><label class="rules-ai-format"><span>Format</span><select data-rules-format aria-label="Rules format" aria-describedby="rules-format-hint" required>${formatOptions(context)}</select></label><p id="rules-format-hint" class="foot" data-rules-format-needed${context.format ? ' hidden' : ''}>Choose a format before asking. Rules can differ between formats.</p></div><div class="rules-ai-status sr-only" role="status" aria-live="polite"></div><div class="rule-learning rules-ai-root" data-learning-root data-game="${context.game}"><div class="rules-ai-home" data-learning-home><div class="ask-log rules-ai-log"></div><form class="ask-bar"><label class="sr-only" for="rules-question">Your rules question</label><input id="rules-question" class="ask-input" name="question" autocomplete="off" maxlength="1200" placeholder="Describe the rule or situation…"><button class="ask-send" aria-label="Ask about this rule">↑</button></form></div><div data-learning-library hidden></div><section class="rule-destination rules-ai-destination" data-rule-destination hidden></section></div></div>`;
  return node;
}
function emptyHtml(context) {
  return `<div class="ask-empty"><p class="ask-hello">${context.format ? 'What happened at the table?' : 'Choose your format first'}</p><p class="small muted">Ask about a rule, or describe the cards, turn and board state. I’ll use dated rulebook excerpts and ask when something is missing.</p>${context.cards.length ? `<div class="rules-ai-cards"><p class="eyebrow">Selected card context</p>${context.cards.map(c => `<p><b>${esc(c.name)}</b><small>${esc([c.set, c.number, c.id].filter(Boolean).join(' · '))}</small></p>`).join('')}<p class="foot">${context.cards.every(c => c.complete) ? 'Complete supplied wording. Not independently verified against live card errata.' : 'Some wording is missing. Return to fully loaded card details for exact-card help, or ask a general rule without this card.'}</p><button type="button" class="btn ghost small" data-rules-drop-cards>Ask without selected card</button></div>` : ''}<div class="ask-examples">${EXAMPLES[context.game].map(q => `<button type="button" data-rules-example="${esc(q)}">${esc(q)}</button>`).join('')}</div><p class="foot">Not an official judge. A matching citation verifies its source, not the interpretation. No automatic paid retries.</p>${context.game === 'ygo' ? '<p class="note small">Only legacy books are indexed. Later placement and activation rules may be unsupported.</p>' : ''}${documentsHtml(context.game)}</div>`;
}
function append(session, html) {
  const row = document.createElement('div'); row.className = 'rules-ai-row'; row.innerHTML = html; session.log.append(row); return row;
}
function paint(session) {
  if (current !== session || !session.node.isConnected) return;
  if (!session.entries.length && !session.pending) session.log.innerHTML = emptyHtml(session.context);
  else {
    session.log.querySelector('.ask-empty')?.remove();
    while (session.painted < session.entries.length) {
      const entry = session.entries[session.painted], index = session.painted++;
      if (entry.kind === 'question') append(session, `<div class="ask-msg me"><p>${esc(entry.text)}</p></div>`);
      else if (entry.kind === 'answer') append(session, rulesAnswerHtml(entry.answer, index, session.context));
      else append(session, `<div class="ask-msg ai error"><p>${esc(entry.text)}</p><p class="foot">No answer was verified. You can ask again explicitly, or use the official references.</p></div>`);
    }
  }
  session.log.querySelector('[data-rules-pending]')?.closest('.rules-ai-row')?.remove();
  if (session.pending) append(session, '<div class="ask-msg ai thinking" data-rules-pending><span class="ask-step">Reading the indexed rules…</span><p class="foot">No automatic retries.</p></div>');
  session.input.disabled = !!session.pending; session.node.querySelector('.ask-send').disabled = !!session.pending || !session.context.format;
  session.node.classList.toggle('thinking', !!session.pending); session.log.setAttribute('aria-busy', String(!!session.pending));
}
export function openRulesAsk(options = {}) {
  const context = rulesContext(options), key = rulesContextKey(context);
  if (current?.key === key) { current.node.querySelector('[data-rules-format]').value = current.context.format; current.node.querySelector('[data-rules-close]')?.focus({ preventScroll: true }); return current.node; }
  closeRulesAsk();
  let session = sessions.get(key);
  if (!session) {
    const node = shell(context);
    session = { key, context, node, entries: [], clarification: [], painted: 0, pending: null, generation: 0, log: node.querySelector('.rules-ai-log'), input: node.querySelector('.ask-input'), root: node.querySelector('[data-learning-root]') };
    sessions.set(key, session); attachRuleLearning(session.root);
    node.addEventListener('cancel', e => { e.preventDefault(); closeRulesAsk(); });
    node.addEventListener('click', e => {
      if (current !== session) return;
      if (e.target === node || e.target.closest?.('[data-rules-close]')) return closeRulesAsk();
      if (e.target.closest?.('[data-rules-new]')) return restartRulesAsk();
      if (e.target.closest?.('[data-rules-drop-cards]')) return removeRulesCardContext();
      const example = e.target.closest?.('[data-rules-example]'); if (example) { session.input.value = example.dataset.rulesExample; session.input.focus(); return; }
      const citation = e.target.closest?.('[data-rules-citation],[data-rules-external]');
      if (citation) {
        const external = citation.dataset.rulesExternal !== undefined, [i, n] = (external ? citation.dataset.rulesExternal : citation.dataset.rulesCitation).split(':').map(Number), answer = session.entries[i]?.answer;
        const reference = external ? answer?.externalReferences?.[n] : answer?.citations?.[n]?.reference;
        if (reference?.game === session.context.game) return openRuleReference(session.root, reference, { trigger: citation });
      }
    });
    node.addEventListener('change', e => { if (current !== session || !e.target.matches?.('[data-rules-format]')) return; const draft = session.input.value; const next = openRulesAsk({ ...session.context, format: e.target.value, trigger: session.trigger, fetcher: session.fetcher }); next.querySelector('.ask-input').value = draft; });
    node.querySelector('.ask-bar').addEventListener('submit', e => { e.preventDefault(); if (current === session) askRules(session.input.value); });
  }
  session.trigger = options.trigger || document.activeElement;
  session.fetcher = options.fetcher || fetch;
  // Native change mutates the previous session's select before we detach it.
  // Reopening that cached answer must restore its authoritative format without
  // dispatching change or accidentally starting another request.
  session.node.querySelector('[data-rules-format]').value = session.context.format;
  current = session; document.body.append(session.node); paint(session);
  session.node.showModal ? session.node.showModal() : session.node.setAttribute('open', '');
  // Opening the guide, reopening an answer, and reading a source never summon a keyboard.
  session.node.querySelector('[data-rules-close]')?.focus({ preventScroll: true });
  return session.node;
}
export function closeRulesAsk() {
  if (!current) return;
  const session = current; current = null;
  // Cancel a pending source reveal and restore the persistent answer before detaching.
  for (let i = 0; i < 30 && session.root.querySelector('[data-learning-home]').hidden; i++) closeRuleReference(session.root);
  session.node.close?.(); session.node.remove();
  if (session.trigger?.isConnected !== false) session.trigger?.focus?.({ preventScroll: true });
  // Keep an already-started promise. Reopening cannot silently create a second paid call.
}
export function restartRulesAsk() {
  if (!current) return;
  const old = current, options = { ...old.context, trigger: old.trigger, fetcher: old.fetcher };
  old.generation++; old.controller?.abort(); closeRulesAsk(); sessions.delete(old.key); return openRulesAsk(options);
}
export function removeRulesCardContext() {
  if (!current?.context.cards.length) return;
  const old = current, options = { ...old.context, cards: [], references: [], trigger: old.trigger, fetcher: old.fetcher };
  const key = rulesContextKey(rulesContext(options)), previous = sessions.get(key);
  if (previous) { previous.generation++; previous.controller?.abort(); sessions.delete(key); }
  return openRulesAsk(options); // Explicitly start clean; do not silently promote partial text.
}
export function clearRulesConversations() {
  closeRulesAsk(); for (const s of sessions.values()) { s.generation++; s.controller?.abort(); } sessions.clear();
}
export async function askRules(question, fetcher) {
  const session = current; question = String(question || '').trim();
  if (!session || session.pending || !question) return;
  if (!session.context.format) {
    session.node.querySelector('.rules-ai-status').textContent = 'Choose a format before asking. Your question is still here.';
    session.node.querySelector('[data-rules-format]').focus({ preventScroll: true });
    return;
  }
  if (question.length > 1200) { session.node.querySelector('.rules-ai-status').textContent = 'Keep your question under 1,200 characters.'; return; }
  if (session.clarification.length > 3) { session.entries.push({ kind: 'error', text: 'This scenario is getting long. Start a new question and restate the relevant facts so no important wording is cut off.' }); paint(session); return; }
  const priorQuestions = [...session.clarification];
  // Only bounded prior PLAYER statements can clarify the same scenario. Never model answers.
  // No assistant history, generic Ask tools, collection or full deck data cross this boundary.
  const generation = session.generation, controller = new AbortController(); session.controller = controller;
  session.entries.push({ kind: 'question', text: question }); session.input.value = '';
  const pending = (async () => {
    try {
      await Promise.resolve(); // Set pending before even a synchronously failing transport.
      const response = await (fetcher || session.fetcher)('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...session.context, question, ...(priorQuestions.length ? { priorQuestions } : {}) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70000)]) });
      let data; try { data = await response.json(); } catch { throw Error('The rules guide is unavailable. Check your connection.'); }
      if (session.generation !== generation) return;
      if (!response.ok) throw Error(data.message || 'The rules guide is unavailable right now.');
      if (!data.answer || data.context?.game !== session.context.game || data.context?.format !== session.context.format || data.context?.version !== session.context.version) throw Error('This answer did not match the selected game, format and source edition.');
      const answer = await validateRulesResponse(data, session.context);
      if (session.generation !== generation) return;
      session.entries.push({ kind: 'answer', answer });
      session.clarification = answer.status === 'needs_context' ? [...priorQuestions, question] : [];
      if (current === session) session.node.querySelector('.rules-ai-status').textContent = data.answer.status === 'answered' ? 'Rules explanation ready.' : 'The guide needs more context or evidence.';
    } catch (error) {
      if (session.generation !== generation) return;
      session.entries.push({ kind: 'error', text: error.name === 'TimeoutError' ? 'The rules guide took too long. No automatic retry was made.' : error.message || 'The rules guide is unavailable.' });
      if (current === session) session.node.querySelector('.rules-ai-status').textContent = 'The guide could not verify an answer. The reference library remains available.';
    } finally {
      if (session.generation === generation) { session.pending = null; paint(session); }
    }
  })();
  session.pending = pending; paint(session); await pending;
}
// Hosts call this on game/format/card context navigation. Old pending results stay isolated.
export function syncRulesAskContext(options) {
  if (!current) return;
  let key; try { key = rulesContextKey(rulesContext(options)); } catch { closeRulesAsk(); return; }
  if (key !== current.key) closeRulesAsk();
}

// Defense in depth: canonical metadata and destinations never come from model prose.
export async function validateRulesResponse(data, context, { load = loadRulePack } = {}) {
  const fail = () => { throw Error('The guide could not verify the cited rules for this game and edition. No ruling was shown.'); };
  const a = data?.answer;
  if (!a || !['answered', 'needs_context', 'insufficient_evidence'].includes(a.status) || data.context?.game !== context.game || data.context?.format !== context.format || data.context?.version !== context.version || !Array.isArray(a.citations) || a.citations.length > 8) fail();
  const pack = a.citations.length ? await load(context.game) : null, ids = new Set();
  const citations = a.citations.map(c => {
    if (!c?.reference || c.reference.game !== context.game || c.reference.version !== context.version || typeof c.quote !== 'string' || !c.quote.trim() || c.quote.length > 700 || typeof c.id !== 'string' || ids.has(c.id)) fail();
    const resolved = resolveRuleReference(pack, c.reference);
    if (!resolved?.entry || c.id !== `${context.game}:${resolved.entry.doc}:${String(resolved.entry.id).toLowerCase().replace(/\.$/, '')}` || !resolved.entry.text.replace(/\s+/g, ' ').includes(c.quote.replace(/\s+/g, ' ').trim())) fail();
    ids.add(c.id); return { id: c.id, quote: c.quote, reference: resolved.reference, title: resolved.entry.title, source: resolved.source, destination: resolved.destination };
  });
  const sections = [a.shortAnswer, ...(a.explanation || []), a.example, ...(a.details || [])];
  if (!a.shortAnswer?.text || !Array.isArray(a.explanation) || !Array.isArray(a.details) || !Array.isArray(a.questions) || !Array.isArray(a.limitations) || typeof a.disclaimer !== 'string') fail();
  for (const part of sections) if (!part || typeof part.text !== 'string' || !Array.isArray(part.citationIds) || part.citationIds.some(id => !ids.has(id)) || (a.status === 'answered' && part.text && !part.citationIds.length)) fail();
  if (a.status === 'answered' && !citations.length) fail();
  const externalReferences = (a.externalReferences || []).map(r => { const resolved = resolveRuleReference(null, r); if (!resolved || r.game !== context.game || r.kind !== 'official-page') fail(); return resolved.reference; });
  return { ...a, citations, externalReferences };
}
