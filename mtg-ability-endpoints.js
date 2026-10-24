// Bounded optional-ability endpoint evidence, not a game-state or tutor simulator.
// Missing support removes credit for this branch, never a card's other utility.
import {cardKey, commandZoneKeys} from './core.js';
import {mtgAuraTargetProfile} from './goldfish.js';
const front=c=>c?.card_faces?.[0]||c||{};
const type=c=>front(c).type_line||'';
const text=c=>front(c).oracle_text||'';
const subtype=(c,t)=>new RegExp('(?:^|[ —])'+t+'(?=$|[ /])','i').test(type(c));
const printedCard=c=>!!c&&c.layout!=='token'&&c.layout!=='double_faced_token'&&!/^Token\b/i.test(type(c));
const mv=c=>{const v=front(c).cmc??c?.cmc;return (typeof v==='number'||typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v.trim()))&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;};
const source=(c,evidence)=>({kind:'printed-oracle',name:c?.name||'',oracleId:c?.oracle_id||null,face:'front',oracleText:text(c),evidence});
const descriptor=(c,kind,label,evidence,extra={})=>({kind,label,source:source(c,evidence),controller:'self',parserConfidence:'bounded-pattern',coverage:'structural endpoint only',optional:true,...extra});
export function abilityEndpointRequirements(card){
 const t=text(card).replace(/\([^)]*\)/g,' ').trim(),out=[];
 const equipment=t.match(/(?:^|[,.:]\s*|\byou may\s+)search your library for an? Equipment card\b/i);
 if(equipment){
  const after=t.slice(equipment.index+equipment[0].length),recognized=/^\s*,\s*reveal it,\s*put it into your hand/i.test(after);
  out.push(descriptor(card,'equipment-library-search','Equipment search endpoint',equipment[0]+after.split('.')[0],{functionalEffect:'library-to-hand',zone:'library',timing:'When the printed search resolves',query:'t:equipment',endpointType:'Equipment',recognized,limitations:['An eligible card in the deck is only a potential library target; drawing it, searching successfully, and resolving the ability are not simulated.',...(!recognized?['Additional search qualifications are not recognized.']:[])]}));
 }
 const equipmentHand=t.match(/\byou may put an? Equipment card from your hand onto the battlefield\.?/i);
 if(equipmentHand)out.push(descriptor(card,'equipment-hand-put','Equipment deployment endpoint',equipmentHand[0],{functionalEffect:'hand-to-battlefield',zone:'hand',timing:'When the printed activation resolves',query:'t:equipment',endpointType:'Equipment',recognized:true,limitations:['A printed Equipment card in the list is only a possible hand endpoint; hand access, activation payment, tapping and resolution are not simulated.']}));
 const aura=t.match(/Whenever an Aura you control enters(?: the battlefield)?, if you cast it, you may search your library for an Aura card with mana value less than or equal to that Aura and with a different name than each Aura you control, put that card onto the battlefield attached to ([^.]+?), then shuffle\.?/i);
 if(aura){
  const recipient=cardKey(aura[1]),names=[card?.name,(card?.name||'').split(',')[0],'this creature','this card'].map(cardKey),recognized=names.includes(recipient);
  out.push(descriptor(card,'cast-aura-library-chain','Cast Aura / eligible attached Aura pair',aura[0],{functionalEffect:'library-to-attached-battlefield',zone:'library',timing:'After an Aura you cast enters under your control',query:'t:aura',endpointType:'Aura',recognized,attachmentRecipient:aura[1],limitations:['Requires casting the triggering Aura; creating a Role/Aura token does not supply that cast event.','The endpoint must have a different name from every Aura you control and mana value no greater than the triggering Aura.','Only a potential pair and printed attachment restrictions are checked; mana, existing Aura names, drawing/casting/resolution and all later board state remain conditional.',...(!recognized?['The named attachment recipient is not recognized as this source.']:[])]}));
 }
 const lesson=t.match(/When you next cast a Lesson spell this turn, copy it(?: and you may choose new targets for the copy)?\.?/i);
 if(lesson){
  const line=t.slice(0,lesson.index).split('\n').at(-1)||'',activation=line.replace(/^[^:—]+—\s*/,'').match(/^([^:]+):/),cost=activation?.[1]?.trim()||null;
  out.push(descriptor(card,'next-lesson-copy','Lesson-copy branch endpoint',lesson[0],{functionalEffect:'copy-next-spell',zone:'castable card access',timing:'The next Lesson cast this turn after setting up the printed delayed trigger',query:'t:lesson',endpointType:'Lesson',recognized:true,activationCost:cost,limitations:['A printed Lesson card is a possible spell to copy, not proof of access or paying its cost.',...(cost?['The preceding activation costs '+cost+'; paying it and casting the Lesson in the same turn are not simulated.']:['The setup/payment for the delayed trigger is not recognized.']),'Other branches, counters, combat abilities and the card body retain their separate utility.']}));
 }
 return out;
}
// Putting an Aura onto the battlefield attached does not target. Reuse only the
// shared enchant-type/controller parser; shroud/hexproof/ward are not blockers.
export function auraAttachmentEligibility(aura,host){
 if(!host||!type(host))return {status:'unknown',reason:'Attachment recipient type is missing.'};
 const p=mtgAuraTargetProfile(aura);
 if(!p.aura)return {status:'ineligible',reason:'Not a printed front-face Aura.'};
 if(p.status!=='supported')return {status:'unknown',reason:p.reason};
 if(p.control==='opponent')return {status:'ineligible',reason:'This Aura requires an opponent-controlled permanent, not this source.'};
 const ownType=type(host).split(/—| -- /)[0].toLowerCase(),has=t=>new RegExp('\\b'+t+'\\b').test(ownType);
 if(!p.terms.some(t=>(t.type==='permanent'||has(t.type))&&(!t.qualifier||(t.qualifier.startsWith('non')?!has(t.qualifier.slice(3)):has(t.qualifier)))))return {status:'ineligible',reason:'The source does not satisfy the printed enchant restriction.'};
 const h=text(host).replace(/\([^)]*\)/g,'');
 if(/(?:^|\n)this (?:creature|permanent) (?:can't|cannot) be enchanted\.?(?:\n|$)/i.test(h))return {status:'ineligible',reason:'The recipient cannot be enchanted.'};
 if(/protection from|can't be enchanted|cannot be enchanted/i.test(h))return {status:'unknown',reason:'Protection or conditional enchantment restrictions require state/rules not modeled here.'};
 return {status:'eligible',reason:'Printed enchant type/controller restrictions permit attachment; other board state is not simulated.'};
}
export function endpointCandidateMatches(requirement,candidate,{source:host,trigger}={}){
 if(!requirement?.recognized)return {status:'unknown',reason:'Endpoint qualifications are not recognized.'};
 if(!candidate?.name||!type(candidate))return {status:'unknown',reason:'Candidate card type is missing.'};
 if(!printedCard(candidate)||!subtype(candidate,requirement.endpointType))return {status:'ineligible',reason:'Not a printed '+requirement.endpointType+' card.'};
 if(requirement.kind!=='cast-aura-library-chain')return {status:'eligible'};
 if(!trigger?.name)return {status:'unknown',reason:'A distinct triggering cast Aura is required.'};
 if(!printedCard(trigger)||!subtype(trigger,'Aura'))return {status:'ineligible',reason:'Trigger must be a printed cast Aura, not a token maker.'};
 if(cardKey(candidate.name)===cardKey(trigger.name))return {status:'ineligible',reason:'Endpoint and triggering Aura have the same name.'};
 const targetMV=mv(candidate),triggerMV=mv(trigger);
 if(targetMV===null||triggerMV===null)return {status:'unknown',reason:'Aura mana value is missing.'};
 if(targetMV>triggerMV)return {status:'ineligible',reason:'Endpoint mana value exceeds the triggering Aura.'};
 return auraAttachmentEligibility(candidate,host);
}
export function inspectAbilityEndpoints(rows,{commander='',commanders=[],controlledAuraNames=[]}={}){
 const main=rows.filter(r=>!['side','extra','outside'].includes(r.zone)&&Number(r.qty)>0),commandKeys=commandZoneKeys({commander,commanders}),library=main.filter(r=>!commandKeys.has(cardKey(r.name||(r.card||r.c)?.name))),controlled=new Set(controlledAuraNames.map(cardKey)),groups=[];
 for(const row of main){const card=row.card||row.c;if(!card)continue;
  for(const requirement of abilityEndpointRequirements(card)){
   const candidates=[],unknown=[],pairs=[];
   if(requirement.kind==='cast-aura-library-chain'){
    const triggers=library.filter(r=>printedCard(r.card||r.c)&&subtype(r.card||r.c,'Aura'));
    for(const target of library){const c=target.card||target.c;if(controlled.has(cardKey(target.name||c?.name)))continue;
     let unresolved=false,found=false;
     for(const trigger of triggers){const t=trigger.card||trigger.c,result=endpointCandidateMatches(requirement,c,{source:card,trigger:t});
      if(result.status==='eligible'){found=true;pairs.push({trigger:t.name,endpoint:c.name,triggerManaValue:mv(t),endpointManaValue:mv(c)});}
      else if(result.status==='unknown')unresolved=true;
     }
     if(found)candidates.push(target);else if(unresolved||!c||!type(c))unknown.push(target);
    }
   }else for(const target of library){const result=endpointCandidateMatches(requirement,target.card||target.c,{source:card});if(result.status==='eligible')candidates.push(target);else if(result.status==='unknown')unknown.push(target);}
   const status=!requirement.recognized?'unverified':candidates.length?'conditional':unknown.length?'unverified':'unsupported';
   const sourceName=row.name||card.name,notes=[...requirement.limitations];
   if(status==='unsupported')notes.unshift('No eligible '+requirement.endpointType+' '+(requirement.kind==='cast-aura-library-chain'?'trigger/endpoint pair':'endpoint')+' is present in the checked non-command deck cards. Only this optional branch lacks support.');
   if(status==='unverified')notes.unshift('Unknown card data or unsupported restrictions prevent verifying this optional branch.');
   groups.push({...requirement,sourceName,sourceCopies:Number(row.qty),status,branchCredit:status==='unsupported'?'absent':status==='unverified'?'unverified':'conditional',eligibleCopies:candidates.reduce((n,r)=>n+Number(r.qty),0),cards:candidates.map(r=>({name:r.name||(r.card||r.c).name,qty:Number(r.qty)})),pairs,unknownCards:unknown.map(r=>r.name||(r.card||r.c)?.name||'Unresolved card'),notes});
  }
 }
 return {status:groups.some(g=>g.status==='unsupported')?'unsupported':groups.some(g=>g.status==='unverified')?'unverified':groups.length?'conditional':'not-applicable',groups,issues:[],notes:groups.flatMap(g=>g.notes.map(n=>g.sourceName+' — '+g.label+': '+n)),method:'Optional branch-level structural endpoints only. No legality failure, whole-card ban, whole-engine certification, or simulated payment/sequence is inferred.'};
}
