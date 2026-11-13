// The hard round (Randall, 13 Nov 2026): questions that are misspelled, said in the wrong order, said in a long-winded way,
// or that hold several asks about the same deck. The rule from test-answer-words.mjs still holds for every one of them:
// each word is used, shown as not used, or the question is not answered. Nothing here calls a model.
import assert from 'node:assert/strict';
import {planQuery,respell,buildLeftover,readPod} from './answer-search.js';
import {answerFor,buildRequest,answerMarkup} from './answer-run.js';
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
assert.deepEqual(b.request,{game:'mtg',format:'Commander',seed:"Atraxa, Praetors' Voice"},'"this commander" is the card that is open');
assert.deepEqual(b.unused,['tier 2'],'the builder has no power tier, so "tier 2" is shown as not used');
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
assert.equal(b.request.budget,'50');assert.deepEqual(b.unused,['ramp']);

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
 ['mtg','build me a bracket 3 izzet commander deck',{format:'Commander',colors:['U','R']},['bracket 3']],
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
const ask=async(q,ctx={})=>{const plan=P(q,'mtg',{formatLast:{mtg:'Standard'},...ctx});return {plan,a:await answerFor(plan,tools,{cardSearch:async()=>[]})};};

let r=await ask('what is the best red deck, how much does it cost and where did it place?');
assert.equal(r.a.strong,'Izzet Prowess');assert.equal(r.plan.extra.length,2);
assert.deepEqual(r.a.also.map(x=>x.ask),['how much does it cost','where did it place'],'each further ask is answered in the order asked');
assert.match(r.a.also[0].text,/to finish|no price|no total/,'the cost is the same deck\'s cost');assert.equal(r.a.also[1].text,'Best finish: 1st Standard Challenge.');
assert.ok(!('facets' in r.a),'working facts are not left on the answer');
const html=answerMarkup(r.a,r.plan.read,{esc});assert.match(html,/answer-also"><b>how much does it cost<\/b>/,'the further asks are drawn under the first answer');

r=await ask('best mono red deck? what colors is it? how do i beat it');
assert.equal(r.a.strong,'Mono-Red Aggro');assert.equal(r.a.also[0].text,'Its colours: red.');
assert.match(r.a.also[1].text,/can't work out matchups/,'a matchup ask is said to be out of reach, never guessed');

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
assert.match(r.a.say,/set up from your words: red, a fun deck/);assert.match(r.a.note,/can't tune a deck against blue yet/);
r=await ask(POD,{screen:{card:{name:'Sol Ring'}}});
assert.equal(r.a.say,'The deck builder is set up from your words: Commander, flying theme, built around Sol Ring, a fun deck.');
assert.match(r.a.note,/can't tune a deck against the other decks \(white-blue, blue-red, mono-black\) yet/);assert.match(r.a.note,/can't measure the pod's power level yet/);
assert.deepEqual(r.a.buttons[0].build,{game:'mtg',format:'Commander',theme:'Flying',seed:'Sol Ring',goal:'fun'});
r=await ask('I have this commander, can you make me a tier 2 deck',{screen:{card:{name:'Sol Ring'}}});
assert.equal(r.a.buttons[0].build.seed,'Sol Ring');assert.match(r.a.note,/Not used yet: "tier 2"/);

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
  assert.equal(x.plan.intent,'meta.about',f.q);assert.equal(x.a.strong,'Mono-Red Aggro',f.q+' is about the same deck');
  assert.deepEqual(chips(x.plan).split(' | ').slice(0,2),['Magic','Mono-Red Aggro']);
  assert.ok(!x.a.follow.some(y=>y.q===f.q),'the chip just asked is not offered again');
 }
 let x=await ask('what cards are in it',{about:answerAbout()});
 assert.deepEqual(x.a.rows.map(r=>r.label),['Monastery Swiftspear','Lightning Strike','Burst Lightning'],'its own cards, lands left out');
 assert.equal(x.a.rows[0].value,'×4 · you own 4');assert.equal(x.a.rows[2].value,'×4');
 x=await ask('how much is it',{about:answerAbout()});assert.match(x.a.say,/^: (?:About \$|Some of its cards have no price)/);
 x=await ask('what beats it',{about:answerAbout()});assert.match(x.a.say,/can't work out matchups yet/);
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
