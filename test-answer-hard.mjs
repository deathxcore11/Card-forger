// The hard round (Randall, 13 Nov 2026): questions that are misspelled, said in the wrong order, said in a long-winded way,
// or that hold several asks about the same deck. The rule from test-answer-words.mjs still holds for every one of them:
// each word is used, shown as not used, or the question is not answered. Nothing here calls a model.
import assert from 'node:assert/strict';
import {planQuery,respell,buildLeftover,readPod} from './answer-search.js';
import {answerFor,buildRequest,readPower,answerMarkup} from './answer-run.js';
import {makeAskTools} from './ai-tools.js';
import {esc} from './ui.js';

const SETS={mtg:[{code:'blb',name:'Bloomburrow'},{code:'fdn',name:'Foundations'},{code:'dsk',name:'Duskmourn: House of Horror'},{code:'mh3',name:'Modern Horizons 3'}],
 ptcg:[{id:'sv8',name:'Surging Sparks'},{id:'sv3pt5',name:'151'},{id:'swsh7',name:'Evolving Skies'}],
 ygo:[{id:'LOB',code:'LOB',name:'Legend of Blue Eyes White Dragon'},{id:'ROTA',code:'ROTA',name:'Rage of the Abyss'}]};
const P=(q,game='mtg',ctx={})=>planQuery(q,{game,formatLast:{},sets:SETS[game],screen:{},...ctx});
const chips=p=>p.read.map(c=>c.label).join(' | ');
const B=(q,game='mtg',ctx={})=>{const p=P(q,game,ctx);assert.equal(p.intent,'build',q+' goes to the deck builder, got '+p.intent);return {p,...buildRequest(p.call.args.request,p.game,p.call.args.format,{seed:p.call.args.seed})};};

// ---- 1. Randall's own questions, word for word.
let p=P('what is the 2026 best blue and red deck?');
assert.equal(p.call.tool,'meta_decks');assert.deepEqual(p.call.args.colors,['u','r']);assert.equal(p.call.args.exact,true,'blue and red is exactly those two colours');
p=P('what is the 2019 best blue and red deck?');
assert.equal(p.answerable,false,'another year is not answered with this year\'s decks');assert.match(p.why,/only covers recent events/);

let b=B('I have this commander, can you make me a tier 2 deck?','mtg',{screen:{card:{name:"Atraxa, Praetors' Voice"}}});
assert.deepEqual(b.request,{game:'mtg',format:'Commander',power:'strong',seed:"Atraxa, Praetors' Voice"},'"this commander" is the card that is open, and "tier 2" is the builder\'s Strong power');
assert.deepEqual(b.unused,[],'every word is used');assert.ok(b.labels.includes('tier 2: strong power'));
b=B('I have this commander, can you make me a tier 2 deck?');
assert.equal(b.request.format,'Commander');assert.ok(!b.request.seed,'with no card open there is no commander to build around');

b=B('what is the funnest deck I can play with mono red and my friend has a blue deck?');
assert.deepEqual(b.request.colors,['R']);assert.ok(b.labels.includes('a fun deck'));assert.equal(b.p.call.opponent,'blue');
assert.match(chips(b.p),/against blue/,'the friend\'s deck is read and shown');assert.ok(!b.request.colors.includes('U'),'the friend\'s colour is not put in my deck');

b=B('what is a really fun commander deck that utilizes angels and flying?');
assert.equal(b.request.format,'Commander');assert.equal(b.request.theme,'Angels');assert.equal(b.request.style,'flying','the second theme reaches the builder as its style');assert.equal(b.request.goal,'fun');assert.deepEqual(b.unused,[]);

b=B("what's a really cool Blue Eyes White Dragon deck that would surprise my friend?",'ygo');
assert.equal(b.request.seed,'blue eyes white dragon');assert.deepEqual(b.unused,['would surprise my friend']);
assert.ok(!b.request.colors&&!b.request.format,'Yu-Gi-Oh! has no colours, and "blue" and "white" are part of the card\'s name');

b=B('what is a ramp deck that I can purchase for under $50?');
assert.equal(b.request.budget,'50');assert.deepEqual(b.unused,[]);assert.equal(b.request.style,'ramp','"ramp" is a play style the builder fills more of');

// ---- 1b. A whole table in one breath (Randall, 13 Nov 2026, as dictated).
const POD="I'm playing in a pod with three other people. They have a blue, white, a red, blue, and a black mono deck, and I have this commander, and I'm trying to make it within their power level or within their bracket, so we're all having fun. And I would like it to. And I noticed last time we played, a lot of them didn't have reach, so I would like to have flying if that's possible.";
b=B(POD,'mtg',{screen:{card:{name:"Atraxa, Praetors' Voice"}}});
assert.deepEqual(b.p.call.pod,{size:4,decks:[{colors:['u','w'],label:'white-blue'},{colors:['r','u'],label:'blue-red'},{colors:['b'],label:'mono-black'}],power:true,lacks:['reach']},'three other decks, their power, and what they lacked');
assert.deepEqual(b.request,{game:'mtg',format:'Commander',theme:'Flying',seed:"Atraxa, Praetors' Voice",goal:'fun'},'my deck: Commander, this commander, flying, fun');
assert.ok(!b.request.colors,"the other players' colours are not put in my deck");assert.deepEqual(b.unused,[],'no word is left over');
assert.equal(chips(b.p),"Magic | deck builder | Atraxa, Praetors' Voice | pod of 4 | against white-blue · blue-red · mono-black | match the pod's power | pod lacks reach");
b=B('im in a pod with 3 other players, they play azorius, izzet and mono black. build me a fun commander deck with flying around this commander that matches their power level','mtg',{screen:{card:{name:'Sol Ring'}}});
assert.deepEqual(b.p.call.pod.decks.map(d=>d.label),['white-blue','blue-red','mono-black']);assert.equal(b.p.call.pod.power,true);
assert.deepEqual(b.request,{game:'mtg',format:'Commander',theme:'Flying',seed:'Sol Ring',goal:'fun'});
b=B('my friends play mono green, rakdos and a five color deck, make me a commander deck that can keep up');
assert.deepEqual(b.p.call.pod.decks.map(d=>d.label),['mono-green','black-red','five color']);assert.equal(b.request.format,'Commander');
assert.equal(readPod('make me a dragon deck'),null);assert.equal(readPod('what is the best red deck'),null);assert.equal(readPod('they have a lot of cards in bloomburrow'),null);

// ---- 2. Deck requests in all three games: every word lands in a setting or in "not used".
for(const [game,q,want,unused] of [
 ['mtg','recommend a cheap pauper deck with goblins',{format:'Pauper',theme:'Goblins'},[]],
 ['mtg','i want a casual elf deck for commander under 100 dollars',{format:'Commander',theme:'Elves',budget:'100'},[]],
 ['mtg','is there a good zombie deck i can build with only cards i own',{theme:'Zombies',budgetBasis:'owned'},[]],
 ['mtg','give me a spicy dragon deck',{theme:'Dragon'},['spicy']],
 ['mtg','build me a bracket 3 izzet commander deck',{format:'Commander',colors:['U','R'],power:'focused',bracket:3},[]],
 ['ptcg','i want a fun pikachu deck',{seed:'pikachu'},[]],
 ['ptcg','make me a charizard deck under $40',{seed:'charizard',budget:'40'},[]],
 ['ygo','what yugioh deck can i buy for under $60',{budget:'60'},[]],
 ['ygo','build a dark magician deck',{seed:'dark magician'},[]],
]){
 b=B(q,game);
 for(const [k,v] of Object.entries(want))assert.deepEqual(b.request[k],v,`${q}: ${k}`);
 assert.deepEqual(b.unused,unused,q+': words not used');
}
// The leftover rule itself: nothing vanishes.
assert.deepEqual(buildLeftover('make me a tier 2 goblin deck','mtg',['goblin']),['tier 2']);
assert.deepEqual(buildLeftover('a fun red deck','mtg',[]),[]);

// ---- 3. Spelling. One slip in a word the search knows is repaired and shown; the reading is the same as with the word spelled right.
const same=(a,b,msg)=>{assert.equal(a.intent,b.intent,msg);assert.deepEqual(a.call,b.call,msg);};
for(const [bad,good,game='mtg'] of [
 ['bset modren deck','best modern deck'],['cheepest standrd deck','cheapest standard deck'],['best dimir dcek in pionere','best dimir deck in pioneer'],
 ['commnader deck best','commander deck best'],['whats the most expnsive card in bloomburow','whats the most expensive card in bloomburrow'],
 ['what is the best pokmon deck','what is the best pokemon deck'],['best izzet deck in legcay','best izzet deck in legacy'],
 ['most valueable card in my colection','most valuable card in my collection'],['newst set','newest set'],
 ['best standrad deck','best standard deck','ptcg'],['best expnaded deck','best expanded deck','ptcg'],
 ['is pot of greed bannd','is pot of greed banned','ygo'],['is pot of greed forbiden','is pot of greed forbidden','ygo'],
]){
 const a=P(bad,game),g=P(good,game);same(a,g,`"${bad}" reads as "${good}"`);
 assert.match(chips(a),/read as/,`"${bad}" shows what was repaired`);
}
// A card's own name is never "corrected", and a question that already reads is left alone.
for(const q of ['how much is commandeer','rest in peace price','how much is bolt','is the one ring legal in modern'])assert.ok(!/read as/.test(chips(P(q))),q+' is not respelled');
assert.equal(P('how much is commandeer').call.args.name,'commandeer');
assert.deepEqual(respell('best brun deck').fixes,[],'a four-letter word is not guessed at');

// Generated: every long search word in these questions, with two letters swapped, a letter dropped, and a letter doubled.
const BASES=[
 ['mtg','best standard deck'],['mtg','best modern deck'],['mtg','cheapest pioneer deck'],['mtg','best legacy deck'],['mtg','best vintage deck'],['mtg','best pauper deck'],
 ['mtg','best commander deck'],['mtg','best azorius deck in modern'],['mtg','best rakdos deck'],['mtg','best golgari deck in pioneer'],['mtg','best selesnya deck'],
 ['mtg','best orzhov deck'],['mtg','best gruul deck'],['mtg','best simic deck'],['mtg','best boros deck in standard'],['mtg','most expensive card in bloomburrow'],
 ['mtg','cheapest card in foundations'],['mtg','most valuable card in my collection'],['mtg','what is the newest set'],['mtg','second best modern deck'],
 ['mtg','most popular deck in standard'],['mtg','closest tournament deck to my collection'],['mtg','most expensive mythic in bloomburrow'],
 ['ptcg','best standard deck'],['ptcg','best expanded deck'],['ptcg','most expensive card in surging sparks'],['ptcg','cheapest standard deck'],['ptcg','most expensive card in evolving skies'],
 ['ygo','best advanced deck'],['ygo','most expensive card in rage of the abyss'],['ygo','cheapest advanced deck'],['ygo','is pot of greed forbidden'],['ygo','is pot of greed limited'],
];
let typos=0;const wrong=[];
for(const [game,q] of BASES){
 const good=P(q,game),words=q.split(' ');
 assert.ok(good.answerable,q+' is answered as typed');
 words.forEach((w,i)=>{
  if(w.length<6)return;const m=Math.floor(w.length/2);
  for(const t of new Set([w.slice(0,m-1)+w[m]+w[m-1]+w.slice(m+1),w.slice(0,m)+w.slice(m+1),w.slice(0,m)+w[m]+w.slice(m)])){
   if(t===w)continue;
   const bad=[...words.slice(0,i),t,...words.slice(i+1)].join(' '),a=P(bad,game);typos++;
   if(a.intent!==good.intent||JSON.stringify(a.call)!==JSON.stringify(good.call))wrong.push(`${game} | ${bad} | want ${JSON.stringify(good.call)} | got ${a.intent} ${JSON.stringify(a.call||a.why||'')}`);
  }
 });
}
if(wrong.length)console.log(wrong.join('\n'));
assert.equal(wrong.length,0,wrong.length+' of '+typos+' misspelled questions are read differently from the same question spelled right');

// ---- 4. Wrong order: the same words in another order get the same reading.
for(const [good,...others] of [
 ['best red deck in standard','deck red best standard','standard best red deck','in standard what is the best red deck','red deck standard best','standard red deck that is the best'],
 ['best deck in modern','in modern what deck is the best','modern deck best','deck best modern','whats best in modern for a deck'],
 ['most expensive card in bloomburrow','bloomburrow most expensive card','in bloomburrow what is the most expensive card','card most expensive bloomburrow'],
 ['cheapest mono red deck in standard','standard deck cheapest mono red','mono red standard deck cheapest','in standard the cheapest mono red deck'],
 ['best izzet deck in pioneer','pioneer izzet deck best','izzet pioneer best deck','in pioneer best deck izzet'],
]){const g=P(good);for(const q of others)same(P(q),g,`"${q}" reads as "${good}"`);}
for(const [good,...others] of [['best deck in expanded','expanded deck best','in expanded what deck is best'],['most expensive card in surging sparks','surging sparks most expensive card']])
 {const g=P(good,'ptcg');for(const q of others)same(P(q,'ptcg'),g,`pokemon "${q}" reads as "${good}"`);}

// ---- 5. Long-winded: the filler goes, the facts stay.
p=P('hey so i was wondering what the absolute best mono red deck in standard is right now');
assert.deepEqual([p.call.args.format,p.call.args.colors,p.call.args.exact],['Standard',['r'],true]);
p=P('ok can you please tell me what the cheapest deck is that i could play in pioneer');
assert.deepEqual([p.call.args.format,p.call.args.sort],['Pioneer','cheapest']);
p=P('which mono red deck beats control');
assert.deepEqual(p.call.args.colors,['r']);assert.equal(p.call.opponent,'control','the other deck is read, not dropped');
p=P('best deck against blue');assert.equal(p.call.opponent,'blue');assert.ok(!p.call.args.colors,'"against blue" does not ask for a blue deck');

// ---- 6. Several asks on one line, answered in order, end to end over a small fixed feed.
const C=(name,colors,type='Instant',extra={})=>({name,colors,type_line:type,prices:{usd:'1.00'},legalities:{standard:'legal',modern:'banned',commander:'legal'},...extra});
const CARDS=Object.fromEntries([C('Three Steps Ahead',['U']),C('Countersculpt',['U']),C('Monastery Swiftspear',['R'],'Creature'),C('Lightning Strike',['R']),C('Burst Lightning',['R']),C('Stormchaser Drake',['U'],'Creature'),C('Opt',['U']),C('Sol Ring',[],'Artifact'),C('Mountain',[],'Basic Land — Mountain'),C('Island',[],'Basic Land — Island')].map(c=>[c.name.toLowerCase(),c]));
const deck=(key,name,rows)=>({key,name,place:'1st',event:'Standard Challenge',main:rows.map(([name,qty,land])=>({name,qty,land:!!land}))});
const data={source:'Fixture tournament',fetchedAt:'2026-11-13T10:00:00Z',decks:[
 deck('blue','Three Steps Ahead · Countersculpt',[['Three Steps Ahead',4],['Countersculpt',4],['Opt',4],['Island',24,true]]),
 deck('izzet','Izzet Prowess',[['Monastery Swiftspear',4],['Lightning Strike',4],['Stormchaser Drake',4],['Opt',4],['Island',10,true],['Mountain',10,true]]),
 deck('red','Mono-Red Aggro',[['Monastery Swiftspear',4],['Lightning Strike',4],['Burst Lightning',4],['Mountain',22,true]])],
 archetypes:[{name:'Three Steps Ahead · Countersculpt',best:'blue',share:.2,lists:20},{name:'Izzet Prowess',best:'izzet',share:.15,lists:15},{name:'Mono-Red Aggro',best:'red',share:.1,lists:10}]};
const own=new Map([['monastery swiftspear',4],['lightning strike',4],['mountain',30],['sol ring',2]]);
const tools=makeAskTools({S:{state:{settings:{},decks:[],collection:[]},ui:{}},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data}),ui:()=>({})},esc,
 meta:n=>CARDS[String(n).toLowerCase()]||null,resolve:async n=>CARDS[String(n).toLowerCase()]||null,resolveNames:async()=>{},
 inv:n=>({owned:own.get(String(n).toLowerCase())||0}),priceOf:()=>2,loadMetaData:async()=>data,metaState:()=>({data}),MTG_META_FORMATS:[['Standard','Standard'],['Modern','Modern']],mtgPower:d=>d.cards.length,shownPower:x=>x});
const ask=async(q,ctx={},game='mtg')=>{const plan=P(q,game,{formatLast:{mtg:'Standard'},...ctx});return {plan,a:await answerFor(plan,tools,{cardSearch:async()=>[]})};};

let r=await ask('what is the best red deck, how much does it cost and where did it place?');
assert.equal(r.a.strong,'Izzet Prowess');assert.equal(r.plan.extra.length,2);
assert.deepEqual(r.a.also.map(x=>x.ask),['how much does it cost','where did it place'],'each further ask is answered in the order asked');
assert.match(r.a.also[0].text,/to finish|no price|no total/,'the cost is the same deck\'s cost');assert.equal(r.a.also[1].text,'Best finish: 1st Standard Challenge.');
assert.ok(!('facets' in r.a),'working facts are not left on the answer');
const html=answerMarkup(r.a,r.plan.read,{esc});assert.match(html,/answer-also"><b>how much does it cost<\/b>/,'the further asks are drawn under the first answer');

r=await ask('best mono red deck? what colors is it? how do i beat it');
assert.equal(r.a.strong,'Mono-Red Aggro');assert.equal(r.a.also[0].text,'Its colours: red.');
assert.match(r.a.also[1].text,/Ask "what beats it" on its own line and the app simulates the matchups/,'a matchup ask on a shared line points at the simulation, never guesses');

r=await ask('best green deck and how much does it cost');
assert.equal(r.a.ok,false);assert.match(r.a.also[0].text,/Not answered, because the first part found nothing/,'a follow-up about a deck that was not found is not answered from another deck');

r=await ask('which mono red deck beats control');
assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.vs[0].text,/can't rank decks by how they do against control/,'the answer says it is by play share, not by matchup');

r=await ask('how much is sol ring and is it legal in commander and do i own it');
assert.equal(r.plan.call.args.name,'sol ring');assert.deepEqual(r.plan.extra.map(e=>[e.plan.intent,e.plan.call.args.name]),[['card.legal','sol ring'],['collection.own','sol ring']],'"it" is the card just asked about');
assert.equal(r.a.also.length,2);for(const x of r.a.also)assert.ok(x.text&&!/can't answer/.test(x.text),x.ask+' is answered: '+x.text);

r=await ask('whats the best deck in standard and what is the newest set');
assert.equal(r.plan.extra[0].plan.intent,'set.rank-sets','a second ask about something else is its own lookup');

// A deck request with a friend's deck: the builder opens with what it took, and says what it could not take.
r=await ask('what is the funnest deck I can play with mono red and my friend has a blue deck');
assert.equal(r.a.buttons[0].label,'Open the deck builder');assert.deepEqual(r.a.buttons[0].build.colors,['R']);
assert.deepEqual(r.a.rows,[{label:'Colours',value:'red'},{label:'Answers for',value:'blue'},{label:'Goal',value:'a fun deck'}]);assert.deepEqual(r.a.buttons[0].build.against,['U']);assert.match(r.a.note,/does not know how the matchup plays/);
r=await ask(POD,{screen:{card:{name:'Sol Ring'}}});
assert.deepEqual(r.a.rows,[{label:'Format',value:'Commander'},{label:'Built around',value:'Sol Ring'},{label:'Theme',value:'flying (the pod lacks reach)'},{label:'Answers for',value:'white, blue, black, red'},{label:'Goal',value:'a fun deck'}]);
assert.match(r.a.note,/pod's power is not known to the app\. Add a bracket/,'a pod power with no number is said, not guessed');
assert.deepEqual(r.a.buttons[0].build,{game:'mtg',format:'Commander',theme:'Flying',against:['W','U','B','R'],seed:'Sol Ring',goal:'fun'});
// The deck brief (idea 2): a power target, a play style and the other decks' colours all reach the builder.
r=await ask('im in a pod with 3 other players, they play azorius, izzet and mono black. build me a fun bracket 3 commander ramp deck with flying around this commander under $100 with lots of dragons',{screen:{card:{name:'Sol Ring'}}});
assert.deepEqual(r.a.buttons[0].build,{game:'mtg',format:'Commander',theme:'Flying',style:'dragon ramp',power:'focused',bracket:3,against:['W','U','B','R'],seed:'Sol Ring',budget:'100',goal:'fun'});
assert.deepEqual(r.a.rows.map(x=>x.label+': '+x.value),['Format: Commander','Built around: Sol Ring','Themes: flying, dragon','Play style: more ramp','Power: bracket 3 (Upgraded)','Answers for: white, blue, black, red','Budget: under $100','Goal: a fun deck']);
assert.ok(!/power is not known/.test(r.a.note),'with a bracket said, nothing is missing');
r=await ask('make me a tier 2 control deck with lots of card draw in modern');
assert.deepEqual(r.a.buttons[0].build,{game:'mtg',format:'Modern',style:'control card draw',power:'strong'});assert.equal(r.a.note,'');
assert.deepEqual(readPower('power level 7'),{power:'strong',label:'power level 7: strong power',said:'power level 7'});assert.equal(readPower('bracket 9'),null);assert.equal(readPower('a cedh deck').power,'max');
r=await ask('build a pikachu deck that beats my friends charizard deck',{},'ptcg');
assert.match(r.a.note,/can't tune a deck against charizard yet/);
r=await ask('I have this commander, can you make me a tier 2 deck',{screen:{card:{name:'Sol Ring'}}});
assert.equal(r.a.buttons[0].build.seed,'Sol Ring');assert.equal(r.a.buttons[0].build.power,'strong');assert.ok(r.a.rows.some(x=>x.label==='Power'&&x.value==='tier 2: strong power'));

// ---- 6b. Follow-up chips: the answer remembers what "it" is (idea 1 of the approved mock-up).
{
 const {answerAbout,forgetAnswer}=await import('./answer-run.js');forgetAnswer();
 let r=await ask('best mono red deck');
 assert.deepEqual(answerAbout(),{kind:'meta',game:'mtg',format:'Standard',key:'red',name:'Mono-Red Aggro'});
 assert.deepEqual(r.a.follow.map(f=>f.label),['What does it cost me?','How much do I own?',"What's in it?",'Where did it place?','What beats it?']);
 assert.match(answerMarkup(r.a,r.plan.read,{esc}),/data-answer-ask="what cards are in it">What&#39;s in it\?<|data-answer-ask="what cards are in it">What's in it\?</);
 // Each chip is a whole question the search answers about that same deck, also when typed by hand on the next line.
 for(const f of r.a.follow){
  const x=await ask(f.q,{about:answerAbout()});
  if(f.q==='what beats it'){assert.equal(x.plan.intent,'meta.matchup');assert.deepEqual(chips(x.plan).split(' | ').slice(0,2),['Magic','Mono-Red Aggro']);continue;}
  assert.equal(x.plan.intent,'meta.about',f.q);assert.equal(x.a.strong,'Mono-Red Aggro',f.q+' is about the same deck');
  assert.deepEqual(chips(x.plan).split(' | ').slice(0,2),['Magic','Mono-Red Aggro']);
  assert.ok(!x.a.follow.some(y=>y.q===f.q),'the chip just asked is not offered again');
 }
 let x=await ask('what cards are in it',{about:answerAbout()});
 assert.deepEqual(x.a.rows.map(r=>r.label),['Monastery Swiftspear','Lightning Strike','Burst Lightning'],'its own cards, lands left out');
 assert.equal(x.a.rows[0].value,'×4 · you own 4');assert.equal(x.a.rows[2].value,'×4');
 x=await ask('how much is it',{about:answerAbout()});assert.match(x.a.say,/^: (?:About \$|Some of its cards have no price)/);
 x=await ask('what beats it',{about:answerAbout()});assert.equal(x.plan.intent,'meta.matchup','"what beats it" is the app\'s matchup simulation of that deck');assert.equal(x.plan.call.tool,'deck_matchup');
 // Words that name something else are a new question, and with nothing remembered "it" is not guessed.
 x=await ask('is it better than izzet prowess',{about:answerAbout()});assert.notEqual(x.plan.intent,'meta.about');
 x=await ask('how much is lightning strike',{about:answerAbout()});assert.equal(x.plan.intent,'card.price');
 forgetAnswer();x=await ask('how much does it cost');assert.notEqual(x.plan.intent,'meta.about');
}

// ---- 7. Seen on a phone, 13 Nov 2026: "best mono red deck" sat on "Looking…" for ever. The colours now come with the feed
// from the server, so no card is looked up; and no answer may wait for ever, whatever the connection does.
{
 const withColors={...data,decks:data.decks.map(d=>({...d,colors:{blue:'u',izzet:'ur',red:'r'}[d.key]}))};let lookups=0;
 const t2=makeAskTools({S:{state:{settings:{},decks:[],collection:[]},ui:{}},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data:withColors}),ui:()=>({})},esc,
  meta:()=>null,resolve:async()=>{lookups++;return null;},resolveNames:async()=>{lookups++;},inv:()=>({owned:0}),priceOf:()=>null,loadMetaData:async()=>withColors,metaState:()=>({data:withColors}),MTG_META_FORMATS:[['Standard','Standard']],mtgPower:()=>0,shownPower:x=>x});
 let a=await answerFor(P('best mono red deck','mtg',{formatLast:{mtg:'Standard'}}),t2,{});
 assert.equal(a.strong,'Mono-Red Aggro');assert.ok(lookups<=3,'the feed carries each deck\'s colours: only the three tiles\' pictures are looked up, not every card of every deck ('+lookups+')');
 // A feed without colours on a connection that never answers: a plain sentence after the wait, not an endless spinner.
 const t3=makeAskTools({S:{state:{settings:{},decks:[],collection:[]},ui:{}},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data}),ui:()=>({})},esc,colorWaitMs:60,
  meta:()=>null,resolve:async()=>null,resolveNames:()=>new Promise(()=>{}),inv:()=>({owned:0}),priceOf:()=>null,loadMetaData:async()=>data,metaState:()=>({data}),MTG_META_FORMATS:[['Standard','Standard']],mtgPower:()=>0,shownPower:x=>x});
 a=await answerFor(P('best mono red deck','mtg',{formatLast:{mtg:'Standard'}}),t3,{});
 assert.equal(a.ok,false);assert.match(a.miss,/still loading on this connection\. Ask again in a moment/);
 const stuck={...t3,meta_decks:()=>new Promise(()=>{})};
 const t0=Date.now();a=await answerFor(P('best deck','mtg',{formatLast:{mtg:'Standard'}}),stuck,{limitMs:80});
 assert.equal(a.ok,false);assert.equal(a.miss,'That is taking too long on this connection. Check your internet, then ask again.');assert.ok(Date.now()-t0<2000);
}

console.log(`answer-hard: Randall's six questions, ${typos} generated misspellings, wrong-order and several-ask questions read correctly`);

// ---- 6c. The deck brief inside the builder: a play style moves its role targets, and the other decks' colours become a card search.
{
 const {playStyleTargets,playStylesIn}=await import('./builder.js'),{againstQuery}=await import('./deck-pipeline.js');
 const base={ramp:10,draw:10,interaction:10,wipe:3,wincon:3};
 assert.deepEqual(playStyleTargets(base,'ramp'),{...base,ramp:15});
 assert.deepEqual(playStyleTargets(base,'control card draw'),{ramp:10,draw:16,interaction:14,wipe:4,wincon:3});
 assert.deepEqual(playStyleTargets(base,'dragon flying'),base,'a theme word moves no target');
 assert.deepEqual(playStylesIn('a deck with lots of removal'),['removal']);
 assert.equal(againstQuery('U',{legality:'commander',identity:'wr'}),`(o:"protection from blue" or o:"hexproof from blue" or o:"target blue" or o:"can't be countered") -t:land f:commander id<=wr`);
 assert.equal(againstQuery('X'),'');
}

// ---- 6d. Deck check and upgrade path (ideas 3 and 4): one of your own decks against the rules, then against the tournament lists.
{
 const {cardKey}=await import('./core.js');
 const catalog=Object.fromEntries(Object.values(CARDS).map(c=>[cardKey(c.name),{...c,legalities:{standard:c.name==='Sol Ring'?'not_legal':'legal',modern:c.name==='Lightning Strike'?'banned':'legal',commander:'legal'}}]));
 const rush={id:'d1',name:'Goblin Rush',format:'Standard',cards:[{name:'Monastery Swiftspear',qty:4},{name:'Lightning Strike',qty:4},{name:'Sol Ring',qty:1},{name:'Opt',qty:5},{name:'Mountain',qty:46}]};
 const drake={id:'d2',name:'Drake Tempo',format:'Standard',cards:[{name:'Stormchaser Drake',qty:4},{name:'Opt',qty:4},{name:'Island',qty:52}]};
 const S2={state:{settings:{},decks:[rush,drake],collection:[]},ui:{},catalog};
 const t2=makeAskTools({S:S2,T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data}),ui:()=>({})},esc,meta:n=>catalog[cardKey(n)]||null,resolve:async()=>null,resolveNames:async()=>{},
  inv:n=>({owned:own.get(String(n).toLowerCase())||0}),priceOf:()=>2,loadMetaData:async()=>data,metaState:()=>({data}),MTG_META_FORMATS:[['Standard','Standard'],['Modern','Modern']],mtgPower:d=>d.cards.length,shownPower:x=>x});
 const go=async(q,game='mtg')=>{const plan=planQuery(q,{game,formatLast:{mtg:'Standard'},sets:[],myDecks:['Goblin Rush','Drake Tempo']});return {plan,a:await answerFor(plan,t2,{})};};
 let r=await go('is my goblin rush deck legal');
 assert.equal(r.plan.intent,'decks.check');assert.equal(r.a.strong,'Goblin Rush');assert.match(r.a.say,/not yet\. 2 things to fix for Standard/);
 assert.deepEqual(r.a.rows,[{label:'Sol Ring',value:'not legal in Standard',tone:'bad'},{label:'Opt',value:'more than 4 copies',tone:'bad'}],'each failing card is named with the rule it breaks');
 assert.deepEqual(r.a.follow.map(f=>f.q),['how do i make my goblin rush deck better','what beats my goblin rush deck'],'the next question is offered');
 r=await go('can I play goblin rush in modern');
 assert.equal(r.plan.intent,'decks.check','a saved deck\'s name is enough, without "my"');assert.ok(r.a.rows.some(x=>x.label==='Lightning Strike'&&x.value==='banned in Modern'));
 r=await go('is my drake tempo deck legal');assert.match(r.a.say,/yes\. All 60 cards are legal in Standard/);assert.deepEqual(r.a.rows,[]);
 r=await go('is my deck legal');assert.equal(r.a.say,'Which of your decks?');assert.deepEqual(r.a.follow.map(f=>f.q),['is my goblin rush deck legal','is my drake tempo deck legal'],'two decks: it asks, never guesses');
 r=await go('is my elf deck legal');assert.match(r.a.say,/None of your saved decks is named "elf"/);
 r=await go('what rotates out of my drake tempo deck');assert.match(r.a.note,/no rotation dates/);
 r=await go('is my goblin rush deck legal in vintage rules');
 // Upgrade path: shared copies over the tournament list's size.
 r=await go('how do I make my goblin rush deck better');
 assert.equal(r.plan.intent,'decks.upgrade');assert.match(r.a.say,/shares 88% of its cards with Mono-Red Aggro, the closest Standard tournament list \(1st Standard Challenge\)/);
 assert.deepEqual(r.a.meter,{pct:88,label:'88% of the way to Mono-Red Aggro'});
 assert.deepEqual(r.a.rows,[{label:'Add 4 cards',value:'$8.00 for the rest'},{label:'+ 4 Burst Lightning',value:'$8.00'},{label:'Cut 30 cards',value:'1 Sol Ring, 5 Opt, 24 Mountain'}]);
 assert.equal(r.a.buttons[1].label,'Open Mono-Red Aggro');
 S2.state.decks=[{id:'d3',name:'Elves',format:'Commander',cards:[{name:'Sol Ring',qty:1}]}];
 r=await go('upgrade my elves deck');assert.equal(r.a.ok,false);assert.match(r.a.miss,/no lists for casual Commander/);
 S2.state.decks=[{id:'d4',name:'Sol',format:'Modern',cards:[{name:'Sol Ring',qty:60}]}];
 r=await go('make my deck better');assert.match(r.a.say,/is not close to any Modern tournament list this week/,'nothing close is said, not stretched');
 S2.state.decks=[];r=await go('is my deck legal');assert.equal(r.a.miss,'You have no saved decks in this game.');
 // A question about a card, or about decks in general, is still what it was.
 assert.equal(planQuery('is lightning bolt legal in modern',{game:'mtg'}).intent,'card.legal');assert.equal(planQuery('make me a goblin deck',{game:'mtg'}).intent,'build');assert.equal(planQuery('what is my best deck',{game:'mtg'}).intent,'decks.mine');
}

// ---- 6e. Price memory (idea 5): how prices moved, from the prices this device has saved. Nothing is estimated.
{
 const {readSpan}=await import('./answer-search.js'),{cardKey}=await import('./core.js');
 const now=new Date('2026-11-13T12:00:00Z');
 assert.deepEqual(readSpan('what went up in my collection this week',now),{since:'2026-11-06',label:'past week',used:'this week'});
 assert.equal(readSpan('is sheoldred cheaper than last month',now).since,'2026-10-14');
 assert.deepEqual(readSpan('what did my collection gain since october',now),{since:'2026-10-01',label:'since October',used:'since october'});
 assert.equal(readSpan('since december',now).since,'2025-12-01','a month still to come this year means last year\'s');
 assert.equal(readSpan('in the last 3 days',now).since,'2026-11-10');
 let p=planQuery('what went up in my collection this week',{game:'mtg'});
 assert.equal(p.intent,'prices.moved');assert.equal(p.call.args.dir,'up');assert.deepEqual(p.read.map(c=>c.label),['Magic','your collection','saved prices','past week']);
 p=planQuery('is sheoldred cheaper than last month',{game:'mtg'});assert.equal(p.intent,'card.moved');assert.equal(p.call.args.name,'sheoldred');assert.equal(p.call.args.dir,'down');
 p=planQuery('did the one ring go up in price',{game:'mtg'});assert.equal(p.call.args.name,'one ring');
 assert.equal(planQuery('what deck is getting more popular in standard',{game:'mtg'}).intent==='prices.moved',false,'decks over time are not prices');
 assert.equal(planQuery('how much is my collection worth',{game:'mtg'}).intent,'collection.value');
 const card=(id,name,usd)=>({id,name,prices:{usd:String(usd)}}),cat=Object.fromEntries([card('a','The One Ring',80),card('b','Ragavan, Nimble Pilferer',50),card('c','Sheoldred, the Apocalypse',64),card('d','Opt',0.25)].map(c=>[cardKey(c.name),c]));
 const saved={'a|nonfoil|Scryfall / TCGplayer|USD':[['2026-10-01',60],['2026-11-01',62],['2026-11-10',80]],'b|nonfoil|Scryfall / TCGplayer|USD':[['2026-11-09',41],['2026-11-12',50]],'c|nonfoil|Scryfall / TCGplayer|USD':[['2026-09-20',70],['2026-11-08',64]]};
 const t=makeAskTools({S:{state:{settings:{},decks:[],collection:[{name:'The One Ring',qty:1},{name:'Ragavan, Nimble Pilferer',qty:2},{name:'Sheoldred, the Apocalypse',qty:1},{name:'Opt',qty:4}]},ui:{},catalog:cat},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({}),ui:()=>({})},esc,
  meta:n=>cat[cardKey(n)]||null,resolve:async n=>Object.values(cat).find(c=>c.name.toLowerCase().includes(String(n).toLowerCase()))||null,resolveNames:async()=>{},inv:()=>({owned:0}),priceOf:()=>1,MTG_META_FORMATS:[],priceSeries:(g,id)=>saved[id]||[]});
 let r=await t.price_moves({game:'mtg',since:'2026-11-06',dir:'both'});
 assert.deepEqual([r.total,r.counted,r.missing,r.up,r.down,r.late],[30,4,4,2,1,true],'+18 on the Ring, +9 twice on Ragavan, −6 on Sheoldred; Opt has no saved price');
 assert.deepEqual(r.movers.map(m=>[m.name,m.delta,m.from,m.to]),[['The One Ring',18,62,80],['Ragavan, Nimble Pilferer',9,41,50],['Sheoldred, the Apocalypse',-6,70,64]]);
 let a=await answerFor(planQuery('what went up in my collection this week',{game:'mtg'}),t,{});
 assert.match(a.say,/^Your collection is up \$30\.00 over the past week\. 2 cards went up and 1 went down\.$/);
 assert.deepEqual(a.rows.map(x=>x.label+' '+x.value),['The One Ring +$18.00 · $62.00 to $80.00','Ragavan, Nimble Pilferer ×2 +$9.00 · $41.00 to $50.00']);
 assert.match(a.note,/4 of your cards have no saved price that far back/);assert.match(a.note,/start later, the latest on 9 Nov/);
 a=await answerFor(planQuery('is sheoldred cheaper than last month',{game:'mtg'}),t,{});
 assert.equal(a.strong,'Sheoldred, the Apocalypse');assert.equal(a.say,'is down $6.00 since 20 Sep: $70.00 then, $64.00 now.');
 a=await answerFor(planQuery('did opt go up in price',{game:'mtg'}),t,{});assert.equal(a.ok,false);assert.match(a.miss,/no saved price for Opt from before today/);
 const none=makeAskTools({S:{state:{settings:{},decks:[],collection:[{name:'Opt',qty:4}]},ui:{},catalog:cat},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]})},esc,meta:n=>cat[cardKey(n)]||null,MTG_META_FORMATS:[],priceSeries:()=>[]});
 a=await answerFor(planQuery('what went up in my collection this week',{game:'mtg'}),none,{});assert.match(a.miss,/no saved prices for your cards going back that far/);
}

// ---- 6f. What is rising (idea 6): today's shares against a day the server saved. A day that was not saved is never made up.
{
 const feed={...data,history:{start:'2026-10-20',today:'2026-11-13',days:[{day:'2026-10-20',shares:{'Mono-Red Aggro':.3,'Izzet Prowess':.05,'Old Deck':.2}},{day:'2026-11-05',shares:{'Mono-Red Aggro':.2,'Izzet Prowess':.1,'Three Steps Ahead · Countersculpt':.2}}]}};
 const mk=d=>makeAskTools({S:{state:{settings:{},decks:[],collection:[]},ui:{}},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data:d}),ui:()=>({})},esc,meta:()=>null,resolveNames:async()=>{},inv:()=>({owned:0}),priceOf:()=>2,loadMetaData:async()=>d,metaState:()=>({data:d}),MTG_META_FORMATS:[['Standard','Standard']]});
 const go=async(q,d=feed,game='mtg')=>{const plan=planQuery(q,{game,formatLast:{mtg:'Standard'}});return {plan,a:await answerFor(plan,mk(d),{})};};
 let r=await go('what deck is getting more popular in standard');
 assert.equal(r.plan.intent,'meta.trend');assert.deepEqual(r.plan.call.args,{game:'mtg',format:'Standard',back:7,trend:'rising'});
 assert.equal(r.a.strong,'Izzet Prowess');assert.equal(r.a.say,'is rising the most in Standard: 10% of decks on 5 Nov, 15% now.');assert.deepEqual(r.a.rows,[]);
 r=await go('which decks are falling off in standard');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/falling the most in Standard: 20% of decks on 5 Nov, 10% now/);
 r=await go('what was the best deck last month');
 assert.deepEqual(r.plan.call.args,{game:'mtg',format:'Standard',back:30,trend:'then'});
 assert.equal(r.a.strong,'Mono-Red Aggro');assert.equal(r.a.say,'was the most played Standard deck on 20 Oct, at 30% of decks. It is at 10% now.');
 assert.match(r.a.note,/saved days only go back to 20 Oct/,'a month ago was not saved, so the first saved day is used and said');
 assert.deepEqual(r.a.rows[0],{label:'Old Deck',value:'20% then · not in the feed now',tone:''});
 r=await go('what deck is getting more popular in standard',{...data,history:{start:'2026-11-13',today:'2026-11-13',days:[]}});
 assert.equal(r.a.ok,false);assert.match(r.a.miss,/started saving tournament days on 13 Nov/);
 r=await go('what deck is getting more popular in standard',data);assert.match(r.a.miss,/no saved tournament days/);
 r=await go('what pokemon deck is getting more popular',feed,'ptcg');assert.match(r.a.miss,/only keeps tournament days for Magic/);
 assert.equal(planQuery('what is the best deck in standard',{game:'mtg'}).intent,'meta.best');
}

// ---- 6g. Simulated matchups (idea 7, first step): the app's own matchup model against the tournament lists, always labelled as simulated.
{
 const {cardKey}=await import('./core.js');
 const K=(name,colors,type,cmc,mana_cost,oracle_text='',extra={})=>({name,colors,color_identity:colors,type_line:type,cmc,mana_cost,oracle_text,prices:{usd:'1.00'},legalities:{standard:'legal'},...extra});
 const cards=[K('Monastery Swiftspear',['R'],'Creature — Human Monk',1,'{R}','Haste\nProwess',{power:'1',toughness:'2'}),K('Lightning Strike',['R'],'Instant',2,'{1}{R}','Lightning Strike deals 3 damage to any target.'),K('Burst Lightning',['R'],'Instant',1,'{R}','Burst Lightning deals 2 damage to any target.'),K('Goblin Guide',['R'],'Creature — Goblin Scout',1,'{R}','Haste',{power:'2',toughness:'2'}),
  K('Opt',['U'],'Instant',1,'{U}','Scry 1.\nDraw a card.'),K('Counterspell',['U'],'Instant',2,'{U}{U}','Counter target spell.'),K('Stormchaser Drake',['U'],'Creature — Drake',2,'{1}{U}','Flying',{power:'2',toughness:'1'}),K('Tolarian Terror',['U'],'Creature — Serpent',7,'{6}{U}','Ward {2}',{power:'5',toughness:'5'}),
  K('Mountain',[],'Basic Land — Mountain',0,'','({T}: Add {R}.)'),K('Island',[],'Basic Land — Island',0,'','({T}: Add {U}.)')];
 const cat=Object.fromEntries(cards.map(c=>[cardKey(c.name),c]));
 const list=(key,name,colors,rows)=>({key,name,colors,place:'1st',event:'Standard Challenge',main:rows.map(([name,qty])=>({name,qty,land:/Mountain|Island/.test(name)}))});
 const feed={source:'Fixture',fetchedAt:'2026-11-13T10:00:00Z',decks:[list('blue','Blue Tempo',['u'],[['Opt',4],['Counterspell',4],['Stormchaser Drake',4],['Tolarian Terror',4],['Island',24],['Opt',20]]),list('red','Mono-Red Aggro',['r'],[['Monastery Swiftspear',4],['Goblin Guide',4],['Lightning Strike',4],['Burst Lightning',4],['Mountain',20],['Goblin Guide',24]])],
  archetypes:[{name:'Blue Tempo',best:'blue',share:.2},{name:'Mono-Red Aggro',best:'red',share:.1}]};
 const rush={id:'d1',name:'Goblin Rush',format:'Standard',cards:[{name:'Goblin Guide',qty:4},{name:'Monastery Swiftspear',qty:4},{name:'Lightning Strike',qty:4},{name:'Burst Lightning',qty:4},{name:'Mountain',qty:22},{name:'Goblin Guide',qty:22}]};
 const S3={state:{settings:{},decks:[rush],collection:[]},ui:{},catalog:cat};
 const t=makeAskTools({S:S3,T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]})},esc,meta:n=>cat[cardKey(n)]||null,resolveNames:async()=>{},inv:()=>({owned:0}),priceOf:()=>1,loadMetaData:async()=>feed,metaState:()=>({data:feed}),MTG_META_FORMATS:[['Standard','Standard']]});
 const go=async(q,ctx={})=>{const plan=planQuery(q,{game:'mtg',myDecks:['Goblin Rush'],formatLast:{mtg:'Standard'},...ctx});return {plan,a:await answerFor(plan,t,{})};};
 let r=await go('is my goblin rush deck good against blue');
 assert.equal(r.plan.intent,'decks.matchup');assert.deepEqual(r.plan.call.args,{game:'mtg',match:'goblin rush',colors:['u'],opponent:'blue'});
 assert.deepEqual(r.plan.read.map(c=>c.label),['Magic','your deck "goblin rush"','against blue decks','simulated games']);
 assert.match(r.a.say,/^ wins \d+% of simulated games against Blue Tempo\. On the play \d+%, on the draw \d+%\.$/);assert.ok(r.a.meter.pct>50,'a fast red deck is ahead of a slow blue one');
 assert.match(r.a.source,/not games played on the table/,'every matchup answer says it is a simulation');
 const again=await go('is my goblin rush deck good against blue');assert.equal(again.a.say,r.a.say,'the same two lists always give the same numbers');
 r=await go('what beats my goblin rush deck');assert.equal(r.plan.intent,'decks.matchup');assert.match(r.a.say,/of the 2 most played Standard decks in the app's simulation\. Its hardest matchup is /);assert.equal(r.a.rows.length,2);
 r=await go('is my deck good against green');assert.match(r.a.miss,/No Standard tournament deck matches "green"/);
 r=await go('how does goblin rush do against golgari midrange');assert.match(r.a.miss,/No Standard tournament deck matches "golgari midrange"/);
 r=await go('how does goblin rush do against dimir tempo');assert.match(r.a.miss,/nothing to simulate against/);
 r=await go('how does goblin rush do against mono red aggro');assert.match(r.a.say,/against Mono-Red Aggro/,'a deck named in full is found by its name');
 // "What beats it?" about a tournament deck: the other top lists, from their side.
 const {answerAbout}=await import('./answer-run.js');
 r=await go('best blue deck');assert.equal(r.a.strong,'Blue Tempo');
 r=await go('what beats it',{about:answerAbout()});
 assert.equal(r.plan.intent,'meta.matchup');assert.equal(r.a.strong,'Mono-Red Aggro');assert.match(r.a.say,/does best against Blue Tempo in the app's simulation: it wins \d+% of simulated games/);
 // Other games and Commander say plainly that there is nothing to simulate.
 S3.state.decks=[{id:'c1',name:'Elves',format:'Commander',cards:[{name:'Opt',qty:1}]}];
 r=await go('what beats my elves deck',{myDecks:['Elves']});assert.match(r.a.miss,/no lists for casual Commander/);
 assert.equal(planQuery('which mono red deck beats control',{game:'mtg'}).intent,'meta.best','a question about tournament decks is still that');
 assert.equal(planQuery('what is the funnest deck I can play with mono red and my friend has a blue deck',{game:'mtg'}).intent,'build');
}
