// Versioned, bounded strategic scenarios, NOT measured multiplayer power or a
// win-rate model. A route needs access, deployability AND useful output; a large
// generic role total cannot compensate for an absent conversion. Unknown rules
// remain unmodeled instead of receiving full marks or a fabricated penalty.
import {cardKey,rulesText,typeText,isLand,aggregateCards,inCommandZone} from './core.js';
import {formatOf} from './formats.js';
import {atLeastOne} from './deckaudit.js';
import {mtgResourceProfile,mtgEffectProfile,manaCostValue} from './mtg-effects.js';

export const COMMANDER_STRATEGY_MODEL=Object.freeze({version:'mtg-routes-v1',developmentDraws:11,controlDraws:18,executionWeight:.8,interactionWeight:.12,recoveryWeight:.08,pressureScale:3,backupWeight:.08});
const tx=c=>rulesText(c).toLowerCase(), sum=xs=>xs.reduce((n,r)=>n+r.qty,0), clamp=x=>Math.max(0,Math.min(1,x)), round=x=>Math.round(x*1000)/1000;
const key=r=>cardKey(r.c?.name||r.name), named=r=>({name:r.c.name,qty:r.qty});
const strip=s=>String(s||'').replace(/\([^)]*\)/g,'');
const firstFace=c=>c?.card_faces?.[0]||c||{};
const attackText=c=>strip(firstFace(c).oracle_text||c?.oracle_text||'').toLowerCase();
// A utility creature can contribute damage but is not automatically a finisher.
// Its contribution is continuous with printed rate; variable/alternative faces
// require their own model and are reported as unknown rather than zero quality.
export function combatContribution(c){
 const f=firstFace(c),t=attackText(c),type=f.type_line||typeText(c),mv=Number(c?.cmc)||0;
 let power=0,evasive=false,unmapped=false;const requirements=[],outputs=[],modes=[];
 if(/Creature/.test(type)&&!(/\bdefender\b|can't attack|cannot attack/.test(t))){
  const p=Number(f.power??c.power);if(!Number.isFinite(p))unmapped=true;else power=Math.max(0,p);
  evasive=/\bflying\b|\bmenace\b|\btrample\b|can'?t be blocked/.test(t)||(c.keywords||[]).some(k=>['Flying','Menace','Trample'].includes(k));
 }
 const tokenEffects=mtgEffectProfile(c).provides.filter(e=>e.tag==='creature_token'&&e.controller==='self'&&(!e.face||e.face===f.name||!c.card_faces));
 let etbPower=0,tokenPressure=0,tokenCost=mv,tokenActivationCost="";
 for(const effect of tokenEffects){
  const line=strip(effect.evidence).toLowerCase(),match=line.match(/create (a|an|one|two|three|four|\d+)\b[^.]*?\b(\d+)\/(\d+)\b/);
  requirements.push(...(effect.requirements||[]));
  // Loyalty, sacrifice, counters, copy output and variable X need a state model.
  // Retain a creature's independent body, but don't grant free token output.
  const prerequisite=effect.status==='unsupported'||/^\s*[+−-]?\d+\s*:/.test(line)||/sacrifice|remove [^.]*counter|\bx\b|copy|copies|populate/.test(line);
  if(!match||prerequisite){unmapped=true;continue;}
  const n=({a:1,an:1,one:1,two:2,three:3,four:4}[match[1]]??Number(match[1])),p=n*Number(match[2]),activation=line.includes(':')?manaCostValue(line.split(':')[0]):0;
  if(activation===null){unmapped=true;continue;}
  const conditional=/whenever|at the beginning|\bif\b|:/.test(line),factor=conditional?.7:1;
  const value=clamp(p/Math.max(2,mv+activation+1))*(1-Math.exp(-p/COMMANDER_STRATEGY_MODEL.pressureScale))*.85*factor;
  modes.push({pressure:value,cost:mv+activation,outputPower:p,activationCost:line.includes(':')?line.split(':')[0]:'',evidence:effect.evidence});
  outputs.push({evidence:effect.evidence,power:p,cost:mv+activation,conditional,types:(match[0].split(match[2]+'/'+match[3])[1]||'')});
  if(/\bwhen\b[^.]*enters/.test(line)&&!conditional)etbPower=Math.max(etbPower,p);
  else if(value>tokenPressure){tokenPressure=value;tokenCost=mv+activation;tokenActivationCost=line.includes(':')?line.split(':')[0]:"";}
 }
 const body=clamp((power+etbPower)/Math.max(2,mv+1))*(1-Math.exp(-(power+etbPower)/COMMANDER_STRATEGY_MODEL.pressureScale))*(evasive?1:.85);
 modes.unshift({pressure:body,cost:mv,outputPower:power+etbPower,activationCost:'',evidence:'Independently available body and unconditional ETB output'});
 const selected=[...modes].sort((a,b)=>b.pressure-a.pressure)[0],pressure=selected.pressure;
 return {known:!unmapped,...selected,modes,tokenOutputs:outputs,requirements:[...new Set(requirements)],reason:pressure?'Printed body/token output weighted by deployment cost; combat and token prerequisites remain conditional':unmapped?'Output depends on a mechanic not resolved by this model':'No independently modeled combat output'};
}
function access(N,rows,n){return atLeastOne(N,sum(rows),Math.min(n,N));}
// Exact same-window probability of seeing A and B, including overlapping cards.
export function routeJointAccess(N,a,b,n){
 const union=[...new Map([...a,...b].map(r=>[key(r),r])).values()];
 return clamp(access(N,a,n)+access(N,b,n)-access(N,union,n));
}
const geometric=xs=>xs.some(x=>x===0)?0:Math.exp(xs.reduce((n,x)=>n+Math.log(Math.max(.000001,x)),0)/xs.length);

export function mtgStrategicEstimate(deck,catalog,criteria,{roles=()=>[],cardEvidence=[]}={}){
 const M=COMMANDER_STRATEGY_MODEL,rows=aggregateCards(deck.cards||[]).map(r=>({...r,c:catalog[cardKey(r.name)]})),commandKeys=new Set([deck.commander,...(deck.commanders||[])].map(x=>typeof x==='string'?x:x?.name).filter(Boolean).map(cardKey));
 const library=rows.filter(r=>!inCommandZone(deck,r.name)),N=sum(library),known=library.filter(r=>r.c),spells=known.filter(r=>!isLand(r.c)),commander=catalog[cardKey(deck.commander)],unknown=sum(library.filter(r=>!r.c));
 const limitations=['Uncalibrated strategic heuristic, direction-tested on controlled fixtures; not measured win rate or a metagame rank.','Natural-access scenarios exclude tutors, mulligans, extra draws and opponent decisions. Deployment uses expected resources, not a full turn/stack simulation.','Colored-source absence is checked; exact color-pip probability, cost reductions and fetch sequencing remain partial. Unknown combos, alternate winning conditions and card-specific restrictions can change the estimate.'];
 if((formatOf(deck).commander&&!commander)||unknown||!N)return {version:M.version,score:null,confidence:'insufficient',status:'unknown',routes:[],dimensions:[],limitations:[...limitations,formatOf(deck).commander&&!commander?'Commander details unavailable.':`${unknown} library copies have missing details.`]};
 const landCount=sum(known.filter(r=>isLand(r.c))),rampRows=spells.filter(r=>mtgResourceProfile(r.c).acceleration),rawPressure=spells.map(r=>({...r,combat:combatContribution(r.c)})),unmapped=rawPressure.filter(r=>!r.combat.known||/you win the game|\{x\}|affinity|improvise|reconfigure|equip|reanimate|without paying|costs?[^.]*less to cast/.test(tx(r.c)+' '+(r.c.mana_cost||'')));
 let pressure=rawPressure.filter(r=>r.combat.pressure>0),cmdCombat=combatContribution(commander);
 const cmdText=tx(commander),manaEngine=/tap a nonland permanent for mana|whenever you tap[^.]*for mana/.test(cmdText),kinnan=/look at the top (?:five|5) cards[\s\S]{0,180}non-human creature card[^.]*onto the battlefield/.test(cmdText);
 const evidenceByKey=new Map(cardEvidence.map(c=>[cardKey(c.name),c])),interactionUnit=r=>evidenceByKey.get(key(r))?.interaction?.effective??(roles(r.c).some(x=>['Removal','Wipe'].includes(x))?1:0);
 const answerRows=spells.filter(r=>interactionUnit(r)>0),earlyAnswers=answerRows.filter(r=>(Number(r.c.cmc)||0)<=3),drawEvidence=criteria?.resources?.draw?.evidence||[],drawRows=spells.filter(r=>drawEvidence.some(e=>cardKey(e.name)===key(r)&&e.repeatable&&e.status!=='unsupported'));
 const recovery=spells.filter(r=>roles(r.c).includes('Protection')||/return[^.]*from your graveyard|from your graveyard to (?:your hand|the battlefield)/.test(tx(r.c)));
 const effectiveRamp=criteria?.resources.effectiveRamp||0,manaCapacity=(Math.min(M.developmentDraws,N)/N)*(landCount+effectiveRamp),conditionalFactor=.85;
 const deploy=(cost,conditional=false)=>clamp(manaCapacity/Math.max(1,cost))*(conditional?conditionalFactor:1);
 const route=(kind,label,a,d,c,cards,requirements,evidence)=>({kind,label,access:clamp(a),deployment:clamp(d),conversion:clamp(c),execution:geometric([clamp(a),clamp(d),clamp(c)]),status:'conditional',cards:cards.map(named),requirements,evidence});
 // Reachable colors start with lands and expand only through castable mana
 // sources/filters. No white spells are deployable from an exclusively colorless
 // pool. Multiple pips, fetching, timing and spending restrictions remain partial.
 const colors=new Set(),colorUnknown=known.filter(r=>isLand(r.c)).some(r=>!(r.c.produced_mana||[]).length&&!/Basic/.test(typeText(r.c))&&!/add \{[wubrgc]\}/i.test(tx(r.c)));
 const addColors=c=>{const land=isLand(c),effects=mtgResourceProfile(c).effects.filter(e=>e.controller==='self'&&e.status!=='unsupported');
  // produced_mana is possible capability, not unconditional eligibility (Amber).
  if(land&&!effects.length)for(const x of c.produced_mana||[])if('WUBRG'.includes(x))colors.add(x);
  const basic={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'};for(const [type,color]of Object.entries(basic))if(new RegExp('\\b'+type+'\\b').test(typeText(c)))colors.add(color);
  for(const effect of effects){const output=effect.evidence.split(/adds? /i)[1]||'';
   if(/among legendary/i.test(output)){for(const r of known.filter(r=>r.c!==c&&/Legendary.*(?:Creature|Planeswalker)/.test(typeText(r.c))&&colorReady(firstFace(r.c).mana_cost||r.c.mana_cost)))for(const x of r.c.colors||firstFace(r.c).colors||[])colors.add(x);continue;}
   if(/could produce|opponent/i.test(output))continue;
   if(/commander.*color identity/i.test(output)){for(const x of commander?.color_identity||[])colors.add(x);continue;}
   if(/any colo[u]?r/i.test(output))for(const x of 'WUBRG')colors.add(x);else for(const m of output.matchAll(/\{([WUBRG])\}/gi))colors.add(m[1].toUpperCase());
  }};
 const colorReady=cost=>colorUnknown||[...String(cost||'').matchAll(/\{([^}]+)\}/g)].every(m=>{const options=m[1].toUpperCase().split('/');return !options.some(x=>'WUBRG'.includes(x)&&x.length===1)||options.some(x=>colors.has(x)||/^\d+$/.test(x)||x==='P');});
 for(const r of known.filter(r=>isLand(r.c)))addColors(r.c);
 for(let pass=0;pass<5;pass++)for(const r of spells.filter(r=>mtgResourceProfile(r.c).effects.some(e=>e.controller==='self'&&['mana','mana-filter'].includes(e.kind))))if(colorReady(firstFace(r.c).mana_cost||r.c.mana_cost))addColors(r.c);
 const ready=(r,cost=r.combat?.cost??(Number(r.c.cmc)||0),conditional=false,capacity=manaCapacity)=>colorReady(firstFace(r.c).mana_cost||r.c.mana_cost)&&colorReady(r.combat?.activationCost)?clamp(capacity/Math.max(1,cost))*(conditional?conditionalFactor:1):0;
 // Optional modes keep their own costs and output together. An unavailable
 // colored activation cannot replace an independently castable body or donate
 // its printed token magnitude to that body's mode.
 const feasibleCombat=r=>{const modes=r.combat.modes||[r.combat],ranked=modes.map(m=>({...m,usable:m.pressure*ready({...r,combat:m},m.cost)})).sort((a,b)=>b.usable-a.usable||b.pressure-a.pressure);return {...r,combat:{...r.combat,...ranked[0]}};};
 pressure=rawPressure.map(feasibleCombat).filter(r=>r.combat.pressure>0);
 cmdCombat=feasibleCombat({c:commander||{},qty:1,combat:cmdCombat}).combat;
 // E[max usable output] is monotone when an optional useful card is added. An
 // extra utility body cannot dilute stronger threats merely by entering a mean.
 const expectedBest=(rs,n,value,baseline=0)=>{const entries=rs.map(r=>({r,q:clamp(value(r))})).filter(x=>x.q>baseline).sort((a,b)=>b.q-a.q);let out=baseline;for(let i=0;i<entries.length;i++){const next=Math.max(baseline,entries[i+1]?.q??baseline);if(entries[i].q>next)out+=(entries[i].q-next)*access(N,entries.slice(0,i+1).map(x=>x.r),n);}return clamp(out);};
 const routes=[];
 // Baseline combat and optional amplifiers are alternatives. Never force the
 // casting/activation cost of an unused back face or unrelated commander mode.
 if(pressure.length||cmdCombat.pressure>0){
  const combatLife=formatOf(deck).life||40,output=pressure.reduce((n,r)=>n+r.qty*r.combat.outputPower*Math.min(M.developmentDraws,N)/N*ready(r),0)+cmdCombat.outputPower*ready({c:commander||{},qty:1,combat:cmdCombat}),boardBurden=1-Math.exp(-output/combatLife);
  const commanderRow={c:commander||{},qty:1,combat:cmdCombat},cmdRaw=cmdCombat.pressure,cmdReady=cmdRaw*ready(commanderRow),raw=expectedBest(pressure,M.developmentDraws,r=>r.combat.pressure,cmdRaw),deployed=expectedBest(pressure,M.developmentDraws,r=>r.combat.pressure*ready(r),cmdReady),a=cmdRaw>0?1:access(N,pressure,M.developmentDraws);
  routes.push(route('combat','Deployable combat / token pressure',a,raw?deployed/raw:0,a?raw/a*boardBurden:0,[...pressure,...(cmdRaw?[commanderRow]:[])],['Resolve and retain attackers; combat damage is not guaranteed against blockers or removal.'],[`${sum(pressure)} library copies have modeled combat output; expected best available output weights absolute power, cost and evasion without diluting better threats.`,`Accessible modeled power ${round(output)} is scaled continuously against the format’s ${combatLife} starting life; one body is not treated as a completed closing plan.`,cmdRaw?'Command-zone body is available, but casting resources and colors still apply.':'Natural access uses the declared library-draw scenario.']));
  const ownTokens=pressure.filter(r=>r.combat.tokenOutputs?.length),anthem=spells.filter(r=>/\bcreature tokens? you control get|\b(?:other )?creatures you control get/.test(attackText(r.c)));
  if(ownTokens.length&&anthem.length){const pair=routeJointAccess(N,ownTokens,anthem,M.developmentDraws),bestAnthem=Math.max(...anthem.map(r=>ready(r))),boost=pair*bestAnthem*.35,augmented=clamp(deployed+(1-deployed)*boost);
   routes.push(route('combat-amplified','Creature tokens with a matching broad anthem',a,raw?Math.min(1,augmented/Math.max(raw,augmented)):0,a?Math.max(raw,augmented)/a*boardBurden:0,[...ownTokens,...anthem],['Deploy both the owned creature output and anthem; tribal-restricted anthems are not assumed compatible.'],['Only broad creature/token anthems are modeled; Clues and opponent-owned tokens cannot satisfy this route.']));}
 }
 // Control examines actual finishers later and usable answers/flow earlier.
 // Expensive optional cards cannot dilute cheaper alternatives by mean costs.
 const finishers=pressure.filter(r=>r.combat.pressure>=.3||/flying|trample|can't be blocked/.test(attackText(r.c)));
 if(answerRows.length&&drawRows.length&&finishers.length){
  const answerAccess=expectedBest(answerRows,M.developmentDraws,r=>ready(r)*interactionUnit(r)),flowAccess=expectedBest(drawRows,M.developmentDraws,r=>{const e=drawEvidence.find(e=>cardKey(e.name)===key(r));return ready(r,(Number(r.c.cmc)||0)+(e?.activationMana||0),true);}),a=geometric([answerAccess,flowAccess]),lateMana=(Math.min(M.controlDraws,N)/N)*(landCount+effectiveRamp),raw=expectedBest(finishers,M.controlDraws,r=>r.combat.pressure),deployed=expectedBest(finishers,M.controlDraws,r=>r.combat.pressure*ready(r,r.combat.cost,false,lateMana));
  routes.push(route('control','Answers and card advantage into a finisher',a,raw?deployed/raw:0,raw,[...drawRows,...finishers],['Answers must match opposing threats; card advantage must resolve.',`Finisher access is checked over ${M.controlDraws} natural draws; this is not a predicted winning turn.`],[`${sum(answerRows)} answer copies, ${sum(drawRows)} repeatable-flow candidates, ${sum(finishers)} modeled finishers.`]));
 }
 // Kinnan-like commander access is not a library draw. Its paid activation is a
 // separate setup requirement; the five-card hit is checked against eligible
 // non-Humans, rather than treating arbitrary ramp/creatures as a winning outlet.
 if(manaEngine&&kinnan){
  const nonHuman=spells.filter(r=>/Creature/.test(firstFace(r.c).type_line||typeText(r.c))&&!/\bHuman\b/.test(firstFace(r.c).type_line||typeText(r.c))),activationLine=cmdText.split('\n').find(s=>s.includes(':')&&/look at the top (?:five|5) cards/.test(s)),activation=manaCostValue(activationLine?.split(':')[0]||''),cost=Math.max(Number(commander.cmc)||0,activation||0,1),payoffHits=atLeastOne(N,sum(nonHuman),Math.min(5,N)),quality=expectedBest(nonHuman,5,r=>combatContribution(r.c).pressure||(/draw|untap|destroy|exile/.test(tx(r.c))?.5:0)),a=expectedBest(rampRows,M.developmentDraws,r=>ready(r));
  routes.push(route('mana-engine','Nonland mana into commander output',a,colorReady(firstFace(commander).mana_cost||commander.mana_cost)&&colorReady(activationLine?.split(':')[0])?deploy(cost,true):0,quality,[...rampRows,...nonHuman],['Resolve commander and nonland mana sources; pay the activation.', 'The eligible-card hit is not proof of a combo, winning line or uninterrupted activation.'],[`${sum(nonHuman)} eligible non-Human creature copies; ${Math.round(payoffHits*100)}% natural five-card hit before draw/tutor effects.`]));
 }
 // Explicit repeated creature-token outlets can convert large resource packages.
 const outlets=pressure.filter(r=>r.combat.tokenOutputs?.some(e=>e.evidence.includes(':')&&!/exert|sacrifice|discard|remove[^:]*counter/i.test(e.evidence.split(':')[0]))),outletKeys=new Set(outlets.map(key)),separateRamp=rampRows.filter(r=>!outletKeys.has(key(r)));
 if(outlets.length&&separateRamp.length){const raw=expectedBest(outlets,M.developmentDraws,r=>r.combat.pressure),deployed=expectedBest(outlets,M.developmentDraws,r=>r.combat.pressure*ready(r,r.combat.cost,true));routes.push(route('resource-output','Acceleration into repeatable creature output',access(N,separateRamp,M.developmentDraws),raw?deployed/raw:0,raw,[...separateRamp,...outlets],['Separate resources must pay the outlet repeatedly; tap and board requirements still apply.'],['True acceleration and actual owned creature-token output are paired, never mana filtering or opponent tokens.']));}
 if(!routes.length)return {version:M.version,score:null,confidence:'insufficient',status:'unmapped',routes:[],dimensions:[],limitations:[...limitations,'No supported strategic route is mapped. This does not prove the deck has no valid way to win; commander-only combat, Voltron and unknown combo routes require separate review.']};
 const ranked=routes.sort((a,b)=>b.execution-a.execution),best=ranked[0],backup=ranked.find(r=>r.kind!==best.kind&&((r.kind==='mana-engine'||r.kind==='resource-output')!==(best.kind==='mana-engine'||best.kind==='resource-output'))),execution=clamp(best.execution+(backup?M.backupWeight*(1-best.execution)*backup.execution:0)),interaction=expectedBest(earlyAnswers,M.developmentDraws,r=>ready(r)*interactionUnit(r)),resilience=expectedBest(recovery,M.developmentDraws,r=>ready(r,Number(r.c.cmc)||0,true)),raw=100*(M.executionWeight*execution+M.interactionWeight*interaction+M.recoveryWeight*resilience);
 const dimensions=[{key:'Execution',label:best.label,ratio:round(execution),weight:80,why:'Geometric mean of natural access, deployment resources and actual output: missing conversion cannot be filled by generic role counts. A small distinct backup-route benefit is bounded and never summed per edge.'},{key:'Interaction',label:'Early answer access',ratio:round(interaction),weight:12,why:`Feasible-cost access to a recognized answer costing 3 or less within ${M.developmentDraws} library cards; Temporary tap/airbend effects have partial weight; cast colors and expected resources are checked; timing, exact pips and matchup still matter.`},{key:'Recovery',label:'Protection / recovery access',ratio:round(resilience),weight:8,why:`Feasible-cost access to protection or recursion within ${M.developmentDraws} library cards; this does not simulate surviving disruption.`}];
 return {version:M.version,score:Math.round(raw),rankingValue:raw,confidence:unmapped.length||colorUnknown||cardEvidence.some(c=>(c.unsupported||[]).length||(c.requirements||[]).some(r=>r.status==='unsupported'))?'limited':'partial',status:'provisional',bestRoute:best.kind,backupRoute:backup?.kind||null,routes:ranked.slice(0,3),dimensions,coverage:{colors:[...colors].sort(),colorSourcesUnmapped:colorUnknown,mappedPressureCopies:sum(pressure),unmappedPressureCopies:sum(unmapped),knownLibrary:N,library:N,unresolvedMechanics:[...new Set([...unmapped.map(r=>r.c.name),...cardEvidence.filter(c=>(c.unsupported||[]).length||(c.requirements||[]).some(r=>r.status==='unsupported')).map(c=>c.name)])],conditionalCapabilities:cardEvidence.filter(c=>c.requirements?.length).map(c=>({name:c.name,requirements:c.requirements.map(r=>({kind:r.kind,status:r.status,note:r.note||r.evidence}))}))},scenario:{library:N,developmentDraws:Math.min(M.developmentDraws,N),controlDraws:Math.min(M.controlDraws,N),expectedResourceUnits:round(manaCapacity),effectiveRamp},limitations};
}

// Compatibility export for existing Commander-only callers.
export const commanderStrategicEstimate=mtgStrategicEstimate;
