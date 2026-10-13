// Product identifiers come from MTGJSON, not guessed product names.
export function selectSetProduct(set){
 const products=(set?.sealedProduct||[]).filter(p=>/^\d{1,12}$/.test(String(p.identifiers?.tcgplayerProductId||'')));
 const rank=p=>/play booster.*(box|display)/i.test(p.name)?0:/draft booster.*(box|display)/i.test(p.name)?1:/booster.*(box|display)/i.test(p.name)?2:/booster/i.test(p.name)?3:4;
 return products.sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name))[0]||null;
}
let catalogPromise=null,catalogAt=0;
export async function magicSetArtwork(code,fetcher=fetch){
 if(!/^[a-z0-9]{2,8}$/i.test(code))return null;
 if(!catalogPromise||Date.now()-catalogAt>864e5){catalogAt=Date.now();catalogPromise=fetcher('https://mtgjson.com/api/v5/SetList.json',{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('Set catalogue unavailable');const data=await r.json();return new Map((data.data||[]).map(s=>[s.code.toLowerCase(),selectSetProduct(s)]));}).catch(e=>{catalogPromise=null;throw e;});}
 const product=(await catalogPromise).get(code.toLowerCase());
 return product?{url:`https://tcgplayer-cdn.tcgplayer.com/product/${product.identifiers.tcgplayerProductId}_200w.jpg`,name:product.name}:null;
}
