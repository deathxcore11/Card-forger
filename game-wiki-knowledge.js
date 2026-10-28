// Game-scoped original reminders and community reading links. These records are
// not article imports or live retrieval results. The online reader must attach
// its own fetched source evidence, and official game rules remain authoritative.
import {MTG_CONCEPTS,resolveMtgConcept,searchMtgConcepts,readMtgConceptMentions,buildMtgWikiReference} from './mtg-wiki-knowledge.js';
import {wikiSourceForGame,isAllowedWikiUrl} from './wiki-sources.js';
import {PTCG_GLOSSARY,YGO_GLOSSARY,GLOSSARY_REVIEWED_ON} from './game-glossary-data.js';
import {KEYWORD_REFERENCE,KEYWORD_SOURCE} from './mtg-keyword-reference.js';
const copy=v=>structuredClone(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const key=v=>String(v||'').normalize('NFKC').replace(/[’]/g,"'").trim().toLowerCase().replace(/\s+/g,' ');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const make=(game,id,label,kind,aliases,summary,prerequisites,page,{verified=false}={})=>{
 const source=wikiSourceForGame(game),url=source.articlePrefix+page;
 return {game,id,label,kind,aliases:[label,...aliases],summary,prerequisites,source:{title:label,publisher:source.name,authority:'community-reference',url,reviewedOn:'2026-10-23',retrievedOn:verified?'2026-10-23':null,pageVerified:verified},sourceAuthority:'community-reference',sourceStatus:'curated',readOnly:true,official:false,builderCoverage:{status:'reference-only',mechanicId:null,summary:'An original reminder and reading link, not automatic proof of card legality, a complete deck strategy or a particular interaction.'}};
};
const LOCAL=freeze({
 ptcg:[
  make('ptcg','damage','Damage','tcg-rules-concept',['attack damage'],'Damage reduces a Pokémon’s remaining HP and is normally recorded with damage counters. An attack’s damage calculation follows its exact text, Weakness, Resistance and relevant effects.',['Use the paper Pokémon TCG rules and the exact card, not the video-game damage formula.','Placing damage counters through an effect is different from dealing attack damage.'],'Appendix%3AGlossary_%28TCG%29',{verified:true}),
  make('ptcg','damage-counters','Damage counters','tcg-rules-concept',['damage counter'],'Each damage counter represents 10 damage on a Pokémon. An effect that places counters is not automatically an attack-damage event.',['Read whether a card deals damage or places counters.','Weakness and Resistance do not ordinarily modify the number of counters an effect tells you to place.'],'Appendix%3AGlossary_%28TCG%29',{verified:true}),
  make('ptcg','stage-1','Stage 1','tcg-rules-concept',['stage1','stage 1 pokémon','stage 1 pokemon'],'A Stage 1 card normally evolves from the Basic Pokémon named in its Evolves from field. Evolution timing and the named prior stage both matter.',['Normally wait until a later turn after the Pokémon enters play.','An effect changing evolution must explicitly permit the alternative procedure.'],'Stage_1_Pok%C3%A9mon_%28TCG%29',{verified:true}),
  make('ptcg','stage-2','Stage 2','tcg-rules-concept',['stage2','stage 2 pokémon','stage 2 pokemon'],'A Stage 2 card normally evolves from the named Stage 1 Pokémon. It does not normally evolve directly from an unrelated Basic Pokémon.',['Read the printed Evolves from field.','Special evolution effects have their own conditions and do not remove every timing restriction by default.'],'Stage_2_Pok%C3%A9mon_%28TCG%29'),
  make('ptcg','energy','Energy','tcg-rules-concept',['energy card','energy cards','basic energy','special energy'],'Attached Energy pays attack requirements according to its type and effect. A player normally attaches one Energy card from hand during their turn.',['Card effects can permit additional attachments or change what Energy provides.','Energy costs are not the same as video-game move PP or type effectiveness.'],'Energy_card_%28TCG%29',{verified:true}),
  make('ptcg','special-conditions','Special Conditions','tcg-rules-concept',['special condition','asleep','burned','confused','paralyzed','poisoned'],'The paper TCG has Asleep, Burned, Confused, Paralyzed and Poisoned. Their effects and Pokémon Checkup procedures differ from core video-game status rules.',['Use the exact TCG condition and any card-specific modifiers.','Moving to the Bench or evolving normally removes Special Conditions; an ordinary effect-removal instruction is not automatically the same action.'],'Special_Condition_%28TCG%29',{verified:true})
 ],
 ygo:[
  make('ygo','zombie','Zombie','monster-type',['zombies','zombie type'],'Zombie is a printed monster Type. The Type of each card is distinct from its Attribute, archetype, visual theme and any effect that changes its Type.',['Use the actual card’s current Type for effects requiring Zombies.','A shared horror or folklore theme alone does not establish a Zombie Type or a working engine.'],'Zombie'),
  make('ygo','yokai','Yokai','background-topic',['yōkai','youkai','yo-kai'],'Yokai is a folklore or community grouping in this reference. Its label does not replace an individual card’s printed monster Type or establish an official archetype by itself.',['Inspect the actual Type, Attribute, name and effects of each card.','Background classification cannot prove that a card satisfies a Type or archetype requirement.'],'Yokai'),
  make('ygo','synchro-summon','Synchro Summon','summoning-procedure',['synchro','synchro summoning'],'A Synchro Summon normally uses a Tuner and the required non-Tuner monsters whose Levels total the Synchro Monster’s Level. The card states its exact materials.',['Confirm the required materials and their current Levels.','Alternate procedures and material restrictions must be explicitly supported by the relevant card text.'],'Synchro_Summon'),
  make('ygo','chain','Chain','tcg-rules-concept',['chain link','chain links','chains'],'Effects added to a Chain resolve from the last link back to the first. Whether a response is legal depends on timing, Spell Speed and its activation conditions.',['Pay costs and choose required targets when activating.','An event happening after an effect was activated does not automatically negate that effect.'],'Chain'),
  make('ygo','quick-effect','Quick Effect','effect-classification',['quick effects'],'A monster Quick Effect is Spell Speed 2. Its own conditions and the current timing still control when it can be activated.',['A Spell Speed 2 effect cannot respond to a Spell Speed 3 Counter Trap.','Read whether a once-per-turn line restricts using an effect or activating it.'],'Quick_Effect'),
  make('ygo','archetype','Archetype','deck-concept',['archetypes'],'An archetype is a named group recognized by the relevant card-name or effect wording. It is distinct from sharing a monster Type or Attribute.',['Check exact names, name-changing effects and the wording of cards that support the group.','A community grouping or similar artwork alone is not enough to prove an archetype interaction.'],'Archetype')
 ]
});
// Built-in glossary rows join the older notes; an existing id keeps its note.
// Their reading link is a wiki search, since exact article titles vary.
const glossaryRecord=(game,[id,label,kind,aliases,summary,points])=>{const r=make(game,id,label,kind,aliases,summary,points,'Special:Search?search='+encodeURIComponent(game==='ptcg'?label+' (TCG)':label));r.source.reviewedOn=GLOSSARY_REVIEWED_ON;r.sourceStatus='glossary';return r;};
const ALL=freeze(Object.fromEntries([['ptcg',PTCG_GLOSSARY],['ygo',YGO_GLOSSARY]].map(([game,rows])=>{const own=LOCAL[game].map(copy),ids=new Set(own.map(c=>c.id));return [game,[...own,...rows.filter(r=>!ids.has(r[0])).map(r=>glossaryRecord(game,r))]];})));
function mtgRecord(c){return {...c,game:'mtg',source:{...c.source,pageVerified:true}};}
export function gameConcepts(game){if(!wikiSourceForGame(game))return [];return game==='mtg'?MTG_CONCEPTS.map(c=>mtgRecord(copy(c))):copy(ALL[game]);}
export function resolveGameConcept(game,value){
 if(!wikiSourceForGame(game)||typeof value!=='string'||value.length>160)return null;
 if(game==='mtg'){const c=resolveMtgConcept(value);return c?mtgRecord(c):null;}
 const wanted=key(value),record=ALL[game].find(c=>key(c.id)===wanted||key(c.label)===wanted)||ALL[game].find(c=>c.aliases.some(a=>key(a)===wanted));return record?copy(record):null;
}
export function searchGameConcepts(game,query='',{limit=8}={}){
 if(!wikiSourceForGame(game)||typeof query!=='string'||query.length>240)return [];
 if(game==='mtg')return searchMtgConcepts(query,{limit}).map(mtgRecord);
 const q=key(query),words=q.split(/[^\p{L}\p{N}+]+/u).filter(Boolean),count=Number.isInteger(limit)?Math.max(1,Math.min(limit,20)):8;
 const rank=c=>{const aliases=[c.id,...c.aliases].map(key),body=key([c.summary,...c.prerequisites].join(' '));return !q?1:aliases.includes(q)?100:aliases.some(a=>a.startsWith(q))?60:words.reduce((n,w)=>n+(aliases.some(a=>a.includes(w))?10:body.includes(w)?1:0),0);};
 return ALL[game].map(c=>({c,rank:rank(c)})).filter(r=>r.rank>0).sort((a,b)=>b.rank-a.rank||a.c.label.localeCompare(b.c.label)).slice(0,count).map(r=>copy(r.c));
}
export function gameConceptMentions(game,value=''){
 if(!wikiSourceForGame(game)||typeof value!=='string')return [];
 if(game==='mtg')return readMtgConceptMentions(value).map(mtgRecord);
 const text=value.slice(0,2000).replace(/[’]/g,"'").replace(/["“][^"”]*["”]/g,m=>' '.repeat(m.length)),all=ALL[game],aliases=[...new Set(all.flatMap(c=>[c.id,...c.aliases]))].sort((a,b)=>b.length-a.length),rx=new RegExp('\\b(?:'+aliases.map(escape).join('|')+')\\b','gi'),found=new Map();
 for(const match of text.matchAll(rx)){
  const c=all.find(c=>[c.id,...c.aliases].some(a=>key(a)===key(match[0]))),prefix=text.slice(0,match.index).split(/[.!?;,]|\bbut\b/i).at(-1);if(!c)continue;
  if(/\b(?:no|not|without|avoid|remove|drop|stop|skip|don't|do not)\b(?:\s+[a-z'-]+){0,10}\s*$/i.test(prefix)){found.delete(c.id);continue;}found.set(c.id,c);
 }
 return [...found.values()].map(copy);
}
export function buildGameWikiReference(game,value){
 const source=wikiSourceForGame(game);if(!source)return null;
 if(game==='mtg'){const r=buildMtgWikiReference(value);return r?{...r,game}:null;}
 if(typeof value!=='string'||value.length>160||/[\u0000-\u001f\u007f<>"\\]/.test(value)||/^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/|(?:javascript|data|file|mailto):)/i.test(value.trim()))return null;
 const title=value.normalize('NFC').trim().replace(/\s+/g,' ');if(!title)return null;
 const concept=resolveGameConcept(game,title),url=concept?.source.url||source.articlePrefix+encodeURIComponent(title.replace(/ /g,'_'));
 if(!isAllowedWikiUrl(game,url))return null;
 return {game,title:concept?.label||title,url,publisher:source.name,sourceAuthority:'community-reference',sourceStatus:concept?'curated':'linked-only',pageVerified:concept?.source.pageVerified===true,fetched:false,readOnly:true,note:concept?'A local TCG reminder is available; the external community article is not fetched by this record.':game==='ptcg'?'Reading link only. A generic name may refer to a species or background page rather than this exact TCG printing; the page and its contents are not verified.':'Reading link only. The page and its contents are not verified; anime, background and printed-card rules may differ.'};
}
export function gameWikiTitleForCard(game,card={}){
 if(!wikiSourceForGame(game)||typeof card.name!=='string'||!card.name.trim())return '';
 if(game!=='ptcg')return card.name.trim();
 const set=(typeof card.set==='object'?card.set?.name:'')||card.setName||'',number=card.number||card.collector_number||card.localId;
 return set&&number?`${card.name.trim()} (${set} ${number})`:`${card.name.trim()} (TCG)`;
}
// One glossary entry for the Wiki reader: Magic uses the bundled Comprehensive
// Rules glossary first, then the curated notes; the other games use their notes.
export function gameGlossaryEntry(game,value){
 const source=wikiSourceForGame(game);if(!source||typeof value!=='string'||value.length>160)return null;
 const search=label=>source.articlePrefix+'Special:Search?search='+encodeURIComponent(label);
 if(game==='mtg'){
  const rule=Object.hasOwn(KEYWORD_REFERENCE,key(value))?KEYWORD_REFERENCE[key(value)]:null;
  if(rule)return {game,label:rule.label,definition:rule.definition,points:[],sourceLabel:'Magic Comprehensive Rules '+rule.entryId+' ('+KEYWORD_SOURCE.date+')',official:true,readMoreUrl:source.articlePrefix+encodeURIComponent(rule.label.replace(/ /g,'_'))};
 }
 const c=resolveGameConcept(game,value);if(!c)return null;
 return {game,label:c.label,definition:c.summary,points:[...(c.prerequisites||[])],sourceLabel:'CardStashy glossary · official rules and the exact card text decide',official:false,readMoreUrl:isAllowedWikiUrl(game,c.source.url)?c.source.url:search(c.label)};
}
export function gameGlossaryTopics(game){
 if(!wikiSourceForGame(game))return [];
 const labels=game==='mtg'?[...MTG_CONCEPTS.filter(c=>!['background-topic','player-history'].includes(c.kind)).map(c=>c.label),...Object.values(KEYWORD_REFERENCE).map(r=>r.label)]:ALL[game].map(c=>c.label);
 return [...new Map(labels.map(l=>[key(l),l])).values()].sort((a,b)=>a.localeCompare(b));
}
