// Ask a Judge, no AI. The screen for judge-search.js: a question is answered with the exact rule text from the
// rulebook the app ships, so it works offline and costs nothing. Nothing here calls the AI service.
import { esc } from './ui.js';
import { loadRulePack } from './rule-corpus.js';
import { judgeAnswer, findCardNames } from './judge-search.js';
import { PTCG_GLOSSARY, YGO_GLOSSARY } from './game-glossary-data.js';
import { openRuleReference, closeRuleReference, attachRuleLearning } from './rule-learning.js';

const NAMES = { mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!' };
export const JUDGE_EXAMPLES = { mtg: ['Can a creature attack the turn it enters?', 'Does deathtouch work with trample?', 'Does lifelink stack?', 'Can I respond to a land being played?'], ptcg: ['Can I attack on my first turn?', 'When can I evolve a Pokémon?', 'What does Poisoned do?'], ygo: ['Can I attack on the first turn?', 'How do Chains work?', 'What is a Quick Effect?'] };
const GLOSSARY = { ptcg: PTCG_GLOSSARY, ygo: YGO_GLOSSARY };
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const dated = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); return m ? `${MONTHS[+m[2] - 1]}${m[3] ? ' ' + +m[3] + ',' : ''} ${m[1]}` : String(v || ''); };
const numberLabel = (game, rule) => game === 'mtg' ? rule.number : 'Page ' + (String(rule.number).match(/p(\d+)$/)?.[1] || rule.number);
const headLabel = (game, rule) => game === 'mtg' ? rule.heading : String(rule.heading || '').replace(/\s*·\s*PDF page \d+$/, '');
let current = null;

function ruleHtml(game, rule, at, lead) {
  const short = rule.focus && rule.focus !== rule.text;
  return `<div class="judge-rule${lead ? ' lead' : ''}"><div class="judge-num"><b>${esc(numberLabel(game, rule))}</b><span>${esc(headLabel(game, rule))}</span></div><p>${esc(short ? rule.focus : rule.text)}</p>${short ? `<details><summary>Read the whole rule</summary><p>${esc(rule.text)}</p></details>` : ''}<button type="button" class="judge-open" data-judge-ref="${at}">Open in Rules</button></div>`;
}
/** One answer as markup. `index` is the entry's place in the conversation; rule buttons carry index:n. */
export function judgeAnswerHtml(answer, index = 0) {
  const game = answer.game, edition = answer.edition ? `${esc(answer.edition.title)}, ${esc(dated(answer.edition.date))}. ` : '';
  const cards = (answer.cards || []).filter(c => c.text || c.rulings.length).map(c => `<div class="judge-card"><b>${esc(c.name)}</b>${c.text ? `<p class="judge-card-text">${esc(c.text)}</p>` : ''}${c.rulings.map(r => `<p class="judge-ruling"><small>Official ruling${r.date ? ' · ' + esc(dated(r.date)) : ''}</small>${esc(r.text)}</p>`).join('')}${!c.rulings.length && c.rulingCount ? `<p class="foot">This card has ${c.rulingCount} official ruling${c.rulingCount === 1 ? '' : 's'}; none match these words.</p>` : ''}</div>`).join('');
  if (answer.status === 'none' && !cards) return `<article class="judge-answer judge-miss"><h3>That isn’t in the rulebook</h3><p>I only answer from the rules. Try naming a keyword, a step of the turn, or what happened at the table.</p><div class="judge-try">${(JUDGE_EXAMPLES[game] || []).slice(0, 2).map(q => `<button type="button" data-judge-example="${esc(q)}">${esc(q)}</button>`).join('')}</div></article>`;
  const read = answer.read.length ? `<p class="judge-read">Read as ${answer.read.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</p>` : '';
  const rules = [answer.lead, ...answer.rules].filter(Boolean).slice(0, 4), sure = answer.status === 'answered', cardBlock = cards ? '<p class="judge-label">Cards you named</p>' + cards : '';
  const terms = (answer.terms || []).map(t => `<p class="judge-term"><b>${esc(t.label)}</b> ${esc(t.def)}${(t.points || []).map(p => ' ' + esc(p)).join('')}${t.ours ? ' <small>CardStashy note</small>' : ''}</p>`).join('');
  return `<article class="judge-answer">${read}${cardBlock}${!sure && rules.length ? `<p class="judge-label">${cards ? 'Rules for what these cards do' : 'Closest rules I found'}</p>` : ''}${rules.map((r, n) => (n === 1 && sure ? '<p class="judge-label">Goes with it</p>' : '') + ruleHtml(game, r, index + ':' + n, n === 0 && sure)).join('')}${terms}<p class="foot judge-foot">${edition}At an event, the judge there has the final say.</p></article>`;
}
function shell(game) {
  const node = document.createElement('dialog'); node.className = 'ask-dialog rules-ask-dialog judge-dialog'; node.setAttribute('aria-labelledby', 'judge-title');
  node.innerHTML = `<div class="ask-shell"><header class="ask-head"><span class="judge-mark" aria-hidden="true">J</span><div><p class="eyebrow">${esc(NAMES[game])} rulebook · offline</p><h2 id="judge-title">Ask a Judge</h2></div><button type="button" class="ask-new" data-judge-new aria-label="Clear the questions">＋<span>New</span></button><button type="button" class="icon" data-judge-close aria-label="Close Ask a Judge">✕</button></header><div class="rules-ai-status sr-only" role="status" aria-live="polite"></div><div class="rule-learning rules-ai-root" data-learning-root data-game="${game}"><div class="rules-ai-home" data-learning-home><div class="ask-log rules-ai-log"></div><form class="ask-bar"><label class="sr-only" for="judge-question">Your rules question</label><input id="judge-question" class="ask-input" name="question" autocomplete="off" maxlength="400" placeholder="Ask about a rule, keyword or card…"><button class="ask-send" aria-label="Ask">↑</button></form></div><div data-learning-library hidden></div><section class="rule-destination rules-ai-destination" data-rule-destination hidden></section></div></div>`;
  return node;
}
const emptyHtml = s => `<div class="ask-empty"><p class="ask-hello">What happened at the table?</p><p class="small muted">Name a keyword, a step of the turn or a card. You get the exact rule, with its number.</p>${s.cards.length ? `<p class="judge-with">Asking about ${s.cards.map(c => `<b>${esc(c.name)}</b>`).join(', ')}</p>` : ''}<div class="ask-examples">${(JUDGE_EXAMPLES[s.game] || []).map(q => `<button type="button" data-judge-example="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
function paint(s) {
  if (current !== s) return;
  s.log.innerHTML = s.entries.length ? s.entries.map((e, i) => e.kind === 'question' ? `<div class="ask-msg me"><p>${esc(e.text)}</p></div>` : e.kind === 'error' ? `<div class="ask-msg ai error"><p>${esc(e.text)}</p></div>` : judgeAnswerHtml(e.answer, i)).join('') : emptyHtml(s);
  const last = s.log.lastElementChild; if (s.entries.length && last) (s.log.querySelectorAll('.ask-msg.me')[s.log.querySelectorAll('.ask-msg.me').length - 1] || last).scrollIntoView?.({ block: 'start' });
}
/**
 * Open the Judge. options: game, format, cards (already held: {name,text,keywords,rulings}), question (asked at once), trigger,
 * names: async () => Set of lower-cased card names, card: async name => {name,text,keywords,rulings} | null.
 */
export function openJudge(options = {}) {
  const game = options.game; if (!NAMES[game]) throw Error('Choose a supported game for the Judge.');
  closeJudge();
  const node = shell(game), s = current = { game, format: String(options.format || ''), cards: (options.cards || []).slice(0, 4), node, entries: [], log: node.querySelector('.rules-ai-log'), input: node.querySelector('.ask-input'), root: node.querySelector('[data-learning-root]'), trigger: options.trigger || document.activeElement, names: options.names, card: options.card, load: options.load || loadRulePack };
  attachRuleLearning(s.root);
  node.addEventListener('cancel', e => { e.preventDefault(); closeJudge(); });
  node.addEventListener('click', e => {
    if (current !== s) return;
    if (e.target === node || e.target.closest?.('[data-judge-close]')) return closeJudge();
    if (e.target.closest?.('[data-judge-new]')) { s.entries = []; s.cards = []; paint(s); s.input.focus(); return; }
    const example = e.target.closest?.('[data-judge-example]'); if (example) return askJudge(example.dataset.judgeExample);
    const ref = e.target.closest?.('[data-judge-ref]');
    if (ref) { const [i, n] = ref.dataset.judgeRef.split(':').map(Number), a = s.entries[i]?.answer, rule = a && [a.lead, ...a.rules].filter(Boolean)[n]; if (rule?.reference) return openRuleReference(s.root, rule.reference, { trigger: ref }); }
  });
  node.querySelector('.ask-bar').addEventListener('submit', e => { e.preventDefault(); if (current === s) askJudge(s.input.value); });
  document.body.append(node); paint(s);
  node.showModal ? node.showModal() : node.setAttribute('open', '');
  node.querySelector('[data-judge-close]')?.focus({ preventScroll: true });
  if (options.question) askJudge(options.question);
  return node;
}
export function closeJudge() {
  if (!current) return;
  const s = current; current = null;
  for (let i = 0; i < 30 && s.root.querySelector('[data-learning-home]').hidden; i++) closeRuleReference(s.root);
  s.node.close?.(); s.node.remove();
  if (s.trigger?.isConnected !== false) s.trigger?.focus?.({ preventScroll: true });
}
export async function askJudge(question) {
  const s = current; question = String(question || '').trim().slice(0, 400);
  if (!s || !question || s.busy) return;
  s.busy = true; s.entries.push({ kind: 'question', text: question }); s.input.value = ''; paint(s);
  try {
    const pack = await s.load(s.game);
    // Cards: the ones the Judge was opened on, plus names typed in the question (found in the shipped name list; details only if the app can read them).
    const cards = [];
    for (const c of s.cards) cards.push(s.game === 'mtg' && s.card && !c.rulings ? (await Promise.resolve(s.card(c.name)).catch(() => null)) || c : c);
    s.cards = cards.slice();
    if (s.game === 'mtg' && s.names && s.card) {
      const names = await Promise.resolve(s.names()).catch(() => null);
      for (const found of findCardNames(question, names, pack)) { if (cards.some(c => c.name.toLowerCase() === found.name)) continue; const card = await Promise.resolve(s.card(found.name)).catch(() => null); if (card) cards.push(card); }
    }
    if (current !== s) return;
    const answer = judgeAnswer(pack, question, { format: s.format, cards, glossary: GLOSSARY[s.game] || [] });
    s.entries.push({ kind: 'answer', answer });
    s.node.querySelector('.rules-ai-status').textContent = answer.status === 'none' ? 'No rule found for that.' : 'Rule shown.';
  } catch (error) {
    if (current === s) s.entries.push({ kind: 'error', text: error?.message || 'The rulebook could not be opened. Open the Rules page once while online to save it.' });
  } finally { s.busy = false; paint(s); }
}
