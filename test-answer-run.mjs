// The answer card is filled only from what the app's lookups return; failures and empty results say so.
import assert from 'node:assert/strict';
import {planQuery} from './answer-search.js';
import {answerFor,answerMarkup,wikiFact,wikiFacts} from './answer-run.js';

const sets=[{code:'blb',name:'Bloomburrow'}];
let suggested=[];
const tools={
 suggestedItems:()=>suggested,
 async meta_decks({format}){if(format==='Vintage')return {error:"Tournament data for that format isn't available right now."};suggested=[{kind:'meta',game:'mtg',ref:'k1',label:'Dimir Aggro'},{kind:'meta',game:'mtg',ref:'k2',label:'Jund Aggro'}];return {game:'mtg',format,source:'Magic Online (official decklists)',fetchedAt:'2026-11-13T10:31:52Z',decks:[{name:'Dimir Aggro',key:'k1',share:11.5,lists:11,best:'2nd Standard Challenge 16'},{name:'Jund Aggro',key:'k2',share:9.4,lists:9,best:''}]};},
 async set_cards({set}){return set==='blb'?{game:'mtg',set:{code:'blb',name:'Bloomburrow',date:'2024-08-02'},cards:[{name:'Three Tree City',price:28.99,ref:'set-card-1'},{name:'Lumra, Bellow of the Woods',price:28.7,ref:'set-card-2'},{name:'Maha, Its Feathers Night',price:18.58,ref:'set-card-3'}]}:{error:'No set matching '+set+'.'};},
 async list_sets({order}){return {latestReleased:{code:'fdn',name:'Foundations',date:'2024-11-15',cards:517,status:'released'},upcoming:[{code:'xyz',name:'Next One',date:'2027-02-05',status:'upcoming'}],sets:[{code:order==='oldest'?'lea':'fdn',name:order==='oldest'?'Limited Edition Alpha':'Foundations',date:order==='oldest'?'1993-08-05':'2024-11-15',cards:order==='oldest'?295:517,status:'released'}]};},
 async my_collection({sort,limit}){return {totalValue:1234.5,copies:812,unpriced:3,cards:[{name:'Sol Ring',qty:2,value:4.2},{name:'Island',qty:40,value:1}].slice(0,limit)};},
 async my_decks(){return {decks:[{id:'a',name:'Elves',power:6},{id:'b',name:'Burn',power:8},{id:'c',name:'Draft pile',power:null}]};},
 async card_details({name}){return /bolt/.test(name)?{card:{name:'Lightning Bolt',price:1.25,foilPrice:6,owned:4,set:'Magic 2011'}}:/ghost/.test(name)?{card:{name:'Ghost',price:null,foilPrice:null,owned:0}}:{error:'No Magic card named '+name+'.'};},
 async app_help(){return {topics:[{ref:'scan',title:'Scanning cards',summary:'Point the camera at a card.'}]};},
 async wiki_lookup({query}){return query==='1999 World Championships'?{status:'available',source:{providerName:'MTG Wiki'},results:[{source:{title:'1999 World Championships'},extract:'The 1999 World Championships were held August 4–8, 1999 in Tokyo, Japan.'},{source:{title:'1998–99 Pro Tour Season'},extract:''}]}:{status:'not-found',results:[]};},
};
const io={cardSearch:async({q})=>/dragon/.test(q)?[{name:'Rapacious Dragon',price:.11},{name:'Shivan Dragon',price:.11}]:/a:"/.test(q)?[{name:'Path to Exile',price:2}]:[]};
const ask=(q,ctx={})=>{const plan=planQuery(q,{game:'mtg',formatLast:{mtg:'Standard'},sets,screen:{set:sets[0]},...ctx});return answerFor(plan,tools,io).then(a=>({a,plan}));};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

let r=await ask('best deck in the meta right now');
assert.equal(r.a.strong,'Dimir Aggro');assert.match(r.a.say,/most played Standard deck right now: 11 lists, 11\.5% of the field/);
assert.equal(r.a.items[0].ref,'k1');assert.equal(r.a.more[0].label,'Jund Aggro');assert.match(r.a.source,/Magic Online .* updated/);assert.equal(r.a.buttons[0].item.ref,'k1');
r=await ask('best vintage deck');assert.equal(r.a.ok,false);assert.match(r.a.miss,/isn't available/);
r=await ask('most expensive card in this set');
assert.equal(r.a.strong,'Three Tree City');assert.match(r.a.say,/most expensive card in Bloomburrow at \$28\.99/);assert.equal(r.a.items[0].ref,'set-card-1','the tile keeps the exact printing');assert.equal(r.a.more.length,2);
r=await ask('most expensive card in this set',{screen:{}});assert.equal(r.a.ask.ask,'Which set?','a missing set is asked for');
r=await ask('whats the next set');assert.equal(r.a.strong,'Next One');assert.match(r.a.say,/February 5, 2027/);
r=await ask('what is the newest set');assert.match(r.a.say,/newest set, released November 15, 2024/);
r=await ask('oldest magic set');assert.equal(r.a.strong,'Limited Edition Alpha');
r=await ask('how much is my collection worth');assert.match(r.a.say,/\$1234\.50 across 812 cards, with 3 not priced/);assert.equal(r.a.buttons[0].route,'#collection/value');
r=await ask('what is my most valuable card');assert.equal(r.a.strong,'Sol Ring');
r=await ask('what is my best deck');assert.equal(r.a.strong,'Burn');assert.match(r.a.source,/not a win rate/);
r=await ask('do i own lightning bolt');assert.match(r.a.say,/you own 4/);
r=await ask('how much is lightning bolt');assert.match(r.a.say,/is \$1\.25 \(\$6\.00 in foil\)/);
r=await ask('how much is ghost');assert.equal(r.a.ok,false);assert.match(r.a.miss,/no price/);
r=await ask('how much is zzzz');assert.equal(r.a.ok,false);
r=await ask('what does ward do');assert.equal(r.a.strong,'Ward');assert.match(r.a.quote,/counter that spell or ability unless that player pays/);assert.match(r.a.source,/702\.21/);assert.ok(r.a.buttons.some(b=>b.judge));
r=await ask("who won magic's tournament in 1999");assert.equal(r.a.strong,'1999 World Championships');assert.match(r.a.quote,/Tokyo/);assert.equal(r.a.buttons[0].route,'#wiki/1999%20World%20Championships');assert.deepEqual(r.a.others,['1998–99 Pro Tour Season']);
r=await ask('who is nobody at all');assert.equal(r.a.ok,false);
r=await ask('cheapest red dragon legal in standard');assert.equal(r.a.strong,'Rapacious Dragon');assert.equal(r.a.buttons[0].search.q,'c:r t:dragon f:standard');
r=await ask('cards by rebecca guay');assert.equal(r.a.items[0].label,'Path to Exile');assert.deepEqual(r.a.buttons[0].discover,{kind:'artist',value:'rebecca guay'});
r=await ask('3 mana blue instants');assert.equal(r.a.ok,false,'no matching cards is said plainly');
r=await ask('scan a card');assert.equal(r.a.go,'#scan');
r=await ask('how do i scan a card');assert.equal(r.a.buttons[0].item.kind,'help');
r=await ask('is blue better than red');assert.equal(r.a.ok,false);assert.match(r.a.miss,/can't answer/);
// Rules questions are answered by the Judge's rulebook reader; an unsure match is a plain miss.
{const judge=async(g,q)=>/attack the turn/.test(q)?{status:'answered',lead:{number:'302.6',heading:'Creatures',text:'A creature can’t attack unless it has been under its controller’s control continuously since their most recent turn began.'},rules:[{number:'702.10b'}],edition:{title:'Comprehensive Rules',date:'2026-09-25'}}:{status:'none',lead:null,rules:[]};
 const run=async q=>{const plan=planQuery(q,{game:'mtg'});return answerFor(plan,tools,{judge});};
 let a=await run('can a creature attack the turn it enters');assert.equal(a.strong,'Rule 302.6');assert.match(a.quote,/can’t attack unless/);assert.match(a.source,/Comprehensive Rules/);assert.ok(a.buttons[0].judge);
 a=await run('can i respond to nothing at all');assert.equal(a.ok,false);assert.ok(a.buttons[0].judge,'a rules question with no single rule still offers the Judge');}
r=await ask('lightning bolt');assert.equal(r.a,null,'a card name gets no answer card');
r=await ask('build me a mono red goblin deck for modern under $50');assert.deepEqual(r.a.buttons[0].build,{game:'mtg',format:'Modern',colors:['R'],theme:'Goblins',budget:'50'},'a deck request sets up the builder from its words');assert.deepEqual(r.a.rows.map(x=>x.value),['Modern','red','goblins','under $50']);
r=await ask('build me a deck');assert.deepEqual(r.a.buttons[0].build,{game:'mtg'},'nothing is guessed for a bare request');
// The wiki's fact box answers the question the words point at (shape copied from the live 1999 World Championships article).
const cell=(text,header=false)=>({header,content:[{type:'text',text}],colspan:1,rowspan:1}),row=(a,b)=>({cells:[cell(a,true),cell(b)]});
const article={title:'1999 World Championships',lead:[{type:'paragraph',content:[{type:'text',text:'Intro'}]},{type:'table',infobox:true,rows:[{cells:[cell('1999 World Championships',true)]},row('Date','August 4–8, 1999'),row('Location','JPN flag Yokohama, Japan'),row('Attendance','208 players 39 teams'),row('Prize pool','$250,000'),row('Winner','DEU flag Kai Budde USA flag United States (team)'),row('Release date','August 2, 2024; 2 years ago (2024-08-02)')]}],sections:[]};
assert.deepEqual(wikiFact(article,"who won magic's tournament in 1999"),{label:'Winner',value:'Kai Budde · United States (team)'});
assert.deepEqual(wikiFact(article,'where was the 1999 world championship'),{label:'Location',value:'Yokohama, Japan'});
assert.equal(wikiFact(article,'what was the prize at worlds 1999').value,'$250,000');
assert.equal(wikiFact(article,'tell me about worlds 1999'),null,'no fact is picked unless the words ask for one');
assert.equal(wikiFacts(article).find(f=>f[0]==='Release date')[1],'August 2, 2024');
r=await (async()=>{const plan=planQuery("who won magic's tournament in 1999",{game:'mtg'});return {a:await answerFor(plan,tools,{wikiArticle:async()=>article}),plan};})();
assert.deepEqual(r.a.fact,{label:'Winner',value:'Kai Budde · United States (team)'});
assert.match(answerMarkup(r.a,r.plan.read,{esc}),/answer-fact"><small>Winner<\/small><b>Kai Budde · United/);
// A lookup that throws is a plain miss.
assert.equal((await answerFor(planQuery('best deck in the meta',{game:'mtg'}),{...tools,meta_decks:async()=>{throw Error('offline');}})).ok,false);
// Markup: escaped, with the Read as chips, tiles through the caller's preview, indexed buttons.
r=await ask('best deck in the meta right now');
const html=answerMarkup(r.a,r.plan.read,{esc,preview:(s,i)=>`<i data-i="${i}">${esc(s.label)}</i>`});
assert.match(html,/Read as/);assert.match(html,/<b>Dimir Aggro<\/b> is the most played/);assert.match(html,/data-answer-button="0">Open the deck/);assert.match(html,/<i data-i="0">Dimir Aggro<\/i>/);assert.match(html,/Next most played/);
assert.match(answerMarkup({ok:false,miss:'<x>',items:[],more:[],buttons:[]},[],{esc}),/&lt;x&gt;/);
console.log('answer-run: answers are filled from the lookups; misses are plain');
