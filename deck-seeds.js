// The cards a deck is built around: the featured card first, then any other required cards. An empty or
// missing list means "just the featured card" (an empty array is truthy, so `list||[seed]` lost the seed and
// Pokémon lines / Yu-Gi-Oh! archetypes were built with no anchor). A required card without an identity is an
// error, never silently dropped.
export function normalizeSeeds(seed,list){
 const key=c=>c?.id!=null&&c.id!==''?'id:'+c.id:'';
 const given=(Array.isArray(list)?list:[]).filter(c=>c!=null);
 const unresolved=given.filter(c=>!key(c));
 if(unresolved.length)throw Error(`Could not verify the required card${unresolved.length>1?'s':''} ${unresolved.map(c=>c.name||'(unnamed)').join(', ')}. Choose ${unresolved.length>1?'them':'it'} again.`);
 if(!key(seed))return given;
 const rest=given.filter(c=>key(c)!==key(seed));
 return [seed,...rest];
}
