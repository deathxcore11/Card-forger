// DOM presentation for a private, engine-backed research match. No card rules.
import {turnControlElements,turnFlowMessage} from '../../play-turn-controls.js';
import {actionIcon} from '../../icons.js';
import {bindCardPlacement,placementIntent} from './card-placement.mjs';
import {validInteractionText,validInteractionRelations,validDamageAssignments} from './interaction-surface.mjs';
import {cardStatView} from './card-stats.mjs';
import {randomOutcomeText} from './random-outcomes.mjs';
const labels={MulliganDecision:'Opening hand',Priority:'Your next move',ManaPayment:'Pay mana',TargetChoice:'Choose a target',DeclareAttackers:'Choose attackers',DeclareBlockers:'Choose blockers',AssignCombatDamage:'Assign combat damage',GameOver:'Match finished'};
const phaseNames={Untap:'Untap',Upkeep:'Upkeep',Draw:'Draw',PreCombatMain:'First main phase',BeginningOfCombat:'Beginning of combat',BeginCombat:'Beginning of combat',DeclareAttackers:'Combat · Attackers',DeclareBlockers:'Combat · Blockers',FirstStrikeDamage:'First-strike damage',CombatDamage:'Combat damage',EndCombat:'End of combat',EndOfCombat:'End of combat',PostCombatMain:'Second main phase',End:'End step',EndStep:'End step',Cleanup:'Cleanup'};
export const matchPhaseLabel=phase=>phaseNames[phase]||String(phase||'').replace(/([a-z])([A-Z])/g,'$1 $2');
// Display only the authority's versioned, visible Commander facts.
export function commanderDetailLines(view,cardId){
 const data=view?.commander;if(data?.version!==1||!['visible-public-objects','public-designation-ledger'].includes(data.coverage))return [];
 const entry=data.commanders?.find(c=>c.id===cardId);if(!entry)return [];
 const lines=['Commander'];
 if(Number.isSafeInteger(entry.tax)&&entry.tax>=0)lines.push(`Command-zone tax: ${entry.tax} generic mana`);
 if(Number.isSafeInteger(entry.castCount)&&entry.castCount>=0)lines.push(`Cast from command zone: ${entry.castCount}`);
 for(const damage of data.damage||[])if(damage.commanderId===cardId&&Number.isSafeInteger(damage.amount)&&damage.amount>=0&&[0,1].includes(damage.player))lines.push(`Commander damage to ${damage.player===view.seat?'you':'CPU'}: ${damage.amount}`);
 return lines;
}
export function battlefieldGroups(cards){
 const groups=[{key:'creatures',label:'Creatures',cards:[]},{key:'lands',label:'Lands',cards:[]},{key:'other',label:'Other permanents',cards:[]}];
 for(const card of cards){const types=card.known===true?card.types||[]:[];groups[types.includes('Creature')?0:types.includes('Land')?1:2].cards.push(card);}
 return groups.filter(group=>group.cards.length);
}
// Visually stacks permanents whose every visible detail matches, in first-seen order.
// Each card keeps its own element and engine identity; a change of state splits it out.
export function battlefieldPiles(cards){
 const piles=new Map();
 for(const c of cards){const key=c.known===true?JSON.stringify([c.name,c.controller,c.isToken,c.tapped,c.power,c.toughness,c.damage,c.counters||{},c.attacking,c.blocking,c.summoningSick,c.keywords||[],c.type,c.text,c.face,c.printing?.playArtwork?.card?.id||null]):'face-down:'+c.id;if(!piles.has(key))piles.set(key,[]);piles.get(key).push(c);}
 return [...piles.values()];
}
export function playerStateEmblem(snapshot,seat){
 const view=snapshot?.status?.surface;
 if(!view)return {active:false,title:'Preparing match',phase:''};
 if(snapshot.status.terminal)return {active:false,title:'Match finished',phase:''};
 if(view.decision?.kind==='MulliganDecision')return {active:false,title:'Opening hand',phase:'Review your cards'};
 const active=seat===view.activeSeat;
 if(active)return {active,title:`${seat===view.seat?'Your':'CPU'} turn · ${view.turn}`,phase:matchPhaseLabel(view.phase)};
 const activity=matchActivity(snapshot),needsChoice=seat===view.seat&&activity.actor==='you';
 return {active,title:needsChoice?'Your response':'Waiting',phase:needsChoice&&view.decision.kind!=='Priority'?activity.label:''};
}
// Local draft cues are distinct from inspection and accepted engine events.
// Stale, unavailable and hidden references never become board highlights.
export function cardDraftCue(snapshot,instanceId){
 const {status,pending,busy,error}=snapshot||{},view=status?.surface;
 if(!view?.interaction?.canSubmit||status.terminal||busy||error&&error!=='CHOICE_REJECTED'||!view.cards?.some(c=>c.known&&c.id===instanceId))return null;
 for(const o of view.interaction.opportunities||[]){
  const choices=(o.choices||[]).filter(c=>c.available&&c.surfaces.filter(s=>s.type==='object').length===1&&c.surfaces.some(s=>s.type==='object'&&s.reference===String(instanceId)));
  for(const c of choices){
   const draft=pending?.interactionId===o.interactionId&&pending.revision===status.revision?pending:null;
   if(o.type==='relations'&&['DeclareAttackers','DeclareBlockers'].includes(view.decision.kind)&&o.edges?.some(e=>e.sourceId===c.id&&e.targetIds.some(id=>o.choices.some(t=>t.id===id&&t.available)))){
    const selected=!!draft?.relations?.some(r=>r.sourceId===c.id),attack=view.decision.kind==='DeclareAttackers';
    return {kind:attack?'attack':'block',selected,label:selected?(attack?'Attack selected':'Block selected'):(attack?'Can attack':'Can block')};
   }
   if(['choose','select','sequence'].includes(o.type)&&draft?.choiceIds?.includes(c.id))return {kind:'choice',selected:true,label:'Choice selected'};
  }
 }
 return null;
}
export function battlefieldPresentation(card){
 if(card?.known!==true)return {kind:'hidden',label:'Face down',creature:false};
 const types=card.types||[],creature=types.includes('Creature');
 return {kind:creature?(card.isToken?'token':'creature'):types.includes('Land')?'land':types.includes('Planeswalker')?'planeswalker':types.includes('Battle')?'battle':'permanent',label:types.filter(t=>['Creature','Land','Artifact','Enchantment','Planeswalker','Battle'].includes(t)).join(' · ')||(card.isToken?'Token':'Permanent'),creature};
}
export function cardSelectionOffer(snapshot,instanceId){
 const {status,busy,error}=snapshot||{},view=status?.surface;
 if(!view?.interaction?.canSubmit||status.terminal||busy||error&&error!=='CHOICE_REJECTED'||!view.cards.some(c=>c.known&&c.id===instanceId))return null;
 const offers=[];for(const o of view.interaction.opportunities||[])if(['choose','select','sequence'].includes(o.type))for(const c of o.choices||[])if(c.available&&c.surfaces.length===1&&c.surfaces[0].type==='object'&&c.surfaces[0].reference===String(instanceId))offers.push({interactionId:o.interactionId,choiceId:c.id});
 return offers.length===1?offers[0]:null;
}
export function draftBoardLinks(snapshot){
 const {status,pending,busy,error}=snapshot||{},view=status?.surface;
 if(!pending||pending.revision!==status?.revision||!view?.interaction?.canSubmit||status.terminal||busy||error&&error!=='CHOICE_REJECTED')return [];
 const o=view.interaction.opportunities.find(o=>o.interactionId===pending.interactionId);if(!o)return [];
 const endpoint=id=>{const c=o.choices?.find(c=>c.id===id&&c.available);if(!c||c.surfaces.some(s=>s.type==='action')||c.surfaces.length!==1)return null;const s=c.surfaces[0];if(s.type==='player'&&view.players?.some(p=>p.seat===s.seat))return {seat:s.seat};if(s.type==='object'&&view.cards.some(c=>c.known&&String(c.id)===s.reference))return {id:Number(s.reference)};return null;};
 if(o.type==='relations')return (pending.relations||[]).flatMap(r=>{if(!o.edges.some(e=>e.sourceId===r.sourceId&&e.targetIds.includes(r.targetId)))return [];const from=endpoint(r.sourceId),to=endpoint(r.targetId);return from&&to?[{from,to}]:[];});
 if(['choose','select','sequence'].includes(o.type))return (pending.choiceIds||[]).flatMap(id=>{const to=endpoint(id);return to?[{from:{prompt:o.interactionId},to}]:[];});
 return [];
}
export function matchActivity({status,busy=false,error=null,native=null,transportError=null}={}){
 const view=status?.surface;
 if(status?.failure)return {actor:'none',label:'Match stopped'};
 if(status?.terminal)return {actor:'none',label:'Match finished'};
 if(error&&error!=='CHOICE_REJECTED')return {actor:'none',label:'Match stopped'};
 if(!view)return {actor:'none',label:'Opening match…'};
 const human=!!(view.awaitingHuman||view.canAct||view.interaction?.canSubmit);
 if(transportError)return {actor:'none',label:'Match update needs attention'};
 if(busy)return {actor:'none',label:native?.busy===true?'Resolving game actions…':'Waiting for the table…'};
 if(human){const kind=view.decision?.kind;return {actor:'you',label:kind==='Priority'?(view.stack?.length||view.activeSeat!==view.seat?'Your response':'You can act'):labels[kind]||matchPhaseLabel(kind)||'Your decision'};}
 return {actor:'cpu',label:'Waiting for CPU'};
}
const actionNames={tapLandForMana:'Tap for mana',cancelCast:'Cancel casting',passPriority:'Pass priority',castSpell:'Cast spell',activateAbility:'Activate ability',mulliganDecision:'Opening hand'};
const actionText=(c,kind)=>c.presentationUnavailable?'Choice details unavailable':c.label||c.surfaces.map(s=>s.type==='player'?`Player ${s.seat+1}`:s.type==='action'?(kind==='ManaPayment'&&s.code==='passPriority'?'Pay selected mana':actionNames[s.code]||s.code.replace(/([a-z])([A-Z])/g,'$1 $2')):s.type==='value'&&s.role==='abilityIndex'?`Ability ${Number(s.value)+1}`:s.type==='value'&&s.role==='paymentMode'?(s.value==='manual'?'Manual mana':'Automatic mana'):s.name||s.value||'').filter(Boolean).join(' · ')||'Choose';
// Cues describe current offered commands, never affordability inferred from art,
// mana, card text or names. An absent cue is not proof that no action exists.
export function cardActionCues(snapshot,instanceId){
 const {status,busy,error}=snapshot||{},view=status?.surface,card=view?.cards?.find(c=>c.id===instanceId);
 if(!card?.known||status.terminal||busy||error&&error!=='CHOICE_REJECTED')return [];
 const cues=[];
 if(view.canAct)for(const choice of view.choices||[]){
  if(choice.sourceId!==instanceId||!['PlayLand','CastSpell'].includes(choice.kind))continue;
  cues.push({tone:'play',label:choice.kind==='PlayLand'?'Play':'Cast',text:choice.label,token:choice.token});
 }
 if(view.interaction?.canSubmit)for(const o of view.interaction.opportunities||[]){
  if(!['choose','select','sequence'].includes(o.type))continue;
  for(const choice of o.choices){
   const objects=choice.surfaces.filter(s=>s.type==='object');
   if(!choice.available||objects.length!==1||objects[0].reference!==String(instanceId))continue;
   const action=choice.surfaces.find(s=>s.type==='action')?.code;
   const cue={castSpell:['play','Cast'],playLand:['play','Play'],activateAbility:['ability','Activate'],tapLandForMana:['ability','Add mana']}[action];
   if(action&&!cue)continue;
   cues.push({tone:cue?.[0]||'choice',label:cue?.[1]||'Choose',text:actionText(choice,view.decision.kind),interactionId:o.interactionId,choiceId:choice.id});
  }
 }
 return cues;
}
export function mountMatchTable(root,{session,profile={displayName:'You'},renderPlayerPortrait=()=>null,renderPlayerBackdrop=()=>null,renderMatchBackdrop=()=>null,format=null,resolveCard=()=>null,decorateCard=()=>{},decorateInspector=()=>{},renderOracleText=null,renderMatchContext=()=>null,allowConcede=false,title='CardStashy · Private rules test',mountEffects=()=>()=>{},onExit=()=>{},pileIdentical=false}){
 const disposeEffects=mountEffects(root),cardNodes=new Map(),bandDrafts=new Map();let bandRevision=null;let inspectorContent=null;let menu=null,exitOpen=false,advancedOpen=false,lastRevision=-1,inspectorHidden=false,detailsOpen=false,showAllCombatLines=false,focusedCombatCard=null;const log=[];let lastRenderKey=null,lastTurnKey=null,turnBanner=null,turnBannerStarted=0,linkLayer=null,boardLinks=[],combatSourceId=null,combatReplace=false,controlError='';let oneClickChoices=true;
 let previousHand=null,previousDraw=null;const newHandCards=new Map();
 // A closed/reset session must not retain detached card art or inspector content.
 function clearPresentationCaches(){cardNodes.clear();bandDrafts.clear();inspectorContent=null;menu=null;inspectorOriginKey=null;previousHand=null;previousDraw=null;newHandCards.clear();seatAttentionKeys.clear();boardLinks=[];linkLayer=null;turnBanner=null;lastTurnKey=null;lastRevision=-1;bandRevision=null;log.length=0;}
 const duration=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 function updateClock(clock){for(const [label,field,title] of [['Inactivity time','idleSeconds','Idle'],['Turn time','turnSeconds','Turn']]){const out=root.querySelector(`[aria-label="${label}"]`),seconds=clock?.limits?.[field];if(out){out.textContent=Number.isSafeInteger(seconds)?`${title} ${duration(seconds)}`:'';out.className=Number.isSafeInteger(seconds)&&seconds<=30?'play-match-warning':'';}}const out=root.querySelector('[aria-label="Response time"]');if(out){out.textContent=clock?.remainingSeconds!==null&&clock?.remainingSeconds!==undefined?`${clock.remainingSeconds}s to respond`:clock?.needsChoice?'Your choice is required':'';out.className=clock?.warning?'play-match-warning':'';}}
 function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
 function button(text,action,{disabled=false,key,pressed,blockWhileBusy=false}={}){const b=element('button',text);b.type='button';b.disabled=disabled;if(key)b.dataset.focusKey=key;if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));if(/^Confirm |^Keep hand$|^Pay selected mana$/.test(text))b.classList.add('play-match-primary');const failed=e=>{if(['MATCH_NOT_READY','STALE_CHOICE','CHOICE_INCOMPLETE','CHOICE_FULL'].includes(e.message)){render(session.snapshot());return;}queueMicrotask(()=>{throw e;});};b.addEventListener('click',()=>{if(blockWhileBusy&&session.snapshot().busy)return;try{const result=action();if(result?.catch)result.catch(failed);}catch(e){failed(e);}});return b;}
 const placement=bindCardPlacement(root,{session,onError:e=>queueMicrotask(()=>{throw e;})});
 const creatureState=c=>[c.tapped?'Tapped':'',c.power!==null&&c.power!==undefined?`${c.power}/${c.toughness}`:'',c.damage?`${c.damage} damage`:'',...Object.entries(c.counters||{}).map(([k,v])=>`${v} ${k}`)].filter(Boolean).join(' · ');
 const identity=c=>JSON.stringify([c.known,c.name,c.face,c.isToken,c.displaySource,c.tokenImageRef,c.printing||null]);
 function renderStats(c){const box=element('span',undefined,'play-match-state'),v=cardStatView(c);if(!v)return box;
  if(v.token)box.append(element('span','Token','play-state-chip'));if(v.emblem)box.append(element('span','Emblem','play-state-chip'));
  if(c.types?.includes('Creature')&&v.power!==null&&v.toughness!==null){const line=element('span',undefined,'play-current-stats');line.setAttribute('aria-label',`Current power ${v.power}, toughness ${v.toughness}`);line.append(element('b',String(v.power),'play-stat-'+v.powerTone),element('span','/'),element('b',String(v.toughness),'play-stat-'+v.toughnessTone));box.append(line);if(v.basePower!==null&&v.baseToughness!==null)box.append(element('small',`Base ${v.basePower}/${v.baseToughness}`,'play-stat-base'));}
  if(v.tapped)box.append(element('span','↷ Tapped','play-state-chip play-tapped-chip'));
  if(v.damage)box.append(element('span',`${v.damage} damage`,'play-state-chip play-marked-damage'));
  for(const counter of v.counters)box.append(element('span',`${counter.count} × ${counter.label}`,'play-state-chip play-counter play-stat-'+counter.tone));
  return box;
 }
 let inspectorOriginKey=null;const seatAttentionKeys=new Map();
 function restoreInspectorFocus(){
  const keys=[inspectorOriginKey,`card-${session.snapshot().selected}`,'table-details'];
  for(const key of keys){const node=[...root.querySelectorAll('[data-focus-key]')].find(n=>n.dataset.focusKey===key&&!n.disabled);if(node){node.focus();return;}}
 }
 function closeInspector(){inspectorHidden=true;detailsOpen=false;menu=null;render(session.snapshot());restoreInspectorFocus();}
 function inspect(id){inspectorOriginKey=root.contains(document.activeElement)?document.activeElement.dataset.focusKey:null;menu=null;inspectorHidden=false;session.inspect(id);}
 function cardNode(c,selected,used){
  const id=c.id,presentation=c.zone==='Battlefield'?'battlefield':'card',key=identity(c)+':'+presentation;used.add(id);let cached=cardNodes.get(id);
  if(!cached||cached.key!==key){
   const b=button('',()=>{
    const snap=session.snapshot(),v=snap.status?.surface;
    if(snap.busy||snap.error&&snap.error!=='CHOICE_REJECTED')return;
    const o=v?.interaction?.canSubmit?v.interaction.opportunities.find(o=>o.type==='relations'):null;
    const choice=o?.choices.find(c=>c.available&&c.surfaces.length===1&&c.surfaces[0].type==='object'&&c.surfaces[0].reference===String(id));
    if(choice){
     const edge=o.edges.find(e=>e.sourceId===choice.id);
     if(edge){combatSourceId=choice.id;focusedCombatCard=id;combatReplace=false;render(snap);return;}
     const from=o.edges.find(e=>e.sourceId===combatSourceId&&e.targetIds.includes(choice.id));
     if(from){if(combatReplace){const old=snap.pending?.interactionId===o.interactionId?snap.pending.relations:[];combatReplace=false;session.setRelations(o.interactionId,[...old.filter(r=>r.sourceId!==from.sourceId),{sourceId:from.sourceId,targetId:choice.id,group:null}]);}else session.toggleRelation(o.interactionId,from.sourceId,choice.id);return;}
    }
    const offer=cardSelectionOffer(snap,id);if(offer)session.select(offer.interactionId,offer.choiceId);else inspect(id);
   },{key:`card-${id}`});b.className='play-match-card';b.dataset.instance=String(id);b.dataset.presentation=presentation;
   if(c.known){const data=resolveCard(c),src=presentation==='battlefield'?data?.artImageUrl||data?.imageUrl:data?.imageUrl;if(src){const img=element('img');img.src=src;img.alt='';img.loading='lazy';if(presentation==='battlefield'){const art=element('span',undefined,'play-match-piece-art');art.append(img);b.prepend(art);}else b.prepend(img);}}
   if(!b.querySelector('img'))b.append(element('span',c.known?'Card art unavailable':'Face down','play-match-card-back'));b.append(element('span',c.known?c.name:'Face down','play-match-card-name'));const state=element('span',undefined,'play-match-state-slot');b.append(state);if(c.known)decorateCard(b,c);
   const openMenu=e=>{e.preventDefault();inspect(id);menu=id;render(session.snapshot());root.querySelector('[role="menu"] button')?.focus();};
   b.addEventListener('contextmenu',openMenu);b.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')openMenu(e);else if(e.key.toLowerCase()==='i'){e.preventDefault();inspect(id);}});cached={key,node:b,state};cardNodes.set(id,cached);
  }
  cached.node.setAttribute('aria-pressed',String(id===selected&&!inspectorHidden));cached.node.dataset.tapped=String(c.tapped===true);cached.node.dataset.combat=c.attacking===true?'attacking':c.blocking===true?'blocking':'none';const family=battlefieldPresentation(c);cached.node.dataset.family=family.kind;cached.node.setAttribute('aria-label',c.known?[c.name,creatureState(c)].filter(Boolean).join(' · '):'Face down');const text=JSON.stringify([cardStatView(c),c.types]);if(cached.statKey!==text){cached.state.replaceChildren(renderStats(c));cached.node.querySelector('.play-match-type')?.remove();if(presentation==='battlefield'&&c.known){const type=element('small',family.label,'play-match-type');cached.node.append(type);}cached.statKey=text;}return cached.node;
 }
 function render(snapshot){
  placement.reconcile();
  const {status,selected,pending,busy,error,clock}=snapshot;
  const renderKey=JSON.stringify([status?.revision,status?.surface,status?.outcomes,selected,pending,busy,error,menu,exitOpen,advancedOpen,inspectorHidden,detailsOpen,showAllCombatLines,combatSourceId,combatReplace,snapshot.turnFlow,controlError,oneClickChoices]);
  if(renderKey===lastRenderKey){updateClock(clock);return;}lastRenderKey=renderKey;
  const focused=root.contains(document.activeElement)?document.activeElement.dataset.focusKey:null;
  const disclosures=[...root.querySelectorAll('details[data-keep-open]')].map(n=>[n.dataset.keepOpen,n.open]);
  const scrolls=[...root.querySelectorAll('[data-keep-scroll]')].map(n=>[n.dataset.keepScroll,n.scrollTop,n.scrollLeft]);
  placement.cancel();root.replaceChildren();root.className='play-match-table';
  if(!status){clearPresentationCaches();root.append(element('p',error?'This match could not continue.':'Opening match…'));return;}
  if(status.failure){clearPresentationCaches();const stopped=element('section',undefined,'play-match-error');stopped.setAttribute('role','alert');stopped.append(element('h2','Native match stopped'),element('p','Card visibility is unavailable. Cards were cleared for privacy; this does not mean the battlefield is empty or that no legal actions exist.'),element('p','No action or automatic pass will be sent from this stopped table.'),button('Return to Play setup',onExit,{key:'exit-match'}));root.append(stopped);return;}
  if(bandRevision!==status.revision){controlError='';bandDrafts.clear();focusedCombatCard=null;combatSourceId=null;combatReplace=false;bandRevision=status.revision;}
  const view=status.surface,activity=matchActivity(snapshot),openingHand=view.decision.kind==='MulliganDecision',cardById=new Map(view.cards.map(c=>[c.id,c]));
  if(menu!==null&&!cardById.get(menu)?.known)menu=null;
  for(const id of cardNodes.keys())if(!cardById.has(id))cardNodes.delete(id);
  const ownDraw=view.players.find(p=>p.seat===view.seat)?.drawnThisTurn;if(Number.isSafeInteger(ownDraw)){if(previousDraw?.turn===view.turn&&ownDraw>previousDraw.count)log.push(ownDraw-previousDraw.count===1?'You drew a card.':`You drew ${ownDraw-previousDraw.count} cards.`);previousDraw={turn:view.turn,count:ownDraw};}
  const handNow=new Set(view.hand);if(previousHand&&!openingHand)for(const id of handNow)if(!previousHand.has(id))newHandCards.set(id,performance.now());previousHand=handNow;for(const [id,time]of newHandCards)if(!handNow.has(id)||performance.now()-time>12000)newHandCards.delete(id);
  root.dataset.stage=openingHand?'opening':'match';root.dataset.decision=view.decision.kind;if(format)root.dataset.format=format;
  const turnKey=openingHand?null:JSON.stringify([view.turn,view.activeSeat]);
  if(turnKey!==lastTurnKey){lastTurnKey=turnKey;turnBanner=null;if(turnKey&&!status.terminal){turnBanner=element('div',`${view.activeSeat===view.seat?'Your turn':'CPU turn'} · Turn ${view.turn}`,'play-match-turn-banner');turnBanner.setAttribute('aria-hidden','true');turnBannerStarted=performance.now();}}
  if(status.revision!==lastRevision){log.push(`Turn ${view.turn} · ${labels[view.decision.kind]||view.decision.kind}`);lastRevision=status.revision;}
  const header=element('header',undefined,'play-match-header');
  header.append(element('strong',title,'play-match-brand'));
  const acting=element('div',activity.label,'play-match-activity');acting.dataset.actor=activity.actor;acting.setAttribute('role','status');header.append(acting);
  const turnElements=openingHand?[]:turnControlElements({document:root.ownerDocument,snapshot,session,onError:message=>{controlError=message;render(session.snapshot());}}),cancelAutoPass=turnElements.find(n=>n.classList.contains('play-cancel-auto-pass')),responseMode=turnElements.find(n=>n.classList.contains('play-turn-mode'));
  const directChoiceLabel=element('label','One-click choices with clear outcomes'),directChoiceInput=element('input');directChoiceInput.type='checkbox';directChoiceInput.checked=oneClickChoices;directChoiceInput.setAttribute('aria-label','One-click choices with clear outcomes');directChoiceInput.addEventListener('change',()=>{oneClickChoices=directChoiceInput.checked;render(session.snapshot());});directChoiceLabel.prepend(directChoiceInput);turnElements.find(n=>n.classList.contains('play-turn-controls'))?.querySelector('.play-turn-controls-panel')?.append(directChoiceLabel);
  header.append(...turnElements.filter(n=>n!==cancelAutoPass&&n!==responseMode));
  if(!openingHand)header.append(button(`History & stack${view.stack.length?' · '+view.stack.length:''}`,()=>{inspectorOriginKey='table-details';detailsOpen=!detailsOpen;inspectorHidden=!detailsOpen;render(session.snapshot());},{key:'table-details',pressed:detailsOpen}));
  const matchMenu=element('details',undefined,'play-match-menu');matchMenu.dataset.keepOpen='match-menu';matchMenu.append(element('summary','Match menu'));matchMenu.append(element('p','Select cards to inspect. Press I on a focused card for details. Highlighted choices come from the rules engine.'));matchMenu.append(button(allowConcede?(status.terminal?'Return to Play':'Exit match'):'Close research table',()=>{if(!allowConcede||status.terminal)return onExit();exitOpen=true;render(session.snapshot());},{key:'exit-match'}));header.append(matchMenu);root.append(header);
  if(!openingHand){const drop=element('div','Release to cast','play-match-cast-drop');drop.dataset.placementZone='stack';drop.setAttribute('aria-hidden','true');root.append(drop);}
  if(turnBanner&&!status.terminal){const elapsed=performance.now()-turnBannerStarted;if(elapsed<800){turnBanner.style.animationDelay=`-${elapsed}ms`;root.append(turnBanner);}else turnBanner=null;}
  const main=element('div',undefined,'play-match-main'),table=element('div',undefined,'play-match-mat'),rail=element('aside',undefined,'play-match-inspector');
  const backdrop=renderMatchBackdrop();if(backdrop){backdrop.classList.add('play-match-backdrop');backdrop.setAttribute('aria-hidden','true');table.append(backdrop);}
  table.dataset.keepScroll='table';rail.dataset.keepScroll='inspector';
  const usedCardIds=new Set();
  const card=c=>{const node=cardNode(c,selected,usedCardIds),cues=cardActionCues(snapshot,c.id),draft=cardDraftCue(snapshot,c.id),labels=[...new Set(cues.map(c=>c.label))];node.querySelector('.play-match-card-cue')?.remove();node.querySelector('.play-match-draft-cue')?.remove();node.querySelector('.play-match-new-card')?.remove();if(c.zone==='Hand'&&newHandCards.has(c.id)){node.append(element('span','New','play-match-new-card'));node.dataset.newCard='true';}else delete node.dataset.newCard;node.dataset.actionCue=cues[0]?.tone||'';node.dataset.draftSelected=String(!!draft?.selected);if(cues.length){const badge=element('span',labels.join(' / '),'play-match-card-cue');badge.setAttribute('aria-hidden','true');node.append(badge);node.setAttribute('aria-label',node.getAttribute('aria-label')+' · '+labels.join(' or ')+' available');}if(draft){const badge=element('span',draft.label,'play-match-draft-cue');badge.setAttribute('aria-hidden','true');node.append(badge);node.setAttribute('aria-label',node.getAttribute('aria-label')+' · '+draft.label+(draft.selected?' · unconfirmed':''));}const intent=placementIntent(snapshot,c.id);node.dataset.placementAvailable=String(!!intent);const offer=cardSelectionOffer(snapshot,c.id),help=offer?'Select for this choice, then confirm below. Use the magnifier or press I for details.':intent?(intent.zone==='battlefield'?'Drag to your battlefield, or use the Play button.':'Drag to your battlefield or the stack to cast with automatic mana.'):cues.length?'Select this card to see its available actions.':'Select this card to inspect it.';node.setAttribute('aria-description',help);
   const relation=view.interaction?.canSubmit?view.interaction.opportunities.find(o=>o.type==='relations'):null;
   const offered=relation?.choices.find(x=>x.available&&x.surfaces.length===1&&x.surfaces[0].type==='object'&&x.surfaces[0].reference===String(c.id));
   node.dataset.combatSource=String(!!offered&&relation.edges.some(e=>e.sourceId===offered.id));node.dataset.combatFocus=String(!!offered&&offered.id===combatSourceId);node.dataset.combatTarget=String(!!offered&&relation.edges.some(e=>e.sourceId===combatSourceId&&e.targetIds.includes(offered.id)));
   node.querySelector('.play-match-keywords')?.remove();if(c.known&&c.zone==='Battlefield'&&c.keywords?.length){const keys=element('span',undefined,'play-match-keywords');const important=c.keywords.filter(k=>['Flying','Reach','Trample','Deathtouch','FirstStrike','DoubleStrike','Vigilance','Menace','Indestructible','Lifelink'].includes(k));for(const k of important)keys.append(element('span',matchPhaseLabel(k)));if(c.keywords.length>important.length)keys.append(element('span',`+${c.keywords.length-important.length}`));node.append(keys);}
   const wrapper=element('span',undefined,'play-match-card-wrap');wrapper.dataset.presentation=node.dataset.presentation;wrapper.dataset.family=node.dataset.family;wrapper.append(node);if(c.known){const inspectButton=button('⌕',()=>inspect(c.id),{key:`inspect-card-${c.id}`});inspectButton.className='play-match-inspect-card';inspectButton.setAttribute('aria-label','Inspect '+c.name);wrapper.append(inspectButton);}return wrapper;};
  function zone(title,cards,{hand=false}={}){
   const section=element('section',undefined,'play-match-zone'+(hand?' play-match-hand':''));section.setAttribute('aria-label',title);if(!hand)section.dataset.owner=title==='Your battlefield'?'you':'cpu';if(title==='Your battlefield')section.dataset.placementZone='battlefield';
   const heading=element('div',undefined,'play-match-zone-heading');heading.append(element('h2',hand&&openingHand?'Your opening hand':title),element('span',String(cards.length),'play-match-zone-count'));if(hand)heading.append(element('span',openingHand?'Inspect any card. Then keep or mulligan below.':'Select a card to inspect','play-match-hand-hint'));section.append(heading);
   if(!cards.length){section.append(element('p',hand?'Your hand is empty':'No permanents on the battlefield','play-match-empty'));return section;}
   const groups=hand?[{key:'hand',cards}]:battlefieldGroups(cards);if(!hand&&groups.length===1)heading.querySelector('h2').textContent=title+' · '+groups[0].label;const rows=element('div',undefined,'play-match-zone-groups');
   for(const group of groups){const lane=element('div',undefined,'play-match-lane');lane.dataset.cardGroup=group.key;if(!hand&&groups.length>1)lane.append(element('h3',`${group.label} · ${group.cards.length}`));const row=element('div',undefined,'play-match-card-row');if(hand){row.dataset.keepScroll='hand';row.tabIndex=0;row.setAttribute('aria-label','Cards in your hand');}if(pileIdentical&&!hand){for(const pile of battlefieldPiles(group.cards))for(const [at,c]of pile.entries()){const node=card(c);if(pile.length>1){node.dataset.pileSize=String(pile.length);node.dataset.pileIndex=String(at);node.dataset.pileTight=String(at>0&&at<pile.length-5);if(at===pile.length-1){node.dataset.pileTop='true';node.append(element('span','×'+pile.length,'play-match-pile-count'));const b=node.querySelector('.play-match-card');b?.setAttribute('aria-label',b.getAttribute('aria-label')+` · top of ${pile.length} identical`);}}row.append(node);}}
   else for(const [index,c]of group.cards.entries()){const node=card(c);node.style.setProperty('--fan-angle',`${Math.max(-7,Math.min(7,(index-(group.cards.length-1)/2)*2))}deg`);row.append(node);}lane.append(row);rows.append(lane);}section.append(rows);return section;
  }
  function seatPanel(player,name,own=false){
   const emblem=playerStateEmblem(snapshot,player.seat),panel=element('section',undefined,'play-match-seat');panel.dataset.active=String(emblem.active);panel.dataset.seat=own?'you':'cpu';panel.dataset.playerSeat=String(player.seat);panel.setAttribute('aria-label',own?'Your status':'CPU status');
   const attention=own&&activity.actor==='you'&&!emblem.active?'response':emblem.active?'turn':'idle',attentionKey=JSON.stringify([emblem.title,emblem.phase,attention]);panel.dataset.attention=attention;panel.dataset.attentionChanged=String(seatAttentionKeys.has(player.seat)&&seatAttentionKeys.get(player.seat)!==attentionKey);seatAttentionKeys.set(player.seat,attentionKey);
   const art=renderPlayerBackdrop(own,player);if(art){art.classList.add('play-match-seat-art');art.setAttribute('aria-hidden','true');panel.append(art);}
   const portrait=element('div',undefined,'play-match-profile-badge'),avatar=renderPlayerPortrait(own,player)||element('span',own?(name[0]||'Y'):'CPU','play-match-avatar-fallback');portrait.setAttribute('aria-label',own?'Your profile':'CPU identity');portrait.append(avatar);panel.append(portrait);
   const info=element('div',undefined,'play-match-player');info.append(element('strong',name));const phase=element('div',undefined,'play-match-seat-phase'),sigil=element('span',undefined,'play-seat-emblem');sigil.setAttribute('aria-hidden','true');sigil.innerHTML=actionIcon(attention==='response'?'ideas':attention==='turn'?'refresh':'more');phase.append(sigil,element('strong',emblem.title));if(emblem.phase)phase.append(element('span',emblem.phase));info.append(phase);if(player.poison)info.append(element('span',`${player.poison} poison`,'play-seat-poison'));
   const life=element('div',undefined,'play-match-life');life.setAttribute('aria-label',`${player.life} life`);life.append(element('strong',String(player.life)),element('span','LIFE'));panel.append(info,life);return panel;
  }
  function zonesMenu(){
   const zones=element('details',undefined,'play-match-zones-menu');zones.dataset.keepOpen='known-zones';zones.append(element('summary',format==='Commander'?'Zones · Commander':'Zones'));
   const body=element('div');if(view.commander?.coverage==='public-designation-ledger'){const ledger=element('details');ledger.append(element('summary','Commander record'));for(const entry of view.commander.commanders||[]){ledger.append(element('h3',entry.name||'Commander'));for(const line of commanderDetailLines(view,entry.id))ledger.append(element('p',line));}body.append(ledger);}for(const player of view.players){
    body.append(element('h3',player.seat===view.seat?'Your zones':'CPU zones'),element('p',`${player.handCount??0} in hand · ${player.libraryCount} in library`));
    // Only the presentation adapter's current, evidence-authorized zone list is
    // inspectable here. Ownership, deck lists and past revelations grant nothing.
    for(const revealed of view.revealedZones||[]){
     if(revealed.seat!==player.seat||!['Hand','Library'].includes(revealed.zone)||revealed.zone==='Hand'&&player.seat===view.seat)continue;
     const rows=(revealed.cards||[]).map(id=>cardById.get(id)).filter(c=>c?.known===true&&c.zone===revealed.zone&&c.zoneHolder===player.seat&&c.zoneVisibility==='native-face-visible');
     if(!rows.length)continue;
     const count=Number.isSafeInteger(revealed.count)&&revealed.count>=rows.length?revealed.count:rows.length,hidden=count-rows.length;
     const section=element('details');section.dataset.revealedZone=revealed.zone;section.dataset.keepOpen=`revealed-${player.seat}-${revealed.zone}`;
     section.append(element('summary',`${revealed.zone==='Hand'?'Revealed hand':'Visible library cards'} · ${rows.length} visible / ${count} total`));
     section.append(element('p',hidden?`${hidden} ${hidden===1?'card remains':'cards remain'} hidden.`:'All current cards in this zone are visible.'));
     if(revealed.zone==='Library')section.append(element('p','Library order and position are not provided.'));
     for(const c of rows)section.append(button(c.name,()=>inspect(c.id),{key:`revealed-card-${c.id}`}));
     body.append(section);
    }
    for(const zone of ['Command','Graveyard','Exile']){const rows=view.cards.filter(c=>c.zone===zone&&c.owner===player.seat);const section=element('details');section.append(element('summary',`${zone==='Command'?'Command zone':zone} · ${rows.length}`));for(const c of rows)section.append(button(c.known?c.name:'Face down',()=>c.known&&inspect(c.id),{disabled:!c.known,key:`zone-card-${c.id}`}));body.append(section);}
   }zones.append(body);return zones;
  }
  // This surface receives only the public count, never card objects or IDs.
  function opponentHand(handCount){
   const count=Number.isSafeInteger(handCount)&&handCount>=0?handCount:null,section=element('section',undefined,'play-match-opponent-hand');
   const label=count===null?'CPU hand · count unavailable':`CPU hand · ${count} ${count===1?'card':'cards'}`;
   section.setAttribute('aria-label',label);section.append(element('span',label,'play-match-opponent-hand-count'));
   const fan=element('div',undefined,'play-match-opponent-fan');fan.setAttribute('aria-hidden','true');
   const shown=Math.min(count||0,10);section.dataset.compact=String(count>10);
   for(let i=0;i<shown;i++){const back=element('span',undefined,'play-match-card-back');back.style.setProperty('--back-angle',`${(i-(shown-1)/2)*2}deg`);fan.append(back);}
   section.append(fan);return section;
  }
  const opponent=view.players.find(p=>p.seat!==view.seat),you=view.players.find(p=>p.seat===view.seat),battlefields=element('div',undefined,'play-match-battlefields');battlefields.dataset.keepScroll='battlefields';if(!openingHand)table.append(opponentHand(opponent.handCount));
  for(const own of [false,true]){const area=element('div',undefined,'play-match-seat-area');area.dataset.seat=own?'you':'cpu';const field=zone(own?'Your battlefield':'CPU battlefield',view.cards.filter(c=>c.zone==='Battlefield'&&(c.controller===view.seat)===own));field.dataset.keepScroll=own?'your-battlefield':'cpu-battlefield';area.append(field);battlefields.append(area);}
  const handArea=element('div',undefined,'play-match-hand-area');handArea.append(zone('Your hand',view.hand.map(id=>cardById.get(id)).filter(Boolean),{hand:true}));table.append(battlefields,handArea,seatPanel(opponent,'CPU',false),seatPanel(you,profile.displayName||'You',true));if(!openingHand&&format==='Commander'){for(const own of [false,true]){const commandCards=view.cards.filter(c=>c.zone==='Command'&&(c.owner===view.seat)===own);if(!commandCards.length)continue;const area=element('section',undefined,'play-command-zone');area.dataset.seat=own?'you':'cpu';area.setAttribute('aria-label',own?'Your command zone':'CPU command zone');area.append(element('strong',own?'Your command zone':'CPU command zone'));const row=element('div');for(const c of commandCards)row.append(card(c));area.append(row);table.append(area);}}if(!openingHand||view.revealedZones?.length)header.append(zonesMenu());
  const stack=element('section',undefined,'play-match-stack');stack.dataset.placementZone='stack';stack.append(element('h2',`Stack · ${view.stack.length}`));for(const entry of view.stack)stack.append(element('p',cardById.get(entry.source)?.name||'Ability or spell'));if(!view.stack.length)stack.append(element('p','No spells or abilities waiting','play-match-stack-empty'));if(!openingHand)rail.append(stack);
  const matchContext=!openingHand?renderMatchContext():null;if(matchContext)rail.append(matchContext);
  const history=element('details');history.dataset.keepOpen='game-progress';history.append(element('summary','Game progress'));const entries=element('ol');for(const row of log.slice(-20))entries.append(element('li',row));history.append(entries);if(!openingHand)rail.append(history);
  if(status.outcomes?.length){const results=element('section',undefined,'play-match-random-results');results.setAttribute('aria-label','Recent rules results');results.append(element('strong','Recent rolls & flips'));const list=element('ol');for(const row of status.outcomes)list.append(element('li',randomOutcomeText(row,view.seat),row.outcome.kind==='ignored-die'?'play-match-ignored-roll':''));results.append(list);rail.append(results);}
  const selectedCard=!inspectorHidden&&cardById.get(selected)?.known?cardById.get(selected):null,inspectPanel=element('section',undefined,'play-match-card-inspector');inspectPanel.append(element('h2',selectedCard?.name||'Inspect a card'));
  main.dataset.details=String(!!selectedCard||detailsOpen||view.stack.length>0);
  if(selectedCard||detailsOpen)rail.prepend(button('Close inspector',closeInspector,{key:'close-inspector'}));
  if(selectedCard){const data=resolveCard(selectedCard),key=JSON.stringify([selectedCard.id,identity(selectedCard),data?.oracleText??null]);if(!inspectorContent||inspectorContent.key!==key){let art=null,oracle=null;if(data?.imageUrl){art=element('figure');const img=element('img');img.src=data.imageUrl;img.alt=selectedCard.name;art.append(img);decorateCard(art,selectedCard);}if(data?.oracleText)oracle=renderOracleText?renderOracleText(data.oracleText,selectedCard):element('p',data.oracleText);inspectorContent={key,art,oracle};}if(inspectorContent.art)inspectPanel.append(inspectorContent.art);inspectPanel.append(renderStats(selectedCard),element('p',(selectedCard.keywords||[]).join(' · ')));if(inspectorContent.oracle)inspectPanel.append(inspectorContent.oracle);decorateInspector(inspectPanel,selectedCard);}else inspectorContent=null;
  const selectedCues=selectedCard?cardActionCues(snapshot,selectedCard.id):[];
  if(selectedCard?.zone==='Hand'&&selectedCard.controller===view.seat&&!selectedCard.types?.includes('Land')&&view.decision.kind==='Priority'&&view.prioritySeat===view.seat&&selectedCues.some(cue=>cue.tone==='play'&&cue.label==='Cast')){for(const payment of ['auto','manual'])inspectPanel.append(button(payment==='auto'?'Cast · automatic mana':'Cast · manual mana',()=>session.cast(selectedCard.id,payment),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:`cast-${payment}-${selectedCard.id}`}));}
  for(const line of commanderDetailLines(view,selectedCard?.id))inspectPanel.append(element('p',line,'play-match-commander-fact'));
  if(selectedCues.length){const actions=element('div',undefined,'play-match-card-actions');actions.append(element('strong','Available actions'));for(const cue of selectedCues)actions.append(button(cue.text,()=>{if(cue.token)return session.choose(cue.token);advancedOpen=true;return session.select(cue.interactionId,cue.choiceId);},{blockWhileBusy:true,key:`inspect-action-${cue.token||cue.choiceId}`}));inspectPanel.insertBefore(actions,inspectPanel.children[1]||null);}
  if(!selectedCard)inspectPanel.append(element('p','Click a visible card to pin its details here.'));rail.insertBefore(inspectPanel,stack.nextSibling);
  if(menu!==null){const pop=element('div',undefined,'play-match-context');pop.setAttribute('role','menu');pop.append(button('Inspect card',()=>{menu=null;render(session.snapshot());},{key:'menu-inspect'}));for(const c of view.choices.filter(c=>c.sourceId===menu))pop.append(button(c.label,()=>session.choose(c.token),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED'}));pop.append(button('Close menu',()=>{menu=null;render(session.snapshot());root.querySelector(`[data-instance="${selected}"]`)?.focus();},{key:'menu-close'}));rail.append(pop);}
  main.append(table,rail);root.append(main);
  const footer=element('footer',undefined,'play-match-decisions');footer.setAttribute('aria-label','Match decisions');footer.dataset.keepScroll='decisions';
  const decisionHeading=element('div',undefined,'play-match-decision-heading'),decisionTitle=element('strong',activity.label);decisionHeading.append(decisionTitle);footer.append(decisionHeading);if(responseMode&&view.decision.kind==='Priority')footer.append(responseMode);if(cancelAutoPass)footer.append(cancelAutoPass);
  if(activity.actor==='you'&&view.decision.kind==='Priority'){const legend=element('p',undefined,'play-match-cue-legend');legend.setAttribute('aria-label','Card highlights');for(const [tone,label]of [['play','Play / Cast'],['ability','Ability'],['selected','Inspecting']]){const item=element('span',label);item.dataset.cue=tone;legend.append(item);}legend.append(element('span','Select a highlighted card for actions.'));const help=element('details');help.dataset.keepOpen='table-help';help.append(element('summary','Help'),legend);const modeHelp=responseMode?.querySelector('p');if(modeHelp)help.append(modeHelp);footer.append(help);}
  const timer=element('output',clock?.remainingSeconds!==null&&clock?.remainingSeconds!==undefined?`${clock.remainingSeconds}s to respond`:clock?.needsChoice?'Your choice is required':'');timer.className=clock?.warning?'play-match-warning':'';timer.setAttribute('aria-label','Response time');decisionHeading.append(timer);for(const label of ['Inactivity time','Turn time']){const limit=element('output');limit.setAttribute('aria-label',label);decisionHeading.append(limit);}updateClock(clock);
  const flowNote=turnFlowMessage(snapshot);if(flowNote)footer.append(element('p',flowNote,'play-turn-flow-note'));if(controlError){const note=element('p',controlError,'play-match-error');note.setAttribute('role','alert');footer.append(note);}
  if(error){const reason=element('p',error==='CHOICE_REJECTED'?'The move could not be completed. Review your choices and try again.':'This match has stopped. Return to Play to start a new match.','play-match-error');reason.setAttribute('role','alert');footer.append(reason);}
  if(status.terminal)footer.append(element('p',status.terminal.winner===null?'Draw':status.terminal.winner===view.seat?'You won':'CPU won'));
  const controls=element('div',undefined,'play-match-actions');footer.dataset.complex=String(view.interaction?.opportunities?.some(o=>['assignDamage','number','text','sequence'].includes(o.type))||false);
  if(!status.terminal){
   for(const choice of view.interaction?.opportunities?.some(o=>o.type==='relations')?[]:view.choices)controls.append(button(choice.kind==='PassPriority'?(view.stack.length?'Pass response':'Continue'):choice.label,()=>session.choose(choice.token),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:choice.token}));
   let interactionControls=controls;
   if(view.canAct&&view.interaction?.opportunities?.length&&!view.interaction.opportunities.some(o=>o.type==='relations')){const more=element('details',undefined,'play-match-other-actions');more.open=advancedOpen;const summary=element('summary','Abilities & other actions');summary.dataset.focusKey='other-actions-summary';more.append(summary);more.addEventListener('toggle',()=>{advancedOpen=more.open;});controls.append(more);interactionControls=more;}
   for(const o of view.interaction?.opportunities||[]){
    if(o.type==='assignDamage'){
     const group=element('fieldset',undefined,'play-damage-assignment');group.append(element('legend',`Assign ${o.total} combat damage`),element('p','Split all damage between the listed targets. The rules engine checks the assignment.'));
     const blocked=busy||!!error&&error!=='CHOICE_REJECTED',inputs=[];
     const mode=element('select');mode.setAttribute('aria-label','Damage assignment mode');mode.dataset.focusKey=`damage-mode-${o.interactionId}`;mode.disabled=blocked;
     for(const value of o.modes){const option=element('option',value==='normal'?'Normal damage':'As though unblocked');option.value=value;mode.append(option);}
     if(pending?.interactionId===o.interactionId)mode.value=pending.mode;
     if(o.modes.length>1){const label=element('label','Assignment mode');label.append(mode);group.append(label);}
     for(const c of o.choices.filter(c=>c.available)){
      const target=c.surfaces.map(s=>s.type==='player'?(s.seat===view.seat?'You':'CPU'):s.name||'Creature').join(' · '),label=element('label',target),input=element('input');input.type='number';input.min=String(c.min);input.max=String(c.max);input.step='1';input.disabled=blocked;input.setAttribute('aria-label','Damage to '+target);input.dataset.focusKey=`damage-${c.id}`;input.dataset.damageChoice=c.id;
      const old=pending?.interactionId===o.interactionId?pending.assignments.find(a=>a.choiceId===c.id):null;input.value=old?String(old.amount):'';label.append(input);group.append(label);inputs.push({choiceId:c.id,input});
     }
     const read=()=>inputs.map(({choiceId,input})=>({choiceId,amount:input.value===''?NaN:input.valueAsNumber}));
     const total=element('output');total.setAttribute('aria-label','Assigned combat damage');
     const confirm=button('Confirm damage',()=>{session.setDamage(o.interactionId,mode.value,read());return session.confirm();},{blockWhileBusy:true,disabled:true,key:`confirm-${o.interactionId}`});
     const update=()=>{const rows=read(),sum=rows.reduce((n,a)=>n+(Number.isFinite(a.amount)?a.amount:0),0);total.textContent=`${sum} of ${o.total} assigned`;confirm.disabled=blocked||!validDamageAssignments(o,mode.value,rows);};
     for(const {input}of inputs)input.addEventListener('input',update);mode.addEventListener('change',update);update();group.append(total,confirm);interactionControls.append(group);continue;
    }
    if(o.type==='relations'){
     const attacking=view.decision.kind==='DeclareAttackers',group=element('fieldset',undefined,'play-combat-choices');group.append(element('legend',attacking?'Choose attackers':'Choose blockers'));group.dataset.combatKind=attacking?'attack':'block';
     const draft=pending?.interactionId===o.interactionId?pending.relations:null,blocked=busy||!!error&&error!=='CHOICE_REJECTED',byId=new Map(o.choices.map(c=>[c.id,c]));
     const choiceName=id=>{const c=byId.get(id);return c?.surfaces.map(s=>s.type==='player'?(s.seat===view.seat?'You':'CPU'):s.type==='object'?`${s.name||'Card'}`:s.value||'').filter(Boolean).join(' · ')||'Card';};
     let confirmCombat;const bandKey=source=>o.interactionId+':'+source;
     const validBands=()=>!draft?.some(r=>bandDrafts.get(bandKey(r.sourceId))?.valid===false);const clearBands=()=>{for(const edge of o.edges)bandDrafts.delete(bandKey(edge.sourceId));};
     const rowsBox=element('div',undefined,'play-combat-rows');
     for(const edge of o.edges){
      const row=element('div',undefined,'play-combat-row');row.append(element('strong',choiceName(edge.sourceId)));
      const source=byId.get(edge.sourceId),reference=source?.surfaces.find(s=>s.type==='object')?.reference;
      if(reference&&view.cards.some(c=>c.known&&String(c.id)===reference)){row.dataset.combatCard=reference;row.append(button('Inspect',()=>inspect(Number(reference)),{key:`inspect-${edge.sourceId}`}));}
      for(const targetId of edge.targetIds){const chosen=draft?.some(r=>r.sourceId===edge.sourceId&&r.targetId===targetId);row.append(button((attacking?'Attack ':'Block ')+choiceName(targetId),()=>{combatSourceId=edge.sourceId;return session.toggleRelation(o.interactionId,edge.sourceId,targetId);},{key:`relation-${edge.sourceId}-${targetId}`,pressed:!!chosen,blockWhileBusy:true,disabled:blocked||!source?.available||!byId.get(targetId)?.available}));}
      if(o.allowGroups&&draft?.some(r=>r.sourceId===edge.sourceId)){
       const label=element('label','Band group (optional)'),input=element('input');input.type='number';input.min='0';input.max='4294967295';input.step='1';const key=bandKey(edge.sourceId),saved=bandDrafts.get(key);input.value=saved?saved.raw:String(draft.find(r=>r.sourceId===edge.sourceId).group??'');if(saved?.valid===false)input.setCustomValidity('Enter a whole group number or leave blank.');input.disabled=blocked;input.setAttribute('aria-label',`Band group for ${choiceName(edge.sourceId)}`);input.dataset.focusKey=`band-${edge.sourceId}`;
       input.addEventListener('input',()=>{const live=session.snapshot();if(live.busy||live.status?.revision!==status.revision)return;input.setCustomValidity('');const n=input.value===''?null:input.valueAsNumber,valid=!input.validity.badInput&&(n===null||Number.isInteger(n)&&n>=0&&n<=4294967295);input.setCustomValidity(valid?'':'Enter a whole group number or leave blank.');bandDrafts.set(key,{raw:input.value,value:n,valid});if(confirmCombat)confirmCombat.disabled=blocked||!draft||!validInteractionRelations(o,draft)||draft.length<o.min||!validBands();});label.append(input);row.append(label);
      }rowsBox.append(row);
     }
     const sourceCount=new Set((draft||[]).map(r=>r.sourceId)).size;group.append(element('p',draft?.length?`${sourceCount} ${attacking?'attacker':'blocker'}${sourceCount===1?'':'s'} ${attacking?'selected':'assigned'}`:attacking?'Select attackers, then their destination.':'Select a blocker, then an attacker.','play-match-private-draft'));
     const selectedPairs=(draft||[]).filter(r=>r.sourceId===combatSourceId),detail=element('p',selectedPairs.length?selectedPairs.map(r=>`${choiceName(r.sourceId)} ${attacking?'attacks':'blocks'} ${choiceName(r.targetId)}`).join(' · '):combatSourceId?`${choiceName(combatSourceId)} — choose ${attacking?'a destination':'an attacker'}`:'','play-match-pair-detail');detail.setAttribute('aria-live','polite');group.append(detail);
     if(selectedPairs.length&&!attacking){group.append(button('Change block',()=>{combatReplace=true;render(session.snapshot());},{key:'change-block',disabled:blocked}));if(combatReplace)detail.textContent=choiceName(combatSourceId)+' — choose a new attacker for this blocker';}
     const options=element('details',undefined,'play-combat-options');options.dataset.keepOpen='combat-options-'+o.interactionId;options.append(element('summary','Assignments & options'));
     if(draft?.length){const pairs=element('ol',undefined,'play-match-combat-pairs');for(const [i,r]of draft.entries()){const pair=element('li',`${choiceName(r.sourceId)} ${attacking?'attacks':'blocks'} ${choiceName(r.targetId)}`);pair.dataset.pair=String(i+1);pairs.append(pair);}options.append(pairs);options.append(button('Show all combat lines',()=>{showAllCombatLines=!showAllCombatLines;render(session.snapshot());},{key:'show-combat-lines',pressed:showAllCombatLines}));}
     confirmCombat=button(attacking?'Confirm attackers':'Confirm blocks',()=>{if(!validBands())return;for(const source of new Set(draft.map(r=>r.sourceId))){const band=bandDrafts.get(bandKey(source));if(band)session.setRelationGroup(o.interactionId,source,band.value);}return session.confirm();},{key:`confirm-${o.interactionId}`,blockWhileBusy:true,disabled:blocked||!draft||!validInteractionRelations(o,draft)||draft.length<o.min||!validBands()});group.append(confirmCombat);
     if(o.min===0)group.append(button(attacking?'Declare no attackers':'Declare no blockers',()=>{clearBands();session.selectNone(o.interactionId);},{key:`none-${o.interactionId}`,blockWhileBusy:true,disabled:blocked}));
     group.append(button(attacking?'Clear attackers':'Clear blocks',()=>{clearBands();combatSourceId=null;session.clearSelection();},{key:`clear-${o.interactionId}`,disabled:blocked}));options.append(rowsBox);group.append(options);interactionControls.append(group);continue;
    }
    if(o.type==='text'){
     const group=element('fieldset');group.append(element('legend','Name a card'));
     const input=element('input');input.type='text';input.autocomplete='off';input.setAttribute('aria-label','Card name');input.dataset.focusKey=`text-${o.interactionId}`;
     const blocked=busy||!!error&&error!=='CHOICE_REJECTED';input.disabled=blocked;
     input.value=pending?.interactionId===o.interactionId?pending.value:'';
     const confirm=button('Confirm card name',()=>{session.setText(o.interactionId,input.value);return session.confirm();},{blockWhileBusy:true,disabled:blocked||!validInteractionText(input.value,o.maxLen),key:`confirm-${o.interactionId}`});
     input.addEventListener('input',()=>{confirm.disabled=blocked||!validInteractionText(input.value,o.maxLen);});
     group.append(input,confirm);interactionControls.append(group);continue;
    }
    if(o.type==='number'){
     const group=element('fieldset');group.append(element('legend',`Choose a number · ${o.min}–${o.max}`));
     const input=element('input');input.type='number';input.min=String(o.min);input.max=String(o.max);input.step='1';input.setAttribute('aria-label','Chosen number');input.dataset.focusKey=`number-${o.interactionId}`;
     const blocked=busy||!!error&&error!=='CHOICE_REJECTED';input.disabled=blocked;
     input.value=pending?.interactionId===o.interactionId?String(pending.value):'';
     const confirm=button('Confirm number',()=>{session.setNumber(o.interactionId,input.valueAsNumber);return session.confirm();},{blockWhileBusy:true,disabled:blocked||input.value==='',key:`confirm-${o.interactionId}`});
     // Keep typing local so a render cannot steal the caret. Never default to zero.
     input.addEventListener('input',()=>{const n=input.valueAsNumber;confirm.disabled=blocked||input.value===''||!Number.isInteger(n)||n<o.min||n>o.max;});
     group.append(input,confirm);interactionControls.append(group);continue;
    }
    const group=element('fieldset');if(view.decision.kind==='TargetChoice')group.dataset.preview='true';if(!(o.commitOnSelect&&oneClickChoices))group.append(element('legend',o.type!=='choose'?`${o.type==='sequence'?'Choose in order':'Select'} ${o.min===o.max?o.min:o.min+'–'+o.max}`:'Choose one'));
    const selection=element('p',undefined,'play-match-choice-summary');selection.dataset.prompt=o.interactionId;
    const selectedChoices=pending?.interactionId===o.interactionId&&pending.revision===status.revision?(pending.choiceIds||[]).map(id=>o.choices.find(c=>c.id===id)).filter(Boolean):[];
    selection.textContent=selectedChoices.length?(view.decision.kind==='TargetChoice'?'Target: ':'')+selectedChoices.map(c=>actionText(c,view.decision.kind)).join('; '):view.decision.kind==='TargetChoice'?'Select a highlighted target':'Choose an option';if(!(o.commitOnSelect&&oneClickChoices))group.append(selection);
    const options=element('div',undefined,'play-match-choice-options');if(o.prompt)group.append(element('p',o.prompt));if(o.choices.some(c=>c.available&&c.presentationUnavailable))group.append(element('p','The engine did not provide enough information to describe this decision. This choice cannot be submitted safely.'));
    for(const c of o.choices){const option=button(actionText(c,view.decision.kind),()=>{session.select(o.interactionId,c.id);if(o.commitOnSelect&&oneClickChoices)return session.confirm();},{key:c.id,blockWhileBusy:true,disabled:busy||!c.available||c.presentationUnavailable||!!error&&error!=='CHOICE_REJECTED'||o.type==='sequence'&&o.max!==1&&pending?.interactionId===o.interactionId&&(pending.choiceIds.length>=o.max||o.unique&&pending.choiceIds.includes(c.id)),pressed:pending?.interactionId===o.interactionId&&pending.choiceIds.includes(c.id)});const refs=c.surfaces.filter(s=>s.type==='object'),source=refs.length===1?view.cards.find(card=>card.known&&String(card.id)===refs[0].reference):null,art=source?resolveCard(source)?.artImageUrl:null;if(art){const img=element('img');img.src=art;img.alt='';option.prepend(img);}if(c.consequence)option.append(element('small',c.consequence));options.append(option);}
    if(o.type==='sequence'&&pending?.interactionId===o.interactionId){
     const order=element('ol');order.setAttribute('aria-label','Chosen order');
     pending.choiceIds.forEach((id,index)=>{const row=element('li',actionText(o.choices.find(c=>c.id===id))),blocked=busy||!!error&&error!=='CHOICE_REJECTED';
      for(const [direction,label,edge]of [['earlier','Move earlier',index===0],['later','Move later',index===pending.choiceIds.length-1],['remove','Remove',false]])row.append(button(label,()=>session.editSequence(o.interactionId,index,direction),{key:`sequence-${o.interactionId}-${index}-${direction}`,disabled:blocked||edge}));order.append(row);
     });group.append(order);
    }
    const count=pending?.interactionId===o.interactionId?pending.choiceIds.length:0;
    if(!(o.commitOnSelect&&oneClickChoices))group.append(button(view.decision.kind==='TargetChoice'?'Confirm target':'Confirm choice',()=>session.confirm(),{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED'||count<o.min||count>o.max||pending?.interactionId!==o.interactionId,key:`confirm-${o.interactionId}`}));
    if(o.min===0)group.append(button('Select none',()=>session.selectNone(o.interactionId),{blockWhileBusy:true,disabled:busy,key:`none-${o.interactionId}`}));
    if(!(o.commitOnSelect&&oneClickChoices))group.append(button(view.decision.kind==='TargetChoice'?'Cancel':'Clear selection',()=>session.clearSelection(),{blockWhileBusy:true,disabled:busy,key:`clear-${o.interactionId}`}));
    const boardOptions=o.choices.length>0&&o.choices.every(c=>c.surfaces.length===1&&c.surfaces[0].type==='object'&&view.cards.some(card=>card.known&&String(card.id)===c.surfaces[0].reference&&['Battlefield','Hand'].includes(card.zone)));
    if(boardOptions){group.classList.add('play-match-board-choice');const list=element('details',undefined,'play-match-choice-list');list.dataset.keepOpen='choice-list-'+o.interactionId;list.append(element('summary',`Choose from list · ${o.choices.length}`),options);group.append(list);}else group.append(options);interactionControls.append(group);
   }
   if(view.awaitingHuman&&!view.canAct&&!view.interaction?.canSubmit)controls.append(element('p','This decision is not supported by these controls yet. Exit this match and report the card or effect.'));
   else if(!view.canAct&&!view.interaction?.canSubmit)controls.append(element('p',busy?'CPU is choosing…':'Waiting for the next decision.'));
  }
  footer.append(controls);if(openingHand){footer.append(element('p','Keep starts with these cards. Mulligan draws a replacement hand; follow the next prompt for any cards you must put back.','play-match-mulligan-help'));table.append(footer);}else root.append(footer);boardLinks=draftBoardLinks(snapshot);linkLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');linkLayer.classList.add('play-match-draft-lines');linkLayer.setAttribute('aria-hidden','true');root.append(linkLayer);queueMicrotask(drawDraftLinks);for(const id of cardNodes.keys())if(!usedCardIds.has(id))cardNodes.delete(id);
  updateClock(clock);
  if(exitOpen){const dialog=element('dialog',undefined,'play-match-exit');dialog.setAttribute('aria-labelledby','practiceExitTitle');dialog.append(element('h2','Concede this Practice match?'));dialog.firstChild.id='practiceExitTitle';dialog.append(element('p','Confirming ends this match as a loss. Keeping the table open changes nothing.'));dialog.append(button('Keep playing',()=>{exitOpen=false;render(session.snapshot());root.querySelector('[data-focus-key="exit-match"]')?.focus();},{key:'cancel-exit'}));dialog.append(button('Concede and return',async()=>{await session.concede();const s=session.snapshot();if(s.status?.terminal){exitOpen=false;onExit();}},{blockWhileBusy:true,disabled:busy||!!error&&error!=='CHOICE_REJECTED',key:'confirm-exit'}));dialog.addEventListener('cancel',e=>{e.preventDefault();exitOpen=false;render(session.snapshot());root.querySelector('[data-focus-key="exit-match"]')?.focus();});root.append(dialog);queueMicrotask(()=>{if(dialog.isConnected){dialog.showModal();dialog.querySelector('button')?.focus();}});}
  for(const [key,open]of disclosures){const n=[...root.querySelectorAll('details[data-keep-open]')].find(n=>n.dataset.keepOpen===key);if(n)n.open=open;}
  for(const [key,top,left]of scrolls){const n=[...root.querySelectorAll('[data-keep-scroll]')].find(n=>n.dataset.keepScroll===key);if(n){n.scrollTop=top;n.scrollLeft=left;}}
  if(focused)root.querySelectorAll('[data-focus-key]').forEach(n=>{if(n.dataset.focusKey===focused&&!n.disabled)n.focus({preventScroll:true});});
 }
 function drawDraftLinks(){
  if(!linkLayer?.isConnected)return;linkLayer.replaceChildren();const bounds=root.getBoundingClientRect();linkLayer.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
  const anchor=point=>point.prompt?[...root.querySelectorAll('[data-prompt]')].find(n=>n.dataset.prompt===point.prompt):root.querySelector(point.id?`[data-instance="${point.id}"]`:`[data-player-seat="${point.seat}"]`);
  const center=node=>{if(!node)return null;const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!r.width||!r.height||x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;for(let p=node.parentElement;p&&p!==root;p=p.parentElement){const css=getComputedStyle(p);if(/auto|scroll|hidden/.test(css.overflow+css.overflowX+css.overflowY)){const b=p.getBoundingClientRect();if(x<b.left||x>b.right||y<b.top||y>b.bottom)return null;}}return {x:x-bounds.left,y:y-bounds.top};};
  const offsets=new Map();
  for(const [index,link]of boardLinks.entries()){
   const from=anchor(link.from),to=anchor(link.to),a=center(from),b=center(to);if(!a||!b)continue;if(!link.from.prompt&&from&&to){const ar=from.getBoundingClientRect(),br=to.getBoundingClientRect();a.y+=(b.y>a.y?1:-1)*(ar.height/2-10);b.y+=(a.y>b.y?1:-1)*(br.height/2-10);}
   const group=document.createElementNS(linkLayer.namespaceURI,'g'),combat=!link.from.prompt;
   if(combat){group.dataset.combatPair=String(index+1);group.dataset.muted=String(!showAllCombatLines&&(focusedCombatCard!==null?link.from.id!==focusedCombatCard&&link.to.id!==focusedCombatCard:index!==0));}
   const path=document.createElementNS(linkLayer.namespaceURI,'path');path.setAttribute('d',`M ${a.x} ${a.y} Q ${(a.x+b.x)/2+40} ${(a.y+b.y)/2} ${b.x} ${b.y}`);group.append(path);
   for(const [point,location]of combat?[[link.from,a],[link.to,b]]:[[link.to,b]]){
    const key=JSON.stringify(point),offset=offsets.get(key)||0;offsets.set(key,offset+1);
    const x=location.x+(combat?offset*24:0),y=location.y,dot=document.createElementNS(linkLayer.namespaceURI,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r',combat?'11':'6');group.append(dot);
    if(combat){const number=document.createElementNS(linkLayer.namespaceURI,'text');number.setAttribute('x',x);number.setAttribute('y',y);number.textContent=String(index+1);group.append(number);}
   }linkLayer.append(group);
  }
 }
 const focusCombat=e=>{const node=e.target.closest?.('[data-instance],[data-combat-card]'),id=node?Number(node.dataset.instance||node.dataset.combatCard):null;if(node&&boardLinks.some(l=>!l.from.prompt&&(l.from.id===id||l.to.id===id)))focusedCombatCard=id;drawDraftLinks();};
 root.addEventListener('pointerover',focusCombat);root.addEventListener('focusin',focusCombat);
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(drawDraftLinks):null;resize?.observe(root);root.addEventListener('scroll',drawDraftLinks,true);
 const keydown=e=>{
  if(e.key!=='Escape'||exitOpen)return;
  if(menu!==null){e.preventDefault();e.stopPropagation();menu=null;render(session.snapshot());restoreInspectorFocus();return;}
  const disclosure=e.target.closest?.('details[open]');
  if(disclosure&&root.contains(disclosure)){e.preventDefault();e.stopPropagation();disclosure.open=false;disclosure.querySelector('summary')?.focus();return;}
  if(e.target.closest?.('.play-match-inspector')&&(!inspectorHidden||detailsOpen)){e.preventDefault();e.stopPropagation();closeInspector();}
 };
 root.addEventListener('keydown',keydown);
 return {render,requestExit(){if(!allowConcede||session.snapshot().status?.terminal)return onExit();exitOpen=true;render(session.snapshot());},destroy(){placement.destroy();disposeEffects();resize?.disconnect();root.removeEventListener('scroll',drawDraftLinks,true);root.removeEventListener('pointerover',focusCombat);root.removeEventListener('focusin',focusCombat);clearPresentationCaches();root.removeEventListener('keydown',keydown);root.replaceChildren();}};
}
