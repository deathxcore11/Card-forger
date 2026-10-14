// Curated, game-specific reminders. Card wording is preserved; no invented card rulings.
import {esc,symbolText} from './ui.js';
const SOURCES={mtg:'https://magic.wizards.com/en/rules',ygo:'https://www.yugioh-card.com/en/play/psct/',ptcg:'https://play.pokemon.com/en-us/resources/rules/'};
const entry=(label,definition,tip)=>({label,definition,tip});
export const RULE_DEX={
 mtg:{
  flying:entry('Flying','Only creatures with flying or reach can block a flying attacker.','Flying does not prevent it from blocking a creature without flying.'),
  reach:entry('Reach','This creature can block creatures with flying.','Reach does not make its own attacks evasive.'),
  trample:entry('Trample','After assigning lethal combat damage to blockers, excess damage can reach the defending player or attacked permanent.','Deathtouch changes how much assigned damage is lethal.'),
  haste:entry('Haste','The creature can attack and use tap or untap abilities immediately.','Other attack restrictions still apply.'),
  vigilance:entry('Vigilance','Attacking does not tap this creature.','It must still be untapped to attack.'),
  deathtouch:entry('Deathtouch','Any positive damage this source deals to a creature is lethal damage.','It does not bypass indestructible.'),
  lifelink:entry('Lifelink','Damage from this source also gains its controller that much life.','Life is gained as damage happens, rather than through a triggered ability.'),
  'first strike':entry('First strike','Deals combat damage in the first combat damage step.','A surviving creature without first strike deals damage in the later step.'),
  'double strike':entry('Double strike','Deals combat damage in both damage steps.','A blocked attacker stays blocked even if its blocker dies; trample matters.'),
  hexproof:entry('Hexproof','Opponents cannot target this object with spells or abilities.','Effects that do not target can still affect it.'),
  ward:entry('Ward','An opponent targeting this permanent triggers an extra payment requirement.','If they do not pay, ward counters that spell or ability; the target is still legal.'),
  indestructible:entry('Indestructible','Cannot be destroyed by effects or lethal damage.','Exile, sacrifice and zero toughness can still remove it.'),
  flash:entry('Flash','You may cast this spell whenever you could cast an instant.','You still pay its costs and follow other restrictions.'),
  equip:entry('Equip','Pay the equip cost to attach this Equipment to a creature you control, at sorcery speed.','Other abilities may attach Equipment with different timing.'),
  scry:entry('Scry','Look at that many top cards. Put any on the bottom and the rest back on top in any order.','This filters cards; it does not draw them.'),
  surveil:entry('Surveil','Look at that many top cards. Put any in your graveyard and the rest back on top in any order.','Graveyard engines may benefit from what you put there.'),
  exile:entry('Exile','Move the specified card to the exile zone.','Exile is distinct from the graveyard; return requires an effect allowing it.'),
  sacrifice:entry('Sacrifice','A permanent’s controller moves it from the battlefield to their graveyard.','Sacrificing is not destroying; indestructible does not prevent it.'),
 },
 ygo:{
  'Quick Effect':entry('Quick Effect','A monster effect with Spell Speed 2. It can respond when its activation conditions permit.','It cannot respond to a Counter Trap’s Spell Speed 3 activation.'),
  'once per turn':entry('Once per turn','A usage or activation restriction. Read the complete sentence to determine its scope.','“Use” and “activate” restrictions differ. A restriction naming the card applies across copies.'),
  'Special Summon':entry('Special Summon','Summon through a card effect or a permitted summoning procedure, following its restrictions.','Some procedures do not start a Chain; effect-based summons resolve within one.'),
  'Fusion Summoned':entry('Fusion Summoned','Summoned using a valid Fusion Summoning method and the required materials.','A generic Special Summon is not automatically a Fusion Summon.'),
  'Normal Summon':entry('Normal Summon','Your usual once-per-turn summon; higher-Level monsters normally require Tributes.','An effect can grant additional Normal Summons.'),
  banish:entry('Banish','Move the card to the banished cards area, face-up unless specified otherwise.','A face-down banished card has no public card properties available for effects to check.'),
  GY:entry('Graveyard','The zone for used or removed cards sent there.','An effect that sends a card to the GY does not necessarily destroy or discard it.'),
  target:entry('Target','Choose the specified target when activating an effect, if its text says to target.','Check the resolution wording; selecting a card without “target” is not automatically targeting.'),
  negate:entry('Negate','Stop the stated activation, effect, attack or summon, according to the wording.','Negating an effect is different from negating its activation.'),
  'End Phase':entry('End Phase','The final phase of a turn, when specified end-of-turn actions take place.','An effect resolving earlier may schedule a separate action for this phase.'),
 },
 ptcg:{
  Ability:entry('Ability','A Pokémon’s non-attack effect. Its wording determines when and how often it works.','Using an Ability generally does not end your turn.'),
  Supporter:entry('Supporter','Normally play one Supporter during your turn.','The player going first cannot play one on their first turn.'),
  'Active Pokémon':entry('Active Pokémon','Your Pokémon in the Active position. It normally attacks and receives attacks.','Special Conditions usually affect the Active Pokémon only.'),
  Bench:entry('Bench','Your reserve Pokémon in play; normally up to five.','An effect must explicitly allow attacking or damaging Benched Pokémon.'),
  'Prize cards':entry('Prize cards','Set aside six during setup. Take the appropriate number when you Knock Out opposing Pokémon.','Multi-Prize Pokémon change the reward; taking your final Prize normally wins.'),
  'Knocked Out':entry('Knocked Out','Remove a Pokémon and its attached cards when damage reaches its HP or an effect Knocks it Out.','Resolve the relevant effects and Prize reward.'),
  Asleep:entry('Asleep','Cannot attack or retreat. Flip during Pokémon Checkup; heads removes Asleep.','Moving to the Bench or evolving removes Special Conditions.'),
  Paralyzed:entry('Paralyzed','Cannot attack or retreat. It recovers after its controller’s next turn during Checkup.','Switching effects can move it even though retreating is prohibited.'),
  Confused:entry('Confused','Before attacking, flip a coin. Tails fails the attack and puts three damage counters on this Pokémon.','Confusion does not itself prevent retreating.'),
  Poisoned:entry('Poisoned','During Pokémon Checkup, place one damage counter, unless an effect specifies another amount.','Poisoned can coexist with Burned and one of Asleep, Confused or Paralyzed.'),
  Burned:entry('Burned','During Checkup, place two damage counters, then flip; heads removes Burned.','Damage counters are not attack damage and ignore Weakness.'),
  retreat:entry('Retreat','Normally once during your turn: discard Energy matching the Retreat Cost, then move your Active Pokémon.','Switching through an effect is separate from retreating.'),
  'damage counters':entry('Damage counters','Each damage counter represents 10 damage on a Pokémon.','Placing counters is distinct from dealing attack damage.'),
 },
};
const rxEscape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function ruleText(game,text){
 const terms=Object.keys(RULE_DEX[game] || {}).sort((a,b)=>b.length-a.length),render=game==='mtg'?symbolText:esc;
 if(!terms.length)return render(text);
 const rx=new RegExp('\\b('+terms.map(rxEscape).join('|')+')\\b','gi');
 // Quoted card names are not rules keywords. Keep the original text untouched.
 return String(text||'').split(/("[^"\n]*"|“[^”\n]*”)/).map((part,i)=>{
  if(i%2)return render(part);let start=0,out='';for(const m of part.matchAll(rx)){
   const key=terms.find(t=>t.toLowerCase()===m[0].toLowerCase());out+=render(part.slice(start,m.index))+`<button class="rule-word" data-act="ruleHint" data-game="${game}" data-rule="${esc(key)}" aria-label="Explain ${esc(key)}">${esc(m[0])}</button>`;start=m.index+m[0].length;
  }return out+render(part.slice(start));
 }).join('');
}
export function effectText(game,text){
 return String(text || '').split(game==='ygo'?/\n+|(?<=[.!?]) (?=(?:If |When |During |Once per turn|You can only|You cannot))/g:/\n+/).filter(Boolean).map((line,i)=>{
  const colon=game==='ygo'?line.indexOf(':'):-1,semi=game==='ygo'?line.indexOf(';'):-1;
  if(colon<0&&semi<0)return `<p class="effect-line">${ruleText(game,line)}</p>`;
  const chunks=[];let start=0;
  if(colon>=0&&(semi<0||colon<semi)){chunks.push(`<span class="logic-condition" title="Activation condition or timing">${ruleText(game,line.slice(0,colon+1))}</span>`);start=colon+1;}
  if(semi>=start){chunks.push(`<span class="logic-activation" title="Activation actions: costs and targets">${ruleText(game,line.slice(start,semi+1))}</span>`);start=semi+1;}
  chunks.push(`<span class="logic-resolution">${ruleText(game,line.slice(start))}</span>`);
  return `<p class="effect-line">${chunks.join('')}</p>`;
 }).join('');
}
export function ruleDexPanel(game){return `<section class="panel rule-dex"><p class="eyebrow">CardStashy rule dex</p><h3>Read the card. Know the play.</h3><p class="small muted">Tap an underlined term on a card for a reminder. These summaries explain common mechanics; card-specific exceptions and rulings still apply.</p><div class="rules-list">${Object.entries(RULE_DEX[game]||{}).map(([key,r])=>`<details><summary><b>${esc(r.label)}</b></summary><p>${esc(r.definition)}</p><p class="small muted">${esc(r.tip)}</p></details>`).join('')}</div><a class="link small" href="${SOURCES[game]}" target="_blank" rel="noopener noreferrer">Official rules and detailed rulings ↗</a></section>`;}
let closeHint=()=>{};
export function showRuleHint(button){
 const game=button.dataset.game,r=RULE_DEX[game]?.[button.dataset.rule];if(!r)return;closeHint();
 const box=document.createElement('aside');box.className='rule-glass';box.setAttribute('role','dialog');box.setAttribute('aria-label',r.label);box.innerHTML=`<div class="row between"><small class="eyebrow">Rule dex · ${esc(game==='mtg'?'Magic':game==='ygo'?'Yu-Gi-Oh!':'Pokémon')}</small><button class="rule-dismiss" aria-label="Close definition">✕</button></div><h3>${esc(r.label)}</h3><p>${esc(r.definition)}</p><p class="small muted">${esc(r.tip)}</p><a href="${SOURCES[game]}" target="_blank" rel="noopener noreferrer">Official rules ↗</a>`;
 (button.closest('dialog')||document.body).append(box);
 const rect=button.getBoundingClientRect(),width=Math.min(350,window.innerWidth-32);box.style.width=width+'px';box.style.left=Math.min(window.innerWidth-width-16,Math.max(16,rect.left))+'px';box.style.top=Math.max(16,Math.min(rect.bottom+10,window.innerHeight-box.offsetHeight-16))+'px';
 const outside=e=>{if(!box.contains(e.target)&&e.target!==button)closeHint();},escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeHint();button.focus();}};
 closeHint=()=>{box.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);};
 box.querySelector('.rule-dismiss').onclick=()=>{closeHint();button.focus();};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);box.querySelector('.rule-dismiss').focus();
}
