// Authority-side public search. Only engine-preview-validated additions escape.
import {makeCpuObservation} from './cpu-public-observation.mjs';
import {searchBlockAssignments} from './cpu-block-search.mjs';
export function cpuLegalCandidates(engine,seat,base,{maxCombinations=128,maxPreviews=4,maxMs=120,now=()=>performance.now(),cancelled=()=>false}={}){
 if(!Number.isInteger(maxCombinations)||maxCombinations<1||maxCombinations>4096||!Number.isInteger(maxPreviews)||maxPreviews<1||maxPreviews>32||!Number.isFinite(maxMs)||maxMs<0)throw Error('BAD_CPU_CANDIDATE_BUDGET');
 const start=now(),actions=[...base],envelope=engine.get_filtered_game_state(seat),s=envelope?.state,w=s?.waiting_for;
 if(s?.viewer_projection!==seat)throw Error('INVALID_CPU_VIEW');
 if(w?.type!=='DeclareBlockers'||w.data?.player!==seat||typeof engine.preview_action_js!=='function')return {actions,examined:0,added:0,truncated:false};
 const objects=[...(s.battlefield||[])].map(id=>s.objects[id]).filter(Boolean).sort((a,b)=>a.id-b.id),indices=new Map(objects.map((o,i)=>[o.id,i]));
 const eligible=(w.data.valid_blocker_ids||[]).filter(id=>(w.data.block_capacities?.[id]??1)===1).map(id=>indices.get(id)).filter(i=>i!==undefined);
 const combat=makeCpuObservation(envelope,seat,[]).combat;
 const search=searchBlockAssignments(combat,{maxEvaluations:Math.min(maxCombinations,96),now,cancelled,eligibleBlockers:eligible});
 const key=a=>JSON.stringify([...(a.data?.assignments||[])].map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
 const seen=new Set(base.filter(a=>a.type==='DeclareBlockers').map(key));let examined=0,added=0,truncated=search.truncated;
 for(const row of search.candidates){
  const action={type:'DeclareBlockers',data:{assignments:row.assignments.map(([b,a])=>[objects[b].id,objects[a].id])}},k=key(action);if(seen.has(k))continue;
  if(examined>=maxPreviews||now()-start>=maxMs||cancelled()){truncated=true;break;}
  examined++;let valid=false;try{valid=engine.preview_action_js(seat,action)?.status==='applied';}catch{}
  // A synchronous engine call cannot be preempted. Check time before the next.
  if(valid){seen.add(k);actions.push(action);added++;}
 }
 return {actions,examined,added,truncated,search:{nodes:search.nodes,evaluations:search.evaluations,elapsedMs:search.elapsedMs},elapsedMs:now()-start};
}
