import {EXTRA_RULES,CONCEPT_RULES,extraRuleReference} from './rule-extra.js';
import {discoveryButton,cardDiscoverySpec} from './card-discovery.js';
import {resolveMtgConcept} from './mtg-wiki-knowledge.js';
// Curated, game-specific reminders. Card wording is preserved; no invented card rulings.
import {esc,symbolText} from './ui.js';
import {LESSONS} from './rule-lessons.js';
import {keywordReference,resolveRuleReference,sourceDestination} from './rule-reference.js';
import {loadRulePack} from './rule-corpus.js';
import {installRuleHover} from './rule-hover.js';
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
 const terms=Object.keys(ruleTerms(game)).sort((a,b)=>b.length-a.length),render=game==='mtg'?symbolText:esc;
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
const conceptReading=concept=>concept?`<p class="foot">Community terminology · ${esc(concept.kind.replaceAll('-',' '))}. ${esc(concept.builderCoverage.summary)}</p><a class="link small" data-source-kind="community-page" href="${esc(concept.source.url)}" target="_blank" rel="noopener noreferrer">MTG Wiki background · ${esc(concept.label)} ↗</a><p class="foot">This locally reviewed explanation is separate from the linked article. Current card wording and official rules decide actual interactions.</p>`:'';
export function ruleDexPanel(game){return `<section class="panel rule-dex"><p class="eyebrow">CardStashy rule dex</p><h3>Read the card. Know the play.</h3><p class="small muted">Tap an underlined term on a card for a reminder. These summaries explain keywords and useful concepts; card-specific exceptions and rulings still apply.</p><div class="rules-list">${Object.entries(ruleTerms(game)).map(([key,r])=>`<details><summary><b>${esc(r.label)}</b></summary><p>${esc(r.definition)}</p><p class="small muted">${esc(r.tip)}</p>${conceptReading(game==='mtg'?resolveMtgConcept(key):null)}</details>`).join('')}</div><a class="link small" href="${SOURCES[game]}" target="_blank" rel="noopener noreferrer">Official rules and detailed rulings ↗</a></section>`;}
// This context comes only from the selected card object, never a name lookup.
export function ruleCardContext(game,card={}){
 card=card||{};const strings=value=>typeof value==='string'?value:'';
 const text=[card.oracle_text,card.text,card.effect,...(card.card_faces||[]).map(f=>f.oracle_text),...(card.abilities||[]).map(a=>[a.type,a.name,strings(a.effect)].filter(Boolean).join(': ')),...(card.attacks||[]).map(a=>[a.name,Array.isArray(a.cost)?a.cost.join(', '):a.cost,a.damage,strings(a.effect)].filter(x=>x!==undefined&&x!=='').join(' · '))].filter(x=>typeof x==='string'&&x).join('\n');
 return {game,id:String(card.id??''),name:String(card.name??''),set:String(card.set_name||card.set?.name||card.set?.id||card.setCode||(typeof card.set==='string'?card.set:'')),number:String(card.collector_number??card.number??card.localId??''),typeLine:String(card.type_line||card.typeLine||card.category||card.type||''),manaCost:String(card.mana_cost||''),faces:(card.card_faces||[]).map(f=>({name:String(f.name||''),manaCost:String(f.mana_cost||''),typeLine:String(f.type_line||''),text:String(f.oracle_text||'')})),text,complete:!card.brief&&!!text};
}
const lessonFor={
 mtg:{flying:2,reach:2,trample:2,haste:4,vigilance:2,deathtouch:3,lifelink:2,'first strike':2,'double strike':2,hexproof:1,ward:1,indestructible:3,flash:0,equip:1,scry:4,surveil:4,exile:3,sacrifice:3},
 ptcg:{Ability:3,Supporter:3,'Active Pokémon':4,Bench:0,'Prize cards':6,'Knocked Out':6,Asleep:4,Paralyzed:4,Confused:4,Poisoned:5,Burned:5,retreat:4,'damage counters':4},
 ygo:{'Quick Effect':2,'once per turn':3,'Special Summon':1,'Fusion Summoned':4,'Normal Summon':1,banish:3,GY:3,target:3,negate:3,'End Phase':0}
};
const keywordExamples={
 mtg:{flying:'An attacker with flying can be blocked by a creature with reach, even if that blocker does not have flying.',reach:'A creature with reach can block a flying attacker. When it attacks, an ordinary creature can still block it.',trample:'A 5/5 attacker with trample blocked by a 2/2 can normally assign 2 damage to the blocker and 3 to the defending player.',haste:'A creature you cast this turn with haste may attack if no other rule or effect prevents it.',vigilance:'A creature attacking with vigilance stays untapped. It is still an attacking creature.',deathtouch:'One damage from a source with deathtouch is lethal to an ordinary creature, but does not destroy an indestructible creature.',lifelink:'If your creature with lifelink deals 3 damage, you gain 3 life at the same time.', 'first strike':'A first-strike attacker may destroy its blocker before the ordinary combat damage step.', 'double strike':'An unblocked 2/2 with double strike normally deals 2 damage in each of the two combat damage steps.',hexproof:'An opponent cannot target your hexproof creature, but an effect affecting all creatures can still apply.',ward:'An opponent can target a creature with ward. The ward ability then triggers and may counter that spell or ability if its payment is not made.',indestructible:'A destroy effect does not destroy an indestructible creature. A sacrifice instruction can still remove it.',flash:'With priority, you may cast a creature with flash during an opponent’s turn, provided you can pay its costs and no restriction forbids it.',equip:'During your main phase with an empty stack, an equip ability can target a creature you control.',scry:'Scry 2 lets you look at the top two cards. You can put one on the bottom and leave the other on top, without drawing either.',surveil:'Surveil 2 can put one of the top two cards into your graveyard and leave the other on top. Neither card is drawn.',exile:'A card exiled by an effect is not in the graveyard. A graveyard-only return effect cannot choose it.',sacrifice:'If sacrificing a creature is an activation cost, the sacrifice happens before opponents can respond.'},
 ptcg:{Ability:'If an Ability says once during your turn, use it at the stated time and follow its restriction. It is not itself an attack.',Supporter:'If you already played one Supporter this turn, you normally cannot play a second one.', 'Active Pokémon':'An Asleep Active Pokémon cannot attack or retreat. A permitted switching effect can still move it to the Bench.',Bench:'If you already have five Benched Pokémon, you normally cannot put another Basic there.', 'Prize cards':'A normal Knock Out takes one Prize; the exact Pokémon’s Rule Box may specify a different reward.', 'Knocked Out':'A Pokémon with 100 HP and ten damage counters is normally Knocked Out. Follow any relevant replacement or other card effects.',Asleep:'During Checkup, a heads flip removes Asleep. Until it recovers, that Pokémon cannot attack or retreat.',Paralyzed:'A Paralyzed Pokémon can be moved by a permitted switching effect even though it cannot retreat.',Confused:'A tails Confusion flip prevents the attack and puts three damage counters on the attacking Pokémon.',Poisoned:'A Poisoned Active Pokémon normally gets one damage counter during Checkup, including between your opponent’s turn and yours.',Burned:'A Burned Pokémon normally gets two damage counters at Checkup, then flips to see whether Burned ends.',retreat:'Discarding Energy to retreat uses your normal retreat for the turn. A later switching effect is a separate action.', 'damage counters':'Placing two damage counters means 20 damage on the Pokémon, but it is not the same action as dealing 20 attack damage.'},
 ygo:{'Quick Effect':'A Quick Effect is Spell Speed 2, so it cannot chain to a Spell Speed 3 Counter Trap.', 'once per turn':'A restriction naming the card can apply across copies. Read whether it limits using the effect or activating it.', 'Special Summon':'An effect that Special Summons a monster does not automatically perform that monster’s named Fusion, Synchro or other Summon.', 'Fusion Summoned':'A monster Special Summoned without a Fusion Summoning method is not necessarily treated as Fusion Summoned.', 'Normal Summon':'A usual Level 4 Normal Summon uses your normal allowance for that turn; Main Phase 2 does not reset it.',banish:'An effect looking for a card in the Graveyard cannot choose that card after it has been banished.',GY:'A card sent to the GY as a cost was not necessarily destroyed. Effects checking for destruction may not apply.',target:'If a modern effect says to target before its semicolon, choose that target when activating it, not while resolving.',negate:'Destroying an activated effect’s source does not by itself negate that effect.', 'End Phase':'If an effect instructs you to act during the End Phase, resolve it at that specified timing rather than immediately when you read it.'}
};
export const ruleTerms=game=>({...CONCEPT_RULES[game],...EXTRA_RULES[game],...RULE_DEX[game]});
export function keywordHelp(game,key){
 const terms=ruleTerms(game),canonical=Object.keys(terms).find(k=>k.toLowerCase()===String(key).toLowerCase()),mechanic=terms[canonical],concept=game==='mtg'?resolveMtgConcept(key):null;
 if(!mechanic)return concept?{label:concept.label,definition:concept.summary,tip:concept.builderCoverage.summary,concept,sourceAuthority:'community-reference',lesson:{title:concept.label+' · context',example:concept.prerequisites.join(' '),detail:'Community background helps explain the topic. Current Oracle text and official rules remain the authority for game interactions.'},reference:null}:null;key=canonical;
 const related=LESSONS[game][lessonFor[game][key]??0],expanded=!RULE_DEX[game]?.[key],detail=game==='mtg'&&['scry','surveil'].includes(key)?'Follow the instruction when the relevant spell or ability resolves. Looking at or moving cards is not drawing them; only draw when a rule or effect says to.':related.detail;
 return {...mechanic,...(concept?{concept}:{}),lesson:{title:mechanic.label+' in play',example:keywordExamples[game]?.[key]||(concept?concept.prerequisites.join(' '):expanded?'Read the exact source alongside the selected card. The reminder alone does not establish a particular interaction.':related.example),detail:expanded?'This reference explains the mechanic; the complete card wording and current game state determine its use.':detail},reference:keywordReference(game,key)||extraRuleReference(game,key)};
}

let closeHint=()=>{},hintTrigger=null;
let closePreview=()=>{};
export function attachRuleHover(root=document){closePreview=installRuleHover(root,keywordHelp);}
export function dismissRuleHint(){closePreview();const trigger=hintTrigger;closeHint();return trigger?.isConnected?trigger:null;}
export function showRuleHint(button,selection={}){
 closePreview();
 const game=selection.game||button.dataset.game,ruleKey=selection.rule||button.dataset.rule,r=keywordHelp(game,ruleKey);if(!r)return;closeHint();hintTrigger=button;
 let context=null;try{const raw=button.closest('[data-rule-card-context]')?.dataset.ruleCardContext;if(raw){const value=JSON.parse(raw);if(value.game===game&&typeof value.text==='string')context=value;}}catch{}
 const cardContext=context?`<div class="rule-card-context"><p class="eyebrow">Selected card</p><b>${esc(context.name||'Unnamed card')}</b><p class="foot">${esc([context.set,context.number&&'#'+context.number,context.id].filter(Boolean).join(' · '))}</p><p class="small muted">${esc([context.typeLine,context.manaCost].filter(Boolean).join(' · '))}</p><details><summary>Read this card’s exact wording</summary><p class="rule-source-text">${esc(context.text||'Full card text is not available in this record.')}</p>${(context.faces||[]).map(f=>`<p class="foot">${esc([f.name,f.typeLine,f.manaCost].filter(Boolean).join(' · '))}</p>`).join('')}</details><p class="small muted">${context.complete?'This mechanic reminder is not a ruling on this particular board state. Check the complete wording, costs, targets, timing and restrictions.':'Full card text may be missing. Do not infer an interaction from this reminder alone.'}</p></div>`:'<p class="small muted">General mechanic reminder. The exact card wording and game state can change the result.</p>';
 const conceptKind=r.concept?'concept':'keyword',discovery=cardDiscoverySpec(game,conceptKind,r.concept?.id||ruleKey);
 const box=document.createElement('aside');box.className='rule-glass';box.setAttribute('role','dialog');box.setAttribute('aria-label',r.label);box.dataset.game=game;box.innerHTML=`<div class="row between"><small class="eyebrow">Rule dex · ${esc(game==='mtg'?'Magic':game==='ygo'?'Yu-Gi-Oh!':'Pokémon')}</small><button class="rule-dismiss" aria-label="Close definition">✕</button></div><div data-rule-hint-body><h3>${esc(r.label)}</h3><p>${esc(r.definition)}</p><p class="small muted">${esc(r.tip)}</p>${conceptReading(r.concept)}${cardContext}<details class="rule-hint-example"><summary>Example & deeper context</summary><p class="eyebrow">${esc(r.lesson.title)}</p><p>${esc(r.lesson.example)}</p><p class="small muted">${esc(r.lesson.detail)}</p></details><div class="row wrap">${discovery?discoveryButton(game,conceptKind,r.concept?.id||ruleKey,'Find related card candidates','btn ghost small'):''}${r.reference?'<button type="button" class="btn ghost small" data-rule-hint-source>Read the exact source</button>':''}<button type="button" class="btn ghost small" data-act="askRules" data-game="${game}" ${context?`data-rule-card-context="${esc(JSON.stringify(context))}"`:""} data-rules-references="${esc(JSON.stringify(r.reference?.kind==='bundled-entry'?[r.reference]:[]))}">Ask about this situation</button><button type="button" class="btn ghost small" data-act="learnGame" data-game="${game}">Explore rules & examples</button><a href="${SOURCES[game]}" target="_blank" rel="noopener noreferrer">Official rules ↗</a></div></div><div data-rule-hint-reference hidden></div>`;
 (button.closest('dialog')||document.body).append(box);
 const rect=button.getBoundingClientRect(),width=Math.min(420,window.innerWidth-32);box.style.width=width+'px';box.style.left=Math.min(window.innerWidth-width-16,Math.max(16,rect.left))+'px';box.style.top=Math.max(16,Math.min(rect.bottom+10,window.innerHeight-box.offsetHeight-16))+'px';
 let request=0;
 const loadSource=async()=>{
  const seq=++request,target=box.querySelector('[data-rule-hint-reference]');box.querySelector('[data-rule-hint-body]').hidden=true;target.hidden=false;
  const frame=body=>`<button type="button" class="btn ghost small" data-rule-hint-back>← Back to ${esc(r.label)}</button><h3 tabindex="-1" data-rule-hint-heading>${esc(r.label)} · source</h3>${body}`;
  target.innerHTML=frame('<p role="status">Opening the exact source…</p>');target.querySelector('h3').focus({preventScroll:true});box.scrollTop=0;
  try{
   const pack=r.reference.kind==='bundled-entry'?await loadRulePack(game):null;if(!box.isConnected||seq!==request)return;const resolved=resolveRuleReference(pack,r.reference);if(!resolved)throw Error('This exact source is unavailable in the selected edition.');
   const external=r.reference.kind==='official-page',source=external?resolved.reference:resolved.source,destination=external?{url:source.url,kind:'official-page',label:'Read the official explanation'}:sourceDestination(source,resolved.entry.page);
   target.innerHTML=frame(`<p class="small muted">${esc(source.organization)} · ${esc(source.title)} · ${esc(source.date)}</p>${source.legacy?'<p class="note small">Older reference. Later official updates and current card rulings take precedence.</p>':''}${external?`<p>${esc(source.summary)}</p>`:resolved.entries.map(e=>`<p class="rule-source-text" data-rule-entry="${esc(e.id)}">${esc(e.text)}</p>`).join('')}<a class="link" data-source-kind="${destination.kind}" href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer">${esc(destination.label)} ↗</a>${source.verification?`<p class="foot">${esc(source.verification)}</p>`:''}${game==='ygo'?'<p class="foot"><a href="https://www.yugioh-card.com/en/play/2021_rules_update/" target="_blank" rel="noopener noreferrer">Read the later official rules update ↗</a></p>':''}`);
  }catch(e){if(!box.isConnected||seq!==request)return;target.innerHTML=frame(`<p role="status">${esc(e.message)}</p><button type="button" class="btn ghost small" data-rule-hint-source>Retry exact source</button><a href="${SOURCES[game]}" target="_blank" rel="noopener noreferrer">Official source page ↗</a>`);}
  target.querySelector('h3').focus({preventScroll:true});box.scrollTop=0;
 };
 box.addEventListener('click',event=>{const action=event.target.closest('button');if(action?.matches('[data-rule-hint-source]'))loadSource();else if(action?.matches('[data-rule-hint-back]')){++request;box.querySelector('[data-rule-hint-body]').hidden=false;box.querySelector('[data-rule-hint-reference]').hidden=true;box.querySelector('[data-rule-hint-body] [data-rule-hint-source]').focus({preventScroll:true});box.scrollTop=0;}});
 const outside=e=>{if(!box.contains(e.target)&&e.target!==button)closeHint();},escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeHint();button.focus({preventScroll:true});}};
 closeHint=()=>{++request;hintTrigger=null;box.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);};
 box.querySelector('.rule-dismiss').onclick=()=>{closeHint();button.focus({preventScroll:true});};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);box.querySelector('.rule-dismiss').focus({preventScroll:true});
}
export function openMtgConceptHelp(id,trigger=globalThis.document?.activeElement){
 const concept=resolveMtgConcept(id);if(!concept||!trigger?.isConnected||typeof trigger.getBoundingClientRect!=='function')return false;
 showRuleHint(trigger,{game:'mtg',rule:concept.id});return true;
}
