// Admission is based on the verified database actually loaded by the worker.
// A compiled record is not a claim that every mechanic has acceptance coverage.
export function compiledCardSupport(catalog,identity){
 if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)||typeof identity!=='string'||!identity)throw Error('RULES_DATABASE_MISMATCH');
 const availableCardNames=[],unimplementedCardNames=[];
 const unimplemented=value=>value&&typeof value==='object'&&(value.type==='Unimplemented'||Object.values(value).some(unimplemented));
 for(const [key,record]of Object.entries(catalog)){
  if(typeof record?.name!=='string')throw Error('RULES_DATABASE_MISMATCH');
  // Printing-specific and meld-face aliases are not canonical deck names.
  if(key!==record.name.toLocaleLowerCase('en-US'))continue;
  (unimplemented(record)?unimplementedCardNames:availableCardNames).push(record.name);
 }
 return {availableCardNames,unimplementedCardNames,coverageVersion:'compiled-data:'+identity};
}
