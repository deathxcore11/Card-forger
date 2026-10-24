import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectFinalSupport,finalSupportFingerprint} from './mtg-final-support.js';
import {mtgStrategicEstimate} from './commander-strategy.js';
import {commanderCriteria} from './commander-criteria.js';
import {cardKey,validateDeck,roles} from './core.js';
import {chooseDeck,priceDeck} from './deck-construction.js';

// Actual frozen public card text, not generated tournament lists or target scores.
const frozen=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/final-support-cards.json',import.meta.url)));
const actual=n=>structuredClone(frozen.cards.find(c=>c.name===n));
const row=(card,qty=1,zone='main')=>({name:card?.name||'Unresolved',card,qty,zone});
const c=(name,type_line,oracle_text='',power,cmc=1,mana_cost='{1}')=>({name,type_line,oracle_text,power:power===undefined?undefined:String(power),toughness:'2',cmc,mana_cost,colors:[],color_identity:[],legalities:{commander:'legal',modern:'legal'}});
const rog=actual('Rograkh, Son of Rohgahh'),mountain=actual('Mountain'),plains=actual('Plains'),forest=actual('Forest'),ring=actual('Sol Ring'),hammer=actual('Colossus Hammer'),thopter=actual('Ornithopter'),druid=actual('Devoted Druid'),vizier=actual('Vizier of Remedies');
const deck=(rows,commander='')=>({format:commander?'Commander':'Modern',commander,cards:rows.filter(r=>r.zone==='main').map(r=>({name:r.name,qty:r.qty})),side:rows.filter(r=>r.zone==='side').map(r=>({name:r.name,qty:r.qty}))});
const inspect=(rows,request={},d=deck(rows))=>inspectFinalSupport({game:'mtg',format:d.format,...request},rows,d);
const supported=r=>r.routes.filter(x=>x.closing&&x.status==='supported-conditional');
const actualNonclosing=[row(rog),row(ring),row(mountain,98)],manaDeck=deck(actualNonclosing,rog.name),catalog=Object.fromEntries(actualNonclosing.map(r=>[cardKey(r.name),r.card]));
assert.equal(actualNonclosing.reduce((n,r)=>n+r.qty,0),100);
assert.deepEqual(validateDeck(manaDeck,catalog,[]).issues,[],'frozen legal 100-card Commander list is distinct from plan support');
let result=inspect(actualNonclosing,{},manaDeck);
assert.equal(result.status,'known-incomplete');assert.equal(result.axes.closing.status,'known-incomplete');assert.equal(result.requestSatisfied,false);assert.equal(supported(result).length,0);assert.ok(result.issues.some(x=>/nonclosing/.test(x)));
assert.equal(result.coverage.startingCopies,100);assert.ok(result.coverage.evidence.every(e=>e.status==='nonclosing'));
const alien=c('Synthetic unrecognized alternate victory','Enchantment','At the beginning of your upkeep, if the stars agree, you win the game.');
result=inspect([...actualNonclosing.slice(0,2),row(mountain,97),row(alien)],{},manaDeck);
assert.equal(result.status,'unverified','unconsumed alternate victory text is not known zero output');assert.equal(result.issues.length,0);
const mill=c('Synthetic library endpoint','Artifact','{3}: Target opponent mills ten cards.');
assert.equal(inspect([row(plains,59),row(mill)]).status,'unverified','mill outside the supported closing model stays unknown');
for(const card of [c('Synthetic draw','Sorcery','Draw three cards.'),c('Synthetic life','Sorcery','You gain 20 life.'),ring]){
 result=inspect([row(plains,59),row(card)]);assert.equal(supported(result).length,0,'draw, life gain and mana cannot substitute for a closing endpoint');
}

// One evidenced combat package suffices. No three-route quota or lethal claim.
const equipment=[row(plains,52),row(hammer,4),row(thopter,4)];
result=inspect(equipment);assert.equal(result.status,'supported-conditional');assert.equal(result.requestSatisfied,true);assert.equal(supported(result).length,1);assert.equal(supported(result)[0].kind,'equipment');assert.equal(result.independentRouteGroups.length,1);
assert.match(result.axes.closing.meaning,/not lethal/);assert.ok(result.routes.every(r=>r.stages.length===4&&r.evidence.length&&r.assumptions.length));
for(const r of result.routes){assert.ok(r.cardDependencies.length);assert.ok(r.missing);assert.ok(r.unresolved);}
for(const value of [null,'',false]){
 const malformed={...thopter,power:value};assert.equal(inspect([row(plains,56),row(malformed,4)]).status,'unverified','malformed power is not known zero');assert.equal(inspect([row(plains,52),row(hammer,4),row(malformed,4)]).status,'unverified','malformed carrier power cannot inherit a supported Equipment arrangement');
}
assert.equal(inspect([row(plains,56),row(thopter,4)]).status,'known-incomplete','zero-power vanilla flying bodies alone do not create damage');
const small=c('Synthetic incidental utility body','Creature — Human','',1,1);
assert.equal(inspect([row(plains,58),row(small,2)]).status,'unverified','two arbitrary small creatures are not a completed coherent combat plan');
const wall=c('Synthetic defender','Creature — Wall','Defender',4,1),wallGrant=c('Synthetic unknown defender mode','Enchantment',"Creatures you control with defender can attack as though they didn't have defender.");
assert.equal(inspect([row(plains,59),row(wall)]).status,'known-incomplete');
assert.equal(inspect([row(plains,58),row(wall),row(wallGrant)]).status,'unverified','unmapped defender permission cannot become a false known noncloser');
const badPower={...thopter,power:'*'};assert.equal(inspect([row(plains,52),row(hammer,4),row(badPower,4)]).status,'unverified','unknown body characteristics cannot receive an equipment arrangement');
assert.equal(inspect([row(plains,56),row(thopter,4),row(hammer,4,'side')]).status,'known-incomplete','sideboard-only payoff is not a starting-list package');
assert.equal(inspect([row(plains,56),row(thopter,4),row(hammer,4,'outside')]).status,'known-incomplete','outside cards never count as main');

// Optional exact-card abilities remain separate from the body's other utility.
const optionalCards=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/ability-endpoint-cards.json',import.meta.url))).cards;
for(const optional of optionalCards){
 const card=optional,rows=[row(plains,50),row(hammer,4),row(thopter,4),row(card),row(c('Synthetic compatible flexible land','Basic Land','{T}: Add one mana of any color.',undefined,0,''))];
 // Stoneforge has eligible Equipment, so remove just its optional endpoint in a
 // separate test. Light-Paws / Jeong lack their Aura / Lesson branch here.
 const r=inspect(rows);assert.equal(r.status,'supported-conditional',optional.name+' cannot ban unrelated equipped combat');
 if(optional.name!=='Stoneforge Mystic')assert.ok(r.optionalBranches.some(g=>g.status==='unsupported'));
}
const stone=optionalCards.find(x=>x.name==='Stoneforge Mystic'),anthem=c('Synthetic matching anthem','Enchantment','Creature tokens you control get +1/+1.'),knights=c('Synthetic actual owned output','Sorcery','Create two 2/2 white Knight creature tokens.',undefined,3,'{3}');
const tokenPlan=[row(plains,47),row(knights,4),row(anthem,4),row(stone)];
result=inspect(tokenPlan);assert.equal(result.status,'supported-conditional');assert.ok(result.optionalBranches.every(g=>g.status==='unsupported'));assert.equal(result.issues.length,0,'optional search/deploy branches are not whole-card illegality');
for(const t of ['Creature tokens you control get +0/+0.','As long as you control a Dragon, creature tokens you control get +1/+1.'])assert.equal(supported(inspect(tokenPlan.map(r=>r.card===anthem?row({...anthem,oracle_text:t},4):r))).length,0,'zero or unestablished conditional amplifier cannot close');
const gatedTokens={...knights,oracle_text:'At the beginning of your upkeep, if you control a Dragon, create two 2/2 white Knight creature tokens.'};assert.equal(supported(inspect(tokenPlan.map(r=>r.card===knights?row(gatedTokens,4):r))).length,0,'unestablished condition on token production cannot close');
const harmfulAnthem={...anthem,oracle_text:'Creature tokens you control get -1/-1.'};assert.equal(supported(inspect(tokenPlan.map(r=>r.card===anthem?row(harmfulAnthem,4):r))).length,0,'a negative broad modifier is not combat amplification');
const virtue=actual('Intangible Virtue'),monument=actual("Oketra's Monument");
assert.equal(inspect([row(plains,52),row(knights,4),row(virtue,4)]).status,'supported-conditional','actual positive keyword-tail anthem remains supported');
assert.equal(inspect([row(plains,52),row(monument,4),row(virtue,4)]).status,'unverified','actual creature-cast token trigger without creature spells cannot supply output');
const opponentTokens={...knights,oracle_text:'Target opponent creates two 2/2 white Knight creature tokens.'};
assert.equal(supported(inspect(tokenPlan.map(r=>r.card===knights?row(opponentTokens,4):r))).length,0,'opponent-owned tokens cannot support own combat amplification');

// Exact engine proof and compatible conversion are independent axes. The real
// frozen Druid/Vizier pair is used; synthetic outlets test the complete grammar,
// not claims about an invented named combo or an automatic win.
const loopOnly=[row(forest,30),row(plains,28),row(druid),row(vizier)],loopRequest={requireLoop:'infinite-mana',loopOutput:'G'};
result=inspect(loopOnly,loopRequest);assert.equal(result.axes.engine.requestedLoop.status,'verified');assert.equal(result.axes.engine.status,'supported-conditional');assert.equal(supported(result).length,0);assert.equal(result.axes.closing.status,'unverified');assert.equal(result.requestSatisfied,false);assert.equal(result.axes.requestedPlan.status,'supported-conditional');
assert.ok(result.routes.some(r=>r.kind==='reviewed-mana-loop'&&!r.closing&&r.missing.length));
const outlet=c('Synthetic mana-only creature outlet','Enchantment','{2}{G}: Create a 1/1 green Saproling creature token.',undefined,2,'{1}{G}');
const withOutlet=[...loopOnly.slice(0,1),row(plains,27),row(druid),row(vizier),row(outlet)];
result=inspect(withOutlet,loopRequest);assert.equal(result.status,'supported-conditional');assert.ok(result.routes.some(r=>r.kind==='loop-resource-conversion'&&r.status==='supported-conditional'));assert.equal(result.independentRouteGroups.length,1,'paid finite and loop-backed uses of the same output are one dependency group');
assert.ok(result.routes.find(r=>r.kind==='loop-resource-conversion').assumptions.some(s=>/finite number/.test(s)));
const noWhite=[row(forest,57),row(druid),row(vizier),row(outlet)],noWhiteReport=inspect(noWhite,loopRequest);assert.ok(noWhiteReport.routes.some(r=>r.kind==='repeatable-creature-output'&&r.status==='supported-conditional'),'the independent finite outlet survives unsupported optional loop deployment');assert.ok(!noWhiteReport.routes.some(r=>r.kind==='loop-resource-conversion'&&r.status==='supported-conditional'),'green output cannot waive Vizier casting white');assert.ok(noWhiteReport.routes.find(r=>r.kind==='loop-resource-conversion').missing.some(x=>x.includes(vizier.name)));
assert.equal(supported(inspect([...loopOnly,row(outlet,1,'side')],loopRequest)).length,0,'sideboard-only outlet cannot complete a starting engine');
for(const change of [
 {...outlet,oracle_text:'{2}{R}: Create a 1/1 red Goblin creature token.'},
 {...outlet,oracle_text:'{2}{C}: Create a 1/1 colorless Servo artifact creature token.'},
 {...outlet,oracle_text:'{2}, {T}: Create a 1/1 green Saproling creature token.'},
 {...outlet,oracle_text:'{2}, Sacrifice a creature: Create a 1/1 green Saproling creature token.'},
 {...outlet,oracle_text:'{2}, Discard a card: Create a 1/1 green Saproling creature token.'},
 {...outlet,oracle_text:outlet.oracle_text+'\nActivate only once each turn.'},
 {...outlet,oracle_text:'{2}: Draw a card.'},
 {...outlet,oracle_text:'{2}: You gain 1 life.'},
 {...outlet,oracle_text:'{2}: Create a 0/1 green Plant creature token.'}
]){
 const r=inspect(withOutlet.map(x=>x.card===outlet?row(change):x),loopRequest);
 assert.ok(!r.routes.some(x=>x.kind==='loop-resource-conversion'&&x.status==='supported-conditional'),change.oracle_text);
}
const sideLoop=[row(forest,30),row(plains,29),row(druid),row(vizier,1,'side')];
result=inspect(sideLoop,loopRequest);assert.equal(result.axes.engine.requestedLoop.status,'unverified');assert.equal(result.requestSatisfied,false);assert.ok(result.issues.length);
// One flexible mana unit cannot pay two colored pips; a multi-output mode cannot
// donate two copies of a color available only from its one-output alternate mode.
const flexible=c('Synthetic one rainbow source','Basic Land','{T}: Add one mana of any color.',undefined,0,''),twoPips={...outlet,mana_cost:'{G}{G}',cmc:2};
assert.equal(supported(inspect([row(flexible),row(twoPips)])).length,0);
const multimode=c('Synthetic different output modes','Artifact','{T}: Add {C}{C}.\n{T}: Add {G}.',undefined,1,'{1}');
assert.equal(supported(inspect([row(plains),row(multimode),row(twoPips)])).length,0,'two colorless plus alternative one green is not two green');

// Casting a paid-flow permanent is not payment for its draw activation. Actual
// Staff and Lotus Field provide negative controls, not fabricated rule variants.
const staff=actual('Staff of Domination'),lotus=actual('Lotus Field'),flyer=c('Synthetic control finisher','Creature — Bird','Flying',5,1,'{1}'),answer=c('Synthetic payable answer','Instant','Destroy target creature.',undefined,1,'{1}'),blank=c('Synthetic inert artifact','Artifact');
const controlRows=lands=>[row(plains,lands),row(staff),row(flyer,4),row(answer,4),row(blank,51-lands)];
const noFlow=inspect(controlRows(3));assert.ok(noFlow.routes.some(r=>r.kind==='control'));assert.ok(!noFlow.routes.some(r=>r.kind==='control'&&r.status==='supported-conditional'),'three mana casts Staff but cannot activate its five-mana draw');
const paidFlow=inspect(controlRows(5));assert.ok(paidFlow.routes.some(r=>r.kind==='control'&&r.status==='supported-conditional'),'restoring actual draw-activation resources restores the bounded control package');
assert.ok(noFlow.routes.find(r=>r.kind==='control').flowEvidence.some(e=>e.name===staff.name&&e.status==='unverified'));
const cheapOutlet={...outlet,mana_cost:'{1}',cmc:1,oracle_text:'{1}: Create a 1/1 white Soldier creature token.'};
const lotusOnly=inspect([row(lotus),row(cheapOutlet)]);assert.equal(lotusOnly.status,'unverified');assert.ok(lotusOnly.coverage.mana.unresolved.some(e=>e.name===lotus.name&&/sacrifice/.test(e.reason)),'mandatory entry fuel stays unresolved, not free mana');
assert.equal(inspect([row(lotus),row(plains,5),row(cheapOutlet)]).status,'supported-conditional','independent payable resources survive an unused uncertain source');

// Primary source requirements (including a Standard/non-Commander seed) are hard
// only when selected as such. A separate supported package cannot erase them.
const primary=c('Synthetic selected primary','Creature — Human','Whenever a Vehicle you control enters, draw a card if it has flying. Otherwise, put a flying counter on it.',2,2,'{2}');
const seedRows=[row(plains,51),row(hammer,4),row(thopter,4),row(primary)];
result=inspect(seedRows,{seed:primary.name,seedOrigin:'user'});assert.equal(result.axes.closing.status,'supported-conditional');assert.equal(result.axes.input.status,'missing');assert.equal(result.status,'known-incomplete');assert.equal(result.requestSatisfied,false);assert.ok(result.issues.some(x=>/selected primary/.test(x)));
assert.equal(inspect(seedRows,{seed:primary.name,seedOrigin:'automatic'}).axes.input.required,false,'automatic discovery is not a new user hard requirement');

// Preserve all route diagnostics; shared board/Equipment is not independent backup.
const context=JSON.parse(fs.readFileSync(new URL('./test-fixtures/commander-context.json',import.meta.url))),knightDeck=context.decks.knights,knightRows=knightDeck.cards.map(r=>row(context.catalog[cardKey(r.name)],r.qty));
const strategy=mtgStrategicEstimate(knightDeck,context.catalog,commanderCriteria(knightDeck,context.catalog,{roles:c=>roles(c).flatMap(x=>x==='Interaction'?['Removal']:x)}),{roles:c=>roles(c).flatMap(x=>x==='Interaction'?['Removal']:x)});
assert.equal(strategy.routes.length,3,'existing UI remains bounded');assert.ok(strategy.allRoutes.length>3,'all diagnostic routes are exposed without a hidden acceptance cap');
result=inspect(knightRows,{},knightDeck);assert.ok(result.routes.length>3);assert.equal(result.routes.filter(r=>r.id.startsWith('strategy:')).length,strategy.allRoutes.length);assert.ok(supported(result).length>1);assert.equal(result.independentRouteGroups.length,1,'multiple combat mechanisms share board failure and cannot inflate independent backup credit');
const expensive={...knights,name:'Synthetic unavailable optional output',mana_cost:'{99}',cmc:99};
assert.equal(inspect([...tokenPlan,row(expensive)]).status,inspect(tokenPlan).status,'an unavailable optional alternative does not destroy a feasible unchanged package');

// Evidence changes invalidate support, but visual/price changes cannot manufacture it.
const mutable=structuredClone(equipment),d=deck(mutable),request={game:'mtg',format:'Modern'},first=inspectFinalSupport(request,mutable,d),before=JSON.stringify({request,mutable,d});
assert.equal(JSON.stringify({request,mutable,d}),before);assert.equal(finalSupportFingerprint(request,[...mutable].reverse(),d),first.fingerprint);
assert.notEqual(finalSupportFingerprint(request,mutable,{...d,buildAround:'Changed selected source'}),first.fingerprint,'selected primary fallback changes the evidence identity');
const split=[...mutable.slice(0,1),{...mutable[1],qty:2},{...mutable[1],qty:2},mutable[2]];assert.equal(finalSupportFingerprint(request,split,d),first.fingerprint,'split duplicate rows have the same logical evidence identity');
const cosmetic=structuredClone(mutable);cosmetic[1].card.prices={usd:'9999'};cosmetic[1].card.image_uris={normal:'changed'};assert.equal(finalSupportFingerprint(request,cosmetic,d),first.fingerprint);
mutable[1].card.oracle_text='Equip {8}';const changed=inspectFinalSupport(request,mutable,d);assert.notEqual(changed.fingerprint,first.fingerprint);assert.notEqual(changed.status,'supported-conditional','same-object Oracle edit cannot inherit memoized old output');
const withUnknown=[...equipment,row({name:'Incomplete details',type_line:'Artifact'})];assert.equal(inspect(withUnknown).status,'unverified');
assert.equal(inspect([{...equipment[0],qty:1.5},...equipment.slice(1)]).status,'unverified','invalid quantities do not silently create a verified subset');
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};assert.doesNotThrow(()=>inspectFinalSupport(freeze(structuredClone(request)),freeze(structuredClone(equipment)),freeze(deck(equipment))));

result=inspect(equipment,{matchMode:'bo3'});assert.equal(result.axes.closing.status,'supported-conditional');assert.equal(result.matchCoverage.status,'unverified');assert.equal(result.status,'unverified');assert.equal(result.requestSatisfied,false);assert.equal(result.issues.length,0,'zero-card sideboard is not called illegal');
result=inspect([...equipment,row(plains,1,'side')],{matchMode:'unspecified'});assert.equal(result.matchCoverage.requested,'unspecified');assert.match(result.matchCoverage.evidence,/does not establish match-mode/);
// Full candidate selection must prefer support evidence over a decorative score.
const selectionRequest={game:'mtg',format:'Modern',formatName:'Modern',budget:null,budgetBasis:'total',budgetMode:'cap',budgetBoundary:'inclusive',allowance:0,goal:'strongest'};
const candidate=(list,score)=>{const d=deck(list),r=list.map(row=>({...row,price:1,owned:0})),finalSupport=inspectFinalSupport(selectionRequest,r,d);return {deck:d,rows:r,power:{score,goal:'strongest'},check:{complete:true,legal:true,issues:[]},pricing:priceDeck(r),plan:{issues:finalSupport.issues,finalSupport,notes:finalSupport.notes,setupBurden:0}};};
const sound=candidate(equipment,10),empty=candidate([row(plains,60)],99),unknownCandidate=candidate([row(plains,59),row(alien)],100);
assert.equal(chooseDeck([empty,sound],selectionRequest).deck,sound.deck,'high scalar cannot rescue independently known-incomplete plan');
assert.equal(chooseDeck([empty],selectionRequest).ok,false,'all known-incomplete candidates cannot become finished');
assert.equal(chooseDeck([unknownCandidate,sound],selectionRequest).deck,sound.deck,'bounded supported plan is preferred over unsupported scalar ranking');
const draftOnly=chooseDeck([unknownCandidate],selectionRequest);assert.equal(draftOnly.ok,true);assert.equal(draftOnly.requestSatisfied,false,'unknown-only result remains reviewable draft, never verified strategy');
console.log('PASS: exact final support; legal 100-card known-nonclosing vs unknown alternate win; real Equipment positive; separate input/engine/closing axes; optional branches; compatible paid outlets and finite costs; side/outside exclusion; all routes and dependency grouping; evidence invalidation, purity and partial BO3. No lethal, win-rate or competitive certification.');
