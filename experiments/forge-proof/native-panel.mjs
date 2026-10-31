import {optionLabel,optionCardId} from './forge-session.mjs';
const OPTION_METHODS=new Set(['getChoices','getAbilityToPlay','chooseSingleEntityForEffect','chooseEntitiesForEffect','showOptionDialog','order']);
const SEARCH_ZONES=new Set(['Library','Graveyard','Exile']);
// Only current engine-offered choices enter the picker. Do not enumerate a zone:
// a visible library can include cards which the current search cannot select.
const STOP_PHASES=[['UPKEEP','Upkeep'],['DRAW','Draw'],['MAIN1','First main'],['COMBAT_BEGIN','Start of combat'],['COMBAT_DECLARE_ATTACKERS','Attackers'],['COMBAT_DECLARE_BLOCKERS','Blockers'],['COMBAT_DAMAGE','Damage'],['MAIN2','Second main'],['END_OF_TURN','End step']];
// Three or more identical items in a row on the stack show as one line with a ×N badge.
// Display only: Forge still resolves each one, and nothing groups while a stack item is a pick.
function stackRuns(n){const picking=[...(n.selection?.targets||[]),...(n.selection?.actionable||[])].some(r=>r?.kind==='stack'),runs=[];
 for(const item of n.stack||[]){const last=runs.at(-1),same=last&&!picking&&last[0].text&&last[0].text===item.text&&last[0].activatingPlayer===item.activatingPlayer;if(same)last.push(item);else runs.push([item]);}
 return runs;}
export function nativeZoneSearch(snapshot){
 const n=snapshot?.native,p=n?.prompt,cards=snapshot?.status?.surface?.cards||[],byId=new Map(cards.map(c=>[c.id,c]));
 if(!n||n.failure||n.status==='finished'||snapshot.transportError)return null;
 if(p){
  if(nativePromptUnanswerable(p)||p.supported!==true||p.acknowledgeOnly===true||!['getChoices','chooseSingleEntityForEffect','chooseEntitiesForEffect'].includes(p.method)||!p.options?.length)return null;
  const choices=p.options.map(o=>{const value=o.value?.card||o.value,cardId=optionCardId(o.value),surface=byId.get(cardId),zone=value?.zone||surface?.zone;return {key:`option-${o.index}`,index:o.index,cardId,zone,card:surface?.known===true?surface:null,name:optionLabel(o.value),visible:cardId!==null,value};});
  if(!choices.every(c=>SEARCH_ZONES.has(c.zone))||!choices.some(c=>c.visible))return null;
  return {kind:'prompt',choices,zones:[...new Set(choices.map(c=>c.zone))],min:p.min,max:p.max};
 }
 // Actionable graveyard spells during priority are not a search. Mixed board /
 // player target choices stay on the table so the overlay cannot hide a target.
 if(!/^InputSelect/.test(n.inputType||''))return null;
 const refs=[...(n.selection?.cards||[]),...(n.selection?.targets||[])],unique=[...new Map(refs.map(r=>[`${r.kind}:${r.id}`,r])).values()];
 if(!unique.length||unique.some(r=>r.kind!=='card'))return null;
 const choices=unique.map(r=>{const card=byId.get(r.id);return {key:`ref-card-${r.id}`,cardId:r.id,zone:card?.zone,card:card?.known===true?card:null,name:card?.known===true?card.name:'Face-down card',visible:card?.known===true};});
 if(!choices.every(c=>SEARCH_ZONES.has(c.zone))||!choices.some(c=>c.visible))return null;
 return {kind:'selection',choices,zones:[...new Set(choices.map(c=>c.zone))],min:n.selection?.min,max:n.selection?.max};
}
function searchImage(card){
 if(card?.known!==true)return null;
 const art=card.printing?.playArtwork?.card,face=art?.card_faces?.find(f=>f.name===card.name)||art?.card_faces?.[0];
 const url=art?.image_uris?.normal||art?.image_uris?.large||face?.image_uris?.normal||face?.image_uris?.large;
 // Artwork is catalog metadata, not executable HTML or an engine identity.
 return typeof url==='string'&&(/^https?:\/\//i.test(url)||/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url))?url:null;
}
// "Kicker 2 G" → "Kicker": the keyword before the cost.
const costName=value=>String(optionLabel(value)).match(/^[A-Za-z][A-Za-z' -]*?(?=\s*(?:[:{\d(]|[WUBRGCX]\b|$))/)?.[0].trim()||'optional cost';
export const isDescribedOption=value=>typeof value==='string'||typeof value==='number'||typeof value==='boolean'||!!(value&&value.hidden!==true&&value.card?.hidden!==true&&(value.name||value.description||value.text));
// True when the open prompt leaves the player no reply: the panel below shows a diagnostic
// instead of controls (unadapted method, unordered order, or too few presentable options).
export function nativePromptUnanswerable(p){
 if(!p)return false;
 if(p.supported!==true||p.method==='order'&&p.ordered!==true)return true;
 if(['confirm','showConfirmDialog','showInputDialog'].includes(p.method)||p.acknowledgeOnly===true&&p.method==='getChoices')return false;
 if(OPTION_METHODS.has(p.method))return (p.options||[]).filter(o=>isDescribedOption(o.value)).length<(p.min||0);
 return true;
}
// Player-facing names for Forge's generic OK/Cancel/Auto buttons. Presentation only:
// the same native button operation is sent, and unfamiliar labels stay verbatim.
const PHASE_SHORT={UPKEEP:'Upkeep',DRAW:'Draw',MAIN1:'Main',COMBAT_BEGIN:'Combat',COMBAT_DECLARE_ATTACKERS:'Combat',COMBAT_DECLARE_BLOCKERS:'Combat',COMBAT_FIRST_STRIKE_DAMAGE:'Combat',COMBAT_DAMAGE:'Combat',COMBAT_END:'Combat',MAIN2:'Main 2',END_OF_TURN:'End step',CLEANUP:'Cleanup'};
const SHORT_STEP={'Next: Draw':'To draw','Next: Main phase':'To main','Next: Combat':'To combat','Next: Attackers':'To attackers','Next: Blockers':'To blocks','Next: Damage':'To damage','Next: End of combat':'End combat','Next: Second main':'To main 2','Next: End step':'To end step','Next: Cleanup':'To cleanup'};
const NEXT_STEP={UPKEEP:'Next: Draw',DRAW:'Next: Main phase',MAIN1:'Next: Combat',COMBAT_BEGIN:'Next: Attackers',COMBAT_DECLARE_ATTACKERS:'Next: Blockers',COMBAT_DECLARE_BLOCKERS:'Next: Damage',COMBAT_FIRST_STRIKE_DAMAGE:'Next: Damage',COMBAT_DAMAGE:'Next: End of combat',COMBAT_END:'Next: Second main',MAIN2:'Next: End step',END_OF_TURN:'Next: Cleanup'};
// Forge reports an unbounded side of the order as -1; never show it as a number.
export function orderRemainder(p){
 const lo=Number.isInteger(p?.remainingMin)&&p.remainingMin>=0?p.remainingMin:null,hi=Number.isInteger(p?.remainingMax)&&p.remainingMax>=0?p.remainingMax:null;
 if(lo===null&&hi===null)return '';
 if(hi===null)return lo?` Leave at least ${lo} in the source.`:'';
 return ` Leave ${(lo??0)===hi?hi:`${lo??0}–${hi}`} in the source.`;
}
// Forge tags card names with their engine id ("Food Token (204)"); players never need that number.
export const plainText=line=>String(line??'').replace(/ \(\d+\)(?=[\s,.:;!?)]|$)/g,'').trim();
// A mana payment in plain words: what is still owed, for which card, and what it does.
// `payment` comes from newer bridges; older ones only say "Pay Mana Cost: {2}" in the message.
const costText=v=>typeof v==='string'&&/^(\{[^{}\s]{1,8}\})+$/.test(v.trim())?v.trim():null;
export function nativePayment(n,cards=[]){
 if(!String(n?.inputType||'').startsWith('InputPayMana'))return null;
 const lines=String(n.message||'').split('\n').map(plainText).filter(Boolean),owedLine=lines.find(line=>/^pay mana cost:/i.test(line));
 const remaining=costText(n.payment?.remaining)||costText(owedLine?.replace(/^pay mana cost:/i,''));
 const ref=n.payment?.forCard?.kind==='card'&&Number.isSafeInteger(n.payment.forCard.id)?n.payment.forCard:null,card=ref?cards.find(c=>c.id===ref.id&&c.known):null;
 const name=card?.name||(typeof ref?.name==='string'&&ref.name.trim()?ref.name.trim():null);
 let verb=null,ability=null;
 if(card?.zone==='Battlefield'){
  // Name the ability only when the card has exactly one activated ability with a mana cost.
  verb='Activate';const abilities=String(card.text||'').split(/\n+/).map(line=>line.trim()).filter(line=>/^[^:"“]*\{[^}]+\}[^:"“]*:/.test(line));if(abilities.length===1)ability=abilities[0];
 }else if(card&&['Stack','Hand','Command','Graveyard','Exile'].includes(card.zone))verb='Cast';
 const detail=lines.filter(line=>line!==owedLine&&!/^\(?click (on|a)\b/i.test(line)&&line!==name&&line!==ability&&!/^input\w+$/i.test(line));
 // Newer hosts send the real cost for the chosen target (Ride's End is {1}{W} against a tapped one).
 const costNow=costText(n.payment?.costNow?.mana);if(costNow&&card?.manaCost&&costNow!==String(card.manaCost).replace(/\s+/g,''))detail.unshift(`Costs ${costNow} for this target (printed ${card.manaCost})`);
 // Nothing left to tap and nothing floating: say so instead of leaving the player to wonder.
 const pool=Object.values(n.players?.find(p=>p.id===n.viewer)?.mana||{}).some(v=>Number(v)>0),sources=(n.selection?.actionable||[]).length>0;
 // Forge offers Auto only when your untapped mana can pay the rest; when it can't, say so plainly.
 const b=n.buttons||{},autoOff=/^auto$/i.test(String(b.ok||''))&&b.okEnabled!==true;
 const short=!!remaining&&(autoOff||!pool&&!sources);
 if(short)detail.unshift(!pool&&!sources?'You have no untapped mana to pay this. Cancel puts it back.':'Not enough mana to pay this. Cancel puts it back.');
 return {remaining,name,verb,ability,detail,stuck:remaining!==null&&!pool&&!sources,short,forCard:ref?.id??null};
}
// Whose move it is right now, said plainly: yours, the CPU's, or nobody's while Forge resolves.
export function nativeDecisionActor(s){
 const n=s?.native;if(!n||n.failure||n.status==='finished')return 'none';
 if(s.busy||s.transportError||n.busy===true||n.inputType==='InputLockUI')return 'none';
 const b=n.buttons||{};
 return n.prompt||b.okEnabled===true||b.cancelEnabled===true||n.selection?.cards?.length||n.selection?.targets?.length||n.priorityPlayer===n.viewer?'you':'cpu';
}
// Forge lists "attacks each combat if able" creatures even when they can't attack yet (summoning sick, tapped);
// only one that could attack now still owes an attack.
export const owesAttack=c=>c?.mustAttack===true&&c?.attacking!==true&&c?.tapped!==true&&!(c?.summoningSick===true&&!(c.keywords||[]).some(k=>/haste/i.test(String(k))));
export function nativeActionLabel(n,op,raw){
 const label=String(raw??'').trim();
 if(!/^(ok|auto|cancel|end turn)$/i.test(label))return label;
 const mine=n?.players?.find(p=>p.id===n.viewer)?.zones?.Battlefield?.cards||[],count=key=>mine.filter(c=>c?.[key]===true).length,input=String(n?.inputType||'');
 if(input==='InputPassPriority'){
  if(op==='cancel')return /^end turn$/i.test(label)?'End turn':label;
  // Arena's words: with the CPU's spell or ability on top you answer it or let it go; your own just resolves.
  if(n.stack?.length)return n.stack[0]?.activatingPlayer===n.viewer?'Resolve':'No response';
  // With nobody attacking, the rest of combat is skipped: never promise a blockers step.
  const attacking=(n.players||[]).some(p=>(p.zones?.Battlefield?.cards||[]).some(c=>c?.attacking===true));
  if(!attacking&&['COMBAT_DECLARE_ATTACKERS','COMBAT_DECLARE_BLOCKERS','COMBAT_FIRST_STRIKE_DAMAGE','COMBAT_DAMAGE'].includes(n.phase))return n.activePlayer===n.viewer?'Next: Second main':'Pass';
  return n.activePlayer===n.viewer?NEXT_STEP[n.phase]||'Pass priority':'Pass';
 }
 if(input==='InputAttack'&&op==='ok'){const k=count('attacking'),must=mine.filter(owesAttack).length;if(must)return `${must} must attack`;return k?`Attack with ${k}`:'No attacks';}
 if(input==='InputBlock'&&op==='ok'){const k=count('blocking');return k?`Block with ${k}`:'No blocks';}
 if(input.startsWith('InputPayMana')&&op==='ok'&&/^auto$/i.test(label))return 'Pay automatically';
 if(input==='InputSelectTargets'&&op==='ok')return 'Confirm targets';
 return label;
}
const revealAuto={key:null,timer:0},errSeen={text:null,revision:0};let stackOpen=false;
// Forge names the AI as "Forge AI — <deck> · <commander>"; the hosted table calls it the CPU.
// Forge names the human seat "CardStashy" and the CPU "Forge AI — <deck>"; players read "you" and "the CPU".
export const seatWords=msg=>String(msg??'').replace(/\bCardStashy, you are going (first|second)!?/i,(m,w)=>`You're going ${w.toLowerCase()}.`).replace(/\s*Do you want to keep your hand\??/i,'').replace(/\bCardStashy's\b/g,'your').replace(/\bCardStashy\b/g,'You').replace(/Forge AI\s+\u2014\s+[^\n]*?'s\s+(library|hand|graveyard|deck)\b/g,'the CPU\u2019s $1').trim();
const cpuName=msg=>String(seatWords(msg)).replace(/Forge AI\b.*?\s(?=(?:revealed|reveals|picked|picks|chose|chooses|named|names|casts?|plays?|looked|looks)\b)/,'CPU ').replace(/Forge AI(?:\s+—[^·\n]*·?)?/,'CPU');
export function mountNativePanel(container,{session,snapshot,onLocalError=()=>{},presentation={}}){
 const doc=container.ownerDocument,s=snapshot,n=s.native;if(!n)return;
 // On phones the dock is transformed, so a fixed ask line inside it can't float above the hand; this body-level line does.
 const askLine=text=>{if(!doc.body)return;let line=doc.body.querySelector(':scope>.forge-ask-line');if(!line){line=doc.createElement('div');line.className='forge-ask-line';line.setAttribute('role','status');line.setAttribute('aria-live','polite');doc.body.append(line);}line.textContent=text;line.hidden=!text;};askLine('');
 const copy=(player,proof)=>presentation.hosted?player:proof;
 const phaseNames={UNTAP:'Untap',UPKEEP:'Upkeep',DRAW:'Draw',MAIN1:'Main phase',COMBAT_BEGIN:'Beginning of combat',COMBAT_DECLARE_ATTACKERS:'Choose attackers',COMBAT_DECLARE_BLOCKERS:'Choose blockers',COMBAT_FIRST_STRIKE_DAMAGE:'First strike damage',COMBAT_DAMAGE:'Combat damage',COMBAT_END:'End of combat',MAIN2:'Second main phase',END_OF_TURN:'End step',CLEANUP:'Cleanup'};
 const node=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 // Forge's own notices name the AI by its seat and deck and carry card ids ("Cavern of Souls (85): Forge AI —
 // Overlord · Uldaros picked Incarnation"). The hosted table says only what happened: "Cavern of Souls: CPU chose Incarnation".
 const noticeNode=nt=>{const title=String(nt.title||nt.method||'Forge').replace(/\s*\(\d+\)/g,'').trim();let msg=String(nt.message||'').replace(/\s*\(\d+\)/g,'').trim();
  if(!presentation.hosted){const p=node('p',`${title}: ${msg}`,'forge-diagnostic');p.setAttribute('role','status');return p;}
  const picked=msg.match(/\b(?:picked|chose|chooses|named|names)\s+(.+?)\.?$/i);if(/\bForge AI\b/.test(msg))msg=picked?`CPU chose ${picked[1]}`:cpuName(msg);
  const p=node('p',title&&title!=='Forge'?`${title}: ${msg}`:msg,'forge-notice');p.setAttribute('role','status');return p;};
 const run=fn=>()=>{try{const out=fn();if(out?.catch)out.catch(e=>onLocalError(e.message));}catch(e){onLocalError(e.message);}};
 // Phase stops on top of Smart: one tap stops the next time that step comes, a second tap
 // pins it for the whole match (📌), a third clears it. Opened from the turn line in the dock.
 function phaseStopSheet(n){
  const wrap=node('div',undefined,'forge-stops'),open=container.dataset.stopsOpen==='true',set=Object.keys(n.phaseStops).length;
  const toggle=node('button',set?`Stops · ${set}`:'Stops','forge-stops-toggle');toggle.type='button';toggle.dataset.nativeKey='stops-toggle';toggle.setAttribute('aria-expanded',String(open));
  toggle.addEventListener('click',()=>{const sheet=wrap.querySelector('.forge-stops-grid');if(sheet)sheet.hidden=open;toggle.setAttribute('aria-expanded',String(!open));container.dataset.stopsOpen=String(!open);});
  const grid=node('div',undefined,'forge-stops-grid');grid.hidden=!open;grid.setAttribute('role','group');grid.setAttribute('aria-label','Phase stops');
  grid.append(node('span',''),node('b','You'),node('b','CPU'));
  for(const [phase,label]of STOP_PHASES){grid.append(node('span',label));
   for(const seat of ['you','opponent']){const mode=n.phaseStops[`${seat}:${phase}`],state=mode===true?'pinned':mode===false?'once':'off',next=state==='off'?'once':state==='once'?'pinned':'off';
    const b=button(state==='pinned'?'📌':state==='once'?'●':'',()=>session.setPhaseStop(seat,phase,next),false,`stop-${seat}-${phase}`);b.className='forge-stop';b.dataset.state=state;b.setAttribute('aria-label',`${seat==='you'?'Your':'CPU'} ${label}: ${state==='pinned'?'stop every turn':state==='once'?'stop next time':'no stop'}`);b.title=state==='off'?'Stop here next time':state==='once'?'Tap again to pin for the match':'Pinned for the match · tap to clear';grid.append(b);}}
  wrap.append(toggle,grid);return wrap;
 }
 const button=(label,fn,disabled=false,key='')=>{const b=node('button',label);b.type='button';b.disabled=s.busy||disabled;if(key)b.dataset.nativeKey=key;b.addEventListener('click',run(fn));return b;};
 const panel=node('section',undefined,'forge-native-panel');panel.dataset.nativePanel='true';panel.dataset.nativeRevision=String(n.revision);panel.setAttribute('aria-label',copy('Your match decision','Native Forge decision'));
 const zoneSearch=presentation.hosted?nativeZoneSearch(s):null;let keepStripLeft=0;
 if(!presentation.hosted)panel.append(node('small',`${presentation.label||'LOCAL FORGE PROOF'} · revision ${n.revision}`,'forge-proof-label'));
 const deckLabel=alias=>({'keen-engineering':'Keen Engineering','reign-of-dragons':'Reign of Dragons','calling-all-angels':'Calling All Angels'}[alias]||alias);
 const context=node('div',undefined,'forge-native-context'),nativeMessage=n.prompt?.message||n.message||'Waiting for Forge';
 // Compact only the known passive status format. Any actual instruction or
 // unfamiliar native message remains verbatim and immediately visible.
 const statusLines=!n.prompt&&n.inputType==='InputPassPriority'&&typeof n.message==='string'?n.message.match(/^Priority: ([^\n]+)\nTurn: (\d+ \([^\n]+\))\nPhase: ([^\n]+)\nStack: ([^\n]+)$/):null;
 const compactStatus=!!statusLines&&!n.failure&&n.status!=='finished';panel.dataset.compactStatus=String(compactStatus);
 const yourTurn=n.activePlayer===n.viewer,opening=n.inputType==='InputConfirmMulligan',payment=String(n.inputType||'').startsWith('InputPayMana'),paying=payment?nativePayment(n,s.status?.surface?.cards||[]):null;
 const waitLabel=s.transportError?'Match update needs attention':n.busy===true?'Resolving game actions…':'Waiting for the table…';
 const lines=String(nativeMessage).split('\n').map(line=>presentation.hosted?plainText(line):line.trim()).filter(Boolean),selectionTitle=(presentation.hosted?{InputAttack:'Your attack',InputBlock:'Your blocks',InputSelectTargets:'Choose targets'}:{InputAttack:'Choose attackers',InputBlock:'Choose blockers',InputSelectTargets:'Choose targets'})[n.inputType];
 // Cleanup discard arrives as a card selection with no prompt; name it plainly.
 const discard=presentation.hosted&&!n.prompt&&n.selection?.cards?.length>0&&/\bdiscard\b/i.test(String(n.message||'')),discardCount=Number.isSafeInteger(n.selection?.max)&&n.selection.max>0?n.selection.max:Number(String(n.message||'').match(/select (\d+) card/i)?.[1])||null;
 // Engine bookkeeping between decisions is a status, not an instruction to the player.
 const passive=!compactStatus&&!n.prompt&&!opening&&!payment&&!n.failure&&n.status!=='finished'&&(n.busy===true||n.inputType==='InputLockUI'||/^Priority: /.test(lines[0]||''));
 const playerTitle=zoneSearch?`Choose ${zoneSearch.max===1?'a card':'cards'} · ${zoneSearch.zones.join(' / ')}`:compactStatus?`${yourTurn?'Your turn':'CPU turn'} · ${s.busy||s.transportError?waitLabel:n.priorityPlayer===n.viewer?(yourTurn?'You can act':'Your response'):'Waiting for CPU response'}`:opening?(presentation.hosted?'Keep this hand?':'Your opening hand'):payment?(paying?.remaining?`Pay ${paying.remaining}`:'Pay mana'):passive?`${yourTurn?'Your turn':'CPU turn'} · ${s.transportError?waitLabel:yourTurn?'Resolving…':'CPU is playing'}`:discard?(discardCount?`Choose ${discardCount} card${discardCount===1?'':'s'} to discard`:'Choose cards to discard'):selectionTitle||lines[0]||waitLabel;
 // Attacks and blocks are said by the board (the gold line, the glow, the button); Forge's own
 // instruction text, which names the CPU's deck, never reaches the dock.
 const combatPick=presentation.hosted&&['InputAttack','InputBlock'].includes(n.inputType)&&!n.prompt;
 const playerDetail=zoneSearch||compactStatus||passive||combatPick||discard&&discardCount?[]:discard?lines.slice(1):opening?(presentation.hosted?lines.map(seatWords).filter(line=>line&&!/^keep (this|your) hand or mulligan\??$/i.test(line)):[nativeMessage]):payment?(presentation.hosted?[paying.verb&&paying.name?`${paying.verb} ${paying.name}`:paying.name,paying.ability,...paying.detail].filter(Boolean):[nativeMessage]):selectionTitle?lines:lines.slice(1);
 // The dock's edge shows whose move it is; the table's activity line says it in words.
 panel.dataset.actor=nativeDecisionActor(s);
 const title=node('h2',presentation.hosted?playerTitle:compactStatus?(n.priorityPlayer===n.viewer?'Your priority':`Priority: ${statusLines[1]}`):nativeMessage);
 // The table shows whose turn it is large and who may act on its own line; the
 // heading's text (and what a screen reader hears) is unchanged.
 if(presentation.hosted&&playerTitle.includes(' · ')){const [turn,...rest]=playerTitle.split(' · ');title.replaceChildren(node('span',turn),node('span',' · ','forge-native-sep'),node('span',rest.join(' · '),'forge-native-response'));}
 // Mana symbols draw as symbols where the table provides them; the text stays the fallback.
 const symbols=typeof presentation.symbolText==='function'&&presentation.hosted?presentation.symbolText:null;
 if(symbols&&payment&&paying?.remaining){title.setAttribute('aria-label',playerTitle);title.innerHTML=symbols(playerTitle);}
 const hostedOrder=presentation.hosted&&n.prompt?.method==='order'&&n.prompt?.supported===true&&n.prompt?.ordered===true;
 // Kicker, Buyback, Entwine…: Forge asks which optional costs to pay as a pick-any list.
 const optionalCosts=presentation.hosted&&n.prompt?.supported===true&&['order','getChoices'].includes(n.prompt.method)&&n.prompt.options?.length>0&&n.prompt.options.every(o=>o.value?.kind==='optionalCost');
 if(optionalCosts){const one=n.prompt.options.length===1?costName(n.prompt.options[0].value):null;title.textContent=one?`Pay ${one}?`:'Pay optional costs?';title.removeAttribute('aria-label');}
 else if(hostedOrder){title.textContent=/simultaneous|trigger/i.test(String(n.prompt.message||nativeMessage))?'Order your triggers':'Choose an order';title.removeAttribute('aria-label');}
 title.tabIndex=-1;title.dataset.nativeKey='decision-title';context.setAttribute('aria-live','polite');context.setAttribute('aria-atomic','true');context.append(title);
 if(presentation.hosted&&!opening&&Number.isSafeInteger(n.turn)&&n.turn>0){const status=node('p',[`Turn ${n.turn}`,phaseNames[n.phase]||statusLines?.[3]||null].filter(Boolean).join(' · '),'forge-native-status');status.setAttribute('aria-label','Turn and phase');context.append(status);
  if(n.controlMode==='smart'&&n.phaseStops&&typeof n.phaseStops==='object'&&typeof session.setPhaseStop==='function')context.append(phaseStopSheet(n));}
 else if(compactStatus){const status=node('div',undefined,'forge-native-status');status.setAttribute('aria-label','Turn, phase and stack');const stack=n.stack?.length?`${n.stack.length} item${n.stack.length===1?'':'s'}`:'Empty';for(const [label,text]of [['Turn',presentation.hosted?String(n.turn):statusLines[2]],['Phase',presentation.hosted?(phaseNames[n.phase]||statusLines?.[3]||n.phase||'—'):statusLines[3]],['Stack',presentation.hosted?stack:statusLines[4]]]){const value=node('span',`${label}: ${text}`);status.append(value);}context.append(status);}
 // Forge's supporting lines (a few at most), never one that only repeats the title.
 if(presentation.hosted&&!hostedOrder&&!optionalCosts)for(const line of playerDetail.filter(line=>!/^(declare (attackers|blockers)|choose any target)\.?$/i.test(line)&&!/\bForge AI\b/.test(line)).slice(0,2)){const p=node('p',line,'forge-native-detail');if(symbols&&payment)p.innerHTML=symbols(line);context.append(p);}
 panel.append(context);
 if(n.failure){panel.append(node('p',`Forge stopped: ${n.failure}`,'forge-diagnostic'));container.replaceChildren(panel);return;}
 if(n.status==='finished'){panel.append(node('p',n.draw===true?'Forge result: draw':n.winner?`Forge result: ${n.winner}`:'Forge reports that the game has finished.'));container.replaceChildren(panel);return;}
 if(presentation.allowControlMode===true&&presentation.controlsOnSeat!==true&&['smart','full'].includes(n.controlMode)){
  const group=node('div',undefined,'forge-native-mode');group.setAttribute('role','group');group.setAttribute('aria-label',copy('Response controls','Native response mode'));
  for(const [value,label]of [['smart','Smart'],['full','Full Control']]){const b=button(label,()=>session.setControlMode(value),!!n.prompt||n.inputType==='InputLockUI',`mode-${value}`);b.setAttribute('aria-pressed',String(n.controlMode===value));group.append(b);}
  group.title=n.controlMode==='smart'?'Automatic mana and passing empty response windows. Targets and required choices remain yours.':'Choose each response and mana payment yourself.';panel.append(group);
  // Auto-pay is its own switch: Full Control can keep it, Smart can pay by hand.
  if(typeof n.autoPay==='boolean'&&typeof session.setAutoPay==='function'){const b=button(n.autoPay?'Auto-pay mana: on':'Auto-pay mana: off',()=>session.setAutoPay(!n.autoPay),!!n.prompt||n.inputType==='InputLockUI','auto-pay');b.setAttribute('aria-pressed',String(n.autoPay));b.title='Pay mana costs automatically. Turn off to tap each source yourself.';group.append(b);}
 }
 if(n.notification?.message){const notice=noticeNode(n.notification);
  // The hosted table floats the notice above your hand (the table places it), kept across redraws so its fade runs once.
  const host=presentation.hosted?container.closest('.play-match-table'):null;
  if(host){const was=host.querySelector(':scope>.forge-notice');if(was?.textContent!==notice.textContent){was?.remove();host.append(notice);}}else panel.append(notice);}
 // On the hosted table, trouble is one small toast in plain words with Retry, never a raw code.
 // A refused move's note clears once the next move goes through (the match's revision moves on).
 if(n.lastActionError){if(errSeen.text!==n.lastActionError){errSeen.text=n.lastActionError;errSeen.revision=n.revision;}}else errSeen.text=null;
 const staleError=!!n.lastActionError&&Number.isFinite(n.revision)&&n.revision>errSeen.revision;
 if(presentation.hosted&&(s.transportError||n.lastActionError&&!staleError)){
  const toast=node('div',undefined,'forge-toast');toast.setAttribute('role','alert');toast.title=String(s.transportError||n.lastActionError);
  const text=s.transportError?(/TIMEOUT/i.test(String(s.transportError))?'The table is slow to answer.':'Lost touch with the table.'):'That move didn\u2019t go through.';
  toast.append(node('i'),node('span',text));if(s.transportError){const retry=button('Retry',()=>session.refresh(),false,'refresh');retry.disabled=false;toast.append(retry);}panel.append(toast);
 }else{
 if(n.lastActionError)panel.append(node('p',`Native action diagnostic: ${n.lastActionError}`,'forge-diagnostic'));
 if(s.transportError){const error=node('p',`Connection/action diagnostic: ${s.transportError}`,'forge-diagnostic');error.setAttribute('role','alert');panel.append(error,button('Refresh state (does not replay action)',()=>session.refresh(),false,'refresh'));}
 }
 // The table shows the state itself; the hosted panel adds no instructions.
 if(!presentation.hosted&&s.busy)panel.append(node('p','Waiting for Forge to resolve…','forge-native-wait'));
 const p=n.prompt;
 if(zoneSearch){
  const wasOpen=!!container.querySelector?.('.forge-zone-search-dialog');keepStripLeft=wasOpen?container.querySelector('.forge-zone-search-cards')?.scrollLeft||0:0;
  const overlay=node('div',undefined,'forge-zone-search'),dialog=node('section',undefined,'forge-zone-search-dialog');
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',`${zoneSearch.zones.join(' / ')} card selection`);
  const heading=node('h2',presentation.hosted&&lines[0]?cpuName(lines[0]):lines[0]||`Choose from ${zoneSearch.zones.join(' / ')}`);heading.title=heading.textContent;heading.tabIndex=-1;heading.dataset.nativeKey='zone-search-title';dialog.append(heading);
  if(lines.length>1)dialog.append(node('p',presentation.hosted?lines.slice(1).map(cpuName).join('\n'):lines.slice(1).join('\n'),'forge-zone-search-instruction'));
  dialog.append(node('p',`Choose from the ${zoneSearch.choices.length} card${zoneSearch.choices.length===1?'':'s'} offered by this effect.`,'forge-zone-search-hint'));
  const selected=zoneSearch.kind==='prompt'?(s.nativeDraft?.revision===n.revision&&s.nativeDraft?.promptId===p.id?s.nativeDraft.indexes:[]):(n.selection?.chosen||[]).filter(r=>r.kind==='card').map(r=>r.id);
  const expectedRevision=n.revision,expectedPromptId=p?.id;
  const currentPrompt=fn=>()=>{const latest=session.snapshot();if(latest.native?.revision!==expectedRevision||latest.native?.prompt?.id!==expectedPromptId)throw Error('STALE_CHOICE');return fn();};
  const row=node('div',undefined,'forge-zone-search-cards');row.dataset.auditScroll='';row.setAttribute('role','group');row.setAttribute('aria-label','Eligible cards');
  for(const choice of zoneSearch.choices){
   const chosen=selected.includes(zoneSearch.kind==='prompt'?choice.index:choice.cardId),pick=zoneSearch.kind==='prompt'?currentPrompt(()=>session.selectPrompt(choice.index)):()=>session.nativeSelect('card',choice.cardId,n.revision);
   const b=button('',pick,!choice.visible,choice.key);b.className='forge-zone-search-card';b.setAttribute('aria-pressed',String(chosen));b.setAttribute('aria-label',`${choice.name} · ${choice.zone}${chosen?' · selected':''}`);
   b.dataset.searchCard=String(choice.cardId??'');
   const projected=choice.card||(choice.visible&&zoneSearch.kind==='prompt'?session.promptCardArtwork?.(choice.index,n.revision):null),imageUrl=searchImage(projected);
   if(imageUrl){const image=node('img');image.src=imageUrl;image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{image.hidden=true;b.dataset.artUnavailable='true';},{once:true});b.append(image);}
   else b.dataset.artUnavailable='true';
   const caption=node('span',choice.name,'forge-zone-search-name');b.append(caption,node('span',chosen?'Selected':choice.zone,'forge-zone-search-state'));row.append(b);
  }
  dialog.append(row);
  const summary=node('p',selected.length?`${selected.length} selected`:'No card selected','forge-zone-search-summary');summary.setAttribute('role','status');dialog.append(summary);
  const actions=node('div',undefined,'forge-zone-search-actions');let cancel=null;
  if(zoneSearch.kind==='prompt'){
   actions.append(button('Confirm selection',currentPrompt(()=>session.confirmPrompt()),selected.length<p.min||selected.length>p.max,'confirm-prompt'));
   if(p.min===0){cancel=currentPrompt(()=>{session.clearPrompt();return session.confirmPrompt();});actions.append(button(p.cancelable?'Cancel':'Choose none',cancel,false,'skip-search'));}
   if(selected.length)actions.append(button('Clear selection',currentPrompt(()=>session.clearPrompt()),false,'clear-prompt'));
  }else{
   const buttons=n.buttons||{};
   if(buttons.ok!==undefined)actions.append(button('Confirm selection',()=>session.nativeButton('ok',n.revision),buttons.okEnabled!==true,'ok'));
   if(buttons.cancel!==undefined&&buttons.cancelEnabled===true){cancel=()=>session.nativeButton('cancel',n.revision);actions.append(button(nativeActionLabel(n,'cancel',buttons.cancel)||'Cancel',cancel,false,'cancel'));}
  }
  if(n.notification?.message){const notice=noticeNode(n.notification);dialog.append(notice);}
  if(n.lastActionError){const refused=node('p',`Forge did not accept that: ${n.lastActionError}`,'forge-diagnostic');refused.setAttribute('role','alert');dialog.append(refused);}
  if(s.busy)dialog.append(node('p','Forge is updating the choice…','forge-zone-search-hint'));
  dialog.append(actions);overlay.append(dialog);panel.append(overlay);
  // Keep keyboard navigation inside the choice. Escape only moves focus to the decline
  // button (a second, explicit press answers); the backdrop never invents a cancellation.
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();(dialog.querySelector('[data-native-key=skip-search],[data-native-key=cancel]')||heading).focus();return;}if(e.key!=='Tab')return;const items=[...dialog.querySelectorAll('button:not(:disabled)')];if(!items.length){e.preventDefault();heading.focus();return;}const first=items[0],last=items.at(-1);if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===heading)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(doc.activeElement===last||!dialog.contains(doc.activeElement))){e.preventDefault();first.focus();}});
  if(!wasOpen)queueMicrotask(()=>{if(dialog.isConnected)heading.focus({preventScroll:true});});
 }else if(p){
  if(p.supported!==true||p.method==='order'&&p.ordered!==true){panel.append(node('p','This native prompt is not yet adapted. No response has been invented or sent.','forge-diagnostic'));}
  else if(optionalCosts){
   // One cost: answer in one tap (Arena's "Kicker" / "Cast without"). Several: toggle, then cast.
   const options=p.options,indexes=s.nativeDraft?.revision===n.revision&&s.nativeDraft?.promptId===p.id?s.nativeDraft.indexes:[];
   const label=o=>{const b=node('span',undefined,'forge-cost-label'),text=optionLabel(o.value);if(symbols)b.innerHTML=symbols(text);else b.textContent=text;return b;};
   const answer=pick=>()=>{session.clearPrompt();for(const i of pick)session.selectPrompt(i);return session.confirmPrompt();};
   const choices=node('div',undefined,'forge-optional-costs');
   if(options.length===1){
    const pay=button('',answer([options[0].index]),false,'pay-optional');pay.className='forge-cost-pay';pay.append(label(options[0]));
    choices.append(pay,button(`Cast without ${costName(options[0].value).toLowerCase()}`,answer([]),false,'skip-optional'));
   }else{
    for(const o of options){const b=button('',()=>session.selectPrompt(o.index),false,`option-${o.index}`);b.className='forge-cost-toggle';b.setAttribute('aria-pressed',String(indexes.includes(o.index)));b.append(label(o));choices.append(b);}
    choices.append(button(indexes.length?'Cast':'Cast without extras',()=>session.confirmPrompt(),indexes.length<p.min||indexes.length>p.max,'confirm-prompt'));
   }
   panel.append(choices);
  }
  else if(['confirm','showConfirmDialog'].includes(p.method)){
   const options=p.options||[],named=presentation.hosted?session.promptNamedCard?.(n.revision):null,url=searchImage(named);
   if(url){const figure=node('figure',undefined,'forge-native-card'),image=node('img');image.src=url;image.alt=named.name;image.decoding='async';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>figure.remove(),{once:true});figure.append(image);panel.append(figure);}
   const choices=node('div',undefined,'forge-native-confirm');choices.append(button(optionLabel(options[0]?.value??'Confirm'),()=>session.replyValue(true),false,'reply-true'),button(optionLabel(options[1]?.value??'Decline'),()=>session.replyValue(false),false,'reply-false'));panel.append(choices);
  }else if(p.method==='showInputDialog'){
   const form=node('form'),label=node('label','Value requested by Forge');let input;
   if(p.options?.length){input=node('select');input.append(node('option','Select an offered value'));input.firstChild.value='';for(const o of p.options){const option=node('option',optionLabel(o.value));option.value=String(o.value);input.append(option);}}
   else{input=node('input');input.type=p.numeric?'number':'text';input.maxLength=200;input.autocomplete='off';if(p.numeric)input.step='1';}
   input.required=true;input.disabled=s.busy;input.dataset.nativeKey='native-value';input.setAttribute('aria-label',p.message||'Forge input');label.append(input);form.append(label);
   const submit=node('button',copy('Confirm','Submit native value'));submit.type='submit';submit.disabled=s.busy;submit.dataset.nativeKey='submit-value';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())run(()=>session.replyValue(input.value))();});panel.append(form);
  }else if(p.acknowledgeOnly===true&&p.method==='getChoices'){
   const revealed=node('ul');for(const option of p.options||[])revealed.append(node('li',plainText(optionLabel(option.value))));
   // On the hosted table a reveal is a short look, like Arena's: a labelled strip that moves on by itself.
   if(presentation.hosted){revealed.className='forge-reveal-list';const label=node('p',cpuName(plainText(String(p.message||'Revealed').split('\n')[0])),'forge-reveal-label');panel.append(label);
    const key=`${n.revision}:${p.id}`;if(revealAuto.key!==key){clearTimeout(revealAuto.timer);revealAuto.key=key;revealAuto.timer=setTimeout(()=>{if(revealAuto.key===key&&session.snapshot().native?.prompt?.id===p.id)run(()=>session.confirmPrompt())();},3200);}}
   panel.append(revealed,button(presentation.hosted?'OK':copy('Continue','Acknowledge native reveal'),()=>{clearTimeout(revealAuto.timer);session.confirmPrompt();},false,'acknowledge-prompt'));
  }else if(OPTION_METHODS.has(p.method)){
   const indexes=s.nativeDraft?.revision===n.revision&&s.nativeDraft?.promptId===p.id?s.nativeDraft.indexes:[],options=p.options||[];
   if(hostedOrder){
    // Arena-style: each choice is its source card; tap them in order, tap again to take one back.
    const cards=s.status?.surface?.cards||[],clean=t=>plainText(String(t||'').replace(/\s*\[[^\]]*\]/g,'').replace(/\s*\(\s*\)/g,'')).trim();
    const sourceOf=o=>{const id=optionCardId(o.value);let c=id!==null?cards.find(c=>c.id===id):null;if(!c&&o.value?.card?.name)c=cards.find(x=>x.known&&x.name===o.value.card.name&&x.zone==='Battlefield')||null;if(!c){const m=/\[[^\]]*?:\s*([^\]]+?)\s*\((\d+)\)\]/.exec(optionLabel(o.value));if(m)c=cards.find(c=>c.id===Number(m[2]))||cards.find(c=>c.known&&c.name===m[1]);}return c||null;};
    // "Leave 0 in the source" only says every one must be ordered, which the Done button already shows.
    const rest=p.remainingMax>0&&!((p.min??0)>=options.length)?orderRemainder(p):'';panel.append(node('p',`Tap them in order. 1 ${/resolve/i.test(p.topLabel||'')?'resolves first':`is ${String(p.topLabel||'first').toLowerCase()}`}.${rest}`,'forge-order-hint'));
    const grid=node('div',undefined,'forge-order-cards');
    for(const o of options){
     const at=indexes.indexOf(o.index),source=sourceOf(o),label=optionLabel(o.value),text=clean(label),described=isDescribedOption(o.value);
     const tile=button('',()=>session.selectPrompt(o.index),!described,`option-${o.index}`);tile.className='forge-order-card';tile.dataset.optionIndex=String(o.index);tile.setAttribute('aria-pressed',String(at>=0));tile.setAttribute('aria-label',`${at>=0?`${at+1}: `:''}${source?.known?source.name+' · ':''}${text}`);tile.title=text;
     const badge=node('span',at>=0?String(at+1):'','forge-order-num');const url=searchImage(source);
     const art=url?node('img'):node('span',source?.known?source.name:'?','forge-order-noart');if(url){art.src=url;art.alt='';art.decoding='async';art.referrerPolicy='no-referrer';}
     const cap=node('span',undefined,'forge-order-cap');cap.append(node('b',source?.known?source.name:text),node('small',source?.known?text:''));
     tile.append(badge,art,cap);grid.append(tile);
    }
    panel.append(grid);
   }else{
   panel.append(node('p',p.method==='order'?`Choose the destination order.${orderRemainder(p)}`:`Choose ${p.min===p.max?p.min:`${p.min}–${p.max}`} ${presentation.hosted?'':'native '}option${p.max===1?'':'s'}.`));
   const list=node('div',undefined,'forge-native-options');
   for(const o of options.filter(o=>p.method!=='order'||!indexes.includes(o.index))){const described=isDescribedOption(o.value),b=button(optionLabel(o.value),()=>session.selectPrompt(o.index),!described,`option-${o.index}`);b.setAttribute('aria-pressed',String(indexes.includes(o.index)));b.dataset.optionIndex=String(o.index);const cardId=optionCardId(o.value);if(cardId!==null)b.dataset.optionCard=String(cardId);if(!described)b.title='Native option details are unavailable; refusing an arbitrary reply.';list.append(b);}
   if(p.method==='order')panel.append(node('strong',`Source · ${options.length-indexes.length}`));panel.append(list);
   if(options.some(o=>!isDescribedOption(o.value)))panel.append(node('p','Some native options have no safe presentation. Those options remain disabled.','forge-diagnostic'));
   if(p.method==='order'&&indexes.length){panel.append(node('strong',p.topLabel||'Destination order'));const order=node('ol');order.setAttribute('aria-label','Native selected order');for(const [at,index]of indexes.entries()){const row=node('li',optionLabel(options.find(o=>o.index===index)?.value));row.append(button('↑',()=>session.reorderPrompt(index,-1),at===0,`earlier-${index}`),button('↓',()=>session.reorderPrompt(index,1),at===indexes.length-1,`later-${index}`),button('Remove',()=>session.selectPrompt(index),false,`remove-${index}`));order.append(row);}panel.append(order);}
   }
   if(p.method==='order'&&p.rememberAllowed===true){const rememberLabel=node('label','Remember this order'),remember=node('input');remember.type='checkbox';remember.checked=s.nativeDraft?.remember===true;remember.disabled=s.busy;remember.dataset.nativeKey='remember-order';remember.addEventListener('change',run(()=>session.rememberPrompt(remember.checked)));rememberLabel.prepend(remember);panel.append(rememberLabel);}
   if(hostedOrder){const actions=node('div',undefined,'forge-order-actions');
    // Like Arena's auto-order: keep the order they came in (the ones already tapped stay first) and go on.
    const auto=()=>{const picked=[...indexes];for(const o of options)if(!picked.includes(o.index)&&picked.length<p.max&&isDescribedOption(o.value)){session.selectPrompt(o.index);picked.push(o.index);}return session.confirmPrompt();};
    const fillable=Math.min(p.max,options.filter(o=>isDescribedOption(o.value)).length)>=p.min;
    actions.append(button('Reset',()=>session.clearPrompt(),!indexes.length,'clear-prompt'),button('Auto order',auto,!fillable,'auto-order'),button('Done',()=>session.confirmPrompt(),indexes.length<p.min||indexes.length>p.max,'confirm-prompt'));panel.append(actions);}else{
   const summary=node('p',indexes.length?`Selected: ${indexes.map(index=>optionLabel(options.find(o=>o.index===index)?.value)).join(' · ')}`:'Nothing selected');summary.className='forge-native-draft';panel.append(summary);
   panel.append(button(indexes.length===0&&p.min===0?(p.cancelable?copy('Cancel','Cancel native dialog'):copy('Choose none','Submit no selections')):copy('Confirm choice','Confirm native choice'),()=>session.confirmPrompt(),indexes.length<p.min||indexes.length>p.max,'confirm-prompt'),button(copy('Clear selection','Clear draft'),()=>session.clearPrompt(),false,'clear-prompt'));
   }
  }else panel.append(node('p',`Unsupported native dialog: ${p.method}. No reply sent.`,'forge-diagnostic'));
 }else{
  const buttons=n.buttons||{},actions=node('div',undefined,'forge-native-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label',copy('Match actions','Native actions'));
  // A pick on the table (targets, the legend rule, a sacrifice) is asked in one line above these buttons, so
  // nothing covers the cards you can pick. A required single target commits on the click, like Arena, so no
  // Confirm is offered then; an optional one offers "No target" instead.
  const picks=(n.selection?.cards?.length||0)+(n.selection?.targets?.length||0),input=String(n.inputType||'');
  const asking=presentation.hosted&&!n.prompt&&picks>0&&!['InputPassPriority','InputAttack','InputBlock','InputConfirmMulligan','InputLockUI'].includes(input)&&!input.startsWith('InputPayMana')&&!discard;
  const oneTarget=asking&&input==='InputSelectTargets'&&n.selection?.max===1&&!(n.selection?.chosen||[]).length;
  if(asking){const first=lines.find(l=>!/^(Priority|Turn|Phase|Stack):/.test(l))||'';let ask=cpuName(first).replace(/\s*\[Phase: [^\]]*\]/g,'').trim();
   if(/legend(ary)? rule|same name|choose .* to keep|keep one/i.test(ask))ask='Two legendary permanents share a name. Choose the one to keep.';
   // Forge writes "<card> - <its rules text>"; the dock says what to do, the card itself is on the stack.
   const named=ask.match(/^(.{2,60}?) - (.+)$/);
   const stackOnly=(n.selection?.targets||[]).length>0&&(n.selection.targets||[]).every(r=>r.kind==='stack');
   // Forge picks stack items through two inputs; "Select target noncreature spell" becomes "Choose a noncreature spell on the stack".
   if((input==='InputSelectTargets'||input==='InputSelectStackItems')&&stackOnly){const what=(named?.[2]||ask).match(/\btarget ([a-z -]{3,40}?(?:spell|ability)(?: or ability)?)\b/i)?.[1];ask=/\bcounter target\b/i.test(named?.[2]||ask)?'Choose a spell to counter':what?`Choose a${/^[aeiou]/i.test(what)?'n':''} ${what.toLowerCase()} on the stack`:'Choose a spell or ability on the stack';}
   else if(input==='InputSelectTargets'&&named)ask=`Choose a target for ${named[1]}`;
   else if(named)ask=named[2];
   if(!ask)ask=input==='InputSelectTargets'?'Choose a target':'Choose a card on the table';if(oneTarget)ask=ask.replace(/^(Select|Choose) (a )?targets? for/i,'Tap a target for');else ask=ask.replace(/^Select\b/,'Choose');
   actions.dataset.state=ask;actions.dataset.ask='true';askLine(ask);}
  // A payment your mana can't finish says so above the hand; Cancel is the way out.
  else if(presentation.hosted&&paying?.short){actions.dataset.state=`Not enough mana${paying.name?` for ${paying.name}`:''}`;actions.dataset.ask='true';askLine(actions.dataset.state);}
  for(const op of ['ok','cancel'])if(buttons[op]!==undefined){
   if(asking&&op==='ok'&&buttons.okEnabled!==true)continue;
   if(oneTarget&&op==='ok'){if(n.selection?.min===0&&buttons.okEnabled===true){const none=button('No target',()=>session.nativeButton('ok',n.revision),false,'ok');actions.append(none);}continue;}
   const label=presentation.hosted?nativeActionLabel(n,op,buttons[op]):String(buttons[op]||op),enabled=buttons[op+'Enabled']===true;
   // An unavailable Cancel/End turn is noise in the dock; an unavailable confirmation still shows what is pending.
   if(presentation.hosted&&!enabled&&(op==='cancel'||!label))continue;
   // A declaration Forge would refuse (a must-attack creature left out) is not offered as a live button.
   const mustLeft=n.inputType==='InputAttack'&&op==='ok'&&(n.players?.find(p=>p.id===n.viewer)?.zones?.Battlefield?.cards||[]).some(owesAttack);
   const action=button(label||op,()=>session.nativeButton(op,n.revision),!enabled||mustLeft,op);if(mustLeft)action.title='A creature that must attack this turn is not attacking yet.';
   // A payment your mana can't finish: Cancel is the main button, and Pay automatically steps aside.
   if(paying?.short&&presentation.hosted){if(op==='cancel')action.dataset.primary='true';else if(op==='ok'&&!enabled)continue;}
   // The hosted dock names where Next goes in two words ("To combat"); the full step stays in its name and tooltip.
   if(presentation.hosted&&presentation.shortNext===true&&/^Next: /.test(label)){action.textContent=SHORT_STEP[label]||'Next';action.setAttribute('aria-label',label);action.title=label.replace(/^Next: /,'Next step: ');}
   actions.append(action);
  }
  // Arena's "Attack all": every creature Forge offers as an attacker joins, one click each, in order.
  if(presentation.hosted&&n.inputType==='InputAttack'&&!n.prompt){const offered=(n.selection?.cards||[]).filter(r=>r?.kind==='card').map(r=>s.status.surface.cards.find(c=>c.id===r.id)).filter(c=>c&&c.zone==='Battlefield'&&c.controller===s.status.surface.seat&&c.attacking!==true);
   if(offered.length&&(n.selection?.cards||[]).filter(r=>r?.kind==='card').length>=2){const all=button('Attack all',async()=>{for(const c of offered){const now=session.snapshot();if(now.native?.inputType!=='InputAttack'||now.native?.prompt||now.native?.lastActionError)break;if(now.status?.surface.cards.find(x=>x.id===c.id)?.attacking)continue;await session.nativeSelect('card',c.id);for(let i=0;i<60&&session.snapshot().busy;i++)await new Promise(r=>setTimeout(r,50));}},false,'attack-all');all.className='forge-attack-all';actions.prepend(all);}}
  // Phones hide the phase track, so the main action carries one quiet line of where you are: "CPU turn · Main · Your response".
  if(presentation.hosted&&actions.childNodes.length&&n.inputType==='InputPassPriority'&&!n.prompt){const where=PHASE_SHORT[n.phase]||'',yours=n.activePlayer===n.viewer,why=n.stack?.length&&n.stack[0]?.activatingPlayer!==n.viewer?'Your response':yours?'Your move':'Your response';actions.dataset.state=[yours?'':'CPU turn',where,why].filter(Boolean).join(' · ');}
  if(actions.childNodes.length||actions.dataset.ask==='true')panel.append(actions);
  const refs=[...(n.selection?.cards||[]),...(n.selection?.targets||[]),...(n.selection?.actionable||[])],unique=new Map(refs.map(r=>[r.kind+':'+r.id,r]));
  if(unique.size&&!presentation.hosted){const selection=node('details',undefined,'forge-native-hints'),summary=node('summary',`${presentation.hosted?'Highlighted choices':'Native selection guidance'} · ${unique.size}`);selection.append(summary,node('p',copy('You can select these cards or players here, or directly on the table.','These are Forge’s UI hints, not a complete legal-action list. The engine validates each click.')));
   for(const r of unique.values()){const c=s.status.surface.cards.find(c=>c.id===r.id),player=n.players.find(p=>p.id===r.id),stack=n.stack.find(x=>x.id===r.id);const label=r.kind==='card'?(c?.known?c.name:c?'Face-down card':null):r.kind==='player'?player?.name:r.kind==='stack'?stack?.text:null;if(label)selection.append(button(label,()=>session.nativeSelect(r.kind,r.id,n.revision),false,`ref-${r.kind}-${r.id}`));}panel.append(selection);}
  // Players and the stack are picked where they are shown; a highlighted card the table does not draw
  // (flashback or escape in the graveyard, a card you may play from exile, a target there) is picked here.
  if(unique.size&&presentation.hosted){const drawn=new Set([...(container.closest('.play-match-table')?.querySelectorAll('.play-match-card[data-instance]')||[])].map(e=>e.dataset.instance)),elsewhere=node('section',undefined,'forge-native-elsewhere');elsewhere.setAttribute('aria-label','In other zones');elsewhere.append(node('h3','In other zones'));
   for(const r of unique.values()){const c=r.kind==='card'&&!drawn.has(String(r.id))&&s.status.surface.cards.find(c=>c.id===r.id);if(c)elsewhere.append(button(`${c.known?c.name:'Face-down card'} · ${c.zone}`,()=>session.nativeSelect('card',r.id,n.revision),false,`ref-card-${r.id}`));}if(elsewhere.childNodes.length>1)panel.append(elsewhere);}
  if(n.stack?.length){const stack=presentation.hosted?node('section',undefined,'forge-native-stack'):node('details');stack.append(node(presentation.hosted?'h3':'summary',presentation.hosted?'On the stack':`Native stack · ${n.stack.length}`));if(presentation.hosted)stack.setAttribute('aria-label','On the stack');// Any ability on the stack can be yielded to until end of turn; Forge then passes while it is on top.
   const canYield=presentation.hosted&&typeof session.yieldSource==='function';
   const withYield=(b,item)=>{if(!canYield||item.ability!==true)return b;const row=node('div',undefined,'forge-stack-row'),y=button(item.yielded?'Yielding':'Yield',()=>session.yieldSource(item.id,!item.yielded),!!n.prompt||n.inputType==='InputLockUI',`yield-${item.id}`);y.className='forge-stack-yield';y.setAttribute('aria-pressed',String(item.yielded===true));y.title=item.yielded?'Stop yielding to this ability':'Pass on this ability every time it is on top, until end of turn. Targets and choices still stop.';row.append(b,y);return row;};
   // The hosted table shows each item as a compact card: who, what, whom; the engine's full text waits behind
   // "Full effect", and Yield (with its real scope) sits in a small menu. The top item is marked as resolving next.
   const named=id=>{const c=s.status?.surface?.cards?.find(c=>c.id===id);if(c)return c.known?c.name:'Face-down card';const pl=n.players?.find(p=>p.id===id);return pl?(pl.isViewer?'You':'CPU'):null;};
   const compact=(item,top,count)=>{const mine=item.activatingPlayer===n.viewer,raw=plainText(item.text||''),src=item.source?.name||raw.match(/^([^-\u2014:]{1,40}?)\s+[-\u2014:]\s/)?.[1]||'',body=src&&raw.startsWith(src)?raw.slice(src.length).replace(/^\s*[-\u2014:]\s*/,''):raw;
    const short=body.replace(/\s*\([^)]*\)/g,'').trim(),first=short.match(/^.*?[.!?](?=\s|$)/)?.[0]||short,summary=first.length>110?first.slice(0,107).replace(/\s+\S*$/,'')+'…':first;
    const card=node('article',undefined,'forge-stack-item');card.dataset.full='';card.dataset.top=String(top);card.dataset.mine=String(mine);if(item.yielded)card.dataset.yielded='true';
    const head=button('',()=>session.nativeSelect('stack',item.id,n.revision),false,`stack-${item.id}`);head.className='forge-stack-head';const kind=node('span',`${mine?'Your':'CPU'} ${item.ability===true?'ability':'spell'}${top?' · Next':''}`,'forge-stack-kind');kind.dataset.short=`${mine?'You':'CPU'}${top?' · Next':''}`;head.append(kind,node('strong',src||summary||`Stack item ${item.id}`,'forge-stack-name'));
    if(count>1){const c=node('b',`×${count}`,'forge-stack-count');head.append(c);head.setAttribute('aria-label',`${count} identical: ${src||summary}`);}card.append(head);
    if(src&&summary)card.append(node('p',symbols?undefined:summary,'forge-stack-summary'));if(src&&summary&&symbols)card.lastChild.innerHTML=symbols(summary);
    const tg=(Array.isArray(item.targets)?item.targets:[]).map(r=>named(r?.id)).filter(Boolean);if(tg.length){const row=node('p',undefined,'forge-stack-targets');row.append(node('span','→ '),...tg.map((t,k)=>node('span',(k?', ':'')+t,'forge-stack-target')));card.append(row);}
    if(body&&body!==summary){const more=node('details',undefined,'forge-stack-more'),sum=node('summary','Full effect');more.append(sum);const full=node('p',symbols?undefined:body);if(symbols)full.innerHTML=symbols(body);else full.textContent=body;more.append(full);card.append(more);}
    if(canYield&&item.ability===true){const menu=node('details',undefined,'forge-stack-menu'),sum=node('summary','⋯');sum.setAttribute('aria-label','More for this ability');menu.append(sum);const y=button(item.yielded?'Stop auto-passing this ability':'Auto-pass this ability until end of turn',()=>session.yieldSource(item.id,!item.yielded),!!n.prompt||n.inputType==='InputLockUI',`yield-${item.id}`);y.className='forge-stack-yield';y.setAttribute('aria-pressed',String(item.yielded===true));menu.append(y,node('small','Targets and choices still stop you.'));card.append(menu);}
    return card;};
   if(presentation.hosted){const list=node('div',undefined,'forge-stack-list');let top=true,shown=0;for(const run of stackRuns(n)){if(run.length<3)for(const item of run){list.append(compact(item,top,1));top=false;shown++;}else{list.append(compact(run[0],top,run.length));top=false;shown++;}}stack.append(list);
    // Phones show only the top item; a +N chip opens the rest (the open state survives redraws).
    // On a portrait screen the strip shows one line per item until opened, so a lone item gets "Details" too.
    {const label=shown>1?`+${shown-1} more`:'Details',more=button(label,()=>{stackOpen=!stackOpen;stack.dataset.open=String(stackOpen);more.textContent=stackOpen?'Show less':label;},false,'stack-more');more.className='forge-stack-more-count';if(shown<2)more.dataset.solo='true';if(stackOpen){stack.dataset.open='true';more.textContent='Show less';}stack.append(more);}panel.append(stack);}
   else{for(const run of stackRuns(n))if(run.length<3)for(const item of run)stack.append(withYield(button(item.text||`Stack item ${item.id}`,()=>session.nativeSelect('stack',item.id,n.revision),false,`stack-${item.id}`),item));else{const top=run[0],b=button(top.text||`Stack item ${top.id}`,()=>session.nativeSelect('stack',top.id,n.revision),false,`stack-${top.id}`),count=node('b',`×${run.length}`,'forge-stack-count');b.dataset.stackCount=String(run.length);b.setAttribute('aria-label',`${run.length} identical: ${top.text||'stack item'}`);b.append(count);stack.append(withYield(b,top));}panel.append(stack);}}
  const selected=presentation.hosted?null:s.status.surface.cards.find(c=>c.id===s.selected);if(selected)panel.append(button(copy(`Select ${selected.known?selected.name:'card'}`,`Send ${selected.known?selected.name:'card'} click to Forge`),()=>session.nativeSelect('card',selected.id,n.revision),false,'click-inspected'));
 }
 if(presentation.hosted){container.replaceChildren(panel);if(keepStripLeft){const strip=panel.querySelector('.forge-zone-search-cards');if(strip)strip.scrollLeft=keepStripLeft;}return;}
 const details=node('details',undefined,'forge-native-diagnostics'),table=container.closest('.play-match-table'),detailsSummary=node('summary',presentation.hosted?'Match details':'Proof details');detailsSummary.dataset.nativeKey='native-details';details.dataset.keepOpen='native-details';details.open=table?.dataset.forgeDetailsOpen==='true';details.addEventListener('toggle',()=>{if(table)table.dataset.forgeDetailsOpen=String(details.open);});details.append(detailsSummary);
 if(n.players.every(p=>p.deckAlias))details.append(node('p',n.players.map(p=>`${p.isViewer?'You':'Forge AI'}: ${deckLabel(p.deckAlias)}`).join(' vs ')));
 if(presentation.policyLabel)details.append(node('p',presentation.policyLabel));
 if(['smart','full'].includes(n.controlMode))details.append(node('p',n.controlMode==='smart'?'Native Smart assistance is active; required choices remain yours.':'Native Full Control is active; respond and pay through Forge prompts.'));
 if(compactStatus)details.append(node('p',n.message));
 if(p)details.append(node('p',`Native dialog: ${p.method} · ${p.id}`));
 details.append(node('p',copy('Click a highlighted card to play or select it, or drag it up onto the table. Hover, click any other card or press I to read its rules. Smart handles ordinary mana payment and empty response windows; Full Control lets you handle them yourself.','Click a card to send its native ID to Forge. Use its magnifier or I key to inspect. Drag a card onto your battlefield or this panel to send the same click. Player and stack choices use their native IDs. Unsupported dialogs stop visibly. Nothing here interprets card rules.')),node('p',`Native revision ${n.revision} · Engine input: ${n.inputType||'none'} · phase ${n.phase||'none'} · selected ${(n.selection?.chosen||[]).map(r=>r.kind+' '+r.id).join(', ')||'none'}`),node('p',presentation.hosted?'Keep this page open during your match. Refreshing or closing the page ends this session. Use the match menu to concede.':'Temporary proof only — not the production Play backend. No automatic passing, auto-win, hidden-state policy, account changes, or reconnect guarantee.'));panel.append(details);
 container.replaceChildren(panel);
}
