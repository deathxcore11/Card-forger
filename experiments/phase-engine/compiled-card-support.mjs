// Admission is based on the verified database actually loaded by the worker.
// A compiled record is not a claim that every mechanic has acceptance coverage.
export function compiledCardSupport(catalog,identity){
 if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)||typeof identity!=='string'||!identity)throw Error('RULES_DATABASE_MISMATCH');
 const available=new Set(),incomplete=new Set(),groups=new Map();
 const unimplemented=value=>value&&typeof value==='object'&&(value.type==='Unimplemented'||Object.values(value).some(unimplemented));
 for(const [key,record]of Object.entries(catalog)){
  if(typeof record?.name!=='string')throw Error('RULES_DATABASE_MISMATCH');
  // Printing-specific and meld-face aliases are not canonical deck names.
  if(key!==record.name.toLocaleLowerCase('en-US'))continue;
  (unimplemented(record)?incomplete:available).add(record.name);
  if(typeof record.scryfall_oracle_id==='string'&&Number.isSafeInteger(record.face_index)&&['adventure','split','transform','modal_dfc','reversible_card'].includes(record.layout)){
   const group=groups.get(record.scryfall_oracle_id)||[];group.push(record);groups.set(record.scryfall_oracle_id,group);
  }
 }
 for(const group of groups.values()){
  group.sort((a,b)=>a.face_index-b.face_index);
  if(group.length<2||group.some((r,i)=>r.face_index!==i||r.layout!==group[0].layout))continue;
  const combined=group.map(r=>r.name).join(' // ');
  if(group.some(r=>incomplete.has(r.name))){for(const r of group){available.delete(r.name);incomplete.add(r.name);}incomplete.add(combined);}
  else available.add(combined);
 }
 return {availableCardNames:[...available],unimplementedCardNames:[...incomplete],coverageVersion:'compiled-data:'+identity};
}
