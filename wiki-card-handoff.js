// Wiki card references use the app's existing card/search surfaces. A printed
// Scryfall URL is an identity (set + collector + language), never a fuzzy name.
const LANGUAGES=new Set(['en','es','fr','de','it','pt','ja','ko','ru','zhs','zht','he','la','grc','ar','sa','ph']);
const control=/[\u0000-\u001f\u007f]/;
const printingTarget=({set,number,lang='en'}={})=>typeof set==='string'&&/^[a-z0-9]{2,8}$/i.test(set)&&typeof number==='string'&&/^[a-z0-9][a-z0-9★☆†‡-]{0,23}$/i.test(number)&&LANGUAGES.has(lang)?{set:set.toLowerCase(),number,lang}:null;
export function parseWikiCardLink(value,game='mtg'){
 if(game!=='mtg'||typeof value!=='string'||value.length>3000||control.test(value)||value.includes('\\'))return null;
 try{
  const url=new URL(value);if(url.origin!=='https://scryfall.com'||url.username||url.password)return null;
  if(url.pathname==='/search'){
   if(url.searchParams.getAll('q').length!==1)return null;
   const query=(url.searchParams.get('q')||'').trim();if(!query||query.length>300||control.test(query))return null;
   const printed=query.match(/^!"([^"<>]{1,180})"\s+set:([a-z0-9]{2,8})\s+cn:"([a-z0-9★☆†‡-]{1,24})"$/i);
   if(printed){const target=printingTarget({set:printed[2],number:printed[3]});if(target)return {kind:'printing',...target};}
   const exact=query.match(/^!"([^"<>]{1,180})"(?:\s+set:[a-z0-9]{2,8})?$/i);
   return exact?{kind:'card',name:exact[1]}:{kind:'search',query};
  }
  const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if(parts[0]!=='card'||parts.length<3||parts.length>5)return null;
  const target=printingTarget({set:parts[1],number:parts[2],lang:parts.length===5?parts[3]:'en'});
  return target?{kind:'printing',...target}:null;
 }catch{return null;}
}
export function createWikiCardHandoff({lookup,openCard,scope=()=>()=>true,notify=()=>{}}={}){
 return {async open(input){
  const target=printingTarget(input);if(!target)return {status:'unsupported'};
  const live=scope();
  try{
   const card=await lookup('/cards/'+encodeURIComponent(target.set)+'/'+encodeURIComponent(target.number)+'/'+encodeURIComponent(target.lang));
   if(live?.()===false)return {status:'cancelled'};
   if(!card||typeof card.id!=='string'||!card.id||typeof card.name!=='string'||!card.name.trim()||card.name.length>300||card.set?.toLowerCase()!==target.set||String(card.collector_number)!==target.number||card.lang!==target.lang)throw Error('The linked printing could not be matched.');
   await openCard({...card,full:true});return {status:'opened',printingId:card.id};
  }catch(error){if(live?.()===false)return {status:'cancelled'};notify(error?.message||'The linked card could not be opened.');return {status:'unavailable'};}
 }};
}
