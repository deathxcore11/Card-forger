// Game identity and source boundaries use original local reminders only. No
// article response, price, printing identity or rules proof is fabricated.
import assert from 'node:assert/strict';
import {WIKI_SOURCES,wikiSourceForGame,isAllowedWikiUrl} from './wiki-sources.js';
import {gameConcepts,resolveGameConcept,searchGameConcepts,gameConceptMentions,buildGameWikiReference,gameWikiTitleForCard} from './game-wiki-knowledge.js';
const fetchBefore=globalThis.fetch;let network=0;globalThis.fetch=async()=>{network++;throw Error('Local references cannot silently fetch.');};
try{
 assert.deepEqual(Object.keys(WIKI_SOURCES).sort(),['mtg','ptcg','ygo']);
 for(const game of ['unknown','pokemon','__proto__','constructor','toString',null,{}]){
  assert.equal(wikiSourceForGame(game),null);assert.deepEqual(gameConcepts(game),[]);assert.equal(resolveGameConcept(game,'Damage'),null);assert.equal(buildGameWikiReference(game,'Damage'),null);assert.deepEqual(searchGameConcepts(game,'Damage'),[]);
 }
 for(const game of ['mtg','ptcg','ygo']){
  const source=wikiSourceForGame(game);assert.equal(source.authority,'community-reference');assert.equal(isAllowedWikiUrl(game,source.apiEndpoint,{api:true}),true);
  assert.equal(isAllowedWikiUrl(game,source.articlePrefix+'Example'),true);
  for(const url of ['http://'+new URL(source.origin).hostname+source.articlePath+'Example',source.origin+':444'+source.articlePath+'Example','https://user:pass@'+new URL(source.origin).hostname+source.articlePath+'Example','https://evil.test'+source.articlePath+'Example',source.origin+'/unrelated/Example'])assert.equal(isAllowedWikiUrl(game,url),false,url);
  assert.throws(()=>source.allowedHosts.push('evil.test'));
  const concepts=gameConcepts(game);assert(concepts.length>0);assert(concepts.every(c=>c.game===game&&c.sourceAuthority==='community-reference'&&c.readOnly===true));
  concepts[0].summary='Mutated';assert.notEqual(gameConcepts(game)[0].summary,'Mutated');
  for(const c of gameConcepts(game)){
   const ref=buildGameWikiReference(game,c.label);assert.equal(ref.fetched,false);assert.equal(ref.readOnly,true);assert.equal(new URL(ref.url).origin,source.origin);
  }
 }
 assert.equal(WIKI_SOURCES.mtg.declaredLicense,'CC BY-NC-SA 4.0');assert.equal(WIKI_SOURCES.ptcg.declaredLicense,'CC BY-NC-SA 2.5');
 assert.equal(WIKI_SOURCES.ygo.declaredLicense,null,'An inaccessible current policy must not acquire an invented license version');
 assert.match(WIKI_SOURCES.ptcg.scope,/Video-game.*not authority/);
 assert.match(WIKI_SOURCES.ygo.scope,/Anime\/manga/);
 assert.equal(isAllowedWikiUrl('ptcg',WIKI_SOURCES.mtg.articlePrefix+'Damage'),false,'One game cannot borrow another game’s source');
 assert.equal(resolveGameConcept('mtg','Bloodlust').id,'bloodlust');assert.equal(resolveGameConcept('ptcg','Bloodlust'),null);
 const life=searchGameConcepts('mtg','LIF').slice(0,3).map(c=>c.id).sort();assert.deepEqual(life,['lifedrain','lifegain','lifelink']);
 assert.equal(resolveGameConcept('ptcg','stage1').id,'stage-1');assert.equal(resolveGameConcept('ptcg','Stage 2').id,'stage-2');
 assert.match(resolveGameConcept('ptcg','Damage counters').summary,/not automatically an attack-damage/);
 assert.match(resolveGameConcept('ptcg','Energy').prerequisites.join(' '),/not the same as video-game/);
 assert.match(resolveGameConcept('ptcg','Special Condition').summary,/paper TCG/);
 assert.equal(resolveGameConcept('ygo','Zombie').kind,'monster-type');assert.equal(resolveGameConcept('ygo','Yokai').kind,'background-topic');
 assert.match(resolveGameConcept('ygo','Yokai').summary,/does not replace.*printed monster Type/);
 assert.match(resolveGameConcept('ygo','Synchro Summon').summary,/Tuner.*Levels/);
 assert.match(resolveGameConcept('ygo','Quick Effect').prerequisites.join(' '),/cannot respond.*Spell Speed 3/);
 assert.equal(resolveGameConcept('ygo','Stage 1'),null);assert.equal(resolveGameConcept('ptcg','Synchro Summon'),null);
 assert.deepEqual(gameConceptMentions('ptcg','Compare damage counters with attack damage').map(c=>c.id),['damage-counters','damage']);
 assert.deepEqual(gameConceptMentions('ygo','Use Zombie, not Yokai').map(c=>c.id),['zombie']);
 assert.deepEqual(gameConceptMentions('ygo','Use “Zombie” as a card name'),[]);
 assert(searchGameConcepts('ptcg','sta',{limit:2}).every(c=>c.game==='ptcg'));assert.equal(searchGameConcepts('ygo','',{limit:1}).length,1);assert.deepEqual(searchGameConcepts('ptcg','qzxmnbzqzz'),[]);
 const known=buildGameWikiReference('ptcg','Stage 1');assert.match(known.url,/Stage_1_Pok%C3%A9mon/);assert.equal(known.pageVerified,true);assert.equal(known.fetched,false);
 const yokai=buildGameWikiReference('ygo','Yokai');assert.equal(yokai.pageVerified,false,'A local factual distinction does not verify a blocked external article');
 const printing=gameWikiTitleForCard('ptcg',{name:'Ferrothorn',set:{name:'Paradox Rift'},number:'128'});assert.equal(printing,'Ferrothorn (Paradox Rift 128)');
 const cardLink=buildGameWikiReference('ptcg',printing);assert.equal(cardLink.sourceStatus,'linked-only');assert.equal(cardLink.pageVerified,false);assert.equal(cardLink.fetched,false);
 assert.equal(gameWikiTitleForCard('ptcg',{name:'Ferrothorn'}),'Ferrothorn (TCG)','Missing printing metadata must not invent an expansion or collector number');
 assert.equal(gameWikiTitleForCard('ygo',{name:'Ash Blossom & Joyous Spring'}),'Ash Blossom & Joyous Spring');
 for(const game of ['mtg','ptcg','ygo'])for(const title of ['https://evil.test','//evil.test/path','javascript:alert(1)','FTP://evil.test','Bad\u0000Title','Title\nExtra','<script>','x'.repeat(161)])assert.equal(buildGameWikiReference(game,title),null);
 assert.equal(network,0);
 console.log('PASS: fixed per-game wiki providers, source/license honesty, prototype/URL boundaries, Pokémon TCG vs video-game distinctions, Zombie vs Yokai, exact-printing links, prefix life suggestions and no fabricated retrieval.');
}finally{globalThis.fetch=fetchBefore;}
