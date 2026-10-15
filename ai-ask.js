// Ask AI: a chat that can only use the app. The model asks for app functions (tools), this device
// runs them against the player's own data and the app's card data, and the answer comes back with
// the real cards, sets or decks to tap. Voice uses the phone's speech recognition when available.
import { esc } from './ui.js';

const STEP = { search_cards: 'Searching cards', card_details: 'Reading the card', my_collection: 'Checking your collection', list_sets: 'Looking through sets', set_cards: 'Pricing the set', meta_decks: 'Checking tournament results', my_decks: 'Opening your decks', build_deck: 'Setting up the deck builder', answer: 'Writing the answer' };
const EXAMPLES = {
  mtg: ['What\'s the most competitive Modern deck right now?', 'What\'s my most valuable card?', 'Build me a mono-red deck for $50', 'What\'s the newest Magic set?'],
  ygo: ['What\'s the best deck in the meta right now?', 'Do I have cards for a strong deck?', 'What does Ash Blossom do?', 'Most valuable card I own?'],
  ptcg: ['Build me a Fire deck for $40', 'What\'s the newest Pokémon set?', 'Most valuable card in the newest set?', 'Which meta deck am I closest to?'],
};
const GAME_NAME = { mtg: 'Magic', ygo: 'Yu-Gi-Oh!', ptcg: 'Pokémon' };
let state = null;

const Speech = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canListen = () => !!Speech;

function shell() {
  const node = document.createElement('dialog');
  node.className = 'ask-dialog';
  node.setAttribute('aria-labelledby', 'ask-title');
  node.innerHTML = `<div class="ask-shell"><header class="ask-head"><div class="ask-orb" aria-hidden="true"><i></i><i></i><i></i><span>✦</span></div><div><p class="eyebrow">In-app assistant</p><h2 id="ask-title">Ask CardStashy</h2></div><button class="icon" data-ask-close aria-label="Close Ask AI">✕</button></header><div class="ask-log" aria-live="polite"></div><form class="ask-bar"><button type="button" class="ask-mic" data-ask-mic aria-label="Speak your question" ${Speech ? '' : 'hidden'}><span class="ask-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2Z" fill="currentColor"/></svg></button><input class="ask-input" name="q" autocomplete="off" maxlength="300" placeholder="Ask about cards, prices, sets, decks…" aria-label="Your question"><button class="ask-send" aria-label="Ask">↑</button></form></div>`;
  return node;
}
function bubble(cls, html) { const b = document.createElement('div'); b.className = 'ask-msg ' + cls; b.innerHTML = html; state.log.append(b); state.log.scrollTop = state.log.scrollHeight; return b; }
function emptyState() {
  state.log.innerHTML = `<div class="ask-empty"><p class="ask-hello">What do you want to know about your ${esc(GAME_NAME[state.game])} cards?</p><p class="muted small">I can only use CardStashy: its cards, prices, sets, tournament decks, your collection and your decks. No web browsing.</p><div class="ask-examples">${(EXAMPLES[state.game] || EXAMPLES.mtg).map((q, i) => `<button type="button" style="--i:${i}" data-ask-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
}
export function openAsk({ game = 'mtg', tools, show, prefill = '' } = {}) {
  closeAsk();
  const node = shell();
  document.body.append(node);
  state = { node, game, tools, show, log: node.querySelector('.ask-log'), input: node.querySelector('.ask-input'), history: [], busy: false, rec: null };
  emptyState();
  node.addEventListener('cancel', (e) => { e.preventDefault(); closeAsk(); });
  node.addEventListener('click', (e) => {
    if (e.target === node || e.target.closest('[data-ask-close]')) return closeAsk();
    const q = e.target.closest('[data-ask-q]'); if (q) return ask(q.dataset.askQ);
    if (e.target.closest('[data-ask-mic]')) return listen();
    const item = e.target.closest('[data-ask-show]'); if (item) { const s = JSON.parse(item.dataset.askShow); closeAsk(); return show?.(s); }
  });
  node.querySelector('.ask-bar').addEventListener('submit', (e) => { e.preventDefault(); ask(state.input.value); });
  node.showModal ? node.showModal() : node.setAttribute('open', '');
  if (prefill) ask(prefill); else setTimeout(() => state?.input.focus(), 250);
  return node;
}
export function closeAsk() {
  if (!state) return;
  try { state.rec?.abort(); } catch {}
  state.node.close?.(); state.node.remove(); state = null;
}
// Voice: the phone's own speech recognition; words appear as they're heard, then it asks.
function listen() {
  if (!Speech || !state || state.busy) return;
  if (state.rec) { try { state.rec.stop(); } catch {} return; }
  const rec = new Speech(), mic = state.node.querySelector('.ask-mic');
  rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
  let heard = '';
  rec.onresult = (e) => { heard = [...e.results].map(r => r[0].transcript).join(''); state.input.value = heard; };
  rec.onend = () => { mic.classList.remove('on'); state.node.classList.remove('listening'); state.rec = null; if (heard.trim()) ask(heard); };
  rec.onerror = () => { mic.classList.remove('on'); state.node.classList.remove('listening'); state.rec = null; };
  state.rec = rec; mic.classList.add('on'); state.node.classList.add('listening');
  try { rec.start(); } catch { rec.onerror(); }
}
const say = (calls) => [...new Set(calls.map(c => STEP[c.name] || 'Working'))].join(' · ');
export async function ask(text, fetcher = fetch) {
  text = String(text || '').trim();
  if (!state || state.busy || !text) return;
  state.busy = true; state.input.value = ''; state.tools?.reset?.();
  state.log.querySelector('.ask-empty')?.remove();
  bubble('me', esc(text));
  const think = bubble('ai thinking', `<div class="ask-dots" aria-hidden="true"><i></i><i></i><i></i></div><span class="ask-step">Thinking</span>`);
  state.node.classList.add('thinking');
  const items = [...state.history, { type: 'message', role: 'user', content: text }];
  try {
    for (let round = 0; round < 8; round++) {
      const r = await fetcher('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: state.game, items }), signal: AbortSignal.timeout(70000) });
      let data; try { data = await r.json(); } catch { throw Error('Ask AI is unavailable. Check your connection.'); }
      if (!r.ok) throw Error(data.message || 'Ask AI is unavailable right now.');
      if (data.answer) { think.remove(); answer(data.answer); state.history = [...items.filter(x => x.type === 'message'), { type: 'message', role: 'assistant', content: data.answer.text }].slice(-8); return; }
      think.querySelector('.ask-step').textContent = say(data.calls) + '…';
      for (const call of data.calls) {
        let out;
        try { const args = JSON.parse(call.arguments || '{}'); out = await (state?.tools?.[call.name]?.(args) ?? { error: 'Not available in this app.' }); } catch (e) { out = { error: String(e.message || e).slice(0, 200) }; }
        items.push(call, { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(out).slice(0, 12000) });
        if (!state) return;
      }
    }
    throw Error('That took too many steps. Try asking more specifically.');
  } catch (e) {
    think.remove();
    bubble('ai error', `<p>${esc(e.name === 'TimeoutError' ? 'That took too long. Try again.' : e.message)}</p>`);
  } finally {
    if (state) { state.busy = false; state.node.classList.remove('thinking'); }
  }
}
const SOURCE = { app: ['From your app data', 'app'], general: ['General knowledge, not app data', 'general'], mixed: ['App data + general knowledge', 'mixed'] };
function answer(a) {
  const [label, cls] = SOURCE[a.source] || SOURCE.mixed;
  const extra = state.tools?.pendingItem?.(), list = [...(a.show || []), ...(extra ? [extra] : [])];
  const items = list.map((s, i) => state.tools?.preview?.(s, i) || `<button class="ask-item" style="--i:${i}" data-ask-show='${esc(JSON.stringify(s))}'><b>${esc(s.label || s.ref)}</b><small>${esc({ card: 'Card', set: 'Set', meta: 'Meta deck', deck: 'Your deck' }[s.kind])} · ${esc(GAME_NAME[s.game])}</small></button>`).join('');
  bubble('ai', `<p class="ask-source ${cls}">${label}</p><p>${esc(a.text)}</p>${items ? `<div class="ask-items">${items}</div>` : ''}${a.suggestions?.length ? `<div class="ask-examples follow">${a.suggestions.map((q, i) => `<button type="button" style="--i:${i}" data-ask-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}`);
}
