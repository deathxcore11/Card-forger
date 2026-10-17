// Render-only invitation: safe for the shared Rules hub without a UI import cycle.
import { esc } from './ui.js';
import { aiOrb } from './ai-ui.js';
const NAMES = { mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!' };
export function rulesAskPanel({ game, format = '' } = {}) {
  if (!NAMES[game]) return '';
  return `<section class="panel rules-ask-invite"><div class="rules-ask-intro">${aiOrb()}<div><p class="eyebrow">AI rules guide</p><h3>Ask a Judge</h3><p>One situation, a clear explanation, and the exact rule to open.</p></div></div><button type="button" class="btn" data-act="askRules" data-game="${game}" data-rule-format="${esc(format)}">Ask about ${esc(NAMES[game])} rules →</button><p class="foot">${format ? esc(format) : 'Format not selected'} · AI guidance, not an official ruling.</p></section>`;
}
