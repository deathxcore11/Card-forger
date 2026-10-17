import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash,webcrypto} from 'node:crypto';
import {LESSONS,TURN_STEPS,RULE_CHECKS,CORE_RULES,BEGINNER_START} from './rule-lessons.js';
import {RULE_DEX,ruleCardContext,keywordHelp} from './rule-dex.js';
import {interactiveRules,openRuleReference,closeRuleReference,attachRuleLearning,cardRuleHelp} from './rule-learning.js';
import {learnSheet,rulesPage} from './rules.js';
import {RULE_SOURCES,RULE_VERSIONS,lessonReference,entryReference,resolveRuleReference,sourceDestination,searchRulebook,validateDecodedRulePack,findRuleEntry,visibleRulePassage} from './rule-reference.js';
const games=['mtg','ptcg','ygo'],manifest=JSON.parse(fs.readFileSync('rulebooks/manifest.json'));
const books=Object.fromEntries(games.map(g=>[g,JSON.parse(gunzipSync(fs.readFileSync(manifest[g].file)))]));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const snapshot=JSON.parse(fs.readFileSync('tests/fixtures/rules-content-v1.json'));
const plain=s=>s.replace(/<[^>]*>/g,'').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");
for(const g of games){
 const content={LESSONS,TURN_STEPS,RULE_CHECKS,CORE_RULES,RULE_DEX};
 for(const [type,value]of Object.entries(content))assert.equal(digest(value[g]),snapshot.games[g][type].sha256,`${g} ${type}: preserve every original word`);
 const html=interactiveRules(g),text=plain(html);
 assert.match(html,/data-learn-start>Try a turn/);assert(text.includes(BEGINNER_START[g].overview));assert(text.includes(BEGINNER_START[g].example));assert(!/<details[^>]*data-learn-turn[^>]*\bopen\b/.test(html),'beginner is not dumped into all steps');
 assert.equal((html.match(/data-learn-step="/g)||[]).length,6);assert.equal((html.match(/data-learn-topic="/g)||[]).length,8);assert.equal((html.match(/data-rule-check="/g)||[]).length,4);
 for(const lesson of LESSONS[g])for(const part of ['title','summary','detail','example'])assert(text.includes(lesson[part]),`${g} topic ${part} remains reachable`);
 for(const [title,body]of CORE_RULES[g]){assert(text.includes(title));assert(text.includes(body));}
 for(const [key,value]of Object.entries(RULE_DEX[g])){assert(text.includes(value.definition));assert(text.includes(value.tip));const help=keywordHelp(g,key);assert(help.lesson.example&&help.lesson.detail);assert(resolveRuleReference(books[g],help.reference),`${g}:${key} source resolves`);}
 for(const label of [...LESSONS[g].map(t=>t.ref),...TURN_STEPS[g].map(s=>s[3]),...RULE_CHECKS[g].map(q=>q.ref)]){
  const ref=lessonReference(g,label);assert(ref,`${g}:${label} has a typed ref`);const result=resolveRuleReference(books[g],ref);assert(result,`${g}:${label} resolves exactly`);if(result.entry)assert.notEqual(result.entry.id,'0-p2','never select a table of contents as teaching source');
 }
 for(const s of books[g].sources)assert(html.includes(s.url),'every original source remains available before download');
 assert(validateDecodedRulePack(books[g],g,{count:manifest[g].count}));assert(!validateDecodedRulePack(books[g],g,{version:'wrong'}));
 assert.match(learnSheet(g),/data-learning-root/);assert.match(rulesPage(g,{}),/Formats/);assert.match(rulesPage(g,{}),/Official documents/);
}
assert.equal(lessonReference('ptcg','Turn Actions').entryId,'0-p10');
assert.equal(lessonReference('ygo','2021 Rules Update').kind,'official-page');assert.equal(lessonReference('ygo','Other Rules').kind,'official-page');
assert.equal(resolveRuleReference(books.mtg,entryReference('mtg','502')).entry.id,'502.');assert.equal(resolveRuleReference(books.mtg,entryReference('mtg','502.')).entry.id,'502.');
for(const [id,page] of Object.entries({'613.7':114,'701.22a':131,'701.68a':144,'601.2b':90,'704':195,'810.9':244})){const e=findRuleEntry(books.mtg,id);assert.equal(e.page,page);assert(!/^\d[^ ]* (?:and|of the|is complete|See also)/.test(e.text));}
assert.equal(searchRulebook(books.mtg,'502')[0].id,'502.');assert.equal(searchRulebook(books.mtg,'704')[0].page,195);assert.equal(findRuleEntry(books.mtg,'704').page,195);
assert(resolveRuleReference(books.mtg,entryReference('mtg','502')).entries.some(e=>e.id==='502.4'),'chapter source contains substantive subrules');
assert(resolveRuleReference(books.mtg,entryReference('mtg','702.9')).entries.some(e=>e.id==='702.9a'),'keyword source includes actual definition, not only a heading');
assert.equal(resolveRuleReference(books.ptcg,entryReference('mtg','502')),null);assert.equal(resolveRuleReference(books.ptcg,{...entryReference('ptcg','0-p10'),version:'old'}),null);
assert.equal(resolveRuleReference(books.ptcg,{...entryReference('ptcg','0-p10'),doc:1}),null);
assert.equal(resolveRuleReference(null,{kind:'official-page',game:'ygo',key:'made-up',url:'https://evil.invalid'}),null);
assert.equal(resolveRuleReference(null,{...lessonReference('ygo','2021 Rules Update'),url:'https://evil.invalid'}).reference.url,'https://www.yugioh-card.com/en/play/2021_rules_update/');
assert.equal(sourceDestination(RULE_SOURCES.ptcg[0],10).kind,'official-page');assert(!sourceDestination(RULE_SOURCES.ptcg[0],10).url.includes('#page'));
assert(sourceDestination(RULE_SOURCES.mtg[0],78).url.endsWith('#page=78'));assert(sourceDestination(RULE_SOURCES.ptcg[2],2).url.endsWith('#page=2'));
assert.match(visibleRulePassage('ptcg',books.ptcg.entries.find(e=>e.id==='0-p10')).text,/^Turn Actions\n1\) Draw a Card/);
assert.equal(visibleRulePassage('ptcg',books.ptcg.entries.find(e=>e.id==='0-p10')).fullText,books.ptcg.entries.find(e=>e.id==='0-p10').text);
// Semantic source fixtures: a valid ID or a passing keyword search is not enough.
const keywordPassage=(game,key)=>{const resolved=resolveRuleReference(books[game],keywordHelp(game,key).reference);return {resolved,text:resolved.entries.map(e=>e.text).join(' ').replace(/\s+/g,' ')};};
const burned=keywordPassage('ptcg','Burned');assert.equal(burned.resolved.entry.id,'0-p15');
assert.match(burned.text,/Burned When a Pokémon is Burned, put a Burn marker on it\. During Pokémon Checkup, place 2 damage counters on your Burned Pokémon, then flip a coin\. If heads, the Pokémon recovers \(remove the Burn marker\)/,'Burned citation must contain its damage, flip and recovery, not a passing mention on page 16');
const semantics={
 ptcg:{Ability:[/Abilities aren’t attacks/,/read carefully to see how each one works/],Supporter:[/only one Supporter card each turn/,/goes first cannot play a Supporter card on their first turn/],'Active Pokémon':[/only one Active Pokémon at a time/],Bench:[/Your Bench can hold up to 5 Pokémon/],'Prize cards':[/opponent takes 1 of their own Prize cards/,/took your last Prize card/],'Knocked Out':[/total damage at least equal to its HP/,/all cards attached to it in the discard pile/],Asleep:[/If a Pokémon is Asleep, it cannot attack or retreat/,/flip heads, the Pokémon recovers/],Paralyzed:[/If a Pokémon is Paralyzed, it cannot attack or retreat/,/After its owner’s next turn, it recovers during Pokémon Checkup/],Confused:[/flip a coin before attacking/,/If tails, the attack doesn’t happen, and you place 3 damage counters/],Poisoned:[/During Pokémon Checkup, place a damage counter on your Poisoned Pokémon/],retreat:[/Retreat your Active Pokémon \(once per turn\)/,/discard 1 Energy from your Active Pokémon/],'damage counters':[/1 damage counter on your opponent’s Active Pokémon for each 10 damage/]},
 mtg:{flying:[/can’t be blocked except by creatures with flying and\/or reach/],reach:[/can’t be blocked except by creatures with flying and\/or reach/],trample:[/assigned lethal damage, any excess damage/],haste:[/can attack even if it hasn’t been controlled/],vigilance:[/Attacking doesn’t cause creatures with vigilance to tap/],deathtouch:[/destroyed as a state-based action/],lifelink:[/gain that much life/],'first strike':[/second combat damage step/],'double strike':[/second combat damage step/],hexproof:[/can’t be the target of spells or abilities your opponents control/],ward:[/counter that spell or ability unless that player pays/],indestructible:[/can’t be destroyed/],flash:[/any time you could cast an instant/],equip:[/target creature you control/,/Activate only as a sorcery/],scry:[/bottom of your library in any order and the rest on top/],surveil:[/into your graveyard and the rest on top/],exile:[/move it to the exile zone/],sacrifice:[/Sacrificing a permanent doesn’t destroy it/]},
 ygo:{'Quick Effect':[/Spell Speed 2/,/Only another Spell Speed 3 card/],'Special Summon':[/properlySpecialSummoned/,/Special Summon with a Card’s Effect/],'Fusion Summoned':[/Fusion Materials/,/HOW TO FUSION SUMMON/],'Normal Summon':[/only Normal Summon OR Normal Set/,/once per turn/],banish:[/a card which is banished is separated from the field/],GY:[/Graveyard is shortened in the card text to “GY”/],negate:[/“Seven Tools of the Bandit”/,/negates the activation of “Threatening Roar\.”/],'End Phase':[/during the End Phase/,/more than 6 cards in your hand/]}
};
for(const [game,entries]of Object.entries(semantics))for(const [key,patterns]of Object.entries(entries)){const {text}=keywordPassage(game,key);for(const pattern of patterns)assert.match(text,pattern,`${game}:${key} source must substantively explain the mechanic`);}
const negate=keywordPassage('ygo','negate');assert.equal(negate.resolved.entry.id,'0-p26');assert.match(negate.resolved.source.verification,/do not establish every card-specific interaction/,'legacy negation example is not claimed as complete current coverage');
const oncePerTurn=keywordPassage('ygo','once per turn');assert.equal(oncePerTurn.resolved.reference.kind,'official-page');assert.match(oncePerTurn.resolved.reference.summary,/does not by itself establish the difference between use and activate restrictions after negation/,'general PSCT guidance cannot masquerade as a complete usage ruling');
console.log('PASS: complete original teaching corpus, all exact lesson/keyword sources, canonical duplicate-ID resolution, typed/versioned game isolation, PDF vs landing destinations.');

class Node {
 constructor(name,doc){this.name=name;this.ownerDocument=doc;this.hidden=false;this.scrollTop=0;this.scrollLeft=0;this.isConnected=true;this.attrs={};this.children=new Map();this.dataset={};}
 set innerHTML(value){this.html=value;this.children=new Map();if(value.includes('data-rule-heading'))this.children.set('[data-rule-heading]',new Node('source heading',this.ownerDocument));}
 get innerHTML(){return this.html||'';}
 querySelector(selector){return this.children.get(selector)||null;}
 setAttribute(k,v){this.attrs[k]=v;}
 focus(){assert(!['input','textarea'].includes(this.name),'source navigation must never focus an editor');this.ownerDocument.activeElement=this;}
 scrollIntoView(){this.scrolled=true;this.ownerDocument.scrollingElement.scrollTop=0;}
}
function fixture(g='ptcg'){
 const doc={scrollingElement:{scrollTop:240,scrollLeft:0}},root=new Node('root',doc);root.dataset.game=g;root.listeners={};root.addEventListener=(k,f)=>(root.listeners[k]||=[]).push(f);
 for(const key of ['data-learning-home','data-learning-library','data-rule-destination','data-library-heading','data-learn-start','data-rule-search'])root.children.set(`[${key}]`,new Node(key==='data-rule-search'?'input':key,doc));
 root.querySelector('[data-rule-search]').value='leave my query alone';root.querySelector('[data-learning-library]').hidden=true;root.querySelector('[data-rule-destination]').hidden=true;
 const trigger=new Node('source button',doc);trigger.dataset={};doc.activeElement=trigger;return {root,doc,trigger};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
{
 const {root,doc,trigger}=fixture(),home=root.querySelector('[data-learning-home]'),search=root.querySelector('[data-rule-search]'),d=deferred();root.scrollTop=73;
 const request=openRuleReference(root,lessonReference('ptcg','Turn Actions'),{trigger,load:()=>d.promise});
 assert(root.querySelector('[data-learning-home]').hidden);assert(!root.querySelector('[data-rule-destination]').hidden);assert.match(root.querySelector('[data-rule-destination]').innerHTML,/Opening the exact source/);assert.equal(doc.activeElement.name,'source heading');
 d.resolve(books.ptcg);assert(await request);assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-entry="0-p10"/);assert.equal(search.value,'leave my query alone');assert.equal(doc.activeElement.name,'source heading');
 closeRuleReference(root);assert.equal(root.querySelector('[data-learning-home]'),home);assert(!home.hidden);assert.equal(doc.activeElement,trigger);assert.equal(doc.scrollingElement.scrollTop,240);assert.equal(root.scrollTop,73);
 attachRuleLearning(root);attachRuleLearning(root);assert.equal(root.listeners.click.length,1,'attaching twice never duplicates navigation');
}
{
 const {root,trigger}=fixture(),a=deferred(),b=deferred();const first=openRuleReference(root,lessonReference('ptcg','Turn Actions'),{trigger,load:()=>a.promise}),second=openRuleReference(root,lessonReference('ptcg','Evolve'),{trigger,load:()=>b.promise});
 b.resolve(books.ptcg);assert(await second);a.resolve(books.ptcg);assert.equal(await first,false);assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-entry="0-p11"/);assert.doesNotMatch(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-entry="0-p10"/);
 closeRuleReference(root);assert(!root.querySelector('[data-learning-home]').hidden,'Back returns to explanation, not obsolete A loading state');
}
{
 const {root,trigger}=fixture(),a=deferred();const request=openRuleReference(root,lessonReference('ptcg','Turn Actions'),{trigger,load:()=>a.promise});closeRuleReference(root);a.resolve(books.ptcg);assert.equal(await request,false);assert(!root.querySelector('[data-learning-home]').hidden,'Back cancels late source');
 const bad=await openRuleReference(root,lessonReference('ptcg','Turn Actions'),{trigger,load:async()=>{throw Error('Offline fixture');}});assert.equal(bad,false);assert.match(root.querySelector('[data-rule-destination]').innerHTML,/Offline fixture/);assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-retry/);assert.match(root.querySelector('[data-rule-destination]').innerHTML,/Official documents/);
 assert(await openRuleReference(root,lessonReference('ptcg','Turn Actions'),{retry:true,load:async()=>books.ptcg}));
}
{
 const {root,trigger}=fixture(),a=deferred();const request=openRuleReference(root,lessonReference('ptcg','Turn Actions'),{trigger,load:()=>a.promise});root.dataset.game='ygo';a.resolve(books.ptcg);assert.equal(await request,false,'changed game suppresses old result');
}
{
 const {root,trigger}=fixture('ygo');assert(await openRuleReference(root,lessonReference('ygo','2021 Rules Update'),{trigger,load:()=>{throw Error('external page should not download a pack');}}));assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-source-kind="official-page"/);assert.doesNotMatch(root.querySelector('[data-rule-destination]').innerHTML,/No matching/);
}
{
 const {root,trigger,doc}=fixture('mtg');await openRuleReference(root,entryReference('mtg','502'),{trigger,load:async()=>books.mtg});
 const nested=new Node('old nested rule button',doc);await openRuleReference(root,entryReference('mtg','503'),{trigger:nested,load:async()=>books.mtg});nested.isConnected=false;closeRuleReference(root);
 assert.match(root.querySelector('[data-rule-destination]').innerHTML,/data-rule-entry="502\."/);assert.equal(doc.activeElement.name,'source heading','nested Back focuses restored noneditable source, not a hidden home control');closeRuleReference(root);assert.equal(doc.activeElement,trigger);
}
const card={id:'exact-print-17',name:'Same Name',set:'set-code',number:'17',oracle_text:'Flying\nWard {2}',card_faces:[{oracle_text:'Flash\nDo not omit this face.'}]},context=ruleCardContext('mtg',card);assert.equal(context.id,card.id);assert.equal(context.set,'set-code');assert.equal(context.number,'17');assert(context.text.includes('Do not omit this face.'));assert.match(cardRuleHelp('mtg',card),/exact-print-17/);assert.equal(keywordHelp('ptcg','target'),null,'no YGO definition leaks into Pokémon');assert.equal(ruleCardContext('ptcg',{id:'brief',brief:true,text:'Partial'}).complete,false);
assert.doesNotMatch(cardRuleHelp('ptcg',{id:'<script>',name:'<script>alert(1)</script>',text:'Ability'}),/<script>/);
console.log('PASS: noneditable direct-source focus, immediate loading/error/retry, no query mutation, Back DOM/scroll/focus restoration, rapid A/B and cancellation guards, exact-card identity.');

// Real corpus loader, with an in-memory storage adapter and local fixture fetches only.
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const calls=[];let fail=null,corrupt=false;
globalThis.fetch=async url=>{calls.push(url);if(url==='rulebooks/manifest.json')return new Response(JSON.stringify(manifest));if(fail===url)return new Response('unavailable',{status:503});let data=fs.readFileSync(url);if(corrupt&&url===manifest.mtg.file)data=Buffer.from('{"wrong":"corrupt"}');return new Response(data);};
const {loadRulePack}=await import('./rule-corpus.js?navigation-test');const [p1,p2]=await Promise.all([loadRulePack('ptcg'),loadRulePack('ptcg')]);assert.equal(p1,p2);assert.equal(calls.filter(x=>x===manifest.ptcg.file).length,1,'concurrent downloads deduplicate');assert.equal(p1.version,RULE_VERSIONS.ptcg);await loadRulePack('ptcg');assert.equal(calls.length,2,'warm cache avoids fetch');
fail=manifest.ygo.file;await assert.rejects(loadRulePack('ygo'),/download unavailable/);fail=null;assert.equal((await loadRulePack('ygo')).game,'ygo','failure is retryable');
corrupt=true;await assert.rejects(loadRulePack('mtg'),/incomplete/);corrupt=false;assert.equal((await loadRulePack('mtg')).game,'mtg','corrupt download can retry');
const key='cardstashy-rules-ptcg-'+manifest.ptcg.sha256,saved=JSON.parse(storage.get(key));saved.entries[0].text='Corrupt cached text';storage.set(key,JSON.stringify(saved));const before=calls.filter(x=>x===manifest.ptcg.file).length;const nextLoader=await import('./rule-corpus.js?corrupt-cache-test');assert.equal((await nextLoader.loadRulePack('ptcg')).entries[0].text,books.ptcg.entries[0].text);assert.equal(calls.filter(x=>x===manifest.ptcg.file).length,before+1,'corrupt cache cannot bypass integrity check');
console.log('PASS: cold/warm corpus cache, concurrent loading, downloaded and cached integrity, retriable offline/corrupt failures with no browser or outbound request.');

// A failed manifest attempt must not poison subsequent retries; saved corpus remains usable offline.
const offlineLoader=await import('./rule-corpus.js?offline-test');globalThis.fetch=async()=>{throw Error('offline');};assert.equal((await offlineLoader.loadRulePack('ptcg')).game,'ptcg');
const emptyStorage=new Map();globalThis.localStorage={getItem:k=>emptyStorage.get(k)||null,setItem:(k,v)=>emptyStorage.set(k,String(v)),removeItem:k=>emptyStorage.delete(k)};
let manifestAttempts=0;globalThis.fetch=async url=>{if(url==='rulebooks/manifest.json'){manifestAttempts++;return new Response(JSON.stringify(manifestAttempts===1?{}:manifest));}return new Response(fs.readFileSync(url));};const manifestLoader=await import('./rule-corpus.js?manifest-retry-test');await assert.rejects(manifestLoader.loadRulePack('ptcg'),/online/);assert.equal((await manifestLoader.loadRulePack('ptcg')).game,'ptcg');assert.equal(manifestAttempts,2);
console.log('PASS: offline saved editions and corrupt/missing manifest retry, with no stale navigation restoration.');
