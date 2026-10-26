// Additional summaries keep the original teaching corpus intact. Source links
// open the existing dated official packs; card-specific wording takes precedence.
import {KEYWORD_REFERENCE,KEYWORD_SOURCE} from './mtg-keyword-reference.js';
import {entryReference} from './rule-reference.js';
import {MTG_CONCEPTS} from './mtg-wiki-knowledge.js';
const rule=(label,definition,tip,id)=>({label,definition,tip,referenceId:id});
export const EXTRA_RULES={
 mtg:Object.fromEntries(Object.entries(KEYWORD_REFERENCE).map(([key,r])=>[key,{...r,definition:r.definition.length>650?r.definition.slice(0,650).replace(/\s+\S*$/,'')+'…':r.definition,tip:`Excerpt from Comprehensive Rules (${KEYWORD_SOURCE.date}). Open the exact source for the full definition, conditions and exceptions.`,referenceId:r.entryId,excerpt:true}])),
 ygo:{
  'Synchro Summon':rule('Synchro Summon','Usually send a Tuner and the required non-Tuner monsters you control to the GY. Their total Levels must equal the Synchro Monster’s Level.','Read the exact materials and any alternate summoning procedure.','0-p13'),
  'Xyz Summon':rule('Xyz Summon','Use the required monsters with matching Levels as materials and place the Xyz Monster on them.','Rank is distinct from Level; the card states which materials it needs.','0-p12'),
  'Link Summon':rule('Link Summon','Send the required face-up monsters you control to the GY as Link Materials, meeting the Link Rating and material conditions.','A Link Monster used as material can count as one monster or its Link Rating.','0-p9'),
  'Pendulum Summon':rule('Pendulum Summon','Use the scales in your Pendulum Zones to summon eligible monsters with Levels strictly between those scales.','The destinations for monsters from the Extra Deck have additional rules; read the source and later official updates.','0-p11'),
  'Ritual Summon':rule('Ritual Summon','Follow the Ritual Spell or other Ritual Summoning effect to summon the Ritual Monster using the stated materials.','The effect determines the required Levels and permitted materials.','0-p14'),
  Tuner:rule('Tuner','A monster type used by most Synchro Summoning procedures.','Being a Tuner does not itself provide all the required materials or matching Levels.','0-p13'),
 },
 ptcg:{
  'Stage 1':rule('Stage 1','Normally evolves from the Basic Pokémon named on the card.','Follow evolution timing and any effect that changes the normal procedure.','0-p11'),
  'Stage 2':rule('Stage 2','Normally evolves from the Stage 1 Pokémon named on the card.','A Stage 2 card does not normally go straight onto an unrelated Basic Pokémon.','0-p11'),
  Item:rule('Item','A Trainer card that you play and resolve according to its text.','Items do not use the normal once-per-turn Supporter allowance; card effects can impose restrictions.','0-p12'),
  Stadium:rule('Stadium','A Trainer card that stays in play and affects the game according to its text.','Stadium replacement and the normal limit on playing a Stadium still apply.','0-p12'),
  'Pokémon Tool':rule('Pokémon Tool','A Trainer card attached to a Pokémon to provide its printed effect.','Attachment limits and card-specific restrictions still apply.','0-p12'),
 }
};
export const extraRuleReference=(game,key)=>EXTRA_RULES[game]?.[key]?.referenceId?entryReference(game,EXTRA_RULES[game][key].referenceId,key):null;
// Community terminology stays separate from the exact official-rule corpus.
// In particular, Bloodlust is not an official keyword or a Bloodthirst alias.
export const CONCEPT_RULES={mtg:Object.fromEntries(MTG_CONCEPTS.filter(c=>['informal-mechanic','deck-archetype','strategy-concept','creature-type'].includes(c.kind)&&!c.official).map(c=>[c.id,{label:c.label,definition:c.summary,tip:c.builderCoverage.summary,concept:c,sourceAuthority:'community-reference'}]))};
