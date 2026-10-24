// Semantic boundaries for the small original concept dictionary. These checks
// never fetch the wiki or turn a reading link into fetched rules evidence.
import assert from 'node:assert/strict';
const oldFetch=globalThis.fetch;let network=0;
globalThis.fetch=async()=>{network++;throw Error('The local dictionary must not request a remote article.');};
try{
 const {MTG_CONCEPTS,MTG_KNOWLEDGE_SOURCE,resolveMtgConcept,searchMtgConcepts,readMtgConceptMentions,buildMtgWikiReference,wikiLookupAvailability}=await import('./mtg-wiki-knowledge.js');
 assert.equal(resolveMtgConcept('Bloodlust').id,'bloodlust');
 assert.equal(resolveMtgConcept('BLOODTHIRST').id,'bloodthirst');
 assert.equal(resolveMtgConcept('Blood Lust'),null,'The Blood Lust card name is not the Bloodlust mechanic nickname');
 assert.equal(resolveMtgConcept('Bloodlust deck'),null,'Exact concept resolution is not fuzzy card/rules validation');
 assert.equal(resolveMtgConcept('Slith').id,'slith');assert.equal(resolveMtgConcept('Sliths').id,'slith');
 for(const alias of ['Slith-style','slith style','Slith ability','Slith mechanic'])assert.equal(resolveMtgConcept(alias).id,'bloodlust',alias);
 assert.deepEqual(readMtgConceptMentions('Build a Slith-style combat deck').map(c=>c.id),['bloodlust'],'The longest nickname match cannot also force the Slith creature subtype');
 assert.deepEqual(readMtgConceptMentions('Build a Slith deck').map(c=>c.id),['slith']);
 assert.deepEqual(readMtgConceptMentions('Build Bloodlust with Bloodthirst').map(c=>c.id),['bloodlust','bloodthirst'],'Different counter mechanics retain different requirements');
 assert.deepEqual(readMtgConceptMentions('Use "Bloodlust" and “Bloodthirst” as card names').map(c=>c.id),[]);
 for(const request of ['No Bloodlust','Build without Bloodlust','Avoid Bloodlust','Drop the Bloodlust','Remove Bloodlust',"I don't want Bloodlust",'I don’t want Bloodlust',"I don't want a deck with Bloodlust",'I don’t want a deck with Bloodlust'])assert.deepEqual(readMtgConceptMentions(request),[],request);
 assert.deepEqual(readMtgConceptMentions("Don't use Bloodlust, but use Bloodthirst").map(c=>c.id),['bloodthirst']);
 assert.deepEqual(readMtgConceptMentions('Build Bloodlust, not Bloodthirst').map(c=>c.id),['bloodlust']);
 assert.deepEqual(readMtgConceptMentions('Use Bloodlust, then remove Bloodlust'),[],'A final explicit removal wins over an earlier mention');
 assert.deepEqual(readMtgConceptMentions('Blood Lust is a card'),[]);
 assert.deepEqual(readMtgConceptMentions('A bloodthirsty description is not a named mechanic'),[],'Whole-word matching avoids incidental substrings');

 const first=resolveMtgConcept('Bloodlust');
 first.summary='Invented replacement';first.aliases.push('made-up concept');first.prerequisites.length=0;first.source.url='https://invalid.test/';first.builderCoverage.status='guaranteed';
 const again=resolveMtgConcept('Bloodlust');assert.notEqual(again.summary,'Invented replacement');assert(!again.aliases.includes('made-up concept'));assert(again.prerequisites.length);assert.equal(new URL(again.source.url).hostname,'mtg.wiki');assert.notEqual(again.builderCoverage.status,'guaranteed');
 const found=searchMtgConcepts('bloodlust',{limit:1});assert.equal(found[0].id,'bloodlust');found[0].source.url='https://invalid.test/';assert.equal(new URL(searchMtgConcepts('bloodlust')[0].source.url).hostname,'mtg.wiki');
 assert.equal(searchMtgConcepts('slith')[0].id,'slith','An exact subtype lookup ranks ahead of a related nickname');
 assert.equal(searchMtgConcepts('bloodthirst')[0].id,'bloodthirst');
 assert(searchMtgConcepts('',{limit:1000}).length<=20);assert.equal(searchMtgConcepts('',{limit:1}).length,1);
 assert.deepEqual(searchMtgConcepts('x'.repeat(241)),[]);assert.deepEqual(searchMtgConcepts({text:'bloodlust'}),[]);assert.deepEqual(searchMtgConcepts('qzmxplvbnkzzzz'),[]);

 const ids=MTG_CONCEPTS.map(c=>c.id);assert.equal(new Set(ids).size,ids.length);assert(ids.length>0&&ids.length<1000,'The local dictionary is bounded; it is not a complete wiki mirror');
 for(const concept of MTG_CONCEPTS){
  assert.equal(concept.sourceAuthority,'community-reference');assert.equal(concept.source.authority,'community-reference');assert.equal(concept.readOnly,true);assert(['modeled','reference-only'].includes(concept.builderCoverage.status));
  const reference=buildMtgWikiReference(concept.label);assert.equal(reference.sourceAuthority,'community-reference');assert.equal(reference.readOnly,true);assert.equal(reference.fetched,false);assert.equal(new URL(reference.url).hostname,'mtg.wiki');
 }
 assert.equal(resolveMtgConcept('Bloodthirst').official,true,'The keyword is official');
 assert.equal(resolveMtgConcept('Bloodthirst').sourceAuthority,'community-reference','That does not promote the linked wiki into an official rules source');
 assert.equal(MTG_KNOWLEDGE_SOURCE.declaredWikiTextLicense,'CC BY-NC-SA 4.0');assert.equal(new URL(MTG_KNOWLEDGE_SOURCE.licenseUrl).hostname,'creativecommons.org');
 assert.match(MTG_KNOWLEDGE_SOURCE.reuse,/not copied/);assert.match(MTG_KNOWLEDGE_SOURCE.reuse,/NonCommercial/);

 const player=buildMtgWikiReference('Jakub Šlemr');assert.equal(player.sourceStatus,'curated');assert.equal(player.fetched,false);assert.equal(player.url,'https://mtg.wiki/page/Jakub_%C5%A0lemr');
 assert.equal(buildMtgWikiReference('Jakub S\u030clemr').url,player.url,'NFC handles the decomposed Czech name without losing its accent');
 const unknown=buildMtgWikiReference('A Card Not In This Dictionary');assert.equal(unknown.sourceStatus,'linked-only');assert.equal(unknown.pageVerified,false);assert.equal(unknown.fetched,false);assert.match(unknown.note,/not fetched or verified/);assert.equal(unknown.url,'https://mtg.wiki/page/A_Card_Not_In_This_Dictionary');
 for(const value of ['',null,{},'x'.repeat(161),'Bad\u0000Title','Bloodlust\nInjected','Bloodlust\tInjected','<img src=x onerror=alert(1)>','https://evil.test/wiki','javascript:alert(1)','data:text/html,test','file:///tmp/test'])assert.equal(buildMtgWikiReference(value),null,'Untrusted input rejected: '+String(value));
 const availability=wikiLookupAvailability();assert.equal(availability.available,false);assert.equal(availability.readOnly,true);assert.equal(availability.curatedConcepts,MTG_CONCEPTS.length);assert.match(availability.message,/no successful online article response|not.*(?:fetched|retrieved|verified)/i);assert.match(availability.message,/link.*not.*retrieved article/i);
 availability.available=true;availability.curatedConcepts=999999;assert.equal(wikiLookupAvailability().available,false);assert.equal(wikiLookupAvailability().curatedConcepts,MTG_CONCEPTS.length);
 const {keywordHelp,ruleDexPanel,ruleText,openMtgConceptHelp}=await import('./rule-dex.js');
 const {cardDiscoverySpec,discoverCardMarkup}=await import('./card-discovery.js');
 const {cardRuleHelp,interactiveRules}=await import('./rule-learning.js');
 const informal=keywordHelp('mtg','bloodlust'),formal=keywordHelp('mtg','bloodthirst');
 assert.equal(informal.reference,null,'An informal wiki term must not receive a fictional exact official rule');
 assert.equal(informal.concept.sourceAuthority,'community-reference');assert.match(informal.definition,/distinct from.*Bloodthirst/);
 assert.equal(formal.reference.kind,'bundled-entry','The official keyword keeps its existing exact dated rule reference');
 assert.equal(formal.concept.sourceAuthority,'community-reference','Its background reading remains a separate community source');
 assert.equal(keywordHelp('mtg','Jakub Šlemr').reference,null,'A player biography is not an official rules passage');
 assert.equal(keywordHelp('ygo','bloodlust'),null,'Magic references cannot leak into another game');
 assert.equal(openMtgConceptHelp('unknown concept',null),false);assert.equal(openMtgConceptHelp('bloodlust',null),false,'UI help needs an actual connected trigger');
 assert.doesNotMatch(ruleText('mtg','Blood Lust is a card name.'),/data-rule="bloodlust"/);
 const dictionaryMarkup=ruleDexPanel('mtg');assert.match(dictionaryMarkup,/data-source-kind="community-page"/);assert.match(dictionaryMarkup,/Official rules and detailed rulings/);
 assert.match(interactiveRules('mtg'),/Keywords & deck concepts/);
 const conceptSearch=cardDiscoverySpec('mtg','concept','Bloodlust');
 assert.match(conceptSearch.q,/combat damage/);assert.match(conceptSearch.q,/\+1\/\+1 counter/);assert.doesNotMatch(conceptSearch.q,/keyword:.*bloodlust/i);assert.match(conceptSearch.label,/candidates/);
 assert.equal(cardDiscoverySpec('mtg','concept','Bloodthirst').q,'keyword:"bloodthirst"');
 assert.equal(cardDiscoverySpec('mtg','concept','Voltron'),null,'Reference-only concepts are not falsely advertised as an exact card mechanic query');
 assert.equal(cardDiscoverySpec('ygo','concept','Bloodlust'),null);
 // Synthetic identity; the ability pattern is deliberately tested against a
 // close counterexample, not inferred from the nickname or a card's name.
 const growth={name:'Growth Fixture',type_line:'Creature — Vampire',oracle_text:'Whenever Growth Fixture deals combat damage to a player, put a +1/+1 counter on Growth Fixture.'};
 assert.match(discoverCardMarkup('mtg',growth),/data-discovery-kind="concept" data-discovery-value="bloodlust"/);
 assert.match(cardRuleHelp('mtg',growth),/data-rule="bloodlust"/,'Card help recognizes the actual combat-hit pattern even when the nickname is absent from the card');
 assert.doesNotMatch(discoverCardMarkup('mtg',{...growth,oracle_text:growth.oracle_text.replace('to a player','to a creature')}),/data-discovery-value="bloodlust"/);
 assert.doesNotMatch(discoverCardMarkup('mtg',{name:'Bloodlust',type_line:'Creature — Vampire',oracle_text:'Flying'}),/data-discovery-value="bloodlust"/);
 const thirsty={name:'Thirst Fixture',type_line:'Creature — Vampire',keywords:['Bloodthirst'],oracle_text:'Bloodthirst 2'};
 assert.equal((discoverCardMarkup('mtg',thirsty).match(/data-discovery-value="Bloodthirst"/g)||[]).length,1,'An official keyword chip is not duplicated by the semantic helper');
 assert.equal(network,0,'Local concepts and reading links must not silently fetch, mirror or certify an online article');
 console.log('PASS: distinct Bloodlust/Bloodthirst/Slith semantics, longest aliases, quoted/negated/removed mentions, isolated clones, bounded ranked discovery, source authority, safe Unicode reading links and honest unfetched local availability.');
}finally{globalThis.fetch=oldFetch;}
