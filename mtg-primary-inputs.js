// Bounded printed input/event relationships. These are not resolved-game traces.
import {cardKey,rulesText,typeText,isLand} from './core.js';
import {mtgEffectProfile,manaCostValue} from './mtg-effects.js';
const front=c=>c?.card_faces?.[0]||c||{};
const type=c=>front(c).type_line||typeText(c).split(' // ')[0]||'';
const subtype=(c,t)=>new RegExp('(?:^|[ —])'+t+'(?=$|[ /])','i').test(type(c));
const count=rows=>rows.reduce((n,r)=>n+Number(r.qty),0);
const baseEvidence=(source,evidence)=>({source:{name:source?.name||'',oracleId:source?.oracle_id||null},evidence,controller:'self',zone:'battlefield',parserConfidence:'bounded-text-pattern'});
const tokenLines=c=>mtgEffectProfile(c).provides.filter(e=>e.tag==='token'&&e.controller==='self'&&!/(?:opponent|that player|they)\s+(?:may\s+)?creates?\b/i.test(e.evidence));
const nativeFlying=c=>/^flying(?:[,.]|\s*\(|$)/im.test(String(front(c).oracle_text||'').trim());
const unresolvedEntryProvider=c=>tokenLines(c).some(e=>!/\bland tokens?\b/i.test(e.evidence)&&/\bcreates?\b/i.test(e.evidence))&&!nonlandEntryProvider(c);
function entryEvidence(c,alternatives){
 const printed=alternatives.filter(t=>subtype(c,t));
 if(printed.length)return {kind:'printed-input',types:printed,conditional:true,evidence:type(c),requirements:['Requires casting or otherwise putting this permanent onto the battlefield; attachment and mana requirements are separate.']};
 const token=tokenLines(c).find(e=>alternatives.some(t=>new RegExp('\\b'+t+'\\b','i').test(e.evidence)||(t==='Aura'&&/\bRole token/i.test(e.evidence))));
 if(token)return {kind:'token-provider',types:alternatives.filter(t=>new RegExp('\\b'+t+'\\b','i').test(token.evidence)||(t==='Aura'&&/\bRole token/i.test(token.evidence))),conditional:true,evidence:token.evidence,requirements:[...(token.requirements||[]),'Requires resolving the printed token creation and any eligible attachment target; this source is not itself a printed subtype card.']};
 return null;
}
const castingCost=c=>{const cost=front(c).mana_cost??c?.mana_cost;return typeof cost==='string'&&/^(?:\{(?:[0-9]+|[WUBRGCSPXYZ]|[WUBRG2]\/[WUBRGP])\})+$/i.test(cost)?manaCostValue(cost):null;};
const number=s=>({a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6}[s.toLowerCase()]||(/^\d+$/.test(s)?Number(s):null));
// Single-card entry providers are kept distinct from two separate spells.
export function nonlandEntryProvider(c){
 const text=rulesText(c),permanent=!isLand(c)&&/\b(?:Creature|Artifact|Enchantment|Planeswalker|Battle)\b/.test(type(c));
 for(const token of tokenLines(c)){
  const line=token.evidence;
  if(token.face&&c?.card_faces?.length&&token.face!==front(c).name)continue;
  if(/\bland tokens?\b/i.test(line)||!/(?:artifact|creature|enchantment|planeswalker|battle|Role|Treasure|Food|Clue|Blood|Map|Powerstone|Gold|Shard|Glimmer)[^.]*tokens?/i.test(line))continue;
  const amount=line.match(/\bcreates?\s+(a|an|one|two|three|four|five|six|\d+)\b/i),n=amount?number(amount[1]):null;
  if(!n||/\b(?:copy|copies|for each|equal to|X)\b/i.test(line))continue;
  const selfEntry=/\bwhen\b[^,]*\b(?:this (?:creature|artifact|enchantment|permanent)|enters)\b[^,]*\benters\b/i.test(line)||/\bwhen this (?:creature|artifact|enchantment|permanent) enters\b/i.test(line)||!!c?.name&&line.toLowerCase().includes('when '+c.name.toLowerCase()+' enters');
  const chapter=/^(?:I|II)(?:\s*,\s*I{1,3})?\s*—/.test(line.trim()),chapterNow=chapter&&(/^I\s*—/.test(line.trim())||/\bread ahead\b/i.test(text));
  const room=/\bRoom\b/.test(type(c))&&/when you unlock this door/i.test(line);
  const spell=/\b(?:Instant|Sorcery)\b/.test(type(c))&&!/\b(?:when|whenever|at the beginning|if|unless|for each)\b/i.test(line);
  if((permanent&&(selfEntry||chapterNow||room))||spell&&n>=2)return {kind:'multi-entry-provider',minimumEvents:n+(permanent?1:0),conditional:true,evidence:line,requirements:[...(token.requirements||[]),...(chapterNow?['Requires choosing/reaching the stated entry chapter; Read ahead applies where printed.']:[]),...(room?['Requires casting/unlocking the token-producing Room door as it enters, not unlocking an already-present Room alone.']:[]),'Requires resolution before the commander attack/beginning-of-combat check; no sequence, draw, or mana guarantee.']};
 }
 return null;
}
export function primaryInputRequirements(source){
 const text=rulesText(source),out=[];
 for(const line of text.split('\n')){
  const m=line.match(/Whenever (?:an? )?(Vehicle|Aura|Equipment)(?: or (Vehicle|Aura|Equipment))? (?:you control enters(?: the battlefield)?|enters(?: the battlefield)? under your control),/i);
  if(m){const alternatives=[...new Set([m[1],m[2]].filter(Boolean).map(t=>t[0].toUpperCase()+t.slice(1).toLowerCase()))],flyingDraw=/draw a card if it has flying/i.test(line);
   out.push({...baseEvidence(source,line),kind:'owned-permanent-entry',label:alternatives.join(' / ')+' entry inputs',alternatives,flyingDraw,timing:'After the commander is present, resolve an eligible owned permanent entering.',query:'('+alternatives.map(t=>'t:'+t.toLowerCase()).concat(alternatives.includes('Aura')?['o:"Role token"']:[]).join(' or ')+')',match:c=>entryEvidence(c,alternatives),priority:c=>flyingDraw&&nativeFlying(c)?2:1});
  }
 }
 const celebration=text.match(/(?:if|as long as) two or more nonland permanents entered the battlefield under your control this turn/i);
 if(celebration)out.push({...baseEvidence(source,celebration[0]),kind:'two-nonland-entries',label:'Two nonland entries before the payoff check',timing:/at the beginning of combat/i.test(text)?'Before beginning of combat; an intervening-if trigger checks again on resolution.':/whenever[^.]*attacks/i.test(text)?'Before declaring the commander as an attacker; the trigger checks again on resolution.':'Before the printed conditional effect applies.',query:'(o:create o:token)',match:nonlandEntryProvider,priority:()=>1});
 return out;
}
export function primaryInputQueries(source){return [...new Set(primaryInputRequirements(source).map(r=>r.query))];}
export function inspectPrimaryInputs(rows,{commander='',seed=''}={}){
 const main=rows.filter(r=>r.qty>0&&!['side','extra'].includes(r.zone)),source=main.find(r=>cardKey(r.name||r.card?.name)===cardKey(commander||seed))?.card,library=main.filter(r=>!commander||cardKey(r.name||r.card?.name)!==cardKey(commander)),groups=[],notes=[];
 for(const req of primaryInputRequirements(source)){
  const matches=library.flatMap(r=>{const e=req.match(r.card);return e?[{name:r.name||r.card.name,qty:r.qty,...e}]:[]}),printed=matches.filter(r=>r.kind==='printed-input'),providers=matches.filter(r=>r.kind!=='printed-input');
  const pairs=[];
  if(req.kind==='two-nonland-entries'){
   const spells=library.filter(r=>!isLand(r.card)&&/\b(?:Creature|Artifact|Enchantment|Planeswalker|Battle)\b/.test(type(r.card))).map(r=>({...r,cost:castingCost(r.card)})).filter(r=>r.cost!==null&&!!(front(r.card).mana_cost||r.card?.mana_cost)).sort((a,b)=>a.cost-b.cost||(a.name||'').localeCompare(b.name||''));
   if(commander&&castingCost(source)!==null&&spells.length)pairs.push({cards:[source.name,spells[0].name||spells[0].card.name],castingMana:castingCost(source)+spells[0].cost,availability:'command-zone plus library',requirements:['The commander itself supplies an entry only if cast/resolved this turn before the payoff check; commander tax, mana colors, access to the other spell, and attack readiness (including haste where required) remain conditional. The commander is not counted as a library draw.']});
   for(let i=0;i<spells.length&&pairs.length<3;i++)for(let j=i;j<spells.length&&pairs.length<3;j++){const a=spells[i],b=spells[j];if(i===j&&a.qty<2)continue;pairs.push({cards:[a.name||a.card.name,b.name||b.card.name],castingMana:a.cost+b.cost,requirements:['Two distinct copies must be available and resolve before the payoff check; colored mana, land sequencing, commander readiness, and opposing interaction are unmodeled.']});}
  }
  const flying=req.flyingDraw?library.filter(r=>subtype(r.card,'Vehicle')&&nativeFlying(r.card)).map(r=>({name:r.name||r.card.name,qty:r.qty})):[];
  const unknown=req.kind==='two-nonland-entries'&&library.some(r=>unresolvedEntryProvider(r.card))||library.some(r=>!r.card||!type(r.card))||req.kind==='two-nonland-entries'&&library.some(r=>!isLand(r.card)&&/\b(?:Creature|Artifact|Enchantment|Planeswalker|Battle)\b/.test(type(r.card))&&castingCost(r.card)===null);
  const missing=!matches.length&&!pairs.length&&!unknown,status=missing?'missing':unknown&&!matches.length&&!pairs.length?'unverified':req.flyingDraw&&!flying.length?'unverified':'conditional';
  groups.push({...baseEvidence(source,req.evidence),kind:req.kind,label:req.label,timing:req.timing,status,printedCopies:count(printed),providerCopies:count(providers),cards:matches,flyingDrawInputs:flying,castingPairs:pairs,summary:missing?'No identified eligible input/provider in the selected list.':unknown&&!matches.length&&!pairs.length?'Missing or unsupported card/activation data leaves input execution unverified.':req.kind==='two-nonland-entries'?`${count(providers)} single-card multiple-entry providers and ${pairs.length} displayed two-spell routes; actual precombat execution remains conditional.`:`${count(printed)} printed inputs and ${count(providers)} conditional token-producing sources.${req.flyingDraw?' '+count(flying)+' printed flying Vehicle inputs for the draw branch; nonflying Vehicles supply only the entry-counter branch on that entry.':''}`});
  notes.push(req.label+': '+groups.at(-1).summary+' '+req.timing+' This checks inputs, not a complete engine, combo, or win.');
 }
 return {status:!groups.length?'not-applicable':groups.some(g=>g.status==='missing')?'missing':groups.some(g=>g.status==='unverified')?'unverified':'conditional',groups,notes,issues:[]};
}
