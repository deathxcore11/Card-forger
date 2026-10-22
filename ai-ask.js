import {brandMark} from './brand.js';
// Ask AI: a chat that can only use the app. The model asks for app functions (tools), this device
// runs them against the player's own data and the app's card data, and the answer comes back with
// the real cards, sets or decks to tap. Voice uses the phone's speech recognition when available.
import { esc } from './ui.js';
import { aiOrb } from './ai-ui.js';
import { runAskLoop, resumeBuildChoice } from './ai-ask-loop.js';
export { boundedToolOutput } from './ai-ask-loop.js';

const STEP = { search_cards: 'Searching cards', card_details: 'Reading the card', my_collection: 'Checking your collection', list_sets: 'Looking through sets', set_cards: 'Pricing the set', meta_decks: 'Checking tournament results', my_decks: 'Opening your decks', build_deck: 'Building and checking your deck', answer: 'Writing the answer' };
const EXAMPLES = {
  mtg: ['What\'s the most competitive Modern deck right now?', 'What\'s my most valuable card?', 'Build me a mono-red deck for $50', 'What\'s the newest Magic set?'],
  ygo: ['What\'s the best deck in the meta right now?', 'Do I have cards for a strong deck?', 'What does Ash Blossom do?', 'Most valuable card I own?'],
  ptcg: ['Build me a Fire deck for $40', 'What\'s the newest Pokémon set?', 'Most valuable card in the newest set?', 'Which meta deck am I closest to?'],
};
const GAME_NAME = { mtg: 'Magic', ygo: 'Yu-Gi-Oh!', ptcg: 'Pokémon' };
let state = null;
const conversations = new Map();

const Speech = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canListen = () => !!Speech;

function shell() {
  const node = document.createElement('dialog');
  node.className = 'ask-dialog ai-companion';
  node.setAttribute('aria-labelledby', 'ask-title');
  node.innerHTML = `<div class="ask-shell"><header class="ask-head">${aiOrb()}<div><p class="eyebrow">In-app assistant</p><h2 id="ask-title">Ask CardStashy</h2></div><button class="ask-new" type="button" data-ask-new aria-label="New chat" title="New chat">＋<span>New</span></button><button class="icon" data-ask-close aria-label="Close Ask AI">✕</button></header><div class="ask-log" aria-live="polite"></div><form class="ask-bar"><button type="button" class="ask-mic" data-ask-mic aria-label="Speak your question" ${Speech ? '' : 'hidden'}><span class="ask-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2Z" fill="currentColor"/></svg></button><input class="ask-input" name="q" autocomplete="off" maxlength="300" placeholder="Ask about cards, prices, sets, decks…" aria-label="Your question"><button class="ask-send" aria-label="Ask">↑</button></form></div>`;
  return node;
}
function bubble(cls, html) { const b = document.createElement('div'); b.className = 'ask-msg ' + cls; b.innerHTML = html; state.log.append(b); state.log.scrollTop = state.log.scrollHeight; return b; }
function emptyState() {
  state.log.innerHTML = `<div class="ask-empty"><p class="ask-hello">What do you want to know about your ${esc(GAME_NAME[state.game])} cards?</p><p class="muted small">I can only use CardStashy: its cards, prices, sets, tournament decks, your collection and your decks. No web browsing.</p><div class="ask-examples">${(EXAMPLES[state.game] || EXAMPLES.mtg).map((q, i) => `<button type="button" style="--i:${i}" data-ask-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
}
export function openAsk({ game = 'mtg', tools, show, prefill = '' } = {}) {
  closeAsk();
  const saved = conversations.get(game), node = saved?.node || shell();
  document.body.append(node);
  state = { ...saved, controller: new AbortController(), node, game, tools, show, log: node.querySelector('.ask-log'), input: node.querySelector('.ask-input'), history: saved?.history || [], busy: false, rec: null };
  conversations.set(game, state);
  if (!saved) emptyState();
  if (!saved) {
  node.addEventListener('cancel', (e) => { e.preventDefault(); closeAsk(); });
  node.addEventListener('click', (e) => {
    if (e.target === node || e.target.closest('[data-ask-close]')) return closeAsk();
    if (e.target.closest('[data-ask-new]')) return restartAsk();
    const choice=e.target.closest('[data-ask-choice]');if(choice){if(Number(choice.dataset.askTurn)!==state.turnId||state.busy)return;return ask(choice.textContent,fetch,{id:choice.dataset.askChoice});}
    const q = e.target.closest('[data-ask-q]'); if (q) return ask(q.dataset.askQ);
    if (e.target.closest('[data-ask-mic]')) return listen();
    const item = e.target.closest('[data-ask-show]'); if (item) { const s = JSON.parse(item.dataset.askShow); const open = state.show; closeAsk(); return open?.(s); }
  });
  node.querySelector('.ask-bar').addEventListener('submit', (e) => { e.preventDefault(); ask(state.input.value); });
  }
  node.showModal ? node.showModal() : node.setAttribute('open', '');
  if (saved) state.log.scrollTop = saved.scrollTop ?? state.log.scrollHeight;
  const opened = state;
  if (prefill) ask(prefill); else setTimeout(() => { if (state === opened) opened.input.focus(); }, 250);
  return node;
}
export function closeAsk() {
  if (!state) return;
  const closed = state; state = null;
  closed.scrollTop = closed.log.scrollTop;
  closed.controller.abort();
  if (closed.busy) {
    closed.tools?.cancel?.();
    closed.log.querySelectorAll?.('.ask-msg.pending, .ask-msg.thinking').forEach(el => el.remove());
    closed.input.value = closed.pendingText || closed.input.value;
  }
  closed.busy = false; closed.node.classList.remove('thinking', 'listening');
  try { closed.rec?.abort(); } catch {}
  closed.node.close?.(); closed.node.remove();
}
// Session memory only: refresh or New chat starts over; each game has its own place.
export function restartAsk() {
  if (!state) return;
  const { game, tools, show } = state;
  closeAsk(); conversations.delete(game); tools?.reset?.({forgetBuild:true});
  return openAsk({ game, tools, show });
}
export function clearAskConversations() { closeAsk(); conversations.clear(); }
// Voice: the phone's own speech recognition; words appear as they're heard, then it asks.
function listen() {
  if (!Speech || !state || state.busy) return;
  if (state.rec) { try { state.rec.stop(); } catch {} return; }
  const session = state;
  const rec = new Speech(), mic = state.node.querySelector('.ask-mic');
  rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
  let heard = '';
  rec.onresult = (e) => { if (state !== session) return; heard = [...e.results].map(r => r[0].transcript).join(''); state.input.value = heard; };
  rec.onend = () => { if (state !== session) return; mic.classList.remove('on'); state.node.classList.remove('listening'); state.rec = null; if (heard.trim()) ask(heard); };
  rec.onerror = () => { if (state !== session) return; mic.classList.remove('on'); state.node.classList.remove('listening'); state.rec = null; };
  state.rec = rec; mic.classList.add('on'); state.node.classList.add('listening');
  try { rec.start(); } catch { rec.onerror(); }
}
const say = (calls) => [...new Set(calls.map(c => STEP[c.name] || 'Working'))].join(' · ');
export async function ask(text, fetcher = fetch, choice = null) {
  text = String(text || '').trim();
  if (!state || state.busy || !text) return;
  const session = state;
  session.turnId=(session.turnId||0)+1;
  state.busy = true; state.input.value = ''; state.tools?.reset?.();
  state.log.querySelector('.ask-empty')?.remove();
  state.pendingText = text;
  const question = bubble('me pending', esc(text));
  const think = bubble('ai thinking', `<div class="ask-brand-progress" aria-hidden="true">${brandMark("brand-loading")}</div><span class="ask-step">Thinking</span>`);
  state.node.classList.add('thinking');
  const items = [...state.history, { type: 'message', role: 'user', content: text }];
  try {
    const common={tools:session.tools,signal:session.controller.signal,current:()=>state===session,onBuildContext:context=>{if(state===session)session.buildContext=context;}};
    const result = choice?await resumeBuildChoice({...common,choice:choice.id,context:session.buildContext}):await runAskLoop({ ...common,game:session.game, items,buildContext:session.buildContext,fetcher, onCalls:calls=>{think.querySelector('.ask-step').textContent=say(calls)+'…';} });
    if (!result || state !== session) return;
    question.classList.remove('pending'); session.pendingText=''; think.remove(); answer(result);
    session.history=[...items.filter(x=>x.type==='message'),{type:'message',role:'assistant',content:result.text}].slice(-8);
  } catch (e) {
    if (state !== session) return;
    question.classList.remove('pending'); state.pendingText = ''; think.remove();
    bubble('ai error', `<p>${esc(e.name === 'TimeoutError' ? 'That took too long. Try again.' : e.message)}</p>`);
  } finally {
    if (state === session) { state.busy = false; state.node.classList.remove('thinking'); }
  }
}
const SOURCE = { app: ['From your app data', 'app'], general: ['General knowledge, not app data', 'general'], mixed: ['App data + general knowledge', 'mixed'] };
function answer(a) {
  const [label, cls] = SOURCE[a.source] || SOURCE.mixed;
  const extra = state.tools?.pendingItem?.(), seen = new Set(), list = [...((a.show || []).length ? a.show : (state.tools?.suggestedItems?.() || [])), ...(extra ? [extra] : [])].map(s => state.tools?.canonicalItem?.(s) || s).filter(s => { const k = [s.game,s.kind,s.ref].join(':'); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  const items = list.map((s, i) => state.tools?.preview?.(s, i, {compact:list.length===1&&s.kind==='card'}) || `<button class="ask-item" style="--i:${i}" data-ask-show='${esc(JSON.stringify(s))}'><b>${esc(s.label || s.ref)}</b><small>${esc({ card: 'Card', set: 'Set', meta: 'Meta deck', deck: 'Your deck' }[s.kind])} · ${esc(GAME_NAME[s.game])}</small></button>`).join('');
  const choices=(a.choices||[]).map(c=>`<button type="button" data-ask-choice="${esc(c.id)}" data-ask-turn="${state.turnId}">${esc(c.label)}</button>`).join('');
  bubble('ai', `<p class="ask-source ${cls}">${label}</p><p>${esc(a.text)}</p>${items ? `<div class="ask-items">${items}</div>` : ''}${choices?`<div class="ask-examples follow" aria-label="Deck choices">${choices}</div>`:''}${a.suggestions?.length ? `<div class="ask-examples follow">${a.suggestions.map((q, i) => `<button type="button" style="--i:${i}" data-ask-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}`);
}
