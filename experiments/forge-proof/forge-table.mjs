import {mountMatchTable} from '../phase-engine/match-table.mjs';
import {practiceArtworkHooks,resolvePracticeArtwork} from '../../play-card-surface.js';
import {practicePlayerPortrait} from '../../play-player-mat.js';
import {mountNativePanel} from './native-panel.mjs';
import {optionCardId} from './forge-session.mjs';
import {CpuActionPlaybackQueue,createPlaybackSession,tableActivity} from './cpu-action-playback.mjs';
import {tileBadges,tileLayerHtml,badgeSummary,currentKeywords,counterList,playerCounterBadges,playerCountersHtml} from '../../play-board-badges.js';
import {boardIcon} from '../../play-board-icons.js';
import {drawnArtwork,frameTone,surfaceColors} from '../../play-token-art.js';
import {sym,symbolName,symbolText,manaCost,esc} from '../../ui.js';
// Outline icons from the CardStashy UI packet (24-unit grid, currentColor).
const ZONE_ICONS={Library:'M6 3h14v16H6zM3 6v16h14M10 7h6M10 11h6',Graveyard:'M6 20V9a6 6 0 0 1 12 0v11M3 20h18M9 10h6M12 7v7',Exile:'m12 2 10 10-10 10L2 12zM8 12h14M17 7l5 5-5 5',Command:'M3 6l5 5 4-8 4 8 5-5-2 14H5zM5 16h14'};
// Short enough to read in full on a phone; the button's label still names the whole zone.
const ZONE_LABELS={Library:'Library',Graveyard:'Grave',Exile:'Exile',Command:'Cmdr'};
const SICK_EMBLEM='<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg><span class="cs-zzz"><i>z</i><i>z</i><i>z</i></span>';
const COMMANDER_EMBLEM='<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
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
 const authority=session;let displayed=authority.snapshot(),playbackBusy=false,activeBeat=null;
 session=createPlaybackSession(authority,{displayed:()=>displayed,busy:()=>playbackBusy});
 const doc=root.ownerDocument,win=doc.defaultView,hooks=practiceArtworkHooks();let localError='',panelKey='',drag=null,ghost=null,suppressUntil=0,closed=false,nativeValueDraft=null,openingFocused=false;
 const reducedMotion=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 let dockObserver=null,dockObserved=null;
 const peek=doc.createElement('div');let peekFor=null,peekPinned=false,peekTimer=0,pressTimer=0,pressAt=null,pressShown=false,peekKey='',lastPointerType='mouse';
 const failedArt=new Set(),castShow=doc.createElement('div');castShow.className='forge-cast';castShow.setAttribute('role','status');castShow.setAttribute('aria-live','polite');castShow.dataset.open='false';doc.body.append(castShow);
 // Whose move it is and what just happened, from the accepted state and the playback alone.
 const activity=doc.createElement('div');activity.className='forge-activity';activity.setAttribute('role','status');activity.setAttribute('aria-live','polite');activity.hidden=true;doc.body.append(activity);let playback=null;
 const table=mountMatchTable(root,{session,format,profile,title,allowConcede:false,onExit,pileIdentical:presentation.hosted===true,...hooks,
  resolveCard(card){const artwork=resolvePracticeArtwork(card);return {...artwork,oracleText:card.text};},
  // Frame every piece in its own colors; tokens and cards without a printing get a drawn crest instead of an empty tile.
  decorateCard(node,card){hooks.decorateCard(node,card);
   // Your foils shimmer on the table: a light, composited sheen on battlefield pieces (the hand keeps
   // the app's own foil). Etched is left plain here; its effect is too heavy for a live board.
   const finish=resolvePracticeArtwork(card)?.finish;
   if(finish==='etched'){for(const a of [...node.attributes])if(a.name.startsWith('data-finish'))node.removeAttribute(a.name);node.classList.remove('play-match-art-surface');delete node.dataset.csFoil;}
   else if(finish&&finish!=='nonfoil'&&node.dataset.presentation==='battlefield'){node.dataset.csFoil=finish;if(!node.querySelector(':scope>.cs-foil')){const sheen=doc.createElement('span');sheen.className='cs-foil';sheen.setAttribute('aria-hidden','true');sheen.style.animationDelay=`-${(Number(card.id)||0)%7}s`;node.append(sheen);}}
   else{delete node.dataset.csFoil;node.querySelector(':scope>.cs-foil')?.remove();}
const name=String(card.name);if(Math.max(...name.split(/\s+/).map(word=>word.length))>=10)node.dataset.nameLength='word';else if(name.length>13)node.dataset.nameLength='long';const colors=surfaceColors(card,resolvePracticeArtwork(card)?.card),tone=frameTone(colors);if(tone){node.dataset.colors=tone.key;node.style.setProperty('--frame-a',tone.a);node.style.setProperty('--frame-b',tone.b);}if(card.isToken)node.dataset.token='true';const blank=node.querySelector('.play-match-card-back');if(blank){const art=drawnArtwork(doc,card,colors);if(node.dataset.presentation!=='battlefield')art.classList.add('play-drawn-full');blank.replaceWith(art);}},
  renderOracleText(text){const el=doc.createElement('p');el.textContent=text;el.className='play-match-rules';return el;},
  decorateInspector(panel,card){hooks.decorateInspector(panel,card);panel.querySelector('a[href^="#wiki/"]')?.remove();if(card.type){const type=doc.createElement('p');type.className='forge-current-type';type.setAttribute('aria-label','Current native type');type.textContent=card.type;panel.append(type);}const note=doc.createElement('p');note.className='forge-art-note';note.textContent=card.printing?(presentation.hosted?'Catalogue artwork; exact per-instance printing may be unavailable. Current text, types and state come from Forge.':'Artwork is a public reference printing. Rules text and current state above come from Forge.'):'Native Forge text; artwork is not available for this card.';panel.append(note);},
  renderPlayerPortrait(own){return practicePlayerPortrait(doc,own,profile);},
  renderMatchBackdrop(){const box=doc.createElement('div');for(const c of session.snapshot().status?.surface.cards.filter(c=>c.commander)||[]){const url=resolvePracticeArtwork(c)?.artImageUrl;if(url){const img=doc.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';box.append(img);}}return box.childNodes.length?box:null;}
 });
 const panelPresentation={...presentation,symbolText,...(presentation.hosted?{controlsOnSeat:true,shortNext:true}:{})};
 const fail=e=>{if(e?.message==='MATCH_NOT_READY'&&playbackBusy){playback.flush();return;}localError=e.message||String(e);panelKey='';enhance();};
 const act=fn=>{try{const p=fn();if(p?.catch)p.catch(fail);}catch(e){fail(e);}};
 let railFrame=0;
 function enhance(){
  if(closed)return;const snap=session.snapshot(),n=snap.native;if(!snap.status||!n)return;
  if(presentation.hosted){const exit=root.querySelector('[data-focus-key=exit-match]');if(exit&&exit.textContent!=='Return to Play setup')exit.textContent='Return to Play setup';}
  const footer=root.querySelector('.play-match-decisions');if(!footer)return;
  const key=JSON.stringify([n.revision,snap.busy,snap.nativeDraft,snap.transportError,snap.selected,localError]);
  if(key!==panelKey||!footer.querySelector('[data-native-panel]')){
   // Preserve local typed input/focus if an unrelated inspection redraws the board.
   const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null,oldInput=footer.querySelector('[data-native-key=native-value]'),oldValue=oldInput?.value,oldRevision=footer.querySelector('[data-native-panel]')?.dataset.nativeRevision;
   mountNativePanel(footer,{session,snapshot:snap,onLocalError:message=>fail(Error(message)),presentation:panelPresentation});panelKey=key;
   if(localError){const e=doc.createElement('p');e.className='forge-diagnostic';e.textContent=localError;e.setAttribute('role','alert');const picker=footer.querySelector('.forge-zone-search-actions');if(picker)picker.before(e);else footer.querySelector('[data-native-panel]')?.append(e);}
   if(nativeValueDraft?.revision===n.revision&&nativeValueDraft?.promptId===n.prompt?.id){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=nativeValueDraft.value;}else if(oldRevision===String(n.revision)&&oldValue!==undefined){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=oldValue;}
   if(focused)footer.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus();
  }
  const ids=list=>new Set((list||[]).filter(r=>r.kind==='card').map(r=>r.id));
  const blockedWhy=new Map((n.selection?.blocked||[]).filter(b=>b?.kind==='card'&&typeof b.reason==='string').map(b=>[Number(b.id),b.reason])),actionable=ids(n.selection?.actionable),targets=ids(n.selection?.targets),choices=ids(n.selection?.cards),chosen=ids(n.selection?.chosen);
  for(const index of snap.nativeDraft?.indexes||[]){const o=n.prompt?.options.find(o=>o.index===index);const cardId=optionCardId(o?.value);if(cardId!==null)chosen.add(cardId);}
  // Forge's own hint lists, shown by meaning: something you can play or use now,
  // a target for the spell or ability being cast, a card this prompt asks about,
  // and what you have already picked. Forge still validates every click.
  const discarding=!n.prompt&&choices.size>0&&/\bdiscard\b/i.test(String(n.message||''));
  const role=id=>chosen.has(id)?'chosen':targets.has(id)?'target':choices.has(id)?(discarding?'discard':'choice'):actionable.has(id)?'playable':'';
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const cardId=Number(el.dataset.instance),r=role(cardId);el.dataset.forgeHint=String(actionable.has(cardId)||targets.has(cardId)||choices.has(cardId));el.dataset.forgeChosen=String(chosen.has(cardId));const why=!actionable.has(cardId)&&blockedWhy.get(cardId);if(why){el.dataset.forgeBlocked=why;el.title=why;}else if(el.dataset.forgeBlocked){delete el.dataset.forgeBlocked;el.removeAttribute('title');}if(el.dataset.forgeRole!==r)el.dataset.forgeRole=r;el.setAttribute('aria-description',presentation.hosted?'When highlighted, click to play or select this card, or drag it up onto the table to play. Otherwise click to see it larger. Press I to see it larger at any time.':'Click sends this card to Forge; legality is checked by Forge. Magnifier or I inspects without acting.');}
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
   // Upright tablets size the space above the decision card from its real height (it grows with the stack).
   const dockEl=root.querySelector('.play-match-decisions');if(dockEl!==dockObserved){dockObserver?.disconnect();dockObserved=dockEl;if(dockEl&&typeof ResizeObserver==='function'){dockObserver??=new ResizeObserver(([entry])=>{const h=Math.ceil(entry?.borderBoxSize?.[0]?.blockSize??entry?.contentRect.height??0);if(root.style.getPropertyValue('--dock-live')!==h+'px')root.style.setProperty('--dock-live',h+'px');});dockObserver.observe(dockEl);}}
   // Upright tablets set your hand beside your commander's card instead of under it.
   const yourCommander=String(!!root.querySelector('.play-command-zone[data-seat=you]'));if(root.dataset.yourCommander!==yourCommander)root.dataset.yourCommander=yourCommander;
   // Each player's public zone counts sit beside their portrait; a count opens that list in the Zones menu.
   for(const p of surface.players){
    const own=p.seat===surface.seat,count=zone=>surface.cards.filter(c=>c.zone===zone&&c.owner===p.seat).length;
    const counts=[['Library',p.libraryCount],['Graveyard',count('Graveyard')],['Exile',count('Exile')],['Command',count('Command')]],key=counts.map(c=>c[1]).join(',');
    let row=mat?.querySelector(`.forge-zone-row[data-seat="${own?'you':'cpu'}"]`);
    if(mat&&!row){row=doc.createElement('nav');row.className='forge-zone-row';row.dataset.seat=own?'you':'cpu';row.setAttribute('aria-label',own?'Your zones':'CPU zones');mat.append(row);}
    if(row&&row.dataset.counts!==key){row.dataset.counts=key;row.replaceChildren(...counts.map(([zone,value])=>{const b=doc.createElement('button');b.type='button';b.dataset.zone=zone;b.dataset.nativeKey=`zone-${own?'you':'cpu'}-${zone}`;b.setAttribute('aria-label',`${own?'Your':'CPU'} ${zone.toLowerCase()}: ${value}`);b.innerHTML=`${boardIcon('zone-'+zone.toLowerCase(),'cs-icon cs-zone-icon')||outlineIcon(ZONE_ICONS[zone])}<span>${ZONE_LABELS[zone]}</span><b>${value}</b>`;return b;}));}
   }
   // The history button carries the stack size as a badge.
   const history=root.querySelector('.play-match-header>[data-focus-key=table-details]'),stackCount=n.stack?.length?String(n.stack.length):'';if(history&&(history.dataset.count||'')!==stackCount){if(stackCount)history.dataset.count=stackCount;else delete history.dataset.count;}
   // Smart, Full Control and auto-pay are small emblems under your name, the way Arena keeps them by your portrait.
   const youInfo=root.querySelector('.play-match-seat[data-seat=you] .play-match-player'),modes=presentation.allowControlMode===true&&['smart','full'].includes(n.controlMode);
   let emblems=youInfo?.querySelector(':scope>.forge-control-emblems');
   const lock=!!n.prompt||n.inputType==='InputLockUI'||snap.busy===true,autoPay=typeof n.autoPay==='boolean'&&typeof session.setAutoPay==='function',emblemKey=[n.controlMode,autoPay?n.autoPay:'',lock].join(',');
   if(!modes||!youInfo)emblems?.remove();
   else if(!emblems||emblems.dataset.key!==emblemKey){
    if(!emblems){emblems=doc.createElement('div');emblems.className='forge-control-emblems';emblems.setAttribute('role','group');emblems.setAttribute('aria-label','Response controls');youInfo.append(emblems);}
    emblems.dataset.key=emblemKey;
    const make=(key,label,tip,icon,on,fn)=>{const b=doc.createElement('button');b.type='button';b.className='forge-control-emblem';b.dataset.nativeKey=key;b.dataset.label=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(on));b.title=tip;b.disabled=lock;b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;b.addEventListener('click',()=>act(fn));return b;};
    emblems.replaceChildren(
     make('mode-smart','Smart','Smart: automatic mana and passing empty response windows. Targets and required choices stay yours.','<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',n.controlMode==='smart',()=>session.setControlMode('smart')),
     make('mode-full','Full Control','Full Control: stop at every response window.','<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.5 1.5 0 0 1 2.5-1.7L8 15"/>',n.controlMode==='full',()=>session.setControlMode('full')),
     ...(autoPay?[make('auto-pay',n.autoPay?'Auto-pay mana: on':'Auto-pay mana: off','Auto-pay: pay mana costs automatically. Turn off to tap each source yourself.','<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5"/>',n.autoPay,()=>session.setAutoPay(!n.autoPay))]:[]));
   }
   // The CPU has no profile picture; its commander's art becomes its portrait.
   const cpuBadge=root.querySelector('.play-match-seat[data-seat=cpu] .play-match-profile-badge');
   const cpuCommander=surface.cards.find(c=>c.commander===true&&c.owner!==surface.seat&&c.known),cpuArt=cpuCommander?resolvePracticeArtwork(cpuCommander)?.artImageUrl:null;
   if(cpuBadge&&cpuArt&&cpuBadge.dataset.portrait!==cpuArt){cpuBadge.dataset.portrait=cpuArt;let img=cpuBadge.querySelector('img.forge-seat-portrait');if(!img){img=doc.createElement('img');img.className='forge-seat-portrait';img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{img.hidden=true;};cpuBadge.append(img);}img.src=cpuArt;}
   // The turn-change notice gets its banner art: whose turn large, the turn number small.
   const banner=root.querySelector('.play-match-turn-banner');
   if(banner&&!banner.dataset.owner){const [who,...rest]=banner.textContent.split(' · ');banner.dataset.owner=who==='Your turn'?'you':'cpu';const big=doc.createElement('strong'),small=doc.createElement('span');big.textContent=who;small.textContent=rest.join(' · ');banner.replaceChildren(big,small);}
   // Ambience: the board's corners breathe a soft fog in each player's colours, read from their
   // known cards (mana symbols and basic land types). Yours along the bottom, the CPU's along the top.
   const main=root.querySelector('.play-match-main');
   if(main){let amb=main.querySelector(':scope>.forge-ambient');if(!amb){amb=doc.createElement('div');amb.className='forge-ambient';amb.setAttribute('aria-hidden','true');amb.innerHTML='<i data-corner="tl"></i><i data-corner="tr"></i><i data-corner="bl"></i><i data-corner="br"></i>';main.prepend(amb);}
    const FOG={W:'#f3dfa0',U:'#4f9dff',B:'#9a78e0',R:'#ff6440',G:'#4fd27a',C:'#c9c2bc'},basics={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'};
    const palette=own=>{const tally=new Map();for(const c of surface.cards){if(!c.known||(c.owner===surface.seat)!==own)continue;const cols=new Set((String(c.manaCost||'').match(/\{[^}]+\}/g)||[]).flatMap(t=>t.slice(1,-1).split('/')).filter(x=>'WUBRG'.includes(x)&&x.length===1));for(const [t,k] of Object.entries(basics))if(new RegExp('\\b'+t+'\\b').test(c.type||''))cols.add(k);for(const k of cols)tally.set(k,(tally.get(k)||0)+(c.commander?4:1));}
     const top=[...tally].sort((a,b)=>b[1]-a[1]).map(([k])=>FOG[k]);return [top[0]||'#e8b95b',top[1]||top[0]||'#e8b95b'];};
    const [y1,y2]=palette(true),[c1,c2]=palette(false),ambKey=[y1,y2,c1,c2].join();
    const turn=surface.activeSeat===undefined?'':surface.activeSeat===surface.seat?'you':'cpu';if((amb.dataset.turn||'')!==turn)amb.dataset.turn=turn;
    if(amb.dataset.key!==ambKey){amb.dataset.key=ambKey;for(const [k,v] of Object.entries({'--amb-you-1':y1,'--amb-you-2':y2,'--amb-cpu-1':c1,'--amb-cpu-2':c2}))amb.style.setProperty(k,v);}}
   // Your floating mana, only while you have some: all six colors, zeros dimmed.
   const dock=root.querySelector('.play-match-decisions'),mine=manaEntries(nativePlayer(surface.seat)),poolKey=mine.map(([c,a])=>c+a).join(',');
   // Hosted tables keep it off the board: a card of mana emblems that opens from your portrait.
   const youSeat=presentation.hosted?root.querySelector('.play-match-seat[data-seat=you]'):null,poolHome=presentation.hosted?youSeat:dock;
   let pool=root.querySelector('.forge-mana-panel');
   if(pool&&pool.parentElement!==poolHome){pool.remove();pool=null;}
   if(poolHome&&!pool){pool=doc.createElement('section');pool.className='forge-mana-panel'+(presentation.hosted?' forge-seat-mana':'');pool.setAttribute('role','note');poolHome[presentation.hosted?'append':'prepend'](pool);}
   const ownPlayer=nativePlayer(surface.seat),untappedLands=surface.cards.filter(c=>c.zone==='Battlefield'&&c.controller===surface.seat&&c.known&&c.types?.includes('Land')&&!c.tapped).length;
   const used=ownPlayer?.landsPlayedThisTurn,allowed=ownPlayer?.landPlaysAllowed,hasLandCount=Number.isSafeInteger(used)&&used>=0&&Number.isSafeInteger(allowed)&&allowed>=used;
   const fullPoolKey=poolKey+'|'+untappedLands+'|'+(hasLandCount?used+'/'+allowed:'');
   if(pool&&pool.dataset.pool!==fullPoolKey){pool.dataset.pool=fullPoolKey;pool.hidden=!presentation.hosted&&!mine.some(([,a])=>a>0);if(youSeat)youSeat.dataset.floating=String(mine.some(([,a])=>a>0));pool.setAttribute('aria-label',manaLabel(mine)+`; ${untappedLands} untapped lands`+(hasLandCount?`; land plays used ${used} of ${allowed}`:''));const amount=c=>mine.find(([k])=>k===c)?.[1]||0;pool.innerHTML=presentation.hosted?`<h3>Mana pool</h3><div class="forge-seat-mana-row" aria-hidden="true">${MANA_ORDER.map(c=>`<span class="forge-mana-emblem" data-color="${c}" data-zero="${amount(c)===0}">${sym(c)}<b>${amount(c)}</b></span>`).join('')}</div><p class="forge-mana-sources"><span>Untapped lands <b>${untappedLands}</b></span>${hasLandCount?`<span class="forge-land-drop">Land plays <b>${used}/${allowed}</b></span>`:''}</p>`:`<h3>Floating mana</h3><div aria-hidden="true">${MANA_ORDER.map(c=>`<span data-zero="${amount(c)===0}">${sym(c)}<b>${amount(c)}</b></span>`).join('')}</div><p class="forge-mana-sources">Untapped lands <b>${untappedLands}</b>${hasLandCount?`<span class="forge-land-drop">Land plays <b>${used}/${allowed}</b></span>`:''}</p>`;}
   // Basic land subtypes grant these mana abilities. Mana colours are never inferred
   // from frame colour, artwork, colour identity, or a guessed Oracle sentence.
   const landColors={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'};
   for(const el of root.querySelectorAll('.play-match-card[data-presentation=battlefield]')){
    const card=surface.cards.find(c=>c.id===Number(el.dataset.instance));
    const colors=card?.known&&card.types?.includes('Land')?Object.entries(landColors).filter(([type])=>new RegExp('\\b'+type+'\\b').test(card.type||'')).map(([,color])=>color):[];
    let badge=el.querySelector('.forge-land-colors');if(!colors.length){badge?.remove();continue;}
    if(!badge){badge=doc.createElement('span');badge.className='forge-land-colors';el.append(badge);}
    const key=colors.join('');if(badge.dataset.colors!==key){badge.dataset.colors=key;badge.setAttribute('aria-label','Basic land types can produce '+colors.map(symbolName).join(' or '));badge.innerHTML=colors.map(c=>`<span class="forge-land-color" data-color="${c}" aria-hidden="true">${c}</span>`).join('');}
   }
   // Arena-style badges around the real art: state and activation corners, combat marker,
   // keyword rail, counters, damage, crew and attachments. Decoration only, from the
   // accepted snapshot; the card stays the one control and its name says it all.
   const byId=new Map(surface.cards.map(c=>[c.id,c])),printedStat=c=>{const art=resolvePracticeArtwork(c)?.card,face=art?.card_faces?.[0]&&!art.mana_cost?art.card_faces[0]:art;return face?[face.power,face.toughness]:null;};
   for(const el of root.querySelectorAll('.play-match-card[data-presentation=battlefield]')){
    const card=byId.get(Number(el.dataset.instance)),b=tileBadges(card,{actionable:actionable.has(card?.id),cardsById:byId}),html=tileLayerHtml(b);
    let layer=el.querySelector(':scope>.cs-tile-layer');
    if(!html){layer?.remove();}else{if(!layer){layer=doc.createElement('span');layer.className='cs-tile-layer';layer.setAttribute('aria-hidden','true');el.append(layer);}if(layer.dataset.html!==html){layer.dataset.html=html;layer.innerHTML=html;}}
    const wasSick=el.hasAttribute('data-kw-sick');
    for(const flag of ['flying','hexproof','indestructible','sick','commander'])el.toggleAttribute('data-kw-'+flag,!!b?.flags?.[flag]);
    // Summoning sickness and commander emblems; a short gold flash when a creature can attack.
    for(const [flag,cls,html] of [['sick','cs-emblem-sick',SICK_EMBLEM],['commander','cs-emblem-commander',COMMANDER_EMBLEM]]){let node=el.querySelector(':scope>.'+cls);if(!b?.flags?.[flag]){node?.remove();continue;}if(!node){node=doc.createElement('span');node.className='cs-emblem '+cls;node.setAttribute('aria-hidden','true');node.innerHTML=html;el.append(node);}}
    if(wasSick&&!b?.flags?.sick&&card?.zone==='Battlefield'){el.classList.remove('cs-woke');void el.offsetWidth;el.classList.add('cs-woke');setTimeout(()=>el.classList.remove('cs-woke'),800);}
    const summary=badgeSummary(b),label=el.getAttribute('aria-label')||'';if(summary&&!label.endsWith(summary))el.setAttribute('aria-label',`${label} \u00b7 ${summary}`);
    // Power and toughness read green above the printed card and red below it.
    const stats=el.querySelector('.play-current-stats'),printed=card?.known&&stats?printedStat(card):null;
    if(stats){const shift=(now,was)=>{const n=Number(now),w=Number(was);return was===undefined||was===null||!Number.isFinite(n)||!Number.isFinite(w)?'':n>w?'up':n<w?'down':'';};stats.dataset.shiftP=printed?shift(card.power,printed[0]):'';stats.dataset.shiftT=printed?shift(card.toughness,printed[1]):'';}
   }
   // Poison, energy and experience sit on each player's seat with live counts.
   for(const p of surface.players){const seat=root.querySelector(`.play-match-seat[data-player-seat="${p.seat}"]`);if(!seat)continue;const list=playerCounterBadges(p.counters),html=playerCountersHtml(list);let box=seat.querySelector(':scope>.cs-player-counters');if(!html){box?.remove();continue;}if(!box){box=doc.createElement('span');box.className='cs-player-counters';seat.append(box);}if(box.dataset.html!==html){box.dataset.html=html;box.innerHTML=html;box.setAttribute('aria-label',list.map(c=>`${c.count} ${c.label.toLowerCase()}`).join(', '));}}
   // Each battlefield sizes its pieces so its creature row and its row of other
   // permanents both fit across: widths in piece units plus fixed gaps in pixels.
   for(const zone of root.querySelectorAll('.play-match-battlefields .play-match-zone')){
    const rows={c:[0,0],o:[0,0]};let otherLanes=0;
    for(const lane of zone.querySelectorAll('.play-match-lane')){const creature=lane.dataset.cardGroup==='creatures',row=creature?rows.c:rows.o,w=creature?1.18:.98;if(!creature&&otherLanes++)row[1]+=22;let first=true;
     for(const wrap of lane.querySelectorAll('.play-match-card-wrap:not([data-attached])')){const pile=wrap.dataset.pileIndex&&wrap.dataset.pileIndex!=='0';if(pile)row[0]+=w-(wrap.dataset.pileTight==='true'?(creature?1.12:.92):(creature?.94:.76));else{row[0]+=w;if(!first)row[1]+=16;}first=false;}}
    const fit=`${Math.max(1,rows.c[0]).toFixed(2)},${rows.c[1]},${Math.max(1,rows.o[0]).toFixed(2)},${rows.o[1]}`;
    if(zone.dataset.fit!==fit){zone.dataset.fit=fit;const [cu,cg,ou,og]=fit.split(',');zone.style.setProperty('--fit-cu',cu);zone.style.setProperty('--fit-cg',cg+'px');zone.style.setProperty('--fit-ou',ou);zone.style.setProperty('--fit-og',og+'px');}
   }
   fitRails();
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
   if(prev){const dx=prev.r.left-r.left,dy=prev.r.top-r.top;if(Math.hypot(dx,dy)<6)continue;const s=Math.max(.4,Math.min(2.2,prev.r.width/r.width));moved++;const played=prev.hand&&el.dataset.presentation==='battlefield';w.animate(played?[{transform:`translate(${dx}px,${dy}px) scale(${s})`,zIndex:50},{transform:'translateY(-12px) scale(1.14)',filter:'brightness(1.3) drop-shadow(0 0 14px #f0c46a)',zIndex:50,offset:.68},{transform:'none',filter:'none',zIndex:50}]:[{transform:`translate(${dx}px,${dy}px) scale(${s})`,zIndex:50},{transform:'none',zIndex:50}],{duration:played?600:380,easing:'cubic-bezier(.2,.8,.2,1)'});}
   else if(el.dataset.presentation==='battlefield'){moved++;w.animate([{opacity:0,transform:'translateY(-14px) scale(.86)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});}
  }
 };
 // Four short sequences that explain ordinary play, drawn only from what Forge accepted between two
 // boards: mana flowing from the sources that tapped to the spell they paid for, a permanent settling
 // onto the battlefield, combat damage landing, and an Equipment or Aura joining its host. Each one
 // reads where a card actually is now; nothing is invented, no face-down card is named, and reduced
 // motion turns them all off. Timings are starting points to tune on a real Fold.
 const MANA_TINT={W:'#f4ecc8',U:'#6fb7ff',B:'#b48ad8',R:'#ff7a52',G:'#5fd37e',C:'#cfd3da'};
 const fx=doc.createElement('div');fx.className='forge-fx';fx.setAttribute('aria-hidden','true');doc.body.append(fx);
 const rectOf=el=>{const b=el&&(el.closest('.play-match-card-wrap')||el).getBoundingClientRect();return b&&b.width>0?b:null;};
 const cardEl=id=>root.querySelector(`.play-match-card[data-instance="${id}"]`);
 const sourceTint=c=>{if(!c?.known)return MANA_TINT.C;const basic=Object.entries({Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'}).find(([t])=>new RegExp('\\b'+t+'\\b').test(c.type||''));if(basic)return MANA_TINT[basic[1]];const pip=/\{([WUBRG])\}/.exec(c.text||'');return MANA_TINT[pip?.[1]]||'#e3bb68';};
 function stream(from,to,tint,delay){
  const a=rectOf(from),b=to&&(to.getBoundingClientRect?.()||to);if(!a||!b?.width)return;
  const dot=doc.createElement('span');dot.className='forge-fx-mana';dot.style.setProperty('--tint',tint);fx.append(dot);
  const x0=a.left+a.width/2,y0=a.top+a.height/2,x1=b.left+b.width/2,y1=b.top+b.height/2,mx=(x0+x1)/2-(y1-y0)*.18,my=(y0+y1)/2+(x1-x0)*.18;
  dot.animate([{transform:`translate(${x0}px,${y0}px) scale(.6)`,opacity:0},{transform:`translate(${mx}px,${my}px) scale(1.15)`,opacity:1,offset:.45},{transform:`translate(${x1}px,${y1}px) scale(.4)`,opacity:0}],{duration:520,delay,easing:'cubic-bezier(.3,.1,.3,1)',fill:'both'}).finished.then(()=>dot.remove(),()=>dot.remove());
 }
 function pulse(el,kind,tint){
  const w=el&&(el.closest('.play-match-card-wrap')||el);if(!w)return;
  const ring=doc.createElement('span');ring.className='forge-fx-ring';ring.dataset.kind=kind;if(tint)ring.style.setProperty('--tint',tint);w.append(ring);
  ring.animate([{opacity:.9,transform:'scale(.92)'},{opacity:0,transform:'scale(1.18)'}],{duration:kind==='land'?380:520,easing:'ease-out'}).finished.then(()=>ring.remove(),()=>ring.remove());
 }
 function popNumber(el,text,kind){
  const r=rectOf(el);if(!r)return;const n=doc.createElement('span');n.className='forge-fx-number';n.dataset.kind=kind;n.textContent=text;fx.append(n);
  n.style.left=`${r.left+r.width/2}px`;n.style.top=`${r.top+r.height*.35}px`;
  n.animate([{opacity:0,transform:'translate(-50%,6px) scale(.7)'},{opacity:1,transform:'translate(-50%,-6px) scale(1.15)',offset:.25},{opacity:1,transform:'translate(-50%,-14px) scale(1)',offset:.7},{opacity:0,transform:'translate(-50%,-24px)'}],{duration:1100,fill:'both'}).finished.then(()=>n.remove(),()=>n.remove());
 }
 function boardEffects(prev,next,before){
  const a=prev?.status?.surface,b=next?.status?.surface;if(!a||!b||!presentation.hosted||reducedMotion()||root.dataset.stage!=='match')return;
  const was=new Map(a.cards.map(c=>[c.id,c])),onField=c=>c.zone==='Battlefield';
  // 1. Mana payment: sources that just tapped send their mana to the spell or ability that appeared
  // on the stack (or, while paying, to the dock that holds the payment).
  const tapped=b.cards.filter(c=>onField(c)&&c.tapped&&was.get(c.id)?.zone==='Battlefield'&&was.get(c.id)?.tapped===false&&!c.attacking);
  const oldStack=new Set((prev.native?.stack||[]).map(x=>x.id)),fresh=(next.native?.stack||[]).find(x=>!oldStack.has(x.id));
  const sink=fresh&&root.querySelector(`[data-native-key="stack-${fresh.id}"]`)||(String(next.native?.inputType||'').startsWith('InputPayMana')?root.querySelector('.play-match-decisions'):null)||(fresh?castShow.dataset.open==='true'&&castShow:null);
  if(sink&&tapped.length&&tapped.length<=8)tapped.forEach((c,i)=>{const el=cardEl(c.id);pulse(el,'tap',sourceTint(c));stream(el,sink,sourceTint(c),i*70);});
  // 2. Arrival: a permanent that is new to the battlefield settles with a ring (lands in their colour).
  // Tokens arriving together get one ring each at most six, so a swarm reads as one arrival.
  let rings=0;for(const c of b.cards){if(!onField(c)||was.get(c.id)?.zone==='Battlefield'||rings>=6)continue;const el=cardEl(c.id);if(!el)continue;rings++;const land=c.known&&c.types?.includes('Land');
   // The card itself drops onto the table from your side (or the CPU's) and settles, then the ring.
   const w=el.closest('.play-match-card-wrap'),own=c.controller===b.seat;if(w&&rings<=3&&!before?.has(String(c.id)))w.animate([{transform:`translateY(${own?34:-34}px) scale(1.22)`,opacity:.35,filter:'brightness(1.6)'},{transform:'translateY(0) scale(.96)',opacity:1,filter:'brightness(1.25)',offset:.62},{transform:'none',opacity:1,filter:'none'}],{duration:land?380:520,easing:'cubic-bezier(.2,.75,.25,1)'});
   setTimeout(()=>{if(el.isConnected)pulse(el,land?'land':c.known&&c.types?.includes('Creature')?'creature':'permanent',land?sourceTint(c):null);},land?300:420);}
  // 3. Combat impact: damage newly marked on a creature pops as a number where it lands; attackers
  // that dealt it lean in toward what they attacked. Life totals already count on the seats.
  const damaged=b.cards.filter(c=>onField(c)&&c.known&&(c.damage||0)>(was.get(c.id)?.damage||0)&&was.get(c.id)?.zone==='Battlefield');
  const lifeLost=b.players.some(p=>p.life<(a.players.find(x=>x.seat===p.seat)?.life??p.life));
  const combat=/Damage$/.test(String(b.phase||''))||/Damage$/.test(String(a.phase||''));
  if(combat&&(damaged.length||lifeLost)){
   for(const c of a.cards.filter(c=>c.attacking&&b.cards.some(x=>x.id===c.id))){const el=cardEl(c.id),w=el?.closest('.play-match-card-wrap'),r=rectOf(el);if(!w||!r)continue;
    const t=c.attackTarget?.kind==='card'?rectOf(cardEl(c.attackTarget.id)):rectOf(root.querySelector(`.play-match-seat[data-player-seat="${b.players.find(p=>p.nativeId===c.attackTarget?.id)?.seat??b.players.find(p=>p.seat!==c.controller)?.seat}"]`));
    const dx=t?(t.left+t.width/2-(r.left+r.width/2))*.12:0,dy=t?(t.top+t.height/2-(r.top+r.height/2))*.12:c.controller===b.seat?-14:14;
    w.animate([{transform:'none'},{transform:`translate(${dx}px,${dy}px) scale(1.04)`,offset:.35},{transform:'none'}],{duration:420,easing:'cubic-bezier(.3,.1,.3,1)'});}
   damaged.forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(el){popNumber(el,`−${c.damage-(was.get(c.id)?.damage||0)}`,'damage');pulse(el,'hit');}},180+i*60));
  }
  // 3b. Declared: a new attacker surges forward toward what it attacks and settles; a new blocker
  // steps across to meet its attacker with a blue shield flash. Arrows then hold the pairing.
  const lean=(el,to,amount,ms)=>{const w=el?.closest('.play-match-card-wrap'),r=rectOf(el),t=rectOf(to);if(!w||!r)return;const dx=t?(t.left+t.width/2-(r.left+r.width/2))*amount:0,dy=t?(t.top+t.height/2-(r.top+r.height/2))*amount:0;
   w.animate([{transform:'none'},{transform:`translate(${dx}px,${dy}px) scale(1.08)`,offset:.45},{transform:'none'}],{duration:ms,easing:'cubic-bezier(.3,.1,.3,1)'});};
  b.cards.filter(c=>onField(c)&&c.attacking&&was.get(c.id)?.zone==='Battlefield'&&!was.get(c.id)?.attacking).slice(0,8).forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(!el?.isConnected)return;
   const to=c.attackTarget?.kind==='card'?cardEl(c.attackTarget.id):root.querySelector(`.play-match-seat[data-player-seat="${b.players.find(p=>p.nativeId===c.attackTarget?.id)?.seat??b.players.find(p=>p.seat!==c.controller)?.seat}"]`);
   lean(el,to,.1,460);pulse(el,'attack');},i*70));
  b.cards.filter(c=>onField(c)&&c.blockingIds?.length&&(c.blockingIds.length>(was.get(c.id)?.blockingIds?.length||0))).slice(0,8).forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(!el?.isConnected)return;lean(el,cardEl(c.blockingIds[c.blockingIds.length-1]),.22,520);pulse(el,'block');},i*70));
  // 4. Attach: an Equipment or Aura that joined a host glides there (the card glide does the travel);
  // the host's stats flash so the change it brings is noticed.
  for(const c of b.cards){if(!onField(c)||!Number.isSafeInteger(c.attachedTo)||was.get(c.id)?.attachedTo===c.attachedTo)continue;const host=cardEl(c.attachedTo);if(!host)continue;
   setTimeout(()=>{if(!host.isConnected)return;pulse(host,'attach');host.querySelector('.play-current-stats')?.animate([{transform:'scale(1)'},{transform:'scale(1.25)',filter:'brightness(1.6)',offset:.4},{transform:'scale(1)'}],{duration:600});},380);}
 }
 // Hold the previous accepted board while a meaningful observed update is announced.
 // Only projected public cards reach this queue; it cannot recover events omitted by a poll.
 function showPlaybackBeat(beat){
  activeBeat=beat;const mat=root.querySelector('.play-match-mat');
  // Over a decision the story is told in the activity line and the stack's arrows; a spotlight
  // there would cover the very prompt it explains.
  if(playback?.overlay){updateActivity();return;}
  if(beat.kind==='phase'){
   const banner=doc.createElement('div');banner.className='forge-playback-status';banner.setAttribute('role','status');banner.textContent=beat.label;if(beat.tone)banner.dataset.tone=beat.tone;mat?.append(banner);
  }else if(beat.card){
   const c=beat.card,art=resolvePracticeArtwork(c);
   castShow.innerHTML=`<figure>${art?.imageUrl?`<img src="${esc(art.imageUrl)}" alt="" referrerpolicy="no-referrer" decoding="async">`:''}</figure><p><span>${esc(beat.label)}</span><strong>${esc(c.name)}</strong></p>${beat.text?`<div class="forge-cast-text">${symbolText(beat.text)}</div>`:''}`;
   if(!art?.imageUrl)castShow.querySelector('figure').append(drawnArtwork(doc,c,surfaceColors(c)));
   castShow.dataset.open='true';castShow.dataset.kind=beat.kind;
  }
  queueArrows();updateActivity();
 }
 function clearPlaybackBeat(){activeBeat=null;castShow.dataset.open='false';root.querySelector('.forge-playback-status')?.remove();queueArrows();updateActivity();}
 let activityKey='';
 function updateActivity(){
  const a=presentation.hosted&&root.dataset.stage==='match'&&playback?tableActivity(displayed,{beat:activeBeat,overlay:playback.overlay,recent:playback.recent}):null;
  const key=a?`${a.kind}|${a.label}|${a.detail}`:'';if(key===activityKey)return;activityKey=key;
  activity.hidden=!a;if(!a)return;
  activity.dataset.kind=a.kind;activity.innerHTML=`<strong>${esc(a.label)}</strong>${a.detail?`<span>${esc(a.detail)}</span>`:''}`;
  activity.title=playback.recent.join('\n');
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
  if(activeBeat&&castShow.dataset.open==='true')for(const r of activeBeat.targets||[]){const to=r.kind==='card'&&cards.some(c=>c.id===r.id)?byCard(r.id):r.kind==='player'&&playerSeat(r.id)!==undefined?bySeat(playerSeat(r.id)):null;if(to)out.push({kind:'target',from:{kind:'spotlight'},to});}
  return out;
 }
 function anchorRect(ref){
  const el=ref.kind==='spotlight'?castShow:ref.kind==='seat'?root.querySelector(`.play-match-seat[data-player-seat="${ref.seat}"]`):ref.kind==='stack'?root.querySelector(`[data-native-key="stack-${ref.id}"]`):root.querySelector(`.play-match-card[data-instance="${ref.id}"]`);
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
 // Counters stack down a tile's right edge between its name and its P/T box; a tile too
 // short for the stack shows them in a row just above the box. All reads, then the writes.
 function fitRails(){
  railFrame=0;if(closed)return;
  const topIn=(node,card)=>{let y=0;for(let n=node;n&&n!==card;n=n.offsetParent)y+=n.offsetTop;return y;};
  const layers=[...root.querySelectorAll('.play-match-battlefields .play-match-card>.cs-tile-layer')];
  const floors=layers.map(layer=>{const el=layer.parentElement,rail=layer.querySelector(':scope>.cs-counters'),name=el.querySelector('.play-match-card-name'),floor=el.querySelector('.play-current-stats')||layer.querySelector(':scope>.cs-plaque');if(!rail||!name||!floor)return null;const n=rail.childElementCount,floorTop=topIn(floor,el),need=topIn(name,el)+name.offsetHeight+3+n*(rail.firstElementChild?.offsetHeight||0)+(n-1)*2;return need>floorTop-2?`${el.clientHeight-floorTop+3}px`:null;});
  layers.forEach((layer,i)=>{const v=floors[i];layer.toggleAttribute('data-rail-row',!!v);if(v&&layer.style.getPropertyValue('--cs-floor')!==v)layer.style.setProperty('--cs-floor',v);});
 }
 const queueRails=()=>{if(!railFrame)railFrame=win.requestAnimationFrame(fitRails);};
 win.addEventListener('resize',queueRails);
 function renderAccepted(s,blocked=false){
  const previous=displayed,lifeBefore=new Map((displayed?.status?.surface?.players||[]).map(p=>[p.seat,p.life]));displayed=s;playbackBusy=blocked;root.dataset.forgePlayback=String(blocked);root.setAttribute('aria-busy',String(blocked));
  const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null;
  const before=presentation.hosted?positions():null;
  localError='';table.render(session.snapshot());enhance();
  // The stylesheet scopes the Forge table by this attribute. It changes only when the
  // native panel comes or goes, unlike a :has() test that rechecks the whole table each redraw.
  root.toggleAttribute('data-forge-native',!!root.querySelector('.forge-native-panel'));
  doc.body.toggleAttribute('data-forge-search',!!root.querySelector('.forge-zone-search'));
  if(before&&!blocked){glide(before);boardEffects(previous,s,before);}
  if(presentation.hosted&&!reducedMotion())for(const p of s.status?.surface?.players||[]){const was=lifeBefore.get(p.seat);if(was===undefined||was===p.life)continue;const seat=root.querySelector(`.play-match-seat[data-player-seat="${p.seat}"]`),life=seat?.querySelector('.play-match-life strong');if(!seat||!life)continue;const delta=p.life-was,badge=doc.createElement('span');badge.className='forge-life-delta';badge.dataset.dir=delta<0?'down':'up';badge.textContent=(delta>0?'+':'\u2212')+Math.abs(delta);badge.setAttribute('aria-hidden','true');seat.append(badge);badge.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(-4px)',offset:.25},{opacity:1,transform:'translateY(-10px)',offset:.75},{opacity:0,transform:'translateY(-18px)'}],{duration:1300,fill:'both'}).finished.then(()=>badge.remove(),()=>badge.remove());life.animate([{transform:'scale(1)'},{transform:'scale(1.22)',color:delta<0?'#ff9a8a':'#8fe7a3',offset:.35},{transform:'scale(1)'}],{duration:700});}
  // A redraw that replaced the card's element keeps its open preview on the new one.
  if(peekFor&&!peekFor.isConnected){const again=root.querySelector(`.play-match-card[data-instance="${CSS.escape(peekFor.dataset.instance||'')}"]`);if(again){peekFor.removeAttribute('aria-describedby');peekFor=again;}}
  if(peekFor){if(!peekFor.isConnected||!surfaceCard(peekFor)?.known)hidePeek();else showPeek(peekFor,peekPinned);}
  // Arrows follow cards that glide or reveal in place.
  queueArrows();setTimeout(queueArrows,420);setTimeout(queueArrows,900);
  if(focused)root.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  else if(presentation.hosted&&!openingFocused&&s.native?.inputType==='InputConfirmMulligan'){
   openingFocused=true;root.querySelector('[data-native-key=decision-title]')?.focus({preventScroll:true});
  }
  updateActivity();
  if(drag?.active)markDrops();
  if(!blocked){autoPassOwnStack(s);autoPassIdle(s);}
 }
 // Smart, the way Arena plays: once your own spell or ability is on top of the stack and
 // priority is back with you, pass it for you so it resolves (the CPU may still respond).
 // One pass per stack state; Full Control keeps the stop. Forge still decides everything.
 let autoPassed='';
 function autoPassOwnStack(s){
  const n=s?.native,top=n?.stack?.[0];
  if(!presentation.hosted||!n||!top||n.controlMode!=='smart'||s.busy||s.transportError||n.prompt||n.failure||n.status!=='running'&&n.status!==undefined
   ||n.inputType!=='InputPassPriority'||n.priorityPlayer!==n.viewer||top.activatingPlayer!==n.viewer||n.buttons?.okEnabled!==true)return;
  const key=`${n.revision}:${top.id}:${n.stack.length}`;if(autoPassed===key)return;autoPassed=key;
  act(()=>session.nativeButton('ok',n.revision));
 }
 // Smart also moves on when your main phase has nothing left to play, as Arena does:
 // after your last land or spell resolves, a short beat to see it land, then Next.
 // Any playable card, stack item, prompt or Full Control keeps the stop.
 let idleTimer=0,idleKey='';
 const idleReady=s=>{const n=s?.native;return !!(presentation.hosted&&n&&n.controlMode==='smart'&&!s.busy&&!s.transportError&&!n.prompt&&!n.failure&&(n.status==='running'||n.status===undefined)
   &&n.inputType==='InputPassPriority'&&n.priorityPlayer===n.viewer&&n.activePlayer===n.viewer&&['MAIN1','MAIN2'].includes(n.phase)&&!n.stack?.length&&!(n.selection?.actionable||[]).length&&n.buttons?.okEnabled===true&&!drag?.active&&!playback?.running);};
 function autoPassIdle(s){
  const n=s?.native,key=n?`${n.revision}:${n.phase}`:'';
  if(!idleReady(s)){clearTimeout(idleTimer);idleTimer=0;return;}
  if(idleKey===key)return;idleKey=key;clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{idleTimer=0;const now=session.snapshot();if(closed||!idleReady(now)||now.native.revision!==n.revision)return;act(()=>session.nativeButton('ok',n.revision));},reducedMotion()?250:900);
 }
 playback=new CpuActionPlaybackQueue({present:renderAccepted,beat:showPlaybackBeat,clear:clearPlaybackBeat,reducedMotion});
 // A tap skips held playback. Playback over a decision never holds the board, so a tap there
 // only clears the spotlight and goes on to whatever was tapped.
 const skipPlayback=e=>{if(!playback.running||e.button>0)return;if(playback.overlay){playback.stop();return;}suppressUntil=Date.now()+400;playback.flush();};
 root.addEventListener('pointerdown',skipPlayback,true);
 const unsub=authority.subscribe(s=>{if(presentation.hosted)playback.push(s);else renderAccepted(s);});

 // Card preview, Arena style: the whole card beside the one you point at, and what it
 // does right now beside that. Hover with a mouse, press and hold on touch, click or
 // tap a card you can't act on, or press I. It only reads the current native state.
 peek.className='forge-peek';peek.id=`forge-peek-${Date.now().toString(36)}`;peek.setAttribute('role','tooltip');peek.dataset.open='false';doc.body.append(peek);
 const surfaceCard=el=>session.snapshot().status?.surface.cards.find(c=>c.id===Number(el?.dataset.instance))||null;
 function peekHtml(c,reference){
  const art=resolvePracticeArtwork(c),printed=art?.card||{},face=printed.card_faces?.[0]&&!printed.mana_cost?printed.card_faces[0]:printed;
  const number=v=>v===null||v===undefined||v===''?null:Number(v),stat=(now,was)=>{const n=number(now),w=number(was);return `<b data-shift="${Number.isFinite(n)&&Number.isFinite(w)?(n>w?'up':n<w?'down':''):''}">${esc(String(now??'?'))}</b>`;};
  const creature=/Creature/.test(c.type||''),onBattlefield=c.zone==='Battlefield',kwList=currentKeywords(c),keywords=[...new Set(kwList.map(k=>k.text))],kwIcon=new Map(kwList.map(k=>[k.text,k.key]));
  // The preview names each board icon beside what it means.
  const counterIcon=new Map(counterList(c.counters).map(x=>[x.name,x.icon])),chipIcon={tapped:'tapped',attack:'attacking',block:'blocking',sick:'summoning-sick',damage:'marked-damage',commander:'commander'};
  const chips=[];
  if(onBattlefield&&c.tapped)chips.push(['tapped','Tapped']);
  if(c.attacking)chips.push(['attack','Attacking']);if(c.blocking)chips.push(['block','Blocking']);
  if(onBattlefield&&creature&&c.summoningSick&&!keywords.some(k=>keywordKey(k)==='haste'))chips.push(['sick','Can\u2019t attack yet']);
  if(c.damage>0)chips.push(['damage',`${c.damage} damage`]);
  for(const [kind,count]of Object.entries(c.counters||{}))if(Number(count)>0)chips.push(['counter',`${COUNTER_NAMES[kind]||kind.charAt(0)+kind.slice(1).toLowerCase()} \u00d7${count}`,counterIcon.get(kind)]);
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
 ${creature&&c.power!==null&&c.power!==undefined||chips.length?`<div class="forge-peek-state">${creature&&c.power!==null&&c.power!==undefined?`<span class="forge-peek-pt">${stat(c.power,face.power)}<i>/</i>${stat(c.toughness,face.toughness)}</span>`:''}${chips.map(([k,t,icon])=>`<span class="forge-peek-chip" data-kind="${k}">${boardIcon(icon||chipIcon[k],'cs-icon forge-peek-icon')}${t}</span>`).join('')}</div>`:''}
 ${keywords.length?`<ul class="forge-peek-keywords">${keywords.map(k=>{const hint=keywordHint(k,reference);return `<li><b>${boardIcon(kwIcon.get(k),'cs-icon forge-peek-icon')}${esc(k.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/:/g,' '))}</b>${hint?`<span>${symbolText(hint)}</span>`:''}</li>`;}).join('')}</ul>`:''}
 ${lines.length?`<div class="forge-peek-rules">${lines.map(l=>`<p>${rule(l)}</p>`).join('')}</div>`:''}
 ${attached.length||withCards.length?`<p class="forge-peek-attached">${[...attached,withCards.length?`With ${withCards.join(', ')}`:''].filter(Boolean).join(' \u00b7 ')}</p>`:''}
</section>`;
 }
 function placePeek(anchor){
  // Wide screens dock the preview in the open space on the right, between the CPU seat and
  // the dock, so it never covers the board; narrow screens keep it beside the card.
  const top=Math.max(...['.play-match-seat[data-seat=cpu]','.forge-zone-row[data-seat=cpu]'].map(q=>root.querySelector(q)?.getBoundingClientRect().bottom||0)),bottom=root.querySelector('.play-match-decisions')?.getBoundingClientRect().top||win.innerHeight;
  const docked=presentation.hosted&&win.innerWidth>=1200&&win.innerWidth/win.innerHeight>=1.3&&bottom-top>=320;
  peek.dataset.docked=String(docked);if(docked)peek.style.setProperty('--peek-dock-h',`${Math.round(bottom-top-90)}px`);
  const r=anchor.getBoundingClientRect(),vw=win.innerWidth,vh=win.innerHeight,pw=peek.offsetWidth,ph=peek.offsetHeight,gap=14;
  let x,y;
  if(docked){x=vw-pw-24;y=Math.max(top+16,Math.min(bottom-ph-12,top+16));}
  else if(anchor.closest('.play-match-hand')){x=r.left+r.width/2-pw/2;y=r.top-ph-gap;}
  else{x=r.right+gap;if(x+pw>vw-8)x=r.left-gap-pw;y=r.top+r.height/2-ph/2;}
  x=Math.max(8,Math.min(vw-pw-8,x));y=Math.max(8,Math.min(vh-ph-8,y));
  peek.style.setProperty('--peek-x',`${Math.round(x)}px`);peek.style.setProperty('--peek-y',`${Math.round(y)}px`);
 }
 function showPeek(el,pinned=false){
  if(pinned)clearTimeout(peekTimer);const c=surfaceCard(el);if(!c?.known||drag?.active){hidePeek();return;}
  const keyNow=JSON.stringify([c.id,c.name,c.text,c.power,c.toughness,c.damage,c.counters,c.tapped,c.attacking,c.blocking,c.summoningSick,c.keywords,c.attachedTo,c.attachments,c.zone]);
  const fill=reference=>{if(peekFor!==el)return;peek.innerHTML=peekHtml(c,reference);peekKey=keyNow;peekAction(el);placePeek(el);};
  if(peekFor&&peekFor!==el)peekFor.removeAttribute('aria-describedby');
  peekFor=el;peekPinned=pinned;el.setAttribute('aria-describedby',peek.id);
  if(peekKey!==keyNow||peek.dataset.card!==String(c.id)){peek.dataset.card=String(c.id);fill(keywordReference&&typeof keywordReference.then!=='function'?keywordReference:null);loadKeywordReference().then(ref=>{if(peekFor===el&&peek.dataset.card===String(c.id)){peek.innerHTML=peekHtml(c,ref);peekAction(el);placePeek(el);}});}else{peekAction(el);}placePeek(el);
  peek.dataset.open='true';
 }
 function hidePeek(){clearTimeout(peekTimer);peek.dataset.open='false';peek.dataset.pinned='false';peekFor?.removeAttribute('aria-describedby');peekFor=null;peekPinned=false;}
 // A pinned preview of a card you can play or use right now offers that as one button.
 function peekAction(el){
  peek.querySelector('.forge-peek-play')?.remove();peek.querySelector('.forge-peek-blocked')?.remove();peek.dataset.pinned=String(peekPinned);
  // Why Forge would not let you play or use it right now ("Need 2 mana"), before you try.
  if(el.dataset.forgeBlocked){const why=doc.createElement('p');why.className='forge-peek-blocked';why.setAttribute('role','note');why.textContent=el.dataset.forgeBlocked;(peek.querySelector('.forge-peek-info')||peek).append(why);}peek.setAttribute('role',peekPinned?'dialog':'tooltip');
  // A press-and-hold preview closes when the finger lifts, so it never offers a button.
  const n=session.snapshot().native;if(!peekPinned||pressAt||!presentation.hosted||el.dataset.forgeHint!=='true'||n?.inputType!=='InputPassPriority'||n?.prompt)return;
  const b=doc.createElement('button');b.type='button';b.className='forge-peek-play';b.dataset.peekPlay='true';b.textContent=el.closest('.play-match-hand')?'Play':'Use';
  (peek.querySelector('.forge-peek-info')||peek).append(b);
 }
 // Tapping the open card closes it; its Play button plays it.
 peek.addEventListener('click',e=>{if(!e.target.closest?.('[data-peek-play]')){hidePeek();return;}e.preventDefault();e.stopPropagation();const card=peekFor,s=session.snapshot();
  if(!card||card.dataset.forgeHint!=='true'||s.busy){hidePeek();return;}const id=Number(card.dataset.instance);hidePeek();act(()=>session.nativeSelect('card',id));});
 const peekCard=e=>{const card=e.target.closest?.('.play-match-card[data-instance]');return card&&root.contains(card)&&!card.closest('.forge-drag-ghost')?card:null;};
 const over=e=>{if(e.pointerType==='touch'||peekPinned)return;const card=peekCard(e);if(!card)return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>showPeek(card),peekFor?40:240);};
 const out=e=>{if(e.pointerType==='touch'||peekPinned)return;const card=peekCard(e);if(!card||card.contains(e.relatedTarget))return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>{if(!peekPinned)hidePeek();},90);};
 const contextMenu=e=>{const card=peekCard(e);if(!card)return;e.preventDefault();e.stopImmediatePropagation();if(e.pointerType!=='touch'&&!pressAt)peekFor===card&&peekPinned?hidePeek():showPeek(card,true);};
 const peekKeys=e=>{const card=peekCard(e);if(card&&(e.key==='i'||e.key==='I')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();peekFor===card&&peekPinned?hidePeek():showPeek(card,true);return;}if(e.key==='Escape'&&peekFor){hidePeek();}};
 // Arrows are drawn in viewport coordinates, so a scrolling lane moves the cards under them.
 const reflow=()=>{if(peekFor)hidePeek();queueArrows();};
 root.addEventListener('pointerover',over);root.addEventListener('pointerout',out);root.addEventListener('contextmenu',contextMenu,true);root.addEventListener('keydown',peekKeys,true);win.addEventListener('resize',reflow);root.addEventListener('scroll',reflow,true);
 // A click acts only on a card Forge offers. Where Forge has listed exactly what can be
 // clicked (priority, targets, a card choice), any other card opens its preview instead;
 // for other inputs (attacks, blocks, mana payment) every click still goes to Forge.
 // On touch, a tap while you hold priority always opens the card; when you can play or use
 // it, the preview carries that button, and dragging it up from your hand plays it.
 const LISTED_INPUTS=new Set(['InputPassPriority','InputSelectTargets']);
 const previewOnly=(card,snapshot,touch=false)=>{
  const n=snapshot.native;if(!n||snapshot.status?.terminal||n.inputType==='InputLockUI')return true;
  if(n.inputType==='InputConfirmMulligan'&&!n.prompt)return true;
  if(touch&&n.inputType==='InputPassPriority'&&!n.prompt)return true;
  if(card.dataset.forgeHint==='true'||card.dataset.forgeChosen==='true')return false;
  return !n.prompt&&(LISTED_INPUTS.has(n.inputType)||!n.inputType&&(n.selection?.cards?.length||0)>0);
 };
 const click=e=>{
  const pinned=peekPinned&&peekFor;if(peekPinned&&!e.target.closest?.('.forge-peek'))hidePeek();
  if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  const card=e.target.closest?.('.play-match-card[data-instance]');if(card&&root.contains(card)){e.preventDefault();e.stopImmediatePropagation();const snapshot=session.snapshot(),cardId=Number(card.dataset.instance);if(previewOnly(card,snapshot,(e.pointerType||lastPointerType)==='touch')){pinned===card?hidePeek():showPeek(card,true);}else if(!snapshot.busy){card.classList.remove('forge-pressed');void card.offsetWidth;card.classList.add('forge-pressed');setTimeout(()=>card.classList.remove('forge-pressed'),420);act(()=>session.nativeSelect('card',cardId));}return;}
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
 // Combat by drag, the way Arena does it: a blocker dropped on an attacker blocks it, and an
 // attacker dropped on a player or planeswalker attacks it. While you drag, what you could drop
 // on is lit; Forge still judges the pairing, and tapping one card then the other still works.
 function combatDrops(cardId){
  const s=session.snapshot(),n=s.native,surface=s.status?.surface;if(!n||n.prompt||!surface)return null;
  const card=surface.cards.find(c=>c.id===cardId);
  if(!card?.known||card.zone!=='Battlefield'||card.controller!==surface.seat||!card.types?.includes('Creature'))return null;
  const opponent=surface.players.find(p=>p.seat!==surface.seat);if(!opponent)return null;
  if(n.inputType==='InputBlock'&&!card.attacking){const attackers=surface.cards.filter(c=>c.zone==='Battlefield'&&c.attacking&&c.controller===opponent.seat);return attackers.length?{mode:'block',targets:attackers.map(a=>({kind:'card',id:a.id}))}:null;}
  if(n.inputType==='InputAttack')return {mode:'attack',targets:[{kind:'player',seat:opponent.seat,nativeId:opponent.nativeId},...surface.cards.filter(c=>c.zone==='Battlefield'&&c.controller===opponent.seat&&/\b(Planeswalker|Battle)\b/.test(c.type||'')).map(c=>({kind:'card',id:c.id}))]};
  return null;
 }
 const dropElement=t=>t.kind==='player'?root.querySelector(`.play-match-seat[data-player-seat="${t.seat}"]`):root.querySelector(`.play-match-card[data-instance="${t.id}"]`);
 // Re-applied after every redraw, so a board update during a drag keeps the lit targets.
 function markDrops(){
  for(const el of root.querySelectorAll('[data-forge-drop]'))el.removeAttribute('data-forge-drop');
  if(!drag?.active||!drag.combat){delete root.dataset.forgeDragMode;return;}
  root.dataset.forgeDragMode=drag.combat.mode;
  for(const t of drag.combat.targets){const el=dropElement(t);if(el)el.dataset.forgeDrop=drag.over===t?'over':'true';}
 }
 const dropTargetAt=(x,y)=>{if(!drag?.combat)return null;const hit=doc.elementFromPoint(x,y);if(!hit)return null;return drag.combat.targets.find(t=>{const el=dropElement(t);return el&&(el===hit||el.contains(hit)||(el.closest('.play-match-card-wrap')||el).contains(hit));})||null;};
 // Waits until the table is ready for the next click of a two-click pairing.
 const settled=(ms=4000)=>new Promise(resolve=>{let off=null,timer=0;const done=ok=>{clearTimeout(timer);off?.();resolve(ok);};const check=s=>{if(!s.busy&&!playbackBusy)done(true);};off=authority.subscribe(check);timer=setTimeout(()=>done(false),ms);});
 async function dropCombat(plan,cardId,target){
  const s=session.snapshot(),card=s.status?.surface.cards.find(c=>c.id===cardId),input=s.native?.inputType;if(!card)return;
  if(plan.mode==='block'){
   if(card.blockingIds?.includes(target.id))return;
   await session.nativeSelect('card',target.id);
  }else{
   const same=card.attacking&&card.attackTarget&&(target.kind==='player'?card.attackTarget.kind==='player'&&card.attackTarget.id===target.nativeId:card.attackTarget.kind==='card'&&card.attackTarget.id===target.id);
   if(same)return;
   await (target.kind==='player'?session.nativeSelect('player',target.nativeId):session.nativeSelect('card',target.id));
  }
  // The second click only when Forge took the first and is still asking the same question.
  if(!await settled())return;
  const now=session.snapshot();if(now.native?.lastActionError||now.native?.inputType!==input||now.native?.prompt||!now.status?.surface.cards.some(c=>c.id===cardId))return;
  await session.nativeSelect('card',cardId);
 }
 // Arena's lift: a playable card from your hand glows blue in the hand and turns gold once
 // it is high enough to play; the lane it will settle in lights up softly under it.
 const laneFor=card=>{const c=surfaceCard(card);if(!c?.known)return '';return c.types?.includes('Creature')?'creatures':c.types?.includes('Land')?'lands':c.types?.some(t=>['Artifact','Enchantment','Planeswalker','Battle'].includes(t))?'other':'';};
 function markPlayDrop(e){
  if(!ghost||!drag?.active||drag.combat)return;
  const fromHand=!!drag.source.closest('.play-match-hand'),playable=drag.source.dataset.forgeRole==='playable';
  const hit=doc.elementFromPoint(e.clientX,e.clientY),handTop=root.querySelector('.play-match-hand-area')?.getBoundingClientRect().top;
  const ready=presentation.hosted&&fromHand&&playable&&(!!hit?.closest('[data-placement-zone=battlefield]')||handTop!==undefined&&e.clientY<handTop&&!hit?.closest('.play-match-hand-area'));
  const state=ready?'ready':fromHand&&playable?'lift':'';if((ghost.dataset.drop||'')!==state)ghost.dataset.drop=state;
  const lane=ready?laneFor(drag.source):'';
  for(const el of root.querySelectorAll('[data-forge-lane-drop]'))if(el.dataset.cardGroup!==lane||!el.closest('[data-placement-zone=battlefield]'))el.removeAttribute('data-forge-lane-drop');
  const groups=root.querySelector('[data-placement-zone=battlefield] .play-match-zone-groups');
  if(lane&&groups){const at=groups.querySelector(`.play-match-lane[data-card-group="${lane}"]`);if(at)at.dataset.forgeLaneDrop='true';else groups.dataset.forgeLaneDrop=lane;}
  if(groups&&groups.dataset.forgeLaneDrop&&(!lane||groups.querySelector(`.play-match-lane[data-card-group="${lane}"]`)))delete groups.dataset.forgeLaneDrop;
 }
 const cancel=()=>{drag=null;ghost?.remove();ghost=null;root.classList.remove('forge-dragging');for(const el of root.querySelectorAll('[data-forge-lane-drop]'))el.removeAttribute('data-forge-lane-drop');markDrops();};
 const down=e=>{lastPointerType=e.pointerType||'mouse';if(e.button!==0||e.isPrimary===false)return;const card=e.target.closest?.('.play-match-card[data-instance]'),s=session.snapshot();
  if(card&&e.pointerType!=='mouse'){clearTimeout(pressTimer);pressAt={x:e.clientX,y:e.clientY,id:e.pointerId};pressShown=false;pressTimer=setTimeout(()=>{if(drag?.active)return;showPeek(card,true);pressShown=true;suppressUntil=Date.now()+60000;if(drag?.pointerId===e.pointerId)drag=null;},420);}
 if(!card||s.busy||s.native?.prompt||s.native?.inputType==='InputConfirmMulligan'||s.status?.terminal)return;drag={id:Number(card.dataset.instance),revision:s.status.revision,pointerId:e.pointerId,x:e.clientX,y:e.clientY,source:card,active:false};};
 // Drift cancels a press only before its preview opens; after that the press is kept so
 // its release or cancel still ends the 60 s click guard.
 const move=e=>{if(pressAt?.id===e.pointerId&&!pressShown&&Math.hypot(e.clientX-pressAt.x,e.clientY-pressAt.y)>8){clearTimeout(pressTimer);pressAt=null;}
  if(!drag||drag.pointerId!==e.pointerId)return;if(peekFor&&drag.active)hidePeek();if(drag.revision!==session.snapshot().status?.revision&&!session.snapshot().status?.surface.cards.some(c=>c.id===drag.id)){cancel();return;}if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){drag.active=true;drag.combat=combatDrops(drag.id);}if(!drag.active)return;if(e.cancelable)e.preventDefault();if(!ghost){ghost=drag.source.cloneNode(true);ghost.removeAttribute('data-instance');ghost.classList.add('forge-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');ghost.style.width=drag.source.getBoundingClientRect().width+'px';root.append(ghost);root.classList.add('forge-dragging');}ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';markPlayDrop(e);if(drag.combat){const over=dropTargetAt(e.clientX,e.clientY);if(over!==drag.over||!root.querySelector('[data-forge-drop]')){drag.over=over;markDrops();}}};
 // Like Arena, a card dragged out of your hand plays when released anywhere above
 // the hand; Forge decides where it goes. Other drags keep their drop targets.
 const up=e=>{if(pressAt?.id===e.pointerId){clearTimeout(pressTimer);pressAt=null;if(pressShown){pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;}}
  if(!drag||drag.pointerId!==e.pointerId)return;const pending=drag,target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-placement-zone=battlefield],.forge-native-panel'),handTop=root.querySelector('.play-match-hand-area')?.getBoundingClientRect().top,fromHand=!!pending.source.closest('.play-match-hand'),overHand=!!doc.elementFromPoint(e.clientX,e.clientY)?.closest('.play-match-hand-area'),aboveHand=presentation.hosted&&fromHand&&handTop!==undefined&&e.clientY<handTop&&!overHand;if(pending.active)suppressUntil=Date.now()+300;const combatTarget=pending.active?dropTargetAt(e.clientX,e.clientY):null;cancel();if(combatTarget){act(()=>dropCombat(pending.combat,pending.id,combatTarget));return;}if(pending.active&&(target&&root.contains(target)||aboveHand)){const now=session.snapshot().status?.revision;act(()=>session.nativeSelect('card',pending.id,now===pending.revision||session.snapshot().status?.surface.cards.some(c=>c.id===pending.id)?now:pending.revision));}};
 // A press that the browser takes over (a scroll, a system gesture) ends the preview and its click guard.
 // A long press's 60 s click guard ends with that press even when a redraw, scroll or
 // resize already closed its preview; otherwise the table would ignore taps for a minute.
 const pressCancel=e=>{if(pressAt?.id===e.pointerId){clearTimeout(pressTimer);pressAt=null;pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;}cancel();};
 const key=e=>{if(e.key==='Escape')cancel();const seat=e.target.closest?.('[data-player-seat][role=button]');if(seat&&root.contains(seat)&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(seat.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));}};
 root.addEventListener('click',click,true);root.addEventListener('pointerdown',down);doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',pressCancel);doc.addEventListener('keydown',key);win.addEventListener('blur',cancel);
 return {destroy(){closed=true;clearTimeout(idleTimer);playback.destroy();activity.remove();root.removeEventListener('pointerdown',skipPlayback,true);doc.body.removeAttribute('data-forge-search');dockObserver?.disconnect();unsub();observer.disconnect();cancel();hidePeek();clearTimeout(pressTimer);if(arrowFrame)win.cancelAnimationFrame(arrowFrame);win.removeEventListener('resize',queueArrows);if(railFrame)win.cancelAnimationFrame(railFrame);win.removeEventListener('resize',queueRails);peek.remove();castShow.remove();arrows.remove();fx.remove();root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('contextmenu',contextMenu,true);root.removeEventListener('keydown',peekKeys,true);win.removeEventListener('resize',reflow);root.removeEventListener('scroll',reflow,true);table.destroy();root.removeEventListener('input',saveInput);root.removeEventListener('change',saveInput);root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',down);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',pressCancel);doc.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);}};
}
