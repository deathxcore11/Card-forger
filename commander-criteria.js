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
 const replacement=[],otherPlayer=[],flow=[];
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
 if(!flow.length)return {recognized:true,effective:0,status:'unsupported',cantrip:false,paid:false,repeatable:false,activationMana:0,requirements:[replacement.length?'Draw replacement needs another draw event; it is not an independent draw source.':otherPlayer.length?'The recognized draw effect benefits another player, not you.':'Drawing is a trigger or condition here, not an independent draw effect.'],evidence:(replacement[0]||otherPlayer[0]||text).trim()};
 const effectText=flow.map(f=>f.effect).join('\n'),clauses=flow.map(f=>f.line).join('\n').split(/[.\n]/),paid=clauses.filter(s=>s.includes(':')&&/draw|investigate|into your hand/.test(s));
 const recurringLines=flow.filter(f=>! /\b(?:Instant|Sorcery)\b/.test(typeText(c))&&/\bwhenever\b|\bat the beginning\b/.test(f.line)&&! /\bnext\b/.test(f.line));
 const modeCost=s=>{const cycling=s.match(/^cycling ((?:\{[^}]+\})+)/);return cycling?manaCost(cycling[1]):manaCost(s.split(':')[0])+(/investigate/.test(s)?2:0);};
 const recurringPaid=paid.filter(s=>!/sacrifice (?:this|~)|discard this card/.test(s)),recurringCosts=[...recurringPaid.map(modeCost),...recurringLines.map(()=>0)],allCosts=[...paid.map(modeCost),...flow.filter(f=>!f.line.includes(':')).map(f=>/investigate/.test(f.effect)?2:0)];
 const activation=Math.min(...(recurringCosts.length?recurringCosts:allCosts.length?allCosts:[0]));
 const mandatory=text.match(/as an additional cost to cast this spell, sacrifice (?:a|an) (creature|artifact)[.,]/)?.[1];
 const fodder=mandatory&&rows.some(r=>r.c!==c&&(new RegExp(mandatory,'i').test(typeText(r.c))||mandatory==='creature'&&ownCreatureTokens(r.c)||mandatory==='artifact'&&/create[^.]*(?:artifact|treasure|clue|food)/.test(tx(r.c))));
 const recurring=!/\b(?:Instant|Sorcery)\b/.test(typeText(c))&&flow.some(f=>/\bwhenever\b|\bat the beginning\b/.test(f.line)&&!/\bnext\b/.test(f.line));
 const repeatable=recurring||recurringPaid.length>0,single=/draw (?:a|one|1) card\b/.test(effectText)&&!repeatable;
 const conditional=flow.some(f=>/\bwhenever\b|\bwhen\b|\bif\b|\bat the beginning\b|sacrifice|discard/.test(f.line))||paid.length>0;
 const requirements=[];
 if(activation)requirements.push(`${activation} mana for a draw activation${/investigate/.test(effectText)?' including the Clue activation':''}`);
 if(paid.some(s=>/\{t\}/.test(s)))requirements.push('Tap activation; the same permanent cannot also tap for mana');
 if(mandatory)requirements.push(`Sacrifice another ${mandatory}${fodder?' available in the list':' not identified in the list'}`);
 if(conditional)requirements.push('Printed trigger or additional cost must be satisfied');
 if(replacement.length)requirements.push('Separate draw-replacement text is not counted as another draw source');
 let effective=single?.5:1;
 if(activation>2)effective*=2/activation;
 if(mv>=5&&!repeatable)effective*=.75;
 if(conditional)effective*=.8;
 if(mandatory&&!fodder)effective=0;
 return {recognized:true,effective:round(effective),status:effective===0?'unsupported':conditional||activation?'conditional':'supported',cantrip:single,paid:activation>0,repeatable,activationMana:activation,requirements,evidence:flow[0].line.trim()};
}

export function commanderCriteria(deck,catalog,{roles=()=>[],synergy=null,structureScore=null}={}){
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
 const drawRows=spells.filter(r=>roles(r.c).includes('Draw')).map(r=>({...named(r),...commanderDrawProfile(r.c,known)}));
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
