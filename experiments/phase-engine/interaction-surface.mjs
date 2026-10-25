// Human-only, engine-authored interaction projection. Never feed this to CPU.
// Supports exact choices, count-bounded selections and ordered target sequences.
// Other schemas remain unavailable; no AI candidate list supplies legality.
import {fail} from './protocol-fault.mjs';
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const token=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/[\u0000-\u001f\u007f]/.test(v);
const keys=(v,names)=>obj(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
export const validInteractionText=(value,maxLen)=>typeof value==='string'&&value.trim().length>0&&!/[\u0000-\u001f\u007f]/.test(value)&&value.isWellFormed()&&new TextEncoder().encode(value).length<=maxLen;
const uint=v=>Number.isInteger(v)&&v>=0&&v<=4294967295;
const relationList=v=>Array.isArray(v)&&v.length<=1024&&v.every(r=>keys(r,['sourceId','targetId','group'])&&token(r.sourceId)&&token(r.targetId)&&(r.group===null||uint(r.group)))&&new Set(v.map(r=>JSON.stringify([r.sourceId,r.targetId]))).size===v.length;
// Check published capability bounds only. Combat restrictions still belong to
// the engine, including menace, required attacks and extra blocking capacity.
export function validInteractionRelations(o,relations,{complete=true}={}){
 if(o?.type!=='relations'||!relationList(relations)||relations.length>o.max||complete&&relations.length<o.min)return false;
 const available=new Set(o.choices.filter(c=>c.available).map(c=>c.id));
 if(relations.some(r=>!available.has(r.sourceId)||!available.has(r.targetId)||!o.edges.some(e=>e.sourceId===r.sourceId&&e.targetIds.includes(r.targetId))||!o.allowGroups&&r.group!==null))return false;
 return o.sourceConstraint!=='atMostOne'||new Set(relations.map(r=>r.sourceId)).size===relations.length;
}
export function interactionSubmission(value){
 if(!keys(value,['interactionId','response'])||!token(value.interactionId)||!keys(value.response,['type','data']))fail('BAD_INTERACTION');
 const {type,data}=value.response;
 if(type==='relations'){
  if(!keys(data,['relations'])||!relationList(data.relations))fail('BAD_INTERACTION');
  return {interactionId:value.interactionId,response:{type,data:{relations:data.relations.map(r=>({...r}))}}};
 }
 if(type==='text'){
  if(!keys(data,['value'])||!validInteractionText(data.value,256))fail('BAD_INTERACTION');
  return {interactionId:value.interactionId,response:{type,data:{value:data.value}}};
 }
 if(type==='number'){
  if(!keys(data,['value'])||!Number.isInteger(data.value)||data.value<0||data.value>4294967295)fail('BAD_INTERACTION');
  return {interactionId:value.interactionId,response:{type,data:{value:data.value}}};
 }
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
  if(o.response?.type==='schema'&&spec?.type==='text'){
   const {maxLen,confirm,allowArbitrary}=spec.data||{};
   if(confirm!=='explicit'||allowArbitrary!==true||!Number.isInteger(maxLen)||maxLen<1||maxLen>256)continue;
   opportunities.push({interactionId:o.interactionId,type:'text',maxLen,choices:[]});continue;
  }
  if(o.response?.type==='schema'&&spec?.type==='number'){
   const {min,max,confirm}=spec.data||{};
   if(confirm!=='explicit'||!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min||max>4294967295)continue;
   opportunities.push({interactionId:o.interactionId,type:'number',min,max,choices:[]});continue;
  }
  const selection=o.response?.type==='schema'&&spec?.type==='select'&&spec.data?.constraint?.type==='count'&&spec.data?.confirm==='explicit';
  const sequence=o.response?.type==='schema'&&spec?.type==='sequence'&&spec.data?.confirm==='explicit';
  const relations=o.response?.type==='schema'&&spec?.type==='relations'&&spec.data?.confirm==='explicit';
  if(!exact&&!selection&&!sequence&&!relations)continue;
  const min=exact?1:sequence||relations?spec.data.min:spec.data.constraint.data?.min,max=exact?1:sequence||relations?spec.data.max:spec.data.constraint.data?.max;
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
  if(relations){
   const d=spec.data,ids=new Set(choices.map(c=>c.id));
   if(ids.size!==choices.length||!['atMostOne','engineValidated'].includes(d.sourceConstraint)||typeof d.allowGroups!=='boolean'||!Array.isArray(d.edges)||d.edges.length>1024)continue;
   const sources=new Set();let total=0;
   if(!d.edges.every(e=>{if(!obj(e)||!token(e.sourceId)||!ids.has(e.sourceId)||sources.has(e.sourceId)||!Array.isArray(e.targetIds)||e.targetIds.length>1024||e.targetIds.some(t=>!token(t)||!ids.has(t)||t===e.sourceId)||new Set(e.targetIds).size!==e.targetIds.length)return false;sources.add(e.sourceId);total+=e.targetIds.length;return total<=1024;}))continue;
   opportunities.push({interactionId:o.interactionId,type:'relations',min,max,sourceConstraint:d.sourceConstraint,allowGroups:d.allowGroups,edges:d.edges.map(e=>({sourceId:e.sourceId,targetIds:[...e.targetIds]})),choices});continue;
  }
  opportunities.push({interactionId:o.interactionId,type:exact?'choose':sequence?'sequence':'select',min,max,choices,...(sequence?{unique:spec.data.unique===true,escape:token(spec.data.escape)?spec.data.escape:null}:{})});
 }
 return {kind:token(raw.waitingForKind?.code)?raw.waitingForKind.code:null,canSubmit:canSubmit&&opportunities.length>0,opportunities};
}
