// Plain deck words (Randall, 13 Nov 2026, on 0.4.74): "red deck", "white mono deck" and "red mono decks" got no answer at all, and
// "best mono red standard deck" stopped at "No mono-red Standard deck". The 1,744-question battery missed it for two reasons:
// its questions all carried a word like "best" or "build", and its end-to-end feed was written by hand and always held a mono-red
// deck. So this file does it the other way round:
//   1. the wordings are the short ones a person types, in every order, for all three games;
//   2. the answers run through the real lookups (ai-tools.js) over a copy of the real Standard feed as the site served it on
//      13 Nov 2026 (114 lists, none mono-red), or over today's live feed with LIVE=1;
//   3. every check is on the words the card shows, and each claim in them is recounted here from the lists themselves.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planQuery} from './answer-search.js';
import {answerFor,answerMarkup} from './answer-run.js';
import {makeAskTools} from './ai-tools.js';
import {deckColorsOf} from './deck-colors.js';

const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const P=(q,game='mtg',ctx={})=>planQuery(q,{game,formatLast:{mtg:'Standard'},...ctx});
const HUE={w:'white',u:'blue',b:'black',r:'red',g:'green'};

// ---- 1. The wordings. Each is a deck question with the colours it names; none falls through to a card-name search.
let read=0;
const single=Object.entries(HUE);
for(const [k,c] of single){
 const has=[`${c} deck`,`${c} decks`,`deck ${c}`,`a ${c} deck`,`${c} standard deck`,`standard ${c} deck`,`${c} deck standard`,`good ${c} deck`,`${c} deck for modern`,`${c} deck in pioneer`,`decks ${c} standard`];
 const mono=[`mono ${c} deck`,`${c} mono deck`,`mono-${c} deck`,`mono${c} deck`,`${c} mono decks`,`${c} mono standard deck`,`mono ${c} standard deck`,`standard mono ${c} deck`,`good mono ${c} standard deck`,`mono ${c} decks standard`,`deck mono ${c}`];
 for(const [list,exact] of [[has,false],[mono,true]])for(const q of list){
  const p=P(q);read++;
  assert.equal(p.intent,'meta.best',`"${q}" is a deck question, not ${p.intent}`);
  assert.deepEqual(p.call.args.colors,[k],`"${q}" names ${c}`);assert.equal(p.call.args.exact,exact,`"${q}" ${exact?'is':'is not'} mono`);
  assert.equal(p.call.args.format,/modern/.test(q)?'Modern':/pioneer/.test(q)?'Pioneer':'Standard',`"${q}" format`);
  assert.equal(p.call.args.match,undefined,`"${q}" leaves no stray word as a deck name (${p.call.args.match})`);
 }
}
for(const [q,cols] of [['blue white deck','uw'],['white blue decks','wu'],['red green standard deck','rg'],['izzet deck','ur'],['boros decks','rw'],['esper deck','wub'],['black red deck modern','br']]){
 const p=P(q);read++;assert.equal(p.intent,'meta.best',q);assert.deepEqual([...p.call.args.colors].sort(),[...cols].sort(),q);assert.equal(p.call.args.exact,true,q);
}
// A theme with the colour: the theme is kept as what to look for.
for(const [q,m] of [['red goblin deck','goblin'],['mono red goblins standard deck','goblins'],['white angels deck','angels'],['goblin deck','goblin'],['dragon decks','dragon']]){const p=P(q);read++;assert.equal(p.intent,'meta.best',q);assert.equal(p.call.args.match,m,q);}
// The other games: a type, an attribute or a deck's name with "deck".
for(const q of ['fire deck','water decks','charizard deck','dragapult deck','deck charizard','psychic deck standard']){const p=P(q,'ptcg');read++;assert.equal(p.call?.tool,'meta_decks','Pokémon "'+q+'" ('+p.intent+')');}
for(const q of ['dark deck','dragon decks','blue-eyes deck','deck dark','snake-eye deck']){const p=P(q,'ygo');read++;assert.equal(p.call?.tool,'meta_decks','Yu-Gi-Oh! "'+q+'" ('+p.intent+')');}
// What must stay as it was: a card's name, a search line, your own decks, a build request, a rules question.
for(const [q,intent] of [['deck of many things','names'],['lightning bolt','names'],['deckhand','names'],['my red deck','decks.mine'],['is my red deck legal','decks.check'],['build a red deck','build'],['make me a mono red deck','build'],['how many cards in a deck','ruling'],['red dragons','cards.filter']]){
 assert.equal(P(q).intent,intent,`"${q}" still reads as ${intent}`);read++;
}

// ---- 2. The answers, over the real feed.
const live=process.env.LIVE==='1';
let feed,cards;
if(live){
 feed=await (await fetch('https://cardstashy.com/api/meta/mtg?format=Standard')).json();cards={};
 const names=[...new Set(feed.decks.flatMap(d=>d.main.map(c=>c.name.split(' // ')[0])))];
 for(let i=0;i<names.length;i+=75){const r=await (await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'content-type':'application/json',accept:'application/json','user-agent':'deck-tests/1.0'},body:JSON.stringify({identifiers:names.slice(i,i+75).map(name=>({name}))})})).json();
  for(const c of r.data||[])cards[c.name.split(' // ')[0].toLowerCase()]={name:c.name,type_line:c.type_line,colors:c.colors||c.card_faces?.[0]?.colors||[]};await new Promise(r=>setTimeout(r,150));}
}else ({feed,cards}=JSON.parse(readFileSync(new URL('./test-fixtures/standard-feed-2026-11-13.json',import.meta.url),'utf8')));
const cardOf=n=>cards[String(n||'').split(' // ')[0].toLowerCase()]||null;
// The recount: each list's colours from its own cards, by the same rule the app and the server use, worked out here apart from the lookups.
const colorsOf=d=>deckColorsOf(d.main.filter(c=>!c.land),cardOf),byKey=new Map(feed.decks.map(d=>[d.key,d]));
const best=feed.archetypes.map(a=>({a,d:byKey.get(a.best)})).filter(x=>x.d).map(x=>({...x,colors:colorsOf(x.d)}));
assert.ok(feed.decks.length>=20&&best.length>=5,'the feed has lists');
assert.ok(best.every(x=>x.colors!=null),'every list\'s colours can be worked out from the card data kept with the feed');

// The builder is stood in for here (the app's engine test and the browser run the real one): it returns what it was asked for,
// from cards of that colour in the feed, so the words about it can be checked. [mode] makes it fail in the ways a builder can.
let mode='ok',asked=null;
const pool=c=>Object.values(cards).filter(x=>x.colors.length===1&&x.colors[0]===c&&!/Land/.test(x.type_line)).slice(0,9);
const buildFlow=async request=>{
 asked=request;
 if(mode==='throw')throw Error('The card service could not complete this request.');
 if(mode==='fail')return {ok:false,message:'No legal cards were found for that request.'};
 const c=mode==='offcolour'?'U':request.colors[0],rows=[...pool(c).map(x=>({name:x.name,qty:4,zone:'main',card:x,price:1.5})),{name:'Mountain',qty:24,zone:'main',card:{type_line:'Basic Land — Mountain',colors:[]},price:.1}];
 return {ok:true,rows,deck:{buildAround:rows[0].name},request:{...request,formatName:request.format},pricing:{estimate:60.4,unpriced:0},check:{complete:true,legal:true,issues:[]},requestSatisfied:mode!=='unmet'};
};
const angles={data:[...Array(9)].map((_,i)=>({name:'Goblin '+i,type_line:'Creature — Goblin Warrior',keywords:i<8?['Haste']:[]})).concat([...Array(8)].map((_,i)=>({name:'Dragon '+i,type_line:'Creature — Dragon',keywords:['Flying']})))};
const make=(extra={})=>makeAskTools({S:{state:{settings:{},decks:[],collection:[]},ui:{}},T:{game:()=>'mtg',cache:{},gs:()=>({decks:[],collection:[]}),ownedMap:()=>new Map(),metaState:()=>({data:feed}),ui:()=>({})},esc,
 meta:cardOf,resolve:async n=>cardOf(n),resolveNames:async()=>{},inv:()=>({owned:0}),priceOf:()=>1,loadMetaData:async()=>feed,metaState:()=>({data:feed}),MTG_META_FORMATS:[['Standard','Standard'],['Modern','Modern']],mtgPower:()=>0,shownPower:x=>x,
 api:async()=>angles,buildFlow,...extra});
const tools=make();
// What the card shows, as text.
const shown=(a,plan)=>answerMarkup(a,plan.read,{esc,preview:s=>`<i>[${esc(s.label)}]</i>`}).replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const ask=async(q,t=tools)=>{const plan=P(q),t0=Date.now(),a=await answerFor(plan,t,{cardSearch:async()=>[]});return {plan,a,ms:Date.now()-t0,text:shown(a,plan)};};
const keyOfTile=s=>byKey.get(s.ref)||feed.decks.find(d=>(d.archetype||d.name)===s.label);

let built=0,named=0;
for(const [k,c] of single){
 // "red deck": the most played list that has the colour, and it really has it.
 let r=await ask(`${c} deck`);
 const withC=best.filter(x=>x.colors.includes(k)).sort((p,q)=>q.a.share-p.a.share);
 if(withC.length){
  assert.equal(r.a.ok,true,`"${c} deck": ${r.text}`);assert.equal(r.a.strong,withC[0].a.name,`"${c} deck" names the most played list with ${c} in it`);
  assert.match(r.text,new RegExp(`is the most played Standard deck with ${c} in it right now`),r.text);
  assert.ok(colorsOf(byKey.get(r.a.items[0].ref)).includes(k),`the deck shown for "${c} deck" has ${c} cards in it`);
  assert.ok(r.a.buttons.some(b=>b.build?.colors?.[0]===k.toUpperCase()&&b.label===`Build a ${c} Standard deck`),`"${c} deck" offers to build one: ${r.a.buttons.map(b=>b.label)}`);
 }
 // "mono red deck" and its other orders: a mono list when the feed has one; when it has none, the count, the closest lists, and a built deck.
 const monoC=best.filter(x=>x.colors===k).sort((p,q)=>q.a.share-p.a.share);
 for(const q of [`mono ${c} deck`,`${c} mono standard deck`,`good mono ${c} standard deck`,`${c} mono decks`]){
  mode='ok';asked=null;r=await ask(q);
  assert.ok(!('then' in r.a),'an answer is never a thenable (awaiting it must not run the build)');
  if(monoC.length){named++;assert.equal(r.a.strong,monoC[0].a.name,q);assert.equal(colorsOf(byKey.get(r.a.items[0].ref)),k,`the deck shown for "${q}" is mono-${c}`);continue;}
  assert.equal(r.a.ok,true,`"${q}" is answered, not a dead end: ${r.text}`);
  assert.match(r.text,new RegExp(`No mono-${c} Standard deck is among the ${feed.decks.length} tournament lists right now\\.`),r.text);
  assert.ok(r.ms<4000,`the first answer does not wait for the build (${r.ms} ms)`);
  assert.match(r.text,new RegExp(`Building a mono-${c} Standard deck with the deck builder`),r.text);
  // The closest lists are real lists with the colour in them, most played first.
  assert.deepEqual(r.a.more.map(s=>s.ref),withC.slice(0,3).map(x=>x.d.key),`closest lists for "${q}"`);
  for(const s of r.a.more)assert.ok(colorsOf(keyOfTile(s)).includes(k),`${s.label} has ${c} in it`);
  if(withC.length)assert.match(r.text,new RegExp(`Closest tournament decks with ${c} in them`),r.text);
  // Questions that fit, counted from the cards: each is a whole question that reads as a deck request for that theme.
  assert.deepEqual(r.a.follow.map(f=>f.label),['Goblins?','Dragons?','Haste?','Flying?','Under $50?'],JSON.stringify(r.a.follow));
  for(const f of r.a.follow){const p=P(f.q);assert.equal(p.intent,'meta.best',f.q);assert.deepEqual(p.call.args.colors,[k],f.q);assert.ok(p.call.args.match||p.call.args.under===50,f.q);}
  // The finished answer: the deck the builder made, card by card, in the colour asked for.
  const done=await r.a.finish(),text=shown(done,r.plan);built++;
  assert.deepEqual(asked.colors,[k.toUpperCase()],'the builder was asked for '+c);assert.equal(asked.format,'Standard');
  assert.match(text,/The deck builder made this one:/,text);assert.match(text,new RegExp(`Mono-${c} Standard deck 60 cards · 24 lands · about \\$60`),text);
  assert.match(text,/Built by the app from Standard-legal cards\. It is not a tournament list\./,text);
  const rows=done.rows.slice(1).filter(x=>x.value);assert.ok(rows.length>=5,text);
  for(const row of rows)assert.deepEqual(cardOf(row.label).colors,[k.toUpperCase()],`${row.label} in the built deck is ${c}`);
  assert.ok(!/Building/.test(text),'the "Building" line is gone once the deck is there');
  assert.equal(done.buttons[0].label,'Open it in the deck builder');assert.deepEqual(done.buttons[0].build.colors,[k.toUpperCase()]);
 }
}
assert.ok(built+named>=20,'every mono wording was answered with a deck ('+built+' built, '+named+' from the feed)');

// A theme asked for that no list has: the same, built around the theme.
{
 mode='ok';const r=await ask('mono red goblins standard deck');
 assert.match(r.text,/No mono-red Standard deck among the \d+ tournament lists is named "goblins"(?: or plays a card named "goblins")? right now\./,r.text);
 const done=await r.a.finish();assert.equal(asked.theme,'Goblins');assert.match(shown(done,r.plan),/Mono-red goblins Standard deck/);
 assert.ok(!r.a.follow.some(f=>f.label==='Goblins?'),'the theme already asked for is not asked again');
}
// A budget: the builder gets it.
{mode='ok';const r=await ask('mono red standard deck under $50');if(r.a.finish){await r.a.finish();assert.equal(asked.budget,'50');assert.ok(!r.a.follow.some(f=>/Under/.test(f.label)));}}
// When the builder cannot finish, the card says so in words and still opens the builder; nothing is made up.
for(const [m,re] of [['throw',/The deck builder could not finish this one: The card service could not complete this request\./],['fail',/The deck builder could not finish this one: No legal cards were found for that request\./]]){
 mode=m;const r=await ask('mono red deck'),done=await r.a.finish(),text=shown(done,r.plan);
 assert.match(text,re,text);assert.ok(!/made this one|Building/.test(text),text);assert.equal(done.buttons[0].label,'Open the deck builder');assert.equal(done.rows.length,0);
}
// A list that came back in another colour is said to be so; one whose own checks are not met says that too.
{mode='offcolour';let r=await ask('mono red deck'),text=shown(await r.a.finish(),r.plan);assert.match(text,/It reads as mono-blue, not mono-red\./,text);
 mode='unmet';r=await ask('mono red deck');text=shown(await r.a.finish(),r.plan);assert.match(text,/The builder marks some of its own checks as not met; open the deck to see them\./,text);}
// Where the builder cannot run inside search at all, the card says to open it.
{mode='ok';const r=await ask('mono red deck',make({buildFlow:undefined})),done=await r.a.finish(),text=shown(done,r.plan);
 assert.match(text,/The deck builder cannot run inside search here\. Open it to build this deck\./,text);assert.equal(done.buttons[0].label,'Open the deck builder');}
// A slow card service does not hold the first answer: the fitting questions simply come with the finished one.
{mode='ok';const slow=make({api:()=>new Promise(r=>setTimeout(()=>r(angles),2500))}),t0=Date.now(),r=await ask('mono green deck',slow);
 if(r.a.finish){assert.ok(Date.now()-t0<2400,'first answer in '+(Date.now()-t0)+' ms');assert.deepEqual(r.a.follow.map(f=>f.label),['Under $50?']);const done=await r.a.finish();assert.ok(done.follow.length>1,'the questions arrive with the finished answer');}}

console.log(`answer-plain: ${read} plain deck wordings read as deck questions; over ${live?'the live':'the saved 13 Nov'} Standard feed (${feed.decks.length} lists) ${built} mono wordings got a built deck and ${named} a tournament list, each claim recounted from the lists`);
