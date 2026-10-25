// Catalog legality supplements, never replaces, engine construction and coverage.
const key=n=>String(n||'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/\s*\/\/\s*/g,' // ').trim().toLowerCase();
export const catalogNameKey=key;
// Verified printing identity: Scryfall OM1/28, oracle
// c4485bf9-e7ff-48b5-a983-02900939ee9d has printed_name Detect Intrusion
// and canonical name Spider-Sense. Preserve source deck rows; normalize only
// the executable list. This is an exact alias, never a fuzzy substitution.
export const canonicalPlayName=name=>key(name)==='detect intrusion'?'Spider-Sense':name;
// Aliases are derived only from one provider record. Never match an arbitrary
// requested composite to a record that merely shares its first face.
export function catalogCardMatchesName(card,name){
 const names=[card?.name,card?.printed_name],faces=Array.isArray(card?.card_faces)?card.card_faces.map(face=>face?.name):[];
 if(Array.isArray(card?.card_faces))names.push(...card.card_faces.map(face=>face?.printed_name).filter(n=>typeof n==='string'&&n.trim()));
 names.push(...faces.filter(n=>typeof n==='string'&&n.trim()));
 if(faces.length>1&&faces.every(n=>typeof n==='string'&&n.trim()))names.push(faces.join(' // '));
 if(typeof card?.name==='string'&&card.name.includes('//'))names.push(...card.name.split(/\s*\/\/\s*/));
 return names.some(n=>typeof n==='string'&&key(n)===key(name));
}
export function catalogListKey(list,format){return JSON.stringify([format,...['main_deck','sideboard','commander'].map(zone=>list[zone].map(key).sort())]);}
export function evaluateCatalogAdmission(list,format,review,{now=Date.now(),maxAgeMs=86400000}={}){
 const reasons=[];
 if(review?.schema!==1||review.format!==format||review.listKey!==catalogListKey(list,format))return {admitted:false,reasons:['Catalog review does not match this exact deck version.']};
 if(!Number.isSafeInteger(review.checkedAt)||review.checkedAt>now||now-review.checkedAt>maxAgeMs)reasons.push('Catalog legality needs a fresh check.');
 const names=[...new Set([...list.main_deck,...list.sideboard,...list.commander].map(key))],cards=review.cards;
 if(!Array.isArray(cards)||cards.length!==names.length||new Set(cards.map(c=>key(c?.name))).size!==names.length)return {admitted:false,reasons:[...reasons,'Catalog review is incomplete.']};
 for(const name of names){const c=cards.find(c=>key(c?.name)===name);
  if(!c||typeof c.oracleId!=='string'||!c.oracleId)reasons.push(name+': card identity could not be resolved for '+format+'.');
  else if(!c.legality||c.legality==='unknown')reasons.push(name+': '+format+' legality metadata is unavailable.');
  else if(c.legality!=='legal')reasons.push(name+': '+c.legality+' in '+format+'.');
 }
 return {admitted:reasons.length===0,reasons};
}
