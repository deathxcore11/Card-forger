// Authority-side expansion of incomplete engine suggestions. Every added block
// must pass the engine's non-mutating legality check. Preview deltas are discarded.
export function cpuLegalCandidates(engine,seat,base,{maxCombinations=128}={}){
 if(!Number.isInteger(maxCombinations)||maxCombinations<1||maxCombinations>4096)throw Error('BAD_CPU_CANDIDATE_BUDGET');
 const actions=[...base],s=engine.get_filtered_game_state(seat)?.state,w=s?.waiting_for;
 if(s?.viewer_projection!==seat)throw Error('INVALID_CPU_VIEW');
 if(w?.type!=='DeclareBlockers'||w.data?.player!==seat||typeof engine.preview_action_js!=='function')return {actions,examined:0,added:0,truncated:false};
 const seen=new Set(actions.map(a=>JSON.stringify(a))),targets=w.data.valid_block_targets||{},ids=(w.data.valid_blocker_ids||[]).filter(id=>(w.data.block_capacities?.[id]??1)===1).sort((a,b)=>a-b);
 let examined=0,added=0,truncated=false;
 function walk(at,assignments){
  if(examined>=maxCombinations){truncated=true;return;}
  if(at<ids.length){const id=ids[at];walk(at+1,assignments);for(const target of targets[id]||[]){if(examined>=maxCombinations){truncated=true;break;}walk(at+1,[...assignments,[id,target]]);}return;}
  examined++;const action={type:'DeclareBlockers',data:{assignments}},key=JSON.stringify(action);if(seen.has(key))return;
  let valid=false;try{valid=engine.preview_action_js(seat,action)?.status==='applied';}catch{}
  if(valid){seen.add(key);actions.push(action);added++;}
 }
 // Complex multi-block-capacity creatures retain the original legal suggestions.
 if(ids.length<=12)walk(0,[]);else truncated=true;
 return {actions,examined,added,truncated};
}
