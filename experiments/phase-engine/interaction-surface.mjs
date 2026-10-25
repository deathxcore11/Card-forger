// Human-only, engine-authored interaction projection. Never feed this to CPU.
// Supports exact choices, count-bounded selections and ordered target sequences.
// Other schemas remain unavailable; no AI candidate list supplies legality.
import {fail} from './protocol-fault.mjs';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const token=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
const keys=(v,names)=>obj(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
export function interactionSubmission(value){
 if(!keys(value,['interactionId','response'])||!token(value.interactionId)||!keys(value.response,['type','data']))fail('BAD_INTERACTION');
 const {type,data}=value.response;
 if(type==='choose'){
  if(!keys(data,['choiceId'])||!token(data.choiceId))fail('BAD_INTERACTION');
  return {interactionId:value.interactionId,response:{type,data:{choiceId:data.choiceId}}};
 }
 if(type==='select'||type==='sequence'){
  if(!keys(data,['choiceIds'])||!Array.isArray(data.choiceIds)||data.choiceIds.length>1024||!data.choiceIds.every(token)||type==='select'&&new Set(data.choiceIds).size!==data.choiceIds.length)fail('BAD_INTERACTION');
  return {interactionId:value.interactionId,response:{type,data:{choiceIds:[...data.choiceIds]}}};
 }
 fail('UNSUPPORTED_INTERACTION');
}
export function projectInteraction(raw,seat){
 if(![0,1].includes(seat)||!obj(raw)||!Array.isArray(raw.opportunities)||raw.opportunities.length>1024)fail('INVALID_INTERACTION_VIEW');
 const canSubmit=raw.canSubmit===true&&raw.authorizedSubmitters?.includes(seat)===true;
 const opportunities=[];
 if(canSubmit)for(const o of raw.opportunities){
  if(!token(o?.interactionId))fail('INVALID_INTERACTION_VIEW');
  const exact=o.response?.type==='exactChoices',spec=o.response?.data?.spec;
  const selection=o.response?.type==='schema'&&spec?.type==='select'&&spec.data?.constraint?.type==='count'&&spec.data?.confirm==='explicit';
  const sequence=o.response?.type==='schema'&&spec?.type==='sequence'&&spec.data?.confirm==='explicit';
  if(!exact&&!selection&&!sequence)continue;
  const min=exact?1:sequence?spec.data.min:spec.data.constraint.data?.min,max=exact?1:sequence?spec.data.max:spec.data.constraint.data?.max;
  if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<0||max<min||max>1024)continue;
  const rows=exact?o.response.data.choices:o.response.data.candidates;
  if(!Array.isArray(rows)||rows.length>4096)continue;
  const choices=rows.map(c=>{
   if(!token(c?.id)||!Array.isArray(c.surfaces))fail('INVALID_INTERACTION_VIEW');
   const surfaces=c.surfaces.flatMap(s=>{
    if(s?.type==='object'&&obj(s.data)){
     const d=s.data;
     return [{type:'object',reference:token(d.reference)?d.reference:null,name:token(d.name)?d.name:null,zone:token(d.zone)?d.zone:null}];
    }
    if(s?.type==='player'&&[0,1].includes(s.data?.seat))return [{type:'player',seat:s.data.seat}];
    if(s?.type==='value'&&obj(s.data))return [{type:'value',role:token(s.data.role)?s.data.role:null,value:token(s.data.value)?s.data.value:null}];
    if(s?.type==='action'&&token(s.data?.code))return [{type:'action',code:s.data.code}];
    return [];
   });
   return {id:c.id,available:c.status?.type==='available',surfaces};
  });
  opportunities.push({interactionId:o.interactionId,type:exact?'choose':sequence?'sequence':'select',min,max,choices,...(sequence?{unique:spec.data.unique===true,escape:token(spec.data.escape)?spec.data.escape:null}:{})});
 }
 return {kind:token(raw.waitingForKind?.code)?raw.waitingForKind.code:null,canSubmit:canSubmit&&opportunities.length>0,opportunities};
}
