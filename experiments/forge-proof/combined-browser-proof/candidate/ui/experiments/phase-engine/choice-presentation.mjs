// Display metadata for the current engine-issued choice. Never generates actions,
// changes indices, or decides legality. Input state is the acting seat's filtered
// snapshot; the returned object contains only labels for that exact live prompt.
const text=v=>typeof v==='string'&&v.trim()&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():null;
const index=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;
const values=(c,role)=>c.surfaces.filter(s=>s.type==='value'&&s.role===role).map(s=>s.value);
const action=c=>c.surfaces.find(s=>s.type==='action')?.code;
export const isInternalChoiceLabel=label=>/^(choose|select|mode|option|target)[A-Za-z ]*\s*[·:\-]\s*\d+(?:\s|$)/i.test(label||'');
function declineEntryEffect(state,sourceId){
 const pending=state.pending_replacement,p= pending?.proposed?.ZoneChange;
 if(pending?.is_optional!==true||pending.candidates?.length!==1||p?.to!=='Battlefield'||p.object_id!==sourceId)return null;
 const ref=pending.candidates[0],source=state.objects?.[sourceId];
 if(ref.source!==sourceId||source?.display_visible_to_viewer!==true)return null;
 const definition=source.replacement_definitions?.[ref.index],mode=definition?.mode,d=mode?.decline,e=d?.effect;
 if(mode?.type!=='MayCost'||e?.type!=='SetTapState'||e.target?.type!=='SelfRef'||e.state?.type!=='Tap'||d.sub_ability||d.else_ability||d.optional||d.condition)return null;
 return {label:'Enter tapped',cost:mode.cost};
}
export function presentInteractionChoices(projected,seat,{state,preview}={}){
 if(!projected.canSubmit||!state||state.viewer_projection!==seat)return projected;
 const w=state.waiting_for,d=w?.data;
 if(d?.player!==seat)return projected;
 return {...projected,opportunities:projected.opportunities.map(o=>{
  let immediate=false;
  const choices=o.choices.map(c=>{
   const code=action(c),indices=values(c,'optionIndex'),modeNames=values(c,'mode').map(text).filter(Boolean);
   let label=null,consequence='',clearConsequence=false,paymentUnapplied=false;
   if(code==='chooseReplacement'&&w.type==='ReplacementChoice'&&indices.length===1&&Number.isSafeInteger(d.candidate_count)&&d.candidate_count===d.candidates?.length){
    const i=index(indices[0]),candidate=i===null?null:d.candidates[i];
    if(candidate&&text(candidate.description)){
     label=text(candidate.description);consequence=text(candidate.source_name)||'';
     // OptionalBranch semantics and index order come from the pinned engine,
     // not from the fact that there happen to be two options.
     const optional=d.kind?.type==='OptionalBranch'&&d.candidate_count===2;
     if(optional&&i===1){const entry=declineEntryEffect(state,candidate.source_id);if(entry){label=entry.label;consequence=entry.cost?.type==='PayLife'?'No life paid':'No entry cost paid';clearConsequence=true;}else if(label==='Decline')label='Decline this effect';}
     if(optional&&i===0&&typeof preview==='function'){
      let result;try{result=preview({type:'ChooseReplacement',data:{index:i}});}catch{/* Keep native descriptions if a preview is unavailable. */}
      const changes=result?.status==='applied'?result.result?.life_deltas:null;
      if(Array.isArray(changes)){const delta=changes.filter(x=>x.player===seat).reduce((sum,x)=>sum+(Number.isSafeInteger(x.delta)?x.delta:NaN),0),life=state.players?.[seat]?.life;if(Number.isSafeInteger(delta)&&delta!==0&&Number.isSafeInteger(life)){consequence=`Your life: ${life} → ${life+delta}`;clearConsequence=life+delta>0&&!!declineEntryEffect(state,candidate.source_id);}}
     }
     if(optional&&i===0&&typeof preview==='function'){
      const entry=declineEntryEffect(state,candidate.source_id),cost=entry?.cost,life=state.players?.[seat]?.life;
      if(cost?.type==='PayLife'&&cost.amount?.type==='Fixed'&&Number.isSafeInteger(cost.amount.value)&&Number.isSafeInteger(life)&&life<cost.amount.value){
       let p;try{p=preview({type:'ChooseReplacement',data:{index:i}});}catch{}
       // The reducer may accept an optional-payment ATTEMPT and take its decline
       // branch when payment fails. Do not advertise that as a successful payment.
       // This is display eligibility, not a new legal-action/cost calculation.
       if(p?.status==='applied'&&Array.isArray(p.result?.life_deltas)&&p.result.life_deltas.every(x=>x.player!==seat||x.delta===0)&&p.result.zone_changes?.some(z=>z.object_id===candidate.source_id&&z.to==='Battlefield')){paymentUnapplied=true;consequence='Not enough life; the engine does not make this payment.';clearConsequence=false;}
      }
     }
     immediate=optional&&o.type==='choose'&&o.min===1&&o.max===1;
    }
   }else if(code==='chooseBranch'&&w.type==='ChooseOneOfBranch'&&indices.length===1){const i=index(indices[0]);label=i===null?null:text(d.branch_descriptions?.[i]);}
   else if(code==='selectModes'&&modeNames.length){label=modeNames.join(' / ');}
   // Numeric option selectors are meaningful only together with an authoritative
   // description. An unavailable description is not replaced by a plausible guess.
   const needsLabel=code==='chooseReplacement'||code==='chooseBranch'||code==='selectModes';
   if(label&&!isInternalChoiceLabel(label))return {...c,label,consequence,clearConsequence,...(paymentUnapplied?{available:false,paymentUnapplied:true}:{})};
   return needsLabel?{...c,label:null,consequence:'Choice details are unavailable.',presentationUnavailable:true}:c;
  });
  const complete=choices.every(c=>!c.available||!!c.label&&c.clearConsequence===true&&!c.presentationUnavailable);
  return {...o,choices,...(immediate&&complete?{commitOnSelect:true}:{}),...(w.type==='ReplacementChoice'?{prompt:d.kind?.type==='Order'?'Choose which replacement effect applies next':'Choose how this effect applies'}:{})};
 })};
}
