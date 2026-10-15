// Functional regressions: costs/targets/restrictions, plus real-list damage in all games.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { mtgConstructedPower, ygoPower, ptcgPower } from './deckpower.js';
const part = (p,k) => p.parts.find(x=>x.key===k);
const pk=(name,more={})=>({name,category:'Pokemon',basicPokemon:true,stage:'Basic',retreat:2,attacks:[{name:'Hit',cost:['Colorless'],damage:100}],...more});
const en=(type)=>({name:`${type} Energy`,category:'Energy',basicEnergy:true});
const kang=pk('Limited draw',{abilities:[{name:'Errand',effect:"Once during your turn, draw 2 cards. You can't use more than 1 Errand Ability each turn."}]});
const teal=pk('Conditional draw',{abilities:[{name:'Dance',effect:'You may attach a Basic {G} Energy card from your hand to this Pokémon. If you attached Energy in this way, draw a card.'}]});
const filler={name:'Filler',category:'Trainer',effect:'Heal 10 damage.'};
const pRows=(c,e=en('Fire'))=>[{qty:4,c},{qty:12,c:e},{qty:44,c:filler}];
const absent=ptcgPower(pRows(teal));
assert.equal(part(absent,'Draw').ratio,0,'draw requiring Grass attachment gets no credit without Grass');
const limited=ptcgPower(pRows(kang));
assert.ok(part(limited,'Draw').count<4,'shared once-per-turn draw is not four independent engines');
const latias=pk('Retreat support',{abilities:[{effect:'Your Basic Pokémon in play have no Retreat Cost.'}]});
assert.ok(part(ptcgPower([...pRows(kang).slice(0,2),{qty:2,c:latias},{qty:42,c:filler}]),'Switch').ratio>part(limited,'Switch').ratio,'retreat support counts by function, regardless of name');
const fusion={name:'AB Fusion',category:'Monster',typeLine:'Fusion Effect Monster',frame:'fusion',text:'"Material A" + "Material B"',atk:3000};
const mat={name:'Material A',category:'Monster',level:4,text:'You can Fusion Summon a monster from your Extra Deck.'};
const yr=[{zone:'main',qty:3,c:mat},{zone:'main',qty:37,c:{name:'Other',category:'Monster',level:4,text:''}},{zone:'extra',qty:1,c:fusion}];
assert.match(String(part(ygoPower(yr,{extra:15}),'Extra').count),/0 usable/,'one named Fusion material cannot satisfy two required names');
const cat={swamp:{name:'Swamp',type_line:'Basic Land — Swamp',produced_mana:['B'],cmc:0},costly:{name:'Costly',type_line:'Instant',cmc:2,mana_cost:'{1}{B}',oracle_text:'As an additional cost to cast this spell, sacrifice a creature. Draw two cards.'},blank:{name:'Blank',type_line:'Instant',cmc:1,mana_cost:'{B}',oracle_text:'Target opponent loses 1 life.'}};
const md={cards:[{name:'Swamp',qty:24},{name:'Costly',qty:4},{name:'Blank',qty:32}]};
assert.equal(part(mtgConstructedPower(md,cat,s=>s.toLowerCase()),'Flow').count,0,'sacrifice draw cannot supply card flow without fodder');
const B=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/power-bench.json.gz',import.meta.url))));
for(const g of ['mtg','ygo','ptcg']){
 const score=c=>g==='mtg'?mtgConstructedPower({cards:c.cards},B.mtg.cards,s=>s.toLowerCase()).score:(g==='ygo'?ygoPower:ptcgPower)(g==='ygo'?Object.entries(c.zones).flatMap(([zone,rs])=>rs.map(r=>({...r,zone,c:B[g].cards[r.cardId]}))):c.zones.main.map(r=>({...r,c:B[g].cards[r.cardId]})),{extra:15}).score;
 const win=B[g].cases.find(c=>c.label==='winner'&&c.fmt!=='EDH');
 const damage=B[g].cases.find(c=>c.group===win.group&&c.label===({mtg:'wrongMana',ygo:'noEngine',ptcg:'noMiddle'}[g]));
 assert.ok(damage,`${g} has a damaged reference fixture`);
 const a=score(win),b=score(damage);assert.ok(b<a,`${g} engine must react to functional damage (${a} vs ${b})`);
 console.log(`${g}: reference engine ${a}, damaged ${b}`);
}
console.log('PASS: functional costs, shared limits, retreat support, Fusion requirements and damage across three games.');
// Recognizing the archetype must not grant its record to a broken or modified list.
const {matchupBlock,canBorrowResults}=await import('./matchup.js');
for(const game of ['mtg','ygo','ptcg']){
 const reference={game,match:{sim:.95,archetype:'Winner',coreMissing:[],coreShort:[]},caps:[],readiness:{provisional:false}};
 assert.ok(canBorrowResults(reference));
 assert.ok(!canBorrowResults({...reference,readiness:{provisional:true}}));
 assert.ok(!canBorrowResults({...reference,match:{...reference.match,coreMissing:[{name:'Common card'}]}}));
 assert.ok(matchupBlock({...reference,caps:[{key:game==='mtg'?'Mana':game==='ygo'?'Extra':'Energy',max:45,label:'Cannot execute',why:'Missing prerequisite.'}]}));
}
const {ptcgGoldfish}=await import('./goldfish.js');
const colored=pk('Typed attacker',{attacks:[{name:'Hit',cost:['Grass','Grass'],damage:200}]});
assert.equal(ptcgGoldfish(pRows(colored,en('Fire'))).metrics[1].value,0,'wrong-color Energy cannot pay a colored attack');
assert.ok(ptcgGoldfish(pRows(colored,en('Grass'))).metrics[1].value>0,'correct Basic Energy can pay the attack');
const noEnergy=ptcgPower([{qty:4,c:kang},{qty:56,c:filler}]);
assert.ok(noEnergy.score<=45,'Colorless attacks still require Energy');
// The user example's actual card text: the shared limit, retreat support, and Prize value.
const actual=Object.values(B.ptcg.cards).find(c=>c.name==='Mega Kangaskhan ex');
assert.ok(actual);
assert.ok(part(ptcgPower(pRows(actual)),'Draw').count<4);
assert.match(ptcgPower(pRows(actual)).profile.find(([k])=>k==='Prize plan')[1],/three-prize/);
console.log('PASS: reference-result eligibility, Basic Energy payment and Mega Kangaskhan restrictions.');
// Public assessment gates and cosmetic invariance, exercised through the same
// functions the deck page and optimizer call rather than only the low-level score.
const {S,blank}=await import('./store.js');
const {mtgPower,tcgPower,shownPower}=await import('./power.js');
const {YGO_FORMATS}=await import('./ygo.js');
const {PTCG_FORMATS}=await import('./ptcg.js');
S.state=blank();S.catalog=B.mtg.cards;
for(const game of ['mtg','ygo','ptcg']){
 const fixture=B[game].cases.find(c=>c.label==='winner'&&c.fmt!=='EDH');
 const deck={id:'functional-'+game,name:'Original',format:fixture.fmt,cards:fixture.cards,zones:fixture.zones};
 const fmt=(game==='ygo'?YGO_FORMATS:PTCG_FORMATS)[0];
 const assess=(d,cards=B[game].cards)=>game==='mtg'?mtgPower(d):tcgPower(game,d,fmt,id=>cards[id] || null);
 const original=assess(deck);
 assert.equal(shownPower(assess({...deck,name:'World Champion $9999'})),shownPower(original),'deck title cannot grant power');
 const cosmetic=Object.fromEntries(Object.entries(B[game].cards).map(([id,c])=>[id,{...c,rarity:'Mythic expensive foil',prices:{usd:9999},image:'https://example.com/art.jpg'}]));
 if(game==='mtg')S.catalog=cosmetic;
 assert.equal(assess({...deck,id:deck.id+'-art'},cosmetic).heuristic,original.heuristic,`${game}: price, rarity and art cannot improve the engine`);
 if(game==='mtg')S.catalog=B.mtg.cards;
 const bad=game==='mtg'?{...deck,id:'bad-mtg',cards:[{name:'gibberish xyz',qty:60}]}:{...deck,id:'bad-'+game,zones:{main:[{cardId:'gibberish xyz',name:'gibberish xyz',qty:game==='ygo'?40:60}],extra:[],side:[]}};
 const unknown=assess(bad);assert.ok(shownPower(unknown)<=45,`${game}: unknown cards cannot borrow competitive credit`);assert.ok(matchupBlock(unknown));
}
console.log('PASS: all three games reject gibberish and ignore deck titles, prices, rarity and artwork.');
const splitLimited=ptcgPower([{qty:2,c:kang},{qty:2,c:{...kang,id:'alternate-print'}},{qty:12,c:en('Fire')},{qty:44,c:filler}]);
assert.equal(part(splitLimited,'Draw').count,part(limited,'Draw').count,'splitting printings cannot evade a shared Ability limit');
const bothMaterials=yr.map(r=>r.c.name==='Other'?{...r,qty:34}:r).concat({zone:'main',qty:3,c:{...mat,name:'Material B'}});
assert.equal(part(ygoPower(bothMaterials,{extra:15}),'Extra').count,1,'restoring the other required material restores the supported Fusion');
const misleadingMaterial=yr.map(r=>r.c.name==='Other'?{...r,c:{...r.c,name:'Material B Impostor'}}:r);
assert.match(String(part(ygoPower(misleadingMaterial,{extra:15}),'Extra').count),/0 usable/,'a longer name cannot impersonate an exact named Fusion material');
const fodder={name:'Fodder',type_line:'Creature — Zombie',cmc:1,mana_cost:'{B}',power:'1',toughness:'1',oracle_text:''};
assert.equal(part(mtgConstructedPower({...md,cards:md.cards.map(r=>r.name==='Blank'?{name:'Fodder',qty:r.qty}:r)},{...cat,fodder},s=>s.toLowerCase()),'Flow').count,4,'restoring sacrifice fodder restores supported draw');
console.log('PASS: functional repairs restore credit; printing and name tricks cannot bypass prerequisites.');
const {ygoGoldfish}=await import('./goldfish.js');
const multiRole={name:'One resource',text:'You can only use this effect of "One resource" once per turn.'};
const multi=ygoGoldfish([{qty:1,c:multiRole,tags:new Set(['starter','extender'])},{qty:39,c:{name:'Blank'},tags:new Set()}]);
assert.equal(multi.metrics[0].value,0,'one physical card cannot supply both starter and a separate continuation');
const repeated=ygoGoldfish([{qty:3,c:multiRole,tags:new Set(['starter','extender'])},{qty:37,c:{name:'Blank'},tags:new Set()}]);
assert.equal(repeated.metrics[0].value,0,'shared once-per-turn copies cannot be assumed independent continuations');
const {spendMana,mtgGoldfish}=await import('./goldfish.js');
assert.equal(spendMana([['G'],['G']],['R'],2),null,'two green sources cannot pay red');
assert.equal(spendMana([['G','R']],['G','R'],2),null,'one dual source cannot pay two pips');
assert.deepEqual(spendMana([['G','R'],['G']],['G','R'],2),[],'flexible source is assigned without wasting the only red source');
const wrongColor=mtgGoldfish([{qty:24,c:{name:'Forest',cmc:0,type_line:'Basic Land — Forest'}},{qty:36,c:{name:'Red threat',cmc:2,mana_cost:'{1}{R}',type_line:'Creature',power:'3',oracle_text:''}}]);
assert.equal(wrongColor.metrics[1].value,0,'turn simulation cannot cast red threats with Forests');
console.log('PASS: typed mana payment, flexible-source allocation and no double spending.');
const guide={name:'Guide',category:'Trainer',typeLine:'Trainer · Supporter',effect:'Search your deck for a Pokémon.'};
const accelerate={name:'Accelerate',category:'Trainer',typeLine:'Trainer · Supporter',effect:'Attach 1 Energy from your deck to your Pokémon.'};
const turnTests=ptcgGoldfish([{qty:4,c:colored},{qty:4,c:pk('Other Basic')},{qty:4,c:guide},{qty:4,c:accelerate},{qty:12,c:en('Grass')},{qty:32,c:filler}]);
for(const sample of turnTests.samples)for(const log of sample.log){
 const used=(log.text.match(/Guide →|Accelerate: \+1 Energy/g)||[]).length;
 assert.ok(used<=1,'one Supporter per turn across search and acceleration');
 if(log.t===1)assert.equal(used,0,'no Supporter on the first turn going first');
}
console.log('PASS: Pokémon Supporter timing and shared turn-use budget.');
