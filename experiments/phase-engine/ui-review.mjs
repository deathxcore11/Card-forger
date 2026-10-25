// Synthetic presentation fixture. No rules-engine, provider or account certification.
import {mountMatchTable} from './match-table.mjs';
import {practiceArtworkHooks} from '../../play-card-surface.js';
import {profileAvatar} from '../../profile-art.js';
const params=new URLSearchParams(location.search),scenario=params.get('case')||'opening';
document.documentElement.dataset.theme=params.get('theme')||'dark';
const catalog=await fetch('./ui-review-catalog.json').then(r=>r.json()),byName=new Map(catalog.map(c=>[c.name,c]));
const make=(id,name,zone,controller=0)=>{const c=byName.get(name);return {id,known:true,name,zone,owner:controller,controller,types:['Creature','Land','Artifact','Enchantment','Planeswalker','Battle'].filter(t=>c.type_line.includes(t)),power:Number(c.power)||null,toughness:Number(c.toughness)||null,basePower:Number(c.power)||null,baseToughness:Number(c.toughness)||null,damage:0,counters:{},keywords:c.keywords||[],printing:{name,playArtwork:{card:c,finish:'nonfoil',badges:[]}}};};
let cards=[make(1,'Forest','Battlefield'),make(2,'Ordinary Bear','Hand'),make(3,'Forest','Hand'),make(4,'Scarecrow Guide','Hand'),make(5,'Forest','Hand'),make(6,'Ghalta, Primal Hunger','Hand'),make(7,'Virulent Emissary','Hand')];cards[0].tapped=true;
if(scenario!=='opening'&&scenario!=='payment'){
 cards.push(make(8,'Ordinary Bear','Battlefield'),make(9,'Llanowar Elves','Battlefield'),make(10,'Forest','Battlefield',1),make(11,'Bear Cub','Battlefield',1));
 cards[7].power=6;cards[7].toughness=7;cards[7].counters={'+1/+1':2};cards[7].damage=1;
}
if(scenario==='crowded')for(let i=12;i<48;i++)cards.push(make(i,i%3?'Ordinary Bear':'Forest',i<40?'Battlefield':'Hand',i<26?1:0));
if(scenario==='hidden')cards.push({id:80,known:false,zone:'Battlefield',owner:1,controller:1,name:'PRIVATE_CANARY',types:['Creature'],printing:{playArtwork:{card:byName.get('Ghalta, Primal Hunger')}}});
const v={seat:0,turn:scenario==='opening'?1:6,phase:'PostCombatMain',decision:{kind:scenario==='payment'?'ManaPayment':'Priority'},players:[{seat:0,life:20,libraryCount:53,handCount:cards.filter(c=>c.zone==='Hand').length,graveyard:[]},{seat:1,life:20,handCount:7,libraryCount:53,graveyard:[]}],cards,hand:cards.filter(c=>c.zone==='Hand').map(c=>c.id),stack:[],choices:scenario==='payment'?[]:[{token:'pass',label:'Pass priority',kind:'PassPriority'},{token:'land-3',label:'Play Forest',kind:'PlayLand',sourceId:3}],prioritySeat:0,activeSeat:0,canAct:scenario!=='payment',awaitingHuman:true,interaction:{canSubmit:false,opportunities:[]}};
if(scenario==='payment')v.interaction.opportunities=[{interactionId:'mana',type:'choose',min:1,max:1,choices:[{id:'pay',available:true,surfaces:[{type:'action',code:'passPriority'}]},{id:'cancel',available:true,surfaces:[{type:'action',code:'cancelCast'}]}]}];
if(scenario==='damage'){
 v.decision.kind='AssignCombatDamage';v.choices=[];v.canAct=false;v.interaction.opportunities=[{interactionId:'damage',type:'assignDamage',total:12,modes:['normal'],choices:[{id:'creature',available:true,min:0,max:12,surfaces:[{type:'object',name:'Bear Cub',reference:'11'}]},{id:'player',available:true,min:0,max:12,surfaces:[{type:'player',seat:1}]}]}];
}
if(scenario==='actions'){
 v.interaction={canSubmit:true,opportunities:[{interactionId:'abilities',type:'choose',min:1,max:1,choices:[{id:'mana-9',available:true,surfaces:[{type:'object',reference:'9',name:'Llanowar Elves'},{type:'action',code:'activateAbility'}]},{id:'cast-2',available:true,surfaces:[{type:'object',reference:'2',name:'Ordinary Bear'},{type:'action',code:'castSpell'}]}]}]};
}
if(scenario==='response'){v.activeSeat=1;v.stack=[{id:100,source:11,controller:1}];}
if(scenario==='target'){v.decision.kind='TargetChoice';v.activeSeat=1;v.canAct=false;v.choices=[];v.interaction={canSubmit:true,opportunities:[{interactionId:'target',type:'choose',min:1,max:1,choices:[{id:'target-8',available:true,surfaces:[{type:'object',reference:'8',name:'Ordinary Bear'}]},{id:'target-11',available:true,surfaces:[{type:'object',reference:'11',name:'Bear Cub'}]}]}]};}
if(scenario==='combat'){v.phase='DeclareAttackers';v.decision.kind='DeclareAttackers';v.canAct=false;v.choices=[];v.interaction={canSubmit:true,opportunities:[{interactionId:'combat',type:'relations',min:0,max:2,sourceConstraint:'atMostOne',allowGroups:false,edges:[{sourceId:'a8',targetIds:['cpu']},{sourceId:'a9',targetIds:['cpu']}],choices:[{id:'a8',available:true,surfaces:[{type:'object',reference:'8',name:'Ordinary Bear'}]},{id:'a9',available:true,surfaces:[{type:'object',reference:'9',name:'Llanowar Elves'}]},{id:'cpu',available:true,surfaces:[{type:'player',seat:1}]}]}]};}
if(scenario==='mulligan'){const extra=make(91,'Forest','Hand');v.cards.push(extra);v.hand.push(extra.id);v.players[0].handCount=v.hand.length;v.decision.kind='MulliganDecision';v.choices=[{token:'keep',kind:'MulliganDecision',label:'Keep hand'},{token:'mulligan',kind:'MulliganDecision',label:'Take a mulligan'}];}
if(scenario==='payment'||scenario==='damage')v.interaction.canSubmit=true;
const state={status:{revision:1,surface:v,terminal:null},selected:scenario==='mulligan'||scenario==='target'||scenario==='combat'||scenario==='response'?null:6,pending:null,busy:false,error:scenario==='payment'?'CHOICE_REJECTED':null,clock:{remainingSeconds:24,limits:{idleSeconds:80,turnSeconds:240}}},calls=[];
let table;const repaint=()=>table.render(state),session={snapshot:()=>state,inspect(id){state.selected=id;repaint();},choose(token){calls.push(['choose',token]);state.status.revision++;if(token==='keep'){v.decision.kind='Priority';v.phase='PreCombatMain';v.choices=[{token:'pass',kind:'PassPriority',label:'Pass priority'}];}repaint();},cast(id,payment){calls.push(['cast',id,payment]);},select(interactionId,id){state.pending={interactionId,choiceIds:[id],revision:state.status.revision};repaint();},toggleRelation(interactionId,sourceId,targetId){const old=state.pending?.relations||[],has=old.some(r=>r.sourceId===sourceId&&r.targetId===targetId);state.pending={interactionId,type:'relations',relations:has?old.filter(r=>r.sourceId!==sourceId):[...old,{sourceId,targetId,group:null}],revision:state.status.revision};repaint();},selectNone(interactionId){state.pending={interactionId,type:'relations',relations:[],revision:state.status.revision};repaint();},confirm(){calls.push(['confirm',structuredClone(state.pending)]);state.busy=true;repaint();},clearSelection(){state.pending=null;repaint();},setDamage(interactionId,mode,assignments){state.pending={interactionId,mode,assignments};},concede(){calls.push(['concede']);state.status.terminal={winner:1};repaint();}};
table=mountMatchTable(document.getElementById('table'),{session,profile:{displayName:'Randall'},renderPlayerPortrait(own){const node=document.createElement('span'),c=byName.get(own?'Ghalta, Primal Hunger':'Bear Cub');node.innerHTML=profileAvatar(null,{display_name:own?'Randall':'CPU'});return node;},renderPlayerBackdrop(own){const img=document.createElement('img');img.src=byName.get(own?'Ghalta, Primal Hunger':'Bear Cub').image_uris.art_crop;img.alt='';return img;},renderMatchBackdrop(){const node=document.createElement('div');for(const name of ['Ghalta, Primal Hunger','Bear Cub']){const img=document.createElement('img');img.src=byName.get(name).image_uris.art_crop;img.alt='';node.append(img);}return node;},title:'CardStashy · Magic Practice · Beta',allowConcede:true,...practiceArtworkHooks(),renderMatchContext(){const box=document.createElement('section');box.innerHTML='<p>Keep this page open. Refreshing or leaving ends this Practice session; it cannot be resumed.</p><details data-keep-open="deck-context"><summary>Deck Power & Commander brackets</summary><p>Existing deck context remains here.</p></details>';return box;}});repaint();
const report=()=>{
 const q=s=>document.querySelector(s),rect=s=>{const r=q(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const mat=rect('.play-match-mat'),rail=rect('.play-match-inspector'),hand=rect('.play-match-hand'),footer=rect('.play-match-decisions'),battle=rect('.play-match-battlefields');
 const reflow=innerWidth<=900||innerHeight<=619,opening=scenario==='mulligan',hasRail=q('.play-match-main').dataset.details==='true';
 const checks={pageContained:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,columnsSeparate:!hasRail||(reflow?mat.bottom<=rail.y+1:mat.right<=rail.x+1),actionsVisible:footer.bottom<=innerHeight+1,handPinned:reflow||hand.bottom<=mat.bottom+1,boardUsable:opening||battle.height>100,railBounded:!hasRail||(reflow?rail.width<=innerWidth:rail.width>=230&&rail.width<=362),handIsFullFace:q('.play-match-hand .play-match-card').dataset.presentation==='card',battlefieldIsCrop:[...document.querySelectorAll('.play-match-battlefields [data-instance]')].every(n=>n.dataset.presentation==='battlefield'),uniqueInstances:new Set([...document.querySelectorAll('[data-instance]')].map(n=>n.dataset.instance)).size===document.querySelectorAll('[data-instance]').length,phaseCorrect:!q('.play-match-phases')&&(opening?!q('.play-match-seat[data-active=true]'):q('.play-match-seat[data-active=true] .play-match-seat-phase')?.textContent.includes(scenario==='combat'?'Combat · Attackers':'Second main phase')),noPrivateLeak:!document.getElementById('table').textContent.includes('PRIVATE_CANARY'),bothSeatsVisible:opening||reflow||[...document.querySelectorAll('.play-match-seat')].every(n=>n.getBoundingClientRect().top>=mat.y&&n.getBoundingClientRect().bottom<=mat.bottom),buttonsTouchable:[...document.querySelectorAll('.play-match-actions button')].filter(n=>n.getBoundingClientRect().height).every(n=>n.getBoundingClientRect().height>=44)};
 return {scenario,width:innerWidth,height:innerHeight,checks,passed:Object.values(checks).every(Boolean),geometry:{mat,rail,hand,footer,battle},calls};
};
window.runLayoutReview=report;
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data==='measure'){parent.postMessage(report(),location.origin);}if(e.data==='regression'){
 const first=document.querySelector('.play-match-hand .play-match-card'),id=first.dataset.instance;first.click();const selected=document.querySelector(`[data-instance="${id}"]`),clockBefore=document.querySelector('.play-match-hand .play-match-card');state.clock.remainingSeconds=9;state.clock.warning=true;repaint();
 const checks={inspectSelected:selected.getAttribute('aria-pressed')==='true',clockPreservesCard:clockBefore===document.querySelector('.play-match-hand .play-match-card'),clockUpdated:document.querySelector('[aria-label="Response time"]').textContent.includes('9s'),inspectHasCurrentStats:!!document.querySelector('.play-match-card-inspector .play-current-stats')};
 if(scenario==='opening'){document.querySelector('[data-focus-key="pass"]').click();checks.commandOnce=calls.filter(c=>c[0]==='choose'&&c[1]==='pass').length===1;}
 parent.postMessage({scenario,kind:'interaction',checks,passed:Object.values(checks).every(Boolean)},location.origin);
 }});
document.getElementById('testResult').textContent='Ready';parent.postMessage({ready:true,scenario},location.origin);

window.runInteractionReview=()=>{
 const first=document.querySelector('.play-match-hand .play-match-card'),id=first.dataset.instance;first.click();const selected=document.querySelector(`[data-instance="${id}"]`),clockBefore=document.querySelector('.play-match-hand .play-match-card');state.clock.remainingSeconds=9;state.clock.warning=true;repaint();
 const checks={inspectSelected:selected.getAttribute('aria-pressed')==='true',clockPreservesCard:clockBefore===document.querySelector('.play-match-hand .play-match-card'),clockUpdated:document.querySelector('[aria-label="Response time"]').textContent.includes('9s'),inspectHasCurrentStats:!!document.querySelector('.play-match-card-inspector .play-current-stats')};
 if(scenario==='opening'){document.querySelector('[data-focus-key="pass"]').click();checks.commandOnce=calls.filter(c=>c[0]==='choose'&&c[1]==='pass').length===1;}
 return {scenario,kind:'interaction',checks,passed:Object.values(checks).every(Boolean)};
};

// These assertions exercise production DOM handlers against a controlled session.
// They prove UI intent and rendering, never engine legality or a complete match.
window.runDecisionReview=async()=>{
 const checks={},q=s=>document.querySelector(s),click=key=>q(`[data-focus-key="${key}"]`).click(),paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 if(scenario==='actions'){
  v.choices.push({token:'cast-drag-2',kind:'CastSpell',sourceId:2,label:'Cast Ordinary Bear'});state.selected=null;repaint();await paint();
  checks.emptyStackStartsCompact=q('.play-match-main').dataset.details==='false'&&!q('.play-match-cast-drop').getBoundingClientRect().width;
  const source=q('[data-instance="2"]'),r=source.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
  source.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,button:0,isPrimary:true,clientX:x,clientY:y}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,isPrimary:true,clientX:x+20,clientY:y-30}));await paint();
  const drop=q('.play-match-cast-drop'),b=drop.getBoundingClientRect(),dx=b.x+b.width/2,dy=b.y+b.height/2;
  checks.emptyStackDropIsReachable=b.width>0&&document.elementFromPoint(dx,dy)?.closest('[data-placement-zone]')===drop;
  checks.dragIsPrivate=calls.length===0;
  document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,isPrimary:true,clientX:dx,clientY:dy}));await paint();
  checks.dropSubmitsOfferedTokenOnce=calls.length===1&&calls[0][1]==='cast-drag-2';checks.dropSurfaceRetires=!q('.play-match-cast-drop').getBoundingClientRect().width;
 }else if(scenario==='damage'){
  checks.damageTotalVisible=q('legend').getBoundingClientRect().height>0&&q('legend').textContent.includes('12');
  checks.remainingClocksVisible=['Inactivity time','Turn time'].every(label=>q('[aria-label="'+label+'"]').getBoundingClientRect().height>0);
 }else if(scenario==='target'){
  q('[data-instance="8"]').click();await paint();
  checks.selectionIsPrivate=calls.length===0&&state.pending?.choiceIds[0]==='target-8';
  checks.targetHasPreview=q('.play-match-choice-summary').textContent.includes('Ordinary Bear')&&q('[data-instance="8"]').dataset.draftSelected==='true'&&!!q('.play-match-draft-lines path');
  await new Promise(resolve=>setTimeout(resolve,850));click('inspect-card-8');checks.localSelectionDoesNotReplayTurnBanner=!q('.play-match-turn-banner');checks.inspectionPreservesDraft=state.pending?.choiceIds[0]==='target-8'&&calls.length===0;
  click('close-inspector');checks.inspectorCloses=q('.play-match-main').dataset.details==='false';
  click('clear-target');await paint();checks.clearDoesNotSubmit=state.pending===null&&calls.length===0&&!q('.play-match-draft-lines path');
  q('[data-instance="11"]').click();const confirm=q('[data-focus-key="confirm-target"]');confirm.click();confirm.click();
  checks.confirmOnce=calls.length===1&&calls[0][0]==='confirm'&&calls[0][1].choiceIds[0]==='target-11';
  state.busy=false;state.pending=null;state.status.revision++;repaint();await paint();checks.acceptedRevisionClearsDraft=!q('[data-draft-selected="true"]')&&!q('.play-match-draft-lines path');
 }else if(scenario==='combat'){
  click('relation-a8-cpu');click('relation-a9-cpu');await paint();
  checks.assignmentIsPrivate=calls.length===0&&state.pending?.relations.length===2;
  checks.numberedPairs=q('.play-match-combat-pairs').children.length===2&&document.querySelectorAll('[data-combat-pair]').length===2&&document.querySelectorAll('.play-match-draft-lines text').length===4;
  q('[data-instance="8"]').focus();checks.focusSeparatesPair=document.querySelectorAll('[data-combat-pair][data-muted="true"]').length===1;
  q('.play-combat-options').open=true;click('show-combat-lines');await paint();checks.overviewShowsPairs=document.querySelectorAll('[data-combat-pair][data-muted="true"]').length===0;
  click('clear-combat');await paint();checks.clearAssignments=calls.length===0&&!q('.play-match-draft-lines path');
  click('none-combat');const confirm=q('[data-focus-key="confirm-combat"]');confirm.click();confirm.click();checks.confirmNoAttackersOnce=calls.length===1&&calls[0][1].relations.length===0;
 }else if(scenario==='mulligan'){
  checks.openingIsDistinct=q('#table').dataset.stage==='opening'&&q('.play-match-battlefields').getBoundingClientRect().height===0&&!q('[data-focus-key="table-details"]')&&q('.play-match-hand .play-match-zone-heading h2').textContent==='Your opening hand';
  const handCard=q('.play-match-hand [data-instance="2"]');handCard.click();checks.cardOnlyInspects=calls.length===0&&state.selected===2;
  click('close-inspector');q('.play-match-menu').open=true;click('exit-match');await paint();click('cancel-exit');checks.cancelExitKeepsOpening=calls.length===0&&q('#table').dataset.stage==='opening';
  click('keep');await paint();checks.keepTransitions=calls.length===1&&calls[0][1]==='keep'&&q('#table').dataset.stage==='match'&&!!q('.play-match-seat[data-active="true"]')&&q('.play-match-battlefields').getBoundingClientRect().height>0;
 }
 return {scenario,kind:'decision-flow',checks,passed:Object.keys(checks).length>0&&Object.values(checks).every(Boolean)};
};
