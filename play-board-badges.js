// What a battlefield tile shows around the real card art, Arena style: a state corner
// (tapped, summoning sick, attached, commander), an activation corner, a combat marker, a
// keyword rail on the left, counters on the right, marked damage and an attachment tab.
// Everything comes from the accepted Forge snapshot. Icons are decoration: values stay
// live text, and only Forge decides what a card can do. Unknown data is left out.
import {boardIcon} from './play-board-icons.js';

// Display order for the keyword rail: what changes combat first.
export const KEYWORDS=Object.freeze([
 ['flying','Flying',/^flying$/],
 ['menace','Menace',/^menace$/],
 ['trample','Trample',/^trample(?: over planeswalkers)?$/],
 ['first-strike','First strike',/^first strike$/],
 ['double-strike','Double strike',/^double strike$/],
 ['deathtouch','Deathtouch',/^deathtouch$/],
 ['lifelink','Lifelink',/^lifelink$/],
 ['vigilance','Vigilance',/^vigilance$/],
 ['reach','Reach',/^reach$/],
 ['hexproof','Hexproof',/^hexproof(?: from .+)?$/],
 ['ward','Ward',/^ward\b.*$/],
 ['indestructible','Indestructible',/^indestructible$/],
 ['protection','Protection',/^protection(?: from .+)?$/],
 ['haste','Haste',/^haste$/],
 ['defender','Defender',/^defender$/],
]);
// Keywords without an icon that may share a keyword line ("Flash, flying").
const OTHER_KEYWORD=/^(?:flash|prowess|infect|wither|shroud|changeling|persist|undying|convoke|delve|exalted|flanking|horsemanship|fear|intimidate|shadow|skulk|devoid|partner|banding|phasing|cascade|extort|evolve|exploit|myriad|melee|mentor|riot|training|decayed|ravenous|bargain|enlist|living weapon|for mirrodin!|daybound|nightbound|landwalk|[a-z]+walk|split second|storm|rebound|soulbond|undaunted|improvise|ascend|afterlife \d+|(?:crew|equip|cycling|kicker|multikicker|annihilator|toxic|afflict|bushido|rampage|fading|vanishing|modular|dash|embalm|eternalize|unearth|flashback|escape|madness|morph|megamorph|disguise|ninjutsu|evoke|encore|blitz|prototype|mutate|bestow|reconfigure|squad|backup|affinity for|offspring|plot|craft with|graft|amplify|bloodthirst|dredge|fortify|reinforce|scavenge|outlast|renown|surge|emerge|awaken|aftermath|eminence|companion|boast|foretell|disturb|cleave|casualty|read ahead|more than meets the eye|transfigure|transmute|level up|suspend|channel|hideaway|impending|freerunning|saddle|gift|exhaust|harmonize|mobilize|station|warp)\b.*)$/;
const COUNTER_ICONS={P1P1:['counter-plus1-plus1','+1/+1'],M1M1:['counter-minus1-minus1','−1/−1'],SHIELD:['shield-counter','Shield'],STUN:['stun','Stun'],FINALITY:['finality-counter','Finality'],LORE:['saga','Lore'],LOYALTY:['loyalty','Loyalty'],DEFENSE:['defense','Defense']};
const COUNTER_ORDER=['P1P1','M1M1','SHIELD','STUN','FINALITY','LORE'];
const PLAYER_COUNTERS={POISON:['poison','Poison'],ENERGY:['energy','Energy'],EXPERIENCE:['experience','Experience']};
const title=s=>s.charAt(0).toUpperCase()+s.slice(1);

// Keywords the card has now. Forge's own list wins (bridges with the 4.2.7 adapter patch send
// [{keyword:'WARD', text:'Ward {2}'}], printed or granted; an empty list means none). Until a
// bridge sends one, only lines of the rules text made of keywords alone count ("Flying,
// vigilance"); a keyword word inside a sentence ("creatures you control have flying") never
// makes an icon.
export function currentKeywords(card){
 const out=[],seen=new Set(),add=(raw,name,source)=>{
  const text=String(raw||'').replace(/\.$/,'').replace(/:(?=\S)/,' ').replace(/\s+/g,' ').trim(),low=text.toLowerCase().replace(/[:—–]\s*/,' ');
  if(!text||text.length>120||seen.has(low))return;seen.add(low);
  const named=String(name||'').toLowerCase().replace(/_/g,'-'),kw=KEYWORDS.find(([key])=>key===named)||KEYWORDS.find(([,,re])=>re.test(low));
  out.push({key:kw?kw[0]:null,label:kw?kw[1]:title(text),text:kw&&!/^(?:ward|protection|hexproof from)/.test(low)?kw[1]:title(text),source});
 };
 if(Array.isArray(card?.keywords)){
  for(const k of card.keywords){if(typeof k==='string')add(k.replace(/([a-z])([A-Z])/g,'$1 $2'),'','native');else if(typeof k?.text==='string')add(k.text,k.keyword,'native');}
  return out;
 }
 for(const line of String(card?.text||'').split(/\r?\n/)){
  const clean=line.replace(/\([^)]*\)/g,'').trim().replace(/\.$/,'');if(!clean||clean.length>120)continue;
  const tokens=clean.split(/\s*[,;]\s*/).map(t=>t.trim()).filter(Boolean),low=tokens.map(t=>t.toLowerCase().replace(/[:—–]\s*/,' '));
  if(!tokens.length||!low.every(t=>KEYWORDS.some(([,,re])=>re.test(t))||OTHER_KEYWORD.test(t)))continue;
  for(const t of tokens)add(t,'','text');
 }
 return out;
}
// The crew requirement: Forge's own number when sent, else its current text ("Crew 3").
export const crewValue=card=>{if(Number.isSafeInteger(card?.crew))return card.crew;const k=currentKeywords(card).find(k=>/^crew \d+/i.test(k.text));return k?Number(k.text.match(/\d+/)[0]):null;};

export function counterList(counters){
 return Object.entries(counters||{}).filter(([name,count])=>typeof name==='string'&&name.length<=40&&Number.isSafeInteger(count)&&count>0)
  .map(([name,count])=>({name,count,icon:COUNTER_ICONS[name]?.[0]||null,label:COUNTER_ICONS[name]?.[1]||title(name.replace(/_/g,' ').toLowerCase())}))
  .sort((a,b)=>(COUNTER_ORDER.indexOf(a.name)+1||99)-(COUNTER_ORDER.indexOf(b.name)+1||99)||a.name.localeCompare(b.name));
}

// The tile's badge model. `actionable` is Forge's own offer for this card right now.
export function tileBadges(card,{actionable=false,cardsById=new Map()}={}){
 if(card?.known!==true||card.zone!=='Battlefield')return null;
 const types=card.types||[],creature=types.includes('Creature'),keywords=currentKeywords(card),rank=k=>KEYWORDS.findIndex(([key])=>key===k.key),iconic=[...new Map(keywords.filter(k=>k.key).map(k=>[k.key,k])).values()].sort((a,b)=>rank(a)-rank(b));
 const state=[];
 if(card.tapped===true)state.push({icon:'tapped',label:'Tapped'});
 if(creature&&card.summoningSick===true)state.push({icon:'summoning-sick',label:'Summoning sick'});
 if(Number.isSafeInteger(card.attachedTo))state.push({icon:'attached',label:'Attached to '+(cardsById.get(card.attachedTo)?.name||'a permanent')});
 if(card.commander===true)state.push({icon:'commander',label:'Commander'});
 // Three rail slots: all keywords when three or fewer, otherwise two and a "+N".
 const shown=iconic.length>3?iconic.slice(0,2):iconic,more=iconic.length-shown.length;
 const counters=counterList(card.counters),plaqueName=types.includes('Planeswalker')?'LOYALTY':types.includes('Battle')?'DEFENSE':null;
 const plaque=plaqueName&&!creature?{kind:plaqueName.toLowerCase(),icon:COUNTER_ICONS[plaqueName][0],value:card.counters?.[plaqueName]??null}:null;
 // The right rail has two slots under the name; marked damage takes one when present.
 const damage=Number.isSafeInteger(card.damage)&&card.damage>0?card.damage:0,slots=damage?1:2;
 const rail=counters.filter(c=>!plaque||c.name!==plaqueName),railShown=rail.length>slots?rail.slice(0,slots-1):rail;
 const attached=(card.attachments||[]).map(id=>cardsById.get(id)).filter(c=>c?.known);
 const kind=c=>/\bEquipment\b/.test(c.type||'')?'equipment':/\bAura\b/.test(c.type||'')?'aura':'attached';
 return {
  state:state.slice(0,2),stateAll:state,
  activation:actionable===true,
  combat:card.attacking===true?{icon:'attacking',label:'Attacking'}:card.blocking===true?{icon:'blocking',label:'Blocking'}:null,
  keywords:{shown,more,all:keywords},
  counters:{shown:railShown,more:rail.length-railShown.length,all:counters},
  plaque:plaque&&Number.isSafeInteger(plaque.value)?plaque:null,
  damage,
  crew:types.includes('Artifact')&&/\bVehicle\b/.test(card.type||'')?crewValue(card):null,
  attachments:attached.map(c=>({id:c.id,name:c.name,kind:kind(c)})),
  compact:!creature,
  flags:{flying:iconic.some(k=>k.key==='flying'),hexproof:iconic.some(k=>k.key==='hexproof'),indestructible:iconic.some(k=>k.key==='indestructible'),sick:creature&&card.summoningSick===true,damaged:Number.isSafeInteger(card.damage)&&card.damage>0},
 };
}

// One sentence for screen readers and the preview: everything the icons stand for.
export function badgeSummary(b){
 if(!b)return '';
 const parts=[];
 if(b.keywords.all.length)parts.push(b.keywords.all.map(k=>k.text).join(', '));
 for(const c of b.counters.all)parts.push(`${c.count} ${c.label} counter${c.count===1?'':'s'}`);
 if(b.damage)parts.push(`${b.damage} damage marked`);
 if(b.crew!==null)parts.push(`Crew ${b.crew}`);
 for(const s of b.stateAll)parts.push(s.label);
 if(b.combat)parts.push(b.combat.label);
 if(b.attachments.length)parts.push('With '+b.attachments.map(a=>a.name).join(', '));
 return parts.join(' · ');
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const badge=(icon,cls,text='')=>`<span class="cs-badge ${cls}">${boardIcon(icon)}${text?`<b>${esc(text)}</b>`:''}</span>`;
// The tile's decoration layer (aria-hidden; the card itself stays the only control).
export function tileLayerHtml(b){
 if(!b)return '';
 const html=[];
 // State corner first, then the activation corner beside it, as one top-left row.
 const rail=b.keywords.shown.map(k=>badge(k.key,'cs-kw-'+k.key)).join('')+(b.keywords.more?`<span class="cs-badge cs-more"><b>+${b.keywords.more}</b></span>`:'');
 if(b.state.length||b.activation||b.compact&&rail)html.push(`<span class="cs-corner">${b.state.map(s=>badge(s.icon,'cs-state-'+s.icon)).join('')}${b.activation?badge('activated-ability','cs-ready'):''}${b.compact?rail:''}</span>`);
 if(b.combat)html.push(`<span class="cs-combat">${badge(b.combat.icon,'cs-combat-'+b.combat.icon)}</span>`);
 if(!b.compact&&rail)html.push(`<span class="cs-keywords">${rail}</span>`);
 if(b.counters.shown.length||b.counters.more||b.damage)html.push(`<span class="cs-counters">${b.counters.shown.map(c=>c.icon?badge(c.icon,'cs-counter-'+c.name.toLowerCase(),String(c.count)):`<span class="cs-badge cs-counter-generic"><b>${esc(c.count)} ${esc(c.label.slice(0,4))}</b></span>`).join('')}${b.counters.more?`<span class="cs-badge cs-more"><b>+${b.counters.more}</b></span>`:''}${b.damage?badge('marked-damage','cs-damage',String(b.damage)):''}</span>`);
 if(b.plaque)html.push(`<span class="cs-plaque cs-plaque-${b.plaque.kind}">${boardIcon(b.plaque.icon)}<b>${esc(b.plaque.value)}</b></span>`);
 if(b.crew!==null)html.push(`<span class="cs-crew">${boardIcon('vehicle-crew')}<b>${esc(b.crew)}</b></span>`);
 if(b.damage)html.push('<span class="cs-damage-marks"></span>');
 if(b.attachments.length){const kinds=['equipment','aura','attached'].map(k=>[k,b.attachments.filter(a=>a.kind===k).length]).filter(([,n])=>n);html.push(`<span class="cs-attachments">${kinds.map(([k,n])=>badge(k,'cs-attach-'+k,n>1?String(n):'')).join('')}</span>`);}
 return html.join('');
}

// Player counters on a seat: poison, energy and experience, with live counts.
export function playerCounterBadges(counters){
 return Object.entries(PLAYER_COUNTERS).map(([name,[icon,label]])=>({name,icon,label,count:counters?.[name]})).filter(c=>Number.isSafeInteger(c.count)&&c.count>0);
}
export const playerCountersHtml=list=>list.map(c=>`<span class="cs-badge cs-player-${c.name.toLowerCase()}" title="${esc(c.label)}">${boardIcon(c.icon)}<b>${esc(c.count)}</b></span>`).join('');
