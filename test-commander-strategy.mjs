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
const asPower=s=>({score:s.score,strategic:s,readiness:{provisional:false},goal:'strongest',from:'commander',heuristic:100});assert.ok(comparePower(asPower(kinnan),asPower(noHits))>0,'optimizer uses supported strategic damage, not unchanged role totals');assert.equal(comparePower(asPower(unknown),asPower(kinnan)),0,'unknown estimate cannot be treated as numeric0');
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
