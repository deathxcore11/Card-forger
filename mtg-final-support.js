// Exact-list structural support, not a game simulator, strength score or win rate.
// This module reads supplied evidence only. It neither repairs nor mutates a deck.
import {cardKey, rulesText, typeText, isLand, roles, inCommandZone} from './core.js';
import {formatOf} from './formats.js';
import {commanderCriteria, commanderDrawProfile} from './commander-criteria.js';
import {mtgStrategicEstimate, combatContribution} from './commander-strategy.js';
import {nonClosingCardCoverage} from './mtg-route-coverage.js';
import {inspectPrimaryInputs} from './mtg-primary-inputs.js';
import {inspectAbilityEndpoints} from './mtg-ability-endpoints.js';
import {inspectManaLoop} from './mtg-combo-packages.js';
import {mtgManaSourceProfile} from './mtg-mana-sources.js';
import {mtgResourceProfile, manaCostValue} from './mtg-effects.js';

export const FINAL_SUPPORT_VERSION='mtg-final-support-v1';
const unique=xs=>[...new Set(xs)];
const front=c=>c?.card_faces?.[0]||c||{};
const text=c=>String(front(c).oracle_text??c?.oracle_text??'');
const cost=c=>front(c).mana_cost??c?.mana_cost;
const name=r=>r.name||r.card?.name||r.c?.name||'';
const sum=rs=>rs.reduce((n,r)=>n+Number(r.qty||0),0);
const starting=r=>!r.zone||['main','commander','command'].includes(r.zone);
const fields=['name','oracle_id','type_line','oracle_text','mana_cost','cmc','power','toughness','colors','color_identity','produced_mana','keywords','layout','legalities','card_faces'];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined&&typeof v[k]!=='function').map(k=>[k,stable(v[k])])):v;
const cardEvidence=c=>c?Object.fromEntries(fields.filter(k=>c[k]!==undefined).map(k=>[k,stable(c[k])])):null;
const rowEvidence=r=>({name:cardKey(name(r)),qty:r.qty,zone:r.zone||'main',card:cardEvidence(r.card||r.c)});
const requestEvidence=(request,deck)=>({game:request.game||'mtg',format:request.format||deck.format,seed:request.seed,seedOrigin:request.seedOrigin,buildAround:deck.buildAround,commander:deck.commander||request.commander,commanders:deck.commanders||request.commanders,theme:request.theme,style:request.style,goal:request.goal,requiredAnchorNames:request.requiredAnchorNames,required_cards:request.required_cards,excluded_cards:request.excluded_cards,requireLoop:request.requireLoop,loopOutput:request.loopOutput,loopConflict:request.loopConflict,unsupportedLoop:request.unsupportedLoop,avoid_infinite:request.avoid_infinite,matchMode:request.matchMode||'unspecified',primaryInputRequired:request.primaryInputRequired});

// A transparent content signature rather than a score/cache identity. Cosmetic
// art/prices do not establish support; actual rules changes always invalidate it.
export function finalSupportFingerprint(request={},rows=[],deck={}){
 const counts=new Map();
 for(const row of rows){const r=rowEvidence(row),k=JSON.stringify(stable({...r,qty:undefined})),old=counts.get(k);if(old&&Number.isInteger(old.qty)&&Number.isInteger(r.qty))old.qty+=r.qty;else counts.set(k,{...r});}
 return JSON.stringify(stable({version:FINAL_SUPPORT_VERSION,request:requestEvidence(request,deck),rows:[...counts.values()].sort((a,b)=>JSON.stringify(stable(a)).localeCompare(JSON.stringify(stable(b))))}));
}
const sourceEvidence=(row,evidence=text(row.card))=>({kind:'printed-oracle',name:row.name,oracleId:row.card?.oracle_id||null,zone:row.zone,face:front(row.card).name||row.card?.name||row.name,evidence});
const deps=rows=>rows.map(r=>({name:r.name,qty:r.qty,zone:r.zone}));
const supportRoles=c=>roles(c).flatMap(r=>r==='Interaction'?['Removal']:r);
const stage=(kind,status,cards,evidence,extra={})=>({kind,status,cards,evidence,...extra});
const assumptions=[
 'Structural support is conditional on obtaining and resolving the stated cards; no draw, turn, lethal-damage or win-rate prediction is made.',
 'The model does not simulate opponents, blockers, replacement effects, removal, stack interaction or all continuous effects.',
 'Cast and activation payments below use a possible developed mana board, not same-turn sequencing, land-drop availability or a probability of deployment.'
];

function normalizeRows(rows){
 const invalid=[],map=new Map();
 for(const raw of rows.filter(starting)){
  const n=name(raw),q=Number(raw.qty),original=raw.card||raw.c;
  if(!n||!Number.isInteger(q)||q<=0){invalid.push({name:n||'Unnamed row',reason:'Starting rows require a named card and positive integer quantity.'});continue;}
  // Fresh evidence objects avoid stale identity-memoized parsers after an in-place
  // metadata refresh, while preserving the caller's objects exactly.
  const card=original?structuredClone(original):null,zone=raw.zone==='command'||raw.zone==='commander'?'commander':'main',k=cardKey(n),old=map.get(k);
  if(old&&JSON.stringify(cardEvidence(old.card))!==JSON.stringify(cardEvidence(card)))invalid.push({name:n,reason:'Conflicting rules evidence for the same logical card.'});
  if(old)old.qty+=q;else map.set(k,{name:n,qty:q,zone,card,c:card});
 }
 return {rows:[...map.values()],invalid};
}
const fixedStat=value=>(typeof value==='number'&&Number.isFinite(value))||(typeof value==='string'&&/^[+-]?\d+$/.test(value.trim()));
const complete=c=>!!c?.name&&!!(front(c).type_line||c.type_line)&&typeof (front(c).oracle_text??c.oracle_text)==='string'&&!c.brief;
const tokens=s=>{const raw=String(s??'').trim(),ms=[...raw.matchAll(/\{(\d+|[WUBRGC])\}/g)];return raw&&ms.map(m=>m[0]).join('')===raw.replace(/\s/g,'')?ms.flatMap(m=>/^\d+$/.test(m[1])?Array(Number(m[1])).fill('*'):[m[1]]):null;};
function payment(costText,units){
 const need=tokens(costText);if(!need)return {status:'unverified',reason:'Variable, alternate, additional or missing mana cost is outside the payment check.'};
 const order=[...need].sort((a,b)=>(a==='*')-(b==='*')),taken=new Map();
 const match=(i,seen)=>{for(let j=0;j<units.length;j++){if(seen.has(j)||order[i]!=='*'&&!units[j].colors.includes(order[i]))continue;seen.add(j);if(!taken.has(j)||match(taken.get(j),seen)){taken.set(j,i);return true;}}return false;};
 const ok=order.length<=units.length&&order.every((_,i)=>match(i,new Set()));
 return {status:ok?'conditional':'missing',reason:ok?'Distinct available source units can pay the printed mana symbols in a developed-board scenario.':'The checked source pool cannot pay every printed mana symbol simultaneously.',manaCost:costText,sources:ok?unique([...taken.keys()].map(i=>units[i].name)):[],sourceUnits:units.length};
}
function manaBoard(rows,deck){
 const identity=unique(rows.filter(r=>inCommandZone(deck,r.name)).flatMap(r=>r.card?.color_identity||[])),units=[],sources=[],unresolved=[];
 const add=(r,land)=>{
  const p=mtgManaSourceProfile(r.card,{commanderIdentity:identity}),resource=mtgResourceProfile(r.card);
  if(/(?:when|as|if)[^\n]*enters?[^\n]*(?:sacrifice|discard)|as an additional cost to cast[^\n]*(?:sacrifice|discard)/i.test(text(r.card))){unresolved.push({name:r.name,reason:'Mandatory entry/casting sacrifice or discard setup is not established by this source comparison.',evidence:text(r.card)});return false;}
  const effects=resource.effects.filter(e=>e.controller==='self'&&e.tap&&e.automaticUntap&&e.activationMana===0&&!e.oneShot&&e.outputMana>0&&/^\{t\}: add /i.test(e.evidence)&&!e.requirements.some(t=>/additional|sacrifice|discard|counter|eligible|requires the object/i.test(t)));
  const intrinsic=land&&/\b(?:Plains|Island|Swamp|Mountain|Forest|Wastes)\b/.test((front(r.card).type_line||typeText(r.card))+' '+r.name);
  if(!p.colors.length||!land&&!effects.length){if(p.conditional.length||p.unknown)unresolved.push({name:r.name,...p});return false;}
  // A multi-mana ability cannot donate all its alternative colors to each
  // unit. Use one exact fixed-output mode, or one flexible unit (a conservative
  // subset when distinct modes produce different amounts).
  const fixed=effects.map(e=>e.evidence.match(/^\{T\}: Add ((?:\{[WUBRGC]\})+)\.?$/i)).filter(Boolean).map(m=>[...m[1].matchAll(/\{([WUBRGC])\}/gi)].map(x=>[x[1].toUpperCase()])).sort((a,b)=>b.length-a.length);
  const produced=fixed[0]?.length>1?fixed[0]:intrinsic||effects.length?[p.colors]:[];
  if(!produced.length)return false;
  for(let copy=0;copy<r.qty;copy++)for(const colors of produced)units.push({name:r.name,colors});
  sources.push({...sourceEvidence(r),qty:r.qty,manaUnitsPerCopy:produced.length,colors:unique(produced.flat()),requirements:unique(effects.flatMap(e=>e.requirements||[]))});return true;
 };
 for(const r of rows.filter(r=>isLand(r.card)))add(r,true);
 const pending=rows.filter(r=>!isLand(r.card)&&mtgResourceProfile(r.card).effects.some(e=>e.kind==='mana'));
 const added=new Set();
 for(let pass=0;pass<=pending.length;pass++){let change=false;for(const r of pending)if(!added.has(r.name)&&payment(cost(r.card),units).status==='conditional'&&add(r,false)){added.add(r.name);change=true;}if(!change)break;}
 return {status:units.length?'conditional':'unverified',units,sources,unresolved,assumptions:['Mana permanents must be accessed, resolved and able to tap; creature mana abilities require haste or control since the turn began.','Mana filters, restricted output, nonrenewing sources and unrecognized setup are not promoted to unrestricted production.','Sources may be developed over different turns. No exact opening hand, color probability or tempo claim is made.']};
}

// Only complete narrow primitives can establish absence. In particular an
// unparsed alternate-win, mill or counter clause is never a known noncloser.
function conservativeCoverage(rows){
 const hasCarrier=rows.some(r=>/\bCreature\b/.test(typeText(r.card)));
 const evidence=rows.map(r=>{
  let result=nonClosingCardCoverage(r.card,{hasCarrier});
  if(result.status!=='nonclosing'&&complete(r.card)&&!r.card.card_faces?.length){
   const t=text(r.card).replace(/\([^()]*\)/g,'').trim().toLowerCase(),p=Number(r.card.power),lines=t.split('\n').map(s=>s.trim().replace(/\.$/,'')).filter(Boolean);
   const keyword=/^(?:(?:defender|first strike|double strike|flying|menace|trample|haste|reach|vigilance|lifelink|deathtouch|hexproof|shroud|indestructible|partner)(?:,\s*|$))+$/;
   const mana=/^\{t\}: add (?:\{[wubrgc]\}(?: or \{[wubrgc]\})*|\{c\}\{c\}|one mana of any color)$/;
   if(/\bCreature\b/.test(typeText(r.card))&&fixedStat(r.card.power)&&(p===0||lines.includes('defender'))&&lines.every(l=>keyword.test(l)||mana.test(l)))result={status:'nonclosing',kind:'No positive independent combat output; only covered static keywords / mana',evidence:text(r.card)};
   else if(/^you gain (?:one|two|three|\d+) life\.?$/.test(t))result={status:'nonclosing',kind:'Own life gain only',evidence:text(r.card)};
  }
  return {...sourceEvidence(r),qty:r.qty,...result};
 });
 return {version:'mtg-final-nonclosing-v1',status:rows.length&&evidence.every(e=>e.status==='nonclosing')?'covered-nonclosing':'unmapped',evidence,unresolved:evidence.filter(e=>e.status!=='nonclosing'),reason:'Only complete covered nonclosing primitives support an incomplete verdict; unconsumed rules text remains unknown.'};
}

// A deliberately small complete-activation grammar. A resource loop does not
// waive colored costs, tapping, finite sacrifice/discard/counter fuel or timing.
function paidOutputs(row){
 const c=row.card,t=text(c),normalized=t.split(c?.name||'\u0000').join('this source'),out=[];
 for(const line of normalized.split('\n')){
  const m=line.trim().match(/^((?:\{[^}]+\})+): (.+)$/i);if(!m)continue;
  const effect=m[2],damage=effect.match(/^(?:this source|this (?:creature|artifact|enchantment)) deals (\d+) damage to (any target|target opponent|each opponent)\.?$/i),creature=effect.match(/^Create (a|an|one|two|three|four|\d+) (\d+)\/(\d+) [^.]*creature tokens?(?: with (?:flying|haste|vigilance|trample|menace)(?: and (?:flying|haste|vigilance|trample|menace))*)?\.?$/i);
  if(!damage&&!creature)continue;
  const kind=damage?'repeatable-damage':'repeatable-creature-output',mana=tokens(m[1]),restrictions=/activate only|only once|only during|only if|sacrifice|discard|remove [^.]*counter|as an additional cost/i.test(t),positive=damage?Number(damage[1])>0:Number(creature[2])>0&&Number(creature[3])>0;
  out.push({row,kind,cost:m[1],mana,evidence:line,positive,status:mana&&!restrictions&&positive?'conditional':'unverified',reason:restrictions?'Printed restrictions or finite fuel are not resolved by the repeated-output check.':!mana?'Nonmana or variable activation costs are not paid by a mana loop.':!positive?'No positive creature damage output is established.':null});
 }
 return out;
}
function outputRoutes(outputs,loops,board,rows){
 const out=[];
 for(const o of outputs){
  const cast=payment(cost(o.row.card),board.units),finite=payment(o.cost,board.units),essential=[o.row.name];
  const make=(loop=null)=>{
   const loopPayment=loop&&o.mana?o.mana.every(symbol=>symbol==='*'||symbol===loop.resource):false;
   const loopRows=loop?loop.cards.map(n=>rows.find(r=>cardKey(r.name)===cardKey(n))).filter(Boolean):[],setup=loopRows.map(r=>({name:r.name,...payment(cost(r.card),board.units)}));
   if(loop?.startupMana)setup.push({name:loop.label+' startup',...payment('{'+loop.startupMana+'}',board.units)});
   const setupReady=!loop||loopRows.length===loop.cards.length&&setup.every(p=>p.status==='conditional');
   const status=o.status==='conditional'&&cast.status==='conditional'&&(loop?loopPayment&&setupReady:finite.status==='conditional')?'supported-conditional':'unverified';
   const missing=[...setup.filter(p=>p.status==='missing').map(p=>p.name+': loop setup casting/startup payment is not established.'),...(cast.status==='missing'?['No checked source pool pays the outlet casting cost.']:[]),...(loop&&!loopPayment?['The reviewed loop output cannot pay the entire repeated activation cost.']:[]),...(!loop&&finite.status==='missing'?['No checked source pool pays the output activation.']:[])],unresolved=[...setup.filter(p=>p.status==='unverified').map(p=>p.name+': '+p.reason),...(o.reason?[o.reason]:[]),...(cast.status==='unverified'?[cast.reason]:[])];
   const endpoint=o.kind==='repeatable-damage'?'opponent-damage':'combat-creature-output',dependencies=unique([...essential,...(loop?.cards||[])]);
   return {id:(loop?'loop:'+loop.id:'paid')+':'+cardKey(o.row.name)+':'+o.kind,kind:loop?'loop-resource-conversion':o.kind,label:loop?'Reviewed mana engine into compatible '+endpoint:'Paid '+endpoint+' conversion',closing:true,endpoint,status,missing,unresolved,cardDependencies:dependencies,essentialDependencies:dependencies,failureModes:[o.kind==='repeatable-damage'?'opponent-damage':'combat-board',...(loop?['resource-engine']:[])],stages:[stage('input',cast.status,[o.row.name,...loopRows.map(r=>r.name)],[sourceEvidence(o.row),...loopRows.map(r=>sourceEvidence(r))],{payment:cast,setupPayments:setup}),stage('resource',loop?(setupReady?'conditional':'unverified'):finite.status,loop?.cards||finite.sources,loop?.sources||board.sources,{resource:loop?.resource||'finite renewable mana',payment:loop?{status:loopPayment?'conditional':'missing',manaCost:o.cost}:finite}),stage('payoff',o.status,[o.row.name],[sourceEvidence(o.row,o.evidence)]),stage('closing',status,dependencies,[o.kind==='repeatable-damage'?'Repeated positive damage can be directed to an opponent; this is not a lethal or uninterrupted sequence.':'Creates owned positive-power creature output that may attack after it becomes ready; blockers and losses are not simulated.'])],assumptions:unique([...assumptions,...(loop?.prerequisites||[]),...(loop?.limitations||[]),...(o.kind==='repeatable-creature-output'?['New creatures require haste or control since the turn began. Any finite number of repetitions still needs priority, legal effects and surviving pieces.']:[])]),evidence:[sourceEvidence(o.row,o.evidence),...loopRows.map(r=>sourceEvidence(r)),...(loop?.sources||[])]};
  };
  out.push(make());for(const loop of loops)out.push(make(loop));
 }
 return out;
}

// Do not promote a parsed token mention into a completed conversion when its
// trigger needs an unverified board condition. More complex event engines stay
// diagnostic; no general condition solver is inferred here.
function usableTokenOutput(row,outputs,board){
 if(/as an additional cost to cast|cast this spell only/i.test(text(row.card)))return false;
 if(outputs.some(o=>o.row.name===row.name&&o.kind==='repeatable-creature-output'&&o.status==='conditional'&&payment(o.cost,board.units).status==='conditional'))return true;
 return (combatContribution(row.card).tokenOutputs||[]).some(e=>{
  const line=e.evidence.split(row.card.name).join('~').trim();
  return /^(?:create\b|when (?:this (?:creature|artifact|enchantment|permanent)|~) enters(?: the battlefield)?, create\b|at the beginning of your upkeep, create\b)/i.test(line)&&! /\b(?:if|unless|for each|sacrifice|discard|remove)\b/i.test(line);
 });
}
function directEvasion(card){
 return text(card).split('\n').some(line=>/^(?:(?:flying|menace|trample|first strike|double strike|haste|vigilance|reach|lifelink|deathtouch|hexproof|indestructible)(?:,\s*|$))+\.?$/i.test(line.trim())&&/\b(?:flying|menace|trample)\b/i.test(line));
}
function flowSupport(row,rows,board){
 const profile=commanderDrawProfile(row.card,rows.map(r=>({c:r.card,qty:r.qty,name:r.name}))),payments=[];
 if(!profile.repeatable||profile.status==='unsupported')return {name:row.name,status:'unverified',profile,payments};
 for(const line of text(row.card).split('\n')){
  const m=line.trim().match(/^((?:\{[^}]+\})+)(, \{T\})?: Draw (?:a|one|two|three|\d+) cards?\.?$/i);
  if(!m||/activate only|only once/i.test(text(row.card)))continue;
  const pool=m[2]?board.units.filter(u=>u.name!==row.name):board.units;
  payments.push({...payment(m[1],pool),evidence:line,tap:!!m[2],note:m[2]?'The same permanent is not also used for mana in this draw activation.':null});
 }
 const automatic=/^At the beginning of your upkeep, draw (?:a|one|two|three|\d+) cards?\.?$/im.test(text(row.card));
 const providers=(profile.providerEvidence||[]).filter(e=>e.status==='conditional'&&!/\bif\b|\bunless\b/i.test(e.evidence)).filter(e=>(e.providers||[]).some(provider=>{
  const r=rows.find(r=>r.name===provider.name);return r&&provider.kind==='card'&&payment(cost(r.card),board.units).status==='conditional';
 }));
 return {name:row.name,status:payments.some(p=>p.status==='conditional')||automatic||providers.length?'conditional':'unverified',profile,payments,providers,automatic,reason:'Repeatable draw requires an evidenced payable activation or a narrowly supported trigger/provider, not casting the draw permanent alone.'};
}
function strategyRoutes(strategy,rows,board,outputs){
 const byName=new Map(rows.map(r=>[cardKey(r.name),r]));
 return (strategy.allRoutes||strategy.routes||[]).map((r,index)=>{
  const sourceRows=(r.cards||[]).map(c=>byName.get(cardKey(c.name))).filter(Boolean),outputRows=sourceRows.filter(row=>combatContribution(row.card).outputPower>0),resourceOnly=r.kind==='mana-engine';
  const payments=sourceRows.filter(row=>!isLand(row.card)).map(row=>({name:row.name,...payment(cost(row.card),board.units)}));
  const payable=row=>isLand(row.card)||payments.find(p=>p.name===row.name)?.status==='conditional';
  const missing=[],unresolved=[],unavailableAlternatives=payments.filter(p=>p.status!=='conditional');let flowEvidence=[];
  let status='unverified',essential=outputRows.map(row=>row.name),reason='Printed body pressure is a contribution, not by itself an established coherent closing plan.';
  // These are evidenced packages, not acceptance based on a route score, creature
  // count or a damage threshold. Bare bodies remain reviewable diagnostics.
  if(r.kind==='equipment'&&r.arrangement){
   essential=unique([r.arrangement.equipment,r.arrangement.carrier,r.arrangement.provider].filter(Boolean));
   for(const p of unavailableAlternatives)unresolved.push(p.name+': '+p.reason);
   if(r.arrangement.artifacts){
    const pool=r.arrangement.artifacts.eligible.map(c=>byName.get(cardKey(c.name))).filter(Boolean).filter(row=>payment(cost(row.card),board.units).status==='conditional'||isLand(row.card));
    const existing=sourceRows.filter(row=>/\bArtifact\b/.test(typeText(row.card))),existingNames=new Set(existing.map(row=>row.name));
    const additional=sum(pool.filter(row=>!existingNames.has(row.name)));
    if(existing.length+additional<r.arrangement.artifacts.minimum)unresolved.push('Additional artifacts for the selected attachment mode are not demonstrably deployable.');
    essential=unique([...essential,...pool.map(row=>row.name)]);
   }
   const carrier=byName.get(cardKey(r.arrangement.carrier))?.card,carrierFace=front(carrier);
   if(!fixedStat(carrierFace.power??carrier?.power)||!fixedStat(carrierFace.toughness??carrier?.toughness))unresolved.push('Carrier power/toughness evidence is missing or variable.');
   const attach=payment(r.arrangement.costs.attachmentCost||'{0}',board.units);
   if(attach.status!=='conditional')unresolved.push('The stated attachment payment is not established by the source pool.');
   if(r.arrangement.output.damagePower>0&&attach.status==='conditional')status='supported-conditional';
   reason='A compatible carrier, actual attachment mode and positive equipped combat output are evidenced; this is one conditional combat plan, not lethal proof.';
  }else if(r.kind==='combat-amplified'){
   const providers=outputRows.filter(payable).filter(row=>usableTokenOutput(row,outputs,board)),amplifiers=sourceRows.filter(payable).filter(row=>/(?:^|\n)(?:creature tokens?|(?:other )?creatures) you control get \+[1-9]\d*\/\+?\d+(?: and (?:have|gain) (?:vigilance|flying|menace|trample|first strike|double strike|haste|lifelink|reach)(?:,? and (?:vigilance|flying|menace|trample|first strike|double strike|haste|lifelink|reach))*)?\.?(?:\n|$)/i.test(text(row.card)));
   essential=unique([...providers,...amplifiers].map(row=>row.name));status=providers.length&&amplifiers.length?'supported-conditional':'unverified';reason='Owned creature output and a matching broad combat amplifier form a conditional package.';
  }else if(r.kind==='control'){
   const finishers=outputRows.filter(payable).filter(row=>directEvasion(row.card)||usableTokenOutput(row,outputs,board));
   flowEvidence=sourceRows.filter(payable).filter(row=>supportRoles(row.card).includes('Draw')).map(row=>flowSupport(row,rows,board));
   const flow=sourceRows.filter(row=>flowEvidence.some(e=>e.name===row.name&&e.status==='conditional')),answers=rows.filter(row=>supportRoles(row.card).includes('Removal')&&payment(cost(row.card),board.units).status==='conditional');
   // Existing control detection requires answers + repeatable draw + finishers.
   // Only explicit evasion or actual token output adds conversion credit here.
   if(finishers.length&&flow.length&&answers.length)status='supported-conditional';else unresolved.push('The finisher diagnostic lacks a payable, separately evidenced conversion, answer or flow component.');
   essential=unique([...finishers,...flow,...answers].map(row=>row.name));reason='Recognized answers and repeatable flow connect to an explicitly evasive or token-producing finisher; timing and survival remain conditional.';
  }else if(r.kind==='resource-output'){
   const supported=outputs.filter(o=>o.status==='conditional'&&sourceRows.some(row=>row.name===o.row.name&&payable(row))&&payment(o.cost,board.units).status==='conditional');
   if(supported.length)status='supported-conditional';else unresolved.push('Repeatable output has costs, timing or fuel outside the complete activation check.');
   essential=unique([...supported.map(o=>o.row.name),...sourceRows.filter(payable).filter(row=>mtgResourceProfile(row.card).acceleration).map(row=>row.name)]);reason='A separate renewable resource package can pay recognized repeatable owned creature output.';
  }else if(resourceOnly){status=r.access>0&&r.deployment>0?'supported-conditional':'unverified';reason='Commander/resource output is an engine, not a closing endpoint.';essential=sourceRows.map(row=>row.name);}
  if(missing.length||unresolved.length||!resourceOnly&&(!(r.access>0)||!(r.deployment>0)||!(r.conversion>0)))status='unverified';
  const dependencies=unique(sourceRows.map(row=>row.name));
  return {id:'strategy:'+r.kind+':'+index,kind:r.kind,label:r.label,closing:!resourceOnly,endpoint:resourceOnly?'engine-output':'combat-damage',status,missing,unresolved:unique([...unresolved,...(r.kind==='combat'?[reason]:[])]),cardDependencies:dependencies,essentialDependencies:unique(essential),failureModes:resourceOnly?['resource-engine']:['combat-board'],stages:[stage('input','conditional',dependencies,sourceRows.map(row=>sourceEvidence(row)),{accessAssumptions:r.requirements||[]}),stage('resource',payments.some(p=>p.status!=='conditional')?'unverified':'conditional',unique(payments.flatMap(p=>p.sources)),board.sources,{payments}),stage('payoff',outputRows.length?'conditional':'unverified',outputRows.map(row=>row.name),[reason]),stage('closing',resourceOnly?'not-a-closer':status,essential,[reason])],assumptions:unique([...assumptions,...(r.requirements||[])]),unavailableAlternatives,flowEvidence,evidence:[...sourceRows.map(row=>sourceEvidence(row)),...(r.evidence||[]).map(evidence=>({kind:'existing-strategy-model',evidence}))]};
 });
}
function dependencyGroups(routes){
 const groups=[];
 for(const route of routes.filter(r=>r.closing&&r.status==='supported-conditional')){
  const matches=groups.filter(g=>g.failureModes.some(f=>route.failureModes.includes(f))||g.cardDependencies.some(c=>route.essentialDependencies.includes(c)));
  const group={routeIds:[route.id],cardDependencies:[...route.essentialDependencies],failureModes:[...route.failureModes]};
  for(const match of matches){groups.splice(groups.indexOf(match),1);group.routeIds.push(...match.routeIds);group.cardDependencies.push(...match.cardDependencies);group.failureModes.push(...match.failureModes);}
  for(const key of ['routeIds','cardDependencies','failureModes'])group[key]=unique(group[key]);groups.push(group);
 }
 return groups.map((g,i)=>({id:'dependency-group-'+(i+1),...g,independence:'not-proven',reason:'Shared essential cards or broad failure modes are grouped; group count is not extra wins, independent odds or a redundancy guarantee.'}));
}

export function inspectFinalSupport(request={},rows=[],deck={}){
 const normalized=normalizeRows(rows),main=normalized.rows,declared={...deck,game:'mtg',format:request.format||deck.format||'Commander',commander:deck.commander||request.commander||'',commanders:deck.commanders||request.commanders||[],cards:main.map(r=>({name:r.name,qty:r.qty})),side:[]},catalog=Object.fromEntries(main.filter(r=>r.card).map(r=>[cardKey(r.name),r.card]));
 const unknown=main.filter(r=>!complete(r.card)).map(r=>({name:r.name,reason:'Complete current rules/type evidence is unavailable.'})),metadataIssues=[...normalized.invalid,...unknown],known=main.filter(r=>complete(r.card));
 const primary=inspectPrimaryInputs(main,{commander:declared.commander,seed:request.seed||deck.buildAround||''}),optional=inspectAbilityEndpoints(main,{commander:declared.commander,commanders:declared.commanders});
 const selectedPrimary=!!declared.commander||!!request.seed&&request.seedOrigin!=='automatic',primaryRequired=request.primaryInputRequired??selectedPrimary;
 const requestedLoop=inspectManaLoop(main,request),availableLoops=inspectManaLoop(main,{requireLoop:'infinite-mana'}).packages;
 const board=manaBoard(known,declared),criteria=commanderCriteria(declared,catalog,{roles:supportRoles}),strategy=mtgStrategicEstimate(declared,catalog,criteria,{roles:supportRoles}),outputs=known.flatMap(paidOutputs),coverage=conservativeCoverage(main);
 const routes=[...strategyRoutes(strategy,known,board,outputs),...outputRoutes(outputs,availableLoops,board,known)];
 for(const loop of availableLoops)routes.push({id:'engine:'+loop.id,kind:'reviewed-mana-loop',label:loop.label,closing:false,endpoint:'mana',status:'supported-conditional',cardDependencies:loop.cards,essentialDependencies:loop.cards,failureModes:['resource-engine'],stages:[stage('input','conditional',loop.cards,loop.sources),stage('resource','conditional',loop.cards,loop.sources,{output:loop.netResources}),stage('payoff','unverified',[],['The mana proof does not supply an outlet.']),stage('closing','not-a-closer',[],['Mana alone is not a closing endpoint.'])],missing:routes.some(r=>r.kind==='loop-resource-conversion'&&r.status==='supported-conditional'&&loop.cards.every(c=>r.cardDependencies.includes(c)))?[]:['No compatible closing conversion is established for this mana engine.'],unresolved:[],assumptions:[...loop.prerequisites,...loop.limitations],evidence:loop.sources});
 const supported=routes.filter(r=>r.closing&&r.status==='supported-conditional'),closingStatus=metadataIssues.length||strategy.status==='primary-route-unmapped'?'unverified':supported.length?'supported-conditional':coverage.status==='covered-nonclosing'?'known-incomplete':'unverified';
 const hardIssues=[...(primaryRequired&&primary.status==='missing'?['The selected primary plan has no identified eligible input/provider in the starting list.']:[]),...requestedLoop.issues],primaryUnknown=primaryRequired&&primary.status==='unverified';
 const requestedStatus=hardIssues.length?'known-incomplete':primaryUnknown?'unverified':'supported-conditional';
 const sideCopies=sum(rows.filter(r=>r.zone==='side'&&Number.isInteger(Number(r.qty))&&r.qty>0)),matchMode=request.matchMode||'unspecified',matchCoverage={requested:matchMode,sideCopies,status:matchMode==='bo3'&&!sideCopies?'unverified':'not-blocked',evidence:matchMode==='bo3'&&!sideCopies?'A BO3/local-shop request has no delivered sideboard; this is a partial recommendation, not an illegal zero-card sideboard.':'Sideboard presence does not establish match-mode provenance, sideboard quality or tested performance.'};
 const status=hardIssues.length?'known-incomplete':primaryUnknown||matchCoverage.status==='unverified'?'unverified':closingStatus;
 const issues=unique([...hardIssues,...(closingStatus==='known-incomplete'?['Every checked starting-list function is known nonclosing; no supported closing conversion is present.']:[])]);
 const notes=unique([...primary.notes,...optional.notes,...(closingStatus==='unverified'?['A complete closing plan is outside the present model or lacks evidence; retain this as a reviewable draft, not a verified completed recommendation.']:[]),...(strategy.primaryRouteCoverage?[strategy.primaryRouteCoverage.reason]:[]),...(matchCoverage.status==='unverified'?[matchCoverage.evidence]:[]),...assumptions]);
 const engines=[...primary.groups.map(g=>({kind:'primary-input',required:primaryRequired,...g})),...availableLoops.map(p=>({kind:'reviewed-mana-loop',status:'supported-conditional',package:p,closing:false}))];
 return {version:FINAL_SUPPORT_VERSION,status,requestSatisfied:status==='supported-conditional',fingerprint:finalSupportFingerprint(request,rows,deck),issues,notes,axes:{input:{status:primary.status,required:primaryRequired,groups:primary.groups},engine:{status:availableLoops.length?'supported-conditional':primary.groups.length?primary.status:'not-established',engines,requestedLoop},closing:{status:closingStatus,supportedRouteIds:supported.map(r=>r.id),meaning:'Bounded conditional structural plan, not lethal damage, a complete game simulation or competitive certification.'},requestedPlan:{status:requestedStatus,issues:hardIssues}},routes,engines,optionalBranches:optional.groups,independentRouteGroups:dependencyGroups(routes),coverage:{...coverage,metadataIssues,startingCopies:sum(main),excludedZones:unique(rows.filter(r=>!starting(r)).map(r=>r.zone)),strategyStatus:strategy.status,primaryRouteCoverage:strategy.primaryRouteCoverage||null,mana:{sources:board.sources,unresolved:board.unresolved,assumptions:board.assumptions}},matchCoverage};
}
