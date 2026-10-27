import {mountMatchTable} from '../phase-engine/match-table.mjs';
import {practiceArtworkHooks,resolvePracticeArtwork} from '../../play-card-surface.js';
import {practicePlayerPortrait} from '../../play-player-mat.js';
import {mountNativePanel} from './native-panel.mjs';
import {optionCardId} from './forge-session.mjs';
import {drawnArtwork,frameTone,surfaceColors} from '../../play-token-art.js';
import {sym,symbolName,symbolText,manaCost,esc} from '../../ui.js';
// Outline icons from the CardStashy UI packet (24-unit grid, currentColor).
const ZONE_ICONS={Library:'M6 3h14v16H6zM3 6v16h14M10 7h6M10 11h6',Graveyard:'M6 20V9a6 6 0 0 1 12 0v11M3 20h18M9 10h6M12 7v7',Exile:'m12 2 10 10-10 10L2 12zM8 12h14M17 7l5 5-5 5',Command:'M3 6l5 5 4-8 4 8 5-5-2 14H5zM5 16h14'};
const outlineIcon=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const MANA_ORDER=['W','U','B','R','G','C'];
// Plain-language reminders for the keywords players meet most. Anything else falls back
// to the key sentence of the bundled Comprehensive Rules entry, loaded on first use.
const KEYWORD_HINTS={flying:'Can only be blocked by creatures with flying or reach.',reach:'Can block creatures with flying.',haste:'Can attack and use {T} abilities the turn it arrives.',vigilance:'Attacking doesn\u2019t tap it.',trample:'Combat damage beyond what kills its blockers hits the player.',deathtouch:'Any damage it deals to a creature destroys that creature.',lifelink:'Damage it deals also gains you that much life.','first strike':'Deals combat damage before creatures without first strike.','double strike':'Deals first-strike and regular combat damage.',menace:'Can\u2019t be blocked except by two or more creatures.',hexproof:'Can\u2019t be the target of your opponents\u2019 spells or abilities.',shroud:'Can\u2019t be the target of any spell or ability.',indestructible:'Lethal damage and \u201cdestroy\u201d effects don\u2019t destroy it.',defender:'Can\u2019t attack.',flash:'Can be cast any time you could cast an instant.',ward:'Opponents\u2019 spells and abilities that target it are countered unless they pay the ward cost.',prowess:'Gets +1/+1 until end of turn whenever you cast a noncreature spell.',protection:'Can\u2019t be blocked, targeted, dealt damage, enchanted or equipped by anything with that quality.',infect:'Deals damage to creatures as -1/-1 counters and to players as poison counters.',fear:'Can only be blocked by artifact or black creatures.',intimidate:'Can only be blocked by artifact creatures or creatures that share a color with it.',flanking:'Creatures without flanking that block it get -1/-1 until end of turn.',changeling:'Is every creature type.',toxic:'Combat damage to a player also gives them that many poison counters.'};
const COUNTER_NAMES={P1P1:'+1/+1',M1M1:'\u22121/\u22121',LOYALTY:'Loyalty',DEFENSE:'Defense',CHARGE:'Charge',LORE:'Lore',TIME:'Time',SHIELD:'Shield',STUN:'Stun',OIL:'Oil',POISON:'Poison'};
const keywordKey=k=>String(k||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[:_]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
let keywordReference=null;
const loadKeywordReference=()=>keywordReference||(keywordReference=import('../../mtg-keyword-reference.js').then(m=>m.KEYWORD_REFERENCE).catch(()=>({})));
function keywordHint(name,reference){
 const k=keywordKey(name),base=Object.keys(KEYWORD_HINTS).find(h=>k===h||k.startsWith(h+' '));if(base)return KEYWORD_HINTS[base];
 const entry=reference&&(reference[k]||reference[Object.keys(reference).filter(h=>k.startsWith(h+' ')).sort((a,b)=>b.length-a.length)[0]]);if(!entry?.definition)return '';
 const sentence=entry.definition.replace(/\s*\(See rule[^)]*\)\.?/g,'').split(/(?<=\.\u201d?)\s+/).find(x=>!/^[\w\u2019' -]{2,40} (is|are) an? [\w -]*ability\b/i.test(x)&&x.length>12)||'';
 return sentence.length>170?sentence.slice(0,167).replace(/\s+\S*$/,'')+'\u2026':sentence;
}
export function mountForgeTable(root,{session,onExit=()=>{},profile={displayName:'You'},format='Commander',title='CardStashy · Local Forge proof',presentation={}}){
 const doc=root.ownerDocument,win=doc.defaultView,hooks=practiceArtworkHooks();let localError='',panelKey='',drag=null,ghost=null,suppressUntil=0,closed=false,nativeValueDraft=null,openingFocused=false;
 const reducedMotion=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const peek=doc.createElement('div');let peekFor=null,peekPinned=false,peekTimer=0,pressTimer=0,pressAt=null,pressShown=false,peekKey='';
 let lastSeen=null,castTimer=0;const failedArt=new Set();const spotlit=new Set(),castShow=doc.createElement('div');castShow.className='forge-cast';castShow.setAttribute('aria-hidden','true');castShow.dataset.open='false';doc.body.append(castShow);
 const table=mountMatchTable(root,{session,format,profile,title,allowConcede:false,onExit,pileIdentical:presentation.hosted===true,...hooks,
  resolveCard(card){const artwork=resolvePracticeArtwork(card);return {...artwork,oracleText:card.text};},
  // Frame every piece in its own colors; tokens and cards without a printing get a drawn crest instead of an empty tile.
  decorateCard(node,card){hooks.decorateCard(node,card);const name=String(card.name);if(Math.max(...name.split(/\s+/).map(word=>word.length))>=10)node.dataset.nameLength='word';else if(name.length>13)node.dataset.nameLength='long';const colors=surfaceColors(card,resolvePracticeArtwork(card)?.card),tone=frameTone(colors);if(tone){node.dataset.colors=tone.key;node.style.setProperty('--frame-a',tone.a);node.style.setProperty('--frame-b',tone.b);}if(card.isToken)node.dataset.token='true';const blank=node.querySelector('.play-match-card-back');if(blank){const art=drawnArtwork(doc,card,colors);if(node.dataset.presentation!=='battlefield')art.classList.add('play-drawn-full');blank.replaceWith(art);}},
  renderOracleText(text){const el=doc.createElement('p');el.textContent=text;el.className='play-match-rules';return el;},
  decorateInspector(panel,card){hooks.decorateInspector(panel,card);panel.querySelector('a[href^="#wiki/"]')?.remove();if(card.type){const type=doc.createElement('p');type.className='forge-current-type';type.setAttribute('aria-label','Current native type');type.textContent=card.type;panel.append(type);}const note=doc.createElement('p');note.className='forge-art-note';note.textContent=card.printing?(presentation.hosted?'Catalogue artwork; exact per-instance printing may be unavailable. Current text, types and state come from Forge.':'Artwork is a public reference printing. Rules text and current state above come from Forge.'):'Native Forge text; artwork is not available for this card.';panel.append(note);},
  renderPlayerPortrait(own){return practicePlayerPortrait(doc,own,profile);},
  renderMatchBackdrop(){const box=doc.createElement('div');for(const c of session.snapshot().status?.surface.cards.filter(c=>c.commander)||[]){const url=resolvePracticeArtwork(c)?.artImageUrl;if(url){const img=doc.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';box.append(img);}}return box.childNodes.length?box:null;}
 });
 const fail=e=>{localError=e.message||String(e);panelKey='';enhance();};
 const act=fn=>{try{const p=fn();if(p?.catch)p.catch(fail);}catch(e){fail(e);}};
 function enhance(){
  if(closed)return;const snap=session.snapshot(),n=snap.native;if(!snap.status||!n)return;
  if(presentation.hosted){const exit=root.querySelector('[data-focus-key=exit-match]');if(exit&&exit.textContent!=='Return to Play setup')exit.textContent='Return to Play setup';}
  const footer=root.querySelector('.play-match-decisions');if(!footer)return;
  const key=JSON.stringify([n.revision,snap.busy,snap.nativeDraft,snap.transportError,snap.selected,localError]);
  if(key!==panelKey||!footer.querySelector('[data-native-panel]')){
   // Preserve local typed input/focus if an unrelated inspection redraws the board.
   const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null,oldInput=footer.querySelector('[data-native-key=native-value]'),oldValue=oldInput?.value,oldRevision=footer.querySelector('[data-native-panel]')?.dataset.nativeRevision;
   mountNativePanel(footer,{session,snapshot:snap,onLocalError:message=>fail(Error(message)),presentation});panelKey=key;
   if(localError){const e=doc.createElement('p');e.className='forge-diagnostic';e.textContent=localError;e.setAttribute('role','alert');footer.querySelector('[data-native-panel]')?.append(e);}
   if(nativeValueDraft?.revision===n.revision&&nativeValueDraft?.promptId===n.prompt?.id){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=nativeValueDraft.value;}else if(oldRevision===String(n.revision)&&oldValue!==undefined){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=oldValue;}
   if(focused)footer.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus();
  }
  const ids=list=>new Set((list||[]).filter(r=>r.kind==='card').map(r=>r.id));
  const actionable=ids(n.selection?.actionable),targets=ids(n.selection?.targets),choices=ids(n.selection?.cards),chosen=ids(n.selection?.chosen);
  for(const index of snap.nativeDraft?.indexes||[]){const o=n.prompt?.options.find(o=>o.index===index);const cardId=optionCardId(o?.value);if(cardId!==null)chosen.add(cardId);}
  // Forge's own hint lists, shown by meaning: something you can play or use now,
  // a target for the spell or ability being cast, a card this prompt asks about,
  // and what you have already picked. Forge still validates every click.
  const discarding=!n.prompt&&choices.size>0&&/\bdiscard\b/i.test(String(n.message||''));
  const role=id=>chosen.has(id)?'chosen':targets.has(id)?'target':choices.has(id)?(discarding?'discard':'choice'):actionable.has(id)?'playable':'';
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const cardId=Number(el.dataset.instance),r=role(cardId);el.dataset.forgeHint=String(actionable.has(cardId)||targets.has(cardId)||choices.has(cardId));el.dataset.forgeChosen=String(chosen.has(cardId));if(el.dataset.forgeRole!==r)el.dataset.forgeRole=r;el.setAttribute('aria-description',presentation.hosted?'Click to play or select this card. Drag it up onto the table to play. Use the magnifier or press I to inspect.':'Click sends this card to Forge; legality is checked by Forge. Magnifier or I inspects without acting.');}
  const surface=snap.status.surface,nativePlayer=seat=>n.players.find(p=>p.id===surface.players.find(p=>p.seat===seat)?.nativeId);
  // Floating mana is the native pool only, never untapped lands or potential production.
  const manaEntries=player=>Object.entries(player?.mana||{}).map(([color,amount])=>[String(color).toUpperCase(),Number(amount)||0]);
  const manaLabel=entries=>{const live=entries.filter(([,a])=>a>0);return live.length?'Floating mana: '+live.map(([c,a])=>`${a} ${MANA_ORDER.includes(c)?symbolName(c).toLowerCase():c}`).join(', '):'No floating mana';};
  const playerTargets=new Set((n.selection?.targets||[]).filter(r=>r.kind==='player').map(r=>r.id)),playerChosen=new Set((n.selection?.chosen||[]).filter(r=>r.kind==='player').map(r=>r.id));
  for(const el of root.querySelectorAll('[data-player-seat]')){el.title=presentation.hosted?'Select this player as a target when prompted':'Click to send this player to Forge';const seat=Number(el.dataset.playerSeat),player=nativePlayer(seat);
   const seatRole=!player?'':playerChosen.has(player.id)?'chosen':playerTargets.has(player.id)?'target':'';if(presentation.hosted&&(el.dataset.forgeRole||'')!==seatRole)el.dataset.forgeRole=seatRole;
   if(presentation.hosted){
    // A targetable player is a real control for keyboard and screen readers too.
    if(seatRole==='target'&&el.tabIndex!==0){el.tabIndex=0;el.setAttribute('role','button');el.dataset.nativeKey=`seat-${el.dataset.seat}`;}else if(seatRole!=='target'&&el.hasAttribute('role')){el.removeAttribute('tabindex');el.removeAttribute('role');delete el.dataset.nativeKey;}
    // The player's commander art (or your profile picture) glows softly behind the panel.
    const own=el.dataset.seat==='you',commander=surface.cards.find(c=>c.commander===true&&c.known&&(c.owner===surface.seat)===own),artUrl=(commander&&resolvePracticeArtwork(commander)?.artImageUrl)||(own&&/^https?:/.test(profile.avatarUrl||'')?profile.avatarUrl:''),art=failedArt.has(artUrl)?'':artUrl;
    let glass=el.querySelector(':scope>.forge-seat-glass');
    if(art&&glass?.dataset.art!==art){if(!glass){glass=doc.createElement('span');glass.className='forge-seat-glass';glass.setAttribute('aria-hidden','true');el.prepend(glass);}glass.dataset.art=art;const img=doc.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.decoding='async';img.onerror=()=>{failedArt.add(img.src);failedArt.add(art);img.hidden=true;};img.src=art;glass.replaceChildren(img);}
    else if(!art&&glass)glass.remove();
   }let mana=el.querySelector('.forge-native-mana');const entries=manaEntries(player),live=entries.filter(([,a])=>a>0);
   if(!presentation.hosted){const text=player?.mana?Object.entries(player.mana).map(([color,amount])=>`${color} ${amount}`).join(' · '):'';if(text&&!mana){mana=doc.createElement('div');mana.className='forge-native-mana';mana.setAttribute('aria-label','Native mana pool');el.querySelector('.play-match-player')?.append(mana);}if(mana&&mana.textContent!==text)mana.textContent=text;continue;}
   // Seats show only colors actually floating; the full pool lives in the dock.
   const key=live.map(([c,a])=>c+a).join(',');if(live.length&&!mana){mana=doc.createElement('div');mana.className='forge-native-mana';el.querySelector('.play-match-player')?.append(mana);}
   if(mana&&mana.dataset.pool!==key){mana.dataset.pool=key;mana.setAttribute('aria-label',manaLabel(entries));mana.hidden=!live.length;mana.innerHTML=live.map(([c,a])=>`<span class="forge-mana-chip">${MANA_ORDER.includes(c)?sym(c):c}<b>${a}</b></span>`).join('');}
  }
  // Table extras exist only during the match itself, never on the opening hand.
  if(presentation.hosted&&root.dataset.stage!=='match')for(const el of root.querySelectorAll('.forge-zone-row,.forge-mana-panel'))el.remove();
  if(presentation.hosted&&root.dataset.stage==='match'){
   const mat=root.querySelector('.play-match-mat');
   // Each player's public zone counts sit beside their portrait; a count opens that list in the Zones menu.
   for(const p of surface.players){
    const own=p.seat===surface.seat,count=zone=>surface.cards.filter(c=>c.zone===zone&&c.owner===p.seat).length;
    const counts=[['Library',p.libraryCount],['Graveyard',count('Graveyard')],['Exile',count('Exile')],['Command',count('Command')]],key=counts.map(c=>c[1]).join(',');
    let row=mat?.querySelector(`.forge-zone-row[data-seat="${own?'you':'cpu'}"]`);
    if(mat&&!row){row=doc.createElement('nav');row.className='forge-zone-row';row.dataset.seat=own?'you':'cpu';row.setAttribute('aria-label',own?'Your zones':'CPU zones');mat.append(row);}
    if(row&&row.dataset.counts!==key){row.dataset.counts=key;row.replaceChildren(...counts.map(([zone,value])=>{const b=doc.createElement('button');b.type='button';b.dataset.zone=zone;b.dataset.nativeKey=`zone-${own?'you':'cpu'}-${zone}`;b.setAttribute('aria-label',`${own?'Your':'CPU'} ${zone.toLowerCase()}: ${value}`);b.innerHTML=`${outlineIcon(ZONE_ICONS[zone])}<span>${zone}</span><b>${value}</b>`;return b;}));}
   }
   // The CPU has no profile picture; its commander's art becomes its portrait.
   const cpuBadge=root.querySelector('.play-match-seat[data-seat=cpu] .play-match-profile-badge');
   const cpuCommander=surface.cards.find(c=>c.commander===true&&c.owner!==surface.seat&&c.known),cpuArt=cpuCommander?resolvePracticeArtwork(cpuCommander)?.artImageUrl:null;
   if(cpuBadge&&cpuArt&&cpuBadge.dataset.portrait!==cpuArt){cpuBadge.dataset.portrait=cpuArt;let img=cpuBadge.querySelector('img.forge-seat-portrait');if(!img){img=doc.createElement('img');img.className='forge-seat-portrait';img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{img.hidden=true;};cpuBadge.append(img);}img.src=cpuArt;}
   // The turn-change notice gets its banner art: whose turn large, the turn number small.
   const banner=root.querySelector('.play-match-turn-banner');
   if(banner&&!banner.dataset.owner){const [who,...rest]=banner.textContent.split(' · ');banner.dataset.owner=who==='Your turn'?'you':'cpu';const big=doc.createElement('strong'),small=doc.createElement('span');big.textContent=who;small.textContent=rest.join(' · ');banner.replaceChildren(big,small);}
   // Your floating mana, only while you have some: all six colors, zeros dimmed.
   const dock=root.querySelector('.play-match-decisions'),mine=manaEntries(nativePlayer(surface.seat)),poolKey=mine.map(([c,a])=>c+a).join(',');
   let pool=dock?.querySelector('.forge-mana-panel');
   if(dock&&!pool){pool=doc.createElement('section');pool.className='forge-mana-panel';dock.prepend(pool);}
   if(pool&&pool.dataset.pool!==poolKey){pool.dataset.pool=poolKey;pool.hidden=!mine.some(([,a])=>a>0);pool.setAttribute('aria-label',manaLabel(mine));const amount=c=>mine.find(([k])=>k===c)?.[1]||0;pool.innerHTML=`<h3 aria-hidden="true">Floating mana</h3><div aria-hidden="true">${MANA_ORDER.map(c=>`<span data-zero="${amount(c)===0}">${sym(c)}<b>${amount(c)}</b></span>`).join('')}</div>`;}
   // Each battlefield sizes its pieces so its creature row and its row of other
   // permanents both fit across: widths in piece units plus fixed gaps in pixels.
   for(const zone of root.querySelectorAll('.play-match-battlefields .play-match-zone')){
    const rows={c:[0,0],o:[0,0]};let otherLanes=0;
    for(const lane of zone.querySelectorAll('.play-match-lane')){const creature=lane.dataset.cardGroup==='creatures',row=creature?rows.c:rows.o,w=creature?1.18:.98;if(!creature&&otherLanes++)row[1]+=22;let first=true;
     for(const wrap of lane.querySelectorAll('.play-match-card-wrap')){const pile=wrap.dataset.pileIndex&&wrap.dataset.pileIndex!=='0';if(pile)row[0]+=w-(wrap.dataset.pileTight==='true'?(creature?1.12:.92):(creature?.94:.76));else{row[0]+=w;if(!first)row[1]+=16;}first=false;}}
    const fit=`${Math.max(1,rows.c[0]).toFixed(2)},${rows.c[1]},${Math.max(1,rows.o[0]).toFixed(2)},${rows.o[1]}`;
    if(zone.dataset.fit!==fit){zone.dataset.fit=fit;const [cu,cg,ou,og]=fit.split(',');zone.style.setProperty('--fit-cu',cu);zone.style.setProperty('--fit-cg',cg+'px');zone.style.setProperty('--fit-ou',ou);zone.style.setProperty('--fit-og',og+'px');}
   }
   // A gentle arc: cards further from the middle of the hand sit a little lower.
   // The count lets the hand tighten its spacing only when it would not fit.
   const hand=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')],handRow=root.querySelector('.play-match-hand .play-match-card-row');if(handRow&&handRow.style.getPropertyValue('--hand-count')!==String(hand.length))handRow.style.setProperty('--hand-count',String(hand.length));hand.forEach((w,i)=>{const lift=Math.abs(i-(hand.length-1)/2);const v=`${Math.min(Math.round(lift*lift*2.2),22)}px`;if(w.style.getPropertyValue('--arc-drop')!==v)w.style.setProperty('--arc-drop',v);});
  }

 }
 const saveInput=e=>{if(e.target.dataset?.nativeKey==='native-value'){const n=session.snapshot().native;nativeValueDraft={revision:n.revision,promptId:n.prompt?.id,value:e.target.value};}};
 root.addEventListener('input',saveInput);root.addEventListener('change',saveInput);
 const observer=new MutationObserver(()=>enhance());observer.observe(root,{childList:true,subtree:true});
 // Cards keep their engine identity between renders, so a card that moves (hand to
 // battlefield, a lane change) glides from where it was to where Forge put it, and a
 // permanent that appears from nowhere fades in. Purely visual; placement is Forge's.
 const positions=()=>{const m=new Map();for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const w=el.closest('.play-match-card-wrap')||el,r=w.getBoundingClientRect();if(r.width)m.set(el.dataset.instance,{r,hand:!!el.closest('.play-match-hand'),battlefield:el.dataset.presentation==='battlefield'});}return m;};
 const glide=before=>{
  if(!before.size||reducedMotion())return;let moved=0;
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){
   const w=el.closest('.play-match-card-wrap')||el,prev=before.get(el.dataset.instance),r=w.getBoundingClientRect();if(!r.width||moved>24)continue;
   if(prev){const dx=prev.r.left-r.left,dy=prev.r.top-r.top;if(Math.hypot(dx,dy)<6)continue;const s=Math.max(.4,Math.min(2.2,prev.r.width/r.width));moved++;w.animate([{transform:`translate(${dx}px,${dy}px) scale(${s})`,zIndex:50},{transform:'none',zIndex:50}],{duration:prev.hand&&el.dataset.presentation==='battlefield'?520:380,easing:'cubic-bezier(.2,.8,.2,1)'});}
   else if(el.dataset.presentation==='battlefield'){moved++;w.animate([{opacity:0,transform:'translateY(-14px) scale(.86)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});}
  }
 };
 // The CPU's moves can arrive together. Show them one beat at a time, the way a person
 // plays: lands, then taps, then each spell shown large, then what arrives, then life.
 // Purely visual and never longer than a few seconds: every card is already where
 // Forge put it, and nothing waits on this.
 const seenState=surface=>({cards:new Map(surface.cards.map(c=>[c.id,{zone:c.zone,tapped:c.tapped}])),stack:new Set((surface.stack||[]).map(x=>x.id)),life:new Map(surface.players.map(p=>[p.seat,p.life]))});
 function spotlight(c,delay){
  const art=resolvePracticeArtwork(c);if(!art?.imageUrl||spotlit.has(c.id))return;spotlit.add(c.id);
  setTimeout(()=>{if(closed)return;castShow.innerHTML=`<figure><img src="${esc(art.imageUrl)}" alt="" referrerpolicy="no-referrer" decoding="async"></figure><p><span>CPU</span>${esc(c.name)}</p>`;castShow.dataset.open='true';clearTimeout(castTimer);castTimer=setTimeout(()=>{castShow.dataset.open='false';},1250);},delay);
 }
 function paceCpu(surface){
  const prev=lastSeen;lastSeen=seenState(surface);if(!prev||!presentation.hosted||reducedMotion())return;
  const cpu=surface.players.find(p=>p.seat!==surface.seat)?.seat,node=id=>root.querySelector(`.play-match-card[data-instance="${id}"]`);
  const arrived=surface.cards.filter(c=>c.zone==='Battlefield'&&c.controller===cpu&&prev.cards.get(c.id)?.zone!=='Battlefield');
  const lands=arrived.filter(c=>/\bLand\b/.test(c.type||'')),others=arrived.filter(c=>!lands.includes(c));
  const tapped=surface.cards.filter(c=>c.zone==='Battlefield'&&c.controller===cpu&&c.tapped&&prev.cards.get(c.id)?.zone==='Battlefield'&&prev.cards.get(c.id).tapped===false);
  const cast=(surface.stack||[]).filter(x=>x.controller===cpu&&!prev.stack.has(x.id)).map(x=>surface.cards.find(c=>c.id===x.source)).filter(c=>c?.known&&!spotlit.has(c.id));
  const shown=[...cast,...others.filter(c=>c.known&&!c.isToken&&!spotlit.has(c.id))];
  const lifeChanged=surface.players.filter(p=>prev.life.has(p.seat)&&prev.life.get(p.seat)!==p.life);
  const beats=lands.length+(tapped.length?1:0)+shown.length*2+others.length;if(!beats&&!lifeChanged.length)return;
  const beat=Math.max(240,Math.min(480,2600/Math.max(1,beats)));let t=0;
  const reveal=c=>{const w=node(c.id)?.closest('.play-match-card-wrap');if(!w)return;for(const a of w.getAnimations())a.cancel();w.animate([{opacity:0,transform:'translateY(-18px) scale(.9)'},{opacity:1,transform:'none'}],{duration:380,delay:t,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});t+=beat;};
  for(const c of lands)reveal(c);
  if(tapped.length){for(const c of tapped){const el=node(c.id);if(el)el.animate([{transform:'none',filter:'none'},{transform:'rotate(12deg) scale(.95)',filter:'saturate(.5) brightness(.72)'}],{duration:320,delay:t,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});}t+=beat;}
  for(const c of shown){spotlight(c,t);t+=beat*2;}
  for(const c of others)reveal(c);
  for(const p of lifeChanged){const seat=root.querySelector(`.play-match-seat[data-player-seat="${p.seat}"]`),life=seat?.querySelector('.play-match-life strong');if(!seat||!life)continue;const delta=p.life-prev.life.get(p.seat),badge=doc.createElement('span');badge.className='forge-life-delta';badge.dataset.dir=delta<0?'down':'up';badge.textContent=(delta>0?'+':'\u2212')+Math.abs(delta);badge.setAttribute('aria-hidden','true');seat.append(badge);badge.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(-4px)',offset:.25},{opacity:1,transform:'translateY(-10px)',offset:.75},{opacity:0,transform:'translateY(-18px)'}],{duration:1300,delay:t,fill:'both'}).finished.then(()=>badge.remove(),()=>badge.remove());life.animate([{transform:'scale(1)'},{transform:'scale(1.22)',color:delta<0?'#ff9a8a':'#8fe7a3',offset:.35},{transform:'scale(1)'}],{duration:700,delay:t});}
 }
 // Arrows, Arena style: attackers to whom they attack, blockers to what they block, and
 // a spell or ability to the targets you have chosen. Only relations the state makes
 // certain are drawn: an attack goes to the player unless they also control something
 // attackable, and a block is paired only when Forge names the attacker or there is one.
 const SVG='http://www.w3.org/2000/svg',arrows=doc.createElementNS(SVG,'svg');arrows.setAttribute('class','forge-arrows');arrows.setAttribute('aria-hidden','true');doc.body.append(arrows);let arrowFrame=0;
 arrows.innerHTML=['attack','block','target'].map(k=>`<marker id="forge-head-${k}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="forge-head-${k}"/></marker>`).join('').replace(/^/,'<defs>').replace(/$/,'</defs>');
 function relations(snap){
  const n=snap.native,surface=snap.status?.surface;if(!n||!surface||root.dataset.stage!=='match')return [];
  const out=[],cards=surface.cards,bySeat=seat=>({kind:'seat',seat}),byCard=id=>({kind:'card',id}),playerSeat=nativeId=>surface.players.find(p=>p.nativeId===nativeId)?.seat;
  const attackers=cards.filter(c=>c.zone==='Battlefield'&&c.attacking);
  for(const a of attackers){
   const defending=surface.players.find(p=>p.seat!==a.controller)?.seat;
   const t=a.attackTarget,attackable=cards.some(c=>c.zone==='Battlefield'&&c.controller===defending&&/Planeswalker|Battle/.test(c.type||''));
   const to=t?.kind==='card'&&cards.some(c=>c.id===t.id)?byCard(t.id):t?.kind==='player'&&playerSeat(t.id)!==undefined?bySeat(playerSeat(t.id)):!attackable&&defending!==undefined?bySeat(defending):null;
   if(to)out.push({kind:'attack',from:byCard(a.id),to});
  }
  for(const b of cards.filter(c=>c.zone==='Battlefield'&&c.blocking)){
   const named=(b.blockingIds||[]).filter(id=>attackers.some(a=>a.id===id)),pair=named.length?named:attackers.length===1?[attackers[0].id]:[];
   for(const id of pair)out.push({kind:'block',from:byCard(b.id),to:byCard(id)});
  }
  if(n.inputType==='InputSelectTargets'){
   const named=String(n.message||'').match(/targets? for ([^\n]+)/i)?.[1]?.trim(),mine=c=>c.known&&c.controller===surface.seat;
   const source=cards.filter(c=>mine(c)&&c.zone==='Stack').sort((a,b)=>b.id-a.id)[0]||(named&&(cards.find(c=>mine(c)&&c.zone==='Battlefield'&&c.name===named)||cards.find(c=>mine(c)&&c.zone==='Hand'&&c.name===named)));
   if(source)for(const r of n.selection?.chosen||[]){const to=r.kind==='card'?byCard(r.id):r.kind==='player'&&playerSeat(r.id)!==undefined?bySeat(playerSeat(r.id)):null;if(to)out.push({kind:'target',from:byCard(source.id),to});}
  }
  // A spell or ability on the stack points from its line in the decision card to its
  // targets, when Forge names them.
  for(const item of n.stack||[])for(const r of Array.isArray(item.targets)?item.targets:[]){const to=r?.kind==='card'&&cards.some(c=>c.id===r.id)?byCard(r.id):r?.kind==='player'&&playerSeat(r.id)!==undefined?bySeat(playerSeat(r.id)):null;if(to)out.push({kind:'target',from:{kind:'stack',id:item.id},to});}
  return out;
 }
 function anchorRect(ref){
  const el=ref.kind==='seat'?root.querySelector(`.play-match-seat[data-player-seat="${ref.seat}"]`):ref.kind==='stack'?root.querySelector(`[data-native-key="stack-${ref.id}"]`):root.querySelector(`.play-match-card[data-instance="${ref.id}"]`);
  const box=el&&(el.closest('.play-match-card-wrap')||el).getBoundingClientRect();return box&&box.width>0?box:null;
 }
 function drawArrows(){
  arrowFrame=0;const list=relations(session.snapshot()),paths=[];
  for(const r of list){
   const a=anchorRect(r.from),b=anchorRect(r.to);if(!a||!b)continue;
   const ax=a.left+a.width/2,ay=a.top+a.height/2,bx=b.left+b.width/2,by=b.top+b.height/2,len=Math.hypot(bx-ax,by-ay);if(len<20)continue;
   // Start at the source's edge, stop short of the target's edge, and bow the line a little.
   const ux=(bx-ax)/len,uy=(by-ay)/len,start=Math.min(a.width,a.height)*.42,stop=Math.min(b.width,b.height)*.48+4;
   const sx=ax+ux*start,sy=ay+uy*start,ex=bx-ux*stop,ey=by-uy*stop,bend=Math.min(60,len*.16),cx=(sx+ex)/2-uy*bend,cy=(sy+ey)/2+ux*bend;
   paths.push(`<path class="forge-arrow" data-kind="${r.kind}" d="M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" marker-end="url(#forge-head-${r.kind})"/>`);
  }
  const defs=arrows.querySelector('defs')?.outerHTML||'',html=defs+paths.join('');if(arrows.dataset.html!==html){arrows.dataset.html=html;arrows.innerHTML=html;}
 }
 const queueArrows=()=>{if(!arrowFrame)arrowFrame=win.requestAnimationFrame(drawArrows);};
 win.addEventListener('resize',queueArrows);
 const unsub=session.subscribe(s=>{
  const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null;
  const before=presentation.hosted?positions():null;
  localError='';table.render(s);enhance();
  // The stylesheet scopes the Forge table by this attribute. It changes only when the
  // native panel comes or goes, unlike a :has() test that rechecks the whole table each redraw.
  root.toggleAttribute('data-forge-native',!!root.querySelector('.forge-native-panel'));
  if(before)glide(before);if(s.status?.surface)paceCpu(s.status.surface);
  if(peekFor){if(!peekFor.isConnected||!surfaceCard(peekFor)?.known)hidePeek();else showPeek(peekFor,peekPinned);}
  // Arrows follow cards that glide or reveal in place.
  queueArrows();setTimeout(queueArrows,420);setTimeout(queueArrows,900);
  if(focused)root.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  else if(presentation.hosted&&!openingFocused&&s.native?.inputType==='InputConfirmMulligan'){
   openingFocused=true;root.querySelector('[data-native-key=decision-title]')?.focus({preventScroll:true});
  }
 });

 // Card preview, Arena style: the whole card beside the one you point at, and what it
 // does right now beside that. Hover with a mouse, press and hold on touch, or use the
 // magnifier / I to pin it. It only reads the current native state.
 peek.className='forge-peek';peek.id=`forge-peek-${Date.now().toString(36)}`;peek.setAttribute('role','tooltip');peek.dataset.open='false';doc.body.append(peek);
 const surfaceCard=el=>session.snapshot().status?.surface.cards.find(c=>c.id===Number(el?.dataset.instance))||null;
 function peekHtml(c,reference){
  const art=resolvePracticeArtwork(c),printed=art?.card||{},face=printed.card_faces?.[0]&&!printed.mana_cost?printed.card_faces[0]:printed;
  const number=v=>v===null||v===undefined||v===''?null:Number(v),stat=(now,was)=>{const n=number(now),w=number(was);return `<b data-shift="${Number.isFinite(n)&&Number.isFinite(w)?(n>w?'up':n<w?'down':''):''}">${esc(String(now??'?'))}</b>`;};
  const creature=/Creature/.test(c.type||''),onBattlefield=c.zone==='Battlefield',keywords=[...new Set((c.keywords||[]).map(String))];
  const chips=[];
  if(onBattlefield&&c.tapped)chips.push(['tapped','Tapped']);
  if(c.attacking)chips.push(['attack','Attacking']);if(c.blocking)chips.push(['block','Blocking']);
  if(onBattlefield&&creature&&c.summoningSick&&!keywords.some(k=>keywordKey(k)==='haste'))chips.push(['sick','Can\u2019t attack yet']);
  if(c.damage>0)chips.push(['damage',`${c.damage} damage`]);
  for(const [kind,count]of Object.entries(c.counters||{}))if(Number(count)>0)chips.push(['counter',`${COUNTER_NAMES[kind]||kind.charAt(0)+kind.slice(1).toLowerCase()} \u00d7${count}`]);
  if(c.isToken)chips.push(['token','Token']);if(c.commander)chips.push(['commander','Commander']);
  const attached=[...(c.attachedTo?[c.attachedTo]:[])].map(id=>session.snapshot().status.surface.cards.find(x=>x.id===id)).filter(x=>x?.known).map(x=>`Attached to ${esc(x.name)}`);
  const withCards=(c.attachments||[]).map(id=>session.snapshot().status.surface.cards.find(x=>x.id===id)).filter(x=>x?.known).map(x=>esc(x.name));
  const explained=new Set(keywords.map(keywordKey));
  // The big card already shows its printed text; repeat the rules only where they differ
  // from it now (an ability gained in play, a token, a card with no image), and never a
  // line that only lists keywords explained above.
  const plain=t=>String(t||'').replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase(),printedSame=!!art?.imageUrl&&plain(c.text)===plain(art.oracleText);
  const lines=printedSame?[]:String(c.text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean).filter(line=>!line.replace(/\([^)]*\)/g,'').trim().split(/,\s*|\s+and\s+/).every(part=>explained.has(keywordKey(part.replace(/\.$/,'')))));
  const rule=line=>symbolText(line).replace(/\(([^)]*)\)/g,'<i>($1)</i>');
  const image=art?.imageUrl?`<img src="${esc(art.imageUrl)}" alt="" referrerpolicy="no-referrer" decoding="async">`:'';
  return `<figure class="forge-peek-card" data-art="${image?'image':'drawn'}">${image}</figure>
<section class="forge-peek-info">
 <header><h3>${esc(c.name)}</h3>${c.manaCost?manaCost({mana_cost:c.manaCost}):''}</header>
 ${c.type?`<p class="forge-peek-type">${esc(c.type)}</p>`:''}
 ${creature&&c.power!==null&&c.power!==undefined||chips.length?`<div class="forge-peek-state">${creature&&c.power!==null&&c.power!==undefined?`<span class="forge-peek-pt">${stat(c.power,face.power)}<i>/</i>${stat(c.toughness,face.toughness)}</span>`:''}${chips.map(([k,t])=>`<span class="forge-peek-chip" data-kind="${k}">${t}</span>`).join('')}</div>`:''}
 ${keywords.length?`<ul class="forge-peek-keywords">${keywords.map(k=>{const hint=keywordHint(k,reference);return `<li><b>${esc(k.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/:/g,' '))}</b>${hint?`<span>${symbolText(hint)}</span>`:''}</li>`;}).join('')}</ul>`:''}
 ${lines.length?`<div class="forge-peek-rules">${lines.map(l=>`<p>${rule(l)}</p>`).join('')}</div>`:''}
 ${attached.length||withCards.length?`<p class="forge-peek-attached">${[...attached,withCards.length?`With ${withCards.join(', ')}`:''].filter(Boolean).join(' \u00b7 ')}</p>`:''}
</section>`;
 }
 function placePeek(anchor){
  const r=anchor.getBoundingClientRect(),vw=win.innerWidth,vh=win.innerHeight,pw=peek.offsetWidth,ph=peek.offsetHeight,gap=14;
  let x,y;
  if(anchor.closest('.play-match-hand')){x=r.left+r.width/2-pw/2;y=r.top-ph-gap;}
  else{x=r.right+gap;if(x+pw>vw-8)x=r.left-gap-pw;y=r.top+r.height/2-ph/2;}
  x=Math.max(8,Math.min(vw-pw-8,x));y=Math.max(8,Math.min(vh-ph-8,y));
  peek.style.setProperty('--peek-x',`${Math.round(x)}px`);peek.style.setProperty('--peek-y',`${Math.round(y)}px`);
 }
 function showPeek(el,pinned=false){
  const c=surfaceCard(el);if(!c?.known||drag?.active){hidePeek();return;}
  const keyNow=JSON.stringify([c.id,c.name,c.text,c.power,c.toughness,c.damage,c.counters,c.tapped,c.attacking,c.blocking,c.summoningSick,c.keywords,c.attachedTo,c.attachments,c.zone]);
  const fill=reference=>{if(peekFor!==el)return;peek.innerHTML=peekHtml(c,reference);peekKey=keyNow;placePeek(el);};
  if(peekFor&&peekFor!==el)peekFor.removeAttribute('aria-describedby');
  peekFor=el;peekPinned=pinned;el.setAttribute('aria-describedby',peek.id);
  if(peekKey!==keyNow||peek.dataset.card!==String(c.id)){peek.dataset.card=String(c.id);fill(keywordReference&&typeof keywordReference.then!=='function'?keywordReference:null);loadKeywordReference().then(ref=>{if(peekFor===el&&peek.dataset.card===String(c.id)){peek.innerHTML=peekHtml(c,ref);placePeek(el);}});}else placePeek(el);
  peek.dataset.open='true';
 }
 function hidePeek(){clearTimeout(peekTimer);peek.dataset.open='false';peekFor?.removeAttribute('aria-describedby');peekFor=null;peekPinned=false;}
 const peekCard=e=>{const card=e.target.closest?.('.play-match-card[data-instance]');return card&&root.contains(card)&&!card.closest('.forge-drag-ghost')?card:null;};
 const over=e=>{if(e.pointerType==='touch'||peekPinned)return;const card=peekCard(e);if(!card)return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>showPeek(card),peekFor?40:240);};
 const out=e=>{if(e.pointerType==='touch'||peekPinned)return;const card=peekCard(e);if(!card||card.contains(e.relatedTarget))return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>{if(!peekPinned)hidePeek();},90);};
 const contextMenu=e=>{const card=peekCard(e);if(!card)return;e.preventDefault();e.stopImmediatePropagation();if(e.pointerType!=='touch'&&!pressAt)peekFor===card&&peekPinned?hidePeek():showPeek(card,true);};
 const peekKeys=e=>{const card=peekCard(e);if(card&&(e.key==='i'||e.key==='I')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();peekFor===card&&peekPinned?hidePeek():showPeek(card,true);return;}if(e.key==='Escape'&&peekFor){hidePeek();}};
 const reflow=()=>{if(peekFor)hidePeek();};
 root.addEventListener('pointerover',over);root.addEventListener('pointerout',out);root.addEventListener('contextmenu',contextMenu,true);root.addEventListener('keydown',peekKeys,true);win.addEventListener('resize',reflow);root.addEventListener('scroll',reflow,true);
 const click=e=>{
  const magnifier=e.target.closest?.('.play-match-inspect-card');if(magnifier&&root.contains(magnifier)){e.preventDefault();e.stopImmediatePropagation();const card=magnifier.closest('.play-match-card-wrap')?.querySelector('.play-match-card[data-instance]');if(card)peekFor===card&&peekPinned?hidePeek():showPeek(card,true);return;}
  if(peekPinned&&!e.target.closest?.('.forge-peek'))hidePeek();
  if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  const card=e.target.closest?.('.play-match-card[data-instance]');if(card&&root.contains(card)){e.preventDefault();e.stopImmediatePropagation();const snapshot=session.snapshot();if(snapshot.busy)return;const cardId=Number(card.dataset.instance);if(snapshot.native?.inputType==='InputConfirmMulligan'&&!snapshot.native.prompt){peekFor===card&&peekPinned?hidePeek():showPeek(card,true);}else{card.classList.remove('forge-pressed');void card.offsetWidth;card.classList.add('forge-pressed');setTimeout(()=>card.classList.remove('forge-pressed'),420);act(()=>session.nativeSelect('card',cardId));}return;}
  const player=e.target.closest?.('[data-player-seat]');if(player&&root.contains(player)){e.preventDefault();e.stopImmediatePropagation();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(player.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));return;}
  const zone=e.target.closest?.('.forge-zone-row button[data-zone]');if(zone&&root.contains(zone)){openZone(zone.closest('.forge-zone-row').dataset.seat,zone.dataset.zone);}
 };
 // Opens the existing Zones menu at that player's list; nothing new is revealed.
 function openZone(seat,zone){
  const menu=root.querySelector('.play-match-zones-menu');if(!menu)return;menu.open=true;
  const heading=[...menu.querySelectorAll('h3')].find(h=>h.textContent.startsWith(seat==='you'?'Your':'CPU'));
  for(let el=heading?.nextElementSibling;el&&el.tagName!=='H3';el=el.nextElementSibling)if(el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent.startsWith(zone==='Command'?'Command zone':zone)){el.open=true;el.querySelector('summary')?.focus();return;}
  menu.querySelector('summary')?.focus();
 }
 const cancel=()=>{drag=null;ghost?.remove();ghost=null;root.classList.remove('forge-dragging');};
 const down=e=>{if(e.button!==0||e.isPrimary===false)return;const card=e.target.closest?.('.play-match-card[data-instance]'),s=session.snapshot();
  if(card&&e.pointerType!=='mouse'){clearTimeout(pressTimer);pressAt={x:e.clientX,y:e.clientY,id:e.pointerId};pressShown=false;pressTimer=setTimeout(()=>{if(drag?.active)return;showPeek(card,true);pressShown=true;suppressUntil=Date.now()+60000;if(drag?.pointerId===e.pointerId)drag=null;},420);}
 if(!card||s.busy||s.native?.prompt||s.native?.inputType==='InputConfirmMulligan'||s.status?.terminal)return;drag={id:Number(card.dataset.instance),revision:s.status.revision,pointerId:e.pointerId,x:e.clientX,y:e.clientY,source:card,active:false};};
 // Drift cancels a press only before its preview opens; after that the press is kept so
 // its release or cancel still ends the 60 s click guard.
 const move=e=>{if(pressAt?.id===e.pointerId&&!pressShown&&Math.hypot(e.clientX-pressAt.x,e.clientY-pressAt.y)>8){clearTimeout(pressTimer);pressAt=null;}
  if(!drag||drag.pointerId!==e.pointerId)return;if(peekFor&&drag.active)hidePeek();if(drag.revision!==session.snapshot().status?.revision){cancel();return;}if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.active=true;if(!drag.active)return;if(e.cancelable)e.preventDefault();if(!ghost){ghost=drag.source.cloneNode(true);ghost.removeAttribute('data-instance');ghost.classList.add('forge-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');ghost.style.width=drag.source.getBoundingClientRect().width+'px';root.append(ghost);root.classList.add('forge-dragging');}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';};
 // Like Arena, a card dragged out of your hand plays when released anywhere above
 // the hand; Forge decides where it goes. Other drags keep their drop targets.
 const up=e=>{if(pressAt?.id===e.pointerId){clearTimeout(pressTimer);pressAt=null;if(pressShown){pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;}}
  if(!drag||drag.pointerId!==e.pointerId)return;const pending=drag,target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-placement-zone=battlefield],.forge-native-panel'),handTop=root.querySelector('.play-match-hand-area')?.getBoundingClientRect().top,fromHand=!!pending.source.closest('.play-match-hand'),overHand=!!doc.elementFromPoint(e.clientX,e.clientY)?.closest('.play-match-hand-area'),aboveHand=presentation.hosted&&fromHand&&handTop!==undefined&&e.clientY<handTop&&!overHand;if(pending.active)suppressUntil=Date.now()+300;cancel();if(pending.active&&(target&&root.contains(target)||aboveHand))act(()=>session.nativeSelect('card',pending.id,pending.revision));};
 // A press that the browser takes over (a scroll, a system gesture) ends the preview and its click guard.
 // A long press's 60 s click guard ends with that press even when a redraw, scroll or
 // resize already closed its preview; otherwise the table would ignore taps for a minute.
 const pressCancel=e=>{if(pressAt?.id===e.pointerId){clearTimeout(pressTimer);pressAt=null;pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;}cancel();};
 const key=e=>{if(e.key==='Escape')cancel();const seat=e.target.closest?.('[data-player-seat][role=button]');if(seat&&root.contains(seat)&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(seat.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));}};
 root.addEventListener('click',click,true);root.addEventListener('pointerdown',down);doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',pressCancel);doc.addEventListener('keydown',key);win.addEventListener('blur',cancel);
 return {destroy(){closed=true;unsub();observer.disconnect();cancel();hidePeek();clearTimeout(pressTimer);clearTimeout(castTimer);if(arrowFrame)win.cancelAnimationFrame(arrowFrame);win.removeEventListener('resize',queueArrows);peek.remove();castShow.remove();arrows.remove();root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('contextmenu',contextMenu,true);root.removeEventListener('keydown',peekKeys,true);win.removeEventListener('resize',reflow);root.removeEventListener('scroll',reflow,true);table.destroy();root.removeEventListener('input',saveInput);root.removeEventListener('change',saveInput);root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',down);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',pressCancel);doc.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);}};
}
