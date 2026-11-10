// Entrances by importance (table additions 3, the app's rule): chosen from facts Forge already gives, never a judgement.
//  0 ordinary: commons, uncommons, tokens, lands, anything with no rarity on record.
//  1 rare or mythic permanent; also a commander's second arrival in a match.
//  2 a commander entering from the command zone for the first time in the match.
// `seen` is the set of commanders that already had their big entrance this match.
export const entranceLevel=({card,prev,rarity,seen=new Set()})=>{
 if(!card?.known||card.isToken||card.types?.includes('Land'))return 0;
 if(card.commander&&prev?.zone==='Command'){if(seen.has(card.id))return 1;return 2;}
 return /^(rare|mythic)$/i.test(String(rarity||''))?1:0;
};
// Timings in ms: the level 1 drop, the level 2 flight (dim, centre, hold, slam).
export const ENTER={l1:{travel:380,hold:140,drop:130},l2:{dim:250,fly:520,sweep:800,name:420,hold:1050,slam:150,stop:110}};
