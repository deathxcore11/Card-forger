// Construction preferences. These compare recognized setup costs; they do not
// label a player or predict the skill needed to master a deck.
import {mtgResourceProfile} from './mtg-effects.js';
import {ygoStarterPrerequisites} from './deckpower.js';
export function setupBurden(game,card={}) {
 if(game==='ptcg')return card.stage==='Stage2'?2:card.stage==='Stage1'?1:0;
 if(game==='ygo'){
  const type=String(card.typeLine||''),text=String(card.text||'');
  const prerequisites=ygoStarterPrerequisites(card);
  return (/Ritual|Pendulum/i.test(type)?2:0)+(card.category==='Monster'&&Number(card.level)>4&&!/special summon this card/i.test(text)?1:0)+(prerequisites.modes.length&&!prerequisites.openingCandidate?1:0);
 }
 const resources=mtgResourceProfile(card);
 return Math.max(0,Number(card.cmc||0)-4)*.25+(resources.effects||[]).filter(e=>e.status==='conditional'||Number(e.activationMana)>0||Number(e.equipMana)>0).length*.25;
}
