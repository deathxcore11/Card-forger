// Same deliberately ungraded policy as phase-smoke.mjs, in a separate Worker.
// The packet is deliberately too small for contextual gameplay. No difficulty UI.
export function describeChoices(actions) {
 return actions.map(a=>({type:a.type,keep:a.type==='MulliganDecision'&&a.data?.choice?.type==='Keep',
  count:a.type==='DeclareAttackers'?(a.data?.attacks?.length||0):a.type==='DeclareBlockers'?(a.data?.assignments?.length||0):0}));
}
export function chooseSmoke(choices,rng) {
 if(!Array.isArray(choices)||!choices.length||choices.length>100000)throw Error('BAD_CHOICES');
 const score=a=>a.type==='MulliganDecision'?(a.keep?1000:-100):a.type==='PlayLand'?900:a.type==='CastSpell'?800:a.type==='DeclareAttackers'?500+a.count*20:a.type==='DeclareBlockers'?400+a.count*20:a.type==='PassPriority'?0:a.type==='ActivateAbility'?-50:a.type==='CancelCast'?-100:10;
 const scores=choices.map(score),best=Math.max(...scores),indices=scores.flatMap((s,i)=>s===best?[i]:[]);
 rng=(Math.imul(rng,1664525)+1013904223)>>>0;
 return {index:indices[rng%indices.length],rng};
}
if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope) {
 globalThis.onmessage=({data})=>{
  try {globalThis.postMessage({id:data.id,...chooseSmoke(data.choices,data.rng)});}
  catch {globalThis.postMessage({id:data?.id,error:'POLICY_FAILED'});}
 };
}
