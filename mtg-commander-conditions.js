// Bounded printed-card eligibility, not a simulation of resolving an engine.
import {cardKey, rulesText, typeText} from './core.js';
import {MTG_VOCABULARY} from './mtg-vocabulary.js';
const types=MTG_VOCABULARY['creature-types'];
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const front=c=>c?.card_faces?.[0]||c||{};
const printedType=c=>front(c).type_line||typeText(c).split(' // ')[0]||'';
const everyType=c=>/\b(?:Creature|Kindred|Tribal)\b/.test(printedType(c))&&/^(?:changeling\b|this (?:card|creature) is every creature type)/im.test(front(c).oracle_text||rulesText(c));
const hasType=(c,t)=>new RegExp('(?:^|[ —])'+escape(t)+'(?=$|[ /])','i').test(printedType(c))||types.includes(t)&&everyType(c);
const quantity=rows=>rows.reduce((n,r)=>n+r.qty,0);
export function commanderCardConditions(commander){
 const text=front(commander).oracle_text||rulesText(commander),out=[];
 // Negated subtypes describe excluded recipients, never a positive tribal plan.
 for(const m of text.matchAll(/\b(other )?non[- ]([a-z]+) creatures you control (?:get [^.\n]*?and )?(?:have|gain) undying\b/gi)){
  const excluded=types.find(t=>t.toLowerCase()===m[2].toLowerCase());if(!excluded)continue;
  out.push({kind:'undying-recipients',label:'Eligible non-'+excluded+' creature cards',evidence:m[0],seen:11,
   matches:c=>!!c&&/\bCreature\b/.test(printedType(c))&&!hasType(c,excluded)&&(!m[1]||cardKey(c.name)!==cardKey(commander.name)),
   limitation:'Printed eligible creature cards only. Other creatures and non-'+excluded+' restrictions apply. Tokens cannot return through undying; a death without a +1/+1 counter, the grant source remaining relevant, and any sacrifice/recursion setup are not proved by this count. No infinite loop is inferred.'});
 }
 // Exact OR selection from a looked-at library window. Token creation is not
 // a card characteristic and cannot turn its source into an eligible hit.
 const look=text.match(/look at the top (one|two|three|four|five|six|seven|\d+) cards of your library\.\s*You may reveal (?:an? )?([A-Za-z, ]+) card from among them and put it into your hand\b/i);
 if(look){
  const alternatives=look[2].split(/,\s*|\s+or\s+/).map(s=>s.trim().replace(/^or\s+/i,'')).filter(Boolean),known=[...types,'Equipment','Lesson'];
  if(alternatives.length&&alternatives.every(t=>known.includes(t))){
   const seen=({one:1,two:2,three:3,four:4,five:5,six:6,seven:7}[look[1].toLowerCase()]||Number(look[1]));
   out.push({kind:'library-selection',label:alternatives.join(' / ')+' reveal hits',evidence:look[0],seen,
    matches:c=>!!c&&alternatives.some(t=>hasType(c,t)),
    limitation:'Printed front-face library-card eligibility only, counting each card once across OR alternatives. Chance to find a hit in one look, not chance to attack, resolve the ability, or win. Token-producing cards are not hits unless their own card type qualifies.'});
  }
 }
 return out;
}
export function inspectCommanderCardConditions(rows,{commander='',atLeastOne}={}){
 const main=rows.filter(r=>!['side','extra'].includes(r.zone)&&r.qty>0),lead=main.find(r=>cardKey(r.name||r.card?.name)===cardKey(commander))?.card,
  library=main.filter(r=>cardKey(r.name||r.card?.name)!==cardKey(commander)),N=quantity(library),groups=[],notes=[],issues=[];
 for(const condition of commanderCardConditions(lead)){
  const matches=library.filter(r=>condition.matches(r.card)),copies=quantity(matches),seen=Math.min(N,condition.seen),access=N?atLeastOne(N,copies,seen):0,
   status=library.some(r=>!r.card||!printedType(r.card))?'unverified':copies===0?'insufficient':access<.6?'partial':'supported';
  groups.push({kind:condition.kind,label:condition.label,source:'commander',status,copies,library:N,seen,access,cards:matches.map(r=>({name:r.name||r.card.name,qty:r.qty})),evidence:condition.evidence,summary:copies+' eligible library copies; '+Math.round(access*100)+'% chance of at least one in '+seen+' cards. '+condition.limitation});
  if(!copies)issues.push(condition.label+': no eligible library cards found for the printed commander ability.');
  else if(status!=='supported')notes.push(condition.label+': '+Math.round(access*100)+'% access, below the declared 60% coverage target; this ability remains '+status+'.');
  notes.push(condition.limitation);
 }
 return {status:!groups.length?'not-applicable':groups.some(g=>g.status==='insufficient')?'insufficient':groups.some(g=>g.status==='unverified')?'unverified':groups.some(g=>g.status==='partial')?'partial':'supported',groups,notes,issues};
}
