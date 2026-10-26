// Bounded Commander evidence model. These checks explain resource opportunity costs
// and recognized connections; they do not simulate all rules or estimate win rates.
import {cardKey, rulesText, typeText, isLand, aggregateCards, inCommandZone} from './core.js';
import {commanderTheme, tribeEvidence, creatureTypes} from './planner.js';
import {mtgResourceProfile,mtgEffectProfile} from './mtg-effects.js';

const tx=c=>rulesText(c).toLowerCase(), qty=rows=>rows.reduce((n,r)=>n+r.qty,0), round=x=>Math.round(x*10)/10;
const named=r=>({name:r.c.name,qty:r.qty});
const manaCost=s=>(String(s).match(/\{[^}]+\}/g)||[]).reduce((n,m)=>n+(/^\{\d+\}$/.test(m)?Number(m.slice(1,-1)):/\{[XYZTQE]\}/i.test(m)?0:1),0);
const isCreature=c=>/\bCreature\b/.test(typeText(c));
const ownCreatureTokens=c=>mtgEffectProfile(c).provides.some(e=>e.tag==='creature_token'&&e.controller==='self');

// Provider evidence for a bounded family of entry/cast draw triggers. Printed
// type, power and mana value can establish a possible provider, not its access,
// deployment, actual battlefield characteristics or number of future triggers.
function drawTriggerProviders(c,line,rows){
 const header=line.match(/(?:^|—\s*)(?:whenever|when)\s+([^,]+),/i)?.[1]?.trim();
 if(!header)return null;
 const cast=header.match(/^you cast (.+)$/),entry=header.match(/^(.+?) enters?(?: the battlefield)?(?: under (.+) control)?$/);
 if(!cast&&!entry)return null;
 let descriptor=(cast?.[1]||entry[1]).trim();
 // A self-ETB is independent of having other cards in the deck. Do not turn it
 // into a missing-provider failure merely because no external provider exists.
 if(!cast&&(/^(?:this (?:creature|artifact|enchantment|permanent)|it)\b/.test(descriptor)||descriptor===tx({oracle_text:c.name}).split(',')[0]))return null;
 const event=cast?'cast':'enter',owned=!!cast||/\byou control\b/.test(descriptor)||entry?.[2]==='your',opponentOnly=!!entry?.[2]&&entry[2]!=='your'||/opponents? controls?/.test(descriptor),other=/\b(?:another|other)\b/.test(descriptor),nontoken=/\bnontoken\b/.test(descriptor);
 const constraints=[];
 descriptor=descriptor.replace(/\b(?:with|and) (power|mana value) (\d+)(?: (or less|or greater))?/g,(_,field,n,op)=>{constraints.push({field:field==='power'?'power':'cmc',value:Number(n),op:op==='or less'?'max':op==='or greater'?'min':'equal'});return '';});
 const noncreature=/\bnoncreature\b/.test(descriptor),nonland=/\bnonland\b/.test(descriptor),nonartifact=/\bnonartifact\b/.test(descriptor),nonlegendary=/\bnonlegendary\b/.test(descriptor);
 descriptor=descriptor.replace(/\byou control\b|\b(?:one or more|another|other|an?|nontoken|noncreature|nonland|nonartifact|nonlegendary|spells?)\b/g,' ').replace(/\s+/g,' ').trim();
 const singular=s=>({creatures:'creature',artifacts:'artifact',enchantments:'enchantment',lands:'land',permanents:'permanent',planeswalkers:'planeswalker',instants:'instant',sorceries:'sorcery',elves:'elf',dwarves:'dwarf',wolves:'wolf',allies:'ally',mice:'mouse'}[s]||s.replace(/s$/,''));
 const groups=descriptor.split(/\s+or\s+/).map(s=>s.split(/\s+/).filter(Boolean).map(singular)),badWords=/\b(?:with|without|from|that|whose|its|your|first|second|different|less|greater|equal|number|total|if|modified|equipped|enchanted|tapped|untapped|attacking|blocking|historic|multicolored|colorless)\b/,
   parsed=!badWords.test(descriptor)&&groups.every(g=>g.length<=3)&&(!constraints.length||constraints.every(x=>Number.isFinite(x.value)));
 const label=[descriptor||'spell',...constraints.map(x=>`${x.field==='cmc'?'mana value':'power'} ${x.value}${x.op==='max'?' or less':x.op==='min'?' or greater':''}`)].join(' ').trim(),providers=[],uncertain=[],limitations=['Provider presence is not access or trigger frequency; sequencing, counters, continuous effects and once-per-turn limits are not simulated.'];
 const match=(candidate)=>{
  const typ=String(candidate.type||'').toLowerCase();
  if(!typ)return null;
  if(noncreature&&/\bcreature\b/.test(typ)||nonland&&/\bland\b/.test(typ)||nonartifact&&/\bartifact\b/.test(typ)||nonlegendary&&/\blegendary\b/.test(typ)||event==='cast'&&/\bland\b/.test(typ))return false;
  const fits=groups.some(g=>g.every(t=>t==='permanent'?!/\b(?:instant|sorcery)\b/.test(typ):new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(typ)));
  if(!fits)return false;
  let unknown=false;
  for(const need of constraints){const value=candidate[need.field];if(value==null||!Number.isFinite(Number(value))){unknown=true;continue;}const n=Number(value);if(need.op==='max'?n>need.value:need.op==='min'?n<need.value:n!==need.value)return false;}
  return unknown?null:true;
 };
 const sourceKey=cardKey(c.name),sourceId=c.oracle_id||null;let sourceToExclude=1;
 for(const r of rows){
  if(!(r.qty>0))continue;
  if(!r.c){uncertain.push({name:r.name||'Unloaded card',qty:r.qty,kind:'unloaded',reason:'Provider details unavailable.'});continue;}
  const same=cardKey(r.c.name)===sourceKey||sourceId&&r.c.oracle_id===sourceId,subtract=same?Math.min(sourceToExclude,r.qty):0;
  if(same)sourceToExclude-=subtract;
  // A battlefield trigger cannot be its own cast provider. For entry triggers
  // reserve the physical source too; its permitted self-ETB is handled below.
  const copies=r.qty-subtract,front=r.c.card_faces?.[0]||r.c,candidate={type:front.type_line||typeText(r.c).split(' // ')[0],power:front.power??r.c.power,cmc:front.cmc??r.c.cmc},fit=match(candidate);
  if(copies>0&&fit!==false){const row={name:r.c.name,qty:copies,kind:'card',type:candidate.type,power:candidate.power??null,manaValue:candidate.cmc??null};(fit===true?providers:uncertain).push(row);}
  if(copies>0&&fit===false&&r.c.card_faces?.length>1)uncertain.push({name:r.c.name,qty:copies,kind:'alternate-face',reason:'Alternate-face access and characteristics are not established.'});
  if(event==='cast'||nontoken)continue;
  const tokenEffects=mtgEffectProfile(r.c).provides.filter(e=>e.controller==='self'&&['token','creature_token','noncreature_token'].includes(e.tag)),seen=new Set();
  for(const e of tokenEffects){
   if(seen.has(e.evidence))continue;seen.add(e.evidence);
   const token=String(e.evidence).toLowerCase(),made=token.match(/\bcreate(?:s)?\b[^.]*?\b([^.]*) tokens?\b/)?.[0]||'';
   if(!made)continue;
   const copied=/\b(?:copy|copies)\b/.test(token),stats=made.match(/\b(\d+)\/(\d+)\b/),tokenType=made.replace(/^.*?\bcreates?\b/,'').split(/\btoken/)[0]+(mtgEffectProfile(r.c).provides.some(p=>p.tag==='artifact'&&p.evidence===e.evidence)?' artifact':''),tokenFit=copied?null:match({type:tokenType,power:stats?Number(stats[1]):null,cmc:0});
   if(tokenFit===false)continue;
   const row={name:r.c.name,qty:r.qty,kind:'token-provider',evidence:e.evidence,power:stats?Number(stats[1]):null,manaValue:copied?null:0,requirements:e.requirements||[]};
   // A token-copy effect has unknown characteristics. A trigger cannot bootstrap
   // itself just by promising tokens after the same triggering event occurs.
   const unverifiedSetup=e.status==='unsupported'||(e.requirements||[]).some(s=>/requires (?:x|counters|charge counters|an eligible object|the object to sacrifice|the card to discard)|requires access to|requires reaching|^(?:if|whenever|at the beginning)\b/i.test(s))||/\b(?:if|whenever|at the beginning)\b|tap (?:one|two|three|\d+) untapped/.test(token);
   (tokenFit===null||unverifiedSetup||e.evidence.toLowerCase()===line.toLowerCase()?uncertain:providers).push(row);
  }
 }
 const sourceFit=event==='enter'&&!other&&match({type:typeText(c).split(' // ')[0],power:c.power,cmc:c.cmc})===true;
 let status=opponentOnly?'unverified':providers.length&&parsed?'conditional':!parsed||!rows.length||uncertain.length||!owned?'unverified':sourceFit?'one-shot':'unsupported';
 const description=label[0]?.toUpperCase()+label.slice(1),requirements=[status==='unsupported'?`Triggered draw has no identified ${description} provider in this list.`:status==='unverified'?`Triggered draw provider is unverified for ${description}; unknown mechanics are not a full repeatable draw engine.`:status==='one-shot'?`Only this source's own entry is identified for ${description}; no separate recurring provider is established.`:`Triggered draw has identified ${description} providers; resolve them after the draw source. Multiple modes on one card are not extra physical copies.`,...limitations];
 if(other)requirements.push('Another physical object must cause the trigger; one copy cannot count as both source and provider.');
 return {event,description,status,other,nontoken,constraints,providers,unverifiedProviders:uncertain,requirements,limitations};
}

// A cantrip, a six-mana investigate activation and a recurring draw engine are
// different resources. Effective units below are disclosed heuristics, not copies
// or measured probabilities. Opponent/trigger/replacement mentions are not own flow.
export function commanderDrawProfile(c,rows=[]){
 const text=tx(c).replace(/\([^)]*\)/g,m=>/cycling/.test(tx(c))?m:''),mv=Number(c?.cmc)||0;
 const drawRx=/\bdraws? (?:a|an|one|two|three|four|five|seven|x|that many|\d+) (?:additional )?cards?|\bdraw cards? equal to|\binvestigate\b|look at the top[^.]*into your hand|exile the top[^.]*(?:you may|until)[^.]*(?:play|cast)/;
 if(!drawRx.test(text))return {recognized:false,effective:null,status:'unsupported',requirements:[]};
 // Read the effect, not a draw event in its trigger or a replacement instruction.
 // An opponent drawing and a draw-replacement modifier are not independent card
 // flow for you. Preserve independent abilities elsewhere on the same card.
 const replacement=[],otherPlayer=[],flow=[],unmetFlow=[],providerEvidence=[];
 for(const line of text.split('\n')){
  if(!drawRx.test(line))continue;
  if(/\bwould draw\b|\binstead of drawing\b/.test(line)){replacement.push(line);continue;}
  const effect=line.replace(/^\s*(?:whenever|when|at the beginning)[^,]*,\s*/,'');
  const clauses=effect.split(/[.]/).filter(clause=>drawRx.test(clause));
  const own=clauses.filter(clause=>{
   // This exclusion is scoped to the draw's recipient. Merely mentioning an
   // opponent elsewhere (Consecrated Sphinx, Secret Rendezvous) is not enough.
   const excluded=/(?:\b(?:each|target|an?|that|the|your) opponents?(?: of your choice)?|\b(?:its|their|that creature's) controller)(?: each)?(?: may)? (?:draws?|investigates?)\b/.test(clause)&&!/\byou(?: and [^,.]+)?(?: each)?(?: may)? draw/.test(clause);
   if(excluded)otherPlayer.push(clause);
   return !excluded;
  });
  if(own.length)flow.push({line,effect:own.join('. ')});
 }
 for(let i=flow.length-1;i>=0;i--){const provider=drawTriggerProviders(c,flow[i].line,rows);if(!provider)continue;providerEvidence.unshift({evidence:flow[i].line,...provider});flow[i].provider=provider;if(provider.status==='unsupported'){unmetFlow.push(...provider.requirements);flow.splice(i,1);}}
 if(!flow.length)return {recognized:true,effective:0,status:'unsupported',cantrip:false,paid:false,repeatable:false,activationMana:0,providerEvidence,requirements:unmetFlow.length?unmetFlow:[replacement.length?'Draw replacement needs another draw event; it is not an independent draw source.':otherPlayer.length?'The recognized draw effect benefits another player, not you.':'Drawing is a trigger or condition here, not an independent draw effect.'],evidence:(replacement[0]||otherPlayer[0]||text).trim()};
 const effectText=flow.map(f=>f.effect).join('\n'),clauses=flow.map(f=>f.line).join('\n').split(/[.\n]/),paid=clauses.filter(s=>s.includes(':')&&/draw|investigate|into your hand/.test(s));
 const recurringLines=flow.filter(f=>! /\b(?:Instant|Sorcery)\b/.test(typeText(c))&&/\bwhenever\b|\bat the beginning\b/.test(f.line)&&! /\bnext\b/.test(f.line)&&(!f.provider||f.provider.status==='conditional'));
 const modeCost=s=>{const cycling=s.match(/^cycling ((?:\{[^}]+\})+)/);return cycling?manaCost(cycling[1]):manaCost(s.split(':')[0])+(/investigate/.test(s)?2:0);};
 const recurringPaid=paid.filter(s=>!/sacrifice (?:this|~)|discard this card/.test(s)),recurringCosts=[...recurringPaid.map(modeCost),...recurringLines.map(()=>0)],allCosts=[...paid.map(modeCost),...flow.filter(f=>!f.line.includes(':')).map(f=>/investigate/.test(f.effect)?2:0)];
 const activation=Math.min(...(recurringCosts.length?recurringCosts:allCosts.length?allCosts:[0]));
 const mandatory=text.match(/as an additional cost to cast this spell, sacrifice (?:a|an) (creature|artifact)[.,]/)?.[1];
 const fodder=mandatory&&rows.some(r=>r.c!==c&&(new RegExp(mandatory,'i').test(typeText(r.c))||mandatory==='creature'&&ownCreatureTokens(r.c)||mandatory==='artifact'&&/create[^.]*(?:artifact|treasure|clue|food)/.test(tx(r.c))));
 const recurring=recurringLines.length>0;
 const repeatable=recurring||recurringPaid.length>0,single=/draw (?:a|one|1) card\b/.test(effectText)&&!repeatable;
 const conditional=flow.some(f=>/\bwhenever\b|\bwhen\b|\bif\b|\bat the beginning\b|sacrifice|discard/.test(f.line))||paid.length>0;
 const requirements=[...new Set([...unmetFlow,...providerEvidence.filter(p=>p.status!=='unsupported').flatMap(p=>p.requirements)])];
 if(activation)requirements.push(`${activation} mana for a draw activation${/investigate/.test(effectText)?' including the Clue activation':''}`);
 if(paid.some(s=>/\{t\}/.test(s)))requirements.push('Tap activation; the same permanent cannot also tap for mana');
 if(mandatory)requirements.push(`Sacrifice another ${mandatory}${fodder?' available in the list':' not identified in the list'}`);
 if(conditional)requirements.push('Printed trigger or additional cost must be satisfied');
 if(replacement.length)requirements.push('Separate draw-replacement text is not counted as another draw source');
 const unverifiedOnly=flow.every(f=>f.provider?.status==='unverified');
 let effective=single?.5:1;
 if(activation>2)effective*=2/activation;
 if(mv>=5&&!repeatable)effective*=.75;
 if(conditional)effective*=.8;
 if(unverifiedOnly)effective*=.5;
 if(mandatory&&!fodder)effective=0;
 return {recognized:true,effective:round(effective),status:effective===0?'unsupported':conditional||activation?'conditional':'supported',cantrip:single&&!unverifiedOnly,paid:activation>0,repeatable,activationMana:activation,providerEvidence,requirements,evidence:flow[0].line.trim()};
}

export function commanderCriteria(deck,catalog,{roles=()=>[],synergy=null,structureScore=null,commanderAvailable=true}={}){
 const rows=aggregateCards(deck.cards||[]).map(r=>({...r,c:catalog[cardKey(r.name)]})),known=rows.filter(r=>r.c),total=qty(rows),unknown=qty(rows.filter(r=>!r.c));
 const commander=catalog[cardKey(deck.commander)],library=known.filter(r=>!inCommandZone(deck,r.c.name)),spells=library.filter(r=>!isLand(r.c));
 const theme=commander?commanderTheme(commander):{roles:[],tribes:[],tribe:null},primary=spells.filter(r=>synergy?.test(r.c)),secondary=spells.filter(r=>!synergy?.test(r.c)&&synergy?.supportTest?.(r.c));
 const detail=r=>({...named(r),evidence:synergy?.classify?.(r.c)||typeText(r.c)});
 const resourceRows=spells.map(r=>({...r,resource:mtgResourceProfile(r.c)}));
 const ramp=resourceRows.filter(r=>r.resource.acceleration),fixing=resourceRows.filter(r=>r.resource.fixing&&!r.resource.acceleration);
 const resourceEvidence=r=>{const p=r.resource,effects=p.effects.filter(e=>e.acceleration);const output=Math.max(1,...effects.map(e=>Number(e.netMana)||0));const activation=effects.length?Math.min(...effects.map(e=>Number(e.activationMana)||0)):0;const setup=(p.castManaValue||0)+activation+(effects.length?Math.min(...effects.map(e=>Number(e.equipMana)||0)):0);
   // Late one-mana rocks and conditional catch-up do not all equal early Sol Ring.
   // Extra production offsets cost; this is NOT a universal MV tier or ramp cap.
   const timing=Math.min(1,(2+output)/Math.max(1,setup));const conditional=p.status==='conditional';
   return {...named(r),effective:round(timing*(conditional?.7:1)*r.qty),status:p.status,castManaValue:p.castManaValue,requirements:[...new Set(effects.flatMap(e=>e.requirements||[]))],effects};};
 const rampEvidence=ramp.map(resourceEvidence),effectiveRamp=round(rampEvidence.reduce((n,r)=>n+r.effective,0));
 // Counterfactuals keep declared commander identity, but an unavailable
 // command-zone card cannot satisfy a draw engine's provider prerequisite.
 const drawProviderContext=commanderAvailable?known:known.filter(r=>!inCommandZone(deck,r.c.name));
 const drawRows=spells.filter(r=>roles(r.c).includes('Draw')).map(r=>({...named(r),...commanderDrawProfile(r.c,drawProviderContext)}));
 const effectiveDraw=round(drawRows.reduce((n,r)=>n+(r.effective??.5)*r.qty,0));
 const commanderText=tx(commander), manaEngine=/tap a nonland permanent for mana|whenever you tap[^.]*for mana|mana abilities|mana produced/.test(commanderText);
 const artifactEngine=known.some(r=>/artifacts? you control|affinity for artifacts|improvise|metalcraft|whenever (?:an|another) artifact/.test(tx(r.c)));
 const manaSinks=known.filter(r=>/\{x\}/i.test(r.c.mana_cost||r.c.card_faces?.[0]?.mana_cost||'')||tx(r.c).split(/[.\n]/).some(s=>s.includes(':')&&manaCost(s.split(':')[0])>=4&&!/add (?:\{|one mana)/.test(s.split(':')[1]))).map(named);
 const largePayoffs=spells.filter(r=>Number(r.c.cmc)>=5&&!roles(r.c).every(x=>['Ramp','Draw'].includes(x))&&(isCreature(r.c)||/create|you win|each opponent loses|deals?[^.]*each opponent/.test(tx(r.c)))).map(named);
 const supportKeys=new Set([...primary,...secondary].map(r=>cardKey(r.name))),onPlanRamp=qty(ramp.filter(r=>supportKeys.has(cardKey(r.name))||manaEngine||artifactEngine&&/Artifact/.test(typeText(r.c))));
 const offPlanRamp=Math.max(0,qty(ramp)-onPlanRamp),nonResourceSupport=qty([...primary,...secondary].filter(r=>!mtgResourceProfile(r.c).acceleration));
 const demand=Math.max(2,Math.ceil((qty(spells)?spells.reduce((n,r)=>n+(Number(r.c.cmc)||0)*r.qty,0)/qty(spells):0)*2)+(Number(commander?.cmc)>=5?2:0));
 const unsupportedRamp=Math.max(0,qty(spells.filter(r=>roles(r.c).includes('Ramp')))-qty(ramp)),resourceWarnings=[];
 if(unsupportedRamp)resourceWarnings.push(`${unsupportedRamp} ramp-tagged copies have no quantified acceleration effect in this model; their effective contribution is unverified.`);
 if(fixing.length)resourceWarnings.push(`${qty(fixing)} mana-filtering/fixing copies do not produce net acceleration.`);
 if(offPlanRamp>Math.max(demand,nonResourceSupport+qty(largePayoffs)))resourceWarnings.push(`${offPlanRamp} acceleration copies sit outside recognized plan support, against ${nonResourceSupport} non-resource support copies${manaSinks.length?` and ${manaSinks.length} conditional mana outlet(s)`:''}. Verify useful payoffs and board requirements before adding more resources; no universal ramp limit is assumed.`);
 if(drawRows.some(r=>r.paid))resourceWarnings.push('Paid draw requires spare mana; tapping a multi-role permanent cannot pay for both mana and draw in the same use.');
 const planWarnings=[],routes=[];
 const setup=(rulesText(commander).split(/[.\n]/).filter(s=>s.includes(':')||/activate only|transformed|after your draw step/i.test(s))).map(s=>s.trim());
 const resilience=spells.filter(r=>roles(r.c).includes('Protection')||/return[^.]*from your graveyard|from your graveyard to (?:your hand|the battlefield)/.test(tx(r.c))).map(named);
 const members=theme.tribe?spells.filter(r=>isCreature(r.c)&&(creatureTypes(r.c).includes(theme.tribe)||/changeling|is every creature type/.test(tx(r.c)))):[];
 const tokenMakers=spells.filter(r=>ownCreatureTokens(r.c)),converters=spells.filter(r=>/creatures you control are every creature type/.test(tx(r.c)));
 if(theme.tribe&&primary.length){const producers=primary.filter(r=>tribeEvidence(r.c,theme.tribe).some(e=>e.kind==='token'));const bodies=qty(members)+qty(producers);routes.push({kind:'tribal',label:`${theme.tribe} combat support`,status:bodies||converters.length?'conditional':'unsupported',evidence:theme.evidence?.find(x=>x.tribe===theme.tribe)?.evidence?.map(e=>e.text)||[],cards:primary.map(named),requirements:['Deploy supporting creatures and the commander; combat is not a guaranteed win.',...(converters.length?['Type-changing support must be present before off-type creatures count.']:[])]});}
 if(theme.roles.includes('Tokens')&&(tokenMakers.length||secondary.length)){routes.push({kind:'tokens',label:'Creature-token board support',status:tokenMakers.length?'conditional':'partial',evidence:['Only creature tokens controlled by you satisfy creature-token payoffs.'],cards:tokenMakers.map(named),requirements:['Create and keep a board; token creation and payoffs have separate costs.']});}
 if(theme.roles.includes('Counters')&&secondary.some(r=>/counter|proliferate/.test(tx(r.c))))routes.push({kind:'counters',label:'Counters / transformation support',status:'conditional',evidence:['Counter-related text matches a commander payoff; Saga timing and activation requirements remain separate.'],cards:secondary.filter(r=>/counter|proliferate/.test(tx(r.c))).map(named),requirements:['Reach the relevant commander face, pay its printed activation and have creatures/counters to benefit.']});
 if(manaEngine&&ramp.length)routes.push({kind:'mana-engine',label:'Nonland mana engine',status:'conditional',evidence:['Commander rewards nonland mana production; extra acceleration can itself be plan support.'],cards:ramp.map(named),requirements:['Resolve commander and appropriate mana permanents.',...(manaSinks.length?['Resolve an outlet or payoff; resource production alone is not a win.']:['A mana outlet or closing route still needs verification.'])]});
 if(!routes.length&&primary.length)routes.push({kind:'theme',label:synergy.label,status:'conditional',evidence:['Recognized commander-related effects, not a verified winning sequence.'],cards:primary.map(named),requirements:['Validate card-specific prerequisites and closing route.']});
 const supportedCopies=qty(primary)+qty(secondary),eligibleCopies=qty(spells),unknownMechanics=!commander||!synergy||!routes.length;
 let status=unknown?'unknown':unknownMechanics?(supportedCopies?'partial':'unknown'):supportedCopies&&routes.some(r=>r.status==='conditional'||r.status==='supported')?'supported':'partial';
 if(!supportedCopies&&synergy&&commander){status=unknown?'unknown':'unsupported';planWarnings.push(`No recognized library support for ${synergy.label}; generic role counts do not establish the plan.`);}
 if(!commander)planWarnings.push('Commander details are missing; no plan verdict is available.');
 if(theme.tribe&&!members.length&&secondary.length)planWarnings.push(`No direct ${theme.tribe} creatures identified. Separate token/counter support can still be intentional; no tribal minimum is assumed.`);
 if(!routes.length)planWarnings.push('The supported model has not established a plan route. Unknown mechanics are not a perfect score or proof the deck is bad.');
 const coverage={known:total-unknown,total,ratio:total?(total-unknown)/total:0,status:unknown||!commander?'incomplete':unknownMechanics?'limited':'partial',limitations:['Card-text links are not a full rules simulation; opponent interaction, sequencing and multiplayer politics are not modeled.',...(unknown?[`${unknown} card copies have no loaded details.`]:[]),...(!synergy&&commander?['This commander’s plan is not mapped by the current criteria.']:[])]};
 return {version:'commander-context-v1',goal:deck.goal||'strongest',requestedStyle:deck.requestedStyle||'',scoreMeaning:'Structural build heuristic, not plan quality or win rate',structure:{score:structureScore,label:'Resource and role checks'},plan:{status,label:status==='supported'?'Recognized support; execution conditional':status==='unknown'?'Plan not established':status==='unsupported'?'Plan support missing':'Plan partly mapped',setup,resilience:{status:resilience.length?'conditional':'unmapped',cards:resilience,limitation:'Protection/recursion text is not a simulation of recovery after removal or a board wipe.'},closing:{status:'unverified',limitation:'Recognized synergies and combat bodies do not establish a winning sequence against opponents.'},primaryLabel:synergy?.label||null,primarySupport:primary.map(detail),secondarySupport:secondary.map(detail),routes,warnings:planWarnings,supportedCopies,eligibleCopies,supportShare:eligibleCopies?supportedCopies/eligibleCopies:null},resources:{unsupportedRamp,rawRamp:qty(spells.filter(r=>roles(r.c).includes('Ramp'))),effectiveRamp,fixing:qty(fixing),conditionalRamp:qty(ramp.filter(r=>r.resource.status==='conditional')),efficientRamp:qty(ramp.filter(r=>r.resource.castManaValue<=3)),expensiveRamp:qty(ramp.filter(r=>r.resource.castManaValue>3)),evidence:rampEvidence,draw:{raw:qty(spells.filter(r=>roles(r.c).includes('Draw'))),effective:effectiveDraw,cantrips:qty(drawRows.filter(r=>r.cantrip)),paid:qty(drawRows.filter(r=>r.paid)),conditional:qty(drawRows.filter(r=>r.status==='conditional')),evidence:drawRows},manaSinks,largePayoffs,onPlanRamp,nonResourceSupport,demand,warnings:resourceWarnings},coverage};
}
