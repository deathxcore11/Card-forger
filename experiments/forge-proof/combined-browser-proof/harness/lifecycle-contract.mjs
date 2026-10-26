// Metadata-only independent final gate for every actual browser allocation.
const SCOPE='LOCAL_TEST_NOT_DEPLOYABLE';
const digest=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const cid=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function lifecycleEvidence(providers,{imageId,expected}){
 if(!digest(imageId)||![1,2].includes(expected)||!Array.isArray(providers))throw Error('Invalid lifecycle contract');
 const allocations=providers.map(p=>p.evidence()).filter(e=>e.starts!==0||e.cleanup?.containerId).map(e=>{
  const c=e.cleanup??{};return {imageId:digest(e.imageId)?e.imageId:null,containerId:cid(c.containerId)?c.containerId:null,
   sameImage:e.imageId===imageId&&c.imageId===imageId,scope:SCOPE,starts:e.starts===1?1:0,destroys:e.destroys===1?1:0,
   confirmed:c.confirmed===true,removed:c.removed===true,privateInputRemoved:c.privateInputRemoved===true,
   forced:c.forced!==false,oomKilled:c.oomKilled!==false,status:c.status==='exited'?'exited':'unconfirmed',
   exitCode:Number.isSafeInteger(c.exitCode)&&c.exitCode>=0&&c.exitCode<=255?c.exitCode:null,running:e.running!==false};
 });
 const valid=a=>a.sameImage&&cid(a.containerId)&&a.starts===1&&a.destroys===1&&a.confirmed&&a.removed&&a.privateInputRemoved&&!a.forced&&!a.oomKilled&&!a.running&&a.status==='exited'&&a.exitCode===0;
 const confirmed=allocations.length===expected&&allocations.every(valid)&&new Set(allocations.map(a=>a.containerId)).size===expected;
 return {scope:SCOPE,imageId,allocations,confirmed,starts:allocations.reduce((n,a)=>n+a.starts,0),destroys:allocations.reduce((n,a)=>n+a.destroys,0)};
}
