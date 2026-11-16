// Render-only invitation: safe for the shared Rules hub without a UI import cycle.
import { esc } from './ui.js';
const NAMES = { mtg: 'Magic', ptcg: 'Pokémon', ygo: 'Yu-Gi-Oh!' };
export function rulesAskPanel({ game, format = '' } = {}) {
  if (!NAMES[game]) return '';
  return `<section class="panel rules-ask-invite"><div class="rules-ask-intro"><span class="judge-mark" aria-hidden="true">J</span><div><p class="eyebrow">From the rulebook · works offline</p><h3>Ask a Judge</h3><p>Ask in your own words. You get the exact rule, with its number.</p></div></div><button type="button" class="btn" data-act="askRules" data-game="${game}" data-rule-format="${esc(format)}">Ask about ${esc(NAMES[game])} rules →</button><p class="foot">Quoted from the rulebook. At an event, the judge there has the final say.</p></section>`;
}
