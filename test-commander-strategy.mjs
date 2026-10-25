import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commanderStrategicEstimate,combatContribution,routeJointAccess} from './commander-strategy.js';
import {engineProfile,engineRoles} from './insights.js';
import {engineMap} from './engine-map.js';
import {cardKey,validateDeck} from './core.js';
import {comparePower} from './deck-optimizer.js';
import {mtgPower,powerReadiness,shownPower} from './power.js';
import {formatOf} from './formats.js';
import {S,blank as blankState} from './store.js';
const {decks,catalog}=JSON.parse(fs.readFileSync(new URL('./test-fixtures/commander-context.json',import.meta.url)));
const evaluate=(d,cat=catalog)=>commanderStrategicEstimate(d,cat,engineProfile(d,cat).criteria,{roles:engineRoles});
const kinnan=evaluate(decks.highRamp);assert.ok(kinnan.routes.some(r=>r.kind==='mana-engine'),'actual Kinnan Oracle sentence boundary is recognized');
const humans=Object.fromEntries(Object.entries(catalog).map(([k,c])=>[k,/Creature/.test(c.type_line||'')&&k!==cardKey(decks.highRamp.commander)?{...c,type_line:c.type_line.replace(/—.*/,'— Human'),card_faces:c.card_faces?.map(f=>({...f,type_line:/Creature/.test(f.type_line||'')?f.type_line.replace(/—.*/,'— Human'):f.type_line}))}:c]));
const noHits=evaluate(decks.highRamp,humans);assert.equal(noHits.routes.find(r=>r.kind==='mana-engine')?.conversion,0,'ineligible Human hits do not satisfy non-Human output');assert.ok(noHits.rankingValue<kinnan.rankingValue,'removing recognized Kinnan output worsens the route, without forcing combat absence');assert.deepEqual(evaluate(decks.highRamp),kinnan,'restoring actual card mechanics restores the estimate');
const cmd=catalog[cardKey(decks.highRamp.commander)],irrelevant={...catalog,[cardKey(cmd.name)]:{...cmd,oracle_text:cmd.oracle_text+'\n{99}: Draw a card.'}};assert.equal(evaluate(decks.highRamp,irrelevant).rankingValue,kinnan.rankingValue,'unused activation never becomes mandatory setup');
const dion=catalog[cardKey(decks.knights.commander)],body=combatContribution(dion);assert.equal(body.outputPower,5,'Dion body3 plus ETB Knight2, once, not back-face power');
assert.ok(combatContribution({...dion,card_faces:[{...dion.card_faces[0],oracle_text:'Flying'}]}).pressure<body.pressure,'ETB body contributes output');
const prism=catalog[cardKey('Prophetic Prism')];assert.equal(combatContribution(prism).pressure,0,'filter/cantrip is not a combat route');
// Controlled mutations below are mechanic tests, not claims that synthetic cards
// are real or these lists represent known competitive decks.
const testCard=(name,type,oracle='',power,cmc=1,mana_cost='{1}')=>({name,type_line:type,oracle_text:oracle,power:power==null?undefined:String(power),toughness:'4',cmc,mana_cost,color_identity:[],legalities:{commander:'legal'}});
const leader=testCard('Fixture leader','Legendary Creature — Human','Defender',0,1),land=testCard('Fixture land','Basic Land','{T}: Add {C}.',undefined,0,''),blank=testCard('Fixture blank','Artifact'),threat=testCard('Fixture threat','Creature — Golem','',4,3,'{3}'),small=testCard('Fixture optional body','Artifact Creature — Golem','',1,1),token=testCard('Fixture tokens','Sorcery','Create two 2/2 white Knight creature tokens.',undefined,3,'{3}'),anthem=testCard('Fixture anthem','Enchantment','Creature tokens you control get +1/+1.',undefined,2,'{2}');
const make=(pairs,cmd=leader)=>{const list=[cmd,land,blank,...pairs.map(([c])=>c)],cat=Object.fromEntries(list.map(c=>[cardKey(c.name),c])),cards=[{name:cmd.name,qty:1},{name:land.name,qty:36},...pairs.map(([c,qty])=>({name:c.name,qty}))],fill=100-cards.reduce((n,r)=>n+r.qty,0);if(fill)cards.push({name:blank.name,qty:fill});return {d:{format:'Commander',commander:cmd.name,cards},cat};};
const score=({d,cat})=>evaluate(d,cat);
const baseline=score(make([[threat,20]])),extra=score(make([[threat,20],[small,20]]));assert.ok(extra.rankingValue>=baseline.rankingValue,'adding optional useful bodies cannot dilute unchanged stronger output');
const weak=score(make([[small,20]]));assert.ok(baseline.rankingValue>weak.rankingValue,'same roles/counts/cost-efficiency do not make tiny bodies equal closing output');
const tokens=score(make([[token,20],[anthem,4]])),clue={...token,oracle_text:'Create two Clue tokens.'},opponent={...token,oracle_text:'Target opponent creates two 2/2 white Knight creature tokens.'};
for(const replacement of[clue,opponent])assert.ok(tokens.rankingValue>(score(make([[replacement,20],[anthem,4]])).rankingValue??0),'owned creature output matters; Clues/opponent tokens cannot fill route');
const wrongAnthem={...anthem,oracle_text:'Other Goblins you control get +1/+1.'},noAnthem={...anthem,oracle_text:''};assert.equal(score(make([[token,20],[wrongAnthem,4]])).rankingValue,score(make([[token,20],[noAnthem,4]])).rankingValue,'wrong tribe grants no free anthem benefit');
const loyalty=testCard('Fixture loyalty','Planeswalker','−8: Create four 4/4 white Angel creature tokens with flying.',undefined,3),sacrifice=testCard('Fixture sacrifice','Artifact','Sacrifice three other creatures: Create three 5/5 green Beast creature tokens.',undefined,1);
for(const c of[loyalty,sacrifice]){assert.equal(combatContribution(c).pressure,0);assert.equal(combatContribution(c).known,false,'unresolved nonmana prerequisites are unknown, not free output');}
const ownTrigger=testCard('Fixture opponent trigger','Enchantment','Whenever an opponent casts a spell, create a 2/2 white Knight creature token.',undefined,3);assert.ok(combatContribution(ownTrigger).pressure>0,'opponent trigger may still create your token');
const white={...threat,mana_cost:'{2}{W}',color_identity:['W']},noWhite=score(make([[white,20]]));assert.equal(noWhite.routes.find(r=>r.kind==='combat').deployment,0,'demonstrably absent required color blocks casting');
const supported=make([[white,20]]);supported.cat[cardKey(land.name)]={...land,oracle_text:'{T}: Add {W}.',produced_mana:['W']};assert.ok(score(supported).rankingValue>noWhite.rankingValue,'restoring required color restores deployment');
const amber=catalog[cardKey('Mox Amber')],whiteLeader={...leader,mana_cost:'{W}',color_identity:['W'],colors:['W']};
assert.ok(amber);const circular=score(make([[white,20],[amber,1]],whiteLeader));assert.equal(circular.routes.find(r=>r.kind==='combat').deployment,0,'Amber cannot bootstrap an uncastable colored legend');
const whiteOutlet=testCard('Fixture white outlet','Artifact','{W}: Create a 5/5 white Angel creature token.',undefined,1,'{1}');assert.equal(score(make([[whiteOutlet,20]])).routes.find(r=>r.kind==='combat').deployment,0,'activation color is required separately from cast color');

const unknown=score(make([[testCard('Fixture alternate win','Enchantment','You win the game if an unmodeled condition occurs.'),20]]));assert.equal(unknown.score,null,'unknown conversion is not automatically zero or perfect');
for(const original of[threat,small]){const unavailable={...original,oracle_text:'{W}: Create a 10/10 white Angel creature token.'},base=score(make([[original,20]])),changed=score(make([[unavailable,20]]));assert.equal(changed.rankingValue,base.rankingValue,'unavailable optional activation cannot donate output or suppress independent body');const fixed=make([[unavailable,20]]);fixed.cat[cardKey(land.name)]={...land,produced_mana:['W'],oracle_text:'{T}: Add {W}.'};assert.ok(score(fixed).rankingValue>=changed.rankingValue,'making optional mode feasible cannot hurt');}
const expensive={...threat,cmc:15,mana_cost:'{15}'};assert.ok(score(make([[expensive,20]])).rankingValue<baseline.rankingValue,'paid deployment cost matters');
const reversed={...decks.highRamp,cards:[...decks.highRamp.cards].reverse()},cosmetic=Object.fromEntries(Object.entries(catalog).map(([k,c])=>[k,{...c,image_uris:{normal:'not-evidence'},prices:{usd:'999'}}]));assert.equal(evaluate(reversed,cosmetic).rankingValue,kinnan.rankingValue);
assert.ok(Math.abs(routeJointAccess(99,[{name:'a',qty:1}],[{name:'a',qty:1}],11)-11/99)<1e-12,'overlap counts one physical card, not two copies');
const asPower=s=>({score:s.score,strategic:s,readiness:{provisional:false},goal:'strongest',from:'commander',heuristic:100});assert.ok(comparePower(asPower(kinnan),asPower(noHits))>0,'optimizer uses supported strategic damage, not unchanged role totals');assert.ok(comparePower(asPower(unknown),asPower(kinnan))<0,'unknown evidence is ordered in its own class, preventing pairwise cycles');assert.equal(unknown.score,null,'unknown is still unscored, never numeric zero');
assert.equal(comparePower({...asPower(kinnan),goal:'chaos',from:'meta'},{...asPower(noHits),goal:'chaos'}),0,'meta priority cannot erase subjective intent');
// Public eligibility, with commander availability separate from library draws.
S.state=blankState();S.catalog=catalog;const incomplete=mtgPower({...decks.knights,id:'64-gate',cards:[{name:decks.knights.commander,qty:1},...decks.knights.cards.filter(r=>r.name!==decks.knights.commander&&r.name!=='Plains')]});assert.equal(shownPower(incomplete),null);assert.equal(incomplete.ctx.score,null);assert.equal(incomplete.ctx.fieldEstimate,null);assert.equal(incomplete.assessmentAxes.competitive.score,null);
const sameId=mtgPower({...decks.knights,side:[{name:'Missing sideboard identity',qty:1}]});assert.equal(sameId.score,null,'same-ID sideboard edits invalidate eligibility cache');assert.equal(shownPower(sameId),null);
const absent={...decks.knights,cards:decks.knights.cards.filter(r=>r.name!==decks.knights.commander).map(r=>r.name==='Plains'?{...r,qty:r.qty+1}:r)};assert.ok(powerReadiness('mtg',absent,formatOf(absent),n=>catalog[cardKey(n)]).issues.some(x=>/present exactly once/.test(x)));
console.log('PASS: strategic route damage/restore, actual Kinnan/Dion text, compatible token output, optionality/monotonicity, colors, unknown mechanics, cost, identity invariance, optimizer and public eligibility. These are directional checks, not a calibrated metagame ranking.');

const left={...leader,name:'Fixture partner W',oracle_text:'Partner',color_identity:['W'],mana_cost:'{W}'},right={...leader,name:'Fixture partner U',oracle_text:'Partner',color_identity:['U'],mana_cost:'{U}'};const pair={format:'Commander',commander:left.name,commanders:[left.name,right.name],cards:[{name:left.name,qty:1},{name:right.name,qty:1},{name:land.name,qty:98}]},pairCat=Object.fromEntries([left,right,land].map(c=>[cardKey(c.name),c]));
assert.equal(powerReadiness('mtg',pair,formatOf(pair),n=>pairCat[cardKey(n)]).eligible,true,'two legal commanders are included in100, not100 plus2');
assert.deepEqual(validateDeck(pair,pairCat,[]).issues,[],'saved-deck legality and Power share partner presence/identity checks');
assert.equal(engineMap('mtg',pair.cards.map(r=>({...r,c:pairCat[cardKey(r.name)]})),{commanders:pair.commanders}).library,98,'both commander copies excluded from library access');
const unpaired={...pair,commanders:[left.name,{name:right.name}]};const invalidPairCat={...pairCat,[cardKey(right.name)]:{...right,oracle_text:''}};assert.ok(validateDeck(unpaired,invalidPairCat,[]).issues.some(x=>/pairing/.test(x.text)));

S.catalog=catalog;const stableDeck={...decks.knights,id:'cache-gameplay-only'},cachedPower=mtgPower(stableDeck);assert.equal(mtgPower(stableDeck),cachedPower,'repeated render/AI reads reuse the same result');
S.catalog={...catalog,[cardKey('Plains')]:{...catalog[cardKey('Plains')],prices:{usd:'1000'},image_uris:{normal:'changed-art'},artist:'cosmetic'}};assert.equal(mtgPower({...stableDeck,cards:[...stableDeck.cards].reverse()}),cachedPower,'price, art and row-order changes do not recompute unchanged Power');
S.catalog={...S.catalog,[cardKey('Plains')]:{...S.catalog[cardKey('Plains')],oracle_text:'{T}: Add {C}.',produced_mana:['C'],type_line:'Basic Land'}};assert.notEqual(mtgPower(stableDeck),cachedPower,'rules/resource changes do invalidate analysis');S.catalog=catalog;

for(const name of [decks.knights.commander,'Barkform Harvester']){
 const missingIdentity={...catalog,[cardKey(name)]:{...catalog[cardKey(name)]}};delete missingIdentity[cardKey(name)].color_identity;S.catalog=missingIdentity;
 const d={...decks.knights,id:'identity-hydration-'+name};assert.equal(mtgPower(d).score,null,'missing leader/main color identity blocks overall Power');assert.ok(validateDeck(d,missingIdentity,[]).issues.some(i=>/Color identity data unavailable/.test(i.text)),'saved-deck validation agrees with readiness');
 S.catalog=catalog;assert.ok(Number.isFinite(mtgPower(d).score),'same-ID identity hydration invalidates unavailable result');
}
const sideIdentity={...catalog,[cardKey('Fixture side identity')]:{...catalog[cardKey('Plains')],name:'Fixture side identity'}};delete sideIdentity[cardKey('Fixture side identity')].color_identity;S.catalog=sideIdentity;const sideIdentityDeck={...decks.knights,id:'side-identity-hydration',side:[{name:'Fixture side identity',qty:1}]};assert.equal(mtgPower(sideIdentityDeck).score,null,'missing sideboard identity is unresolved too');S.catalog=catalog;

// Commander-unavailable context is a diagnostic, not a new dependence penalty.
const soleCloser={...leader,name:'Fixture sole commander closer',power:'8',cmc:4,mana_cost:'{4}',oracle_text:'Flying'};
const soleScenario=score(make([],soleCloser));assert.ok(soleScenario.dependence.withCommander.execution>0);assert.equal(soleScenario.dependence.withoutCommander.score,0,'fully covered mana/blank library has no supported output contribution, not a guaranteed loss');assert.equal(soleScenario.dependence.withoutCommander.status,'no-closing-plan');
const optionalCommander={...leader,name:'Fixture optional expensive leader',cmc:15,mana_cost:'{15}'};
const optionalScenario=score(make([[threat,20]],optionalCommander));assert.equal(optionalScenario.dependence.withCommander.score,optionalScenario.dependence.withoutCommander.score,'optional expensive commander never penalizes unchanged independent library route');assert.equal(optionalScenario.score,baseline.score);
assert.deepEqual(optionalScenario.dependence.recast[0].scenarios.map(r=>r.genericTax),[0,2,4]);assert.deepEqual(optionalScenario.dependence.recast[0].scenarios.map(r=>r.normalMana),[15,17,19]);
assert.equal(kinnan.dependence.withoutCommander.library,99);assert.ok(!kinnan.dependence.withoutCommander.routes.some(r=>r.kind==='mana-engine'),'commander output unavailable means its paid route is unavailable');assert.ok(kinnan.dependence.support.independent.some(r=>r.name==='Sol Ring'),'ordinary acceleration survives commander absence');
assert.ok(evaluate(decks.knights).dependence.support.mixed.some(r=>r.name==='Flawless Maneuver'),'optional free casting does not erase the printed-cost independent protection');
const tower=catalog[cardKey('Command Tower')],whiteIdentity={...leader,color_identity:['W'],mana_cost:'{1}'};
const towerScenario=score(make([[white,20],[tower,1]],whiteIdentity));assert.ok(towerScenario.dependence.withoutCommander.score>0,'Command Tower retains declared identity while commander is absent');
// Loyal Drake public text: Wizards Commander2018 release notes (2018-07-27).
const loyal={...testCard('Loyal Drake','Creature — Drake','Flying\nLieutenant — At the beginning of combat on your turn, if you control your commander, draw a card.',2,3,'{2}{U}'),color_identity:['U']};
const onlyDependent=testCard('Fixture commander-required output','Enchantment','At the beginning of your end step, if you control your commander, create a 4/4 white Angel creature token.',undefined,3,'{3}');
const mixedScenario=score(make([[loyal,1],[onlyDependent,1],[threat,20]]));const mixed=mixedScenario.dependence.support.mixed.find(r=>r.name==='Loyal Drake');assert.ok(mixed);assert.ok(mixed.reasons.some(x=>/Printed body/.test(x)));assert.ok(mixed.evidence.some(x=>/if you control your commander/.test(x)));assert.ok(mixedScenario.dependence.support.requiresCommander.some(r=>r.name===onlyDependent.name));
assert.ok(mixedScenario.dependence.support.unmapped.some(r=>r.name===blank.name),'unrecognized support is not automatically independent or dead');
const altCommander={...soleCloser,oracle_text:'Commander ninjutsu {U}{B}'};assert.equal(score(make([[threat,20]],altCommander)).dependence.recast[0].status,'conditional','noncasting/alternate methods need separate review');
const variableCommander={...soleCloser,mana_cost:'{X}{R}'};assert.equal(score(make([[threat,20]],variableCommander)).dependence.recast[0].scenarios[1].normalMana,null,'X is not silently a fixed zero cost');
const pairEstimate=evaluate(pair,pairCat);assert.equal(pairEstimate.dependence.recast.length,2);assert.ok(pairEstimate.dependence.recast.every(r=>r.scenarios[1].genericTax===2),'each partner has its own previous-cast count');
console.log('PASS: bounded Commander-unavailable routes, independent/mixed/required/unknown functions, retained color identity, optional commander, per-leader normal +2/+4 scenarios and unsupported alternate/variable costs. No survival or turn forecast.');

assert.ok(score(make([[amber,1],[threat,20]],whiteLeader)).dependence.support.requiresCommander.some(r=>r.name==='Mox Amber'),'when commander is the only eligible legend, Amber is not labeled independent acceleration');

const swat=JSON.parse(fs.readFileSync(new URL('./test-fixtures/commander-context.json',import.meta.url))).catalog[cardKey('Deflecting Swat')];if(swat){const swatScenario=score(make([[swat,1],[threat,20]]));assert.ok(!swatScenario.dependence.support.requiresCommander.some(r=>r.name===swat.name),'optional free casting is not a mandatory commander requirement');}

// Public frozen placing-list evidence, not a target score: an unsupported spell
// conversion must not inherit a numeric verdict from incidental utility bodies.
const {gunzipSync}=await import('node:zlib');
const bench=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-fixtures/power-bench.json.gz',import.meta.url)))),ralReference=bench.mtg.meta.EDH.decks.find(d=>d.name.startsWith('Ral,')),ralDeck={id:'coverage-public-ral',format:'Commander',commander:ralReference.commanders[0].name,cards:[...ralReference.main,...ralReference.commanders]},ralCatalog=bench.mtg.cards;
const ral=evaluate(ralDeck,ralCatalog);assert.equal(ral.score,null);assert.equal(ral.rankingValue,null);assert.equal(ral.status,'primary-route-unmapped');assert.ok(Number.isFinite(ral.partialScore));assert.ok(ral.routes.length);assert.match(ral.primaryRouteCoverage.label,/not assessed/);assert.ok(ral.primaryRouteCoverage.evidence.some(e=>e.name==='Brain Freeze'));assert.ok(ral.primaryRouteCoverage.evidence.some(e=>e.name==='Underworld Breach'));assert.equal(ral.dependence.withoutCommander.score,null,'the same central coverage gap cannot become numeric merely by disabling commander benefits');
const alter=(names,text)=>Object.fromEntries(Object.entries(ralCatalog).map(([k,c])=>[k,names.includes(c.name)?{...c,oracle_text:text,keywords:[]}:c]));
const noStormOutput=alter(['Brain Freeze',"Mind's Desire"],'Draw a card.');assert.ok(Number.isFinite(evaluate(ralDeck,noStormOutput).score),'Flusterstorm alone is an answer, not evidence of an unmodeled storm conversion');
const noRecursion=alter(['Underworld Breach','Past in Flames','Will of the Jeskai'],'Draw a card.');assert.ok(Number.isFinite(evaluate(ralDeck,noRecursion).score),'storm or a cost-reducing commander alone is not enough to withhold a modeled estimate');
const optionalSpellsLeader=ralCatalog[cardKey(ralDeck.commander)],optionalSpells=score(make([[threat,20]],optionalSpellsLeader));assert.ok(Number.isFinite(optionalSpells.score),'an optional unsupported spells commander does not block self-contained library combat');
const {powerPanel}=await import('./power.js');S.catalog=ralCatalog;const ralPower=mtgPower(ralDeck);assert.equal(shownPower(ralPower),null);const ralHtml=powerPanel(ralPower);assert.match(ralHtml,/Power estimate unavailable/);assert.match(ralHtml,/Important storm \/ recursion route not assessed/);assert.match(ralHtml,/Supported-route diagnostic \d+\/100 only, not overall Power/);
const {metaState}=await import('./meta.js');Object.assign(metaState('mtg:EDH'),{data:bench.mtg.meta.EDH,at:923});const referencedRal=mtgPower({...ralDeck,id:'coverage-public-ral-reference'});assert.ok(shownPower(referencedRal)>0,'independent placing-list reference evidence remains visible, not fabricated from partial route score');assert.equal(referencedRal.strategic.score,null);Object.assign(metaState('mtg:EDH'),{data:null,at:924});S.catalog=catalog;
console.log('PASS: evidenced important storm/recursion coverage gap withholds overall Power, retains partial diagnostics/reference evidence, and does not gate isolated storm answers, recursion alone or optional unsupported commanders.');

const ralWithMinorOutlet={...ralDeck,id:'coverage-minor-outlet',cards:ralDeck.cards.map(r=>r.name==='Pyroclasm'?{...r,name:'Maskwood Nexus'}:r)},ralWithMinorCatalog={...ralCatalog,[cardKey('Maskwood Nexus')]:catalog[cardKey('Maskwood Nexus')]};const minorOutlet=evaluate(ralWithMinorOutlet,ralWithMinorCatalog);assert.ok(minorOutlet.routes.some(r=>r.kind==='resource-output'));assert.equal(minorOutlet.score,null,'one weak optional resource outlet cannot cover an unchanged central spell engine');
