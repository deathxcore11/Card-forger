// Rules-worker sidecar. Exact source rows stay with original instance IDs.
// Copies/tokens without an initial deck instance receive no invented printing.
export function initialPresentation(input,trusted){
 const objects=Object.values(trusted?.state?.objects||{}).sort((a,b)=>a.id-b.id),result={};
 for(const [seat,label]of [[0,'player'],[1,'opponent']]){
  const rows=input.decks[label].cards,queues=new Map();
  for(const row of rows){const key=row.name.trim().toLocaleLowerCase('en-US'),q=queues.get(key)||[];for(let i=0;i<row.qty;i++)q.push(structuredClone(row));queues.set(key,q);}
  for(const o of objects.filter(o=>o.owner===seat)){
   const q=queues.get(o.name?.trim().toLocaleLowerCase('en-US'));if(!q?.length)throw Error('INSTANCE_SNAPSHOT_MISMATCH');
   result[o.id]={owner:seat,name:o.name,row:q.shift()};
  }
  if([...queues.values()].some(q=>q.length))throw Error('INSTANCE_SNAPSHOT_MISMATCH');
 }
 return result;
}
export function presentInstances(view,presentation){return {...view,cards:view.cards.map(c=>{
 const source=presentation[c.id];return c.known&&source?.owner===c.owner?{...c,printing:structuredClone(source.row),printedName:source.name}:c;
})};}
