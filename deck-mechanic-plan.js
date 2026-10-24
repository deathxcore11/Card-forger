// Bounded mechanic prerequisites for Bloodlust growth and Bloodthirst; knowing a
// keyword's definition is distinct from proving every game-state interaction.
import {cardKey,typeText} from './core.js';
import {mtgAbilityEvidence} from './mtg-effects.js';
import {CREATURE_THEMES,fitsTypeRestrictions} from './planner.js';
import {tribePattern} from './mtg-vocabulary.js';
import {atLeastOne} from './deckaudit.js';
import {KEYWORD_SOURCE,KEYWORD_REFERENCE} from './mtg-keyword-reference.js';
import {readMtgConceptMentions} from './mtg-wiki-knowledge.js';
const unique=xs=>[...new Set(xs)];
const quantity=rows=>rows.reduce((n,r)=>n+r.qty,0);
const round=n=>Math.round(n*10000)/10000;
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const faces=c=>c?.card_faces?.length?c.card_faces:[c||{}];
const text=c=>faces(c).map(f=>f.oracle_text||'').join('\n');
const ownText=c=>[c?.name,...faces(c).map(f=>f.name)].filter(Boolean).sort((a,b)=>b.length-a.length).reduce((s,name)=>s.replace(new RegExp(escape(name.replace(/[’]/g,"'")),'gi'),'this card'),text(c).replace(/[’]/g,"'"));
const isCreature=c=>/\bCreature\b/.test(typeText(c));
const view=r=>({name:r.name,qty:r.qty,zone:r.command?'commander':'library'});
const names=abilities=>unique((abilities||[]).filter(a=>typeof a==='string').map(a=>a.trim()).filter(Boolean));
export const MECHANIC_PLAN_POLICY=Object.freeze({version:'mechanic-prerequisites-v1',mapped:['Bloodlust','Bloodthirst'],naturalCardsSeen:11,payoffAccessTarget:.7,supportAccessTarget:.5,maximumRoutes:32,meaning:'Declared focused-build coverage targets, not universal deck quotas or a competitive-strength measure. A command-zone engine is accessible from that zone, not a library draw.'});

// Bloodlust here is the informal Slith-style combat-growth label. The printed
// card Blood Lust is a separate exact identity and is never silently renamed.
export function requestedMechanics(value='') {
 return readMtgConceptMentions(String(value)).filter(c=>['bloodlust','bloodthirst'].includes(c.builderCoverage.mechanicId)).map(c=>c.label);
}

export function mechanicDiscoveryQueries(abilities,{limit=3}={}) {
 const requested=names(abilities),growth=requested.some(a=>/^bloodlust$/i.test(a)),entry=requested.some(a=>/^bloodthirst$/i.test(a));
 // The builder adds format, color, legality and pool bounds. A text search only
 // gathers candidates; the prerequisite inspector still checks actual records.
 const growthBody='o:"combat damage to a player" o:"+1/+1 counter"',evasion='(keyword:flying or keyword:menace or keyword:trample or keyword:haste or o:"can\'t be blocked")',damage='o:damage (o:"any target" or o:"target opponent" or o:"each opponent" or o:"target player")';
 const queries=growth&&entry?['(('+growthBody+') or keyword:bloodthirst)',evasion,damage]:growth?[growthBody,evasion,'(o:proliferate or o:"counters would be put" or o:"gains hexproof" or o:"have hexproof")']:entry?['keyword:bloodthirst',damage,'t:creature mv<=2 pow>=1 -keyword:defender']:[];
 return queries.slice(0,Math.max(0,Math.min(6,Number(limit)||0)));
}

const counterAmount=s=>({a:1,one:1,two:2,three:3,four:4,five:5}[s.toLowerCase()]??Number(s));
function bloodlustGrowth(card) {
 const out=[];
 const front=faces(card)[0],record={...card,...front,name:front.name||card.name,card_faces:undefined};
 for(const line of ownText(record).split('\n').map(s=>s.replace(/\([^)]*\)/g,'').trim())){
  // Keep the triggering event, controller and counter recipient together.
  const match=line.match(/^Whenever\s+(.+?)\s+deals?\s+combat damage to (?:a player|an opponent|one or more (?:players|opponents)),\s*(?:you may )?put (a|one|two|three|four|five|\d+) \+1\/\+1 counters? on (it|this (?:card|creature)|that creature|each attacking creature you control|each creature you control)\b/i);
  if(!match)continue;
  const subject=match[1].trim(),self=/^this (?:card|creature)$/i.test(subject),type=!self?CREATURE_THEMES.find(t=>new RegExp('^(?:(?:an?|another|one or more) )?'+tribePattern(t)+'(?: creatures?)? you control$','i').test(subject)):null;
  if(!self&&!type&&!/^(?:(?:an?|another|one or more) )?(?:attacking )?creatures? you control$/i.test(subject))continue;
  const recipient=/^each attacking/i.test(match[3])?'attacking-team':/^each creature/i.test(match[3])?'your-team':/^that creature$/i.test(match[3])||!self&&/^it$/i.test(match[3])?'damaging-creature':'self';
  const firstStrike=mtgAbilityEvidence(record,'First strike').length>0,doubleStrike=mtgAbilityEvidence(record,'Double strike').length>0;
  out.push({subject:self?'self':'your-creatures',tribe:type||null,recipient,amount:counterAmount(match[2]),evidence:line,status:'conditional',firstStrike,doubleStrike,requirements:['Deal combat damage to a player/opponent, not only a creature, planeswalker or battle.','The trigger resolves after that combat-damage event; attackers must survive and remain eligible for the printed counter recipient.',...(firstStrike||doubleStrike?['Counters resolved after first-strike damage can affect a later regular combat-damage step, but do not change damage already dealt.']:[]),'Blocking, removal, prevention and timing can stop the growth.']});
 }
 return out;
}
export function mechanicCardMatches(card,abilities=[]) {
 return names(abilities).some(a=>/^bloodlust$/i.test(a)?bloodlustGrowth(card).length>0:/^bloodthirst$/i.test(a)?bloodthirstCounters(card).length>0:false);
}
const positiveGrant=(line,ability)=>{
 const match=new RegExp('\\b(?:has|have|gain|gains)\\s+(?:[^.]*?\\band\\s+)?'+escape(ability)+'\\b','i').exec(line);
 return !!match&&!/\b(?:can(?:not|'t)|do(?:es)? not|don't|doesn't|not)\s*$/i.test(line.slice(Math.max(0,match.index-18),match.index));
};
function bloodlustSupports(source,payoff) {
 const front=faces(source.card)[0],record={...source.card,...front,name:front.name||source.name,card_faces:undefined},out=[],self=cardKey(source.name)===cardKey(payoff.name),rules=ownText(record),native=['Flying','Menace','Trample','Haste','Shadow','Fear','Intimidate','Horsemanship'].flatMap(ability=>mtgAbilityEvidence(record,ability).filter(e=>new RegExp('^(?:[a-z -]+, )*'+escape(ability)+'(?=$|[\\s,{.—])','i').test(e.evidence)).map(e=>({ability,e})));
 if(self)for(const {ability,e} of native)out.push({kind:ability==='Haste'?'readiness':'evasion',evidence:e.evidence,requirements:[...e.requirements,'The ability helps timing or blocking restrictions; combat damage to a player still must occur.']});
 for(const line of rules.split('\n')){
  if(/\b(?:opponents? control|target opponent|enchanted|equipped)\b/i.test(line))continue;
  if(/\bas long as\b|\bif\b|\bunless\b/i.test(line))continue; // Unmapped game-state grant conditions cannot certify setup.
  const verb='(?:have|has|gain|gains|can(?:not|\x27t) be blocked)',all=new RegExp('^(?:other )?creatures? you control\\s+'+verb+'\\b','i').test(line),
    targeted=/\btarget creature(?: you control)?\s+(?:(?:with power \d+ or (?:less|greater))\s+)?(?:gets?|gains?|can(?:not|'t) be blocked)\b/i.test(line),
    typed=CREATURE_THEMES.find(t=>new RegExp('^(?:other )?'+tribePattern(t)+'(?: creatures?)? you control\\s+'+verb+'\\b','i').test(line)),
    restricted=line.match(new RegExp('^(?:other )?(artifact|enchantment|legendary|nonartifact|nonlegendary) creatures? you control\\s+'+verb+'\\b','i')),
    restriction=restricted?.[1]?.toLowerCase(),bodyType=typeText(payoff.card),restrictionFits=restriction?restriction.startsWith('non')?!new RegExp('\\b'+restriction.slice(3)+'\\b','i').test(bodyType):new RegExp('\\b'+restriction+'\\b','i').test(bodyType):false,
    recipient=all||targeted||!!typed||restrictionFits;
  const selfSubject=self&&new RegExp('^this (?:card|creature)\\s+'+verb+'\\b','i').test(line);
  if(!recipient&&!selfSubject)continue;
  if(typed&&!fitsTypeRestrictions(payoff.card,{creatureTypesOnly:[typed]}))continue;
  if(self&&/\bother\b/i.test(line))continue;
  // A grant that already needs a counter cannot establish the first successful
  // growth connection. It is an amplifier, not an initial combat enabler.
  if(/\bwith (?:a |one or more )?\+1\/\+1 counters?\b|\bif\b[^.]*\+1\/\+1 counters?\b/i.test(line))continue;
  const powerLimit=line.match(/\bpower (\d+) or (less|greater)\b/i),power=Number(faces(payoff.card)[0]?.power??payoff.card.power);
  if(powerLimit&&Number.isFinite(power)&&(powerLimit[2].toLowerCase()==='less'?power>Number(powerLimit[1]):power<Number(powerLimit[1])))continue;
  for(const ability of ['Flying','Menace','Trample','Haste','Hexproof','Indestructible','Ward'])if(positiveGrant(line,ability))out.push({kind:ability==='Haste'?'readiness':['Hexproof','Indestructible','Ward'].includes(ability)?'protection':'evasion',evidence:line,requirements:['Resolve the printed effect on the combat-growth creature before it needs that ability.','Eligible targets, activation costs, duration and other printed restrictions still apply.','Evasion/protection is conditional support, not guaranteed player damage.']});
  if(/\bcan(?:not|'t) be blocked\b/i.test(line)&&! /\b(?:lose|loses|doesn't have|don't have)\b/i.test(line)&&((self&&/this (?:card|creature)/i.test(line))||recipient))out.push({kind:'evasion',evidence:line,requirements:['Meet any printed power, type or blocking restriction for this combat-growth creature.','A power restriction may stop working after the creature grows; check target legality when activating and resolving.','Some blockers or changing creature characteristics may invalidate this support; it is not blanket unblockability.']});
 }
 return out;
}

function inspectBloodlust(main,known,library,N,seen) {
 const payoffs=known.map(r=>({...r,growth:bloodlustGrowth(r.card)})).filter(r=>r.growth.length),enablers=[],routes=[];let routeCount=0;
 for(const payoff of payoffs){
  const bodies=payoff.growth.some(g=>g.subject==='self')?[payoff]:known.filter(r=>isCreature(r.card)&&payoff.growth.some(g=>!g.tribe||fitsTypeRestrictions(r.card,{creatureTypesOnly:[g.tribe]})));
  for(const body of bodies){
   if(!combatEvidence(body.card))continue;
   for(const source of known)for(const support of bloodlustSupports(source,body)){
    enablers.push({...view(source),...support,status:'conditional'});routeCount++;
    if(routes.length<MECHANIC_PLAN_POLICY.maximumRoutes)routes.push({provider:source.name,payoff:payoff.name,combatBody:body.name,kind:support.kind,status:'conditional',requirements:[...support.requirements,...payoff.growth.flatMap(g=>g.requirements)],evidence:support.evidence});
   }
  }
 }
 const uniqueEnablers=[...new Map(enablers.map(e=>[cardKey(e.name)+'|'+e.kind+'|'+e.evidence,e])).values()],enablerNames=new Set(uniqueEnablers.map(e=>cardKey(e.name))),payoffNames=new Set(payoffs.map(r=>cardKey(r.name))),payoffLibrary=library.filter(r=>payoffNames.has(cardKey(r.name))),enablerLibrary=library.filter(r=>enablerNames.has(cardKey(r.name))),missing=[];
 if(!payoffs.length)missing.push('No mapped combat-damage-to-player trigger puts +1/+1 counters on your creature or attacking team. Bloodlust is an informal label, not a keyword to search literally.');
 if(!routes.length)missing.push('No applicable combat body plus recognized evasion, readiness or protection support was established. The combat-growth plan remains partial.');
 const mechanismStatus=missing.length?'partial':'supported',payoffAccess=atLeastOne(N,quantity(payoffLibrary),seen),enablerAccess=atLeastOne(N,quantity(enablerLibrary),seen),commandPayoff=payoffs.some(r=>r.command),commandSupport=uniqueEnablers.some(r=>r.zone==='commander');
 if(!commandPayoff&&payoffAccess<MECHANIC_PLAN_POLICY.payoffAccessTarget)missing.push('Natural access to a combat-growth payoff is below the declared '+Math.round(MECHANIC_PLAN_POLICY.payoffAccessTarget*100)+'% focused-build target.');
 if(!commandSupport&&enablerAccess<MECHANIC_PLAN_POLICY.supportAccessTarget)missing.push('Natural access to applicable combat support is below the declared '+Math.round(MECHANIC_PLAN_POLICY.supportAccessTarget*100)+'% focused-build target.');
 const unknown=quantity(main.filter(r=>!r.card||!typeText(r.card))),status=unknown?'unverified':missing.length?'partial':'supported';
 return {ability:'Bloodlust',informal:true,mapped:true,status,mechanismStatus,execution:'conditional',label:'Combat-damage growth (Slith-style)',payoffs:payoffs.map(r=>({...view(r),growth:r.growth})),enablers:uniqueEnablers,routes,routeCount,routesTruncated:routeCount>routes.length,coverage:{library:N,seen,payoffCopies:quantity(payoffLibrary),enablerCopies:quantity(enablerLibrary),payoffAccess:round(payoffAccess),enablerAccess:round(enablerAccess),commandPayoff,commandSupport},missing,semantics:{event:'combat-damage-to-player',result:'+1/+1-counters-after-combat-damage',lifeLossQualifies:false,noncombatDamageQualifies:false,attackAloneQualifies:false},amplifiers:known.filter(r=>/\bproliferate\b|\bcounters? would be put\b/i.test(text(r.card))).map(r=>({...view(r),status:'conditional',requirement:'Counter amplification needs an existing/being-placed counter and does not establish the initial player-damage connection.'}))};
}

function bloodthirstCounters(card) {
 const counters=[];
 for(const [index,face] of faces(card).entries())for(const line of String(face.oracle_text||'').split('\n')){
  const match=line.trim().match(/^Bloodthirst\s+(\d+|X)\b/i);
  if(!match||!mtgAbilityEvidence({...face,name:face.name||card.name},'Bloodthirst').length)continue;
  counters.push({kind:match[1].toUpperCase()==='X'?'x':'fixed',...(match[1].toUpperCase()==='X'?{basis:'total-opponent-damage-this-turn'}:{amount:Number(match[1])}),face:face.name||card.name,alternateFace:index>0});
 }
 return counters;
}

function damageEvidence(card) {
 const found=[],rules=ownText(card),type=typeText(card),creature=isCreature(card);
 for(const line of rules.split('\n')){
  // Replacement/prevention and quoted abilities are not independent sources.
  // Granted damage abilities require a recipient/attachment model not supplied
  // by this bounded inspector.
  if(/\bwould deal\b|\b(?:has|have|gains?|gain)\s+["“]|\b(?:equipped|enchanted)\b/i.test(line))continue;
  const match=line.match(/\bdeals?\s+(\d+|X)\s+damage\s+to\s+(any target|target player|each player|(?:each|target|an?) opponent)\b/i);
  if(!match||match[1]!=='X'&&Number(match[1])<=0)continue;
  const recipient=match[2].toLowerCase(),after=line.slice(match.index+match[0].length);
  if(/^['’]s|^\s+(?:controls?|owns?)\b|\b(?:other than (?:a )?player|(?:isn't|is not) a player)\b/i.test(after))continue;
  const before=line.slice(0,match.index),requirements=['Deal damage to an opponent earlier in the same turn, before the Bloodthirst permanent enters.','Pay the printed spell/ability costs; legal targets, prevention and other game-state restrictions still apply.'];
  let kind='noncombat-damage',timing='before-entry',selfEntry=false,selfCast=false;
  if(/\bwhen(?:ever)?\b|\bat the beginning\b/i.test(before)){
   if(/\bwhen(?:ever)?\s+(?:you cast this (?:card|spell)|this (?:card|spell) is cast)\b/i.test(before)){kind='cast-trigger';selfCast=true;requirements.push('The cast-triggered damage must resolve before the creature spell resolves.');}
   else if(/\bwhen(?:ever)?\s+this (?:card|creature)\s+enters\b/i.test(before)){kind='entry-trigger';selfEntry=true;requirements.push('Resolve this source and its entry-damage trigger before a different Bloodthirst entry.');}
   else if(/\bwhen(?:ever)?\s+[^,]*\benters\b/i.test(before)){
    if(!/\bwhen(?:ever)?\s+(?:(?:a|another|one or more) )?(?:nontoken )?creatures?\s+(?:you control )?enters?\b/i.test(before))continue;
    kind='entry-event-trigger';requirements.push('A separate earlier creature entry must trigger and resolve this damage; the payoff’s own entry is too late.');
   }
   else {kind='conditional-trigger';requirements.push('Meet and resolve the printed trigger before the Bloodthirst entry; trigger availability is not simulated.');}
  }else if(/:/.test(before)){
   kind='activated-damage';requirements.push('Activate and resolve this damage ability before the Bloodthirst entry.');
   if(creature&&/\{[TQ]\}/i.test(before))requirements.push('The source needs haste or control since the turn began for its tap/untap cost.');
  }else if(!/\b(?:Instant|Sorcery)\b/.test(type))continue;
  if(recipient==='any target'||recipient==='target player')requirements.push('Choose an opponent/player target; damage to a creature, planeswalker or battle does not satisfy Bloodthirst.');
  if(recipient==='each player')requirements.push('This effect also damages you; account for your own life total and prevention.');
  if(match[1].toUpperCase()==='X')requirements.push('Choose and pay for X greater than zero.');
  found.push({kind,timing,status:'conditional',selfEntry,selfCast,amount:match[1].toUpperCase()==='X'?null:Number(match[1]),evidence:line.trim(),requirements});
 }
 return found;
}

function combatEvidence(card) {
 const front=faces(card)[0],power=Number(front?.power??card?.power),rules=text(card);
 if(!isCreature(card)||!Number.isFinite(power)||power<=0||mtgAbilityEvidence(card,'Defender').length||/\bcan(?:not|'t) attack\b|\bthis (?:creature|card) can(?:not|'t) deal (?:combat )?damage\b|\bprevent all combat damage[^.]*this (?:creature|card)\b/i.test(ownText(card)))return null;
 return {kind:'combat-damage',timing:'combat-before-entry',status:'conditional',amount:null,evidence:'Printed creature power '+power+'; combat damage must reach an opponent.',requirements:['The creature must be able to attack and deal damage to an opponent, not only a creature, planeswalker or battle.','Control it since the turn began or give it haste; blockers, removal and prevention can stop the damage.','After combat damage, resolve the Bloodthirst permanent later in that same turn, normally in the second main phase.','Printed power is not guaranteed combat damage or proof an attack is safe.']};
}

export function inspectMechanicPlan(rows,{abilities=[],commander='',goal='strongest'}={}) {
 const requested=names(abilities),commanderName=cardKey(typeof commander==='string'?commander:commander?.name||''),byName=new Map();
 for(const row of rows||[]){
  if(['side','extra'].includes(row.zone)||!(Number(row.qty)>0))continue;
  const card=row.card||row.c,name=row.name||card?.name||'',command=['command','commander'].includes(row.zone)||!!commanderName&&cardKey(name)===commanderName,key=cardKey(name)+'|'+(command?'command':'library'),old=byName.get(key);
  if(old)old.qty+=Number(row.qty);else byName.set(key,{card,name,qty:Number(row.qty),command});
 }
 const main=[...byName.values()],library=main.filter(r=>!r.command),N=quantity(library),seen=Math.min(N,MECHANIC_PLAN_POLICY.naturalCardsSeen),known=main.filter(r=>r.card&&typeText(r.card)),groups=[];
 for(const ability of requested){
  if(/^bloodlust$/i.test(ability)){groups.push(inspectBloodlust(main,known,library,N,seen));continue;}
  if(!/^bloodthirst$/i.test(ability)){
   groups.push({ability,status:'unverified',mapped:false,payoffs:[],enablers:[],routes:[],coverage:{library:N,seen,payoffCopies:0,enablerCopies:0,payoffAccess:0,enablerAccess:0},missing:['This keyword’s rules may be known, but its strategic prerequisites are not mapped by this inspector.']});continue;
  }
  const payoffs=known.map(r=>({...r,counters:bloodthirstCounters(r.card)})).filter(r=>r.counters.length),payoffKeys=new Set(payoffs.map(r=>cardKey(r.name))),candidateEnablers=[];
  for(const r of known){
   const damage=damageEvidence(r.card),combat=!payoffKeys.has(cardKey(r.name))?combatEvidence(r.card):null;
   for(const evidence of [...damage,...(combat?[combat]:[])])candidateEnablers.push({...view(r),card:r.card,command:r.command,...evidence});
  }
  const routes=[];let routeCount=0;
  for(const payoff of payoffs)for(const provider of candidateEnablers){
   const same=cardKey(payoff.name)===cardKey(provider.name),requirements=[...provider.requirements];
   if(same&&!provider.selfCast){
    if(provider.qty<2||provider.command)continue;
    requirements.push('Use a different physical copy already resolved earlier; this entering copy cannot enable itself.');
   }
   if(provider.kind==='entry-event-trigger'){
    const other=known.find(r=>isCreature(r.card)&&cardKey(r.name)!==cardKey(payoff.name)&&cardKey(r.name)!==cardKey(provider.name));
    if(!other)continue;
    requirements.push('Resolve a separate earlier creature entry, such as '+other.name+', before the Bloodthirst payoff.');
   }
   routeCount++;if(routes.length>=MECHANIC_PLAN_POLICY.maximumRoutes)continue;
   routes.push({provider:provider.name,payoff:payoff.name,kind:provider.kind,status:'conditional',timing:provider.timing,requirements,evidence:provider.evidence,sameIdentity:same});
  }
  const linkedNames=new Set(routes.map(r=>cardKey(r.provider))),enablers=candidateEnablers.filter(r=>linkedNames.has(cardKey(r.name))).map(({card,command,selfEntry,selfCast,...r})=>r),payoffLibrary=payoffs.filter(r=>!r.command),enablerLibrary=library.filter(r=>linkedNames.has(cardKey(r.name))),lateCombatOptions=payoffs.filter(r=>combatEvidence(r.card)).map(r=>({...view(r),status:'conditional',requirement:'An earlier resolved Bloodthirst creature can deal combat damage to enable a later, different entry. That needs an earlier copy/body, an attack that connects and the later entry in the same turn; it does not establish initial early-damage support.'})),missing=[];
  if(!payoffs.length)missing.push('No loaded permanent has a native, quantified Bloodthirst ability.');
  if(!routes.length)missing.push('No mapped source can deal opponent damage before a Bloodthirst entry earlier in the same turn. Life loss alone does not qualify.');
  const mechanismStatus=missing.length?'partial':'supported',payoffAccess=atLeastOne(N,quantity(payoffLibrary),seen),enablerAccess=atLeastOne(N,quantity(enablerLibrary),seen),commandPayoff=payoffs.some(r=>r.command),commandSupport=enablers.some(r=>r.zone==='commander');
  if(!commandPayoff&&payoffAccess<MECHANIC_PLAN_POLICY.payoffAccessTarget)missing.push('Natural access to a Bloodthirst payoff is below the declared '+Math.round(MECHANIC_PLAN_POLICY.payoffAccessTarget*100)+'% focused-build target.');
  if(!commandSupport&&enablerAccess<MECHANIC_PLAN_POLICY.supportAccessTarget)missing.push('Natural access to an earlier opponent-damage enabler is below the declared '+Math.round(MECHANIC_PLAN_POLICY.supportAccessTarget*100)+'% focused-build target.');
  const missingTypes=quantity(main.filter(r=>!r.card||!typeText(r.card))),status=missingTypes?'unverified':missing.length?'partial':'supported';
  groups.push({ability:'Bloodthirst',mapped:true,status,mechanismStatus,execution:'conditional',rule:{source:KEYWORD_SOURCE,entryId:KEYWORD_REFERENCE.bloodthirst.entryId},payoffs:payoffs.map(r=>({...view(r),counters:r.counters})),enablers,routes,routeCount,lateCombatOptions,routesTruncated:routeCount>routes.length,coverage:{library:N,seen,payoffCopies:quantity(payoffLibrary),enablerCopies:quantity(enablerLibrary),payoffAccess:round(payoffAccess),enablerAccess:round(enablerAccess),commandPayoff,commandSupport},missing,semantics:{event:'opponent-damage',window:'earlier-this-turn-before-entry',fixed:'Bloodthirst N adds N +1/+1 counters after any qualifying damage, not N counters per damage.',variable:'Bloodthirst X uses total damage all your opponents were dealt that turn.',lifeLossQualifies:false,ownEntryDamageQualifies:false}});
 }
 const status=!groups.length?'not-requested':groups.some(g=>g.status==='unverified')?'unverified':groups.every(g=>g.status==='supported')?'supported':'partial';
 return {status,goal,policy:MECHANIC_PLAN_POLICY,groups,issues:groups.flatMap(g=>g.missing.map(s=>g.ability+' plan: '+s)),notes:groups.some(g=>g.mapped)?['Recognized setup routes are conditional: no damage event, safe combat connection, mana sequence or successful game outcome has been simulated.']:[],competitive:'unverified',limitations:['Only informal Bloodlust combat-growth and Bloodthirst prerequisites are mapped here. Other known mechanics are not automatically verified strategic plans.','Bloodlust combat-growth and Bloodthirst entering with counters are distinct event sequences. Neither life loss alone nor merely attacking proves player damage.','Physical library access excludes command-zone cards, token output, mulligans, tutors, extra draws, costs and sequencing.','A permanent’s own entry trigger happens after it enters and cannot supply its own Bloodthirst counters.','Opponent interaction, prevention, changing power, granted abilities and complex event chains can require manual review.']};
}
