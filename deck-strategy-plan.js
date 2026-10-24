// Bounded tribal-package evidence shared by discovery and the final result.
// This is a declared construction policy, not a universal tribal quota, rules
// simulation, competitive-strength rating or forecast of a winning turn.
import {cardKey,typeText,isLand} from './core.js';
import {CREATURE_THEMES,tribeEvidence,fitsTypeRestrictions} from './planner.js';
import {mtgEffectProfile,mtgResourceProfile} from './mtg-effects.js';
import {atLeastOne} from './deckaudit.js';
import {tribePattern} from './mtg-vocabulary.js';

export const TRIBAL_STRATEGY_POLICY=Object.freeze({
 version:'tribal-package-v1',
 naturalCardsSeen:11,
 supportingAccessTarget:.7,
 providerAccessTarget:.5,
 memberCreatureShareTarget:.5,
 maximumDisplayedConnections:32,
 meaning:'A bounded builder coverage target for a requested tribal package, not a universal Magic deck rule or proof of strength.',
});
const unique=rows=>[...new Set(rows)];
const count=rows=>rows.reduce((n,r)=>n+r.qty,0);
const round=n=>Math.round(n*10000)/10000;
const cardName=r=>r.name||r.card?.name||r.c?.name||'';
const validTribes=tribes=>unique((tribes||[]).filter(t=>CREATURE_THEMES.includes(t)));
const isCreature=c=>/\bCreature\b/.test(typeText(c));
const knownType=c=>!!String(typeText(c)||'').trim();
const toCard=r=>({name:r.name,qty:r.qty,zone:r.command?'commander':'library'});
const describe=rows=>({libraryCopies:count(rows.filter(r=>!r.command)),commanderCopies:count(rows.filter(r=>r.command)),cards:rows.map(toCard)});
// The existing effect profile establishes recipient and creature-token output.
// Limit the type check to the produced object, before "creature token", so a
// Goblin death trigger producing Skeletons does not become Goblin production.
const producesTribe=(card,tribalWord)=>mtgEffectProfile(card).provides.some(e=>e.controller==='self'&&e.tag==='creature_token'&&[...String(e.evidence).matchAll(/\bcreates?\b([^.]*)?\bcreature tokens?\b/gi)].some(m=>! /\b(?:copy|copies)\b/i.test(m[1]||'')&&tribalWord.test(m[1]||'')));
const payoffSubject=(e,tribe)=>{
 const term=tribePattern(tribe),text=e.text||'';
 if(new RegExp('\\b'+term+'\\s+spells?\\b','i').test(text))return 'cast-card';
 if(new RegExp('\\b'+term+'\\s+cards?\\b','i').test(text))return 'card-zone';
 if(new RegExp('\\b'+term+'(?:\\s+(?:creatures?|permanents?))?\\s+you control\\b|\\b'+term+'\\b[^.]*\\b(?:enters?|dies?|attacks?)\\b','i').test(text))return 'battlefield-body';
 return 'unmapped';
};
// A friendly tribal subject alone is not a beneficial effect. Keep this narrower
// than generic tribal relevance: drawbacks/type mentions stay unmapped here.
const usefulPayoff=(card,e)=>{
 const text=String(e.text||'').replace(/[’]/g,"'"),effects=mtgEffectProfile(card),same=effect=>effect.evidence?.includes(text)||text.includes(effect.evidence||'');
 if(/\bcost[^.]*\bless to cast\b|\bget(?:s)?\s+\+(?:\d+|x)\/\+(?:\d+|x)\b|\bput[^.]*\+1\/\+1 counters?\b/i.test(text))return true;
 const grant=/\b(?:have|has|gain|gains)\s+(?:(?:first|double) strike|haste|flying|trample|menace|lifelink|deathtouch|vigilance|ward|indestructible|hexproof|shroud|protection)\b/i.exec(text);
 if(grant&&!/\b(?:can(?:not|'t)|do(?:es)? not|don't|doesn't|not)\s*$/i.test(text.slice(Math.max(0,grant.index-18),grant.index))||/\bcan(?:not|'t) be (?:blocked|countered)\b/i.test(text))return true;
 if(/\byou (?:may )?draw\b|(?:^|,)\s*draw (?:a|one|two|three|\d+) cards?\b|\breturn[^.]*from your graveyard[^.]*to (?:your hand|the battlefield)\b/i.test(text))return true;
 if(/\bdeals?[^.]*damage to any target\b/i.test(text))return true;
 return effects.provides.some(effect=>effect.controller==='self'&&['creature_token','lifegain'].includes(effect.tag)&&same(effect))||mtgResourceProfile(card).effects.some(effect=>effect.controller==='self'&&effect.acceleration&&same(effect));
};

// These queries collect separate member, payoff, and production/resource pools.
// They do not prove a match: the existing card resolver, semantic evidence and
// final legality/color/budget/restriction checks remain authoritative.
export function tribalDiscoveryQueries(tribes,{limit=3}={}) {
 const types=validTribes(tribes),term=t=>/^[a-z]+$/i.test(t)?t.toLowerCase():JSON.stringify(t.toLowerCase());
 if(!types.length)return [];
 const or=xs=>xs.length===1?xs[0]:'('+xs.join(' or ')+')';
 const member=or(types.map(t=>'t:'+term(t))),mention=or(types.map(t=>'o:'+term(t)));
 return [
  '('+member+' or keyword:changeling)',
  mention+' (o:"you control" or o:"you cast" or o:"search your library")',
  mention+' (o:create or o:"add {" or o:draw or o:"exile the top")',
 ].slice(0,Math.max(0,Math.min(3,Number(limit)||0)));
}

export function inspectTribalStrategy(rows,{tribes=[],commander='',goal='strongest'}={}) {
 const requested=validTribes(tribes),commanderName=cardKey(typeof commander==='string'?commander:commander?.name||''),named=new Map();
 for(const row of rows||[]){
  if(['side','extra'].includes(row.zone)||!(Number(row.qty)>0))continue;
  const card=row.card||row.c,name=cardName(row),command=['commander','command'].includes(row.zone)||!!commanderName&&cardKey(name)===commanderName;
  const key=cardKey(name)+'|'+(command?'command':'library'),old=named.get(key),qty=Number(row.qty);
  if(old)old.qty+=qty;else named.set(key,{card,name,qty,command});
 }
 const main=[...named.values()],library=main.filter(r=>!r.command),libraryCopies=count(library),seen=Math.min(libraryCopies,TRIBAL_STRATEGY_POLICY.naturalCardsSeen),known=main.filter(r=>r.card&&knownType(r.card)),unknownCopies=count(main.filter(r=>!r.card||!knownType(r.card))),creatures=library.filter(r=>r.card&&isCreature(r.card)),groups=[];
 for(const tribe of requested){
  const tribalWord=new RegExp('\\b'+tribePattern(tribe)+'\\b','i');
  const matchesMember=c=>isCreature(c)&&fitsTypeRestrictions(c,{creatureTypesOnly:[tribe]});
  const evidence=new Map(known.map(r=>[r,tribeEvidence(r.card,tribe)]));
  const members=known.filter(r=>matchesMember(r.card));
  const producers=known.filter(r=>producesTribe(r.card,tribalWord));
  const payoffs=known.filter(r=>evidence.get(r).some(e=>e.kind==='payoff'&&usefulPayoff(r.card,e)));
  const resources=known.filter(r=>!isLand(r.card)&&(matchesMember(r.card)||evidence.get(r).length)&&mtgResourceProfile(r.card).effects.some(e=>e.controller==='self'&&e.acceleration));
  const providers=unique([...members,...producers]),support=unique([...providers,...payoffs,...resources,...known.filter(r=>evidence.get(r).some(e=>e.kind==='search'))]);
  const providerLibrary=providers.filter(r=>!r.command),supportLibrary=support.filter(r=>!r.command),connections=[];let connectionCount=0;
  // Use the established tribal-subject recognizer. An unrelated creature's
  // name or a spell aimed at opposing Goblins cannot establish this edge.
  for(const payoff of payoffs)for(const provider of providers){
   if(cardKey(payoff.name)===cardKey(provider.name))continue;
   const matched=evidence.get(payoff).filter(e=>e.kind==='payoff'&&usefulPayoff(payoff.card,e)).map(e=>({e,subject:payoffSubject(e,tribe)})).filter(({subject})=>subject==='battlefield-body'||['cast-card','card-zone'].includes(subject)&&members.includes(provider));
   if(!matched.length)continue;
   connectionCount++;
   if(connections.length>=TRIBAL_STRATEGY_POLICY.maximumDisplayedConnections)continue;
   connections.push({provider:provider.name,payoff:payoff.name,kind:'tribal-provider',status:'conditional',subjects:unique(matched.map(m=>m.subject)),requirements:['Resolve the relevant cards and meet the printed effect conditions.','Token creation does not cast a creature spell or put a creature card in hand or graveyard.','Provider presence is not access, timing or a guaranteed winning sequence.'],evidence:matched.map(m=>m.e.text)});
  }
  const providerCopies=count(providerLibrary),supportCopies=count(supportLibrary),supportAccess=atLeastOne(libraryCopies,supportCopies,seen),providerAccess=atLeastOne(libraryCopies,providerCopies,seen),memberCopies=count(members.filter(r=>!r.command)),creatureShare=count(creatures)?memberCopies/count(creatures):null,missing=[];
  if(!providers.length)missing.push('No confirmed '+tribe+' creatures or owned '+tribe+' token-producing cards.');
  if(!connections.length)missing.push('No distinct '+tribe+' provider and recognized tribal-payoff connection.');
  if(supportAccess<TRIBAL_STRATEGY_POLICY.supportingAccessTarget)missing.push('Natural access to supporting library cards is below the declared '+Math.round(TRIBAL_STRATEGY_POLICY.supportingAccessTarget*100)+'% builder coverage target.');
  if(providerAccess<TRIBAL_STRATEGY_POLICY.providerAccessTarget)missing.push('Natural access to creature/token-producing library cards is below the declared '+Math.round(TRIBAL_STRATEGY_POLICY.providerAccessTarget*100)+'% builder coverage target.');
  if(creatureShare!==null&&creatureShare<TRIBAL_STRATEGY_POLICY.memberCreatureShareTarget)missing.push(tribe+' cards are not a majority of the known library creature copies.');
  if(unknownCopies)missing.push(unknownCopies+' card copies have no loaded type details.');
  const status=unknownCopies?'unverified':missing.length?'partial':'supported';
  groups.push({tribe,status,members:{...describe(members),creatureShare:creatureShare===null?null:round(creatureShare)},producers:describe(producers),payoffs:describe(payoffs),resources:describe(resources),connections,connectionCount,connectionsTruncated:connectionCount>connections.length,coverage:{library:libraryCopies,supportCopies,providerCopies,seen,supportAccess:round(supportAccess),providerAccess:round(providerAccess)},missing});
 }
 const status=!groups.length?'not-requested':groups.some(g=>g.status==='unverified')?'unverified':groups.every(g=>g.status==='supported')?'supported':'partial',issues=groups.flatMap(g=>g.missing.map(reason=>g.tribe+' plan: '+reason));
 const notes=[...(goal==='weak'?['Intentionally weak is a player preference. Thin package coverage does not make a legal, deliberately weak deck invalid; the exact creature restrictions still apply.']:[]),...(groups.some(g=>g.producers.commanderCopies>0)?['A commander can supply repeatable tribal bodies from the command zone. A low library-access result leaves that commander-centric route partly mapped; it is not proof that the route is weak or impossible.']:[])];
 return {status,goal,policy:TRIBAL_STRATEGY_POLICY,groups,issues,notes,unknownCopies,competitive:'unverified',limitations:['Coverage measures physical library cards before mulligans, tutors, extra draws, mana costs and sequencing. Tokens are outputs, not cards drawn.','Command-zone cards are accessible from their zone, not in the opening hand or already on the battlefield.','The mapped tribal relationships are a bounded evidence model. Unrecognized commander-centric and nontribal engines can remain effective.','Passing this package policy does not establish professional deck quality, a legal combo, a winning turn or a matchup win rate.']};
}
