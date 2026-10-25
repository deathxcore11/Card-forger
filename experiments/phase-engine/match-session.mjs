// Private research table controller. The authority owns every rules decision.
// No engine adoption, general card coverage or calibrated difficulty claim.
import {validInteractionText,validInteractionRelations} from './interaction-surface.mjs';
import {createPriorityScheduler} from './priority-scheduler.mjs';
export function createMatchSession({client,onChange=()=>{},newId=()=>crypto.randomUUID(),schedulerOptions={},maxCpuCommands=2000}={}){
 if(!client||typeof client.request!=='function'||typeof onChange!=='function'||!Number.isSafeInteger(maxCpuCommands)||maxCpuCommands<1||maxCpuCommands>20000)throw Error('BAD_SESSION_OPTIONS');
 let status=null,selected=null,pending=null,error=null,closed=false,busy=false,cpuCommands=0,clock=null;
 const snapshot=()=>structuredClone({status,selected,pending,error,busy,clock,cpuCommands});
 const publish=()=>{if(!closed)onChange(snapshot());};
 function accept(next){
  if(!Number.isSafeInteger(next?.revision)||!next.surface||!Array.isArray(next.surface.cards))throw Error('INVALID_MATCH_STATUS');
  if(status&&next.revision<status.revision)throw Error('STALE_MATCH_STATUS');
  if(status&&next.revision!==status.revision)pending=null;
  status=next;
  if(selected!==null&&!status.surface.cards.some(c=>c.id===selected&&c.known))selected=null;
  publish();
 }
 async function request(op,fields={}){
  const result=await client.request(op,fields);
  accept(result);return result;
 }
 // Serialized commands and stable IDs prevent double-clicks choosing twice.
 async function command(op,fields){
  if(closed||busy||(error&&error!=='CHOICE_REJECTED')||!status)throw Error('MATCH_NOT_READY');
  error=null;busy=true;timer.stop();publish();
  try{
   const result=await request(op,{...fields,id:newId(),revision:status.revision});
   if(result.rejected){error='CHOICE_REJECTED';publish();return;}
   await driveCpu();
  }catch(e){error='RECOVERY_REQUIRED';publish();}
  finally{busy=false;publish();if(!closed&&(!error||error==='CHOICE_REJECTED'))await timer.start();}
 }
 async function driveCpu(){
  // A human prompt, including an unsupported one, must never fall through to AI.
  while(!closed&&!status.terminal&&!status.surface.awaitingHuman&&!status.surface.canAct&&!status.surface.interaction?.canSubmit){
   if(status.surface.unavailableReason)break;
   if(cpuCommands>=maxCpuCommands){error='CPU_COMMAND_LIMIT';publish();break;}
   const before=status.revision;
   await request('step',{id:newId(),revision:before});cpuCommands++;
   if(status.revision!==before+1)throw Error('CPU_DID_NOT_ADVANCE');
   // Yield between accepted actions; rules/choice work stays in workers.
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 const timer=createPriorityScheduler({...schedulerOptions,
  request:async({op})=>{
   if(op==='status'){
    const next=await client.request('status');
    // A status already in flight may arrive after a player command. It cannot
    // replace that accepted revision or its deadline with an older projection.
    if(!closed&&next.revision>=status.revision)accept(next);
    return {revision:status.revision,clock:status.clock};
   }
   if(busy||closed||(error&&error!=='CHOICE_REJECTED'))return {revision:status.revision,clock:{state:'suspended'}};
   // Journal serializes this with any player action racing the expired deadline.
   busy=true;publish();
   try{const next=await request('tick',{id:newId(),revision:status.revision});await driveCpu();return {revision:status.revision,clock:status.clock};}
   finally{busy=false;publish();}
  },onStatus:value=>{clock=value;publish();},onError:()=>{error='RECOVERY_REQUIRED';publish();}
 });
 return {
  snapshot,
  async open({resume=false,seed=12345,first=0}={}){
   if(status||closed||busy)throw Error('ALREADY_OPEN');busy=true;publish();
   try{await request(resume?'resume':'create',resume?{}:{seed,first});await driveCpu();}
   catch(e){error='RECOVERY_REQUIRED';publish();}
   finally{busy=false;publish();if(status&&!error)await timer.start();}
   return snapshot();
  },
  inspect(id){if(!status?.surface.cards.some(c=>c.id===id&&c.known))return false;selected=id;publish();return true;},
  cast(instanceId,payment='auto'){return command('act',{command:{kind:'cast',instanceId,payment}});},
  concede(){return command('act',{command:{kind:'concede'}});},
  choose(token){if(!status?.surface.choices.some(c=>c.token===token))throw Error('STALE_CHOICE');return command('step',{choice:token});},
  select(interactionId,choiceId){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);
   if(!o||!['choose','select','sequence'].includes(o.type)||!o.choices.some(c=>c.id===choiceId&&c.available))throw Error('STALE_CHOICE');
   if(!pending||pending.interactionId!==interactionId)pending={interactionId,type:o.type,choiceIds:[],revision:status.revision};
   if(o.type==='choose')pending.choiceIds=[choiceId];
   else if(o.type==='sequence'){if(o.max===1)pending.choiceIds=[choiceId];else if(!o.unique||!pending.choiceIds.includes(choiceId))pending.choiceIds=[...pending.choiceIds,choiceId];}
   else pending.choiceIds=pending.choiceIds.includes(choiceId)?pending.choiceIds.filter(id=>id!==choiceId):[...pending.choiceIds,choiceId];
   publish();
  },
  toggleRelation(interactionId,sourceId,targetId){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);
   if(o?.type!=='relations')throw Error('STALE_CHOICE');
   let relations=pending?.interactionId===interactionId&&pending.revision===status.revision?[...pending.relations]:[];
   const found=relations.findIndex(r=>r.sourceId===sourceId&&r.targetId===targetId);
   if(found>=0)relations.splice(found,1);
   else{if(o.sourceConstraint==='atMostOne')relations=relations.filter(r=>r.sourceId!==sourceId);relations.push({sourceId,targetId,group:null});}
   if(!validInteractionRelations(o,relations,{complete:false}))throw Error('STALE_CHOICE');
   pending={interactionId,type:'relations',relations,revision:status.revision};publish();
  },
  setRelationGroup(interactionId,sourceId,group){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);
   if(o?.type!=='relations'||!o.allowGroups||pending?.interactionId!==interactionId||pending.revision!==status.revision||!pending.relations.some(r=>r.sourceId===sourceId))throw Error('STALE_CHOICE');
   const relations=pending.relations.map(r=>r.sourceId===sourceId?{...r,group}:r);
   if(!validInteractionRelations(o,relations,{complete:false}))throw Error('CHOICE_INCOMPLETE');
   pending={...pending,relations};publish();
  },
  setRelations(interactionId,relations){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);
   if(!o||o.type!=='relations')throw Error('STALE_CHOICE');
   if(!validInteractionRelations(o,relations,{complete:false}))throw Error('CHOICE_INCOMPLETE');
   pending={interactionId,type:'relations',relations:structuredClone(relations),revision:status.revision};publish();
  },
  setText(interactionId,value){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);
   if(!o||o.type!=='text')throw Error('STALE_CHOICE');
   if(!validInteractionText(value,o.maxLen))throw Error('CHOICE_INCOMPLETE');
   pending={interactionId,type:'text',value,revision:status.revision};publish();
  },
  setNumber(interactionId,value){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);
   if(!o||o.type!=='number')throw Error('STALE_CHOICE');
   if(!Number.isInteger(value)||value<o.min||value>o.max)throw Error('CHOICE_INCOMPLETE');
   pending={interactionId,type:'number',value,revision:status.revision};publish();
  },
  selectNone(interactionId){const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===interactionId);if(!o||['number','text'].includes(o.type)||o.min!==0)throw Error('CHOICE_REQUIRED');pending={interactionId,type:o.type,...(o.type==='relations'?{relations:[]}:{choiceIds:[]}),revision:status.revision};publish();},
  confirm(){
   const o=status?.surface.interaction?.opportunities.find(o=>o.interactionId===pending?.interactionId);
   if(!o||pending.revision!==status.revision)throw Error('CHOICE_INCOMPLETE');
   if(o.type==='relations'){
    if(!validInteractionRelations(o,pending.relations))throw Error('CHOICE_INCOMPLETE');
    return command('respond',{submission:{interactionId:o.interactionId,response:{type:'relations',data:{relations:pending.relations}}}});
   }
   if(o.type==='text'){
    if(!validInteractionText(pending.value,o.maxLen))throw Error('CHOICE_INCOMPLETE');
    return command('respond',{submission:{interactionId:o.interactionId,response:{type:'text',data:{value:pending.value}}}});
   }
   if(o.type==='number'){
    if(!Number.isInteger(pending.value)||pending.value<o.min||pending.value>o.max)throw Error('CHOICE_INCOMPLETE');
    return command('respond',{submission:{interactionId:o.interactionId,response:{type:'number',data:{value:pending.value}}}});
   }
   if(pending.choiceIds.length<o.min||pending.choiceIds.length>o.max)throw Error('CHOICE_INCOMPLETE');
   const response=o.type==='choose'?{type:'choose',data:{choiceId:pending.choiceIds[0]}}:{type:o.type,data:{choiceIds:pending.choiceIds}};
   return command('respond',{submission:{interactionId:o.interactionId,response}});
  },
  clearSelection(){pending=null;publish();}, // local draft only; never cancels a rules prompt
  async refresh(){if(closed||busy||error)return;busy=true;timer.stop();try{await request('status');await driveCpu();}catch{error='RECOVERY_REQUIRED';}finally{busy=false;publish();if(!error)await timer.start();}},
  close(){closed=true;timer.stop();client.close();}
 };
}
