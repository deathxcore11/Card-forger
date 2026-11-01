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
// Booster pack artwork for the pack opener: the set's single booster pack product on TCGplayer
// (via tcgcsv's public catalogue), never a box, bundle, sleeved pack or other sealed product.
const PACK_CATEGORY={mtg:1,ygo:2,ptcg:3},packKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function selectPackProduct(products,setName){
 // Exclusions read only the words after the set's own name ("Rarity Collection" is a set, not a boxed collection).
 const key=packKey(setName),own=new RegExp('^'+String(setName||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),extra=p=>String(p.name).replace(own,'');
 const packs=(products||[]).filter(p=>/booster pack/i.test(p.name)&&!/box|display|case|bundle|blister|sleeved|lot|code card|collection|tin|deck|art set/i.test(extra(p))&&/^https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+_/.test(p.imageUrl||''));
 const rank=p=>packKey(p.name)===key+'boosterpack'?0:/play booster pack/i.test(p.name)?1:/draft booster pack/i.test(p.name)?2:/1st edition/i.test(p.name)?3:/set booster pack/i.test(p.name)?4:/collector/i.test(p.name)?6:5;
 return packs.sort((a,b)=>rank(a)-rank(b)||a.name.length-b.name.length)[0]||null;
}
export function selectPackGroup(groups,{code='',name=''}={},game=''){
 const key=packKey(name),abbr=String(code).toLowerCase();
 const hits=(groups||[]).filter(g=>game==='mtg'&&abbr&&String(g.abbreviation||'').toLowerCase()===abbr||key&&(packKey(g.name)===key||packKey(g.name).endsWith(key)));
 return hits.sort((a,b)=>(packKey(a.name)===key?0:1)-(packKey(b.name)===key?0:1)||a.name.length-b.name.length)[0]||null;
}
const packGroups=new Map();
export async function packArtwork(game,set,fetcher=fetch){
 const cat=PACK_CATEGORY[game];if(!cat)return null;
 const get=u=>fetcher(u,{headers:{'User-Agent':'CardStashy/3.89 (booster pack artwork)',Accept:'application/json'},signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Pack catalogue unavailable');return r.json();});
 const memo=packGroups.get(cat);if(!memo||Date.now()-memo.at>864e5)packGroups.set(cat,{at:Date.now(),groups:get(`https://tcgcsv.com/tcgplayer/${cat}/groups`).then(d=>d.results||[]).catch(e=>{packGroups.delete(cat);throw e;})});
 const group=selectPackGroup(await packGroups.get(cat).groups,set,game);if(!group)return null;
 const product=selectPackProduct((await get(`https://tcgcsv.com/tcgplayer/${cat}/${group.groupId}/products`)).results,set.name||group.name);
 return product?{url:product.imageUrl.replace(/_\d+w\.jpg$/,'_400w.jpg'),name:product.name}:null;
}
// When TCGplayer has no single booster pack: the set's own product shot. Yu-Gi-Oh! sets carry one on
// YGOPRODeck (its set list names the code), Magic falls back to MTGJSON's booster box.
let ygoSetsPromise=null,ygoSetsAt=0;
const ygoKey=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export async function packArtFallbacks(game,{code='',name=''}={},fetcher=fetch){
 const urls=[];
 if(game==='ygo'){
  try{
   if(!ygoSetsPromise||Date.now()-ygoSetsAt>864e5){ygoSetsAt=Date.now();ygoSetsPromise=fetcher('https://db.ygoprodeck.com/api/v7/cardsets.php',{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Set list unavailable');return r.json();}).catch(e=>{ygoSetsPromise=null;throw e;});}
   const sets=await ygoSetsPromise,key=ygoKey(name),hit=(Array.isArray(sets)?sets:[]).find(s=>key&&ygoKey(s.set_name)===key)||(Array.isArray(sets)?sets:[]).find(s=>code&&String(s.set_code).toLowerCase()===code.toLowerCase());
   if(/^https:\/\/images\.ygoprodeck\.com\/images\/sets\/[A-Za-z0-9_-]+\.jpg$/.test(hit?.set_image||''))urls.push(hit.set_image);
   else if(hit?.set_code&&/^[A-Za-z0-9]{2,8}$/.test(hit.set_code))urls.push(`https://images.ygoprodeck.com/images/sets/${hit.set_code}.jpg`);
  }catch{}
  if(!urls.length&&/^[a-z0-9]{2,8}$/i.test(code))urls.push(`https://images.ygoprodeck.com/images/sets/${code.toUpperCase()}.jpg`);
 }
 if(game==='mtg'&&code){try{const art=await magicSetArtwork(code,fetcher);if(art)urls.push(art.url);}catch{}}
 return urls;
}
