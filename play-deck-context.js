// Freeze the app's existing estimates beside the exact list. These facts help
// explain setup; they never authorize actions or replace engine admission.
import {cardKey} from './core.js';
import {mtgPower,shownPower} from './power.js';
import {bracketEstimate} from './extras.js';
import {S} from './store.js';
import {RULE_VERSIONS} from './rule-reference.js';
const targetOf=d=>Object.hasOwn(d,'targetBracket')?d.targetBracket:d.practiceBuild?.request?.targetBracket??null;
const styleOf=d=>d.deckStyle||d.practiceBuild?.request?.deckStyle||'classic';
export function practiceListKey(deck){
 const rows=rs=>(rs||[]).map(r=>[cardKey(typeof r==='string'?r:r.name),typeof r==='string'?1:r.qty]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return JSON.stringify([deck.format,deck.commander||null,rows(deck.commanders),rows(deck.cards),rows(deck.side),deck.format==='Commander'?targetOf(deck):null,styleOf(deck),deck.goal||null,deck.requestedStyle||null]);
}
export function capturePracticeDeckContext(deck,{score=mtgPower,bracket=d=>bracketEstimate(d,S.catalog),now=()=>new Date().toISOString()}={}){
 const captured=structuredClone(deck),p=score(captured),value=shownPower(p),b=captured.format==='Commander'?bracket({...captured,targetBracket:targetOf(captured)}):null;
 captured.practiceContext={schema:1,listKey:practiceListKey(captured),capturedAt:now(),rulesVersion:RULE_VERSIONS.mtg,
  power:{value:Number.isFinite(value)&&value>=0&&value<=100?value:null,model:'existing-mtg-power',status:value===null?'unavailable':p?.readiness?.provisional?'provisional':'estimate'},
  bracket:b?{value:b.bracket??null,restrictionFloor:b.restrictionFloor??null,target:b.targetBracket??null,targetStatus:b.targetStatus,status:b.status,name:b.name,reasons:b.reasons,uncertainties:b.uncertainties,listDate:b.listDate,guidanceDate:b.guidanceDate,membershipVersion:b.membershipVersion}:null,
  intent:{targetBracket:captured.format==='Commander'?targetOf(captured):null,deckStyle:styleOf(captured)},
  note:'Power and bracket estimates describe this frozen list. Rules support and CPU piloting are checked separately.'};
 return captured;
}
export function currentPracticeContext(deck){const c=deck?.practiceContext;return c?.schema===1&&c.listKey===practiceListKey(deck)?structuredClone(c):null;}
