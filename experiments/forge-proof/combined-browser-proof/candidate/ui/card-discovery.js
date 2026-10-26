// Typed handoffs to the existing per-game search. No generated cards, account
// writes or inferred franchise identity. Every label states what is searched.
import {esc} from './ui.js';
import {MTG_VOCABULARY} from './mtg-vocabulary.js';
import {resolveMtgConcept} from './mtg-wiki-knowledge.js';
import {mechanicCardMatches} from './deck-mechanic-plan.js';
const clean=v=>typeof v==='string'&&v.length<=120&&!/[\u0000-\u001f<>"\\]/.test(v)?v.trim():'';
const quote=v=>'"'+v.toLowerCase()+'"';
export function cardDiscoverySpec(game,kind,raw) {
 const value=clean(raw);if(!value||!['mtg','ygo','ptcg'].includes(game))return null;
 if(game==='mtg'){
  if(kind==='concept'){
   const concept=resolveMtgConcept(value);if(!concept)return null;
   if(concept.id==='bloodlust')return {game,q:'t:creature o:"combat damage" (o:player or o:opponent) o:"+1/+1 counter"',filters:{},conceptId:concept.id,label:'Combat-damage counter-growth candidates; exact wording still needs checking'};
   if(concept.id==='bloodthirst')return {game,q:'keyword:"bloodthirst"',filters:{},conceptId:concept.id,label:'Cards with the Bloodthirst keyword'};
   return null;
  }
  if(kind==='type')return {game,q:(MTG_VOCABULARY['creature-types'].includes(value)?[value]:value.split(/\s+/)).map(t=>'t:'+quote(t)).join(' '),filters:{},label:value+' cards'};
  if(kind==='keyword'){
   const intrinsic=MTG_VOCABULARY['keyword-abilities'].some(k=>k.toLowerCase()===value.toLowerCase());
   return {game,q:(intrinsic?'keyword:':'o:')+quote(value),filters:{},label:intrinsic?'Cards with '+value:'Card text mentioning '+value};
  }
 }
 if(game==='ptcg'&&kind==='keyword')return {game,q:'',filters:{},loadedText:value,label:'Loaded card text mentioning '+value};
 const fields=game==='ygo'?{archetype:'archetype',race:'race',attribute:'attribute',type:'type',keyword:'text'}:{type:'type',stage:'stage',category:'category',ability:'ability'};
 const field=fields[kind];if(!field)return null;
 return {game,q:'',filters:kind==='ability'?{}:{[field]:value},...(kind==='ability'?{loadedAbility:value}:{}),label:kind==='keyword'?'Card text mentioning '+value:kind==='ability'?'Loaded Pokémon with Ability: '+value:value+' cards'};
}
export function discoveryButton(game,kind,value,label=value,css='chip') {
 const spec=cardDiscoverySpec(game,kind,value);
 return spec?`<button type="button" class="${css}" data-act="ruleCards" data-game="${game}" data-discovery-kind="${esc(kind)}" data-discovery-value="${esc(value)}" aria-label="${esc(spec.label)}">${esc(label)}</button>`:esc(label);
}
export function discoverCardMarkup(game,card={}) {
 const chips=[];
 if(game==='mtg'){
  for(const face of card.card_faces?.length?card.card_faces:[card]){
   const type=face.type_line||'',left=type.split('—')[0].trim();
   if(left)chips.push(discoveryButton(game,'type',left));
   for(const subtype of (type.split('—')[1]||'').trim().match(/Time Lord|[^\s]+/g)||[])chips.push(discoveryButton(game,'type',subtype));
  }
  for(const ability of card.keywords||[])chips.push(discoveryButton(game,'keyword',ability));
  for(const id of ['bloodlust','bloodthirst'])if(!(card.keywords||[]).some(k=>k.toLowerCase()===id)&&mechanicCardMatches(card,[id])){const concept=resolveMtgConcept(id);chips.push(discoveryButton(game,'concept',id,concept.label+' · mechanic match'));}
 }else if(game==='ygo'){
  for(const kind of ['archetype','race','attribute'])if(card[kind])chips.push(discoveryButton(game,kind,card[kind]));
  if(card.cardType)chips.push(discoveryButton(game,'type',card.cardType));
 }else{
  if(card.category)chips.push(discoveryButton(game,'category',card.category,card.category==='Pokemon'?'Pokémon':card.category));
  for(const type of card.types||[])chips.push(discoveryButton(game,'type',type));
  if(card.stage)chips.push(discoveryButton(game,'stage',card.stage));
  for(const ability of card.abilities||[])if(ability.name)chips.push(discoveryButton(game,'ability',ability.name));
 }
 return chips.length?`<details class="card-discovery"><summary>Explore types &amp; abilities</summary><p class="small muted">Find related cards using these properties. Shared properties do not establish a working combo. Results depend on available card data.</p><div class="row wrap">${[...new Set(chips)].join('')}</div></details>`:'';
}
