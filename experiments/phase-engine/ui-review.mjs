// Synthetic presentation fixture. No rules-engine, provider or account certification.
import {mountMatchTable} from './match-table.mjs';
import {practiceArtworkHooks} from '../../play-card-surface.js';
const params=new URLSearchParams(location.search),scenario=params.get('case')||'opening';
document.documentElement.dataset.theme=params.get('theme')||'dark';
const catalog=await fetch('./ui-review-catalog.json').then(r=>r.json()),byName=new Map(catalog.map(c=>[c.name,c]));
const make=(id,name,zone,controller=0)=>{const c=byName.get(name);return {id,known:true,name,zone,owner:controller,controller,types:c.type_line.includes('Land')?['Land']:['Creature'],power:Number(c.power)||null,toughness:Number(c.toughness)||null,basePower:Number(c.power)||null,baseToughness:Number(c.toughness)||null,damage:0,counters:{},keywords:c.keywords||[],printing:{name,playArtwork:{card:c,finish:'nonfoil',badges:[]}}};};
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
if(scenario==='mulligan'){v.decision.kind='MulliganDecision';v.choices=[{token:'keep',kind:'MulliganDecision',label:'Keep hand'},{token:'mulligan',kind:'MulliganDecision',label:'Take a mulligan'}];}
if(scenario==='payment'||scenario==='damage')v.interaction.canSubmit=true;
const state={status:{revision:1,surface:v,terminal:null},selected:6,pending:null,busy:false,error:scenario==='payment'?'CHOICE_REJECTED':null,clock:{remainingSeconds:24,limits:{idleSeconds:80,turnSeconds:240}}},calls=[];
let table;const repaint=()=>table.render(state),session={snapshot:()=>state,inspect(id){state.selected=id;repaint();},choose(token){calls.push(['choose',token]);state.status.revision++;repaint();},cast(id,payment){calls.push(['cast',id,payment]);},select(interactionId,id){state.pending={interactionId,choiceIds:[id]};repaint();},confirm(){calls.push(['confirm',state.pending]);},clearSelection(){state.pending=null;repaint();},setDamage(interactionId,mode,assignments){state.pending={interactionId,mode,assignments};},concede(){calls.push(['concede']);state.status.terminal={winner:1};repaint();}};
table=mountMatchTable(document.getElementById('table'),{session,profile:{displayName:'Randall'},title:'CardStashy · Magic Practice · Beta',allowConcede:true,...practiceArtworkHooks(),renderMatchContext(){const box=document.createElement('section');box.innerHTML='<p>Keep this page open. Refreshing or leaving ends this Practice session; it cannot be resumed.</p><details data-keep-open="deck-context"><summary>Deck Power & Commander brackets</summary><p>Existing deck context remains here.</p></details>';return box;}});repaint();
const report=()=>{
 const q=s=>document.querySelector(s),rect=s=>{const r=q(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const mat=rect('.play-match-mat'),rail=rect('.play-match-inspector'),hand=rect('.play-match-hand'),footer=rect('.play-match-decisions'),battle=rect('.play-match-battlefields');
 const reflow=innerWidth<=760||innerHeight<=540;const checks={pageContained:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,columnsSeparate:reflow?mat.bottom<=rail.y:mat.right<=rail.x,actionsVisible:footer.bottom<=innerHeight+1,handPinned:hand.bottom<=mat.bottom+1&&battle.bottom<=hand.y+1,boardUsable:battle.height>120,railBounded:reflow?rail.width<=innerWidth:rail.width>=230&&rail.width<=362,handCardsLarger:q('.play-match-hand .play-match-card').getBoundingClientRect().width>=q('.play-match-battlefields .play-match-card').getBoundingClientRect().width,uniqueInstances:new Set([...document.querySelectorAll('[data-instance]')].map(n=>n.dataset.instance)).size===document.querySelectorAll('[data-instance]').length,phaseCorrect:scenario==='mulligan'?!q('[aria-current=step]'):q('[aria-current=step]')?.textContent==='Main 2',noPrivateLeak:!document.getElementById('table').textContent.includes('PRIVATE_CANARY'),bothSeatsVisible:reflow||[...document.querySelectorAll('.play-match-seat')].every(n=>n.getBoundingClientRect().top>=battle.y&&n.getBoundingClientRect().bottom<=battle.bottom),buttonsTouchable:[...document.querySelectorAll('.play-match-actions button')].every(n=>n.getBoundingClientRect().height>=44)};
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
