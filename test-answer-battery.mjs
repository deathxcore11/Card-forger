// 1,000+ different questions across Magic, Pokémon and Yu-Gi-Oh! (Randall, 13 Nov 2026: "Ask 1000 different relative questions on
// all 3 games stuff the app should know"). Each question carries the reading it must get from answer-search.js: the right lookup,
// the right card / set / format / colour, or an honest "can't" for a word the app cannot use. No question may be answered
// with a word silently dropped. Run with BATTERY=list to print every question and its reading.
import assert from 'node:assert/strict';
import {planQuery} from './answer-search.js';
import {gameGlossaryEntry} from './game-wiki-knowledge.js';

const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9$.]+/g,' ').trim();
const G={
 mtg:{label:'magic',
  cards:['Lightning Bolt','Sol Ring','Sheoldred, the Apocalypse','The One Ring','Black Lotus','Path to Exile','Ragavan, Nimble Pilferer','Counterspell','Llanowar Elves','Thoughtseize'],
  sets:[{code:'blb',name:'Bloomburrow'},{code:'dsk',name:'Duskmourn: House of Horror'},{code:'mh3',name:'Modern Horizons 3'},{code:'fdn',name:'Foundations'}],
  formats:['Standard','Pioneer','Modern','Legacy','Vintage','Pauper','Commander'],
  keywords:['trample','flying','deathtouch','ward','haste','lifelink','vigilance','menace','flash','hexproof'],
  rules:['can i respond to a ward trigger','what happens if two legendary creatures enter','can a creature attack the turn it enters','does deathtouch work with trample','can i counter a spell that cant be countered','what happens when a commander dies','does summoning sickness stop me tapping for mana','can i block a creature with flying','how many lands can i play each turn','when can i cast an instant'],
  artists:['rebecca guay','john avon','seb mckinnon','terese nielsen','mark tedin','kev walker'],
  archetypes:['prowess','burn','tron','affinity','storm']},
 ptcg:{label:'pokemon',
  cards:['Charizard ex','Pikachu','Mew ex','Rare Candy',"Boss's Orders",'Iono','Gardevoir ex','Ultra Ball','Dragapult ex',"Professor's Research"],
  sets:[{id:'sv8',name:'Surging Sparks'},{id:'sv3pt5',name:'151'},{id:'sv4pt5',name:'Paldean Fates'},{id:'swsh7',name:'Evolving Skies'}],
  formats:['Standard','Expanded'],
  keywords:['retreat','weakness','resistance','evolution','prize cards','bench','active spot','ability','stadium','supporter'],
  rules:['can i evolve on my first turn','can i retreat twice in one turn','how many supporters can i play each turn','can i attack on the first turn','what happens when i run out of cards','how many energy can i attach each turn','can i evolve a pokemon the turn it is played','does poison stack','when do i draw a prize card','can i play two stadiums'],
  artists:['mitsuhiro arita','ken sugimori','yuka morii','kouki saitou'],
  archetypes:['charizard','dragapult','gardevoir','raging bolt','gholdengo']},
 ygo:{label:'yugioh',
  cards:['Ash Blossom & Joyous Spring','Dark Magician','Blue-Eyes White Dragon','Pot of Greed','Maxx "C"','Monster Reborn','Raigeki','Effect Veiler','Infinite Impermanence','Nibiru, the Primal Being'],
  sets:[{id:'LOB',code:'LOB',name:'Legend of Blue Eyes White Dragon'},{id:'ROTA',code:'ROTA',name:'Rage of the Abyss'},{id:'MRD',code:'MRD',name:'Metal Raiders'},{id:'PHNI',code:'PHNI',name:'Phantom Nightmare'}],
  formats:['Advanced','Goat','Edison'],
  keywords:['tribute summon','special summon','chain','piercing','flip effect','link summon','synchro summon','xyz summon','fusion summon','quick effect'],
  rules:['can i chain to a counter trap','can i activate a trap the turn i set it','how many normal summons do i get each turn','can i attack on the first turn','what happens if both players run out of cards','can i special summon from the extra deck in defense','does a quick effect work in the damage step','can i tribute my opponents monster','when can i activate a quick play spell','how many cards can i have in my hand'],
  artists:['kazuki takahashi'],
  archetypes:['blue eyes','snake eye','branded','tenpai','yubel']},
};
const Q=[];// {game,q,why,ok(plan)}
const add=(game,q,why,ok)=>Q.push({game,q,why,ok});
const tool=(t,more=()=>true)=>p=>p.answerable&&p.call?.tool===t&&more(p);
const cant=p=>!p.answerable&&(p.intent==='unknown'||p.intent==='names');
const notAnswered=p=>p.intent==='names'||p.intent==='unknown'||p.call?.pick==='maybe';

for(const [g,D] of Object.entries(G)){
 // --- One card's price: eight wordings, every card. The whole name is the card, nothing else.
 for(const c of D.cards){
  const n=norm(c),name=p=>p.call.args.name===n&&p.call.pick==='price';
  for(const q of [`how much is ${c}`,`price of ${c}`,`${c} price`,`what is ${c} worth`,`how much does ${c} cost`,`what's the price of ${c}`,`how much is ${c} going for`,`${c} worth`])add(g,q,'price of '+n,tool('card_details',name));
  // --- Do I own it.
  const own=p=>p.call.args.name===n&&p.call.pick==='owned';
  for(const q of [`do i own ${c}`,`do i have ${c}`,`how many ${c} do i have`,`how many copies of ${c} do i own`,`have i got ${c}`])add(g,q,'owned count of '+n,tool('card_details',own));
  // --- Legality in a named format.
  for(const f of D.formats.slice(0,g==='mtg'?4:2)){
   const legal=p=>p.call.args.name===n&&p.call.pick==='legal'&&p.call.format===f;
   const fw=g==='ygo'&&f==='Advanced'?'tcg':f.toLowerCase();
   for(const q of [`is ${c} legal in ${fw}`,`is ${c} banned in ${fw}`,`can i play ${c} in ${fw}`])add(g,q,`legality of ${n} in ${f}`,q.startsWith('can i')?p=>legal(p)||p.call?.tool==='judge':tool('card_details',legal));
  }
  // --- A bare card name is a name search, never an "answer".
  add(g,c,'plain name search',p=>p.intent==='names'&&!p.call);
  // --- A finish or edition the search cannot price: said, not dropped.
  for(const fin of g==='mtg'?['etched','borderless','graded']:g==='ptcg'?['holo','reverse holo','full art']:['1st edition','ghost rare','secret rare'])add(g,`how much is a ${fin} ${c}`,`"${fin}" is not dropped from a price`,p=>cant(p)&&/finish|edition|rarity/.test(p.why||''));
 }
 // --- Tournament decks: twelve wordings, every format.
 for(const f of D.formats){
  const fw=f.toLowerCase(),plain=p=>p.intent==='meta.best'&&p.call.args.format===f&&!p.call.args.match&&!p.call.args.colors&&!p.call.args.sort;
  for(const q of [`best ${fw} deck`,`top ${fw} decks`,`what is the best deck in ${fw}`,`best deck in ${fw} right now`,`what is winning in ${fw}`,`${fw} meta`,`what's the ${fw} meta right now`,`most played deck in ${fw}`,`strongest ${fw} deck`,`tier 1 ${fw} decks`,`what deck should i play in ${fw}`,`most popular ${fw} deck this week`])
   add(g,(g==='mtg'?'':D.label+' ')+q,`top ${f} deck, nothing else`,tool('meta_decks',plain));
 }
 // --- Named archetypes: the name narrows the decks.
 for(const a of D.archetypes)for(const q of [`best ${a} deck`,`top ${a} decks`,`what is the best ${a} deck right now`,`strongest ${a} deck in the meta`])
  add(g,q,`decks narrowed by "${a}"`,tool('meta_decks',p=>p.call.args.match===a));
 // --- Decks by what you own and by price.
 for(const [q,sort] of [['which meta deck am i closest to','closest'],['best deck i can build','closest'],['best deck for my collection','closest'],['cheapest deck','cheapest'],['best budget deck','cheapest'],['cheapest meta deck right now','cheapest']])add(g,q,'decks sorted: '+sort,tool('meta_decks',p=>p.call.args.sort===sort));
 for(const [q,n] of [['second best deck',2],['third best deck',3],['2nd best deck in the meta',2]])add(g,q,'deck number '+n,tool('meta_decks',p=>p.call.nth===n));
 for(const q of ['best deck under $50','best deck for $100 or less','best meta deck under $200'])add(g,q,'decks under a price',tool('meta_decks',p=>p.call.args.under>0));
 for(const q of ['best deck last year','best deck in 2019','best deck of all time','what was the best deck 3 years ago'])add(g,q,'another time is not answered with today',cant);
 // --- Sets.
 for(const s of D.sets){
  const id=String(s.code||s.id),sn=s.name.toLowerCase();
  for(const [q,pick] of [[`most expensive card in ${sn}`,'price-desc'],[`priciest card in ${sn}`,'price-desc'],[`what is the most valuable card in ${sn}`,'price-desc'],[`cheapest card in ${sn}`,'price-asc']])add(g,q,`set ${id} ranked ${pick}`,tool('set_cards',p=>p.call.args.set===id&&p.call.pick===pick));
  for(const [q,pick] of [[`when did ${sn} come out`,'date'],[`when was ${sn} released`,'date'],[`${sn} release date`,'date'],[`how many cards in ${sn}`,'count'],[`how many cards are in ${sn}`,'count']])add(g,q,`set ${id} ${pick}`,tool('list_sets',p=>p.call.pick===pick&&p.call.args.query===s.name));
  add(g,`when does ${sn} rotate`,'"rotate" is not a release date',p=>p.intent!=='set.info');
  add(g,`how much is ${D.cards[0]} from ${sn}`,'one printing is not priced as the usual one',cant);
 }
 for(const [q,pick,order] of [['newest set','newest','newest'],['what is the latest set','newest','newest'],['oldest set','oldest','oldest'],['what was the first set','oldest','oldest'],['biggest set','largest','largest'],['what is the largest set','largest','largest']])add(g,q,'sets ranked '+order,tool('list_sets',p=>p.call.args.order===order));
 for(const q of ['next set','what is the next set','when does the next set come out','upcoming sets'])add(g,q,'next set',tool('list_sets',p=>p.call.pick==='upcoming'));
 add(g,'most expensive card in this set','asks which set',p=>p.intent==='set.rank'&&p.missing[0]?.slot==='set');
 // --- Your collection and decks.
 for(const q of ['how much is my collection worth','what is my collection worth','total value of my cards','what are my cards worth'])add(g,q,'collection total',tool('my_collection',p=>p.call.pick==='total'));
 for(const q of ['how many cards do i have','how many cards do i own'])add(g,q,'collection count',tool('my_collection',p=>p.call.pick==='total'));
 for(const q of ['what is my most valuable card','my most expensive card','what are my most valuable cards'])add(g,q,'collection top by value',tool('my_collection',p=>p.call.args.sort==='value'&&p.call.pick==='price-desc'));
 add(g,'my cheapest card','collection bottom by value',tool('my_collection',p=>p.call.pick==='price-asc'));
 for(const q of ['what are my decks','how many decks do i have','list my decks'])add(g,q,'my decks, all of them',tool('my_decks',p=>!p.call.args.match&&!p.call.args.colors&&!p.call.args.format&&p.call.pick==='list'));
 for(const q of ['what is my best deck','my strongest deck','which of my decks is the best'])add(g,q,'my strongest deck',tool('my_decks',p=>p.call.pick==='power'&&!p.call.args.match));
 add(g,`my ${D.formats[0].toLowerCase()} decks`,'my decks in a format',tool('my_decks',p=>p.call.args.format===D.formats[0]));
 add(g,`my ${D.archetypes[0]} deck`,'my decks by name',tool('my_decks',p=>p.call.args.match===D.archetypes[0]));
 add(g,'how much are my decks worth','deck worth is not "you have N decks"',cant);
 // --- Keywords: the game's own glossary when it has the word, never a price or a deck.
 for(const k of D.keywords){
  const has=!!(gameGlossaryEntry(g,k)||gameGlossaryEntry(g,k.replace(/s$/,'')));
  for(const q of [`what does ${k} mean`,`what is ${k}`,`how does ${k} work`])add(g,q,has?'keyword from the glossary':'no glossary entry: rulebook or no answer',has?tool('glossary'):p=>p.call?.tool==='judge'||notAnswered(p));
 }
 // --- Rules questions go to the Judge's rulebook.
 for(const q of D.rules)add(g,q,'rulebook',p=>p.call?.tool==='judge');
 // --- Artists.
 for(const a of D.artists)for(const q of [`cards by ${a}`,`art by ${a}`,`cards illustrated by ${a}`,`${a} artist`])
  add(g,q,g==='ygo'?'Yu-Gi-Oh! names no artist':'cards by the artist',g==='ygo'?p=>cant(p)&&/artist/.test(p.why):tool('discover',p=>p.call.args.value===a));
 // --- App actions and help.
 for(const [q,route] of [['scan a card','#scan'],['open my wishlist','#collection/wishlist'],['go to settings','#settings'],['start a match','#play'],['open my binders','#collection/binders']])add(g,q,'opens '+route,tool('go',p=>p.call.args.route===route));
 for(const q of ['how do i scan a card','how do i back up my collection','how do i import my cards','how do i add a card to my wishlist','where is my wishlist'])add(g,q,'app help',tool('app_help'));
 add(g,`build me a ${D.archetypes[0]} deck`,'deck builder',tool('build_deck'));
 // --- History goes to the wiki.
 for(const q of ['who won worlds 2019','who won the world championship in 2023','who created the game'])add(g,q,'wiki',p=>p.call?.tool==='wiki_lookup'||notAnswered(p));
 // --- Opinions and nonsense get no made-up answer.
 for(const q of ['is this game fun','why is the sky blue','should i sell my cards','asdf qwer zxcv','what should i eat for dinner'])add(g,q,'no made-up answer',notAnswered);
}

// --- Magic only: deck colours.
const COL={white:'w',blue:'u',black:'b',red:'r',green:'g'};
const GUILD={azorius:'wu',dimir:'ub',rakdos:'br',gruul:'rg',selesnya:'gw',orzhov:'wb',izzet:'ur',golgari:'bg',boros:'rw',simic:'gu',esper:'wub',grixis:'ubr',jund:'brg',naya:'rgw',bant:'gwu',abzan:'wbg',jeskai:'urw',sultai:'bgu',mardu:'rwb',temur:'gur'};
const same=(a,b)=>[...a].sort().join('')===[...b].sort().join('');
for(const [w,c] of Object.entries(COL)){
 for(const q of [`best ${w} deck`,`top ${w} decks in modern`,`what is the best ${w} deck right now`,`strongest ${w} deck in standard`,`which ${w} deck is winning`])add('mtg',q,`decks with ${w} in them`,tool('meta_decks',p=>same(p.call.args.colors||[],c)&&p.call.args.exact===false&&!p.call.args.match));
 for(const q of [`best mono ${w} deck`,`best mono-${w} deck in pioneer`,`top mono${w} decks`])add('mtg',q,`mono-${w} decks`,tool('meta_decks',p=>same(p.call.args.colors||[],c)&&p.call.args.exact===true&&!p.call.args.match));
 for(const q of [`best deck not ${w}`,`best non ${w} deck`,`best deck without ${w}`])add('mtg',q,`decks with no ${w}`,tool('meta_decks',p=>same(p.call.args.without||[],c)&&!p.call.args.colors));
 for(const q of [`my ${w} deck`,`my best ${w} deck`])add('mtg',q,`my decks with ${w}`,tool('my_decks',p=>same(p.call.args.colors||[],c)));
 for(const q of [`my most valuable ${w} card`,`how many ${w} cards do i own`])add('mtg',q,`collection cannot be narrowed by ${w}: said`,cant);
 for(const s of G.mtg.sets.slice(0,2))add('mtg',`most expensive ${w} card in ${s.name.toLowerCase()}`,`set ${s.code} narrowed to ${w}`,tool('card_search',p=>p.call.args.q===`set:${s.code} c:${c}`&&p.call.args.dir==='desc'));
 for(const t of ['creature','instant','dragon'])add('mtg',`${w} ${t}s`,`${w} ${t} cards`,tool('card_search',p=>p.call.args.q===`c:${c} t:${t}`));
 add('mtg',`${w} cards`,`${w} cards, not an artist called ${w}`,tool('card_search',p=>p.call.args.q==='c:'+c));
 add('mtg',`cheapest ${w} creature legal in standard`,'filters with a rank',tool('card_search',p=>p.call.args.q===`c:${c} t:creature f:standard`&&p.call.args.dir==='asc'));
 add('mtg',`${w} cards by john avon`,'artist narrowed by colour',tool('card_search',p=>p.call.args.q===`a:"john avon" c:${c}`));
}
for(const [name,cs] of Object.entries(GUILD))for(const q of [`best ${name} deck`,`top ${name} decks in modern`,`what is the best ${name} deck right now`])
 add('mtg',q,`exactly ${name} colours`,tool('meta_decks',p=>same(p.call.args.colors||[],cs)&&p.call.args.exact===true&&!p.call.args.match));
for(const [a,b] of [['white','blue'],['blue','black'],['black','red'],['red','green'],['green','white']])
 add('mtg',`best ${a} ${b} deck`,`exactly ${a} and ${b}`,tool('meta_decks',p=>same(p.call.args.colors||[],COL[a]+COL[b])&&p.call.args.exact===true));
for(const [w,n] of [['two',2],['three',3],['2',2],['five',5]])add('mtg',`best ${w} color deck`,n+'-colour decks',tool('meta_decks',p=>p.call.args.count===n));
for(const r of ['mythic','rare','uncommon'])for(const s of G.mtg.sets.slice(0,2))add('mtg',`most expensive ${r} in ${s.name.toLowerCase()}`,`set ${s.code} narrowed to ${r}`,tool('card_search',p=>p.call.args.q===`set:${s.code} r:${r}`));
for(const s of G.mtg.sets)add('mtg',`cards by rebecca guay in ${s.name.toLowerCase()}`,'artist narrowed by set',tool('card_search',p=>p.call.args.q===`a:"rebecca guay" set:${s.code}`));
for(const c of G.mtg.cards.slice(0,5)){add('mtg',`how much is a foil ${c}`,'foil price',tool('card_details',p=>p.call.pick==='price-foil'&&p.call.args.name===norm(c)));add('mtg',`best deck with ${c}`,'decks that play the card',tool('meta_decks',p=>p.call.args.match===norm(c)));}

// --- Pokémon and Yu-Gi-Oh! only: kinds of card are not artists, card names, or dropped.
for(const k of ['trainer','supporter','item','stadium','energy','fire','water','basic','ex'])add('ptcg',`${k} cards`,`"${k} cards" is not an artist`,p=>p.intent!=='cards.artist'&&p.call?.tool!=='discover');
for(const k of ['spell','trap','monster','link','synchro','xyz','fusion','dark','light'])add('ygo',`${k} cards`,`"${k} cards" is not an artist`,p=>p.intent!=='cards.artist'&&!/artist/.test(p.why||''));
for(const k of ['fire','water','grass','psychic','lightning','fighting','dragon'])for(const [q,ok] of [
 [`best ${k} deck`,tool('meta_decks',p=>p.call.args.match===k)],[`best ${k} type deck`,tool('meta_decks',p=>p.call.args.match===k)],
 [`my most valuable ${k} card`,cant],[`how many ${k} cards do i own`,cant],[`most expensive ${k} card in surging sparks`,cant]])add('ptcg',q,`"${k}" is used or said to be unusable`,ok);
for(const k of ['dark','light','earth','water','fire','wind'])for(const [q,ok] of [
 [`best ${k} deck`,tool('meta_decks',p=>p.call.args.match===k)],[`best ${k} attribute deck`,tool('meta_decks',p=>p.call.args.match===k)],
 [`how many ${k} monsters do i own`,cant],[`most expensive ${k} monster in rage of the abyss`,cant]])add('ygo',q,`"${k}" is used or said to be unusable`,ok);
for(const k of ['dragon','spellcaster','warrior','fiend','zombie','machine'])add('ygo',`best ${k} deck`,`"${k}" narrows the decks`,tool('meta_decks',p=>p.call.args.match===k));
for(const r of ['secret rare','ultra rare','illustration rare','holo'])for(const g of ['ptcg','ygo'])add(g,`most expensive ${r} in ${G[g].sets[0].name.toLowerCase()}`,`"${r}" is not dropped from a set question`,cant);
add('ptcg','how many fire energy do i have','Fire Energy is a card',tool('card_details',p=>p.call.args.name==='fire energy'));
add('ygo','is pot of greed limited','ban list status',tool('card_details',p=>p.call.pick==='legal'&&p.call.args.name==='pot of greed'));
add('ygo','is maxx c banned in the ocg','OCG list',tool('card_details',p=>p.call.pick==='legal'&&p.call.ocg===true&&p.call.args.name==='maxx c'));
add('ygo','is ash blossom forbidden','ban list status',tool('card_details',p=>p.call.pick==='legal'&&p.call.args.name==='ash blossom'));

// ---- Run.
const seen=new Set(),fails=[];let n=0;
for(const t of Q){
 const key=t.game+'|'+norm(t.q);if(seen.has(key))continue;seen.add(key);n++;
 const D=G[t.game],plan=planQuery(t.q,{game:t.game,formatLast:{},sets:D.sets,screen:{}});
 let ok=false;try{ok=!!t.ok(plan);}catch{ok=false;}
 const line=`${t.game} | ${t.q} | want: ${t.why} | got: ${plan.intent}${plan.call?' '+plan.call.tool+' '+JSON.stringify(plan.call.args)+(plan.call.pick?' pick='+plan.call.pick:''):''}${plan.why?' why='+plan.why:''}${plan.missing?.length?' asks '+plan.missing[0].slot:''}`;
 if(process.env.BATTERY==='list')console.log((ok?'ok   ':'FAIL ')+line);
 if(!ok)fails.push(line);
}
if(fails.length&&process.env.BATTERY!=='list')console.log(fails.join('\n'));
const per=Object.fromEntries(Object.keys(G).map(g=>[g,[...seen].filter(k=>k.startsWith(g+'|')).length]));
assert.ok(n>=1000,'the battery holds at least 1,000 different questions (has '+n+')');
assert.equal(fails.length,0,fails.length+' of '+n+' questions are read wrong');
console.log(`answer-battery: ${n} different questions read correctly (Magic ${per.mtg}, Pokémon ${per.ptcg}, Yu-Gi-Oh! ${per.ygo})`);
