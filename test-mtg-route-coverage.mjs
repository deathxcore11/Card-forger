import assert from 'node:assert/strict';
import fs from 'node:fs';import zlib from 'node:zlib';
import {nonClosingCardCoverage,nonClosingDeckCoverage} from './mtg-route-coverage.js';
import {commanderStrategicEstimate} from './commander-strategy.js';
import {engineProfile,engineRoles} from './insights.js';
import {cardKey} from './core.js';
import {S,blank} from './store.js';
import {mtgPower,shownPower,powerPanel} from './power.js';
import {cleanStrategic} from './coach-evidence.js';
const B=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./test-fixtures/power-bench.json.gz',import.meta.url))));
const pile=B.mtg.cases.find(c=>c.label==='Modern_rarePile'),base={id:'known-nonclosing',format:'Modern',cards:pile.cards,side:[]},catalog=B.mtg.cards;
const evaluate=(deck=base,cat=catalog)=>commanderStrategicEstimate(deck,cat,engineProfile(deck,cat).criteria,{roles:engineRoles});
const weak=evaluate();assert.equal(weak.status,'no-closing-plan');assert.equal(weak.dimensions[0].ratio,0);assert.equal(weak.closingCoverage.status,'covered-nonclosing');assert.ok(weak.closingCoverage.evidence.every(e=>e.status==='nonclosing'));assert.ok(Math.abs(weak.rankingValue-100*weak.dimensions.slice(1).reduce((n,d)=>n+d.weight/100*d.ratio,0))<.02, 'support-only result follows disclosed components within display rounding');
// Another independently arranged known-weak control: public simple card text,
// mocked names/legality, not a real tournament deck or numeric target.
const card=(name,type_line,oracle_text,more={})=>({name,type_line,oracle_text,mana_cost:'{1}{U}',cmc:2,color_identity:['U'],legalities:{modern:'legal'},...more});
const island=card('Island','Basic Land — Island','{T}: Add {U}.',{mana_cost:'',cmc:0,produced_mana:['U']});
const known=[island,...Array.from({length:9},(_,i)=>card('Synthetic known support '+i,i%2?'Instant':'Sorcery',i%2?'Counter target spell.':'Draw two cards.'))];
const control={id:'independent-no-output',format:'Modern',cards:[{name:'Island',qty:24},...known.slice(1).map(c=>({name:c.name,qty:4}))],side:[]},cat=Object.fromEntries(known.map(c=>[cardKey(c.name),c]));
const supportOnly=evaluate(control,cat);assert.equal(supportOnly.status,'no-closing-plan');assert.ok(Number.isFinite(supportOnly.score));assert.equal(supportOnly.dimensions[0].ratio,0);
for(const clause of ['At the beginning of your upkeep, if an unmodeled condition is met, you win the game.','Target opponent mills three cards.','Return target card from your graveyard to your hand.','This spell deals 3 damage to target player.','Search your library for a card, put it into your hand, then shuffle.']){
 const changed=structuredClone(cat);changed[cardKey(known[1].name)].oracle_text+='\n'+clause;
 assert.equal(evaluate(control,changed).score,null,'unconsumed closing/recursion/tutor clause is unknown, not known weak: '+clause);
 assert.equal(evaluate(control,cat).rankingValue,supportOnly.rankingValue,'removing unsupported clause restores exact known evidence');
}
const animated=structuredClone(cat);animated.island.oracle_text+='\n{1}: This land becomes a 2/2 creature until end of turn.';assert.equal(evaluate(control,animated).score,null,'animated land is not classified as mana only');
const missing=structuredClone(cat);delete missing[cardKey(known[1].name)].oracle_text;assert.equal(evaluate(control,missing).score,null,'absent Oracle is not known blank text');
const threat=card('Synthetic supported finisher','Creature — Bird','Flying',{power:'4',toughness:'4',cmc:3,mana_cost:'{2}{U}'}),withThreat={...control,cards:control.cards.map((r,i)=>i===1?{name:threat.name,qty:r.qty}:r)},threatCat={...cat,[cardKey(threat.name)]:threat};
const improved=evaluate(withThreat,threatCat);assert.ok(improved.routes.some(r=>r.kind==='combat'));assert.ok(improved.rankingValue>supportOnly.rankingValue,'actual closing output improves a support-only library');
const carrier=card('Synthetic carrier','Creature — Bird','Flying',{power:'2',toughness:'2'}),carrierDeck={...base,cards:base.cards.map((r,i)=>i===0?{name:carrier.name,qty:r.qty}:r)};assert.ok(evaluate(carrierDeck,{...catalog,[cardKey(carrier.name)]:carrier}).routes.length,'carrier addition restores independently modeled output');
S.state=blank();S.catalog=cat;const publicPower=mtgPower(control);assert.ok(Number.isFinite(shownPower(publicPower)));assert.match(powerPanel(publicPower),/No closing plan found/);assert.equal(cleanStrategic(publicPower.strategic).closingCoverage.status,'covered-nonclosing');
const incomplete={...control,id:'incomplete-known-support',cards:control.cards.slice(1)};assert.equal(shownPower(mtgPower(incomplete)),null,'known no-output does not bypass completeness');
console.log('PASS: full-text known nonclosing evidence differs from unmodeled conversion; independent support-only control, unknown-clause/alternate-win/mill/recursion/player-damage/land-animation negatives, real output restoration, UI/coach and public eligibility. No calibrated score band.');
