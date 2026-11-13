// The fixed question list for the no-AI search: each typed question must be read into the right app lookup,
// with its blanks filled from the question or the open screen, or be honestly left unanswered.
import assert from 'node:assert/strict';
import {planQuery,wikiTitles} from './answer-search.js';

const sets=[{code:'blb',name:'Bloomburrow'},{code:'dsk',name:'Duskmourn: House of Horror'},{code:'mh3',name:'Modern Horizons 3'},{code:'fdn',name:'Foundations'}];
const ctx={game:'mtg',formatLast:{mtg:'Standard'},sets,screen:{}};
const p=(q,c={})=>planQuery(q,{...ctx,...c});
// [question, intent, tool, check on the plan, extra context]
const CASES=[
 // Randall's two examples.
 ['whats the best deck out right now in meta','meta.best','meta_decks',x=>x.call.args.format==='Standard'],
 ['what is the most expensive card in this set','set.rank','set_cards',x=>x.call.args.set==='blb'&&x.call.pick==='price-desc',{screen:{set:sets[0]}}],
 // Tournament decks.
 ['best deck in the meta right now','meta.best','meta_decks'],
 ['top modern decks','meta.best','meta_decks',x=>x.call.args.format==='Modern'],
 ['what is winning in pioneer','meta.best','meta_decks',x=>x.call.args.format==='Pioneer'],
 ['best cedh deck','meta.best','meta_decks',x=>x.call.args.format==='Commander'],
 ['best pokemon deck','meta.best','meta_decks',x=>x.game==='ptcg'&&x.call.args.format==='Standard'],
 ['best expanded deck','meta.best','meta_decks',x=>x.call.args.format==='Expanded',{game:'ptcg'}],
 ['top yugioh decks','meta.best','meta_decks',x=>x.game==='ygo'],
 ['most played cards in standard','meta.cards','meta_decks',x=>x.call.pick==='cards'],
 // Sets and prices.
 ['most expensive card in bloomburrow','set.rank','set_cards',x=>x.call.args.set==='blb'],
 ['cheapest card in modern horizons 3','set.rank','set_cards',x=>x.call.args.set==='mh3'&&x.call.pick==='price-asc'],
 ['priciest card in duskmourn house of horror','set.rank','set_cards',x=>x.call.args.set==='dsk'],
 ['most valuable card in the blb set','set.rank','set_cards',x=>x.call.args.set==='blb'],
 ['what is the newest set','set.rank-sets','list_sets',x=>x.call.args.order==='newest'],
 ['oldest magic set','set.rank-sets','list_sets',x=>x.call.args.order==='oldest'],
 ['biggest set','set.rank-sets','list_sets',x=>x.call.args.order==='largest'],
 ['whats the next set','set.next','list_sets',x=>x.call.pick==='upcoming'],
 ['when did bloomburrow come out','set.info','list_sets',x=>x.call.pick==='date'],
 ['how many cards in foundations','set.info','list_sets',x=>x.call.pick==='count'],
 ['how much is sheoldred the apocalypse','card.price','card_details',x=>x.call.args.name==='sheoldred the apocalypse'],
 ['price of the one ring','card.price','card_details',x=>x.call.args.name==='the one ring'],
 ['how much is this worth','card.price','card_details',x=>x.call.args.name==='Sol Ring',{screen:{card:{name:'Sol Ring'}}}],
 // Your own cards.
 ['how much is my collection worth','collection.value','my_collection',x=>x.call.pick==='total'],
 ['what is my collection worth','collection.value','my_collection'],
 ['what is my most valuable card','collection.top','my_collection',x=>x.call.args.sort==='value'&&x.call.args.limit===1],
 ['my most expensive cards','collection.top','my_collection',x=>x.call.args.limit===10],
 ['my newest cards','collection.top','my_collection',x=>x.call.args.sort==='recent'],
 ['do i own lightning bolt','collection.own','card_details',x=>x.call.args.name==='lightning bolt'&&x.call.pick==='owned'],
 ['how many sol ring do i have','collection.own','card_details',x=>x.call.args.name==='sol ring'],
 ['my decks','decks.mine','my_decks'],
 ['what is my best deck','decks.mine','my_decks',x=>x.call.pick==='power'],
 // Keywords come from the app's own book, never the wiki (gap 3).
 ['what does ward do','keyword','glossary',x=>x.entry.label==='Ward'&&/702\.21/.test(x.entry.sourceLabel)],
 ['what is trample','keyword','glossary',x=>x.entry.label==='Trample'],
 ['how does flying work','keyword','glossary'],
 ['deathtouch','keyword','glossary'],
 ['what is a chain','keyword','glossary',x=>x.game==='ygo',{game:'ygo'}],
 // History goes to the wiki as page titles (gap 1).
 ['who won the world championship in 1999','wiki','wiki_lookup',x=>x.call.args.query==='1999 World Championships'],
 ["who won magic's tournament in 1999",'wiki','wiki_lookup',x=>x.call.args.query==='1999 World Championships'&&x.call.alternates.includes('1998–99 Pro Tour Season')],
 ['who is jon finkel','wiki','wiki_lookup',x=>x.call.args.query==='jon finkel'],
 ['history of the pro tour','wiki','wiki_lookup',x=>x.call.args.query==='pro tour'],
 // Artists, mana, colours, types, prices (Randall, 13 Nov): one Magic search line built from the words.
 ['cards by rebecca guay','cards.artist','discover',x=>x.call.args.value==='rebecca guay'],
 ['art by john avon','cards.artist','discover',x=>x.call.args.value==='john avon'],
 ['magic cards illustrated by seb mckinnon','cards.artist','discover',x=>x.call.args.value==='seb mckinnon'],
 ['pokemon cards by mitsuhiro arita','cards.artist','discover',x=>x.game==='ptcg'&&x.call.args.value==='mitsuhiro arita'],
 ['cheapest red dragon legal in standard','cards.filter','card_search',x=>x.call.args.q==='c:r t:dragon f:standard'&&x.call.args.order==='usd'&&x.call.args.dir==='asc'],
 ['green creatures with trample','cards.filter','card_search',x=>x.call.args.q==='c:g t:creature keyword:"trample"'],
 ['3 mana blue instants','cards.filter','card_search',x=>x.call.args.q==='c:u t:instant mv=3'],
 ['mono black cards under $5','cards.filter','card_search',x=>x.call.args.q==='c=b usd<5'],
 ['most expensive elves','cards.filter','card_search',x=>x.call.args.q==='t:elf'&&x.call.args.dir==='desc'],
 ['mythic goblins in modern','cards.filter','card_search',x=>x.call.args.q==='t:goblin r:mythic f:modern'],
 ['white 2 mana or less creatures','cards.filter','card_search',x=>/mv<=2/.test(x.call.args.q)],
 // Actions the app can do.
 ['scan a card','go','go',x=>x.call.args.route==='#scan'],
 ['start a match','go','go',x=>x.call.args.route==='#play'],
 ['open my wishlist','go','go',x=>x.call.args.route==='#collection/wishlist'],
 ['go to settings','go','go',x=>x.call.args.route==='#settings'],
 // App help.
 ['how do i scan a card','help','app_help'],
 ['how do i back up my collection','help','app_help'],
];
for(const [q,intent,tool,check,extra] of CASES){
 const x=p(q,extra);
 assert.equal(x.intent,intent,`"${q}" is read as ${intent} (got ${x.intent})`);
 assert.equal(x.call?.tool,tool,`"${q}" runs ${tool}`);
 assert.equal(x.answerable,true,`"${q}" can be answered`);
 if(check)assert.ok(check(x),`"${q}" fills its blanks: ${JSON.stringify(x.call)}`);
 assert.ok(x.read.length>=1&&x.read[0].kind==='game','the game leads the "Read as" chips');
}
// A blank it cannot fill is asked for, never guessed.
{const x=p('most expensive card in this set');assert.equal(x.intent,'set.rank');assert.equal(x.answerable,false);assert.equal(x.call,null);assert.deepEqual(x.missing,[{slot:'set',ask:'Which set?'}]);}
// Work another screen owns is handed over, not answered here.
{const x=p('build me a goblin deck');assert.equal(x.intent,'build');assert.equal(x.call.tool,'build_deck');assert.equal(x.call.args.request,'build me a goblin deck');}
assert.equal(p('make a mono red deck under $50').call.tool,'build_deck');
assert.equal(p('can i respond to a ward trigger with a counterspell').call.tool,'judge');
assert.equal(p('what happens if two legendary creatures enter').call.tool,'judge');
// What the app's data cannot answer is said plainly; a card name stays a card name.
for(const q of ['is blue better than red','why is the sky blue','should i sell my cards'])assert.equal(p(q).call?.pick,'maybe',`"${q}" gets no made-up answer: only one try at the rulebook`);
assert.equal(p('is blue better than red').call.pick,'maybe','a question nothing else reads gets one try at the rulebook');
for(const q of ['lightning bolt','sheoldred','black lotus','atraxa grand unifier']){const x=p(q);assert.equal(x.intent,'names',`"${q}" is a plain name search`);assert.equal(x.call,null);}
// A search line typed by hand stays a search.
for(const q of ['c:r t:dragon f:standard','t:angel o:flying','usd<5 legendary'])assert.equal(p(q).intent,'names',`"${q}" is a search line`);
// Yu-Gi-Oh! cards carry no artist: said plainly.
{const x=p('yugioh cards by kazuki takahashi');assert.equal(x.answerable,false);assert.match(x.why,/artist/);}
// "Best" about a price is not a meta question; "my" keeps a question on the device.
assert.equal(p('most expensive deck in the meta').intent,'meta.best');
assert.notEqual(p('what is my best deck').call.tool,'meta_decks');
// With no format in the words: the tournament format last looked at, else Standard (never the first in the list).
assert.equal(p('best deck in the meta',{formatLast:{}}).call.args.format,'Standard');
assert.equal(p('best deck in the meta',{formatLast:{mtg:'EDH'}}).call.args.format,'Commander');
// A tapped chip overrides what was read, the words untouched.
assert.equal(p('best deck in the meta',{fix:{format:'Pioneer'}}).call.args.format,'Pioneer');
assert.equal(p('best deck in the meta',{fix:{game:'ptcg'}}).game,'ptcg');
assert.equal(p('how much is path to exile').call.args.name,'path to exile');
// Wiki titles.
assert.deepEqual(wikiTitles('who won worlds 2019','ygo').slice(0,1),['2019 World Championships']);
assert.equal(wikiTitles('who won the pro tour in 2001')[0],'2000–01 Pro Tour Season');
assert.deepEqual(wikiTitles('storm scale'),['storm scale']);
console.log('answer-search: '+CASES.length+' questions read correctly, plus hand-offs and honest misses');
