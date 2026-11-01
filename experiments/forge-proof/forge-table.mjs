import {mountMatchTable} from '../phase-engine/match-table.mjs';
import {practiceArtworkHooks,resolvePracticeArtwork} from '../../play-card-surface.js';
import {practicePlayerPortrait} from '../../play-player-mat.js';
import {mountNativePanel,nativePayment,owesAttack} from './native-panel.mjs';
import {createMotion} from './motion-kit.mjs';
import {optionCardId} from './forge-session.mjs';
import {CpuActionPlaybackQueue,createPlaybackSession,storyLines,tableActivity} from './cpu-action-playback.mjs';
import {tileBadges,tileLayerHtml,badgeSummary,currentKeywords,counterList,playerCounterBadges,playerCountersHtml} from '../../play-board-badges.js';
import {boardIcon} from '../../play-board-icons.js';
import {drawnArtwork,frameTone,surfaceColors} from '../../play-token-art.js';
import {cachedTokenArt,loadTokenArt,tokenArtKey} from '../../play-token-printing.js';
import {sym,symbolName,symbolText,manaCost,esc} from '../../ui.js';
import {haptic} from '../../feel.js';
import {createTableAudio} from '../../play-table-audio.js';
import {createTableEmotes} from './table-emotes.mjs';
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
// The host's glow is only as good as its payment check, which keeps a card lit whenever it can't be
// sure (one unusual cost effect anywhere on the table is enough). A hand card also stays dark when your
// mana plainly can't pay it: a fixed cost, nothing on the table that lowers or replaces costs, and every
// untapped source of yours readable. Anything unclear keeps the glow; Forge still validates every play.
const COST_BENDERS=/\bcosts?\b[^.]*\bless\b|\breduc|without paying|rather than pay|alternative|convoke|delve|improvise|affinity|evoke|emerge|offering|assist|spectacle|surge|prowl|\bdash\b|blitz|madness|foretell|\bplot\b|bestow|mutate|overload|prototype|flashback|escape|unearth|cycling|channel|ninjutsu|morph|disguise|\bwarp\b|sneak|freerunning|impending|mayhem|from your hand|discard this card|exile this card|reveal this card/i;
const MANA_SYMBOL=/^(?:\d+|[WUBRGC])$/;
function manaSources(card,tapped=false){
 const lines=String(card.text||'').split(/\n|(?<=\.)\s+(?=[A-Z{])/).map(l=>l.trim().replace(/^\((.*)\)$/,'$1')).filter(l=>/\badd\b/i.test(l));
 if(!lines.length){if(!card.types?.includes('Land')||tapped)return [];const basic={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'},colors=Object.entries(basic).filter(([t])=>new RegExp(`\\b${t}\\b`).test(card.type||'')).map(([,c])=>c);return colors.length?[colors.map(c=>[c])]:null;}
 const options=[];
 for(const line of lines){const [cost,effect]=line.split(/:\s*/,2);if(effect===undefined)return null;
  const parts=cost.split(/,\s*/).map(x=>x.trim());if(!parts.every(x=>x==='{T}'||/^sacrifice (?:this|~|it|cardname)/i.test(x)||/^sacrifice /i.test(x)&&x.toLowerCase().includes(String(card.name).toLowerCase())))return null;
  // A tapped source still counts when an ability of its needs no tap ("Sacrifice this: Add {W}.").
  if(parts.includes('{T}')&&(tapped||card.summoningSick&&card.types?.includes('Creature')))continue;
  const add=effect.replace(/\.?\s*(?:\(.*\))?$/,'').match(/^add (.+)$/i);if(!add)return null;const what=add[1].trim();
  {const any=what.match(/^(one|two|three) mana of any (?:one )?(?:color|type)\b(?:[^.]*\bcommander'?s? color identity)?$/i);if(any){options.push(Array({one:1,two:2,three:3}[any[1].toLowerCase()]).fill('WUBRGC'.split('')));continue;}}
  const alts=what.split(/,\s*(?:or\s+)?|\s+or\s+/);const parsed=alts.map(a=>(a.match(/^(?:\{[WUBRGC]\})+$/)?a.match(/[WUBRGC]/g):null));if(parsed.some(x=>!x))return null;
  for(const tokens of parsed)options.push(tokens.map(c=>[c]));}
 return options.length?options:[];}
// What a land whose text this reader can't follow could make at most: any colour, as many mana as its
// longest Add clause names (a fetch land counts as one). Anything that scales (X, "for each") stays unknown.
function landCeiling(card){
 if(!card.types?.includes('Land')||card.tapped)return null;const text=String(card.text||'');if(/for each|\bX\b|amount|double|twice|additional|instead/i.test(text))return null;
 const adds=[...text.matchAll(/\badd ([^.]+)/gi)].map(m=>Math.max((m[1].match(/\{[^}]+\}/g)||[]).length,/\btwo\b/i.test(m[1])?2:/\bthree\b/i.test(m[1])?3:1));
 return [Array(Math.max(1,...adds)).fill('WUBRGC'.split(''))];}
// Only an effect that changes what your spells cost (or how they can be paid) keeps a card lit.
const TABLE_BENDERS=/\bcosts?\b[^.]*\bless\b|\breduc|without paying|rather than pay|alternative cost|as though it were mana|spend mana as though|convoke|improvise|affinity|\bdelve\b/i;
export function provenUnaffordable(card,surface,pool={}){
 if(!card?.known||card.zone!=='Hand'||card.types?.includes('Land')||COST_BENDERS.test(card.text||''))return false;
 const symbols=(String(card.manaCost||'').match(/\{[^}]+\}/g)||[]).map(x=>x.slice(1,-1));if(!symbols.length||!symbols.every(x=>MANA_SYMBOL.test(x)))return false;
 const generic=symbols.filter(x=>/\d/.test(x)).reduce((a,x)=>a+Number(x),0),colored=symbols.filter(x=>!/\d/.test(x));
 const table=surface.cards.filter(c=>c.zone==='Battlefield'||c.zone==='Command');if(table.some(c=>!c.known||TABLE_BENDERS.test(c.text||'')))return false;
 if(surface.cards.some(c=>c.zone==='Hand'&&c.controller===surface.seat&&c.id!==card.id&&/from your hand[^.]*:\s*add|:\s*add[^.]*\bfrom your hand/i.test(c.text||'')))return false;
 const floating=Object.entries(pool||{}).flatMap(([c,n])=>Array(Math.max(0,Number(n)||0)).fill([String(c).toUpperCase()]));
 const sources=[];for(const c of table){if(c.controller!==surface.seat||c.zone!=='Battlefield')continue;const o=manaSources(c,c.tapped===true)??landCeiling(c);if(o===null)return false;if(o.length)sources.push(o);}
 if(sources.length>14||sources.reduce((a,o)=>a*o.length,1)>4096)return false;
 const pays=tokens=>{if(tokens.length<generic+colored.length)return false;const used=new Array(tokens.length).fill(false);
  const fit=i=>{if(i===colored.length)return true;for(let k=0;k<tokens.length;k++)if(!used[k]&&tokens[k].includes(colored[i])){used[k]=true;if(fit(i+1))return true;used[k]=false;}return false;};return fit(0);};
 const walk=(i,tokens)=>i===sources.length?pays(tokens):sources[i].some(opt=>walk(i+1,tokens.concat(opt)));
 return !walk(0,floating);}
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
 const doc=root.ownerDocument,win=doc.defaultView,hooks=practiceArtworkHooks();let handFocusRect=null,handDownAt=null,handTap=null,handLiftTimer=0,handFocus=null,handFocusId=null,handPointer=null,handSifted=false,localError='',panelKey='',drag=null,ghost=null,ghostFrame=0,suppressUntil=0,closed=false,nativeValueDraft=null,openingFocused=false;
 // The table redraws by building new card elements, which would cut a glide, a landing or a strike off
 // mid-flight. Card motion is kept per card, and a redraw picks each one up on the new element where it was.
 const carried=new Map();
 const keep=(el,a)=>{const card=el?.matches?.('.play-match-card')?el:el?.querySelector?.(':scope>.play-match-card[data-instance]'),id=card?.dataset.instance;if(!id||!a)return a;
  const key=id+(el===card?'|c':'|w');let set=carried.get(key);if(!set)carried.set(key,set=new Set());set.add(a);a.finished.then(()=>set.delete(a),()=>set.delete(a));return a;};
 const anim=(el,frames,opts)=>el?keep(el,el.animate(frames,opts)):null;
 const keepLatest=el=>{for(const a of el?.getAnimations?.()||[])if(!(a instanceof CSSTransition||a instanceof CSSAnimation))keep(el,a);};
 function carryOver(){for(const [key,set] of carried){for(const a of [...set]){const t=a.effect?.target;if(!t||t.isConnected)continue;set.delete(a);if(a.playState==='finished'||a.playState==='idle')continue;
   const [id,role]=key.split('|'),card=root.querySelector(`.play-match-card[data-instance="${CSS.escape(id)}"]`),el=role==='c'?card:card?.closest('.play-match-card-wrap');const at=a.currentTime;a.cancel();if(!el)continue;
   const {delay,duration,easing,fill,iterations,direction,endDelay}=a.effect.getTiming(),frames=a.effect.getKeyframes().map(({computedOffset,...k})=>k);
   const n=anim(el,frames,{delay,duration,easing,fill,iterations,direction,endDelay,composite:a.effect.composite});if(n&&at!==null)n.currentTime=at;}
  if(!set.size)carried.delete(key);}}
 // A target the redraw replaced is found again by its card or its seat.
 const again=n=>{if(!n||n.isConnected)return n;const id=n.dataset?.instance||n.querySelector?.('.play-match-card[data-instance]')?.dataset.instance;
  if(id){const c=root.querySelector(`.play-match-card[data-instance="${CSS.escape(id)}"]`);return c?(n.matches?.('.play-match-card')?c:c.closest('.play-match-card-wrap')||c):null;}
  const seat=n.closest?.('.play-match-seat')?.dataset.playerSeat;if(seat===undefined)return null;const s=root.querySelector(`.play-match-seat[data-player-seat="${CSS.escape(seat)}"]`);return n.matches?.('.play-match-profile-badge')?s?.querySelector('.play-match-profile-badge')||s:s;};
 const reducedMotion=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 let dockObserver=null,dockObserved=null;
 // Cards whose payment came up short, with the mana you had when you tried (see enhance).
 const shortCasts=new Map();let shortSig='';
 // Low power: Android's web view, reduced motion, or a small device trades blur, drifting fog and
 // foil sheen for flat glass. localStorage 'cardstashy.lowPower' = 'on' or 'off' overrides it.
 const lowPower=(()=>{let pref='';try{pref=win.localStorage?.getItem('cardstashy.lowPower')||'';}catch{}if(pref==='on')return true;if(pref==='off')return false;
  const nav=win.navigator||{};return win.Capacitor?.getPlatform?.()==='android'||/Android/i.test(nav.userAgent||'')&&/; wv\)/.test(nav.userAgent||'')||!!reducedMotion()||(nav.deviceMemory&&nav.deviceMemory<=3)||(nav.hardwareConcurrency&&nav.hardwareConcurrency<=4&&/Android/i.test(nav.userAgent||''));})();
 if(lowPower)root.dataset.lowPower='true';
 // Where the finger let a played card go: glide() lands it from here (read within 3 s, then cleared).
 let lastDrop=null;
// A card let go over the table hangs where it was dropped until Forge answers, then snaps into its slot
// (or floats back to the hand if the play didn't happen). Never more than DROP_HOLD ms.
let heldDrop=null;const DROP_HOLD=2500;
 const peek=doc.createElement('div');let peekFor=null,peekPinned=false,peekTimer=0,pressTimer=0,pressAt=null,pressShown=false,peekKey='',lastPointerType='mouse';
 const failedArt=new Set(),castShow=doc.createElement('div');castShow.className='forge-cast';castShow.setAttribute('role','status');castShow.setAttribute('aria-live','polite');castShow.dataset.open='false';doc.body.append(castShow);
 // Your own spell while you choose its targets or pay for it. Forge has already moved it to the stack but lists it
 // there only once it is cast, so until then it is shown here, large, the way Arena lifts the card you are casting.
 const ownCast=doc.createElement('div');ownCast.className='forge-cast forge-own-cast';ownCast.dataset.open='false';ownCast.dataset.kind='own';ownCast.setAttribute('aria-hidden','true');doc.body.append(ownCast);
 let ownCastKey='',aim=null;const seenInHand=new Map();
 function pendingCast(n,surface){
  const input=String(n?.inputType||'');if(!presentation.hosted||!(input==='InputSelectTargets'||input.startsWith('InputPayMana')||n?.prompt))return null;
  const events=Array.isArray(n.events?.items)?n.events.items:[],last=new Map();for(const e of events)if(e?.type==='zone'&&e.card?.kind==='card')last.set(e.card.id,e);
  // The engine leaves the player off some casts; a card that was in your hand is yours.
  const ev=[...last.values()].filter(e=>e.to==='Stack'&&e.from==='Hand'&&(e.player===n.viewer||e.player==null&&seenInHand.has(e.card.id))).sort((a,b)=>b.seq-a.seq)[0];if(!ev)return null;
  if((n.stack||[]).some(x=>x.id===ev.card.id||x.source?.id===ev.card.id)||surface.cards.some(c=>c.id===ev.card.id&&c.zone!=='Stack'))return null;
  return seenInHand.get(ev.card.id)||surface.cards.find(c=>c.id===ev.card.id)||{id:ev.card.id,name:ev.card.name,known:true,zone:'Stack'};
 }
 function paintOwnCast(n,surface){
  for(const c of surface.cards)if(c.zone==='Hand'&&c.known&&c.controller===surface.seat)seenInHand.set(c.id,c);
  const c=pendingCast(n,surface),key=c?`${c.id}:${c.name}`:'';if(key===ownCastKey)return;ownCastKey=key;
  if(!c){ownCast.dataset.open='false';root.removeAttribute('data-own-cast');aim=null;queueArrows();return;}
  const art=resolvePracticeArtwork(c);
  ownCast.innerHTML=`<figure>${art?.imageUrl?`<img src="${esc(art.imageUrl)}" alt="" referrerpolicy="no-referrer" decoding="async">`:''}</figure><p><span>Casting</span><strong>${esc(c.name)}</strong></p>`;
  if(!art?.imageUrl)ownCast.querySelector('figure').append(drawnArtwork(doc,c,surfaceColors(c)));
  ownCast.dataset.open='true';root.dataset.ownCast=String(c.id);queueArrows();
 }
 // Whose move it is and what just happened, from the accepted state and the playback alone.
 const activity=doc.createElement('div');activity.className='forge-activity';activity.setAttribute('role','status');activity.setAttribute('aria-live','polite');activity.hidden=true;doc.body.append(activity);let playback=null;
 // Tokens have no deck printing: show a real one from Scryfall once it is found, in place of the crest.
 const tokenArtwork=card=>{
  if(!card?.isToken||card.known!==true||presentation.tokenArt===false||typeof win.fetch!=='function')return null;
  const known=cachedTokenArt(card,win);if(known!==undefined)return known;
  loadTokenArt(card,win).then(art=>{if(art&&!closed)showTokenArt(tokenArtKey(card),art);});return null;
 };
 const showTokenArt=(key,art)=>{for(const node of root.querySelectorAll('[data-token-art]')){
  if(node.dataset.tokenArt!==key)continue;delete node.dataset.tokenArt;
  const drawn=node.querySelector('.play-drawn-art');if(!drawn)continue;
  const battlefield=node.dataset.presentation==='battlefield',img=doc.createElement('img');img.alt='';img.className='card-img';
  const sources=battlefield?[art.artImageUrl,...art.imageSources]:art.imageSources;img.src=sources[0];img.dataset.artSources=JSON.stringify(sources);img.dataset.artIndex='0';
  if(battlefield){const box=doc.createElement('span');box.className='play-match-piece-art';box.append(img);drawn.replaceWith(box);}else drawn.replaceWith(img);
 }};
 const table=mountMatchTable(root,{session,format,profile,title,allowConcede:false,onExit,pileIdentical:presentation.hosted===true,...hooks,
  resolveCard(card){const artwork=resolvePracticeArtwork(card)||tokenArtwork(card);return {...artwork,oracleText:card.text};},
  // Frame every piece in its own colors; tokens and cards without a printing get a drawn crest instead of an empty tile.
  decorateCard(node,card){hooks.decorateCard(node,card);
   // Your foils shimmer on the table: a light, composited sheen on battlefield pieces (the hand keeps
   // the app's own foil). Etched is left plain here; its effect is too heavy for a live board.
   const finish=resolvePracticeArtwork(card)?.finish;
   if(finish==='etched'){for(const a of [...node.attributes])if(a.name.startsWith('data-finish'))node.removeAttribute(a.name);node.classList.remove('play-match-art-surface');delete node.dataset.csFoil;}
   else if(finish&&finish!=='nonfoil'&&node.dataset.presentation==='battlefield'){node.dataset.csFoil=finish;if(!node.querySelector(':scope>.cs-foil')){const sheen=doc.createElement('span');sheen.className='cs-foil';sheen.setAttribute('aria-hidden','true');sheen.style.animationDelay=`-${(Number(card.id)||0)*3%11}s`;node.append(sheen);}}
   else{delete node.dataset.csFoil;node.querySelector(':scope>.cs-foil')?.remove();}
const name=String(card.name);if(Math.max(...name.split(/\s+/).map(word=>word.length))>=10)node.dataset.nameLength='word';else if(name.length>13)node.dataset.nameLength='long';const colors=surfaceColors(card,resolvePracticeArtwork(card)?.card),tone=frameTone(colors);if(tone){node.dataset.colors=tone.key;node.style.setProperty('--frame-a',tone.a);node.style.setProperty('--frame-b',tone.b);}if(card.isToken)node.dataset.token='true';const blank=node.querySelector('.play-match-card-back');if(blank){const art=drawnArtwork(doc,card,colors);if(node.dataset.presentation!=='battlefield')art.classList.add('play-drawn-full');blank.replaceWith(art);if(card.isToken&&tokenArtKey(card))node.dataset.tokenArt=tokenArtKey(card);}},
  renderOracleText(text){const el=doc.createElement('p');el.textContent=text;el.className='play-match-rules';return el;},
  decorateInspector(panel,card){hooks.decorateInspector(panel,card);panel.querySelector('a[href^="#wiki/"]')?.remove();if(card.type){const type=doc.createElement('p');type.className='forge-current-type';type.setAttribute('aria-label','Current native type');type.textContent=card.type;panel.append(type);}const note=doc.createElement('p');note.className='forge-art-note';note.textContent=!card.printing&&card.isToken&&cachedTokenArt(card,win)?'Token artwork is a public reference printing. Rules text and current state above come from Forge.':card.printing?(presentation.hosted?'Catalogue artwork; exact per-instance printing may be unavailable. Current text, types and state come from Forge.':'Artwork is a public reference printing. Rules text and current state above come from Forge.'):'Native Forge text; artwork is not available for this card.';panel.append(note);},
  renderPlayerPortrait(own){return practicePlayerPortrait(doc,own,profile);},
  renderMatchBackdrop(){const box=doc.createElement('div');for(const c of session.snapshot().status?.surface.cards.filter(c=>c.commander)||[]){const url=resolvePracticeArtwork(c)?.artImageUrl;if(url){const img=doc.createElement('img');img.src=url;img.alt='';img.referrerPolicy='no-referrer';box.append(img);}}return box.childNodes.length?box:null;}
 });
 const panelPresentation={...presentation,symbolText,...(presentation.hosted?{controlsOnSeat:true,shortNext:true}:{})};
 const fail=e=>{if(e?.message==='MATCH_NOT_READY'&&playbackBusy){playback.flush();return;}localError=e.message||String(e);panelKey='';enhance();};
 let manualPay=null; // the spell being cast with "Pick lands" (see restoreAutoPay)
 const act=fn=>{try{const p=fn();if(p?.catch)p.catch(fail);}catch(e){fail(e);}};
 let railFrame=0,panelPromptKey=null,loopFrame=0;
 // The table re-inserts its cards and fog on every board change, which restarts their looping glow,
 // hover and fog from the first frame: a visible jump on each action. Run every loop on the page's
 // clock instead, so a re-inserted element carries on from where it was.
 const syncLoops=()=>{loopFrame=0;if(closed)return;for(const a of root.getAnimations?.({subtree:true})||[])if(a.animationName&&a.startTime!==0&&a.effect?.getTiming?.().iterations===Infinity)try{a.startTime=0;}catch{}};
 function enhance(){
  if(closed)return;carryOver();if(flights.size)flyNow();if(!loopFrame&&typeof win.requestAnimationFrame==='function')loopFrame=win.requestAnimationFrame(syncLoops);const snap=session.snapshot(),n=snap.native;if(!snap.status||!n)return;
  if(presentation.hosted){const exit=root.querySelector('[data-focus-key=exit-match]');if(exit&&exit.textContent!=='Return to Play setup')exit.textContent='Return to Play setup';}
  const footer=root.querySelector('.play-match-decisions');if(!footer)return;
  const key=JSON.stringify([n.revision,snap.busy,snap.nativeDraft,snap.transportError,snap.selected,localError]);
  if(key!==panelKey||!footer.querySelector('[data-native-panel]')){
   // Preserve local typed input/focus if an unrelated inspection redraws the board.
   const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null,oldInput=footer.querySelector('[data-native-key=native-value]'),oldValue=oldInput?.value,oldRevision=footer.querySelector('[data-native-panel]')?.dataset.nativeRevision;
   mountNativePanel(footer,{session,snapshot:snap,onLocalError:message=>fail(Error(message)),presentation:panelPresentation});panelKey=key;
   // The dock is remounted on every board change; only a new prompt plays its entrance.
   const promptKey=JSON.stringify([n.inputType||'',n.prompt?.id??null,n.prompt?.message??null]),mounted=footer.querySelector('[data-native-panel]');if(mounted&&promptKey===panelPromptKey)mounted.dataset.settled='';panelPromptKey=promptKey;
   if(localError){const e=doc.createElement('p');e.className='forge-diagnostic';e.textContent=plainError(localError);e.setAttribute('role','alert');const picker=footer.querySelector('.forge-zone-search-actions');if(picker)picker.before(e);else footer.querySelector('[data-native-panel]')?.append(e);}
   if(nativeValueDraft?.revision===n.revision&&nativeValueDraft?.promptId===n.prompt?.id){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=nativeValueDraft.value;}else if(oldRevision===String(n.revision)&&oldValue!==undefined){const input=footer.querySelector('[data-native-key=native-value]');if(input)input.value=oldValue;}
   if(focused)footer.querySelector(`[data-native-key="${CSS.escape(focused)}"]`)?.focus();
  }
  const ids=list=>new Set((list||[]).filter(r=>r.kind==='card').map(r=>r.id));
  const blockedWhy=new Map((n.selection?.blocked||[]).filter(b=>b?.kind==='card'&&typeof b.reason==='string').map(b=>[Number(b.id),b.reason])),actionable=ids(n.selection?.actionable),
  // Newer hosts say how sure they are per action; 'unavailable' is blocked, 'unknown' gets the quiet rim, 'available' the halo.
  affordability=new Map((n.selection?.actionable||[]).filter(r=>r?.kind==='card'&&typeof r.affordability==='string').map(r=>[Number(r.id),r.affordability])),targets=ids(n.selection?.targets),choices=ids(n.selection?.cards),chosen=ids(n.selection?.chosen);
  paintOwnCast(n,snap.status.surface);
  // A spell whose payment Forge couldn't finish stays dark until your mana changes (a land, a new turn, floating mana).
  if(presentation.hosted){const sf=snap.status.surface,you=n.players?.find(p=>p.id===sf.players.find(p=>p.seat===sf.seat)?.nativeId),sig=JSON.stringify([n.turn,sf.cards.filter(c=>c.controller===sf.seat&&c.zone==='Battlefield'&&!c.tapped).map(c=>c.id),you?.mana||{}]),paying=String(n.inputType||'').startsWith('InputPayMana')?nativePayment(n,sf.cards):null;
   if(paying?.short&&paying.forCard!==null&&sf.cards.find(c=>c.id===paying.forCard)?.zone!=='Battlefield')shortCasts.set(paying.forCard,shortSig);
   if(!paying){shortSig=sig;for(const [id,was]of shortCasts)if(was!==sig)shortCasts.delete(id);}}
  if(presentation.hosted&&!n.prompt){const sf=snap.status.surface,you=n.players?.find(p=>p.id===sf.players.find(p=>p.seat===sf.seat)?.nativeId);for(const id of [...actionable]){const card=snap.status.surface.cards.find(c=>c.id===id);if(card&&card.controller===snap.status.surface.seat&&(affordability.get(id)==='unavailable'||shortCasts.has(id)||affordability.get(id)!=='available'&&provenUnaffordable(card,snap.status.surface,you?.mana))){actionable.delete(id);if(!blockedWhy.has(id))blockedWhy.set(id,'Not enough mana');}}}
  for(const index of snap.nativeDraft?.indexes||[]){const o=n.prompt?.options.find(o=>o.index===index);const cardId=optionCardId(o?.value);if(cardId!==null)chosen.add(cardId);}
  // Forge's own hint lists, shown by meaning: something you can play or use now,
  // a target for the spell or ability being cast, a card this prompt asks about,
  // and what you have already picked. Forge still validates every click.
  const discarding=!n.prompt&&choices.size>0&&/\bdiscard\b/i.test(String(n.message||''));
  const role=id=>chosen.has(id)?'chosen':targets.has(id)?'target':choices.has(id)?(discarding?'discard':'choice'):actionable.has(id)?'playable':'';
  const inputName=String(n.inputType||'');if(root.dataset.forgeInput!==inputName)root.dataset.forgeInput=inputName;
  const combatInput=n.inputType==='InputAttack'||n.inputType==='InputBlock';
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const cardId=Number(el.dataset.instance),r=role(cardId);const dragOk=combatInput&&!!combatDrops(cardId);if((el.dataset.forgeDrag==='true')!==dragOk){if(dragOk)el.dataset.forgeDrag='true';else delete el.dataset.forgeDrag;}el.dataset.forgeHint=String(actionable.has(cardId)||targets.has(cardId)||choices.has(cardId));if(actionable.has(cardId)&&el.closest('.play-match-hand')){const c=snap.status.surface.cards.find(x=>x.id===cardId);const a=affordability.get(cardId);el.dataset.forgeSure=String(a?a==='available':!(c&&COST_BENDERS.test(c.text||'')));}else delete el.dataset.forgeSure;
   // A creature Forge says must attack this combat wears a tag until it is in the attack.
   const must=n.inputType==='InputAttack'&&!!snap.status.surface.cards.find(x=>x.id===cardId&&owesAttack(x));if(must&&el.dataset.forgeMust!=='true'){el.dataset.forgeMust='true';const tag=doc.createElement('span');tag.className='forge-must-tag';tag.textContent='Must attack';el.append(tag);}else if(!must&&el.dataset.forgeMust){delete el.dataset.forgeMust;el.querySelector(':scope>.forge-must-tag')?.remove();}el.dataset.forgeChosen=String(chosen.has(cardId));const why=!actionable.has(cardId)&&blockedWhy.get(cardId);if(why){el.dataset.forgeBlocked=why;el.title=why;}else if(el.dataset.forgeBlocked){delete el.dataset.forgeBlocked;el.removeAttribute('title');}if(el.dataset.forgeRole!==r)el.dataset.forgeRole=r;el.setAttribute('aria-description',presentation.hosted?'When highlighted, click to play or select this card, or drag it up onto the table to play. Otherwise click to see it larger. Press I to see it larger at any time.':'Click sends this card to Forge; legality is checked by Forge. Magnifier or I inspects without acting.');}
  const surface=snap.status.surface,nativePlayer=seat=>n.players.find(p=>p.id===surface.players.find(p=>p.seat===seat)?.nativeId);
  // Floating mana is the native pool only, never untapped lands or potential production.
  const manaEntries=player=>Object.entries(player?.mana||{}).map(([color,amount])=>[String(color).toUpperCase(),Number(amount)||0]);
  const manaLabel=entries=>{const live=entries.filter(([,a])=>a>0);return live.length?'Floating mana: '+live.map(([c,a])=>`${a} ${MANA_ORDER.includes(c)?symbolName(c).toLowerCase():c}`).join(', '):'No floating mana';};
  const playerTargets=new Set((n.selection?.targets||[]).filter(r=>r.kind==='player').map(r=>r.id)),playerChosen=new Set((n.selection?.chosen||[]).filter(r=>r.kind==='player').map(r=>r.id));
  for(const el of root.querySelectorAll('[data-player-seat]')){el.title=presentation.hosted?'Select this player as a target when prompted':'Click to send this player to Forge';const seat=Number(el.dataset.playerSeat),player=nativePlayer(seat);
   const seatRole=!player?'':playerChosen.has(player.id)?'chosen':playerTargets.has(player.id)?'target':'';if(presentation.hosted&&(el.dataset.forgeRole||'')!==seatRole)el.dataset.forgeRole=seatRole;
   if(presentation.hosted){
    // A targetable player is a real control for keyboard and screen readers too.
    if(el.classList.contains('play-pod-chip')){}
    else if(seatRole==='target'&&el.tabIndex!==0){el.tabIndex=0;el.setAttribute('role','button');el.dataset.nativeKey=`seat-${el.dataset.seat}`;}else if(seatRole!=='target'&&el.hasAttribute('role')){el.removeAttribute('tabindex');el.removeAttribute('role');delete el.dataset.nativeKey;}
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
   // Each player's public zone counts sit beside their portrait; a count opens just that list in the Zones menu.
   // In a Commander pod only the opponent on show has a seat panel, so only that one gets counts.
   const shownCpu=Number(root.querySelector('.play-match-seat[data-seat=cpu]')?.dataset.playerSeat);
   for(const p of surface.players.filter(p=>p.seat===surface.seat||p.seat===shownCpu)){
    const own=p.seat===surface.seat,count=zone=>surface.cards.filter(c=>c.zone===zone&&c.owner===p.seat).length;
    const counts=[['Library',p.libraryCount],['Graveyard',count('Graveyard')],['Exile',count('Exile')],['Command',count('Command')]],key=counts.map(c=>c[1]).join(',');
    // Library and graveyard always show; exile and the command zone only once something is there.
    const shown=counts.filter(([zone,value])=>zone==='Library'||zone==='Graveyard'||value>0);
    let row=mat?.querySelector(`.forge-zone-row[data-seat="${own?'you':'cpu'}"]`);
    if(mat&&!row){row=doc.createElement('nav');row.className='forge-zone-row';row.dataset.seat=own?'you':'cpu';row.setAttribute('aria-label',own?'Your zones':'CPU zones');mat.append(row);}
    if(row&&row.dataset.counts!==key){row.dataset.counts=key;row.replaceChildren(...shown.map(([zone,value])=>{const b=doc.createElement('button');b.type='button';b.dataset.zone=zone;b.dataset.count=String(value);b.dataset.nativeKey=`zone-${own?'you':'cpu'}-${zone}`;b.setAttribute('aria-label',`${own?'Your':'CPU'} ${zone.toLowerCase()}: ${value}`);b.innerHTML=`${boardIcon('zone-'+zone.toLowerCase(),'cs-icon cs-zone-icon')||outlineIcon(ZONE_ICONS[zone])}<span>${ZONE_LABELS[zone]}</span><b>${value}</b>`;return b;}));}
   }
   applyZoneFocus();
   // Deck tracker, the untapped way but quieter: Deck lists what is left in your library with the
   // chance each card is your next draw; Opponent lists every card the CPU has shown. Each toggles.
   if(Array.isArray(presentation.tracker)&&presentation.tracker.length)renderTracker(surface,mat);
   foldMenu();
   renderCrests(surface,mat);
   // One turn statement: the dock says whose move it is; this track on the divider says where the turn is.
   renderPhaseTrack(surface,mat);
   renderCombatLine(n,surface);
   // The history button carries the stack size as a badge.
   const history=root.querySelector('.play-match-header [data-focus-key=table-details]'),stackCount=n.stack?.length?String(n.stack.length):'';if(history&&(history.dataset.count||'')!==stackCount){if(stackCount)history.dataset.count=stackCount;else delete history.dataset.count;}
   // Smart, Full Control and auto-pay are small emblems under your name, the way Arena keeps them by your portrait.
   const youInfo=root.querySelector('.play-match-seat[data-seat=you] .play-match-player'),modes=presentation.allowControlMode===true&&['smart','full'].includes(n.controlMode);
   let emblems=youInfo?.querySelector(':scope>.forge-control-emblems');
   const lock=!!n.prompt||n.inputType==='InputLockUI'||snap.busy===true,autoPay=typeof n.autoPay==='boolean'&&typeof session.setAutoPay==='function',emblemKey=[n.controlMode,autoPay?n.autoPay:'',lock].join(',');
   if(!modes||!youInfo)emblems?.remove();
   else if(!emblems||emblems.dataset.key!==emblemKey){
    if(!emblems){emblems=doc.createElement('div');emblems.className='forge-control-emblems';emblems.setAttribute('role','group');emblems.setAttribute('aria-label','Response controls');youInfo.append(emblems);
     // On an upright phone the three emblems fold into the one that is on, so they never sit under the main action;
     // a tap opens them as a small column, a pick (or a tap elsewhere) folds them again.
     emblems.addEventListener('click',e=>{if(!win.matchMedia?.('(max-width:640px) and (orientation:portrait)').matches)return;if(emblems.dataset.open!=='true'){e.preventDefault();e.stopImmediatePropagation();emblems.dataset.open='true';}else win.setTimeout(()=>{emblems.dataset.open='false';},0);},true);
     doc.addEventListener('pointerdown',e=>{if(emblems.dataset.open==='true'&&!emblems.contains(e.target))emblems.dataset.open='false';},true);}
    emblems.dataset.key=emblemKey;
    const make=(key,label,tip,icon,on,fn)=>{const b=doc.createElement('button');b.type='button';b.className='forge-control-emblem';b.dataset.nativeKey=key;b.dataset.label=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(on));b.title=tip;b.disabled=lock;b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;b.addEventListener('click',()=>act(fn));return b;};
    emblems.replaceChildren(
     make('mode-smart','Smart','Smart: passes empty response windows. Targets and required choices stay yours.','<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',n.controlMode==='smart',()=>switchMode('smart')),
     make('mode-full','Full Control','Full Control: stop at every response window.','<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.5 1.5 0 0 1 2.5-1.7L8 15"/>',n.controlMode==='full',()=>switchMode('full')),
     ...(autoPay?[make('auto-pay',n.autoPay?'Auto-pay mana: on':'Auto-pay mana: off','Auto-pay: pay mana costs automatically. Turn off to tap each source yourself.','<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5"/>',n.autoPay,()=>session.setAutoPay(!n.autoPay))]:[]));
   }
   // The CPU has no profile picture; its commander's art becomes its portrait.
   const cpuBadge=root.querySelector('.play-match-seat[data-seat=cpu] .play-match-profile-badge');
   const cpuSeat=Number(cpuBadge?.closest('.play-match-seat')?.dataset.playerSeat),cpuCommander=surface.cards.find(c=>c.commander===true&&c.owner!==surface.seat&&(surface.players.length===2||c.owner===cpuSeat)&&c.known),cpuArt=cpuCommander?resolvePracticeArtwork(cpuCommander)?.artImageUrl:null;
   if(cpuBadge&&cpuArt&&!(presentation.hosted&&format==='Commander')&&cpuBadge.dataset.portrait!==cpuArt){cpuBadge.dataset.portrait=cpuArt;let img=cpuBadge.querySelector('img.forge-seat-portrait');if(!img){img=doc.createElement('img');img.className='forge-seat-portrait';img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{img.hidden=true;};cpuBadge.append(img);}img.src=cpuArt;}
   // Each pod chip wears its CPU's commander art.
   for(const face of root.querySelectorAll('.play-pod-chip .play-pod-face')){const seat=Number(face.closest('.play-pod-chip').dataset.playerSeat),c=surface.cards.find(c=>c.commander===true&&c.owner===seat&&c.known),url=c?resolvePracticeArtwork(c)?.artImageUrl:null;
    if(url&&face.dataset.art!==url){face.dataset.art=url;const img=doc.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();delete face.dataset.art;};img.src=url;face.querySelector('img')?.remove();face.append(img);}}
   // The turn-change notice gets its banner art: whose turn large, the turn number small.
   const banner=root.querySelector('.play-match-turn-banner');
   if(banner&&!banner.dataset.owner){const [who,...rest]=banner.textContent.split(' · ');banner.dataset.owner=who==='Your turn'?'you':'cpu';const big=doc.createElement('strong'),small=doc.createElement('span');big.textContent=who;small.textContent=rest.join(' · ');banner.replaceChildren(big,small);}
   // A CPU-turn banner still playing back never sits over a dock that already says it is your move.
   if(banner?.dataset.owner==='cpu'&&n.activePlayer===n.viewer&&n.priorityPlayer===n.viewer&&!playbackBusy)banner.remove();
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
   if(youSeat&&youSeat.hasAttribute('data-mana-open')!==manaOpen)youSeat.toggleAttribute('data-mana-open',manaOpen);
   let pool=root.querySelector('.forge-mana-panel');
   if(pool&&pool.parentElement!==poolHome){pool.remove();pool=null;}
   if(poolHome&&!pool){pool=doc.createElement('section');pool.className='forge-mana-panel'+(presentation.hosted?' forge-seat-mana':'');pool.setAttribute('role','note');poolHome[presentation.hosted?'append':'prepend'](pool);}
   const ownPlayer=nativePlayer(surface.seat),untappedLands=surface.cards.filter(c=>c.zone==='Battlefield'&&c.controller===surface.seat&&c.known&&c.types?.includes('Land')&&!c.tapped).length;
   const used=ownPlayer?.landsPlayedThisTurn,allowed=ownPlayer?.landPlaysAllowed,hasLandCount=Number.isSafeInteger(used)&&used>=0&&Number.isSafeInteger(allowed)&&allowed>=used;
   const fullPoolKey=poolKey+'|'+untappedLands+'|'+(hasLandCount?used+'/'+allowed:'');
   if(pool&&pool.dataset.pool!==fullPoolKey){pool.dataset.pool=fullPoolKey;pool.hidden=!presentation.hosted&&!mine.some(([,a])=>a>0);if(youSeat)youSeat.dataset.floating=String(mine.some(([,a])=>a>0));pool.setAttribute('aria-label',manaLabel(mine)+`; ${untappedLands} untapped lands`+(hasLandCount?`; land plays used ${used} of ${allowed}`:''));const amount=c=>mine.find(([k])=>k===c)?.[1]||0;pool.innerHTML=presentation.hosted?`<h3>Mana pool</h3><div class="forge-seat-mana-row" aria-hidden="true">${MANA_ORDER.filter(c=>amount(c)>0).map(c=>`<span class="forge-mana-emblem" data-color="${c}">${sym(c)}<b>${amount(c)}</b></span>`).join('')||'<span class="forge-mana-empty">Nothing floating</span>'}</div><p class="forge-mana-sources"><span>Untapped lands <b>${untappedLands}</b></span>${hasLandCount?`<span class="forge-land-drop">Land plays <b>${used}/${allowed}</b></span>`:''}</p>`:`<h3>Floating mana</h3><div aria-hidden="true">${MANA_ORDER.map(c=>`<span data-zero="${amount(c)===0}">${sym(c)}<b>${amount(c)}</b></span>`).join('')}</div><p class="forge-mana-sources">Untapped lands <b>${untappedLands}</b>${hasLandCount?`<span class="forge-land-drop">Land plays <b>${used}/${allowed}</b></span>`:''}</p>`;}
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
    if(stats){const shift=(now,was)=>{const n=Number(now),w=Number(was);return was===undefined||was===null||!Number.isFinite(n)||!Number.isFinite(w)?'':n>w?'up':n<w?'down':'';};stats.dataset.shiftP=printed?shift(card.power,printed[0]):'';stats.dataset.shiftT=printed?shift(card.toughness,printed[1]):'';stats.toggleAttribute('data-damaged',Number(card?.damage)>0);}
   }
   // Poison, energy and experience sit on each player's seat with live counts.
   for(const p of surface.players){const seat=root.querySelector(`.play-match-seat[data-player-seat="${p.seat}"]`);if(!seat)continue;const list=playerCounterBadges(p.counters),html=playerCountersHtml(list);let box=seat.querySelector(':scope>.cs-player-counters');if(!html){box?.remove();continue;}if(!box){box=doc.createElement('span');box.className='cs-player-counters';seat.append(box);}if(box.dataset.html!==html){box.dataset.html=html;box.innerHTML=html;box.setAttribute('aria-label',list.map(c=>`${c.count} ${c.label.toLowerCase()}`).join(', '));}}
   // Each battlefield sizes its pieces so its creature row and its row of other
   // permanents both fit across: widths in piece units plus fixed gaps in pixels.
   for(const zone of root.querySelectorAll('.play-match-battlefields .play-match-zone')){
    const rows={c:[0,0],o:[0,0]},lanes=[];let otherLanes=0;
    for(const lane of zone.querySelectorAll('.play-match-lane')){const creature=lane.dataset.cardGroup==='creatures',row=creature?rows.c:rows.o,w=creature?1.18:.98,own=[0,0];if(!creature&&otherLanes++)row[1]+=22;let first=true;
     for(const wrap of lane.querySelectorAll('.play-match-card-wrap:not([data-attached])')){const pile=wrap.dataset.pileIndex&&wrap.dataset.pileIndex!=='0',u=pile?w-(wrap.dataset.pileTight==='true'?(creature?1.12:.92):(creature?.94:.76)):w,g=!pile&&!first?16:0;row[0]+=u;row[1]+=g;own[0]+=u;own[1]+=g;first=false;}
     if(!creature)lanes.push(own);}
    // A long back row wraps its artifacts and enchantments under the lands, so size it by
    // its widest lane instead of shrinking every piece to fit one line.
    if(lanes.length>1&&rows.o[0]>7){const widest=lanes.reduce((a,b)=>b[0]>a[0]?b:a);rows.o=[Math.max(widest[0],rows.o[0]*.55),widest[1]];}
    const fit=`${Math.max(1,rows.c[0]).toFixed(2)},${rows.c[1]},${Math.max(1,rows.o[0]).toFixed(2)},${rows.o[1]}`;
    if(zone.dataset.fit!==fit){zone.dataset.fit=fit;const [cu,cg,ou,og]=fit.split(',');zone.style.setProperty('--fit-cu',cu);zone.style.setProperty('--fit-cg',cg+'px');zone.style.setProperty('--fit-ou',ou);zone.style.setProperty('--fit-og',og+'px');}
   }
   fitRails();fitBoard();
   // A gentle arc: cards further from the middle of the hand sit a little lower.
   // The count lets the hand tighten its spacing only when it would not fit.
   const hand=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')],handRow=root.querySelector('.play-match-hand .play-match-card-row');if(handRow&&handRow.style.getPropertyValue('--hand-count')!==String(hand.length))handRow.style.setProperty('--hand-count',String(hand.length));hand.forEach((w,i)=>{const lift=Math.abs(i-(hand.length-1)/2);const v=`${Math.min(Math.round(lift*lift*2.2),22)}px`;if(w.style.getPropertyValue('--arc-drop')!==v)w.style.setProperty('--arc-drop',v);});if(handFocusId!==null&&!handFocus?.isConnected)refocusHand();fitHandFan(hand);placeHandSlider(hand);
   // Past eight cards a toggle lays the whole hand out in two rows, so a big hand never overlaps into a mis-tap.
   const handArea=root.querySelector('.play-match-hand-area');let fan=handArea?.querySelector(':scope>.forge-hand-expand');
   if(hand.length>8&&handArea){if(!fan){fan=doc.createElement('button');fan.type='button';fan.className='forge-hand-expand';fan.dataset.nativeKey='hand-expand';fan.addEventListener('click',()=>{root.dataset.handExpanded=String(root.dataset.handExpanded!=='true');paintFan();});handArea.append(fan);}
    if(!root.querySelector(':scope>.forge-hand-slider')){const slider=doc.createElement('div');slider.className='forge-hand-slider';slider.setAttribute('aria-hidden','true');slider.innerHTML='<i></i>';slider.addEventListener('pointerdown',slideHand);root.append(slider);}
    const cols=String(Math.ceil(hand.length/2));if(root.style.getPropertyValue('--hand-cols')!==cols)root.style.setProperty('--hand-cols',cols);paintFan();}
   else{fan?.remove();root.querySelector(':scope>.forge-hand-slider')?.remove();if(root.dataset.handExpanded)delete root.dataset.handExpanded;}
  }

 }
 function paintFan(){const fan=root.querySelector('.forge-hand-expand');if(!fan)return;const open=root.dataset.handExpanded==='true',count=root.querySelectorAll('.play-match-hand .play-match-card-wrap').length,label=open?'Close hand':`View full hand (${count})`;if(fan.textContent!==label)fan.textContent=label;fan.setAttribute('aria-pressed',String(open));}
 const saveInput=e=>{if(e.target.dataset?.nativeKey==='native-value'){const n=session.snapshot().native;nativeValueDraft={revision:n.revision,promptId:n.prompt?.id,value:e.target.value};}};
 root.addEventListener('input',saveInput);root.addEventListener('change',saveInput);
 // The board fitter adds, relabels and removes a crowded lane's "+N" chip itself. Those changes must not
 // start another pass: the fitter measures the lane twice (natural width, then fitted) and the two can
 // disagree on the count, which re-ran the fitter forever and froze the table (seen at 740x360).
 // Effects laid over the table (impact rings, life deltas, the rope, the emote button that mounts after
 // each redraw) don't move the board either; each extra pass is a full layout, and a CPU turn redraws per beat.
 const overlay=n=>n.classList?.contains('forge-lane-more')||n.classList?.contains('forge-fx-ring')||n.classList?.contains('forge-life-delta')||n.classList?.contains('forge-rope')||n.classList?.contains('forge-emote-button');
 const fitterOnly=list=>list.every(m=>m.target.classList?.contains('forge-lane-more')||[...m.addedNodes,...m.removedNodes].every(overlay));
 const observer=new MutationObserver(list=>{if(!fitterOnly(list))enhance();});observer.observe(root,{childList:true,subtree:true});
 // Cards keep their engine identity between renders, so a card that moves (hand to
 // battlefield, a lane change) glides from where it was to where Forge put it, and a
 // permanent that appears from nowhere fades in. Purely visual; placement is Forge's.
 const positions=()=>{const m=new Map();for(const el of root.querySelectorAll('.play-match-card[data-instance]')){const w=el.closest('.play-match-card-wrap')||el,r=w.getBoundingClientRect();if(r.width)m.set(el.dataset.instance,{r,hand:!!el.closest('.play-match-hand'),battlefield:el.dataset.presentation==='battlefield'});}return m;};
 // A card played from your hand lands with weight: it rises off where it was (or where your finger let go
 // of a drag: the drag code sets lastDrop just before it sends the play, and this clears it), hangs for a beat, slams down
 // with a slight overshoot, kicks up a dust ring and nudges its neighbours. Transform only.

 // A foil permanent catches the light when it does something (land slam, attack wind-up): one transform sweep.
 const catchFoil=w=>{const f=w?.querySelector('.cs-foil');if(!f)return;f.classList.remove('cs-catch');void f.offsetWidth;f.classList.add('cs-catch');setTimeout(()=>f.classList.remove('cs-catch'),700);};
 function land(w,id,dx,dy,s){
  const r=w.getBoundingClientRect(),drop=lastDrop&&lastDrop.instance===id&&Date.now()-lastDrop.at<3000?lastDrop.rect:null;lastDrop=null;
  if(drop){dx=drop.left-r.left;dy=drop.top-r.top;s=Math.max(.4,Math.min(2.2,drop.width/r.width));}
  const tilt=Math.max(-8,Math.min(8,-dx/40)),ms=drop?MOTION.snap:MOTION.land+200;
  // Let the card leave its clipped lane while it flies, as a strike does.
  root.dataset.csStriking='true';strikeEnd=Math.max(strikeEnd,Date.now()+ms);setTimeout(()=>{if(Date.now()>=strikeEnd-20)delete root.dataset.csStriking;},ms+40);
  // Dragged there, it goes straight from your finger into its slot, Arena style: no second lift, just a quick
  // glide that seats with a small press and settle. Tapped to play, it rises off the hand, hangs, then slams.
  if(drop)anim(w,[{transform:`translate(${dx}px,${dy}px) scale(${s}) rotate(${tilt}deg)`,zIndex:50,easing:'cubic-bezier(.25,.8,.3,1)'},{transform:'translateY(2px) scale(.96)',zIndex:50,offset:.72,easing:'ease-out'},{transform:'translateY(-1px) scale(1.01)',zIndex:50,offset:.88},{transform:'none',zIndex:50}],{duration:ms});
  else anim(w,[{transform:`translate(${dx}px,${dy}px) scale(${s}) rotate(${tilt}deg)`,zIndex:50,easing:'cubic-bezier(.2,.7,.3,1)'},{transform:`translate(${dx*.12}px,${dy*.12-26}px) scale(1.2) rotate(${tilt*.3}deg)`,zIndex:50,offset:.5,easing:'cubic-bezier(.6,0,.9,.5)'},{transform:'translateY(3px) scale(.95)',zIndex:50,offset:.8,easing:'ease-out'},{transform:'translateY(-1px) scale(1.01)',zIndex:50,offset:.9},{transform:'none',zIndex:50}],{duration:ms});
  setTimeout(()=>{if(!w.isConnected)return;catchFoil(w);motion.ring(w,'#f0d48a',420);motion.sparks(w,{n:6,spread:40,color:'#f0d48a'});
   for(const n of w.parentElement?.children||[]){if(n===w)continue;const nr=n.getBoundingClientRect(),side=Math.sign(nr.left-r.left);if(!side||Math.abs(nr.left-r.left)>r.width*2.4)continue;n.animate([{transform:'none'},{transform:`translateX(${side*5}px)`,offset:.35},{transform:'none'}],{duration:260,easing:'ease-out'});}},ms*.8);
 }
 const glide=before=>{
  if(!before.size||reducedMotion())return;let moved=0;
  for(const el of root.querySelectorAll('.play-match-card[data-instance]')){
   const w=el.closest('.play-match-card-wrap')||el,prev=before.get(el.dataset.instance),r=w.getBoundingClientRect();if(!r.width||moved>24||flights.has(el.dataset.instance))continue;
   if(prev){const inHand=prev.hand&&!!el.closest('.play-match-hand');
    // A card that only shifts inside your hand (a draw or a play beside it) slides by its centre, on top of
    // its fan angle, arc and any pop: it never changes size or flattens on the way.
    if(inHand){const dx=prev.r.left+prev.r.width/2-(r.left+r.width/2),dy=prev.r.top+prev.r.height/2-(r.top+r.height/2);if(Math.hypot(dx,dy)<6)continue;moved++;anim(w,[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0px,0px)'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)',composite:'add'});continue;}
    const dx=prev.r.left-r.left,dy=prev.r.top-r.top;if(Math.hypot(dx,dy)<6)continue;const s=Math.max(.4,Math.min(2.2,prev.r.width/r.width));moved++;const played=prev.hand&&el.dataset.presentation==='battlefield';if(played){land(w,el.dataset.instance,dx,dy,s);continue;}anim(w,[{transform:`translate(${dx}px,${dy}px) scale(${s})`,zIndex:50},{transform:'none',zIndex:50}],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'});}
   else if(el.dataset.presentation==='battlefield'){moved++;anim(w,[{opacity:0,transform:'translateY(-14px) scale(.86)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});}
  }
 };
 // Four short sequences that explain ordinary play, drawn only from what Forge accepted between two
 // boards: mana flowing from the sources that tapped to the spell they paid for, a permanent settling
 // onto the battlefield, combat damage landing, and an Equipment or Aura joining its host. Each one
 // reads where a card actually is now; nothing is invented, no face-down card is named, and reduced
 // motion turns them all off. Timings are starting points to tune on a real Fold.
 const MANA_TINT={W:'#f4ecc8',U:'#6fb7ff',B:'#b48ad8',R:'#ff7a52',G:'#5fd37e',C:'#cfd3da'};
 const fx=doc.createElement('div');fx.className='forge-fx';fx.setAttribute('aria-hidden','true');doc.body.append(fx);
 // The shared motion kit (also used by Planeswalk) does the hit-stop, numbers and shatter.
 const motion=createMotion({doc,win,lowPower,reduced:reducedMotion}),tableAudio=createTableAudio(root),emotes=presentation.hosted?createTableEmotes({root,doc,win}):null;
 const rectOf=el=>{const b=el&&(el.closest('.play-match-card-wrap')||el).getBoundingClientRect();return b&&b.width>0?b:null;};
 const cardEl=id=>root.querySelector(`.play-match-card[data-instance="${id}"]`);
 // A player's seat panel, or in a Commander pod the chip of an opponent whose board is not on show.
 const seatEl=seat=>root.querySelector(`.play-match-seat[data-player-seat="${seat}"]`)||root.querySelector(`.play-pod-chip[data-player-seat="${seat}"]`);
 // Whom an attacker is attacking: its declared target, or in a duel simply the other player.
 const defenderOf=(players,c)=>players.find(p=>p.nativeId===c.attackTarget?.id)?.seat??(players.length===2?players.find(p=>p.seat!==c.controller)?.seat:undefined);
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
 // One motion scale for the table, tunable in one place: press, move, land, lunge.
 // A strike: a gentle wind-up, a flight timed by its distance (never a blink across a big table, never a crawl
 // to a blocker next door), a short freeze on contact, then an unhurried return to its place.
 const MOTION={press:120,move:220,land:360,snap:300,windup:160,flight:[200,320],hold:70,back:280,stagger:150};
 let strikeEnd=0,hitAt=0;
 // Where a blow lands: a player's portrait rather than the middle of their whole seat panel, a card's frame.
 const aimOf=to=>{if(!to?.getBoundingClientRect)return to;const p=to.matches?.('.play-match-seat')&&to.querySelector('.play-match-profile-badge');return p&&rectOf(p)?p:(to.closest?.('.play-match-card-wrap')||to);};
 const boxOf=to=>to?.getBoundingClientRect?rectOf(to):to?.width>0?to:null;
 // Arena's lunge travels until the striker's leading edge meets what it hits, with a little bite, however near
 // or far the two sit (a fixed share of the distance stopped short across a PC table and overshot on a phone).
 // The edges are found along the line between the two centres (a diagonal flight meets a corner, not a side).
 const edgeOf=(r,ux,uy)=>Math.min(ux>1e-3?r.width/2/ux:Infinity,uy>1e-3?r.height/2/uy:Infinity);
 const contactReach=(a,b)=>{const dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2),d=Math.hypot(dx,dy);if(d<1)return 0;
  const ux=Math.abs(dx/d),uy=Math.abs(dy/d),ea=edgeOf(a,ux,uy)*1.16,eb=edgeOf(b,ux,uy),bite=Math.max(10,Math.min(a.height,b.height)*.12);
  // Even a blocker right across the line gets a real swing, not a twitch: at least 40% of a card height.
  return Math.min(1,Math.max(d-ea-eb+bite,a.height*.4)/d);};
 // `to` is an element or, for a creature the same blow killed, the rect it stood in. `stand` lunges a
 // stand-in instead of the card (an attacker that dies in the exchange still swings first). Returns when it is home.
 function strike(el,to,{face=false,delay=0,big=false,power=0,stand=null}={}){
  const w=stand||el?.closest('.play-match-card-wrap'),aim=aimOf(to),a=rectOf(w),b=boxOf(aim);if(!w||!a||!b)return 0;
  // The battlefields clip their overflow; let the striker leave its lane for the flight.
  const reach=contactReach(a,b),span=reach*Math.hypot(b.left+b.width/2-(a.left+a.width/2),b.top+b.height/2-(a.top+a.height/2));
  const travel=Math.round(Math.max(MOTION.flight[0],Math.min(MOTION.flight[1],150+span*.2))),ms=MOTION.windup+travel+MOTION.hold+MOTION.back;root.dataset.csStriking='true';strikeEnd=Math.max(strikeEnd,Date.now()+delay+ms);
  // The arrows would point from where the striker was; hide them for the flight and bring them back after.
  arrows.style.opacity='0';setTimeout(()=>{if(Date.now()>=strikeEnd-20){delete root.dataset.csStriking;arrows.style.opacity='';}},delay+ms+40);
  if(!delay||hitAt<Date.now())hitAt=Date.now()+delay+MOTION.windup+travel;
  w.dataset.csStriker='true';setTimeout(()=>delete w.dataset.csStriker,delay+ms+20);
  setTimeout(()=>catchFoil(w),delay);
  // Wind-up, lunge, a short freeze on contact (hit-stop), then spring back. The target shakes on contact, harder
  // the more power behind the hit (light under 4, medium 4-7, heavy 8+); a big hit (5 or more) nudges the
  // whole board, and a heavy one shakes it harder, unless low power is on.
  const aim0=aim?.getBoundingClientRect?aim:null,node=aim0;
  // The kit moves the card in its own pixels; a board the fitter has scaled down needs the reach scaled up to match.
  const host=stand?null:w.parentElement,k=host?.offsetWidth?host.getBoundingClientRect().width/host.offsetWidth:1,scale=k>.2&&k<5?k:1;
  const onHit=()=>{haptic(big||face?'warn':'tick');const node=again(aim0);if(!node?.isConnected)return;pulse(node,face?'face':'hit');
   const target=node.closest('.play-match-seat')||node.closest('.play-match-card-wrap')||node,tier=power>=8?1.6:power>=4?1.2:.8;motion.shake(target,(face?9:6)*tier,360);
   if(big)motion.shake(root.querySelector('.play-match-main')||root,power>=8?8:4,power>=8?380:260,{garnish:true});
   if(face){target.classList.remove('cs-face-hit');void target.offsetWidth;target.classList.add('cs-face-hit');setTimeout(()=>target.classList.remove('cs-face-hit'),700);}return node;};
  // A stand-in flies on its own layer; a live card flies frame by frame (fly), so it still lands on its target
  // when the table redraws or refits under it mid-flight.
  if(stand)motion.strike(w,node||b,{reach:reach/scale,windup:MOTION.windup,travel,hold:MOTION.hold,back:MOTION.back,delay,onHit});
  else fly(el.dataset.instance,aim0||b,{delay,travel,onHit});
  return delay+ms;
 }
 // A permanent that taps, untaps, steps out to attack or back keeps that pose on the card itself (CSS by state).
 // The redraw rebuilds the card's place, which would snap it; it turns into its new pose instead (its stats with it).
 const POSE='.play-match-battlefields .play-match-card[data-instance]',POSE_PARTS=':scope :is(.play-current-stats,.cs-counters)';
 function posesNow(){const m=new Map();for(const el of root.querySelectorAll(POSE)){const t=getComputedStyle(el).transform;m.set(el.dataset.instance,{t,parts:[...el.querySelectorAll(POSE_PARTS)].map(n=>getComputedStyle(n).transform)});}return m;}
 function settlePoses(was){for(const el of root.querySelectorAll(POSE)){const old=was.get(el.dataset.instance);if(!old)continue;const t=getComputedStyle(el).transform;if(t===old.t)continue;
   const o={duration:260,easing:'cubic-bezier(.25,.8,.3,1)'};anim(el,[{transform:old.t},{transform:t}],o);[...el.querySelectorAll(POSE_PARTS)].forEach((n,i)=>{const was=old.parts[i],now=getComputedStyle(n).transform;if(was&&was!==now)n.animate([{transform:was},{transform:now}],o);});}}
 // Live strikes. Each frame finds the card and its target where they are now (a redraw builds new elements,
 // a refit rescales the lanes), so the card always meets what it hits. Wind-up, a flight that gathers speed
 // into contact, a short freeze, then an easy glide home.
 const flights=new Map();let flightFrame=0;
 function fly(id,to,{delay=0,travel=240,onHit}){if(!id)return;const t0=performance.now()+delay;flights.set(String(id),{t0,travel,to,last:null,hit:false,onHit,tx:0,ty:0});if(!flightFrame)flightFrame=win.requestAnimationFrame(flyFrame);}
 function flyFrame(){flightFrame=0;flyNow();if(flights.size)flightFrame=win.requestAnimationFrame(flyFrame);}
 function flyNow(){const now=performance.now();
  for(const [id,f] of flights){const el=cardEl(id),w=el?.closest('.play-match-card-wrap');const W=MOTION.windup,T=f.travel,Hd=MOTION.hold,B=MOTION.back,t=now-f.t0;
   if(t>=W+T+Hd+B||!w){if(w){w.style.removeProperty('transform');delete w.dataset.csStriker;}if(w||t>=W+T+Hd+B)flights.delete(id);continue;}
   if(t<0)continue;
   // A glide or lean still running on the card would override the flight; the flight takes over from here.
   for(const an of w.getAnimations())if(!(an instanceof CSSTransition||an instanceof CSSAnimation))an.cancel();
   const host=w.parentElement,k=host?.offsetWidth?host.getBoundingClientRect().width/host.offsetWidth:1,K=k>.2&&k<5?k:1;
   // Where the card sits at rest: its box now, less the shift this flight last gave it.
   const r=w.getBoundingClientRect(),cx=r.left+r.width/2-f.tx*K,cy=r.top+r.height/2-f.ty*K,a={left:cx-w.offsetWidth*K/2,top:cy-w.offsetHeight*K/2,width:w.offsetWidth*K,height:w.offsetHeight*K};
   const node=f.to?.getBoundingClientRect?again(f.to):null;if(node)f.to=node;const b=(node?.isConnected?rectOf(node):null)||f.last||boxOf(f.to);if(!b)continue;f.last=b;
   const dx=b.left+b.width/2-cx,dy=b.top+b.height/2-cy,R=contactReach(a,b),X=dx*R,Y=dy*R,tilt=Math.max(-8,Math.min(8,X/30));
   let p,sc,rot,lift;
   if(t<W){const u=t/W,e=1-(1-u)**3;p=-.06*e;sc=1+.05*e;rot=-tilt/2*e;lift=6*e;}
   else if(t<W+T){const u=(t-W)/T,e=u*u*(2.2-1.2*u);p=-.06+1.06*e;sc=1.05+.11*e;rot=-tilt/2+tilt*1.5*e;lift=6*(1-e);}
   else if(t<W+T+Hd){p=1;sc=1.16;rot=tilt;lift=0;}
   else{const u=(t-W-T-Hd)/B,e=1-(1-u)**3;p=1-e;sc=1.16-.16*e;rot=tilt*(1-e);lift=0;}
   if(!f.hit&&t>=W+T){f.hit=true;const n=f.onHit?.();const at=n?.isConnected?n:null;if(at){motion.flash(at);motion.sparks(at,{n:10,spread:56});}}
   f.tx=X*p/K;f.ty=(Y*p+lift)/K;w.style.transform=`translate(${f.tx.toFixed(1)}px,${f.ty.toFixed(1)}px) scale(${sc.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
   if(w.dataset.csStriker!=='true')w.dataset.csStriker='true';}}
 function popNumber(el,text,kind,size=''){if(rectOf(el))motion.number(el.closest('.play-match-card-wrap')||el,text,{kind,size});}
 function boardEffects(prev,next,before,leaving){
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
   const w=el.closest('.play-match-card-wrap'),own=c.controller===b.seat;if(w&&rings<=3&&!before?.has(String(c.id)))anim(w,[{transform:`translateY(${own?34:-34}px) scale(1.22)`,opacity:.35},{transform:'translateY(0) scale(.96)',opacity:1,offset:.62},{transform:'none',opacity:1}],{duration:land?380:520,easing:'cubic-bezier(.2,.75,.25,1)'});
   setTimeout(()=>{if(el.isConnected)pulse(el,land?'land':c.known&&c.types?.includes('Creature')?'creature':'permanent',land?sourceTint(c):null);},land?300:420);}
  // 3. Combat impact: damage newly marked on a creature pops as a number where it lands; attackers
  // that dealt it lean in toward what they attacked. Life totals already count on the seats.
  const damaged=b.cards.filter(c=>onField(c)&&c.known&&(c.damage||0)>(was.get(c.id)?.damage||0)&&was.get(c.id)?.zone==='Battlefield');
  const lifeLost=b.players.some(p=>p.life<(a.players.find(x=>x.seat===p.seat)?.life??p.life));
  // A board can also jump from blocks straight past the damage step (nobody held priority there): the attackers
  // have stopped attacking, so the blows that landed in between are still drawn.
  const combat=/Damage$/.test(String(b.phase||''))||/Damage$/.test(String(a.phase||''))||a.cards.some(c=>c.attacking&&onField(c))&&!b.cards.some(c=>c.attacking&&onField(c));
  // A planeswalker (or battle) takes combat damage as lost loyalty (or defense) counters, not marked damage.
  const guard=c=>(c?.counters?.LOYALTY??c?.counters?.DEFENSE??null),worn=b.cards.filter(c=>onField(c)&&guard(c)!==null&&guard(was.get(c.id))!==null&&guard(c)<guard(was.get(c.id))&&was.get(c.id)?.zone==='Battlefield');
  const targetFell=a.cards.some(c=>c.attacking&&c.attackTarget?.kind==='card'&&b.cards.find(x=>x.id===c.attackTarget.id)?.zone!=='Battlefield');
  // A creature in the fight that left the battlefield (died in it): a trade marks no damage and may cost no life.
  const gone=c=>b.cards.find(x=>x.id===c.id)?.zone!=='Battlefield',fell=a.cards.filter(c=>onField(c)&&(c.attacking||c.blockingIds?.length)&&gone(c));
  const dying=new Map();
  if(combat&&(damaged.length||lifeLost||fell.length||worn.length||targetFell)){
   // Arena's strike: an unblocked attacker flies at the defending player's portrait and hits it;
   // a blocked one crashes into its blocker, even one the blow kills. Both spring back to their place.
   const blockerOf=new Map();for(const c of [...a.cards,...b.cards])for(const id of c.blockingIds||[])if(!blockerOf.has(id))blockerOf.set(id,c.id);
   const live=id=>{const now=b.cards.find(x=>x.id===id),el=now?.zone==='Battlefield'?cardEl(id):null;return el||before?.get(String(id))?.r||null;};
   let struck=0;
   for(const c of a.cards.filter(c=>c.attacking&&onField(c))){const dies=gone(c),el=dies?null:cardEl(c.id);if(!dies&&!el)continue;
    const seat=seatEl(defenderOf(b.players,c)),blocked=blockerOf.has(c.id)?live(blockerOf.get(c.id)):null;
    const to=blocked||(c.attackTarget?.kind==='card'?live(c.attackTarget.id):seat);if(!to)continue;
    const opts={face:!blocked&&to===seat,delay:struck++*MOTION.stagger,big:(c.power||0)>=5,power:c.power||0};
    // An attacker that dies in the exchange swings as a stand-in (drawn below with the other deaths).
    if(dies)dying.set(c.id,{to,opts});else strike(el,to,opts);}
   const contact=Math.max(0,hitAt-Date.now());
   damaged.forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(el){const d=c.damage-(was.get(c.id)?.damage||0);popNumber(el,`−${d}`,'damage',d>=5?'big':'');pulse(el,'hit');}},contact+i*60));
   worn.forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(el){const d=guard(was.get(c.id))-guard(c);popNumber(el,`−${d}`,'damage',d>=5?'big':'');pulse(el,'hit');}},contact+i*60));
  }
  // 3b. Declared: a new attacker surges forward toward what it attacks and settles; a new blocker
  // steps across to meet its attacker with a blue shield flash. Arrows then hold the pairing.
  // The surge is measured in card sizes, not screen pixels: a far target on a big screen otherwise threw a
  // small fitted card most of a slot sideways, over its neighbour. It leans mostly forward, out of its row.
  const lean=(el,to,amount,ms)=>{const w=el?.closest('.play-match-card-wrap'),r=rectOf(el),t=rectOf(to);if(!w||!r)return;let dx=t?(t.left+t.width/2-(r.left+r.width/2))*amount:0,dy=t?(t.top+t.height/2-(r.top+r.height/2))*amount:0;
   dx*=.15;const len=Math.hypot(dx,dy),cap=r.height*.22;if(len>cap){dx*=cap/len;dy*=cap/len;}
   anim(w,[{transform:'none'},{transform:`translate(${dx}px,${dy}px) scale(1.08)`,offset:.45},{transform:'none'}],{duration:ms,easing:'cubic-bezier(.3,.1,.3,1)'});};
  b.cards.filter(c=>onField(c)&&c.attacking&&was.get(c.id)?.zone==='Battlefield'&&!was.get(c.id)?.attacking).slice(0,8).forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(!el?.isConnected)return;
   const to=c.attackTarget?.kind==='card'?cardEl(c.attackTarget.id):seatEl(defenderOf(b.players,c));
   lean(el,to,.1,460);pulse(el,'attack');},i*70));
  b.cards.filter(c=>onField(c)&&c.blockingIds?.length&&(c.blockingIds.length>(was.get(c.id)?.blockingIds?.length||0))).slice(0,8).forEach((c,i)=>setTimeout(()=>{const el=cardEl(c.id);if(!el?.isConnected)return;lean(el,cardEl(c.blockingIds[c.blockingIds.length-1]),.22,520);pulse(el,'block');},i*70));
  // 4. Attach: an Equipment or Aura that joined a host glides there (the card glide does the travel);
  // the host's stats flash so the change it brings is noticed.
  for(const c of b.cards){if(!onField(c)||!Number.isSafeInteger(c.attachedTo)||was.get(c.id)?.attachedTo===c.attachedTo)continue;const host=cardEl(c.attachedTo);if(!host)continue;
   setTimeout(()=>{if(!host.isConnected)return;pulse(host,'attach');host.querySelector('.play-current-stats')?.animate([{transform:'scale(1)'},{transform:'scale(1.25)',filter:'brightness(1.6)',offset:.4},{transform:'scale(1)'}],{duration:600});},380);}

  // 5. Death: a permanent that went to a graveyard or exile (or a token that ceased to exist) breaks
  // into shards where it stood. The shards sit outside the table's scoped styles, so they carry the
  // art of the element the redraw just replaced on a plain frame.
  if(leaving?.size){let broke=0;const shots=[];for(const c of a.cards){if(!onField(c)||broke>=4)continue;const now=b.cards.find(x=>x.id===c.id);if(now&&!/^(Graveyard|Exile)$/.test(now.zone))continue;
   const old=leaving.get(String(c.id)),r=before?.get(String(c.id))?.r;if(!old||!r)continue;broke++;const src=old.querySelector('img')?.currentSrc||old.querySelector('img')?.src||'';shots.push({c,shot:{rect:{left:r.left,top:r.top,width:r.width,height:r.height},html:`<div class="forge-shard-face" style="background-image:${src?`url(&quot;${esc(src)}&quot;)`:'none'}"></div>`}});}
   // An attacker the exchange kills lunges as its stand-in first, and breaks once it is back in its place.
   const swung=new Map();for(const {c,shot} of shots){const lunge=dying.get(c.id),stand=lunge&&motion.ghost(shot.rect,shot.html);if(stand)swung.set(c.id,{stand,end:strike(null,lunge.to,{...lunge.opts,stand})});}
   // Until the blow that kills it lands, a stand-in holds its place so it never just blinks out.
   const at=Math.max(0,hitAt-Date.now()+80);shots.forEach(({c,shot},i)=>{const own=swung.get(c.id),wait=own?own.end+40:at+(i+1)*60,stand=own?.stand||(wait>30?motion.ghost(shot.rect,shot.html):null);setTimeout(()=>{stand?.remove();motion.shatter(shot);},wait);});}
  // 5b. Cast: your card lifts as it goes on the stack (it waits in hand, dimmed, until Forge confirms),
  // and a spell that resolves from your hand flies to the middle of the table and bursts there.
  for(const c of b.cards){if(!c.inTransit||was.get(c.id)?.inTransit||c.controller!==b.seat)continue;const el=cardEl(c.id);if(!el)continue;
   el.closest('.play-match-card-wrap')?.animate([{transform:'translateY(0px)'},{transform:'translateY(-22px)',offset:.45},{transform:'translateY(0px)'}],{duration:420,easing:'cubic-bezier(.2,.8,.3,1)',composite:'add'});pulse(el,'cast');}
  const middle=rectOf(root.querySelector('.play-match-battlefields')),discarding=/\bdiscard/i.test(String(prev?.native?.message||''));
  if(middle&&!discarding&&leaving?.size){let cast=0;for(const c of a.cards){if(c.zone!=='Hand'||c.controller!==a.seat||cast>=2)continue;const now=b.cards.find(x=>x.id===c.id);if(now&&!/^(Graveyard|Exile)$/.test(now.zone))continue;
   const old=leaving.get(String(c.id)),r=before?.get(String(c.id))?.r;if(!old||!r)continue;cast++;const src=old.querySelector('img')?.currentSrc||old.querySelector('img')?.src||'';
   const to={left:middle.left+middle.width/2-r.width/2,top:middle.top+middle.height/2-r.height/2,width:r.width,height:r.height},shot=motion.ghost?.(to,`<div class="forge-shard-face" style="background-image:${src?`url(&quot;${esc(src)}&quot;)`:'none'}"></div>`);
   if(shot){motion.arc(shot,r,{ms:380,lift:70,mid:1.15,s1:1.05})?.finished.then(()=>{shot.animate([{opacity:1,transform:'scale(1.05)'},{opacity:0,transform:'scale(1.35)'}],{duration:220}).finished.then(()=>shot.remove(),()=>shot.remove());motion.flash(to,1.1);motion.ring(to,'#f0d48a',480);motion.sparks(to,{n:10,spread:60});},()=>shot.remove());}}}
  // 6. Draw: a card new to your hand turns face up on its way in from your side of the table.
  // An opening hand or a mulligan (five or more at once) is dealt instead: all of it, quicker, fanning in.
  const mySeat=root.querySelector(`.play-match-seat[data-player-seat="${b.seat}"]`),seatBox=rectOf(mySeat);let drawn=0;
  const isNew=c=>c.zone==='Hand'&&c.controller===b.seat&&!before?.has(String(c.id))&&was.get(c.id)?.zone!=='Hand',deal=b.cards.filter(isNew).length>=5,most=deal?(lowPower?4:8):3,gap=deal?70:120;
  if(seatBox)for(const c of b.cards){if(!isNew(c)||drawn>=most)continue;const el=cardEl(c.id),w=el?.closest('.play-match-card-wrap'),r=rectOf(el);if(!w||!r)continue;
   const dx=seatBox.left+seatBox.width/2-(r.left+r.width/2),dy=seatBox.top+seatBox.height/2-(r.top+r.height/2);
   w.animate([{transform:`translate(${dx}px,${dy}px) rotateY(90deg) scale(.7)`,opacity:.4},{transform:`translate(${dx/2}px,${dy/2-50}px) rotateY(30deg) scale(1.2)`,opacity:1,offset:.55},{transform:'translateY(-6px) scale(1.04)',offset:.85},{transform:'translate(0px,0px)'}],{duration:deal?400:480,delay:drawn++*gap,easing:'cubic-bezier(.3,.1,.3,1)',fill:'backwards',composite:'add'});}
  // 7. Your turn: once the banner has gone, a blue wave runs through the cards you can play now.
  if(b.activeSeat===b.seat&&a.activeSeat!==b.seat)setTimeout(()=>{if(closed)return;[...root.querySelectorAll('.play-match-hand .play-match-card[data-forge-role=playable]')].slice(0,10).forEach((el,i)=>setTimeout(()=>{if(!el.isConnected)return;pulse(el,'playable');el.closest('.play-match-card-wrap')?.animate([{transform:'translateY(0px)'},{transform:'translateY(-10px)',offset:.4},{transform:'translateY(0px)'}],{duration:420,easing:'ease-out',composite:'add'});},i*70));},900);
 }
 // Hold the previous accepted board while a meaningful observed update is announced.
 // Only projected public cards reach this queue; it cannot recover events omitted by a poll.
 function showPlaybackBeat(beat){
  activeBeat=beat;const mat=root.querySelector('.play-match-mat');
  // Over a decision the story is told in the activity line and the stack's arrows; a spotlight
  // there would cover the very prompt it explains.
  if(playback?.overlay){updateActivity();return;}
  // A land has no spotlight: it drops into its row (the staged board moves it) and the line says so.
  // A turn change is shown by the staged board's own turn banner; a second one would repeat it.
  if(beat.kind==='land'||beat.tone==='turn'){queueArrows();updateActivity();return;}
  // An attack is told by the swing and its arrow, as on Arena, and its damage by the falling life total;
  // a banner there would cover the attackers or the CPU's front row.
  if(beat.tone==='attack'||beat.tone==='damage'&&beat.combat){queueArrows();updateActivity();return;}
  if(beat.kind==='phase'){
   const banner=doc.createElement('div');banner.className='forge-playback-status';banner.setAttribute('role','status');banner.textContent=beat.label;if(beat.tone)banner.dataset.tone=beat.tone;mat?.append(banner);
  }else if(beat.card){
   const c=beat.card,art=resolvePracticeArtwork(c);
   castShow.innerHTML=`<figure>${art?.imageUrl?`<img src="${esc(art.imageUrl)}" alt="" referrerpolicy="no-referrer" decoding="async">`:''}</figure><p><span>${esc(beat.label)}</span><strong>${esc(c.name)}</strong></p>${beat.text?`<div class="forge-cast-text">${symbolText(beat.text)}</div>`:''}`;
   // Drawn art sits under the photo, so a slow image never leaves the spotlight blank for its beat.
   castShow.querySelector('figure').prepend(drawnArtwork(doc,c,surfaceColors(c)));
   castShow.dataset.open='true';castShow.dataset.kind=beat.kind;doc.body.dataset.forgeSpotlight='true';
  }
  queueArrows();updateActivity();
 }
 // The spotlight's photo starts loading when the story is queued, not when its beat opens.
 const preloaded=new Set();
 function preloadBeatArt(beats){for(const b of beats){if(!b.card||b.kind==='land')continue;const url=resolvePracticeArtwork(b.card)?.imageUrl;if(!url||preloaded.has(url))continue;if(preloaded.size>200)preloaded.clear();preloaded.add(url);const img=new win.Image();img.referrerPolicy='no-referrer';img.decoding='async';img.src=url;}}
 function clearPlaybackBeat(){activeBeat=null;castShow.dataset.open='false';delete doc.body.dataset.forgeSpotlight;root.querySelector('.forge-playback-status')?.remove();queueArrows();updateActivity();}
 let activityKey='';
 // Like Snap and Master Duel, CPU turns can play at Normal or Fast; the choice stays on this device.
 const SPEED_KEY='cardstashy-cpu-speed';let cpuSpeed='normal';try{if(win.localStorage?.getItem(SPEED_KEY)==='fast')cpuSpeed='fast';}catch{/* blocked storage keeps Normal */}
 activity.addEventListener('click',e=>{if(!e.target.closest?.('.forge-speed'))return;cpuSpeed=cpuSpeed==='fast'?'normal':'fast';try{win.localStorage?.setItem(SPEED_KEY,cpuSpeed);}catch{/* the choice lasts this match */}activityKey='';updateActivity();});
 function updateActivity(){
  let a=presentation.hosted&&root.dataset.stage==='match'&&playback?tableActivity(displayed,{beat:activeBeat,overlay:playback.overlay,recent:playback.recent}):null;
  // Like Arena, no running commentary: the CPU's moves show on the board, so this only says the CPU is
  // playing (with its speed switch) or that the connection or match needs attention.
  if(a){if(['working','resolving'].includes(a.kind))a=null;else if(['thinking','replay'].includes(a.kind))a={...a,label:a.label==='Your turn'?'Your turn':'CPU playing',detail:''};}
  const key=a?`${a.kind}|${a.label}|${a.detail}|${cpuSpeed}`:'';if(key===activityKey)return;activityKey=key;
  activity.hidden=!a||a.kind==='decision';if(activity.hidden)return;
  const fast=cpuSpeed==='fast',speed=['replay','thinking'].includes(a.kind)?`<button type="button" class="forge-speed" aria-pressed="${fast}" aria-label="CPU speed: ${fast?'Fast':'Normal'}. Tap to switch.">${fast?'▶▶ Fast':'▶ Normal'}</button>`:'';
  activity.dataset.kind=a.kind;activity.innerHTML=`<strong>${esc(a.label)}</strong>${a.detail?`<span>${esc(a.detail)}</span>`:''}${speed}`;
  activity.title=playback.recent.join('\n');
 }
 // Arrows, Arena style: attackers to whom they attack, blockers to what they block, and
 // a spell or ability to the targets you have chosen. Only relations the state makes
 // certain are drawn: an attack goes to the player unless they also control something
 // attackable, and a block is paired only when Forge names the attacker or there is one.
 const SVG='http://www.w3.org/2000/svg',arrows=doc.createElementNS(SVG,'svg');arrows.setAttribute('class','forge-arrows');arrows.setAttribute('aria-hidden','true');doc.body.append(arrows);let arrowFrame=0;
 arrows.innerHTML=['attack','block','target'].map(k=>`<marker id="forge-head-${k}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="forge-head-${k}"/></marker>`).join('').replace(/^/,'<defs>').replace(/$/,'</defs>');
 function relations(snap){
  const n=snap.native,surface=snap.status?.surface;if(!n||!surface||root.dataset.stage!=='match')return [];
  const out=[],cards=surface.cards,bySeat=seat=>({kind:'seat',seat}),byCard=id=>({kind:'card',id}),playerSeat=nativeId=>surface.players.find(p=>p.nativeId===nativeId)?.seat;
  const attackers=cards.filter(c=>c.zone==='Battlefield'&&c.attacking);
  for(const a of attackers){
   const defending=defenderOf(surface.players,a);
   const t=a.attackTarget,attackable=cards.some(c=>c.zone==='Battlefield'&&c.controller===defending&&/Planeswalker|Battle/.test(c.type||''));
   const to=t?.kind==='card'&&cards.some(c=>c.id===t.id)?byCard(t.id):t?.kind==='player'&&playerSeat(t.id)!==undefined?bySeat(playerSeat(t.id)):!attackable&&defending!==undefined?bySeat(defending):null;
   // Once blocked, an attacker without trample deals no damage past its blockers: its line to the player fades.
   const held=cards.some(c=>c.zone==='Battlefield'&&(c.blockingIds||[]).includes(a.id))&&!currentKeywords(a).some(k=>/trample/i.test(k.text||''));
   if(to)out.push({kind:'attack',from:byCard(a.id),to,...(held?{held:true}:{})});
  }
  for(const b of cards.filter(c=>c.zone==='Battlefield'&&c.blocking)){
   const named=(b.blockingIds||[]).filter(id=>attackers.some(a=>a.id===id)),pair=named.length?named:attackers.length===1?[attackers[0].id]:[];
   for(const id of pair)out.push({kind:'block',from:byCard(b.id),to:byCard(id)});
  }
  if(n.inputType==='InputSelectTargets'){
   const named=String(n.message||'').match(/targets? for ([^\n]+)/i)?.[1]?.trim(),mine=c=>c.known&&c.controller===surface.seat;
   const source=cards.filter(c=>mine(c)&&c.zone==='Stack').sort((a,b)=>b.id-a.id)[0]||(named&&(cards.find(c=>mine(c)&&c.zone==='Battlefield'&&c.name===named)||cards.find(c=>mine(c)&&c.zone==='Hand'&&c.name===named)));
   // A spell being cast has no tile on the table, so its arrows start from the Casting panel.
   const from=source&&cardEl(source.id)?byCard(source.id):ownCast.dataset.open==='true'?{kind:'own'}:null;
   // Arena's aiming line: until every target is chosen, a curved line runs from the spell to your finger or pointer.
   if(from&&aim&&(n.selection?.chosen||[]).length<Math.max(1,n.selection?.max||1))out.push({kind:'aim',from,to:{kind:'point',x:aim.x,y:aim.y}});
   if(from)for(const r of n.selection?.chosen||[]){const to=r.kind==='card'?byCard(r.id):r.kind==='player'&&playerSeat(r.id)!==undefined?bySeat(playerSeat(r.id)):null;if(to)out.push({kind:'target',from,to});}
  }
  // The top spell or ability on the stack points from its line in the decision card to
  // its targets, when Forge names them. Only the top of the stack draws, and none while you are picking your own.
  const topItem=String(n.inputType||'')==='InputSelectTargets'?null:(n.stack||[])[0];
  for(const item of topItem?[topItem]:[])for(const r of Array.isArray(item.targets)?item.targets:[]){const to=r?.kind==='card'&&cards.some(c=>c.id===r.id)?byCard(r.id):r?.kind==='player'&&playerSeat(r.id)!==undefined?bySeat(playerSeat(r.id)):null;if(to)out.push({kind:'target',from:{kind:'stack',id:item.id},to});}
  if(activeBeat&&castShow.dataset.open==='true')for(const r of activeBeat.targets||[]){const to=r.kind==='card'&&cards.some(c=>c.id===r.id)?byCard(r.id):r.kind==='player'&&playerSeat(r.id)!==undefined?bySeat(playerSeat(r.id)):null;if(to)out.push({kind:'target',from:{kind:'spotlight'},to});}
  return out;
 }
 function anchorRect(ref){
  if(ref.kind==='point')return {left:ref.x-1,top:ref.y-1,width:2,height:2};
  const el=ref.kind==='spotlight'?castShow:ref.kind==='own'?ownCast.querySelector('figure'):ref.kind==='seat'?seatEl(ref.seat):ref.kind==='stack'?root.querySelector(`[data-native-key="stack-${ref.id}"]`):root.querySelector(`.play-match-card[data-instance="${ref.id}"]`);
  const box=el&&(el.closest('.play-match-card-wrap')||el).getBoundingClientRect();return box&&box.width>0?box:null;
 }
 function drawArrows(){
  arrowFrame=0;const snapNow=session.snapshot(),list=relations(snapNow),paths=[],blocking=snapNow.native?.inputType==='InputBlock'&&!snapNow.native?.prompt,mineOnBoard=id=>snapNow.status?.surface.cards.some(c=>c.id===id&&c.controller===snapNow.status.surface.seat);
  for(const r of list){
   const a=anchorRect(r.from),b=anchorRect(r.to);if(!a||!b)continue;
   const ax=a.left+a.width/2,ay=a.top+a.height/2,bx=b.left+b.width/2,by=b.top+b.height/2,len=Math.hypot(bx-ax,by-ay);if(len<20)continue;
   // Start at the source's edge, stop short of the target's edge, and bow the line a little.
   const ux=(bx-ax)/len,uy=(by-ay)/len,start=Math.min(a.width,a.height)*.42,stop=Math.min(b.width,b.height)*.48+4;
   const sx=ax+ux*start,sy=ay+uy*start,ex=r.kind==='aim'?bx:bx-ux*stop,ey=r.kind==='aim'?by:by-uy*stop,bend=Math.min(60,len*.16),cx=(sx+ex)/2-uy*bend,cy=(sy+ey)/2+ux*bend;
   // Arena-style: a thin line from the source to a ring around the target, with a small dot where it leaves the
   // source. Combat keeps a (thinner) arrowhead so attackers and blockers still read at a glance.
   const rx=Math.min(14,b.width*.18);paths.push(`<path class="forge-arrow" data-kind="${r.kind}"${r.held?' data-held="true"':''} d="M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"${r.kind==='target'||r.kind==='aim'?'':` marker-end="url(#forge-head-${r.kind})"`}/><circle class="forge-arrow-dot" data-kind="${r.kind}" cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.5"/>${r.kind==='aim'?`<circle class="forge-aim-reticle" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="9"/>`:`<rect class="forge-target-ring" data-kind="${r.kind}" x="${(b.left-4).toFixed(1)}" y="${(b.top-4).toFixed(1)}" width="${(b.width+8).toFixed(1)}" height="${(b.height+8).toFixed(1)}" rx="${rx.toFixed(1)}"/>`}`);
   // While you block, your block line is a control: a wide invisible stroke and a small x at its middle undo it.
   if(r.kind==='block'&&blocking&&r.from.kind==='card'&&r.to.kind==='card'&&mineOnBoard(r.from.id)){const mx=(sx+2*cx+ex)/4,my=(sy+2*cy+ey)/4,ids=`data-blocker="${r.from.id}" data-attacker="${r.to.id}"`;
    paths.push(`<path class="forge-arrow-hit" ${ids} d="M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/><g class="forge-unblock" ${ids} transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})"><circle r="11"/><path d="M-4 -4L4 4M4 -4L-4 4"/></g>`);}
  }
  {const t=root.style.getPropertyValue('--forge-hand-top');if(t&&arrows.style.getPropertyValue('--hand-top')!==t)arrows.style.setProperty('--hand-top',t);}const defs=arrows.querySelector('defs')?.outerHTML||'',html=defs+paths.join('');if(arrows.dataset.html!==html){arrows.dataset.html=html;arrows.innerHTML=html;}
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
 // A full board always fits its half of the table (Randall, 28 Oct): rows wrap instead of
 // scrolling sideways, and a side that is still too tall or wide scales down as one piece,
 // laid out wider by the same factor so it uses the whole width. The CPU's side stays
 // against the middle line. Transforms keep hit testing, drag and arrows on real rects.
 // The folded cards of a crowded lane, at full size, in a tray above the board. Each copy acts like the card
 // (tap to read or pick it); any other touch, or the next board update, closes the tray.
 function openLaneTray(hidden,chip){
  closeLaneTray();const tray=doc.createElement('div');tray.className='forge-lane-tray';tray.setAttribute('role','dialog');
  const own=!!chip.closest('.play-match-seat-area[data-seat=you]'),title=`${own?'Your':'CPU'} board · ${hidden.length} more`;tray.setAttribute('aria-label',title);
  const head=doc.createElement('header'),h=doc.createElement('h3'),x=doc.createElement('button');h.textContent=title;x.type='button';x.className='forge-lane-tray-close';x.textContent='×';x.setAttribute('aria-label','Close');x.addEventListener('click',e=>{e.stopPropagation();closeLaneTray();});head.append(h,x);tray.append(head);
  for(const w of hidden){const copy=w.cloneNode(true);copy.hidden=false;copy.removeAttribute('style');tray.append(copy);}
  root.append(tray);const r=chip.getBoundingClientRect(),t=tray.getBoundingClientRect();
  tray.style.left=`${Math.round(Math.max(8,Math.min(win.innerWidth-8-t.width,r.left+r.width/2-t.width/2)))}px`;tray.style.top=`${Math.round(Math.max(8,r.top-t.height-10))}px`;
  const away=e=>{if(!tray.contains(e.target))closeLaneTray();};doc.addEventListener('pointerdown',away,true);tray._away=away;
 }
 function closeLaneTray(){const tray=root.querySelector(':scope>.forge-lane-tray');if(!tray)return;doc.removeEventListener('pointerdown',tray._away,true);tray.remove();}
 const growLimit=()=>Math.min(win.innerWidth,win.innerHeight)<600&&win.matchMedia?.('(pointer:coarse)').matches?1.7:1;
 // Tall touch screens lift the turn buttons above a full-width hand (play-forge-table.css), into your side's lower edge.
 const raisedDock=()=>!!win.matchMedia?.('(hover:none) and (pointer:coarse) and (min-width:600px) and (min-height:480px)').matches;
 // A side that changes size after the fit (fonts landing, a chip appearing, 130% text) fits again.
 let boardSizes=null;const boardSeen=new Map(),boardKey=a=>a.dataset.seat||a.className,boardSize=a=>`${a.offsetWidth}x${a.offsetHeight}`;
 function fitBoard(){
  boardFrame=0;if(closed||!presentation.hosted)return;
  // A redraw replaces the sides, and a newly observed box always reports its size once; only a size this
  // fit has not seen yet fits again (each fit is a full layout pass, so a redraw must not cost three).
  if(typeof ResizeObserver==='function'){boardSizes??=new ResizeObserver(list=>{if(list.some(e=>e.target.isConnected&&boardSeen.get(boardKey(e.target))!==boardSize(e.target)))queueBoard();});boardSizes.disconnect();
   for(const a of root.querySelectorAll('.play-match-battlefields>.play-match-seat-area,.play-match-hand-area')){boardSeen.set(boardKey(a),boardSize(a));boardSizes.observe(a);}}
  // Your side stops above your hand where it rests, not where a lift or a popped card has carried it, so
  // hovering the hand never shrinks the board. Both sides then share one scale, so cards read the same size.
  const g=handGeometry(),rest=g?g.wraps.map(w=>{const l=g.local(w);return {top:g.box.top+l.y,left:g.box.left+l.x,right:g.box.left+l.x+l.w,width:l.w};}):[];
  const fits=[];if(rest.length){const top=`${Math.round(Math.min(...rest.map(r=>r.top)))}px`;root.style.setProperty('--forge-hand-top',top);doc.body.style.setProperty('--forge-hand-top',top);
   // The phone ask line floats above whichever is higher: the hand at rest or the stack strip over it.
   const tops=[...rest.map(r=>r.top),...[...root.querySelectorAll('.forge-native-stack')].filter(n=>getComputedStyle(n).position==='fixed').map(n=>n.getBoundingClientRect()).filter(r=>r.height).map(r=>r.top)];doc.body.style.setProperty('--forge-ask-top',`${Math.round(Math.min(...tops))}px`);}
  // Where the board is laid out on its own (a Fold opened up), it ends above the stack strip and the hand
  // slider instead of running under them, so both sides lay out in the room that is left.
  {const bf=root.querySelector('.play-match-battlefields');if(bf){bf.style.removeProperty('bottom');const floats=[...root.querySelectorAll('.forge-native-stack,:scope>.forge-hand-slider')].filter(n=>getComputedStyle(n).position==='fixed').map(n=>n.getBoundingClientRect()).filter(r=>r.height);
   // Only a strip that runs under the board counts: a side panel beside it (the stack in a sideways
   // phone's right column) starts above the board's middle and would otherwise squeeze the board to nothing.
   const b=bf.getBoundingClientRect(),under=floats.filter(r=>r.right>b.left&&r.left<b.right&&r.top>b.top+b.height/2);
   if(under.length&&getComputedStyle(bf).position==='absolute'){const top=Math.min(...under.map(r=>r.top));if(b.bottom>top-6)bf.style.setProperty('bottom',`${Math.round(parseFloat(getComputedStyle(bf).bottom)+b.bottom-top+6)}px`,'important');}}}
  // A Commander pod's CPU side holds one board per opponent: the one on show, or all of them side by side.
  const zonesOf=area=>{const all=[...area.querySelectorAll(':scope>.play-match-zone')];for(const z of all){z.style.removeProperty('transform');z.style.removeProperty('width');delete z.dataset.scaled;}return all.filter(z=>z.getClientRects().length);};
  for(const area of root.querySelectorAll('.play-match-battlefields>.play-match-seat-area'))for(const zone of zonesOf(area)){
   const columns=area.querySelectorAll(':scope>.play-match-zone').length>1&&getComputedStyle(area).display==='grid';
   // Your side stops above your hand; the CPU's stops below its row of card backs.
   // On a portrait screen the stack strip and the hand slider float over your side, so it stops above them too;
   // a sideways phone's hand button and control emblems sit just over the hand, and a tall screen's turn buttons
   // ride above it, so it stops above those as well.
   const box=area.getBoundingClientRect(),own=area.dataset.seat!=='cpu',edges=(own?[...rest,...[...root.querySelectorAll('.forge-native-stack,:scope>.forge-hand-slider')].filter(n=>getComputedStyle(n).position==='fixed').map(n=>n.getBoundingClientRect()),...[...root.querySelectorAll('.forge-hand-expand,.forge-control-emblem')].map(n=>n.getBoundingClientRect()),...[...(raisedDock()?root.querySelectorAll('.play-match-decisions:not(:has(.forge-order-cards,.forge-zone-search))'):[])].map(n=>n.getBoundingClientRect()).filter(r=>r.height&&r.top>box.top+40)]:[...root.querySelectorAll('.play-match-opponent-fan,.play-pod-rail')].map(n=>n.getBoundingClientRect())).filter(r=>r.width&&r.right>box.left&&r.left<box.right);
   const top=own?box.top:Math.max(box.top,...edges.map(r=>r.bottom+8)),bottom=own?Math.min(box.bottom,...edges.map(r=>r.top-4)):box.bottom;
   const W=columns?Math.floor(zone.getBoundingClientRect().width):area.clientWidth,H=Math.min(area.clientHeight,Math.round(bottom-top))-(columns?22:0);if(!W||H<=0)continue;
   // Side-by-side lanes (a grid) have fixed boxes: a row that spills out of its lane shrinks inside it.
   const fitRows=()=>{for(const row of zone.querySelectorAll('.play-match-card-row')){row.style.removeProperty('transform');const lane=row.closest('.play-match-lane'),h=lane?.clientHeight||0;
    const scaleOf=()=>Math.min(1,h&&row.scrollHeight>h+1?h/row.scrollHeight:1,row.scrollWidth>row.clientWidth+1?row.clientWidth/row.scrollWidth:1);
    // A lane that would have to shrink its tiles past readable keeps the ones that fit and folds the rest
    // into a "+N" chip; tapping it lays them out at full size in a tray above the board.
    // (The chip is only added or removed when that changes: the table redraws on any child change.)
    const wraps=[...row.querySelectorAll(':scope>.play-match-card-wrap')];let more=row.querySelector(':scope>.forge-lane-more');for(const w of wraps)if(w.hidden)w.hidden=false;
    let kr=scaleOf();
    if(kr<.62&&wraps.length>=4){let keep=Math.max(1,Math.floor(wraps.length*(kr/.75)**2)-1);
     if(!more){more=doc.createElement('button');more.type='button';more.className='forge-lane-more';more.dataset.nativeKey='lane-more';more.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const row=more.parentElement,k=Number(more.dataset.keep)||0;openLaneTray([...row.querySelectorAll(':scope>.play-match-card-wrap')].slice(k),more);});row.append(more);}more.hidden=false;
     const fold=k=>{wraps.forEach((w,i)=>{const hide=i>=k;if(w.hidden!==hide)w.hidden=hide;});const label=`+${wraps.length-k}`;if(more.textContent!==label){more.textContent=label;more.setAttribute('aria-label',`${wraps.length-k} more cards`);}more.dataset.keep=String(k);};
     fold(keep);while(keep>1&&scaleOf()<.72){keep--;fold(keep);}kr=scaleOf();}
    else if(more)more.remove();
    if(kr<.995){row.style.transformOrigin='top center';row.style.transform=`scale(${kr.toFixed(3)})`;}}};
   // On a phone the pieces start small; a board with room to spare grows them to fill it (Arena's cards fill the table).
   // The largest scale whose reflowed layout (rows wrap at width W/k) still fits both ways. Height is not monotonic in
   // k (a wider layout grows its pieces until a back row joins the lands), so step down to the first fit, then refine.
   // Trials measure every row unscaled and unfolded, the same way on every pass, so the result never depends on
   // what the previous pass folded (a fold adds or removes a chip, which redraws the table and fits again).
   const rows=[...zone.querySelectorAll('.play-match-card-row')];
   const fitsAt=k=>{zone.dataset.scaled='true';zone.style.width=`${W/k}px`;for(const r of rows){r.style.removeProperty('transform');for(const w of r.querySelectorAll(':scope>.play-match-card-wrap[hidden]'))w.hidden=false;const more=r.querySelector(':scope>.forge-lane-more');if(more)more.hidden=true;}return zone.scrollHeight*k<=H+1&&zone.scrollWidth*k<=W+1;};let k=growLimit();
   if(!fitsAt(k)){let lo=.4,hi=k;for(let t=k-.05;t>.4;t-=.05)if(fitsAt(t)){lo=t;hi=t+.05;break;}for(let i=0;i<3;i++){const mid=(lo+hi)/2;if(fitsAt(mid))lo=mid;else hi=mid;}k=lo;}
   fits.push({area,zone,own,W,H,k,fitRows,drop:own?0:Math.max(0,top-box.top)});
  }
  // A row that fits its lane at one width can fold or shrink differently at another, so the shared scale is checked
  // once laid out and stepped down until every side really fits.
  let k=Math.min(growLimit(),...fits.map(f=>f.k));
  for(let pass=0;pass<8;pass++){let over=false;
   for(const f of fits){const {area,zone,own,W,H,fitRows,drop}=f;
    if(Math.abs(k-1)<.005){zone.style.removeProperty('width');zone.style.removeProperty('transform');delete zone.dataset.scaled;fitRows();if(drop)zone.style.transform=`translateY(${drop.toFixed(1)}px)`;if(zone.scrollHeight>H+1)over=true;continue;}
    zone.dataset.scaled='true';zone.style.width=`${W/k}px`;fitRows();
    // The CPU side settles toward the divider, leaving room for keyword badges hanging under its cards.
    const h=zone.scrollHeight*k,lift=own?0:area.querySelectorAll(':scope>.play-match-zone').length>1?drop:Math.max(0,area.clientHeight-h-10);if(h>H+1)over=true;
    zone.style.transform=`translateY(${lift.toFixed(1)}px) scale(${k.toFixed(3)})`;
   }
   if(!over||k<=.4)break;k=Math.max(.4,k-.04);}
  // A pile's top card shows its name only when the whole name fits; otherwise the ×N badge and art carry it
  // (the full name stays in its title, label and peek), so a cut-off name never pokes out over the pile.
  for(const n of root.querySelectorAll('.play-match-battlefields .play-match-card-wrap[data-pile-top=true] .play-match-card-name')){const cut=n.scrollWidth>n.clientWidth+1;if(n.hasAttribute('data-cut')!==cut)n.toggleAttribute('data-cut',cut);}
  // Target rings and aim lines follow the cards to wherever this fit (or a later resize refit) put them.
  queueArrows();
 }
 const queueBoard=()=>{if(!boardFrame)boardFrame=win.requestAnimationFrame(fitBoard);};
 win.addEventListener('resize',queueBoard);
 const queueRails=()=>{if(!railFrame)railFrame=win.requestAnimationFrame(fitRails);};
 win.addEventListener('resize',queueRails);
 // A held board normally redraws without motion; a CPU playback beat (staged) moves it as it goes.
 function renderAccepted(s,blocked=false,staged=false){
  const previous=displayed,lifeBefore=new Map((displayed?.status?.surface?.players||[]).map(p=>[p.seat,p.life]));displayed=s;playbackBusy=blocked;root.dataset.forgePlayback=String(blocked);root.setAttribute('aria-busy',String(blocked));
  const focused=root.contains(doc.activeElement)?doc.activeElement.dataset.nativeKey:null;
  const before=presentation.hosted?positions():null,poses=presentation.hosted&&!reducedMotion()?posesNow():null,leaving=presentation.hosted?new Map([...root.querySelectorAll('.play-match-card[data-instance]')].map(el=>[el.dataset.instance,el.closest('.play-match-card-wrap')||el])):null;
  if(heldDrop?.ghost.isConnected&&lastDrop?.instance===String(heldDrop.id))lastDrop={...lastDrop,rect:heldDrop.ghost.getBoundingClientRect(),at:Date.now()};
  localError='';table.render(session.snapshot());enhance();observer.takeRecords();if(root.dataset.stage==='match')emotes?.mount();
  if(heldDrop&&!heldDrop.ghost.isConnected)root.append(heldDrop.ghost);
  // The stylesheet scopes the Forge table by this attribute. It changes only when the
  // native panel comes or goes, unlike a :has() test that rechecks the whole table each redraw.
  root.toggleAttribute('data-forge-native',!!root.querySelector('.forge-native-panel'));
  doc.body.toggleAttribute('data-forge-search',!!root.querySelector('.forge-zone-search'));
  // While a full-screen sheet asks (a library search, ordering triggers), the board behind it is out of reach.
  {const main=root.querySelector(':scope>.play-match-main'),sheet=!!root.querySelector('.forge-zone-search,.forge-order-cards');if(main&&main.inert!==sheet)main.inert=sheet;}
  if(before&&(!blocked||staged)){glide(before);boardEffects(previous,s,before,leaving);}
  if(poses)settlePoses(poses);
  dropHeld();
  if(presentation.hosted)tableAudio.update(previous,s);
  // Arena's low-life state: under 10 life the portrait cracks, under 6 it also bleeds a slow red glow.
  if(presentation.hosted)for(const p of s.status?.surface?.players||[]){const seat=seatEl(p.seat),band=typeof p.life!=='number'?'':p.life<=5?'critical':p.life<10?'low':'';if(seat&&(seat.dataset.lifeBand||'')!==band){if(band)seat.dataset.lifeBand=band;else delete seat.dataset.lifeBand;}}
  if(presentation.hosted&&!reducedMotion())for(const p of s.status?.surface?.players||[]){const was=lifeBefore.get(p.seat);if(was===undefined||was===p.life)continue;const seat=seatEl(p.seat),life=seat?.querySelector('.play-match-life strong,.play-pod-life');if(!seat||!life)continue;const delta=p.life-was,wait=Math.max(0,hitAt-Date.now()),badge=doc.createElement('span');badge.className='forge-life-delta';badge.dataset.dir=delta<0?'down':'up';badge.textContent=(delta>0?'+':'\u2212')+Math.abs(delta);badge.setAttribute('aria-hidden','true');seat.append(badge);badge.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(-4px)',offset:.25},{opacity:1,transform:'translateY(-10px)',offset:.75},{opacity:0,transform:'translateY(-18px)'}],{duration:1300,delay:wait,fill:'both'}).finished.then(()=>badge.remove(),()=>badge.remove());life.animate([{transform:'scale(1)'},{transform:'scale(1.22)',color:delta<0?'#ff9a8a':'#8fe7a3',offset:.35},{transform:'scale(1)'}],{duration:700,delay:wait});
   // During combat the total changes when the blow lands, not when the board updates.
   if(wait)life.textContent=String(was);setTimeout(()=>{if(!life.isConnected)return;if(Math.abs(delta)>1)motion.countUp(life,was,p.life,Math.min(700,240+Math.abs(delta)*40));else life.textContent=String(p.life);},wait);}
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
  restoreAutoPay(s);
  markAutoTap(s);
  if(!blocked){autoPassOwnStack(s);autoPassIdle(s);autoPassNoResponse(s);autoDeclareMust(s);}
 }
 // Engine and transport codes in plain words; a refusal Forge explains stays as Forge said it.
 const plainError=msg=>/ordered-source|order/i.test(msg)&&/unavailable|not supported/i.test(msg)?'These can\u2019t be reordered here yet, so they\u2019ll resolve in the default order.':/contract is unavailable|is not supported/i.test(msg)?'That choice isn\u2019t available on this table yet.':msg==='MATCH_NOT_READY'?'One moment, the table is catching up.':msg==='STALE_CHOICE'?'That choice ran out. Try again.':/^(CHOICE_INCOMPLETE)$/.test(msg)?'Pick everything this asks for first.':msg==='CHOICE_FULL'?'You\u2019ve already picked the most allowed.':/attack declaration invalid/i.test(msg)?'That attack isn\u2019t allowed. A creature that must attack this turn has to be in it.':/block declaration invalid/i.test(msg)?'Those blocks aren\u2019t allowed. Check creatures that must block or can\u2019t.':String(msg).replace(/^message:\s*/i,'');
 // Arena's combat line: while you choose attackers or blockers, a gold line runs across the
 // middle of the board, with a small running count at its right end once you have picked one.
 // It never carries text over your creatures; the dock already says what is being asked.
 function renderCombatLine(n,surface){
  const zone=root.querySelector('.play-match-battlefields .play-match-zone[data-owner=you]'),mode=n.inputType==='InputAttack'?'attack':n.inputType==='InputBlock'?'block':'';
  let line=combatLine;if(!mode||!zone){line?.remove();combatLine=null;return;}
  const mine=surface.cards.filter(c=>c.zone==='Battlefield'&&c.controller===surface.seat),k=mode==='attack'?mine.filter(c=>c.attacking).length:mine.filter(c=>c.blockingIds?.length||c.blocking).length;
  const key=`${mode}|${k}`;if(!line){line=combatLine=doc.createElement('div');line.className='forge-combat-line';line.setAttribute('aria-hidden','true');}const mat=root.querySelector('.play-match-mat');if(mat&&line.parentElement!==mat){if(line.parentElement||line.dataset.key)line.dataset.settled='';mat.append(line);}
  if(line.dataset.key!==key){line.dataset.key=key;line.dataset.mode=mode;line.innerHTML=k?`<i></i><span><b>${k}</b><small>${mode==='attack'?'attacking':'blocking'}</small></span>`:'<i></i><i></i>';}
  // Measured on your side's box, not the zone: the zone is laid out wider and scaled down, so its box changes mid-fit.
  const r=(zone.closest('.play-match-seat-area')||zone).getBoundingClientRect(),v=`${Math.round(r.left)}|${Math.round(r.top)}|${Math.round(r.width)}`;if(line.dataset.at!==v){line.dataset.at=v;line.style.left=Math.round(r.left)+'px';line.style.top=Math.round(r.top)+'px';line.style.width=Math.round(r.width)+'px';}
 }
 let manaOpen=false;
 const PHASE_STEPS=[['Upkeep',['Untap','Upkeep']],['Draw',['Draw']],['Main',['PreCombatMain']],['Combat',['BeginningOfCombat','DeclareAttackers','DeclareBlockers','FirstStrikeDamage','CombatDamage','EndCombat']],['Main 2',['PostCombatMain']],['End',['End','Cleanup']]];
 function renderPhaseTrack(surface,mat){
  if(!mat)return;let track=mat.querySelector(':scope>.forge-phase-track');
  const at=PHASE_STEPS.findIndex(([,list])=>list.includes(surface.phase)),owner=surface.activeSeat===surface.seat?'you':'cpu',key=[surface.turn,at,owner].join('|');
  if(!track){track=doc.createElement('div');track.className='forge-phase-track';track.setAttribute('role','status');mat.append(track);}
  if(track.dataset.key===key)return;track.dataset.key=key;track.dataset.owner=owner;
  const step=PHASE_STEPS[at]?.[0]||'';track.setAttribute('aria-label',`${owner==='you'?'Your':'CPU'} turn ${surface.turn}${step?', '+step:''}`);
  track.innerHTML=`<b><span class="forge-phase-who">${owner==='you'?'You':'CPU'} · </span>Turn ${surface.turn}</b><ol>${PHASE_STEPS.map(([label],i)=>`<li${i===at?' data-now="true"':i<at?' data-done="true"':''} title="${label}"><i></i>${i===at?`<span>${label}</span>`:''}</li>`).join('')}</ol>`;
 }
 const trackerSeen=new Map(),trackerOpen={deck:false,opponent:false},trackerIdentity=new Map();
 // The deck-list name of one physical card. Forge keeps a card's id when it transforms or becomes a
 // copy, so the name it first showed under is kept; a card first seen on its other face is matched by
 // that face. Tokens are never deck cards.
 function deckCardName(c,listed){
  if(trackerIdentity.has(c.id))return trackerIdentity.get(c.id);
  const faces=c.printing?.playArtwork?.card?.card_faces?.map(f=>f?.name).filter(Boolean)||[];
  const hit=[c.name,...faces].find(n=>listed.has(n)),name=hit?listed.get(hit):c.name;trackerIdentity.set(c.id,name);return name;
 }
 try{const saved=JSON.parse(win.localStorage?.getItem('cardstashy.tracker')||'{}');trackerOpen.deck=saved.deck===true;trackerOpen.opponent=saved.opponent===true;}catch{}
 const pct=(n,d)=>d>0?Math.round(n/d*100)+'%':'0%';
 let boardFrame=0,trackerCache={key:null,bar:'',nodes:[]},trackerToggled=null,combatLine=null,zoneOnly=null;
 function renderTracker(surface,mat){
  const header=root.querySelector('.play-match-header');if(!header||!mat)return;
  let bar=header.querySelector('.forge-tracker-toggles');
  const me=surface.players.find(p=>p.seat===surface.seat),lib=Math.max(0,Number(me?.libraryCount)||0);
  // Your library: the deck list minus every copy you can see anywhere else.
  // Each listed name, and each face of a two-faced listed name, leads to the list row.
  const listed=new Map();for(const r of presentation.tracker)for(const n of [r.name,...String(r.name).split(' // ')])if(!listed.has(n))listed.set(n,r.name);const out=new Map();
  for(const c of surface.cards)if(c.known&&c.owner===surface.seat&&!c.isToken&&c.zone!=='Library'){const name=deckCardName(c,listed);out.set(name,(out.get(name)||0)+1);}
  const left=presentation.tracker.map(r=>({...r,left:Math.max(0,r.qty-(out.get(r.name)||0))}));
  const landsLeft=left.filter(r=>r.land).reduce((n,r)=>n+r.left,0),landsTotal=left.filter(r=>r.land).reduce((n,r)=>n+r.qty,0);
  // The CPU's cards, remembered once shown so a card that leaves play still counts.
  for(const c of surface.cards)if(c.known&&c.owner!==surface.seat&&c.zone!=='Library'&&c.zone!=='Hand'&&!c.isToken)trackerSeen.set(c.id,{name:c.name,art:resolvePracticeArtwork(c)?.artImageUrl||'',cost:c.manaCost||''});
  const seen=new Map();for(const v of trackerSeen.values()){const e=seen.get(v.name)||{...v,n:0};e.n++;seen.set(v.name,e);}
  // One round button opens one tracker panel, with Library and Opponent as tabs and a close button,
  // instead of two look-alike eye toggles and a loose land percentage.
  const open=trackerOpen.deck||trackerOpen.opponent,side=trackerOpen.opponent?'opponent':'deck';
  if(!bar){bar=doc.createElement('div');bar.className='forge-tracker-toggles';bar.setAttribute('role','group');bar.setAttribute('aria-label','Deck tracker');header.append(bar);
   bar.addEventListener('click',e=>{if(!e.target.closest('button[data-tracker]'))return;setTracker(trackerOpen.deck||trackerOpen.opponent?null:'deck');});}
  const key=[open,side,lib,left.map(r=>r.left).join(','),[...seen.values()].map(v=>v.n).join(',')].join('|');
  // The table redraws the mat and header on every board change. Reuse the open panels as they were,
  // so they don't pop in again and reload their art; only a panel you just opened plays its entrance.
  if(trackerCache.key===key){if(bar.dataset.key!==key){bar.dataset.key=key;bar.innerHTML=trackerCache.bar;}for(const el of mat.querySelectorAll(':scope>.forge-tracker'))if(!trackerCache.nodes.includes(el))el.remove();for(const p of trackerCache.nodes)if(p.parentElement!==mat){p.dataset.settled='';mat.append(p);}return placeTracker(mat);}
  bar.dataset.key=key;
  bar.innerHTML=`<button type="button" data-tracker="toggle" aria-pressed="${open}" aria-label="${open?'Close deck tracker':'Open deck tracker'}" title="Deck tracker">${outlineIcon('M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 9h6M9 13h6')}<span>Deck tracker</span></button>`;
  for(const el of mat.querySelectorAll(':scope>.forge-tracker'))el.remove();
  const row=(art,name,cost,count,sub)=>`<li${count?'':' data-out="true"'}><span class="forge-tracker-art">${art?`<img src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}</span><span class="forge-tracker-name"><b>${esc(name)}</b>${cost?`<i>${manaCost({mana_cost:cost})}</i>`:''}</span><span class="forge-tracker-num"><b>${count}</b>${sub?`<small>${sub}</small>`:''}</span></li>`;
  if(open){const p=doc.createElement('section');p.className='forge-tracker';p.dataset.side='deck';p.dataset.view=side;if(trackerToggled!=='open')p.dataset.settled='';p.setAttribute('aria-label',side==='deck'?'Your library':'Cards the CPU has shown');
   const tabs=`<header><nav class="forge-tracker-tabs" role="tablist">${[['deck','Library',lib],['opponent','Opponent',trackerSeen.size]].map(([k,l,n])=>`<button type="button" role="tab" data-tracker-tab="${k}" aria-selected="${side===k}">${l}<span>${n}</span></button>`).join('')}</nav><button type="button" class="forge-tracker-close" data-tracker-close aria-label="Close deck tracker">\u00d7</button></header>`;
   if(side==='deck'){const rows=[...left.filter(r=>!r.land)].sort((a,b)=>(b.left>0)-(a.left>0)||a.name.localeCompare(b.name));
    p.innerHTML=`${tabs}<ul>${rows.map(r=>row(r.art,r.name,r.cost,r.left,r.left?pct(r.left,lib):'')).join('')}</ul><footer>${outlineIcon('M3 20l6-10 4 6 3-4 5 8z')}<span>Lands</span><b>${landsLeft}/${landsTotal}</b><small>${pct(landsLeft,lib)}</small></footer>`;}
   else p.innerHTML=`${tabs}${seen.size?`<ul>${[...seen.values()].map(v=>row(v.art,v.name,v.cost,v.n,'')).join('')}</ul>`:'<p>Nothing shown yet.</p>'}`;
   mat.append(p);}
  trackerToggled=null;trackerCache={key,bar:bar.innerHTML,nodes:[...mat.querySelectorAll(':scope>.forge-tracker')]};placeTracker(mat);
 }
 // One menu button: History & stack and the deck tracker live inside the match menu instead of
 // as their own round buttons; the menu button carries the stack count.
 // History & stack tells the match in plain words (both sides) instead of the table's decision steps.
 // Lines are kept by event number, so the story outlives the engine's short event window.
 const story=new Map();
 function tellStory(){
  const list=root.querySelector('details[data-keep-open=game-progress]>ol');if(!presentation.hosted||!list)return;
  const snap=session.snapshot();for(const line of storyLines(snap.native?.events?.items,snap.status?.surface))if(!story.has(line.seq))story.set(line.seq,line);
  if(story.size>400)for(const k of [...story.keys()].slice(0,story.size-400))story.delete(k);
  const rows=[...story.values()].slice(-40),key=rows.map(r=>r.seq).join(',');if(!rows.length||list.dataset.story===key)return;list.dataset.story=key;
  list.replaceChildren(...rows.map(r=>{const li=doc.createElement('li');li.textContent=r.text;if(/^Turn \d/.test(r.text))li.dataset.turn='true';if(r.card!==undefined)li.dataset.card=String(r.card);return li;}));
 }
 // Smart or Full Control decides only where the game stops; auto-pay keeps the player's own setting
 // (the engine resets it to the mode's default on a switch, so it is put back right after).
 async function switchMode(mode){const keep=session.snapshot().native?.autoPay;await session.setControlMode(mode);
  if(typeof keep==='boolean'&&typeof session.setAutoPay==='function'){const until=Date.now()+3000;while(Date.now()<until&&session.snapshot().native?.controlMode!==mode)await new Promise(r=>setTimeout(r,100));
   const now=session.snapshot().native;if(now?.controlMode===mode&&typeof now.autoPay==='boolean'&&now.autoPay!==keep&&!now.prompt&&now.inputType!=='InputLockUI')await session.setAutoPay(keep);}}
 function foldMenu(){
  tellStory();
  const menu=root.querySelector('.play-match-header>.play-match-menu');if(!presentation.hosted||!menu)return;
  let panel=menu.querySelector(':scope>.forge-menu-panel');
  if(!panel){panel=doc.createElement('div');panel.className='forge-menu-panel';for(const el of [...menu.children])if(el.tagName!=='SUMMARY')panel.append(el);menu.append(panel);}
  const history=root.querySelector('.play-match-header>button[data-focus-key=table-details]'),bar=root.querySelector('.play-match-header>.forge-tracker-toggles');
  if(history)panel.prepend(history);if(bar)(history||panel.firstChild)?.after?.(bar)??panel.prepend(bar);
  const summary=menu.querySelector(':scope>summary'),count=String(session.snapshot().native?.stack?.length||'');if(summary&&(summary.dataset.count||'')!==count){if(count)summary.dataset.count=count;else delete summary.dataset.count;}
 }
 // Commander presence (Randall, 28 Oct): each commander rides on the left of its player's profile
 // in a crowned gold crest that holds its art. In the command zone the crest is the card itself, so
 // hover, tap, drag and casting work as before; anywhere else the crest stays, dimmed, and opens
 // that card's preview. The profile photo and name stay the player's identity, online or not.
 const CREST_ZONE={Battlefield:'On field',Graveyard:'Graveyard',Exile:'Exiled',Hand:'In hand',Library:'Library',Stack:'Casting'};
 function crestArt(c,tone){
  const url=resolvePracticeArtwork(c)?.artImageUrl||'',id=`crest-${c.id}`;
  return `<svg class="forge-crest-frame" viewBox="0 0 62 74" aria-hidden="true" data-tone="${tone}"><defs><linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".45" stop-color="#e8b95b"/><stop offset="1" stop-color="#8a5f1c"/></linearGradient><clipPath id="${id}-c"><path d="M31 13 49 19V40c0 12-8 20-18 25C21 60 13 52 13 40V19z"/></clipPath></defs>
<path d="M9 24C2 26 0 34 3 41c2-5 5-7 9-7M53 24c7 2 9 10 6 17-2-5-5-7-9-7M10 46c-4 3-4 9 0 13 0-4 2-6 6-7M52 46c4 3 4 9 0 13 0-4-2-6-6-7" fill="none" stroke="url(#${id}-g)" stroke-width="2" stroke-linecap="round"/>
<path d="M31 8 54 15.5V40c0 15-10 24-23 30C18 64 8 55 8 40V15.5z" fill="#120d06" stroke="url(#${id}-g)" stroke-width="3"/>
<g clip-path="url(#${id}-c)"><rect x="5" y="9" width="52" height="60" fill="#2a2418"/>${url?`<image class="forge-crest-art" href="${esc(url)}" x="5" y="9" width="52" height="60" preserveAspectRatio="xMidYMid slice"/>`:`<text x="31" y="45" text-anchor="middle" fill="#e8d6a8" font-size="20" font-family="Cinzel,Georgia,serif">${esc(String(c.name||'?').charAt(0))}</text>`}<path d="M13 52c6 6 12 9 18 13 6-4 12-7 18-13v16H13z" fill="#0008"/></g>
<path d="M31 13 49 19V40c0 12-8 20-18 25C21 60 13 52 13 40V19z" fill="none" stroke="#fff2c455" stroke-width=".8"/>
<path d="M18 9 20 0l5.5 5L31-2l5.5 7L42 0l2 9z" class="forge-crest-crown" stroke="#fff2c9" stroke-width="1.1" stroke-linejoin="round"/><circle cx="31" cy="4.5" r="1.8" fill="#fff"/>
<path d="M31 64l5 5-5 5-5-5z" class="forge-crest-jewel" stroke="url(#${id}-g)" stroke-width="1.4"/></svg>`;
 }
 function renderCrests(surface,mat){
  if(!presentation.hosted||format!=='Commander'||!mat)return;
  const ledger=surface.commander?.commanders||[],tax=id=>{const t=ledger.find(e=>e.id===id)?.tax;return Number.isSafeInteger(t)&&t>0?t:0;};
  for(const own of surface.players.length>2?[true]:[true,false]){
   const seat=own?'you':'cpu',tone=own?'you':'cpu',commanders=surface.cards.filter(c=>c.commander===true&&c.known&&(c.owner===surface.seat)===own);
   let zone=mat.querySelector(`:scope>.play-command-zone[data-seat=${seat}]:not(.forge-crest-away)`),away=mat.querySelector(`:scope>.forge-crest-away[data-seat=${seat}]`);
   if(zone){away?.remove();zone.classList.add('forge-crest');
    for(const wrap of zone.querySelectorAll('.play-match-card-wrap')){const el=wrap.querySelector('.play-match-card[data-instance]'),c=surface.cards.find(x=>x.id===Number(el?.dataset.instance));if(!c)continue;
     const key=`${c.id}:${tax(c.id)}`;if(wrap.dataset.crest===key)continue;wrap.dataset.crest=key;wrap.querySelector(':scope>.forge-crest-frame')?.remove();wrap.querySelector(':scope>.forge-crest-tax')?.remove();
     wrap.insertAdjacentHTML('beforeend',crestArt(c,tone));if(tax(c.id)){const t=doc.createElement('span');t.className='forge-crest-tax';t.textContent=`+${tax(c.id)}`;t.setAttribute('aria-hidden','true');wrap.append(t);}}
    continue;}
   const c=commanders[0];if(!c){away?.remove();continue;}
   const key=`${c.id}:${c.zone}:${tax(c.id)}`;if(away?.dataset.crest===key)continue;
   if(!away){away=doc.createElement('section');away.className='play-command-zone forge-crest forge-crest-away';away.dataset.seat=seat;mat.append(away);}
   away.dataset.crest=key;const b=doc.createElement('button');b.type='button';b.className='forge-crest-away-button';b.dataset.nativeKey=`crest-${seat}`;b.setAttribute('aria-label',`${c.name} · ${CREST_ZONE[c.zone]||c.zone}`);
   b.innerHTML=`${crestArt(c,tone)}<span class="forge-crest-where">${esc(CREST_ZONE[c.zone]||'')}</span>${tax(c.id)?`<span class="forge-crest-tax">+${tax(c.id)}</span>`:''}`;
   const target=()=>root.querySelector(`.play-match-battlefields .play-match-card[data-instance="${c.id}"]`)||root.querySelector(`.play-match-card[data-instance="${c.id}"]`);
   b.addEventListener('click',e=>{e.stopPropagation();const el=target();if(el)peekFor===el&&peekPinned?hidePeek():showPeek(el,true);});
   b.addEventListener('pointerenter',e=>{if(e.pointerType==='touch'||peekPinned)return;const el=target();if(el){clearTimeout(peekTimer);peekTimer=setTimeout(()=>showPeek(el),200);}});
   b.addEventListener('pointerleave',e=>{if(e.pointerType==='touch'||peekPinned)return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>{if(!peekPinned)hidePeek();},90);});
   away.replaceChildren(b);
  }
 }
 function setTracker(side,animate=true){
  trackerOpen.deck=side==='deck';trackerOpen.opponent=side==='opponent';trackerToggled=side&&animate?'open':null;
  try{win.localStorage?.setItem('cardstashy.tracker',JSON.stringify(trackerOpen));}catch{}
  const bar=root.querySelector('.play-match-header .forge-tracker-toggles');if(bar)bar.dataset.key='';const s=session.snapshot();if(s.status?.surface)renderTracker(s.status.surface,root.querySelector('.play-match-mat'));
 }
 const trackerClick=e=>{const tab=e.target.closest?.('.forge-tracker [data-tracker-tab]'),close=e.target.closest?.('.forge-tracker [data-tracker-close]');if(!tab&&!close)return;e.preventDefault();e.stopPropagation();if(close)setTracker(null);else if(tab.getAttribute('aria-selected')!=='true')setTracker(tab.dataset.trackerTab,false);};
 root.addEventListener('click',trackerClick,true);
 // The tracker sits under the table controls on the left.
 function placeTracker(mat){
  const head=root.querySelector('.play-match-header')?.getBoundingClientRect(),seat=root.querySelector('.play-match-seat[data-seat=you]')?.getBoundingClientRect(),cmd=root.querySelector('.play-command-zone[data-seat=you]')?.getBoundingClientRect(),cpuRow=root.querySelector('.forge-zone-row[data-seat=cpu]')?.getBoundingClientRect(),dock=root.querySelector('.play-match-decisions')?.getBoundingClientRect();
  const deck=mat.querySelector(':scope>.forge-tracker[data-side=deck]'),opp=mat.querySelector(':scope>.forge-tracker[data-side=opponent]');
  if(deck&&head){const top=Math.round(head.bottom+10),bottom=Math.round(Math.min(cmd?.top??Infinity,seat?.top??win.innerHeight)-12);deck.style.top=top+'px';deck.style.maxHeight=Math.max(160,bottom-top)+'px';}
  if(opp){const top=Math.round((cpuRow?.bottom??80)+10),bottom=Math.round((dock?.top??win.innerHeight)-12);opp.style.top=top+'px';opp.style.maxHeight=Math.max(120,bottom-top)+'px';}
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
 // Arena puts a creature that must attack into the attack for you, so "N must attack" stays rare.
 // Once per creature per turn: if Forge takes it back out, the tag and the disabled button explain why.
 const mustDeclared=new Set();
 function autoDeclareMust(s){
  const n=s?.native,surface=s?.status?.surface;
  if(!presentation.hosted||!n||!surface||s.busy||s.transportError||n.prompt||n.inputType!=='InputAttack')return;
  const card=surface.cards.find(c=>c.zone==='Battlefield'&&c.controller===surface.seat&&owesAttack(c)&&c.attacking!==true&&!mustDeclared.has(`${n.turn}:${c.id}`));
  if(!card)return;mustDeclared.add(`${n.turn}:${card.id}`);
  act(()=>session.nativeSelect('card',card.id));
 }
 // Smart also moves on when your main phase has nothing left to play, as Arena does:
 // after your last land or spell resolves, a short beat to see it land, then Next.
 // Any playable card, stack item, prompt or Full Control keeps the stop.
 let idleTimer=0,idleKey='';
 const idleReady=s=>{const n=s?.native;return !!(presentation.hosted&&n&&n.controlMode==='smart'&&!s.busy&&!s.transportError&&!n.prompt&&!n.failure&&(n.status==='running'||n.status===undefined)
   &&n.inputType==='InputPassPriority'&&n.priorityPlayer===n.viewer&&n.activePlayer===n.viewer&&['MAIN1','MAIN2'].includes(n.phase)&&!n.stack?.length&&!(n.selection?.actionable||[]).length&&n.buttons?.okEnabled===true&&!drag?.active&&!playback?.running);};
 // Smart's last check, as on Arena: when Forge says you have nothing you could cast or activate right now
 // (native.canRespond false), your priority passes on its own after a short beat to see what happened, unless
 // you set a stop on this step. Without the flag nothing changes.
 let noResponseKey='',noResponseTimer=0;
 const noResponseReady=s=>{const n=s?.native;if(!(presentation.hosted&&n&&n.controlMode==='smart'&&n.canRespond===false&&!s.busy&&!s.transportError&&!n.prompt&&!n.failure&&(n.status==='running'||n.status===undefined)
   &&n.inputType==='InputPassPriority'&&n.priorityPlayer===n.viewer&&n.buttons?.okEnabled===true&&!drag?.active&&!playback?.running&&!handFocus&&peek.dataset.open!=='true'))return false;
  const stop=n.phaseStops?.[`${n.activePlayer===n.viewer?'you':'opponent'}:${n.phase}`];return stop!==true&&stop!==false;};
 function autoPassNoResponse(s){
  const n=s?.native,key=n?`${n.revision}`:'';
  if(!noResponseReady(s)){clearTimeout(noResponseTimer);noResponseTimer=0;return;}
  if(noResponseKey===key)return;noResponseKey=key;clearTimeout(noResponseTimer);
  noResponseTimer=setTimeout(()=>{noResponseTimer=0;const now=session.snapshot();if(closed||!noResponseReady(now)||now.native.revision!==n.revision)return;act(()=>session.nativeButton('ok',n.revision));},reducedMotion()?300:700);
 }
 function autoPassIdle(s){
  const n=s?.native,key=n?`${n.revision}:${n.phase}`:'';
  if(!idleReady(s)){clearTimeout(idleTimer);idleTimer=0;return;}
  if(idleKey===key)return;idleKey=key;clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{idleTimer=0;const now=session.snapshot();if(closed||!idleReady(now)||now.native.revision!==n.revision)return;act(()=>session.nativeButton('ok',n.revision));},reducedMotion()?250:900);
 }
 playback=new CpuActionPlaybackQueue({present:renderAccepted,beat:showPlaybackBeat,clear:clearPlaybackBeat,preload:preloadBeatArt,reducedMotion,speed:()=>cpuSpeed==='fast'?.5:1});
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
 // A commander's preview says where it is, what casting it from the command zone costs with tax,
 // and the commander damage it has dealt, from Forge's own ledger only.
 function commanderFacts(c){
  const surface=session.snapshot().status?.surface,data=surface?.commander,entry=data?.commanders?.find(e=>e.id===c.id),tax=Number.isSafeInteger(entry?.tax)&&entry.tax>0?entry.tax:0;
  const where={Command:'In the command zone',Battlefield:'On the battlefield',Graveyard:'In the graveyard',Exile:'In exile',Hand:'In hand',Library:'In the library',Stack:'Being cast'}[c.zone];
  const facts=[where,c.zone==='Command'?(tax?`Cast for its cost + ${tax} tax`:'Cast for its mana cost'):''];
  for(const d of data?.damage||[])if(d.commanderId===c.id&&Number.isSafeInteger(d.amount)&&d.amount>0)facts.push(`${d.amount}/21 commander damage to ${d.player===surface.seat?'you':'CPU'}`);
  const shown=facts.filter(Boolean);return shown.length?`<ul class="forge-peek-commander">${shown.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:'';
 }
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
  // Over the printed card its own power and toughness only repeat what it shows; a changed one still says so.
  const showPT=creature&&c.power!==null&&c.power!==undefined&&(!image||String(c.power)!==String(face?.power)||String(c.toughness)!==String(face?.toughness));
  return `<figure class="forge-peek-card" data-art="${image?'image':'drawn'}">${image}</figure>
<section class="forge-peek-info">
 <header><h3>${esc(c.name)}</h3>${c.manaCost?manaCost({mana_cost:c.manaCost}):''}</header>
 ${c.type?`<p class="forge-peek-type">${esc(c.type)}</p>`:''}
 ${showPT||chips.length?`<div class="forge-peek-state">${showPT?`<span class="forge-peek-pt">${stat(c.power,face.power)}<i>/</i>${stat(c.toughness,face.toughness)}</span>`:''}${chips.map(([k,t,icon])=>`<span class="forge-peek-chip" data-kind="${k}">${boardIcon(icon||chipIcon[k],'cs-icon forge-peek-icon')}${t}</span>`).join('')}</div>`:''}
 ${keywords.length?`<ul class="forge-peek-keywords">${keywords.map(k=>{const hint=keywordHint(k,reference);return `<li><b>${boardIcon(kwIcon.get(k),'cs-icon forge-peek-icon')}${symbolText(k.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/:/g,' '))}</b>${hint?`<span>${symbolText(hint)}</span>`:''}</li>`;}).join('')}</ul>`:''}
 ${lines.length?`<div class="forge-peek-rules">${lines.map(l=>`<p>${rule(l)}</p>`).join('')}</div>`:''}
 ${c.commander?commanderFacts(c):''}
 ${attached.length||withCards.length?`<p class="forge-peek-attached">${[...attached,withCards.length?`With ${withCards.join(', ')}`:''].filter(Boolean).join(' \u00b7 ')}</p>`:''}
</section>`;
 }
 function placePeek(anchor){
  // Wide screens dock the preview in the open space on the right, between the CPU seat and
  // the dock, so it never covers the board; narrow screens keep it beside the card.
  const top=Math.max(...['.play-match-seat[data-seat=cpu]','.forge-zone-row[data-seat=cpu]'].map(q=>root.querySelector(q)?.getBoundingClientRect().bottom||0)),bottom=root.querySelector('.play-match-decisions')?.getBoundingClientRect().top||win.innerHeight;
  const solo=presentation.hosted&&!!handFocus&&handFocus.contains(anchor)&&!!handFocusRect;peek.dataset.solo=String(solo);
  const docked=!solo&&presentation.hosted&&win.innerWidth>=1200&&win.innerWidth/win.innerHeight>=1.3&&bottom-top>=320;
  peek.dataset.docked=String(docked);if(docked)peek.style.setProperty('--peek-dock-h',`${Math.round(bottom-top-90)}px`);
  const r=anchor.getBoundingClientRect(),vw=win.innerWidth,vh=win.innerHeight,pw=peek.offsetWidth,ph=peek.offsetHeight,gap=14;
  // A focused hand card is already the big card: show only the glass info beside it (the side with room,
  // else above it), never a second copy of the card on top of it.
  let x,y;
  if(solo){const f=handFocusRect,room=Math.max(vw-f.right,f.left)-gap-8;
   // Beside the card wherever 140px fit (narrowed to the room), so on phones it covers the hand, not the board.
   peek.style.setProperty('--solo-max',`${Math.round(Math.min(260,Math.max(140,room)))}px`);const w=peek.offsetWidth,h=peek.offsetHeight;
   if(vw-f.right-gap-8>=w){x=f.right+gap;y=f.top;}
   else if(f.left-gap-8>=w){x=f.left-gap-w;y=f.top;}
   else{x=(f.left+f.right)/2-w/2;y=f.top-h-gap;if(y<8)y=Math.min(vh-h-8,f.bottom+gap);}
   x=Math.max(8,Math.min(vw-w-8,x));y=Math.max(8,Math.min(vh-h-8,y));peek.dataset.docked='false';peek.style.setProperty('--peek-x',`${Math.round(x)}px`);peek.style.setProperty('--peek-y',`${Math.round(y)}px`);return;}
  if(docked){x=vw-pw-24;y=Math.max(top+16,Math.min(bottom-ph-12,top+16));}
  else if(anchor.closest('.play-match-hand')){x=r.left+r.width/2-pw/2;y=r.top-ph-gap;}
  else{x=r.right+gap;if(x+pw>vw-8)x=r.left-gap-pw;y=r.top+r.height/2-ph/2;}
  x=Math.max(8,Math.min(vw-pw-8,x));y=Math.max(8,Math.min(vh-ph-8,y));
  peek.style.setProperty('--peek-x',`${Math.round(x)}px`);peek.style.setProperty('--peek-y',`${Math.round(y)}px`);
 }
 function showPeek(el,pinned=false){
  if(pinned)clearTimeout(peekTimer);const c=surfaceCard(el);if(!c?.known||drag?.active){hidePeek();return;}
  const keyNow=JSON.stringify([c.id,c.name,c.type,c.manaCost,c.isToken,c.commander,c.text,c.power,c.toughness,c.damage,c.counters,c.tapped,c.attacking,c.blocking,c.summoningSick,c.keywords,c.attachedTo,c.attachments,c.zone]);
  const fill=reference=>{if(peekFor!==el)return;peek.innerHTML=peekHtml(c,reference);peekKey=keyNow;peekAction(el);placePeek(el);};
  if(peekFor&&peekFor!==el)peekFor.removeAttribute('aria-describedby');
  peekFor=el;peekPinned=pinned;el.setAttribute('aria-describedby',peek.id);
  if(peekKey!==keyNow||peek.dataset.card!==String(c.id)){peek.dataset.card=String(c.id);fill(keywordReference&&typeof keywordReference.then!=='function'?keywordReference:null);loadKeywordReference().then(ref=>{if(peekFor===el&&peek.dataset.card===String(c.id)){peek.innerHTML=peekHtml(c,ref);peekAction(el);placePeek(el);}});}else{peekAction(el);}placePeek(el);
  peek.dataset.open='true';
 }
 function hidePeek(){if(root.dataset?.handLift==='true'&&lastPointerType!=='mouse')dropHandLift(200);clearTimeout(peekTimer);peek.dataset.open='false';peek.dataset.pinned='false';peekFor?.removeAttribute('aria-describedby');peekFor=null;peekPinned=false;}
 // A pinned preview of a card you can play or use right now offers that as one button.
 function peekAction(el){
  // Clear every earlier action button, not just the first (a second "Pick lands" used to pile up).
  for(let i=0,x;i<8&&(x=peek.querySelector('.forge-peek-actions,.forge-peek-play,.forge-peek-blocked'));i++)x.remove();peek.dataset.pinned=String(peekPinned);
  // Why Forge would not let you play or use it right now ("Need 2 mana"), before you try.
  if(el.dataset.forgeBlocked){const why=doc.createElement('p');why.className='forge-peek-blocked';why.setAttribute('role','note');why.textContent=el.dataset.forgeBlocked;(peek.querySelector('.forge-peek-info')||peek).append(why);}peek.setAttribute('role',peekPinned?'dialog':'tooltip');
  // A press-and-hold preview closes when the finger lifts, so it never offers a button.
  const n=session.snapshot().native;
  // On touch a hand card plays by dragging it up, like Arena; the glass shows no hint line for it.
  if(lastPointerType!=='mouse'&&el.closest('.play-match-hand'))return;
  if(!peekPinned||pressAt||!presentation.hosted||el.dataset.forgeHint!=='true'||n?.inputType!=='InputPassPriority'||n?.prompt)return;
  const b=doc.createElement('button');b.type='button';b.className='forge-peek-play';b.dataset.peekPlay='true';b.textContent=el.closest('.play-match-hand')?'Play':'Use';
  const row=doc.createElement('div');row.className='forge-peek-actions';row.append(b);(peek.querySelector('.forge-peek-info')||peek).append(row);
  // Never trust the auto-tapper: cast this one with auto-pay off, tap the lands you want, then
  // Forge's own Auto pays whatever is left. Auto-pay comes back once the payment is over.
  const cost=session.snapshot().status?.surface.cards.find(c=>c.id===Number(el.dataset.instance))?.manaCost||'';
  if(el.closest('.play-match-hand')&&n.autoPay===true&&typeof session.setAutoPay==='function'&&/\{(?!0\})[^}]+\}/.test(cost)){const m=doc.createElement('button');m.type='button';m.className='forge-peek-play forge-peek-manual';m.dataset.peekPlay='manual';m.textContent='Pick lands';m.title='Cast it and choose which lands pay';b.after(m);}
 }
 // While you pay by hand, Forge lists the sources its Auto button would tap twice among the
 // payable ones. Those get the gold preview; tapping any other land swaps it into the payment,
 // and Forge re-plans the rest.
 function markAutoTap(s){
  const n=s?.native,paying=presentation.hosted&&String(n?.inputType||'').startsWith('InputPayMana')&&!n?.prompt,seen=new Map();
  if(paying)for(const r of n.selection?.actionable||[])if(r?.kind==='card')seen.set(r.id,(seen.get(r.id)||0)+1);
  for(const el of root.querySelectorAll('.play-match-card[data-auto-tap]'))if(!(seen.get(Number(el.dataset.instance))>1))delete el.dataset.autoTap;
  for(const [id,count]of seen)if(count>1){const el=root.querySelector(`.play-match-card[data-instance="${id}"]`);if(el&&el.dataset.autoTap!=='true')el.dataset.autoTap='true';}
 }
 // Cast it with auto-pay off for this one payment, so you tap the sources yourself.
 function payByHand(id){act(async()=>{await session.setAutoPay(false);manualPay={seen:false,at:Date.now()};await session.nativeSelect('card',id);});}
 // The one spell cast with "Pick lands": once its payment has come and gone, auto-pay is restored.
 function restoreAutoPay(s){
  const n=s?.native;if(!manualPay||!n)return;
  if(String(n.inputType||'').startsWith('InputPayMana')){manualPay.seen=true;return;}
  if(!manualPay.seen&&Date.now()-manualPay.at<4000||s.busy||n.prompt||n.inputType==='InputLockUI'||n.autoPay!==false)return;
  manualPay=null;act(()=>session.setAutoPay(true));
 }
 // Tapping the open card closes it; its Play button plays it.
 peek.addEventListener('click',e=>{if(!e.target.closest?.('[data-peek-play]')){hidePeek();return;}e.preventDefault();e.stopPropagation();const card=peekFor,s=session.snapshot();
  if(!card||card.dataset.forgeHint!=='true'||s.busy){hidePeek();return;}const id=Number(card.dataset.instance),manual=e.target.closest('[data-peek-play]').dataset.peekPlay==='manual';hidePeek();
  if(!manual){act(()=>session.nativeSelect('card',id));return;}
  payByHand(id);});
 const peekCard=e=>{const card=e.target.closest?.('.play-match-card[data-instance]');return card&&root.contains(card)&&!card.closest('.forge-drag-ghost')?card:null;};
 const over=e=>{if(e.pointerType==='touch'||peekPinned)return;const card=peekCard(e);if(!card||e.pointerType==='mouse'&&presentation.hosted&&card.closest?.('.play-match-hand'))return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>showPeek(card),peekFor?40:240);};
 const out=e=>{if(e.pointerType==='touch'||peekPinned)return;const card=peekCard(e);if(!card||card.contains(e.relatedTarget)||e.pointerType==='mouse'&&presentation.hosted&&card.closest?.('.play-match-hand'))return;clearTimeout(peekTimer);peekTimer=setTimeout(()=>{if(!peekPinned)hidePeek();},90);};
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
 const playerOffered=seat=>{if(['target','chosen'].includes(seat.dataset.forgeRole))return true;const sel=session.snapshot().native?.selection||{};return [...(sel.targets||[]),...(sel.actionable||[]),...(sel.cards||[]),...(sel.chosen||[])].some(r=>r?.kind==='player');};
 const click=e=>{
  const pinned=peekPinned&&peekFor;if(peekPinned&&!e.target.closest?.('.forge-peek'))hidePeek();
  if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  // Touch has no hover: a tap on your portrait opens the mana pool and a tap anywhere else closes it.
  // A seat that is a target stays a target.
  if(presentation.hosted&&(e.pointerType||lastPointerType)!=='mouse'){const portrait=e.target.closest?.('.play-match-seat[data-seat=you]:not([data-forge-role=target]) .play-match-profile-badge');if(portrait||manaOpen){manaOpen=!!portrait&&!manaOpen;root.querySelector('.play-match-seat[data-seat=you]')?.toggleAttribute('data-mana-open',manaOpen);if(portrait){e.preventDefault();e.stopImmediatePropagation();return;}}}
  // A card listed in the Zones menu opens its preview here: the shared inspector stays hidden on this table.
  const listed=presentation.hosted&&e.target.closest?.('button[data-focus-key^="zone-card-"],button[data-focus-key^="revealed-card-"]');
  if(listed&&root.contains(listed)){e.preventDefault();e.stopImmediatePropagation();listed.dataset.instance=listed.dataset.focusKey.replace(/^\D+/,'');pinned===listed?hidePeek():showPeek(listed,true);return;}
  const card=e.target.closest?.('.play-match-card[data-instance]');if(card&&root.contains(card)){e.preventDefault();e.stopImmediatePropagation();const snapshot=session.snapshot(),cardId=Number(card.dataset.instance);if(previewOnly(card,snapshot,(e.pointerType||lastPointerType)==='touch')){pinned===card?hidePeek():showPeek(card,true);}else if(!snapshot.busy){card.classList.remove('forge-pressed');void card.offsetWidth;card.classList.add('forge-pressed');setTimeout(()=>card.classList.remove('forge-pressed'),420);const go=()=>act(()=>session.nativeSelect('card',cardId)),plan=card.closest('.play-match-hand')&&tapPlan(cardId),warn=plan?.warning;if(warn)confirmCostly(warn,e.clientX,e.clientY,go,plan.amount,plan.lands,()=>payByHand(cardId));else go();}return;}
  // A button inside the seat (Smart, Full Control, Auto-pay, the zone counts) is its own control, never a pick
  // of that player; and on the hosted table a seat is picked only while Forge offers players.
  const player=e.target.closest?.('[data-player-seat]'),inner=player&&e.target.closest?.('button,a,input,select,summary,[role=button]:not([data-player-seat])');
  if(player&&root.contains(player)&&!(inner&&player.contains(inner))&&(!presentation.hosted||playerOffered(player))){e.preventDefault();e.stopImmediatePropagation();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(player.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));return;}
  const zone=e.target.closest?.('.forge-zone-row button[data-zone]');if(zone&&root.contains(zone)){openZone(zone.closest('.forge-zone-row').dataset.seat,zone.dataset.zone,Number(zone.dataset.count));}
 };
 // Opens the existing Zones menu on just that player's list, beside the count you tapped; nothing
 // new is revealed. The library and an empty zone have no list, so their counts open nothing.
 function openZone(seat,zone,count){
  const menu=root.querySelector('.play-match-zones-menu');if(!menu||zone==='Library'||!(count>0))return;
  const heading=[...menu.querySelectorAll('h3')].find(h=>h.textContent.startsWith(seat==='you'?'Your':'CPU'));
  for(let el=heading?.nextElementSibling;el&&el.tagName!=='H3';el=el.nextElementSibling)if(el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent.startsWith(zone==='Command'?'Command zone':zone)){
   zoneOnly={seat,zone};menu.open=true;applyZoneFocus();el.querySelector('summary')?.focus();return;}
 }
 // The table redraws the menu on every update, so the one list you opened is marked again each time.
 function applyZoneFocus(){
  const menu=root.querySelector('.play-match-zones-menu');if(!menu)return;
  if(!zoneOnly||!menu.open){if(menu.dataset.only)delete menu.dataset.only;return;}
  const heading=[...menu.querySelectorAll('h3')].find(h=>h.textContent.startsWith(zoneOnly.seat==='you'?'Your':'CPU'));
  for(let el=heading?.nextElementSibling;el&&el.tagName!=='H3';el=el.nextElementSibling)if(el.tagName==='DETAILS'&&el.querySelector('summary')?.textContent.startsWith(zoneOnly.zone==='Command'?'Command zone':zoneOnly.zone)){
   if(el.dataset.zoneFocus!=='true'){for(const x of menu.querySelectorAll('[data-zone-focus]'))delete x.dataset.zoneFocus;el.dataset.zoneFocus='true';}
   el.open=true;menu.dataset.only=zoneOnly.seat;return;}
  zoneOnly=null;delete menu.dataset.only;
 }
 // The Zones menu closes on any tap outside it, and opening it from its own button shows every list.
 const closeZones=e=>{const menu=root.querySelector('.play-match-zones-menu[open]');if(menu&&!menu.contains(e.target)&&!e.target.closest?.('.forge-zone-row')){menu.open=false;}};
 const zonesToggled=e=>{const menu=e.target;if(!menu?.classList?.contains('play-match-zones-menu')||menu.open)return;zoneOnly=null;delete menu.dataset.only;for(const x of menu.querySelectorAll('[data-zone-focus]'))delete x.dataset.zoneFocus;};
 if(presentation.hosted){doc.addEventListener('pointerdown',closeZones,true);root.addEventListener('toggle',zonesToggled,true);}
 // Combat by drag, the way Arena does it: a blocker dropped on an attacker blocks it, and an
 // attacker dropped on a player or planeswalker attacks it. While you drag, what you could drop
 // on is lit; Forge still judges the pairing, and tapping one card then the other still works.
 function combatDrops(cardId){
  const s=session.snapshot(),n=s.native,surface=s.status?.surface;if(!n||n.prompt||!surface)return null;
  const card=surface.cards.find(c=>c.id===cardId);
  if(!card?.known||card.zone!=='Battlefield'||card.controller!==surface.seat||!card.types?.includes('Creature'))return null;
  // In a Commander pod every opponent still in the game can be attacked, on its seat or its chip.
  const opponents=surface.players.filter(p=>p.seat!==surface.seat&&!p.lost),theirs=new Set(opponents.map(p=>p.seat));if(!opponents.length)return null;
  if(n.inputType==='InputBlock'&&!card.attacking){const attackers=surface.cards.filter(c=>c.zone==='Battlefield'&&c.attacking&&c.controller!==surface.seat);return attackers.length?{mode:'block',targets:attackers.map(a=>({kind:'card',id:a.id}))}:null;}
  if(n.inputType==='InputAttack')return {mode:'attack',targets:[...opponents.map(p=>({kind:'player',seat:p.seat,nativeId:p.nativeId})),...surface.cards.filter(c=>c.zone==='Battlefield'&&theirs.has(c.controller)&&/\b(Planeswalker|Battle)\b/.test(c.type||'')).map(c=>({kind:'card',id:c.id}))]};
  return null;
 }
 const dropElement=t=>t.kind==='player'?seatEl(t.seat):root.querySelector(`.play-match-card[data-instance="${t.id}"]`);
 const dropElements=t=>t.kind==='player'?[...root.querySelectorAll(`.play-match-seat[data-player-seat="${t.seat}"],.play-pod-chip[data-player-seat="${t.seat}"]`)]:[dropElement(t)].filter(Boolean);
 // Re-applied after every redraw, so a board update during a drag keeps the lit targets.
 function markDrops(){
  for(const el of root.querySelectorAll('[data-forge-drop]'))el.removeAttribute('data-forge-drop');
  if(!drag?.active||!drag.combat){delete root.dataset.forgeDragMode;return;}
  root.dataset.forgeDragMode=drag.combat.mode;
  for(const t of drag.combat.targets)for(const el of dropElements(t))el.dataset.forgeDrop=drag.over===t?'over':'true';
 }
 // A target counts a little past its edges (more for small, tapped or crowded cards), so a drop just outside
 // an attacker still lands; the nearest one wins.
 const DROP_SLACK=22;
 const dropTargetAt=(x,y)=>{if(!drag?.combat)return null;const hit=doc.elementFromPoint(x,y);
  const direct=hit&&drag.combat.targets.find(t=>dropElements(t).some(el=>el===hit||el.contains(hit)||(el.closest('.play-match-card-wrap')||el).contains(hit)));if(direct)return direct;
  let best=null,bestD=Infinity;for(const t of drag.combat.targets)for(const el of dropElements(t)){const r=el.getBoundingClientRect();if(!r?.width)continue;const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=Math.hypot(dx,dy);if(d<=DROP_SLACK&&d<bestD){best=t;bestD=d;}}return best;};
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
  // A block that did not take says so, instead of leaving you to guess.
  if(plan.mode==='block'&&await settled()){const after=session.snapshot(),me=after.status?.surface.cards.find(c=>c.id===cardId);if(after.native?.inputType==='InputBlock'&&!after.native?.prompt&&me&&!me.blockingIds?.includes(target.id)){localError=`Block not assigned. Try again.`;panelKey='';enhance();}}
 }
 // Tapping a block line (or its x) takes that block back: Forge drops a blocker that is clicked again
 // while its attacker is the one in focus.
 async function unblock(blockerId,attackerId){
  const s=session.snapshot();if(s.native?.inputType!=='InputBlock'||s.native?.prompt)return;
  await session.nativeSelect('card',attackerId);if(!await settled())return;
  const now=session.snapshot();if(now.native?.inputType!=='InputBlock'||now.native?.prompt||now.native?.lastActionError)return;
  await session.nativeSelect('card',blockerId);
 }
 const unblockTap=e=>{const hit=e.target.closest?.('[data-blocker][data-attacker]');if(!hit)return;e.preventDefault();e.stopPropagation();haptic('tap');act(()=>unblock(Number(hit.dataset.blocker),Number(hit.dataset.attacker)));};
 arrows.addEventListener('click',unblockTap);
 // Arena's lift: a playable card from your hand glows blue in the hand and turns gold once
 // it is high enough to play; the lane it will settle in lights up softly under it.
 const laneFor=card=>{const c=surfaceCard(card);if(!c?.known)return '';return c.types?.includes('Creature')?'creatures':c.types?.includes('Land')?'lands':c.types?.some(t=>['Artifact','Enchantment','Planeswalker','Battle'].includes(t))?'other':'';};
 // One rule for the gold "ready" lift and for the release that plays: over the battlefield, or anywhere
 // above your hand that is not the decision dock. Dropping on the dock or back on the hand cancels.
 // Arena's auto-tap preview: while you carry a card, the lands Forge's auto-pay would tap for it lift and glow
 // (selection.actionable[].tapPreview). A payment that costs life or sacrifices a Treasure (tapWarning) asks
 // once more, in orange, before it goes. Without those fields nothing changes.
 // The planned sources that pay by being sacrificed (a Treasure, an Eldrazi Spawn or Scion, a Food that makes mana).
 // What a payment sacrifices, named as the player sees it: a self-sacrificing source by its name (Treasure, Eldrazi
 // Spawn), a source that eats another permanent as "Food (Gilded Goose)". Only mana abilities count.
 const sacrificeNames=ids=>{const cards=session.snapshot().status?.surface?.cards||[];return (ids||[]).map(id=>cards.find(c=>c.id===id)).filter(c=>c?.known).flatMap(c=>{
  const m=/sacrifice ([^:,.]+?)\s*:[^.]*\badd\b/i.exec(c.text||'');if(!m)return /^treasure$/i.test(c.name)?[c.name]:[];
  const what=m[1].trim(),self=/^(this|it|~)\b/i.test(what)||what.toLowerCase()===c.name.toLowerCase();if(self)return [c.name];
  const other=/^(?:an?|another)\s+(.+)$/i.exec(what);return [`${other?other[1].replace(/\b\w/,x=>x.toUpperCase()):what} (${c.name})`];});};
 const listNames=names=>{const counts=new Map();for(const x of names)counts.set(x,(counts.get(x)||0)+1);const parts=[...counts].map(([x,k])=>k>1?`${k} ${x}s`:x);return parts.length>1?`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`:parts[0];};
 const tapPlan=id=>{const row=(session.snapshot().native?.selection?.actionable||[]).find(r=>r?.kind==='card'&&Number(r.id)===Number(id));if(!row)return null;
  return {lands:Array.isArray(row.tapPreview)?row.tapPreview.map(Number).filter(Number.isSafeInteger):null,warning:row.tapWarning==='life'||row.tapWarning==='sacrifice'?row.tapWarning:null,amount:Number(row.tapWarningAmount)};};
 function markTapPreview(ids){const want=new Set(ids||[]);for(const el of root.querySelectorAll('[data-forge-tap-preview]'))if(!want.has(Number(el.dataset.instance)))el.removeAttribute('data-forge-tap-preview');
  for(const id of want){const el=root.querySelector(`.play-match-battlefields .play-match-card[data-instance="${id}"]`);if(el&&!el.hasAttribute('data-forge-tap-preview'))el.setAttribute('data-forge-tap-preview','true');}}
 function confirmCostly(kind,x,y,go,amount,lands=null,manual=null){
  root.querySelector(':scope>.forge-pay-warn')?.remove();const box=doc.createElement('div');box.className='forge-pay-warn';box.setAttribute('role','alertdialog');
  // Name what auto-pay would sacrifice (an Eldrazi Spawn is not a Treasure), and offer to pay with lands instead.
  const text=doc.createElement('p');const n=Number.isFinite(amount)&&amount>0?amount:0,names=kind==='sacrifice'?sacrificeNames(lands):[],what=names.length?listNames(names):n>1?`${n} permanents`:'a permanent';
  text.textContent=kind==='life'?(n?`Auto-pay costs ${n} life.`:'Auto-pay will cost you life.'):`Auto-pay sacrifices ${what}.`;
  const yes=doc.createElement('button');yes.type='button';yes.className='forge-pay-warn-go';yes.textContent=kind==='life'?(n?`Pay ${n} life`:'Pay life'):'Sacrifice';
  const no=doc.createElement('button');no.type='button';no.textContent='Cancel';box.append(text,no);
  const pick=manual&&typeof session.setAutoPay==='function'&&session.snapshot().native?.autoPay===true?doc.createElement('button'):null;
  if(pick){pick.type='button';pick.className='forge-pay-warn-go';pick.textContent='Pick lands';pick.addEventListener('click',()=>{close();haptic('tap');manual();});box.append(pick);yes.className='';}
  box.append(yes);root.append(box);
  const b=box.getBoundingClientRect();box.style.left=`${Math.round(Math.max(8,Math.min(win.innerWidth-8-b.width,x-b.width/2)))}px`;box.style.top=`${Math.round(Math.max(8,Math.min(win.innerHeight-8-b.height,y-b.height-16)))}px`;
  const close=()=>{box.remove();doc.removeEventListener('pointerdown',away,true);},away=e=>{if(!box.contains(e.target))close();};
  yes.addEventListener('click',()=>{close();haptic('tap');go();});no.addEventListener('click',close);doc.addEventListener('pointerdown',away,true);(pick||yes).focus();
 }
 // A card from your hand plays once it is carried past the glowing line a little above the hand, over the
 // table; never over a control, a portrait, the stack strip or the hand itself. Elsewhere it floats back.
 const PLAY_LINE=28,playLineY=()=>{const t=parseFloat(root.style.getPropertyValue('--forge-hand-top'));return Number.isFinite(t)?t-PLAY_LINE:(root.querySelector('.play-match-hand-area')?.getBoundingClientRect().top??win.innerHeight*.6)-PLAY_LINE;};
 const playDropAt=(x,y)=>{const hit=doc.elementFromPoint(x,y);if(hit?.closest('.play-match-decisions,.forge-native-panel,.play-match-hand-area,.forge-hand-slider,.play-match-seat,.play-command-zone,.forge-zone-row,.forge-menu-panel,.forge-native-actions,button:not(.play-match-card),summary'))return false;return y<playLineY()&&!!hit?.closest('.play-match-table');};
 function markPlayDrop(e){
  if(!ghost||!drag?.active||drag.combat)return;
  const fromHand=!!drag.source.closest('.play-match-hand'),playable=drag.source.dataset.forgeRole==='playable';
  const ready=presentation.hosted&&fromHand&&playable&&playDropAt(e.clientX,e.clientY);
  const state=ready?'ready':fromHand&&playable?'lift':'';markTapPreview(state?tapPlan(drag.id)?.lands:null);
  if(presentation.hosted){let line=root.querySelector(':scope>.forge-play-line');if(state&&!line){line=doc.createElement('div');line.className='forge-play-line';line.setAttribute('aria-hidden','true');root.append(line);}
   if(line){line.style.top=`${Math.round(playLineY())}px`;if(state)root.dataset.playLine=state;else delete root.dataset.playLine;}}if((ghost.dataset.drop||'')!==state){if(state==='ready')haptic('tick');ghost.dataset.drop=state;}
  const lane=ready?laneFor(drag.source):'';
  for(const el of root.querySelectorAll('[data-forge-lane-drop]'))if(el.dataset.cardGroup!==lane||!el.closest('[data-placement-zone=battlefield]'))el.removeAttribute('data-forge-lane-drop');
  const groups=root.querySelector('[data-placement-zone=battlefield] .play-match-zone-groups');
  if(lane&&groups){const at=groups.querySelector(`.play-match-lane[data-card-group="${lane}"]`);if(at)at.dataset.forgeLaneDrop='true';else groups.dataset.forgeLaneDrop=lane;}
  if(groups&&groups.dataset.forgeLaneDrop&&(!lane||groups.querySelector(`.play-match-lane[data-card-group="${lane}"]`)))delete groups.dataset.forgeLaneDrop;
 }
 // The lifted card trails the finger a touch (eased each frame) and leans into the motion.
 const followGhost=()=>{ghostFrame=0;if(!ghost||!drag?.active)return;const g=drag.g;g.x+=(g.tx-g.x)*.62;g.y+=(g.ty-g.y)*.62;g.tilt+=(Math.max(-14,Math.min(14,(g.tx-g.x)*.5))-g.tilt)*.3;ghost.style.translate=`${g.x.toFixed(1)}px ${g.y.toFixed(1)}px`;ghost.style.setProperty('--tilt',`${g.tilt.toFixed(2)}deg`);if(Math.abs(g.tx-g.x)+Math.abs(g.ty-g.y)+Math.abs(g.tilt)>.3)ghostFrame=win.requestAnimationFrame(followGhost);};
 // A drop that plays nothing floats the card back to its slot instead of vanishing.
 const returnGhost=(el,source,home)=>{const r=home?{left:home.ox,top:home.oy,width:0,height:0}:source?.isConnected&&source.getBoundingClientRect();if(!r||typeof el.animate!=='function'||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches){el.remove();return;}const [x,y]=(el.style.translate||'0px 0px').split(' ').map(parseFloat);const a=el.animate([{translate:`${x}px ${y}px`,scale:1},{translate:`${r.left+r.width/2}px ${r.top+r.height/2}px`,scale:.9,opacity:.6}],{duration:220,easing:'cubic-bezier(.3,.7,.2,1)'});a.onfinish=a.oncancel=()=>el.remove();};
 // The dropped card stays where your finger let it go (cancel() leaves a held ghost alone) until the next
 // accepted board says where it went: onto the battlefield it snaps into its slot from here (land() reads
 // lastDrop, refreshed from this ghost just before the redraw); still in your hand (refused, or waiting
 // there dimmed while it is cast) it floats back to it. If Forge says nothing within DROP_HOLD it floats back too.
 function holdDrop(pending){if(reducedMotion())return;dropHeld(true);const g=ghost;ghost=null;g.dataset.held='true';heldDrop={ghost:g,id:pending.id,revision:session.snapshot().status?.revision,gone:pending.gone,timer:setTimeout(()=>dropHeld(true),DROP_HOLD)};}
 function dropHeld(force=false){
  const h=heldDrop;if(!h)return;const s=session.snapshot(),c=s.status?.surface.cards.find(x=>x.id===h.id);
  if(!force&&c?.zone==='Hand'&&!c.inTransit&&(s.busy||s.status?.revision===h.revision)&&!s.native?.lastActionError)return;
  heldDrop=null;clearTimeout(h.timer);const el=cardEl(h.id),fade=()=>{const a=h.ghost.animate?.([{opacity:1},{opacity:0,scale:1.12}],{duration:180,easing:'ease-out',fill:'forwards'});if(a)a.onfinish=a.oncancel=()=>h.ghost.remove();else h.ghost.remove();};
  if(force&&!c)return h.ghost.remove();
  if(c?.zone==='Battlefield'&&el&&!el.closest('.play-match-hand'))return h.ghost.remove();
  // Anything else starts from the hand when it does arrive (a spell waits there, dimmed, while it is cast).
  lastDrop=null;if(c?.zone==='Hand'&&el){if(h.gone?.isConnected)delete h.gone.dataset.handGone;return returnGhost(h.ghost,el);}
  fade();
 }
 const cancel=(back=false)=>{if(ghostFrame)win.cancelAnimationFrame(ghostFrame);ghostFrame=0;drag?.source?.classList.remove('forge-drag-source');
  // A card that goes back reopens its slot; a played one keeps it shut until the hand redraws (or the play doesn't land).
  const gone=drag?.gone,reopen=()=>{if(gone?.isConnected)delete gone.dataset.handGone;};if(gone){if(back)reopen();else setTimeout(reopen,1500);}
  if(ghost){if(back)returnGhost(ghost,gone?null:drag?.source,gone?drag.g:null);else ghost.remove();}drag=null;ghost=null;root.classList.remove('forge-dragging');delete root.dataset.playLine;markTapPreview(null);for(const el of root.querySelectorAll('[data-forge-lane-drop]'))el.removeAttribute('data-forge-lane-drop');markDrops();};
 const down=e=>{lastPointerType=e.pointerType||'mouse';
  // Two fingers, like a physical table: while one thumb holds a card open to read it, another can drag a card.
  const second=e.isPrimary===false;if(e.button!==0||second&&!(pressAt&&pressAt.id!==e.pointerId&&!drag?.active))return;const card=e.target.closest?.('.play-match-card[data-instance]'),s=session.snapshot();
  if(second){if(!card||s.busy||s.native?.prompt||s.native?.inputType==='InputConfirmMulligan'||s.status?.terminal)return;drag={id:Number(card.dataset.instance),revision:s.status.revision,pointerId:e.pointerId,x:e.clientX,y:e.clientY,source:card,active:false,intent:'',ax:e.clientX,ay:e.clientY,second:true};return;}
  // In your hand a still hold reads the card under your thumb (it follows as you slide); elsewhere it reads the card you pressed.
  if(card&&e.pointerType!=='mouse'&&presentation.hosted&&card.closest('.play-match-hand')){clearTimeout(pressTimer);pressAt={x:e.clientX,y:e.clientY,id:e.pointerId};pressShown=false;pressTimer=setTimeout(()=>{if(drag?.active||drag?.intent==='browse')return;const c=handFocus?.querySelector('.play-match-card[data-instance]')||card;if(!c.isConnected)return;showPeek(c,true);pressShown=true;haptic('tick');suppressUntil=Date.now()+60000;},HAND_HOLD);}
  if(card&&e.pointerType!=='mouse'&&!(presentation.hosted&&card.closest('.play-match-hand'))){clearTimeout(pressTimer);pressAt={x:e.clientX,y:e.clientY,id:e.pointerId};pressShown=false;pressTimer=setTimeout(()=>{if(drag?.active)return;showPeek(card,true);pressShown=true;suppressUntil=Date.now()+60000;},420);}
 if(!card||s.busy||s.native?.prompt||s.native?.inputType==='InputConfirmMulligan'||s.status?.terminal)return;drag={id:Number(card.dataset.instance),revision:s.status.revision,pointerId:e.pointerId,x:e.clientX,y:e.clientY,source:card,active:false,intent:'',ax:e.clientX,ay:e.clientY};};
 // A thumb on your hand stays undecided until its movement shows what it means, as on Arena: sideways
 // browses the whole hand (even when it started on a card), a clear upward stroke picks up the card under
 // the thumb to play, and holding still reads it. Once browsing, only a fresh, steep upward stroke of
 // HAND_PLAY px plays, so the arc of a sliding thumb never grabs a card. Playable cards grab no sooner.
 const HAND_HOLD=380,HAND_SIDE=10,HAND_UP=22,HAND_PLAY=40;
 function handIntent(e){
  const c=drag.second?null:handFocus?.querySelector('.play-match-card[data-instance]');if(c&&c!==drag.source){drag.source=c;drag.id=Number(c.dataset.instance);}
  const dx=e.clientX-drag.ax,up=drag.ay-e.clientY;
  if(!drag.intent){if(Math.abs(dx)>=HAND_SIDE&&Math.abs(dx)>up*1.2)drag.intent='browse';else if(up>=HAND_UP&&up>Math.abs(dx)*1.4)drag.intent='play';}
  else if(drag.intent==='browse'){
   // Sideways travel and any downward drift move the anchor along, so only a new upward stroke counts.
   if(e.clientY>drag.ay||Math.abs(dx)>Math.max(up,0)*1.6){drag.ax=e.clientX;drag.ay=Math.max(drag.ay,e.clientY);}
   else if(up>=HAND_PLAY&&up>Math.abs(dx)*1.6)drag.intent='play';}
  if(drag.intent!=='play')return false;
  drag.x=drag.ax;drag.y=drag.ay;return true;
 }
 // Arena on touch: run your thumb sideways across your creatures while declaring attackers and each one you
 // pass joins the attack (or leaves it, if the first one was already attacking). Up or down still drags a
 // single creature to a target. Forge takes the clicks one at a time, in order.
 let swipeChain=Promise.resolve();
 function attackSwipe(e){
  if(e.pointerType==='mouse'||drag.active||drag.source.closest('.play-match-hand'))return false;
  const s=session.snapshot(),surface=s.status?.surface;if(s.native?.inputType!=='InputAttack'||s.native?.prompt||!surface)return false;
  const mineReady=el=>{const c=el&&surface.cards.find(x=>x.id===Number(el.dataset.instance));return c&&c.zone==='Battlefield'&&c.controller===surface.seat?c:null;};
  if(!drag.swipe){const dx=e.clientX-drag.x,dy=e.clientY-drag.y,first=mineReady(drag.source);if(!first||Math.abs(dx)<16||Math.abs(dx)<Math.abs(dy)*1.5)return false;
   drag.swipe={add:first.attacking!==true,seen:new Set()};clearTimeout(pressTimer);pressAt=null;pressShown=false;if(peekPinned)hidePeek();take(drag.source);}
  take(doc.elementFromPoint(e.clientX,e.clientY)?.closest?.('.play-match-battlefields .play-match-card[data-instance]'));return true;
  function take(el){const c=mineReady(el);if(!c||drag.swipe.seen.has(c.id))return;drag.swipe.seen.add(c.id);
   if(drag.swipe.add?c.attacking===true||el.dataset.forgeRole!=='choice':c.attacking!==true)return;
   el.setAttribute('data-forge-swiped','true');haptic('tick');
   swipeChain=swipeChain.then(async()=>{const now=session.snapshot();if(now.native?.inputType!=='InputAttack'||now.native?.prompt)return;await session.nativeSelect('card',c.id);await settled();}).catch(fail);}
 }
 // A thumb wobbles: on touch a hold survives TOUCH_SLOP px of drift before it counts as a drag.
 const TOUCH_SLOP=14;
 // Drift cancels a press only before its preview opens; after that the press is kept so
 // its release or cancel still ends the 60 s click guard.
 const move=e=>{if(root.dataset.forgeInput==='InputSelectTargets'&&presentation.hosted&&(e.pointerType==='mouse'||e.buttons)){aim={x:e.clientX,y:e.clientY};queueArrows();}else if(aim&&root.dataset.forgeInput!=='InputSelectTargets'){aim=null;queueArrows();}
  if(pressAt?.id===e.pointerId&&!pressShown&&Math.hypot(e.clientX-pressAt.x,e.clientY-pressAt.y)>(e.pointerType==='mouse'?8:TOUCH_SLOP)){clearTimeout(pressTimer);pressAt=null;}
  if(!drag||drag.pointerId!==e.pointerId)return;if(attackSwipe(e)){if(e.cancelable)e.preventDefault();return;}if(peekFor&&drag.active&&!(drag.second&&pressShown))hidePeek();if(drag.revision!==session.snapshot().status?.revision&&!session.snapshot().status?.surface.cards.some(c=>c.id===drag.id)){cancel();return;}if(!drag.active&&e.pointerType!=='mouse'&&drag.source.closest('.play-match-hand')&&!handIntent(e))return;
  if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>(pressShown&&pressAt?.id===e.pointerId?18:e.pointerType==='mouse'?8:TOUCH_SLOP+2)){drag.active=true;drag.combat=combatDrops(drag.id);haptic('tick');}if(!drag.active)return;if(e.cancelable)e.preventDefault();if(!ghost){ghost=drag.source.cloneNode(true);ghost.removeAttribute('data-instance');ghost.classList.add('forge-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');const sr=drag.source.getBoundingClientRect();ghost.style.width=Math.min(sr.width,drag.source.offsetWidth||sr.width)+'px';ghost.style.left='0px';ghost.style.top='0px';drag.g={x:sr.left+sr.width/2,y:sr.top+sr.height/2,ox:sr.left+sr.width/2,oy:sr.top+sr.height/2,tx:e.clientX,ty:e.clientY,tilt:0};drag.rubber=presentation.hosted&&!!drag.source.closest('.play-match-hand')&&!drag.combat&&drag.source.dataset.forgeRole!=='playable';if(drag.rubber)ghost.classList.add('forge-rubber');ghost.style.translate=`${drag.g.x}px ${drag.g.y}px`;root.append(ghost);drag.source.classList.add('forge-drag-source');root.classList.add('forge-dragging');
   // An attacker or blocker rides above the finger (below it at the top edge), so the player or creature under it stays in view.
   drag.lift=drag.combat?Math.round((ghost.offsetHeight||60)/2+(e.pointerType==='mouse'?14:36)):0;
   // Like Arena, a card dragged out of the hand leaves no hole: its slot closes and the fan slides together.
   {const w=!drag.rubber&&!drag.second&&drag.source.closest('.play-match-hand .play-match-card-wrap');if(w){w.style.setProperty('--gone-w',`${w.offsetWidth}px`);focusHand(null);w.dataset.handGone='true';drag.gone=w;}}}{const t=e.timeStamp||Date.now(),dt=Math.max(1,t-(drag.vt||t-16));drag.vy=.6*(drag.vy||0)+.4*((drag.vly??e.clientY)-e.clientY)/dt;drag.vt=t;drag.vly=e.clientY;}
  // A card you can't play now stretches a little toward your finger and springs back: it never leaves the hand.
  if(drag.rubber){const dx=e.clientX-drag.x,dy=e.clientY-drag.y,d=Math.hypot(dx,dy)||1,reach=44*(1-Math.exp(-d/110));drag.g.tx=drag.g.ox+dx/d*reach;drag.g.ty=drag.g.oy+dy/d*reach;if(!drag.rubberSaid){drag.rubberSaid=true;haptic('tick');}}
  else{drag.g.tx=e.clientX;drag.g.ty=drag.lift&&e.clientY-drag.lift<drag.lift?e.clientY+drag.lift+8:e.clientY-(drag.lift||0);}if(!ghostFrame)ghostFrame=win.requestAnimationFrame(followGhost);if(!drag.rubber)markPlayDrop(e);if(drag.combat){const over=dropTargetAt(e.clientX,e.clientY);if(over!==drag.over||!root.querySelector('[data-forge-drop]')){if(over&&over!==drag.over)haptic('tick');drag.over=over;markDrops();}}};
 // Like Arena, a card dragged out of your hand plays when released anywhere above
 // the hand; Forge decides where it goes. Other drags keep their drop targets.
 const up=e=>{if(pressAt?.id===e.pointerId){clearTimeout(pressTimer);pressAt=null;if(pressShown){pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;}}
  if(!drag||drag.pointerId!==e.pointerId)return;if(drag.swipe){suppressUntil=Date.now()+350;for(const el of root.querySelectorAll('[data-forge-swiped]'))el.removeAttribute('data-forge-swiped');cancel();return;}const pending=drag,target=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-placement-zone=battlefield],.forge-native-panel'),handTop=root.querySelector('.play-match-hand-area')?.getBoundingClientRect().top,fromHand=!!pending.source.closest('.play-match-hand'),overHand=!!doc.elementFromPoint(e.clientX,e.clientY)?.closest('.play-match-hand-area'),aboveHand=presentation.hosted&&fromHand&&handTop!==undefined&&e.clientY<handTop&&!overHand;if(pending.active)suppressUntil=Date.now()+300;const combatTarget=pending.active?dropTargetAt(e.clientX,e.clientY):null;// A quick upward flick plays a playable card even when it is let go short of the play line.
  const flick=presentation.hosted&&fromHand&&pending.active&&!pending.rubber&&(pending.vy||0)>.55&&pending.y-e.clientY>=36;
  const plays=pending.active&&!combatTarget&&(presentation.hosted&&fromHand?pending.source.dataset.forgeRole==='playable'&&(playDropAt(e.clientX,e.clientY)||flick):target&&root.contains(target)||aboveHand);if(plays&&ghost){lastDrop={instance:String(pending.id),rect:ghost.getBoundingClientRect(),at:Date.now()};holdDrop(pending);}cancel(pending.active&&!plays&&!combatTarget);if(plays||combatTarget)haptic('tap');if(combatTarget){act(()=>dropCombat(pending.combat,pending.id,combatTarget));return;}if(plays){const now=session.snapshot().status?.revision,go=()=>act(()=>session.nativeSelect('card',pending.id,now===pending.revision||session.snapshot().status?.surface.cards.some(c=>c.id===pending.id)?now:pending.revision));const plan=tapPlan(pending.id),warn=plan?.warning;if(warn)confirmCostly(warn,e.clientX,e.clientY,go,plan.amount,plan.lands,()=>payByHand(pending.id));else go();}};
 // A press that the browser takes over (a scroll, a system gesture) ends the preview and its click guard.
 // A long press's 60 s click guard ends with that press even when a redraw, scroll or
 // resize already closed its preview; otherwise the table would ignore taps for a minute.
 const pressCancel=e=>{if(pressAt?.id===e.pointerId){clearTimeout(pressTimer);pressAt=null;pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;}cancel();};
 // Like Arena on PC, Space or Enter presses the main button (Next, Pass, Attack, Done), even after
 // clicking a card, unless another control has focus, where those keys already mean that control.
 const mainKey=e=>{if(e.key!==' '&&e.key!=='Enter'||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!presentation.hosted||root.dataset.stage!=='match'||drag?.active)return false;
  if(!e.target?.closest?.('.play-match-card')&&e.target?.closest?.('input,textarea,select,button,a[href],summary,dialog,[contenteditable],[role=button],[role=dialog],[tabindex]:not([tabindex="-1"])')||doc.querySelector('dialog[open]'))return false;
  const ok=root.querySelector('.play-match-decisions [data-native-key=ok]');if(!ok||ok.disabled||!ok.getClientRects().length)return false;e.preventDefault();ok.click();return true;};
 const key=e=>{if(mainKey(e))return;if(e.key==='Escape')cancel();const seat=e.target.closest?.('[data-player-seat][role=button]');if(seat&&seat===e.target&&root.contains(seat)&&(e.key==='Enter'||e.key===' ')&&(!seat.classList.contains('play-pod-chip')||playerOffered(seat))){e.preventDefault();const p=session.snapshot().status?.surface.players.find(p=>p.seat===Number(seat.dataset.playerSeat));if(p)act(()=>session.nativeSelect('player',p.nativeId));}};
 // Arena's hand: it rests low, tucked above your profile strip, and rises into full view while
 // a thumb is on it or the mouse is over it, then settles back once you let go. The rise is just
 // enough to clear the strip and the screen edge, measured each time, so nothing else moves; on a
 // short screen it stops at a fifth of the height so your creatures stay in view (the focused card
 // pops clear on its own).
 // The card under your thumb rises out of the fan; sliding sideways moves through the hand by x alone,
 // so a thumb drifting up or down never skips cards.
 const focusHand=wrap=>{if(wrap===handFocus)return;handFocus=wrap||null;handFocusId=handFocus?.querySelector('.play-match-card[data-instance]')?.dataset.instance??null;layoutHand();if(handFocus)haptic('tick');
  const slider=root.querySelector(':scope>.forge-hand-slider');if(slider){const wraps=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')],i=wraps.indexOf(handFocus);slider.dataset.active=String(i>=0);if(i>=0)slider.style.setProperty('--pos',(i/Math.max(1,wraps.length-1)).toFixed(3));}};
 // A big hand also gets a slim slider above it on touch screens: sliding along it walks the whole hand
 // card by card, a steadier backup to browsing on the fan itself. It never plays a card.
 function slideHand(e){if(e.pointerType==='mouse'||e.button||e.isPrimary===false)return;e.preventDefault();e.stopPropagation();const slider=e.currentTarget,id=e.pointerId;lastPointerType=e.pointerType;slider.setPointerCapture?.(id);clearTimeout(handLiftTimer);setHandLift(true);
  const to=ev=>{const r=slider.getBoundingClientRect(),wraps=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')];if(!wraps.length)return;const t=Math.max(0,Math.min(1,(ev.clientX-r.left-18)/Math.max(1,r.width-36)));focusHand(wraps[Math.round(t*(wraps.length-1))]);};
  const move=ev=>{if(ev.pointerId===id)to(ev);},end=ev=>{if(ev.pointerId!==id)return;slider.removeEventListener('pointermove',move);slider.removeEventListener('pointerup',end);slider.removeEventListener('pointercancel',end);suppressUntil=Math.max(suppressUntil,Date.now()+300);dropHandLift(1600);};
  slider.addEventListener('pointermove',move);slider.addEventListener('pointerup',end);slider.addEventListener('pointercancel',end);to(e);}
 const handWrapAt=x=>{const g=handGeometry();if(!g)return null;const xl=(x-g.ox)/g.K+g.ox-g.box.left;let hit=g.wraps[0];for(const w of g.wraps)if(g.local(w).x<=xl)hit=w;return hit;};

 // Arena's hand fan. The focused card pops to about 1.5x (bigger when cards are small, so its text reads),
 // stands upright and comes fully into view; its neighbours slide aside, less with each card further
 // out, never past the screen edge. Everything is measured against where the hand will end up (its
 // lift and scale), not where it is mid-animation, and in the cards' own layout positions, so the
 // fan never chases itself. The same path serves mouse hover and a thumb.
 function handGeometry(){const area=root.querySelector('.play-match-hand-area'),wraps=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')];if(!area||!wraps.length||!area.offsetParent)return null;
  const pr=area.offsetParent.getBoundingClientRect(),box={left:pr.left+area.offsetParent.clientLeft+area.offsetLeft,top:pr.top+area.offsetParent.clientTop+area.offsetTop,w:area.offsetWidth,h:area.offsetHeight};
  const lifted=root.dataset.handLift==='true',K=lifted?Number(root.style.getPropertyValue('--hand-scale'))||1:1,R=lifted?Number(root.style.getPropertyValue('--hand-raise').replace('px',''))||0:0,ox=box.left+box.w/2,oy=box.top+box.h;
  const local=el=>{let x=0,y=0,n=el;while(n&&n!==area){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent;}return {x,y,w:el.offsetWidth,h:el.offsetHeight};};
  const sx=xl=>ox+(box.left+xl-ox)*K,sy=yl=>oy-R+(box.top+yl-oy)*K;return {area,wraps,box,K,R,ox,oy,local,sx,sy};}
 // On a portrait screen (a phone, or a Fold opened up) a big hand squeezes its fan to sit inside the 16px gutters instead of running off the edge;
 // "View full hand" shows every card at full size.
 function fitHandFan(hand){
  for(const w of hand)w.style.removeProperty('margin-left');
  if(hand.length<2||root.dataset.handExpanded==='true'||win.innerWidth>win.innerHeight*.9)return;
  const rect=w=>(w.querySelector('.play-match-card')||w).getBoundingClientRect(),a=rect(hand[0]),b=rect(hand[hand.length-1]),over=b.right-a.left-(win.innerWidth-32);
  if(over<=0)return;const step=over/(hand.length-1);
  hand.slice(1).forEach(w=>w.style.setProperty('margin-left',`${(parseFloat(getComputedStyle(w).marginLeft)||0)-step}px`));
 }
 // The hand slider has its own strip above the fan, at least 8px clear of the highest card, sharing it with
 // "View full hand" on the right; it spans the fan itself, not the whole screen. Measured at rest; a lifted
 // hand carries it up by the same amount (CSS).
 function placeHandSlider(hand){const slider=root.querySelector(':scope>.forge-hand-slider');if(!slider||!hand.length||root.dataset.handLift==='true')return;
  const rects=hand.map(w=>(w.querySelector('.play-match-card')||w).getBoundingClientRect()),pill=root.querySelector('.forge-hand-expand')?.getBoundingClientRect(),cardTop=Math.min(...rects.map(r=>r.top));
  const l=Math.max(16,Math.min(...rects.map(r=>r.left))),r=Math.min(win.innerWidth-16,Math.max(...rects.map(r=>r.right)),pill?.width?pill.left-8:Infinity),top=Math.min(pill?.height?pill.top+pill.height/2-22:Infinity,cardTop-8-44);
  // A turn dock that reaches down beside the hand (a tall touch screen) ends the slider at its left edge.
  const dock=root.querySelector('.play-match-decisions:not(:has(.forge-order-cards,.forge-zone-search))')?.getBoundingClientRect(),end=dock?.height&&dock.top<top+44&&dock.bottom>top&&dock.left>l?Math.min(r,dock.left-8):r;
  // A hand squeezed too narrow for a slider beside its expand pill drops the slider; the pill opens the whole hand.
  slider.style.display=end-l<120?'none':'';
  slider.style.left=`${Math.round(l)}px`;slider.style.width=`${Math.round(Math.max(120,end-l))}px`;slider.style.right='auto';slider.style.top=`${Math.round(top)}px`;}
 function layoutHand(){const g=handGeometry();if(!g)return;const fi=g.wraps.indexOf(handFocus);
  for(const w of g.wraps){if(w!==handFocus)w.removeAttribute('data-hand-focus');}
  if(fi<0){delete root.dataset.handFocused;handFocusRect=null;}else root.dataset.handFocused='true';
  if(fi<0){for(const w of g.wraps)for(const v of ['--shove','--focus-k','--focus-x','--focus-y'])w.style.removeProperty(v);return;}
  const W=win.innerWidth,H=win.innerHeight,L=g.wraps.map(g.local),f=L[fi],K=g.K,touch=handPointer!==null&&lastPointerType!=='mouse';
  const restTop=g.sy(f.y),restBottom=g.sy(f.y+f.h),cx=g.sx(f.x+f.w/2),bottom=Math.min(touch?restTop+f.h*K*.25:restBottom,H-8);
  // A playable card already sits a few pixels up inside its slot; count that so the popped card's top
  // edge (its name) stays on screen. Short screens keep it nearer 1.5x.
  const lift=-Math.min(0,parseFloat(String(getComputedStyle(handFocus.querySelector('.play-match-card')||handFocus).translate).split(' ')[1])||0),top=12;
  // While you pick targets or pay a cost the board must stay visible, so the pop is small then.
  const picking=(()=>{const i=String(session.snapshot().native?.inputType||'');return i==='InputSelectTargets'||i.startsWith('InputPayMana');})();
  let k=Math.max(1,Math.min(picking?1.2:H<500||W<600&&H>W?2:3,Math.max(1.5,230/(f.w*K)),(bottom-top)/((f.h+lift)*K),(W-12)/(f.w*K))),half=f.w*K*k/2,dx=Math.max(6+half-cx,Math.min(0,W-6-half-cx));
  let fk=k,fx=dx/K,fy=(bottom-restBottom)/K;
  // Then check against the real box: try the target with transitions off, measure the card, pull it back
  // inside 8px of every edge (shrinking it if it can't fit), and let it animate from where it was.
  {const card=handFocus.querySelector('.play-match-card')||handFocus,keep=['--focus-k','--focus-x','--focus-y'].map(p=>handFocus.style.getPropertyValue(p)),wasFocus=handFocus.hasAttribute('data-hand-focus'),shove=handFocus.style.getPropertyValue('--shove');
   const set=(a,b,c)=>{handFocus.style.setProperty('--focus-k',a.toFixed(3));handFocus.style.setProperty('--focus-x',`${b.toFixed(1)}px`);handFocus.style.setProperty('--focus-y',`${c.toFixed(1)}px`);};
   handFocus.style.transition='none';handFocus.style.removeProperty('--shove');handFocus.setAttribute('data-hand-focus','true');set(fk,fx,fy);
   const ar=g.area.getBoundingClientRect(),cs=ar.width/g.box.w||1,cr=card.getBoundingClientRect(),toX=x=>g.sx((x-ar.left)/cs),toY=y=>g.sy((y-ar.top)/cs);
   const L=toX(cr.left),Rr=toX(cr.right),T=toY(cr.top),B=toY(cr.bottom),shrink=Math.min(1,(W-16)/Math.max(1,Rr-L),(B-12)/Math.max(1,B-T));
   const c=(L+Rr)/2,half=(Rr-L)/2*shrink,shift=Math.max(8-(c-half),Math.min(0,W-8-(c+half)));fk=Math.max(1,fk*shrink);fx+=shift/K;handFocusRect={left:c-half+shift,right:c+half+shift,top:B-(B-T)*shrink,bottom:B};
   if(wasFocus){keep.forEach((v,i)=>{const p=['--focus-k','--focus-x','--focus-y'][i];if(v)handFocus.style.setProperty(p,v);else handFocus.style.removeProperty(p);});}else{handFocus.removeAttribute('data-hand-focus');for(const p of ['--focus-k','--focus-x','--focus-y'])handFocus.style.removeProperty(p);if(shove)handFocus.style.setProperty('--shove',shove);}
   void handFocus.offsetWidth;handFocus.style.removeProperty('transition');}
  handFocus.setAttribute('data-hand-focus','true');handFocus.style.removeProperty('--shove');handFocus.style.setProperty('--focus-k',fk.toFixed(3));handFocus.style.setProperty('--focus-x',`${fx.toFixed(1)}px`);handFocus.style.setProperty('--focus-y',`${fy.toFixed(1)}px`);if(peekFor&&peek.dataset.open==='true'&&handFocus.contains(peekFor))placePeek(peekFor);
  {const hk=f.w*K*fk/2;half=hk;dx=fx*K;}
  for(const side of [-1,1]){const idx=[];for(let i=fi+side;i>=0&&i<L.length;i+=side)idx.push(i);if(!idx.length)continue;
   const s=Math.abs(L[idx[0]].x-f.x)*K,first=Math.min(f.w*K*1.2,Math.max(0,side*dx+half-s+f.w*K/2+4));const sh=idx.map((_,j)=>first*Math.max(0,1-j*.34));
   let room=1;idx.forEach((i,j)=>{if(!sh[j])return;const edge=side>0?W-6-g.sx(L[i].x+L[i].w):g.sx(L[i].x)-6;room=Math.min(room,Math.max(0,edge)/sh[j]);});
   idx.forEach((i,j)=>{const v=side*sh[j]*room/K;if(Math.abs(v)<.5)g.wraps[i].style.removeProperty('--shove');else g.wraps[i].style.setProperty('--shove',`${v.toFixed(1)}px`);for(const p of ['--focus-k','--focus-x','--focus-y'])g.wraps[i].style.removeProperty(p);});}}
 // The table redraws its hand on every update; the focused card keeps its place across redraws.
 // After a redraw the hand's cards are new nodes: the card you were on is popped again at once, and its
 // neighbours stand aside at once, so an update elsewhere in the game never shrinks and regrows it.
 function refocusHand(){if(handFocusId===null){handFocus=null;return;}const card=root.querySelector(`.play-match-hand .play-match-card[data-instance="${CSS.escape(String(handFocusId))}"]`);handFocus=card?.closest('.play-match-card-wrap')||null;if(!handFocus)handFocusId=null;layoutHand();
  const wraps=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')];for(const w of wraps)w.style.transition='none';void root.offsetWidth;for(const w of wraps)w.style.removeProperty('transition');}
 // Scale the risen hand up a touch, but never past the screen edges.
 const handScale=()=>{const area=root.querySelector('.play-match-hand-area'),wraps=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')];if(!area||!wraps.length)return 1;const a=area.getBoundingClientRect(),cx=a.left+a.width/2,k=Number(root.style.getPropertyValue('--hand-scale'))||1,cur=root.dataset.handLift==='true'?k:1;
  const left=(cx-Math.min(...wraps.map(w=>w.getBoundingClientRect().left)))/cur,right=(Math.max(...wraps.map(w=>w.getBoundingClientRect().right))-cx)/cur;return Math.max(1,Math.min(1.1,(cx-6)/Math.max(left,1),(win.innerWidth-6-cx)/Math.max(right,1)));};
 const handRaise=()=>{const area=root.querySelector('.play-match-hand-area'),cards=[...root.querySelectorAll('.play-match-hand .play-match-card-wrap')];if(!area||!cards.length)return 0;
  const a=area.getBoundingClientRect(),bottom=Math.max(...cards.map(c=>c.getBoundingClientRect().bottom)),now=Number(root.style.getPropertyValue('--hand-raise').replace('px',''))||0;
  const below=[...root.querySelectorAll('.play-match-seat[data-seat=you],.play-command-zone.forge-crest[data-seat=you],.forge-zone-row[data-seat=you],.play-match-decisions[data-complex=false]')].map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.right>a.left&&r.left<a.right&&r.top>a.top+now);
  const limit=Math.min(win.innerHeight-6,...below.map(r=>r.top-6));return Math.max(0,Math.min(Math.round(win.innerHeight*.2),Math.round(bottom+(root.dataset.handLift==='true'?now:0)-limit)));};
 const setHandLift=on=>{clearTimeout(handLiftTimer);if(!presentation.hosted||root.dataset.stage!=='match')on=false;if(on===(root.dataset.handLift==='true'))return;
  if(on){const r=handRaise(),k=handScale();if(r<4&&k<1.02)return;root.style.setProperty('--hand-raise',`${r}px`);root.style.setProperty('--hand-scale',k.toFixed(3));root.dataset.handLift='true';layoutHand();}else{delete root.dataset.handLift;focusHand(null);}};
 // A preview opened from the hand keeps it up until the preview closes.
 const dropHandLift=(ms=260)=>{clearTimeout(handLiftTimer);handLiftTimer=setTimeout(()=>{if(!drag?.active&&!(peek.dataset.open==='true'&&peekFor?.closest?.('.play-match-hand')))setHandLift(false);},ms);};
 const handDown=e=>{if(e.pointerType==='mouse'||e.isPrimary===false)return;
  // A tap on the table (not a control, the preview or the hand slider) tucks the hand away.
  if(!e.target.closest?.('.play-match-hand-area')){if(root.dataset.handLift==='true'&&!e.target.closest?.('.forge-peek,.forge-hand-slider,button,summary,.play-match-decisions')){if(peekFor?.closest?.('.play-match-hand'))hidePeek();setHandLift(false);}return;}lastPointerType=e.pointerType;if(peekPinned&&peekFor?.closest?.('.play-match-hand'))hidePeek();handPointer=e.pointerId;handSifted=false;handDownAt={x:e.clientX,y:e.clientY};focusHand(handWrapAt(e.clientX));setHandLift(true);};
 // Once a card is carried up out of the hand, the hand settles so the whole board shows; bringing
 // it back down over the hand raises it again. The gap between the two lines keeps it from flickering.
 const handSift=e=>{if(drag?.active&&drag.pointerId===e.pointerId&&drag.source.closest?.('.play-match-hand')){const a=root.querySelector('.play-match-hand-area')?.getBoundingClientRect();if(!a)return;const lifted=root.dataset.handLift==='true';
   if(lifted&&e.clientY<a.top-36)setHandLift(false);else if(!lifted&&e.clientY>a.top+12)setHandLift(true);return;}
  if(e.pointerId!==handPointer||drag?.active)return;const w=handWrapAt(e.clientX);if(w===handFocus)return;handSifted=true;focusHand(w);if(pressShown&&peekPinned){const c=w?.querySelector('.play-match-card[data-instance]');if(c)showPeek(c,true);}};
 // A tap belongs to the card that rose under the thumb. The rise moves cards under the finger, so the
 // browser's own click would land on whatever slid there; it is swallowed and the focused card is clicked.
 const handUp=e=>{if(e.pointerType==='mouse'||e.pointerId!==handPointer)return;handPointer=null;const played=!!drag?.active;if(handSifted&&!played)suppressUntil=Math.max(suppressUntil,Date.now()+300);
  const tap=e.type!=='pointercancel'&&!played&&!handSifted&&!!handDownAt&&Math.hypot(e.clientX-handDownAt.x,e.clientY-handDownAt.y)<12&&handFocus?.querySelector('.play-match-card[data-instance]');handDownAt=null;
  if(tap){handTap=tap;win.setTimeout(()=>{if(handTap===tap){handTap=null;if(tap.isConnected)tap.click();}},0);}
  else if(played||!(pressShown||peek.dataset.open==='true'))focusHand(null);if(root.dataset.handLift==='true')dropHandLift(played?90:1600);};
 const swallowTapClick=e=>{if(!handTap||!e.isTrusted)return;e.preventDefault();e.stopImmediatePropagation();};
 const handHover=e=>{if(e.pointerType!=='mouse'||drag?.active)return;const area=root.querySelector('.play-match-hand-area');if(!area)return;const a=area.getBoundingClientRect(),lifted=root.dataset.handLift==='true';
  const f=handFocus?.getBoundingClientRect(),onFocus=!!f&&e.clientX>=f.left&&e.clientX<=f.right&&e.clientY>=f.top&&e.clientY<=f.bottom;
  const inside=root.contains(e.target)&&(onFocus||e.clientX>=a.left&&e.clientX<=a.right&&e.clientY>=a.top-(lifted?8:0));
  if(inside){clearTimeout(handLiftTimer);if(!lifted)handLiftTimer=setTimeout(()=>setHandLift(true),90);focusHand(handWrapAt(e.clientX));if(presentation.hosted&&!peekPinned){const c=handFocus?.querySelector('.play-match-card[data-instance]');if(c&&c!==peekFor){clearTimeout(peekTimer);peekTimer=setTimeout(()=>{if(c.isConnected&&handFocus?.contains(c)&&!drag?.active)showPeek(c);},peek.dataset.open==='true'?40:320);}}}else{if(presentation.hosted&&!peekPinned&&peekFor?.closest?.('.play-match-hand')){clearTimeout(peekTimer);hidePeek();}focusHand(null);if(lifted)dropHandLift(180);else clearTimeout(handLiftTimer);}};
  // A gesture cut short (the app goes to the background, the screen rotates or unfolds) lets go of everything.
 const dropGesture=()=>{if(handPointer===null&&!drag&&!pressAt)return;handPointer=null;handDownAt=null;clearTimeout(pressTimer);pressAt=null;pressShown=false;if(peekPinned)hidePeek();suppressUntil=Date.now()+350;cancel(!!drag?.active);focusHand(null);setHandLift(false);};
 const dropOnHide=()=>{if(doc.hidden)dropGesture();};
 doc.addEventListener('visibilitychange',dropOnHide);win.addEventListener('orientationchange',dropGesture);let gestureW=win.innerWidth;const dropOnFold=()=>{if(win.innerWidth===gestureW)return;gestureW=win.innerWidth;dropGesture();};win.addEventListener('resize',dropOnFold);
 doc.addEventListener('click',swallowTapClick,true);root.addEventListener('pointerdown',handDown,true);doc.addEventListener('pointerup',handUp,true);doc.addEventListener('pointercancel',handUp,true);doc.addEventListener('pointermove',handHover,{passive:true});doc.addEventListener('pointermove',handSift,{passive:true});root.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')dropHandLift(180);});
 root.addEventListener('click',click,true);root.addEventListener('pointerdown',down);doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',pressCancel);doc.addEventListener('keydown',key);win.addEventListener('blur',cancel);
 // Arena's rope: your decision clock runs quietly; after ROPE_IDLE with no touch or key, a gold fuse appears over
 // Next and burns down for ROPE_RUN (red, counting, in its last 10 s). When it runs out it only ever passes priority:
 // attacks and blocks are never committed for you. The clock holds while you read a card, drag one, or the app is
 // in the background, and any touch, click or key starts it over.
 const ROPE_IDLE=45000,ROPE_RUN=20000,rope=doc.createElement('div');rope.className='forge-rope';rope.hidden=true;rope.setAttribute('aria-hidden','true');rope.innerHTML='<i></i><b></b><s></s>';root.append(rope);
 let ropeKey='',ropeSince=Date.now();const ropeReset=()=>{ropeSince=Date.now();};
 // Arena's timeouts: a small bank of extensions. When the fuse runs out with one banked, it is spent and the
 // fuse starts over instead of passing. You start with one and earn another (up to three) for every eight
 // decisions made before the fuse appears.
 const ROPE_BANK_MAX=3,ROPE_EARN=8;let ropeBank=1,ropeQuick=0,ropeShown=false;
 const ropeLoop=presentation.hosted?win.setInterval(()=>{
  const s=session.snapshot(),n=s.native,ok=root.querySelector('.forge-native-panel [data-native-key=ok]');
  const timed=root.dataset.stage==='match'&&!s.busy&&!s.status?.terminal&&n?.inputType==='InputPassPriority'&&!n?.prompt&&!!ok&&!ok.disabled;
  if(doc.hidden||drag?.active||handFocus||peek.dataset.open==='true'||root.querySelector('.play-match-zones-menu[open]'))ropeReset();
  if(s.status?.terminal){ropeBank=1;ropeQuick=0;}
  const key=timed?`${n.revision}|${n.inputType}`:'';if(key!==ropeKey){if(ropeKey&&!ropeShown&&++ropeQuick>=ROPE_EARN){ropeQuick=0;ropeBank=Math.min(ROPE_BANK_MAX,ropeBank+1);}if(ropeShown)ropeQuick=0;ropeShown=false;ropeKey=key;ropeReset();}
  const left=timed?ROPE_IDLE+ROPE_RUN-(Date.now()-ropeSince):Infinity;
  if(!timed||left>ROPE_RUN){if(!rope.hidden){rope.hidden=true;delete rope.dataset.hot;}delete root.dataset.ropeOn;return;}
  if(left<=0&&ropeBank>0){ropeBank--;ropeSince=Date.now()-ROPE_IDLE;rope.dataset.spent='true';setTimeout(()=>delete rope.dataset.spent,1200);haptic('tap');return;}
  if(left<=0){rope.hidden=true;delete root.dataset.ropeOn;ropeReset();ok.click();return;}
  ropeShown=true;{const bank=rope.querySelector('s'),label=ropeBank?'⌛'.repeat(ropeBank):'';if(bank.textContent!==label){bank.textContent=label;bank.setAttribute('aria-label',`${ropeBank} timeouts left`);}}
  if(root.dataset.ropeOn!=='true')root.dataset.ropeOn='true';const r=ok.getBoundingClientRect(),secs=Math.ceil(left/1000);rope.hidden=false;rope.style.left=`${Math.round(r.left)}px`;rope.style.top=`${Math.round(r.top-10)}px`;rope.style.width=`${Math.round(r.width)}px`;
  rope.style.setProperty('--burn',(left/ROPE_RUN).toFixed(3));rope.dataset.hot=String(secs<=10);const b=rope.querySelector('b');if(secs<=10&&b.textContent!==String(secs)){b.textContent=String(secs);if(secs<=5)haptic('tick');}else if(secs>10)b.textContent='';
 },200):0;
 doc.addEventListener('pointerdown',ropeReset,true);doc.addEventListener('keydown',ropeReset,true);doc.addEventListener('visibilitychange',ropeReset);
 // The engine's last word is the result alone, with no final board, so the lethal blow is drawn here from the
 // last board shown: its attackers swing at what they were attacking (or their blocker) before the result lands.
 // Returns how long to hold the result back, letting any strike already in the air finish too.
 function finale(){
  if(closed)return 0;const sf=session.snapshot().status?.surface;let ms=Math.max(0,strikeEnd-Date.now());
  if(!sf||reducedMotion)return ms;
  const blockerOf=new Map();for(const c of sf.cards)for(const id of c.blockingIds||[])if(!blockerOf.has(id))blockerOf.set(id,c.id);
  let struck=0;for(const c of sf.cards.filter(c=>c.zone==='Battlefield'&&c.attacking).slice(0,8)){const el=cardEl(c.id);if(!el)continue;
   const seat=seatEl(defenderOf(sf.players,c)),blocked=blockerOf.has(c.id)?cardEl(blockerOf.get(c.id)):null,to=blocked||(c.attackTarget?.kind==='card'?cardEl(c.attackTarget.id):seat);if(!to)continue;
   ms=Math.max(ms,strike(el,to,{face:!blocked&&to===seat,delay:struck++*MOTION.stagger,big:(c.power||0)>=5,power:c.power||0}));}
  return struck?Math.max(ms,strikeEnd-Date.now())+250:ms;}
 return {finale,destroy(){closed=true;if(heldDrop){clearTimeout(heldDrop.timer);heldDrop.ghost.remove();heldDrop=null;}boardSizes?.disconnect();doc.removeEventListener('visibilitychange',dropOnHide);win.removeEventListener('orientationchange',dropGesture);win.removeEventListener('resize',dropOnFold);win.clearInterval(ropeLoop);rope.remove();doc.removeEventListener('pointerdown',ropeReset,true);doc.removeEventListener('keydown',ropeReset,true);doc.removeEventListener('visibilitychange',ropeReset);tableAudio.destroy();emotes?.destroy();clearTimeout(handLiftTimer);doc.removeEventListener('pointerup',handUp,true);doc.removeEventListener('click',swallowTapClick,true);doc.removeEventListener('pointermove',handSift);doc.removeEventListener('pointercancel',handUp,true);doc.removeEventListener('pointermove',handHover);clearTimeout(idleTimer);clearTimeout(noResponseTimer);delete root.dataset.lowPower;delete root.dataset.csStriking;playback.destroy();motion.destroy();activity.remove();root.removeEventListener('pointerdown',skipPlayback,true);doc.removeEventListener('pointerdown',closeZones,true);root.removeEventListener('click',trackerClick,true);root.removeEventListener('toggle',zonesToggled,true);doc.body.removeAttribute('data-forge-search');dockObserver?.disconnect();unsub();observer.disconnect();cancel();hidePeek();clearTimeout(pressTimer);if(arrowFrame)win.cancelAnimationFrame(arrowFrame);if(loopFrame)win.cancelAnimationFrame(loopFrame);win.removeEventListener('resize',queueArrows);if(railFrame)win.cancelAnimationFrame(railFrame);win.removeEventListener('resize',queueRails);peek.remove();ownCast.remove();doc.body.querySelector(':scope>.forge-ask-line')?.remove();doc.body.style.removeProperty('--forge-hand-top');castShow.remove();arrows.remove();fx.remove();root.removeEventListener('pointerover',over);root.removeEventListener('pointerout',out);root.removeEventListener('contextmenu',contextMenu,true);root.removeEventListener('keydown',peekKeys,true);win.removeEventListener('resize',reflow);root.removeEventListener('scroll',reflow,true);table.destroy();root.removeEventListener('input',saveInput);root.removeEventListener('change',saveInput);root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',down);doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',pressCancel);doc.removeEventListener('keydown',key);win.removeEventListener('blur',cancel);}};
}
