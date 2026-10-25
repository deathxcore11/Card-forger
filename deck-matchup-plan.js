// Soft answer coverage against an explicitly supplied list. No simulation or
// claimed advantage: format, budget and the player's engine remain hard gates.
const text=c=>[c?.oracle_text,...(c?.card_faces||[]).map(f=>f.oracle_text)].filter(Boolean).join('\n');
export function opponentProfile(deck,lookup=()=>null){
 if(!deck)return null;
 const signals={graveyard:[],artifacts:[],enchantments:[],creatures:[]},unknown=[];
 for(const r of deck.cards||[]){const c=lookup(r.name);if(!c){unknown.push(r.name);continue;}const t=c.type_line||'',rules=text(c);
  if(/(?:from|in) your graveyard|\breanimate\b|\bdredge\b/i.test(rules))signals.graveyard.push(r.name);
  for(const [kind,pattern] of [['artifacts',/\bArtifact\b/],['enchantments',/\bEnchantment\b/],['creatures',/\bCreature\b/]])if(pattern.test(t))signals[kind].push(r.name);
 }
 return {version:'matchup-coverage-v1',name:deck.name||'Imported opponent',format:deck.format,signals,unknown,signature:JSON.stringify((deck.cards||[]).map(r=>[r.name,r.qty]).sort())};
}
export function matchupAnswerKinds(card,profile){
 if(!profile)return [];const t=text(card),out=[];
 if(profile.signals.graveyard.length&&!/exile [^.]*\b(?:from|in) your graveyard|exile your graveyard/i.test(t)&&/exile (?:all cards from |target (?:player'?s )?)?(?:all |each |an opponent'?s |a |target player'?s )?graveyards?|exile [^.]*cards? (?:from|in) [^.]*graveyards?/i.test(t))out.push('graveyard');
 for(const [kind,noun] of [['artifacts','artifact'],['enchantments','enchantment'],['creatures','creature']])if(profile.signals[kind].length&&t.split(/[.\n]/).some(clause=>!/(?:you control|from [^.]*graveyard|from [^.]*hand)/i.test(clause)&&new RegExp('(?:destroy|exile|return) (?:target|all|each) [^.]{0,100}\\b'+noun+'s?\\b','i').test(clause)))out.push(kind);
 return out;
}
export const matchupCardBoost=(card,profile)=>Math.min(4,matchupAnswerKinds(card,profile).length*2);
export function opponentDiscoveryQueries(profile){
 if(!profile)return [];
 const queries={graveyard:'o:exile o:graveyard',artifacts:'(o:destroy or o:exile) o:artifact',enchantments:'(o:destroy or o:exile) o:enchantment',creatures:'(o:destroy or o:exile) o:creature'};
 return Object.keys(queries).filter(k=>profile.signals[k]?.length).sort((a,b)=>(a==='graveyard'?-1:0)-(b==='graveyard'?-1:0)||profile.signals[b].length-profile.signals[a].length).slice(0,2).map(k=>queries[k]);
}
export function inspectMatchupPlan(rows,profile){
 if(!profile)return null;
 const answers=rows.filter(r=>r.zone!=='side'&&r.zone!=='extra').flatMap(r=>{const kinds=matchupAnswerKinds(r.card,profile);return kinds.length?[{name:r.name||r.card.name,qty:r.qty,kinds}]:[];});
 return {status:'unverified',opponent:profile.name,signals:profile.signals,answers,unknown:profile.unknown,note:'Text-based answer coverage against the supplied opponent. Casting, timing, protection, sideboarding and the opponent’s responses remain unverified; this is not a matchup win rate.'};
}
