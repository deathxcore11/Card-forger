// Goals are preferences, not measured power or win-rate guarantees. Hard rules,
// identity, ownership and quote coverage always remain the app's responsibility.
export const DECK_GOALS = Object.freeze(['strongest','theme','fun','chaos','weak']);
// Direct player requests must reach the existing builder, rather than letting
// a model answer with an unexecuted deck or a generic refusal. How-to stays help.
export const isDeckBuildRequest = value => /^\s*(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:build|make|create)(?:\s+me|\s+us)?\b[^.!?]*\bdeck\b/i.test(String(value||''));
const DESCRIPTIONS = Object.freeze({
 strongest:'Strongest practical draft within the requested constraints, not a guaranteed optimal deck.',
 theme:'Keep the requested theme ahead of generic upgrades while preserving legal deck construction.',
 fun:'Prefer the requested play experience; fun is subjective and is not a power score.',
 chaos:'Prefer verified random or table-changing effects; chaos is not a guarantee of balanced games.',
 weak:'Intentionally lower-strength deck, not an accidentally illegal or unplayable list.'
});
const clean = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
const positive = s => clean(s).toLowerCase().replace(/\b(?:no|not|without|avoid|don't|do not)\s+(?:a\s+)?(?:chaos|chaotic|weak|bad|fun|competitive|strongest|theme|themed|infinite(?:\s+combos?)?)\b/g,'');
export function inferDeckGoal(text) {
 const s=positive(text);
 if(/^(?:weak|bad|intentionally weak)$/.test(s))return 'weak';
 if(/\b(?:(?:intentionally|deliberately) (?:weak|bad)|(?:bad|weak|terrible|joke)(?: [a-z-]+){0,2} decks?|(?:make|build|want)(?: me)?(?: an?| it)? (?:bad|weak)|make it weaker)\b/.test(s))return 'weak';
 if(/\b(?:chaos|chaotic)\b/.test(s))return 'chaos';
 if(/\btheme[- ]first\b/.test(s))return 'theme';
 if(/\b(?:fun|casual|silly|janky|jank)\b/.test(s))return 'fun';
 if(/\b(?:strongest|best|competitive|optimal|optimized|powerful)\b/.test(s))return 'strongest';
 if(/\b(?:theme(?:d)?|tribal|kindred)\b/.test(s))return 'theme';
 if(/\b(?:good|strong)\b/.test(s))return 'strongest';
 return null;
}
export function normalizeDeckGoal(goal, style='') {
 return DECK_GOALS.includes(goal)?goal:inferDeckGoal(style)||'strongest';
}
export function goalDescription(goal) { return DESCRIPTIONS[normalizeDeckGoal(goal)]; }

// Transparent ordering preferences only, never a strength classifier. Existing
// legality, color, budget, land and role-coverage gates run independently.
export function goalCardPreference(card, goal, {suggested=false}={}) {
 const mode=normalizeDeckGoal(goal),rules=[card?.oracle_text,...(card?.card_faces||[]).map(f=>f.oracle_text)].filter(Boolean).join(' ');
 const changesRandomly=/\b(?:at random|randomly|exchange control)\b/i.test(rules)||/\b(?:flip|flips|flipping)\s+(?:a|an|two|three|four|\d+)\s+coins?\b/i.test(rules)||/\broll\s+(?:a|an|two|three|four|\d+)\s+(?:d\d+|die|dice)\b/i.test(rules);
 if(mode==='strongest')return 0;
 if(mode==='chaos')return (changesRandomly?7:0)+(suggested?2:0);
 if(mode==='weak'){
  const rank=Number(card?.edhrec_rank),popular=Number.isFinite(rank)&&rank>0&&rank<=1000;
  // Avoid ubiquitous picks when asked for weak, without claiming that rarity or
  // unpopularity measures power. Required cards are still kept by the builder.
  return (suggested?3:0)-(popular?4:0);
 }
 return suggested?(mode==='fun'?3:2):0;
}
