// Reads a printed set code and collector number typed in either order, the way they appear on the card:
//   Magic     "0323 trk", "trk 0323", "TRK-323", "L 0323 TRK • EN"
//   Pokémon   "pal 45", "45 pal", "sv02 045", "045/193", "PAL 045/193"
//   Yu-Gi-Oh! "BLZD-EN010", "blzd en010", "blzd 10", "en010 blzd", "LOB-001"
// Returns null for anything that is not a code and a number, so ordinary name searches are untouched.
const LANGUAGE=/^(?:en|eng|english)$/;
const RARITY_LETTER=/^[cumrlspt]$/;
const words=raw=>String(raw||'').toLowerCase().replace(/[•·#,]/g,' ').split(/[\s-]+/).filter(Boolean);
const hasLetter=t=>/[a-z]/.test(t),hasDigit=t=>/\d/.test(t);
// A collector number: digits with an optional letter before or after (12a, s12, 323★).
const isNumber=t=>/^[a-z]?\d+[a-z★]?$/.test(t);
const trimZeros=n=>n.replace(/^0+(?=\d)/,'');

export function parseCollectorQuery(game,raw){
 if(/[:<>="]/.test(String(raw||'')))return null;
 let t=words(raw).filter(w=>!LANGUAGE.test(w));
 if(game==='ptcg'){
  // "045/193": number and printed set size, with or without a set code.
  const frac=t.find(w=>/^\d+\/\d+$/.test(w));
  if(frac){const [n,total]=frac.split('/'),rest=t.filter(w=>w!==frac);if(rest.length>1)return null;
   if(rest.length===1&&!(hasLetter(rest[0])&&/^[a-z0-9.]{2,8}$/.test(rest[0])))return null;
   return {set:rest[0]||'',number:trimZeros(n),total:Number(total)};}
 }
 if(game==='ygo'){
  // "BLZD-EN010" / "blzd en010": a set prefix and a region-lettered number.
  if(t.length===1){const m=t[0].match(/^([a-z0-9]{2,5})((?:en|e|eu|na)?\d{2,3})$/);if(m&&hasLetter(m[1]))t=[m[1],m[2]];}
  if(t.length!==2)return null;
  // Of two code-like words, the one that is mostly digits is the number.
  const [a,b]=t,score=w=>(w.match(/\d/g)||[]).length-(w.match(/[a-z]/g)||[]).length,number=score(a)>=score(b)?a:b,code=number===a?b:a;
  if(!/^(?:[a-z]{1,2})?\d{1,3}$/.test(number)||!/^[a-z0-9]{2,5}$/.test(code)||!hasLetter(code))return null;
  const region=number.match(/^[a-z]+/)?.[0]||'',digits=number.slice(region.length);
  return {set:code.toUpperCase(),region:region.toUpperCase(),number:digits};
 }
 // Magic and Pokémon: drop a lone rarity letter printed before the number ("L 0323 TRK").
 if(t.length===3){const i=t.findIndex(w=>RARITY_LETTER.test(w));if(i>=0)t=t.filter((_,k)=>k!==i);}
 if(t.length!==2)return null;
 const [a,b]=t,aNum=isNumber(a)&&/^\d/.test(a),bNum=isNumber(b)&&/^\d/.test(b);
 // The number starts with a digit; the set code has a letter. "m21 123" reads as set m21, number 123.
 const number=aNum&&!bNum?a:bNum&&!aNum?b:aNum&&bNum?(hasLetter(a)?b:a):null;
 if(!number)return null;
 const set=number===a?b:a;
 if(!hasLetter(set)||!(game==='ptcg'?/^[a-z0-9.]{2,8}$/:/^[a-z0-9]{2,6}$/).test(set))return null;
 return {set,number:trimZeros(number)};
}
// Yu-Gi-Oh! printed codes to look up, most likely first ("blzd 10" may be BLZD-EN010 or an old BLZD-010).
export function ygoCodeCandidates({set,region,number}){
 const n=String(number).padStart(3,'0');
 return region?[`${set}-${region}${n}`]:[`${set}-EN${n}`,`${set}-${n}`];
}
