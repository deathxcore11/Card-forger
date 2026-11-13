// Every word of a question is used, said to be unusable, or the question is not answered. Seen on a phone in 0.4.72:
// "best red deck" answered with a blue deck, because the rule read "best" and "deck" and never looked at "red".
// These run the real planner, the real lookups (ai-tools.js) and the real answer writer over a small fixed tournament feed.
import assert from 'node:assert/strict';
import {planQuery,deckColors,rest} from './answer-search.js';
import {answerFor} from './answer-run.js';
import {makeAskTools} from './ai-tools.js';
import {esc} from './ui.js';

const C=(name,colors,type='Instant',extra={})=>({name,colors,type_line:type,prices:{usd:'1.00',usd_foil:'3.50'},legalities:{standard:'legal',modern:'banned',vintage:'restricted',pioneer:'not_legal'},...extra});
const CARDS=Object.fromEntries([
 C('Three Steps Ahead',['U']),C('Countersculpt',['U']),C('Memory Lapse',['U']),
 C('Monastery Swiftspear',['R'],'Creature — Human Monk'),C('Lightning Strike',['R']),C('Burst Lightning',['R']),
 C('Stormchaser Drake',['U'],'Creature — Drake'),C('Opt',['U']),
 C('Llanowar Elves',['G'],'Creature — Elf Druid'),C('Boros Charm',['R','W']),C('Sunfall',['W'],'Sorcery'),
 C('Mountain',[],'Basic Land — Mountain'),C('Island',[],'Basic Land — Island'),
].map(c=>[c.name.toLowerCase(),c]));
const deck=(key,name,rows)=>({key,name,place:'1st',event:'Standard Challenge',main:rows.map(([name,qty,land])=>({name,qty,land:!!land}))});
const data={source:'Fixture tournament',fetchedAt:'2026-11-13T10:00:00Z',
 decks:[
  deck('blue','Three Steps Ahead · Countersculpt',[['Three Steps Ahead',4],['Countersculpt',4],['Memory Lapse',4],['Island',24,true]]),
  deck('izzet','Izzet Prowess',[['Monastery Swiftspear',4],['Lightning Strike',4],['Stormchaser Drake',4],['Opt',4],['Island',10,true],['Mountain',10,true]]),
  deck('red','Mono-Red Aggro',[['Monastery Swiftspear',4],['Lightning Strike',4],['Burst Lightning',4],['Mountain',22,true]]),
  deck('boros','Boros Burn',[['Boros Charm',4],['Lightning Strike',4],['Sunfall',4],['Mountain',20,true]]),
 ],
 archetypes:[{name:'Three Steps Ahead · Countersculpt',best:'blue',share:.2,lists:20},{name:'Izzet Prowess',best:'izzet',share:.15,lists:15},{name:'Mono-Red Aggro',best:'red',share:.1,lists:10},{name:'Boros Burn',best:'boros',share:.05,lists:5}]};
const own=new Map([['monastery swiftspear',4],['lightning strike',4],['burst lightning',2],['mountain',30]]);
const myDecks=[
 {id:'a',name:'Goblin Rush',format:'Standard',cards:[{name:'Monastery Swiftspear',qty:4},{name:'Lightning Strike',qty:4},{name:'Mountain',qty:20}]},
 {id:'b',name:'Elf Ball',format:'Commander',cards:[{name:'Llanowar Elves',qty:4},{name:'Mountain',qty:1}]},
];
let known=true,fetched=[];
const tools=makeAskTools({S:{state:{settings:{},decks:myDecks,collection:[]},ui:{}},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data}),ui:()=>({})},esc,
 meta:n=>known?CARDS[String(n).toLowerCase()]||null:null,resolve:async()=>null,resolveNames:async names=>{fetched.push(...names);},
 inv:n=>({owned:own.get(String(n).toLowerCase())||0}),priceOf:()=>2,loadMetaData:async()=>data,metaState:()=>({data}),MTG_META_FORMATS:[['Standard','Standard'],['Modern','Modern']],
 mtgPower:d=>d.cards.length,shownPower:p=>p});
const ask=async(q,ctx={})=>{tools.reset?.();const plan=planQuery(q,{game:'mtg',formatLast:{mtg:'Standard'},sets:[{code:'blb',name:'Bloomburrow'}],screen:{},...ctx});return {plan,a:await answerFor(plan,tools,{cardSearch:async()=>[{name:'X',price:1}]})};};
const chips=p=>p.read.map(c=>c.label).join(' | ');

// --- The bug as seen: "red" is read, shown as a chip, and the answer is a deck with red in it, never the blue top deck.
let r=await ask('best red deck');
assert.match(chips(r.plan),/has red/,'the colour is shown in "Read as"');
assert.deepEqual(r.plan.call.args.colors,['r']);
assert.equal(r.a.strong,'Izzet Prowess','the most played deck with red in it, not the blue deck on top');
assert.match(r.a.say,/most played Standard deck with red in it right now: 15 lists, 15% of the field/);
assert.equal(r.a.items[0].ref,'izzet','the tile is the same deck as the sentence');
assert.match(r.a.note,/^Colours: blue, red · Best finish/,'the deck\'s colours are shown so the answer can be checked');
assert.equal(r.a.more[0].label,'Mono-Red Aggro','the next tiles are red decks too');
assert.ok(!JSON.stringify(r.a).includes('Countersculpt'),'the blue deck is nowhere on a red answer');

r=await ask('best mono red deck');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/most played mono-red Standard deck/);
r=await ask('best monored deck');assert.equal(r.a.strong,'Mono-Red Aggro','"monored" as one word');
r=await ask('best izzet deck');assert.equal(r.a.strong,'Izzet Prowess');assert.match(r.a.say,/most played Izzet Standard deck/);assert.match(chips(r.plan),/Izzet \(blue-red\)/);
r=await ask('best red white deck');assert.equal(r.a.strong,'Boros Burn');assert.match(r.a.say,/white-red Standard deck/);
r=await ask('best boros deck');assert.equal(r.a.strong,'Boros Burn');
r=await ask('best blue deck');assert.equal(r.a.strong,'Three Steps Ahead · Countersculpt','blue still finds the blue deck');
r=await ask('best deck not blue');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/with no blue/);
r=await ask('best two color deck');assert.equal(r.a.strong,'Izzet Prowess');assert.match(r.a.say,/2-colour Standard deck/);
// No deck of that colour: said plainly with the number of lists looked at, and no other deck passed off as it. Since 13 Nov
// 2026 the deck builder then makes one (test-answer-plain.mjs checks that end to end over the real feed).
r=await ask('best green deck');assert.equal(r.a.ok,true);assert.match(r.a.strong,/^No Standard deck with green in it is among the \d+ tournament lists right now\.$/);assert.equal(r.a.items.length,0);assert.equal(typeof r.a.finish,'function');assert.equal(r.a.more.length,0,'no list of another colour is shown as "closest" when none has green');
r=await ask('best golgari deck');assert.equal(r.a.ok,true);assert.match(r.a.strong,/^No Golgari Standard deck is among the \d+ tournament lists right now\.$/);
r=await ask('best mono white deck');assert.match(r.a.strong,/^No mono-white Standard deck is among the \d+ tournament lists right now\.$/);assert.equal(r.a.items.length,0);
// Card colours that cannot be loaded: said, not guessed. The missing cards were asked for in one batch.
known=false;fetched=[];r=await ask('best red deck');assert.equal(r.a.ok,false);assert.match(r.a.miss,/could not be loaded/);assert.ok(fetched.includes('Monastery Swiftspear')&&!fetched.includes('Mountain'),'nonland cards are fetched, lands are not');known=true;
// No colour words: the old answer, unchanged.
r=await ask('best deck in the meta');assert.equal(r.a.strong,'Three Steps Ahead · Countersculpt');assert.match(r.a.say,/^is the most played Standard deck right now: 20 lists, 20% of the field\.$/);

// --- Other words the same rule used to drop.
r=await ask('best aggro deck');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/most played aggro Standard deck/);
r=await ask('best prowess deck in standard');assert.equal(r.a.strong,'Izzet Prowess');
r=await ask('best deck with lightning strike');assert.equal(r.a.strong,'Izzet Prowess');assert.match(r.a.say,/Standard deck that plays Lightning Strike/);
r=await ask('best control deck');assert.equal(r.a.ok,true);assert.match(r.a.strong,/^No Standard deck among the \d+ tournament lists is named "control" or plays a card named "control" right now\.$/);assert.equal(typeof r.a.finish,'function','a play style the builder knows is built');
r=await ask('best charizard deck');assert.equal(r.a.ok,false,'a word from another game is not dropped');
r=await ask('second best deck in standard');assert.equal(r.a.strong,'Izzet Prowess');assert.match(r.a.say,/2nd most played Standard deck/);assert.equal(r.a.items[0].ref,'izzet');
r=await ask('second best mono red deck');assert.equal(r.a.ok,false);assert.match(r.a.miss,/^Only 1 mono-red Standard deck is among/);
r=await ask('best deck last year');assert.equal(r.a.ok,false);assert.match(r.a.miss,/only covers recent events/);
r=await ask('best deck in 2019');assert.equal(r.a.ok,false);
r=await ask('which meta deck am i closest to');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/closest to your collection: you own 94% of it, about \$4\.00 to finish/);
r=await ask('best deck i can build');assert.equal(r.plan.call.args.sort,'closest');
r=await ask('cheapest deck in standard');assert.equal(r.plan.intent,'meta.best','a deck question is not a card search');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/cheapest Standard deck to finish from your collection: about \$4\.00/);
r=await ask('best deck under $10');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/costs you \$10 or less to finish/);
r=await ask('best deck under $1');assert.equal(r.a.ok,false);assert.match(r.a.miss,/costs you \$1 or less to finish/);

// --- Your own decks: format, colour and name words narrow them.
r=await ask('my best red deck');assert.equal(r.a.strong,'Goblin Rush');assert.match(r.a.say,/has red/);
r=await ask('my commander decks');assert.equal(r.a.items.length,1);assert.equal(r.a.items[0].label,'Elf Ball');
r=await ask('my blue decks');assert.equal(r.a.ok,false);assert.equal(r.a.miss,'None of your saved decks match: has blue.');
r=await ask('open my goblin deck');assert.equal(r.a.items[0].label,'Goblin Rush');
r=await ask('my newest deck');assert.equal(r.a.ok,false,'no made-up "newest"');
r=await ask('how many decks do i have');assert.match(r.a.say,/You have 2 saved decks/);
r=await ask('how much are my decks worth');assert.equal(r.a.ok,false);assert.match(r.a.miss,/can't total/);

// --- Your collection.
for(const q of ['my most valuable red card','how many red cards do i own','how many foils do i own','do i own a foil lightning strike']){r=await ask(q);assert.equal(r.a.ok,false,q);assert.match(r.a.miss,/can't narrow your collection by/,q);}
assert.equal(planQuery('what is my most valuable card',{}).intent,'collection.top');
assert.equal(planQuery('how many cards do i have',{}).intent,'collection.value');
r=await ask('how many lightning strikes do i have');assert.equal(r.a.strong,'Lightning Strike','a plural card name is still that card');assert.match(r.a.say,/you own 4/);

// --- Prices and sets.
r=await ask('how much is a foil lightning strike');assert.equal(r.plan.call.args.name,'lightning strike');assert.match(r.a.say,/\$3\.50 in foil/);
r=await ask('how much is lightning strike from bloomburrow');assert.equal(r.a.ok,false);assert.match(r.a.miss,/one printing/);
let p=planQuery('most expensive red card in bloomburrow',{sets:[{code:'blb',name:'Bloomburrow'}]});assert.equal(p.call.args.q,'set:blb c:r');assert.equal(p.call.args.dir,'desc');
p=planQuery('cheapest mythic in bloomburrow',{sets:[{code:'blb',name:'Bloomburrow'}]});assert.equal(p.call.args.q,'set:blb r:mythic');assert.equal(p.call.args.dir,'asc');
p=planQuery('most expensive foil in bloomburrow',{sets:[{code:'blb',name:'Bloomburrow'}]});assert.equal(p.answerable,false);assert.match(p.why,/"foil"/);
p=planQuery('most expensive card in bloomburrow',{sets:[{code:'blb',name:'Bloomburrow'}]});assert.equal(p.intent,'set.rank','no extra words: unchanged');
assert.notEqual(planQuery('when does bloomburrow rotate',{sets:[{code:'blb',name:'Bloomburrow'}]}).intent,'set.info','"rotate" is not a release date');
assert.notEqual(planQuery('newest commander set',{}).intent,'set.rank-sets','"commander" is not dropped from a set question');

// --- Artists.
assert.equal(planQuery('black cards',{}).intent,'cards.filter','a colour is not an artist');
assert.equal(planQuery('black cards',{}).call.args.q,'c:b');
assert.notEqual(planQuery('cards that draw cards',{}).intent,'cards.artist');
assert.equal(planQuery('red cards by john avon',{}).call.args.q,'a:"john avon" c:r');
assert.equal(planQuery('cards by rebecca guay in bloomburrow',{sets:[{code:'blb',name:'Bloomburrow'}]}).call.args.q,'a:"rebecca guay" set:blb');
assert.equal(planQuery('cards by rebecca guay',{}).call.args.value,'rebecca guay','a plain artist question is unchanged');

// --- Legality from the card's own data.
r=await ask('is lightning strike legal in standard');assert.equal(r.a.strong,'Lightning Strike');assert.equal(r.a.say,'is legal in Standard.');
r=await ask('is lightning strike banned in modern');assert.equal(r.a.say,'is banned in Modern.');
r=await ask('is lightning strike legal in pioneer');assert.equal(r.a.say,'is not legal in Pioneer.');
r=await ask('is lightning strike restricted in vintage');assert.match(r.a.say,/restricted in Vintage/);

// --- Card filters leave no word over.
assert.equal(planQuery('red creatures with flying under $5',{}).call.args.q,'c:r t:creature keyword:"flying" usd<5');
assert.equal(planQuery('red creatures that win the game',{}).intent,'names','words the filter cannot read stop it answering');

// --- Everyday wording keeps working: filler words are not mistaken for a deck or card name.
for(const q of ['what deck is winning the most in modern','what deck should i play in modern','top 5 modern decks','best deck to play in modern right now','most played deck in modern this week','show me the best modern decks']){const x=planQuery(q,{});assert.equal(x.intent,'meta.best',q);assert.deepEqual(x.call.args,{game:'mtg',format:'Modern'},q+' has no leftover word: '+JSON.stringify(x.call.args));}
assert.equal(planQuery("what's the price of ragavan",{}).call.args.name,'ragavan');
assert.equal(planQuery('whats the one ring worth',{}).call.args.name,'the one ring');
assert.equal(planQuery('good red decks in standard',{}).call.args.colors[0],'r');
// --- Pokémon and Yu-Gi-Oh!: legality and ban list status from the card's own data; kinds of card are not artists.
{
 const pk={id:'p1',name:'Charizard ex',legal:{standard:true,expanded:false},prices:{usd:20}},yg={id:'y1',name:'Pot of Greed',ban:{tcg:'banned',ocg:'limited',goat:'limited'},prices:{usd:1}},free={id:'y2',name:'Dark Magician',ban:{tcg:null,ocg:null,goat:null},prices:{usd:1}};
 const src=cards=>({byName:async q=>cards.find(c=>c.name.toLowerCase()===String(q).toLowerCase())||null,search:async()=>({cards:[]}),ownKey:c=>'id:'+c.id,formats:[]});
 const T2={game:()=>'ptcg',cache:{ptcg:{},ygo:{}},cardOf:()=>null,gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data:null}),ui:()=>({}),ensureCard:async()=>null,SOURCES:{ptcg:src([pk]),ygo:src([yg,free])},setCardOwnedCount:()=>0};
 const t2=makeAskTools({S:{state:{settings:{},decks:[],collection:[]},ui:{}},T:T2,esc,meta:()=>null,inv:()=>({owned:0}),priceOf:()=>null});
 const ask2=async(game,q)=>{const plan=planQuery(q,{game,formatLast:{},sets:[],screen:{}});return {plan,a:await answerFor(plan,t2,{})};};
 let x=await ask2('ptcg','is charizard ex legal in standard');assert.equal(x.a.strong,'Charizard ex');assert.equal(x.a.say,'is legal in Standard.');
 x=await ask2('ptcg','is charizard ex legal in expanded');assert.equal(x.a.say,'is not legal in Expanded.');
 x=await ask2('ygo','is pot of greed banned');assert.equal(x.a.say,'is Forbidden on the TCG list: no copies allowed.');
 x=await ask2('ygo','is pot of greed banned in the ocg');assert.equal(x.a.say,'is Limited on the OCG list: 1 copy allowed.');
 x=await ask2('ygo','is pot of greed legal in goat');assert.equal(x.a.say,'is Limited on the Goat format list: 1 copy allowed.');
 x=await ask2('ygo','is dark magician limited');assert.equal(x.a.say,'is not on the TCG Forbidden & Limited list: 3 copies allowed.');
 x=await ask2('ygo','is dark magician legal in edison');assert.equal(x.a.ok,false);assert.match(x.a.miss,/no Edison list status/);
 x=await ask2('ygo','is some card nobody made banned');assert.equal(x.a.ok,false);assert.match(x.a.miss,/No Yu-Gi-Oh! card named/);
 for(const [g,q] of [['ptcg','trainer cards'],['ptcg','supporter cards'],['ygo','spell cards'],['ygo','trap cards']])assert.notEqual(planQuery(q,{game:g}).intent,'cards.artist',q+' is a kind of card, not an artist');
 for(const [g,q] of [['ptcg','how much is a holo charizard'],['ygo','how much is a 1st edition blue eyes white dragon']]){x=await ask2(g,q);assert.equal(x.a.ok,false,q);assert.match(x.a.miss,/finish, edition or rarity/);}
}
// --- The helpers.
assert.deepEqual(rest('best red deck in standard',/\b(?:best|deck|standard)\b/g),['red']);
assert.deepEqual(deckColors('best esper deck').colors.sort(),['b','u','w']);
assert.equal(deckColors('best deck'),null);
// Pokémon and Yu-Gi-Oh! decks have no Magic colours: the word is matched against deck and card names instead.
p=planQuery('best fire deck pokemon',{});assert.equal(p.call.args.match,'fire');assert.equal(p.call.args.colors,undefined);
console.log('answer-words: colour, name, card, price, time and "my" words are used or said to be unusable; none is dropped');
