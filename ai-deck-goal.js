// Goals are preferences, not measured power or win-rate guarantees. Hard rules,
// identity, ownership and quote coverage always remain the app's responsibility.
import { MTG_VOCABULARY, tribePattern } from './mtg-vocabulary.js';
export const DECK_GOALS = Object.freeze(['strongest','theme','fun','chaos','weak']);
// Direct player requests must reach the existing builder, rather than letting
// a model answer with an unexecuted deck or a generic refusal. How-to stays help.
const tribalDeckStart = new RegExp('^(?:'+MTG_VOCABULARY['creature-types'].map(tribePattern).join('|')+')(?:[- ]only)?\\b','i');
export function isDeckBuildRequest(value) {
 const request=String(value||'').replace(/[’]/g,"'").trim().replace(/^(?:hey|hi|okay|ok)[,!]?\s+/i,'');
 if(!/\bdeck(?:list)?\b/i.test(request))return false;
 // Construction and learning/browsing are different actions. A passing mention
 // of a deck must not turn an explanation, saved-deck visit or meta lookup into
 // a newly generated list.
 if(/^(?:how|why|what|when|where|explain|teach|compare|analy[sz]e|review|rate|open|show)\b/i.test(request))return false;
 if(/\bmake\s+(?:my|this|that|the current)\b[^.!?]*\bdeck\s+(?:better|stronger|cheaper|easier)\b/i.test(request))return false;
 const beforeDeck=request.match(/^([^.!?]*?)\bdeck(?:list)?\b/i)?.[1]||'';
 if(/\b(?:advice|help|how|explain|understand|learn|upgrade|improve|review|analy[sz]e|rate|cuts?|remove|swap|export|import)\b/i.test(beforeDeck)&&! /\b(?:build|rebuild|make|create|generate|brew|assemble)\b/i.test(beforeDeck))return false;
 if(/\b(?:recommend|suggest)\b[^.!?]*\b(?:upgrades?|changes?|cuts?|cards?|commanders?)\s+(?:for|to)\b/i.test(request))return false;
 const action=/^(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:build|rebuild|make|create|generate|brew|assemble|give\s+(?:me|us)|recommend(?:\s+(?:me|us))?|suggest(?:\s+(?:me|us))?|do\s+(?:me\s+)?(?:an?\s+)?(?=[^.!?]*\bdeck\b))\b[^.!?]*\bdeck(?:list)?\b/i;
 if(action.test(request))return true;
 if(/^(?:i\s+(?:(?:would|'d)\s+)?(?:want|need|like)|i'd\s+like|can\s+i\s+(?:get|have))\b[^.!?]*\bdeck(?:list)?\b/i.test(request))return true;
 // Short requests such as "only Goblins deck for red" have no imperative verb.
 // Restrict this shortcut to recognizable deck preferences, not arbitrary prose.
 return /^(?:only|mono[- ]?(?:white|blue|black|red|green|colou?rless)|white|blue|black|red|green|colou?rless)\b[^.!?]*\bdeck(?:list)?\b/i.test(request)||tribalDeckStart.test(request)&&/\bdeck(?:list)?\b[^.!?]*[.!?]?$/i.test(request);
}
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
