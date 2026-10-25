// Bounded exact-target checks. A missing optional tutor role does not erase a
// creature's body or independent abilities. Unrecognized search syntax is unknown.
const key=s=>String(s||'').normalize('NFKC').toLowerCase();
const type=c=>String(c?.type_line||c?.card_faces?.[0]?.type_line||'');
export function inspectTutorTargets(rows=[]){
 const library=rows.filter(r=>!['side','extra','commander','command'].includes(r.zone)),groups=[];
 for(const source of rows.filter(r=>!['side','extra'].includes(r.zone))){
  const c=source.card||source.c;if(!c)continue;const t=String(c.oracle_text||'');let eligible=null,label='';
  if(/search your library for a Plains, Island, Swamp, or Mountain card/i.test(t)){eligible=x=>/\bLand\b/.test(type(x))&&/\b(?:Plains|Island|Swamp|Mountain)\b/.test(type(x));label='Plains, Island, Swamp or Mountain land';}
  else if(/search your library for an? Equipment card/i.test(t)){eligible=x=>/\bEquipment\b/.test(type(x));label='Equipment card';}
  else if(/search your library for an? Goblin card/i.test(t)){eligible=x=>/\bGoblin\b/.test(type(x));label='Goblin card';}
  if(!eligible)continue;
  const targets=library.flatMap(r=>{const card=r.card||r.c,qty=Number(r.qty)-(key(r.name||card?.name)===key(source.name||c.name)?1:0);return qty>0&&card&&eligible(card)?[{name:r.name||card.name,qty}]:[];});
  const unknown=library.some(r=>!(r.card||r.c)||!type(r.card||r.c));
  const status=targets.length?'conditional':unknown?'unverified':'missing';
  groups.push({source:c.name,label,status,targets,independentUtility:/\b(?:Creature|Planeswalker)\b/.test(type(c))||!!t.replace(/(?:^|\n)Search your library[^.]*\.\s*/gi,'').trim(),note:status==='missing'?`${c.name}: no eligible ${label} remains in the library for its search role.`:`${c.name}: ${status==='unverified'?'target data incomplete':'an eligible target exists; drawing, casting and resolving the search remain conditional'}.`});
 }
 return {status:groups.some(g=>g.status==='missing')?'partial':groups.some(g=>g.status==='unverified')?'unverified':'checked',groups,missingCount:groups.filter(g=>g.status==='missing').length,issues:groups.filter(g=>g.status==='missing'&&!g.independentUtility).map(g=>g.note),notes:groups.map(g=>g.note)};
}
