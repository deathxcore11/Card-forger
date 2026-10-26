// TCGCSV listing statistics span conditions. They are a reference, never an LP/MP quote.
const positive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
export function referenceQuote(q={}){
 for(const [field,kind] of [['marketPrice','market'],['market','market'],['midPrice','mid'],['mid','mid'],['lowPrice','low'],['low','low']]){
  const value=positive(q[field]);if(value!==null)return {value,kind};
 }
 return null;
}
export const referenceLabel=kind=>kind==='mid'?'Median listing estimate':kind==='low'?'Lowest listing estimate':'Market reference';
