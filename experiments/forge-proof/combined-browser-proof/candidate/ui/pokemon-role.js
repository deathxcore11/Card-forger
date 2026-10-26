// Tactical evidence comes from the exact printing, never a protected name list.
export function pokemonRole(c){
 if(!c||c.category!=='Pokemon')return null;
 const prize=Number(c.prize)||(/\b(?:ex|EX|GX|V|VSTAR)\b/.test(c.name||'')?2:1);
 const attacks=(c.attacks||[]).flatMap(a=>{
  const text=String(a.effect||''),targets=[...text.matchAll(/Pok[eé]mon\s+(ex|EX|GX|VMAX|VSTAR|V)\b/g)].map(m=>m[1]);
  const base=/^\d+\+?$/.test(String(a.damage))?parseInt(a.damage,10):null,bonus=text.match(/does (\d+) more damage/i)?.[1];
  return targets.length&&Array.isArray(a.cost)&&a.cost.length<=1?[{name:a.name,cost:a.cost,targets:[...new Set(targets)],base,conditionalDamage:base!==null&&bonus?base+Number(bonus):null,effect:text}]:[];
 });
 return attacks.length?{kind:'matchup-attacker',prize,basic:c.stage==='Basic',attacks}:null;
}
export function roleFromRecord(c){try{return pokemonRole({...JSON.parse(c.details||'{}'),name:c.name,category:'Pokemon'});}catch{return null;}}
export function matchupCutIsExplained(card,swap,evidence){
 const role=roleFromRecord(card);if(card.qty!==1||role?.prize!==1)return true;
 const notes=`${swap.loss||''} ${swap.lost||''}`;
 return evidence.some(e=>e.cardId===card.id)&&/\b(?:prize|energy)\b/i.test(notes)&&role.attacks.some(a=>a.targets.some(t=>new RegExp('\\b'+t+'\\b').test(notes)));
}
